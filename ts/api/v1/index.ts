import { ToolsAPI_V1 } from "./tools";
import { UserAPI_V1 } from "./user";
import { GroupedRouter } from "../../route.kit";
import { NotesAPI_V1 } from "./notes";
import { AuthAPI_V1 } from "./auth";
import { FileAPI_V1 } from "./file";
import { Router } from "express";

const API_V1 = GroupedRouter(
  ToolsAPI_V1,
  UserAPI_V1,
  NotesAPI_V1,
  AuthAPI_V1,
  FileAPI_V1
);

export = API_V1;