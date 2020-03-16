import { EventEmitter } from "events";
import { UserSocketCluster } from "./UserSocketCluster";
import { User } from "../entity/User";
import { WebSocket } from "@clusterws/cws";
import { SocketWrapper } from "./SocketWrapper";
import { NoteSocketCluster } from "./NoteSocketCluster";
import { BaseEntity } from "typeorm";
import { Note } from "../entity/Note";

export class SocketSupervisor extends EventEmitter {
  userClusters: {
    [uuid: string]: UserSocketCluster;
  } = {};

  noteClusters: {
    [uuid: string]: NoteSocketCluster;
  } = {};

  pendingSocketPool: SocketWrapper[] = [];

  private constructor() {
    super();
  }

  private static singleton: SocketSupervisor;

  public static sharedInstance() {
    if (!this.singleton) {
      this.singleton = new SocketSupervisor();
    }
    return this.singleton;
  }

  connect(socket: WebSocket) {
    const wrapper = new SocketWrapper(socket);
    this.pendingSocketPool.push(wrapper);

    // dismount socket from the pending sockets pool
    const clear = () => {
      const index = this.pendingSocketPool.indexOf(wrapper);
      if (index === -1) return;
      this.pendingSocketPool.splice(this.pendingSocketPool.indexOf(wrapper), 1);
    }

    // dismount socket on premature close
    wrapper.on("close", clear);
    wrapper.once("authenticated", async (user: User) => {
      wrapper.bindToCluster(await this.clusterForUser(user.id));

      // hand off close management to the cluster, clear socket from pending pool
      wrapper.removeListener("close", clear);
      clear();
    });
  }

  /**
   * Returns whether or not a user cluster exists, representing whether the user has any connected clients
   * @param id user id
   */
  userClusterExists(id: string) {
    return !!this.userClusters[id];
  }

  /**
   * Returns whether or not a note cluster exists, representing any listeners
   * @param id note id
   */
  noteClusterExists(id: string) {
    return !!this.noteClusters[id];
  }

  /**
   * Returns a socket cluster for the given user ID
   * @param id user ID
   */
  async clusterForUser(id: string) {
    let cluster = this.userClusters[id];

    if (!cluster) {
      // create a cluster and assign
      cluster = (await this.createUserCluster(id))!;
      if (!cluster) {
        throw new Error(`Couldn't find a user for the ID "${id}" in cluster generation`);
      }
      return this.userClusters[id] = cluster;
    }

    return cluster;
  }

  /**
   * Returns a socket cluster for the given note ID
   * @param id note ID
   */
  async clusterForNote(id: string) {
    let cluster = this.noteClusters[id];

    if (!cluster) {
      cluster = (await this.createNoteCluster(id))!;
      if (!cluster) {
        return null;
      }
      return this.noteClusters[id] = cluster;
    }

    return cluster;
  }

  /**
   * Creates a socket cluster for the given user ID
   * @param id user ID
   */
  async createUserCluster(id: string) {
    const user = await User.findOne({
      id
    });

    if (!user) {
      return null;
    }

    const cluster = new UserSocketCluster(user);
    cluster.once('empty', () => {
      if (this.userClusters[id] === cluster) {
        delete this.userClusters[id];
      }
    });

    return cluster;
  }

  /**
   * Creates a socket cluster for the given note iD
   * @param id note ID
   */
  async createNoteCluster(id: string) {
    const note = await Note.findOne({
      id
    });

    if (!note) {
      return null;
    }

    const cluster = new NoteSocketCluster(note);
    cluster.once('empty', () => {
      if (this.noteClusters[id] === cluster) {
        delete this.noteClusters[id];
      }
    });

    return cluster;
  }
}