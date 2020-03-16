import { EventSubscriber, EntitySubscriberInterface, UpdateEvent } from "typeorm";
import { Note } from "../entity/Note";

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
}