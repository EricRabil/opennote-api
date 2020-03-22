import { RouteGroup, Get, RespondsWithJSON, UnknownArtifact, Post, DoesNeedLogin, Patch, ForbiddenAction, SupportsWS, Delete } from "../../route.kit";
import { Request, Response } from "express";
import { Note } from "../../entity/Note";
import { User as ONoteUser } from "../../entity/User";

declare global {
  namespace Express {
    interface User extends ONoteUser {
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@RouteGroup('/notes')
export class NotesAPI_V1 {
  @Get('/me', RespondsWithJSON, DoesNeedLogin, SupportsWS)
  async listNotes({ user }: Request) {
    const notes = await Note.find({
      authorId: user!.id
    }).then(n => n.map(n => n.json));

    return {
      notes
    }
  }

  @Post('/new', RespondsWithJSON)
  async createNote({ user, body: { data, name } }: Request) {
    const authorId = user && user.id,
      { json } = await Note.create({
        data,
        name,
        author: {
          id: user ? user.id : undefined
        }
      }).save();

    return json;
  }

  @Get('/:id', RespondsWithJSON, SupportsWS)
  async fetchNote({ params: { id } }: Request) {
    var note;
    try {
      note = await Note.findOne({
        [id.match(UUID_REGEX) ? "id" : "shortCode"]: id
      });
    } finally {
      if (!note) {
        return UnknownArtifact('note');
      }

      return note.json
    }
  }

  @Patch('/:id', RespondsWithJSON, DoesNeedLogin, SupportsWS)
  async patchNote({ user, params: { id }, body: patches }: Request) {
    var note: Note | undefined;
    try {
      note = await Note.findOne({
        [id.match(UUID_REGEX) ? "id" : "shortCode"]: id
      });
    } finally {
      if (!note) {
        return UnknownArtifact('note');
      }
    }

    if (!note.userCanManageNote(user!)) {
      return ForbiddenAction();
    }

    if (patches.data && JSON.stringify(patches.data) === JSON.stringify(note.data)) {
      return note.json;
    }

    note.applyPatches(patches);
    const { json } = await note.save();

    return json;
  }

  @Delete('/:id', RespondsWithJSON, DoesNeedLogin, SupportsWS)
  async deleteNote({ user, params: { id }}: Request) {
    var note: Note | undefined;
    try {
      note = await Note.findOne({
        [id.match(UUID_REGEX) ? "id" : "shortCode"]: id
      });
    } finally {
      if (!note) {
        return UnknownArtifact('note');
      }
    }

    if (note.authorId !== user!.id) {
      return ForbiddenAction();
    }

    await note.remove();

    return {
      id
    };
  }
}