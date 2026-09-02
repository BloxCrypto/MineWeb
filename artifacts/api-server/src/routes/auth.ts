import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import {
  authenticateAuthorizationCode,
  clearSessionCookie,
  createOpaqueValue,
  createPkceVerifier,
  createSession,
  deleteSession,
  getAuthOrigin,
  getAuthorizationUrl,
  getSessionId,
  safeReturnTo,
  setSessionCookie,
} from "../lib/auth";

const router: IRouter = Router();
const OIDC_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60 * 1000,
};

router.get("/auth/user", (req, res) => {
  res.json(GetCurrentAuthUserResponse.parse({ user: req.isAuthenticated() ? req.user : null }));
});

router.get("/login", async (req: Request, res: Response) => {
  try {
    const state = createOpaqueValue();
    const nonce = createOpaqueValue();
    const verifier = createPkceVerifier();
    const redirectUri = `${getAuthOrigin(req)}/api/callback`;
    const url = await getAuthorizationUrl(redirectUri, state, nonce, verifier);
    res.cookie("oidc_state", state, OIDC_COOKIE_OPTIONS);
    res.cookie("oidc_nonce", nonce, OIDC_COOKIE_OPTIONS);
    res.cookie("oidc_verifier", verifier, OIDC_COOKIE_OPTIONS);
    res.cookie("oidc_return_to", safeReturnTo(req.query.returnTo), OIDC_COOKIE_OPTIONS);
    res.redirect(url);
  } catch {
    res.redirect("/api/auth/user");
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  const state = req.cookies?.oidc_state;
  const nonce = req.cookies?.oidc_nonce;
  const verifier = req.cookies?.oidc_verifier;
  if (!state || !nonce || !verifier || state !== req.query.state) {
    res.redirect("/api/login");
    return;
  }

  try {
    const redirectUri = `${getAuthOrigin(req)}/api/callback`;
    const user = await authenticateAuthorizationCode(
      String(req.query.code ?? ""),
      verifier,
      redirectUri,
      nonce,
    );
    const sid = await createSession(user);
    setSessionCookie(res, sid);
    for (const cookie of ["oidc_state", "oidc_nonce", "oidc_verifier", "oidc_return_to"]) {
      res.clearCookie(cookie, { path: "/" });
    }
    res.redirect(safeReturnTo(req.cookies?.oidc_return_to));
  } catch {
    res.redirect("/api/login");
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  clearSessionCookie(res);
  res.redirect(safeReturnTo(req.query.returnTo));
});

export default router;