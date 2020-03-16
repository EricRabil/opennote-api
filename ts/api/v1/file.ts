import { RouteGroup, Get, RespondsWithJSON, UnknownArtifact } from "../../route.kit";
import { Request, Response } from "express";
import { DBFile } from "../../entity/DBFile";

@RouteGroup('/file')
export class FileAPI_V1 {
  @Get('/:selector', RespondsWithJSON)
  async getFile({ params: { selector }}: Request, res: Response) {
    const file = await DBFile.findOne({
      selector
    });

    if (!file) {
      return UnknownArtifact('file');
    }

    await new Promise(resolve => res.sendFile(file.path, resolve));

    return null;
  }
}