import fs from "fs-extra";
import path from "path";
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import ONEntity from "../entity";
import { File } from "formidable";
import { CONFIG } from "../Constants";

@Entity()
export class DBFile extends ONEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  path: string;

  @Column({ unique: true })
  selector: string;

  @Column()
  name: string;

  getFile() {
    return fs.readFile(this.path);
  }

  get json() {
    const { id, selector, name } = this;
    return {
      id,
      selector,
      name
    }
  }

  static async createSelector() {
    const roll = () => Math.random().toString(36);
    let selector = roll();

    do {
      selector = roll();
    } while (await DBFile.findOne({ selector }));

    return selector;
  }

  static FILE_REGEX = /(?:\.([^.]+))?$/;

  static async createFile(file: File) {
    const { path: tempPath, name } = file;
    const selector = await this.createSelector();
    const parts = this.FILE_REGEX.exec(name);
    const extension = parts && `.${parts[1]}`;
    const newPath = path.join(CONFIG.storage, `${selector}.${extension}`);
    console.debug({ newPath });
    await fs.copy(tempPath, newPath);

    this.FILE_REGEX.lastIndex = -1;

    const dbFile = DBFile.create({
      path: newPath,
      name: file.name,
      selector
    });

    await dbFile.save();

    return dbFile;
  }
}