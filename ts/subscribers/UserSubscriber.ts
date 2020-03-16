import { EventSubscriber, EntitySubscriberInterface, UpdateEvent } from "typeorm";
import { User } from "../entity/User";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  async beforeUpdate(event: UpdateEvent<User>) {
    const { entity, databaseEntity } = event;
    const reactive = User.reactive;
    if (entity && databaseEntity) {
      const diff = Object.keys(entity).filter(key => reactive.indexOf(key) > -1).filter(key => (entity as any)[key] !== (databaseEntity as any)[key]).reduce((acc,key) => ({...acc, [key]: (entity as any)[key]}),{});
      if (Object.keys(diff).length === 0) return;
      if (!entity.cluster) return;
      entity.cluster.send({
        action: "/update/user",
        data: diff
      });
    }
  }
}