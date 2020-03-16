import { IRoute, Request, Response, RequestHandler, Router } from "express";

export namespace RouteKit {
  export interface RouteData {
    method: RequestMethod;
    path: string;
    options: RouteOptions;
  }
  
  export function compileRoute(handler: Function, { method, path, options }: RouteKit.RouteData): RequestHandler {
    if (options.needsLogin) {
      handler = RouteMixins.NeedsLogin(handler, typeof options.needsLogin === "string" ? options.needsLogin : undefined);
    }
  
    if (options.returnsResponse) {
      handler = RouteMixins.JSONR(handler);
    }
  
    return handler as any;
  }

  export function bindRoutesToRouter(target: any, router: Router) {
    const routeFunctions: Array<Function & { route: RouteKit.RouteData }> = Object.getOwnPropertyNames(target.__proto__).filter(prop => target[prop].route).map(prop => target[prop]);

    routeFunctions.forEach(fn => {
      const bound = RouteKit.compileRoute(fn, fn.route).bind(target);
      bound.prototype = {
        options: fn.route.options
      }
      router[fn.route.method](fn.route.path, bound);
    });
  }

  export function bindGroupToRouter(group: any, router: Router) {
    if (!(group.route && group.route.path)) return router;

    router.use(group.route.path, GroupRouter(group));

    return router;
  }
  
  export function buildDecoratorForMethod(method: RequestMethod) {
    return function(path: string, ...flags: RouteOptions[]) {
      return Route(method, path, options(...flags));
    }
  }
}

namespace RouteMixins {
  export function JSONR(old: Function) {
    return async function (this: any, req: Request, res: Response, next: any) {
      const retVal = await old.call(this, req, res, next);
      if (retVal === null) return;
      else if (retVal instanceof JSONResponse) retVal.execute(res);
      else if (typeof retVal === "object") new JSONResponse(retVal).execute(res);
    }
  }

  export function NeedsLogin(old: Function, failMessage?: string) {
    return async function (this: any, req: Request, res: Response, next: any) {
      if (req.user) {
        return await old.call(this, req, res, next);
      }
      return NotLoggedInResponse(failMessage);
    }
  }

  export function NeedsReauth(old: Function, failMessage?: string): RequestHandler {
    return async function(this: any, req, res, next) {
      if ((req.user!.password === null) || (await req.user!.testPassword(req.body.password))) {
        return await old.call(this, req, res, next);
      }
      return new ErrorResponse(403, 'E_NEED_REAUTH', 'Missing or incorrect password.');
    }
  }
}

export class JSONResponse {
  constructor(public body: any = {}, public status: number = 200) { }

  execute(res: Response) {
    res.status(this.status).json(this.body);
  }
}

export class ErrorResponse extends JSONResponse {
  constructor(status: number, code: string | number, reason?: string) {
    super({
      success: false,
      error: {
        code,
        reason
      }
    }, status);
  }
}

export type RequestMethod = Exclude<keyof IRoute, "path" | "stack">;

export interface RouteOptions {
  returnsResponse?: boolean;
  needsLogin?: boolean | string;
  needsReauth?: boolean | string;
  supportsSocket?: boolean;
}

export const NotLoggedInResponse =
  (message: string = "You must be logged in to perform that action.") => (
    new ErrorResponse(401, 'E_NOT_LOGGED_IN', message)
  );

export const BadRequestResponse = (message: string = "Your request is invalid.") => (
  new ErrorResponse(400, 'E_BAD_REQUEST', message)
);

export const UnknownArtifact = (artifact: string) => (
  new ErrorResponse(404, 'E_UNKNOWN_ARTIFACT', `Unknown ${artifact}.`)
);

export const ForbiddenAction = () => (
  new ErrorResponse(403, 'E_FORBIDDEN', 'You are not allowed to perform that action.')
)

export function options(...options: RouteOptions[]): RouteOptions {
  return options.reduce((acc, cur) => Object.assign(acc, cur), {});
}

export const RespondsWithJSON: RouteOptions = {
  returnsResponse: true
};

export const DoesNeedLogin: RouteOptions = {
  needsLogin: true
};

export const DoesNeedReauth: RouteOptions = {
  needsReauth: true
};

export const SupportsWS: RouteOptions = {
  supportsSocket: true
};

export const DoesNeedLoginWithMessage: (message: string) => RouteOptions = message => ({
  needsLogin: message
});

export function GroupRouter(group: any): Router {
  const router = Router();

  RouteKit.bindRoutesToRouter(group, router);

  return router;
}

export function GroupedRouter(...groups: any[]): Router {
  groups = groups.filter(group => typeof group === "function").map(group => new group).filter(group => group.route && group.route.path);

  const router = Router();

  groups.forEach(group => RouteKit.bindGroupToRouter(group, router));

  return router;
}

export function Route(method: RequestMethod, path: string, options: RouteOptions = {}): any {
  return function(target: any, key: string, descriptor: any) {
    descriptor.value.route = {
      method,
      path,
      options
    };
    
    return descriptor;
  }
}

export function RouteGroup(path: string): any {
  return function(target: any) {
    (target as any).prototype.route = {
      path
    };

    return target;
  }
}

export const Get = RouteKit.buildDecoratorForMethod('get');
export const Put = RouteKit.buildDecoratorForMethod('put');
export const Post = RouteKit.buildDecoratorForMethod('post');
export const Patch = RouteKit.buildDecoratorForMethod('patch');
export const Delete = RouteKit.buildDecoratorForMethod('delete');
