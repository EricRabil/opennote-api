const cors = require("cors");
import express, { Router } from "express";
import { WebSocket } from "@clusterws/cws";
import { Server } from "http";
import morgan from "morgan";
import { PORT, CONFIG } from "./Constants";
import fetchMetadata from "url-metadata";
import { dbConnect, doPassport } from "./util";
import session from "express-session";
import bodyParser from "body-parser";
import passport from "passport";
import { UserSocketCluster } from "./sockets/UserSocketCluster";
import { User } from "./entity/User";
import { SocketSupervisor } from "./sockets/SocketSupervisor";

const corsOptions = {
  origin: function (origin: string, callback: (e: any, allowed?: boolean) => any) {
    callback(null, true);
  },
  credentials: true
}

const app = express();
app.use(morgan('tiny'));
app.use(cors(corsOptions));

app.use(session({ secret: CONFIG.sessionSecret, resave: false, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

doPassport(passport, app);

app.use('/api/v1', require("./api/v1"));

async function main() {
  await dbConnect();
  console.log('Did connect to DB');

  const server: Server = await new Promise(resolve => {
    let server: Server = app.listen(PORT, () => resolve(server));
  });

  const socketServer = new WebSocket.Server({ server, path: '/socket' });
  const supervisor = SocketSupervisor.sharedInstance();
  socketServer.on('connection', socket => {
    supervisor.connect(socket);
  });

  console.log(`OpenNote API is running on :${PORT}`)
}

main();