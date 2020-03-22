import { EventEmitter } from "events";
import { Note } from "../entity/Note";
import { UserSocketCluster, Payload, isPayload } from "./UserSocketCluster";
import { SocketWrapper } from "./SocketWrapper";

export class NoteSocketCluster extends EventEmitter {
  public readonly clusters: UserSocketCluster[] = [];
  private onEmpty = this.disconnect.bind(this);

  constructor(public readonly note: Note) { super() }

  connect(cluster: UserSocketCluster) {
    if (this.clusters.indexOf(cluster) > -1) return;
    cluster.on('empty', this.onEmpty);
    this.clusters.push(cluster);
    return this.sendSubscriberList();
  }

  disconnect(cluster: UserSocketCluster) {
    const index = this.clusters.indexOf(cluster);
    if (index === -1) return;
    cluster.removeListener('empty', this.onEmpty);
    this.clusters.splice(index, 1);
    return Promise.all([
      this.sendSubscriberList(),
      cluster.send({
        action: "/update/note/subscribers",
        data: {
          subscribers: []
        }
      })
    ]);
  }

  sendSubscriberList() {
    return this.send({
      action: "/update/note/subscribers",
      data: {
        subscribers: this.clusters.map(cluster => cluster.user.json)
      }
    });
  }

  send(payload: Payload, excluding: SocketWrapper[] = []) {
    if (!isPayload(payload)) {
      // use sendRaw to send custom payloads. sorry. fuck you.
      console.warn('Invalid payload blocked from sending to client.');
      return;
    }
    return this.sendRaw(JSON.stringify(payload), excluding);
  }

  sendRaw(payload: string, excluding: SocketWrapper[] = []): Promise<void> {
    return Promise.all(this.clusters.map(cluster => cluster.sendRaw(payload, excluding))) as any;
  }

  dispatchCRUD(packet: any, excluding: SocketWrapper[] = []) {
    return this.send({
      action: "/note/crud",
      data: {
        note: this.note.id,
        packet
      }
    }, excluding);
  }
}