import { Expose, plainToClass } from "class-transformer";
import crypto from "crypto";
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, BeforeInsert, RelationId, CreateDateColumn } from "typeorm";
import ONEntity from "../entity";
import { User } from "./User";
import { Length, MaxLength, MinLength } from "class-validator";
import { Reactive } from "../entity.decorators";
import { SocketSupervisor } from "../sockets/SocketSupervisor";
import { NoteSocketCluster } from "../sockets/NoteSocketCluster";

@Entity()
export class Note extends ONEntity {
  static reactive: string[] = [];

  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("simple-json")
  @Reactive()
  data: any;

  @Column()
  @Reactive()
  name: string;

  @Column({ unique: true })
  @MaxLength(15)
  @MinLength(3)
  @Reactive()
  shortCode: string;

  @ManyToOne(type => User, user => user.notes)
  @JoinColumn({ name: "authorId" })
  author: User;

  @Column({ nullable: true })
  @RelationId("author")
  authorId: string;

  @CreateDateColumn({ type: "timestamp" })
  created: Date;

  /**
   * Generates unique shortcode for the note
   */
  @BeforeInsert()
  async regenerateShortCode() {
    while (await Note.findOne({
      shortCode: this.shortCode = crypto.randomBytes(10).toString('hex')
    })) {
      await this.regenerateShortCode();
    }
  }

  userCanManageNote(author: User | string) {
    if (typeof author === "object") author = author.id;
    return this.authorId === author;
  }

  userCanEditNode(author: User | string) {
    return this.userCanManageNote(author);
  }

  applyPatches({ data, shortCode, name }: Partial<Note>) {
    this.data = data || this.data;
    this.shortCode = shortCode || this.shortCode;
    this.name = name || this.name;
  }

  get json() {
    return {
      id: this.id,
      data: this.data,
      name: this.name,
      authorId: this.authorId,
      shortCode: this.shortCode,
      created: this.created.getTime()
    }
  }

  get cluster(): NoteSocketCluster | undefined {
    return SocketSupervisor.sharedInstance().noteClusters[this.id];
  }
}