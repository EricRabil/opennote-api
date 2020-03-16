import { Entity, Column, BaseEntity, PrimaryGeneratedColumn, OneToMany, BeforeUpdate, BeforeInsert, AfterLoad, AfterUpdate, OneToOne, JoinColumn, RelationId, getMetadataArgsStorage } from "typeorm";
import { IsEmail, IsUrl } from "class-validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuthLogin } from "./OAuthLogin";
import { Note } from "./Note";
import { DBFile } from "./DBFile";
import { JoinAttribute } from "typeorm/query-builder/JoinAttribute";
import { CONFIG } from "../Constants";
import { IdentityUtils } from "../util";
import { UserSocketCluster } from "../sockets/UserSocketCluster";
import { SocketSupervisor } from "../sockets/SocketSupervisor";
import { Reactive } from "../entity.decorators";

export interface LoginUserDto {
  email: string;
  password: string;
}

@Entity()
export class User extends BaseEntity {
  static reactive: string[] = [];

  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  username: string;

  @Column()
  @IsEmail()
  email: string;

  @Reactive()
  @Column('simple-json', { nullable: true })
  preferences: any;

  @OneToMany(type => OAuthLogin, login => login.user)
  oAuthLogins: OAuthLogin[];

  @OneToMany(type => Note, note => note.author)
  notes: Promise<Note[]>;

  @Reactive()
  @Column({ nullable: true })
  password: string;

  @OneToOne(type => DBFile)
  @JoinColumn({ referencedColumnName: "selector" })
  avatar: DBFile;

  @RelationId('avatar')
  avatarSelector: string;

  get json(): any {
    const { id, username, email } = this;
    return {
      id,
      username,
      email,
      avatar: this.avatarSelector
    }
  }

  get identifier(): any {
    const { id } = this;
    return {
      id
    }
  }

  get cluster(): UserSocketCluster | undefined {
    return SocketSupervisor.sharedInstance().userClusters[this.id];
  }

  async setPassword(pw: string) {
    this.password = await bcrypt.hash(pw, 10);
  }

  async testPassword(password: string) {
    return bcrypt.compare(password, this.password);
  }

  createToken(): Promise<string> {
    return IdentityUtils.createToken(this.identifier);
  }

  static async findByJWT(token: string): Promise<User | undefined> {
    const identifier = await IdentityUtils.verifyToken(token).catch(e => null);
    if (!identifier) return;
    const { id } = identifier;
    if (!id) return;
    
    return User.findOne({
      id
    });
  }

  static async findByEmailAndPassword(loginUserDto: LoginUserDto) {
    return this.getRepository().findOne({ email: loginUserDto.email }).then(async user => {
      if (user && await bcrypt.compare(loginUserDto.password, user.password)) {
        return user;
      }
    });
  }
}