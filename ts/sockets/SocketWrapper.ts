import { EventEmitter } from "events";
import { WebSocket } from "@clusterws/cws";
import { Payload, isPayload, UserSocketCluster } from "./UserSocketCluster";
import { sleep } from "../util";
import { User } from "../entity/User";
import { SocketSupervisor } from "./SocketSupervisor";

export class SocketWrapper extends EventEmitter {
  public constructor(public socket: WebSocket, public cluster: UserSocketCluster | null = null) {
    super();
    // pass close events up to the cluster
    socket.on("close", (code, reason) => this.emit("close", this));
    socket.on("message", message => {
      try {
        message = JSON.parse(message);
      } catch {
        // terminate on malformed payload
        return this.close(400, "Malformed payload.");
      }

      if (!isPayload(message)) {
        // terminate on malformed payload
        return this.close(400, "Malformed payload.");
      }

      // pass parsed payload on to receive function
      this.receive(message);
    });

    // sent init payload if not authenticated
    if (!this.user) {
      this.runInitializationPhase();
    }
  }

  /**
   * Handle payload from socket
   * @param payload payload data
   */
  async receive(payload: Payload) {
    // listen for socket level calls, otherwise pass it to the api
    switch (payload.action) {
      case "init":
        if (!payload.data || !payload.data.token) {
          console.warn('Terminating socket with malformed init payload');
          return this.close(400, "Malformed payload.");
        }

        const { token } = payload.data;
        const user = await User.findByJWT(token);

        if (!user) {
          // no user found, invalid token
          return this.close(400, "Invalid token.");
        }

        // tell the supervisor we are authenticated
        this.emit("authenticated", user);
        break;
      default:
        if (!this.user) {
          // higher level API calls are not allowed until authentication
          return;
        }
        this.emit("message", payload, this);
    }
  }

  /**
   * User representing this socket
   */
  get user() {
    return this.cluster && this.cluster.user;
  }

  /**
   * Bind the socket to a new cluster and dispatch the updated data to the socket
   * @param cluster socket cluster
   */
  async bindToCluster(cluster: UserSocketCluster) {
    this.cluster = cluster;
    this.cluster.connect(this);
    // pass new user to socket
    await this.send({
      action: "ready",
      data: {
        user: cluster.user
      }
    });
  }

  async close(code?: number, reason?: string) {
    // dont call close if we are already closed
    this.sendRaw(JSON.stringify({
      closing: true,
      code,
      reason
    })).then(() => this.socket.close());
  }

  private async runInitializationPhase() {
    await this.send({
      action: "init"
    });

    // if after 5000 seconds we arent authenticated, close the socket
    await sleep(5000);
    if (!this.user) {
      await this.close(401, "Failed to authenticate within the timeout.");
    }
  }

  /**
   * Send a payload to the socket
   * @param payload payload
   */
  send(payload: Payload) {
    if (!isPayload(payload)) {
      // use sendRaw to send custom payloads. sorry. fuck you.
      console.warn('Invalid payload blocked from sending to client.');
      return;
    }
    return this.sendRaw(JSON.stringify(payload));
  }

  /**
   * Sends raw data to the socket
   * @param payload data to send
   */
  sendRaw(payload: string | Buffer) {
    return new Promise(resolve => this.socket.send(payload, undefined, resolve));
  }
}