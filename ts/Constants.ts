import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import { IOAuth2StrategyOption } from "passport-google-oauth";

export const PORT = process.env.PORT || 8090;
export const DB_NAME = process.env.DB_NAME || "onote-api-dev";
export const CONFIG_PATH = path.join(__dirname, '..', 'onoteapi.config.json');

interface Configuration {
  google: IOAuth2StrategyOption;
  sessionSecret: string;
  frontendURL: string;
  storage: string;
  jwtSecret: string;
  jwtExpirySeconds: number;
}

const localConfig: Configuration = fs.pathExistsSync(CONFIG_PATH) ? require(CONFIG_PATH) : {};

function camelToUnderscore(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toLowerCase();
}

const generateSecret = () => crypto.randomBytes(64).toString('hex');

export const CONFIG: Configuration = {
  google: {
    clientID: process.env.GOOGLE_ID || "",
    clientSecret: process.env.GOOGLE_SECRET || "",
    callbackURL: process.env.GOOGLE_CALLBACK || "",
    ...(localConfig.google || {})
  },
  frontendURL: process.env.FRONTEND_URL || localConfig.frontendURL || "http://localhost:8080",
  sessionSecret: process.env.SESSION_SECRET || localConfig.sessionSecret || generateSecret(),
  storage: process.env.STORAGE || localConfig.storage || "/usr/local/var/onapi",
  jwtSecret: process.env.JWT_SECRET || localConfig.jwtSecret || generateSecret(),
  jwtExpirySeconds: parseInt(process.env.JWT_EXPIRY!) || (isNaN(localConfig.jwtExpirySeconds) ? 60000 : localConfig.jwtExpirySeconds)
}

fs.writeJSONSync(CONFIG_PATH, CONFIG, { spaces: 4 });

export const SUPPORTED_LOGINS: { [key: string]: boolean } = {
  google: !!CONFIG.google.clientID,
  local: true
}