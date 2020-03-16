import "reflect-metadata";
import express, { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { createConnection } from "typeorm";
import { DB_NAME, CONFIG } from "./Constants";
import { OAuth2Strategy as GoogleStrategy } from "passport-google-oauth";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import { PassportStatic } from "passport";
import { User } from "./entity/User";
import { Provider } from "./enum/Providers";
import { OAuthLogin } from "./entity/OAuthLogin";
import { ErrorResponse } from "./route.kit";

export function dbConnect() {
  return createConnection({
    type: "postgres",
    host: "localhost",
    port: 5432,
    database: DB_NAME,
    entities: [
      __dirname + "/entity/*.js",
      __dirname + "/entity/*.ts"
    ],
    subscribers: [
      __dirname + "/subscribers/*.js",
      __dirname + "/subscribers/*.ts"
    ],
    synchronize: true,
    logging: false
  });
}

export function doPassport(passport: PassportStatic, app: express.Application) {
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (userID: string, done) => {
    try {
      const user = await User.findOne({ id: userID });
      done(null, user);
    } catch (e) {
      done(e, null);
    }
  });

  passport.use(new GoogleStrategy({ passReqToCallback: true, ...CONFIG.google }, async (req, token, refreshToken, profile, done) => {
    const oAuthLogin = { provider: Provider.GOOGLE, providerId: profile.id };
    let user = await User.findOne({ oAuthLogins: oAuthLogin as any });
    
    if (!user) {
      user = User.create({
        username: profile.username,
        email: profile.emails![0].value,
        oAuthLogins: [
          await OAuthLogin.create(oAuthLogin).save()
        ]
      });
      await user.save();
    }

    done(null, user);
  }));

  const opts = {
    jwtFromRequest: ExtractJwt.fromBodyField("token"),
    secretOrKey: CONFIG.jwtSecret
  }

  passport.use(new JWTStrategy(opts, async function(payload, done) {
    const user = await User.findOne({ id: payload.id });
    return done(null, user || false);
  }));

  passport.use(new LocalStrategy({usernameField: "email"}, async (email, password, done) => {
    const user = await User.findOne({
      email
    });

    if (user && user.password) {
      if (await user.testPassword(password)) {
        return done(null, user);
      }
    }

    return done(null, false);
  }));

  // app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));

  // app.get('/auth/google/callback',
  //   passport.authenticate('google', { failureRedirect: '/login' }),
  //   function (req, res) {
  //     res.redirect('/api/v1/users/me');
  //   }
  // );
}

export function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

export namespace IdentityUtils {
  /**
   * Creates a standardized JWT using configured secret/expiration
   * @param payload payload to sign
   */
  export function createToken(payload: any): Promise<string> {
    return new Promise((resolve, reject) => (
      jwt.sign(payload, CONFIG.jwtSecret, {
        expiresIn: CONFIG.jwtExpirySeconds
      }, (err, encoded) => (
        err ? reject(err) : resolve(encoded)
      ))
    ));
  }

  /**
   * Verifies a JWT using configured secret
   * @param token token to verify
   */
  export function verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => (
      jwt.verify(token, CONFIG.jwtSecret, (err, result) => (
        err ? reject(err) : resolve(result)
      ))
    ));
  }
}