import { Request, Response, RequestHandler } from "express";
import formidable from "formidable";
import { Magic, MAGIC_MIME_TYPE } from "mmmagic";
import passport from "passport";
import { Get, options, RespondsWithJSON, DoesNeedLogin, RouteGroup, Patch, DoesNeedReauth, Post, ErrorResponse, SupportsWS, BadRequestResponse } from "../../route.kit";
import { SUPPORTED_LOGINS } from "../../Constants";
import { DBFile } from "../../entity/DBFile";

const local: RequestHandler = (req, res, next) => new Promise((resolve, reject) => passport.authenticate('local', (err, user) => err ? reject(err) : resolve(user))(req, res, next));

@RouteGroup('/user')
export class UserAPI_V1 {
  magic: Magic = new Magic(MAGIC_MIME_TYPE);

  @Get('/me', options(RespondsWithJSON, DoesNeedLogin, SupportsWS))
  whoami(req: Request, res: Response, next: any) {
    return req.user!.json;
  }

  @Patch('/me/preferences', options(RespondsWithJSON, DoesNeedLogin, SupportsWS))
  async updatePreferences({user, body: { preferences }}: Request) {
    if (!preferences) {
      return BadRequestResponse("preference object is missing in the body");
    }

    user!.preferences = preferences;
    await user!.save();

    return user!.preferences;
  }

  @Get('/me/logout', options(RespondsWithJSON, DoesNeedLogin))
  logout(req: Request, res: Response, next: any) {
    req.logout();
    return {
      goodbye: true
    };
  }

  @Get('/me/token', options(RespondsWithJSON, DoesNeedLogin, SupportsWS))
  async generateToken({ user }: Request) {
    const token = await user!.createToken();
    return {
      token
    };
  }

  @Patch('/me/password', options(RespondsWithJSON, DoesNeedLogin, DoesNeedReauth))
  async setPassword(req: Request, res: Response, next: any) {
    await req.user!.setPassword(req.body.newPassword);
    await req.user!.save();

    return {

    };
  }

  @Patch('/me', options(RespondsWithJSON, DoesNeedLogin))
  async updateMe({ user, body: { email, username, avatar } }: Request) {
    user!.email = email || user!.email;
    user!.username = username || user!.username;
    user!.avatar = avatar || user!.avatar;
    
    await user!.save();

    return user!.json;
  }

  @Patch('/me/avatar', options(RespondsWithJSON, DoesNeedLogin))
  async updateAvatar(req: Request) {
    const file: formidable.File = await new Promise((resolve, reject) => {
      const form = new formidable.IncomingForm();
      form.parse(req);
      form.once('file', (name, file) => resolve(file));
    });

    const type: string = await new Promise((resolve, reject) => this.magic.detectFile(file.path, (e, res) => e ? reject(e) : resolve(res)));
    if (!type.startsWith('image')) return new ErrorResponse(400, 'E_INVALID_MIME', 'Please provide an image as the avatar.');

    const dbFile = await DBFile.createFile(file);
    
    req.user!.avatar = dbFile;
    await req.user!.save();

    return dbFile.json;
  }

  @Post('/login', options(RespondsWithJSON))
  async login(req: Request, res: Response, next: any) {
    const result = await local(req, res, next);

    if (!result) {
      return new ErrorResponse(401, 'E_BAD_LOGIN', 'Invalid email or password');
    }

    await new Promise(resolve => req.login(result, resolve));

    return result.json;
  }
}