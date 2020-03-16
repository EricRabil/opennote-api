import { EventEmitter } from "events";
import { pathToRegexp, match, parse, compile, Key, regexpToFunction } from "path-to-regexp";
import { WebSocket } from "@clusterws/cws";
import { User } from "../entity/User";
import { Router } from "express";
import API_V1 from "../api/v1";
import { SocketWrapper } from "./SocketWrapper";
import { SocketSupervisor } from "./SocketSupervisor";

let routes: any[] = [];

function getRoutes(stack: any[], parent: any[] = [], match: any[] = []) {
  stack.forEach(function(middleware) {
    var route;
    let regexp = middleware.regexp.toString();
    regexp = regexp.slice(3);
    const index = regexp.indexOf('/?(');
    regexp = regexp.slice(0, index - 1);

    if (middleware.route) {
        routes.push({ path: middleware.route.path, parent: parent, handler: middleware.route.stack[0].handle, methods: middleware.route.methods, match: match.concat(middleware.match.bind(middleware)) });
    } else if (middleware.name === 'router') {
        getRoutes(middleware.handle.stack, parent.concat(regexp), match.concat(middleware.match.bind(middleware)));
    }
  });
}

getRoutes(API_V1.stack);

interface Route {
  path: string;
  parent: string[];
  handler: Function;
  methods: {[key: string]: boolean};
  match: Function[];
}

function matchRoute(path: string): Route[] {
  let _path = path;
  let matched: any[] = [];
  for (let route of routes) {
    _path = path;
    let didDie: boolean = false;
    for (let match of route.match) {
      if (!match(_path)) {
        didDie = true;
        break;
      }
      _path = `/${_path.split('/').slice(2).join('/')}`;
    }
    if (!didDie) {
      matched.push(route);
    }
  }
  return matched;
}

export interface Payload {
  action: string;
  data?: any;
  method?: string;
  nonce?: string;
}

export function isPayload(data: any): data is Payload {
  return typeof data['action'] === "string";
}

interface SocketRequest {
  body: any;
  url: string;
  params: object;
  user: User;
  socket: SocketWrapper;
  cluster: UserSocketCluster;
  nonce?: string;
}

interface Layer {
  handle?: Layer[];
  regexp?: RegExp;
  stack?: Layer[];
  route?: {
    path: string;
    stack: Layer[];
  };
}

function createRequestForMessage(payload: Payload, socket: SocketWrapper, cluster: UserSocketCluster): SocketRequest {
  return {
    body: payload.data,
    url: payload.action,
    user: cluster.user,
    socket,
    cluster,
    params: {},
    nonce: payload.nonce
  };
}

class WebSocketResponse {
  constructor(public socket: SocketWrapper, public nonce?: string) {

  }

  status(code: number) {
    return this;
  }

  json(body: any) {
    return this.send(body);
  }

  /**
   * Send response to the socket, if and only if the nonce is set
   * @param data data to send
   */
  send(data: any) {
    if (!this.nonce) return;
    return this.socket.send({
      action: "response",
      data,
      nonce: this.nonce
    });
  }
}

export class UserSocketCluster extends EventEmitter {
  public readonly sockets: SocketWrapper[] = [];
  private onMessage = this.receive.bind(this);
  private onClose = this.disconnect.bind(this);

  constructor(public readonly user: User) { super() }

  /**
   * Adds a socket to the pool and binds listeners
   * @param socket socket to add
   */
  connect(socket: SocketWrapper) {
    this.sockets.push(socket);
    socket.on('message', this.onMessage);
    socket.on('close', this.onClose);
  }

  /**
   * Removes socket from the socket pool
   * @param socket socket to remove
   */
  disconnect(socket: SocketWrapper) {
    socket.removeListener('message', this.onMessage);
    const index = this.sockets.indexOf(socket);
    if (index === -1) return;
    socket.removeListener('close', this.onClose);
    this.sockets.splice(this.sockets.indexOf(socket), 1);
    if (this.sockets.length === 0) this.emit("empty", this);
  }

  async receive(payload: Payload, onSocket: SocketWrapper) {
    // higher-level but socket-only APIs
    var cluster;
    console.log(payload.action);
    switch (payload.action) {
      case "subscribe":
        if (!payload.data || !payload.data.note) {
          onSocket.close(400, "Malformed payload.");
          return;
        }
        cluster = await SocketSupervisor.sharedInstance().clusterForNote(payload.data.note);
        if (!cluster) {
          // fail
          return;
        }
        cluster.connect(this);
        return;
      case "unsubscribe":
        if (!payload.data || !payload.data.note) {
          onSocket.close(400, "Malformed payload.");
          return;
        }
        cluster = SocketSupervisor.sharedInstance().noteClusters[payload.data.note];
        if (!cluster) {
          // no point
          return;
        }
        cluster.disconnect(this);
        return;
    }

    const request = createRequestForMessage(payload, onSocket, this);
    const response = new WebSocketResponse(onSocket, payload.nonce);
    const method = payload.method || "post";
    const route = matchRoute(request.url).filter(route => route.handler.prototype && route.handler.prototype.options && route.handler.prototype.options.supportsSocket).find(route => route.methods[method]);
    
    const joinedPath = `/${route!.parent.map(parent => parent.split('/').filter(s => s)).reduce((acc,cur) => acc.concat(cur), []).concat(route!.path.split('/').filter(s => s)).join('/')}`;
    
    const keys: Key[] = [];
    const regexp = pathToRegexp(joinedPath, keys);
    const matcher = regexpToFunction(regexp, keys);

    if (keys.length > 0) {
      const matched = matcher(request.url);
      if (!matched) {
        // fail die
        return;
      }
      request.params = Object.assign({}, matched.params);
      console.log(request.params);
    }

    if (route) {
      route.handler(request, response, () => {

      });
    }
  }

  send(payload: Payload) {
    if (!isPayload(payload)) {
      // use sendRaw to send custom payloads. sorry. fuck you.
      console.warn('Invalid payload blocked from sending to client.');
      return;
    }
    return this.sendRaw(JSON.stringify(payload));
  }

  sendRaw(payload: string): Promise<void> {
    return Promise.all(this.sockets.map(sock => sock.sendRaw(payload))) as any;
  }
}