import type { NextFunction, Request, Response } from "express";
import { getSession, getSessionId } from "../lib/auth";
import type { AuthUser } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      isAuthenticated(): this is Request & { user: AuthUser };
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request): this is Request & { user: AuthUser } {
    return Boolean(this.user);
  };
  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }
  try {
    const session = await getSession(sid);
    if (session?.user?.id) req.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}