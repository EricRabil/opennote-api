import { EventSubscriber, EntitySubscriberInterface, UpdateEvent, InsertEvent, RemoveEvent } from "typeorm";
import { Note } from "../entity/Note";
import { SocketSupervisor } from "../sockets/SocketSupervisor";

@EventSubscriber()
export class NoteSubscriber implements EntitySubscriberInterface<Note> {
  async beforeUpdate(event: UpdateEvent<Note>) {
    const { entity, databaseEntity } = event;
    const reactive = Note.reactive;
    if (entity && databaseEntity) {
      const diff = Object.keys(entity).filter(key => reactive.indexOf(key) > -1).filter(key => JSON.stringify((entity as any)[key]) !== JSON.stringify((databaseEntity as any)[key])).reduce((acc,key) => ({...acc, [key]: (entity as any)[key]}),{});
      if (Object.keys(diff).length === 0) return;
      if (!entity.cluster) return;
      entity.cluster.send({
        action: "/update/note",
        data: {
          id: entity.id,
          ...diff
        }
      });
    }
  }

  async afterInsert({ entity }: InsertEvent<Note>) {
    const cluster = entity.author.cluster;
    if (!cluster) return;
    cluster.send({
      action: "/note/create",
      data: entity.json
    });
  }

  async beforeRemove({ entity }: RemoveEvent<Note>) {
    if (!entity) return;
    Object.defineProperty(entity, '__id__', {
      value: entity.id,
      writable: false,
      enumerable: false
    });
  }

  async afterRemove({ entity }: RemoveEvent<Note & {__id__: string}>) {
    if (!entity) return;
    const cluster = SocketSupervisor.sharedInstance().userClusters[entity.authorId];
    if (!cluster) return;
    cluster.send({
      action: "/note/delete",
      data: entity['__id__']
    });
  }
}