import { Column, ManyToOne, BaseEntity, Entity, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";

@Entity()
export class OAuthLogin extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  provider: string;

  @Column()
  providerId: string;

  @ManyToOne(type => User)
  user: User;
}