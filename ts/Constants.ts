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
    clientID: "",
    clientSecret: "",
    callbackURL: "",
    ...(localConfig.google || {})
  },
  frontendURL: localConfig.frontendURL || "http://localhost:8080",
  sessionSecret: localConfig.sessionSecret || generateSecret(),
  storage: localConfig.storage || "/usr/local/var/onapi",
  jwtSecret: localConfig.jwtSecret || generateSecret(),
  jwtExpirySeconds: isNaN(localConfig.jwtExpirySeconds) ? 300 : localConfig.jwtExpirySeconds
}

fs.writeJSONSync(CONFIG_PATH, CONFIG, { spaces: 4 });

export const SUPPORTED_LOGINS: { [key: string]: boolean } = {
  google: !!CONFIG.google.clientID,
  local: true
}