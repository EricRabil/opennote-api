import { RouteGroup, Get, RespondsWithJSON, ErrorResponse, Post, DoesNeedLogin } from "../../route.kit";
import { Request, Response, NextFunction, RequestHandler } from "express";
import passport from "passport";
import { CONFIG, SUPPORTED_LOGINS } from "../../Constants";
import { User } from "../../entity/User";

const jwt: RequestHandler = (req, res, next) => new Promise((resolve, reject) => passport.authenticate('jwt', { session: false }, (err, user) => err ? reject(err) : resolve(user))(req, res, next));

@RouteGroup('/auth')
export class AuthAPI_V1 {
  googleMiddleware = passport.authenticate('google', {
    scope: 'profile email'
  });

  @Get('/google')
  async signInWithGoogle(req: Request, res: Response, next: NextFunction) {
    this.googleMiddleware(req, res, next);
  }

  @Get('/google/callback', RespondsWithJSON)
  async didSignInWithGoogle(req: Request, res: Response, next: NextFunction) {
    const { err, user, info } = await new Promise(resolve => passport.authenticate('google', (err, user, info) => resolve({ err, user, info }))(req, res, next));

    if (err) {
      console.debug('Failed to log user into google', err);
      return new ErrorResponse(400, 'E_AUTH_FAILED', 'Unable to authenticate with google.');
    }

    await new Promise(resolve => req.login(user, resolve));

    res.redirect(`${CONFIG.frontendURL}/?loggedIn=1`)
  }

  @Post('/refresh', RespondsWithJSON)
  async refreshSessionWithToken(req: Request, res: Response, next: NextFunction) {
    const result = await jwt(req, res, next);

    if (!result) {
      return new ErrorResponse(401, 'E_BAD_TOKEN', 'Invalid token.');
    }

    await new Promise(resolve => req.login(result, resolve));

    const token = await (result as User).createToken();

    return {
      token
    };
  }

  @Get('/methods', RespondsWithJSON)
  loginMethods() {
    return {
      methods: Object.keys(SUPPORTED_LOGINS).filter(k => SUPPORTED_LOGINS[k])
    };
  }
}