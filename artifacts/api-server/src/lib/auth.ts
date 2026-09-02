import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, type User } from "@workspace/db";
import type { Request, Response } from "express";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface OidcConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface SessionData {
  user: AuthUser;
}

let oidcConfiguration: OidcConfiguration | null = null;
let jwksCache: { keys: Record<string, unknown>[]; expiresAt: number } | null = null;

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

function parseJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function getOidcConfiguration() {
  if (oidcConfiguration) return oidcConfiguration;
  const response = await fetch(`${ISSUER_URL.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!response.ok) throw new Error("The sign-in provider is unavailable.");
  oidcConfiguration = (await response.json()) as OidcConfiguration;
  return oidcConfiguration;
}

async function getJwks(uri: string) {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(uri);
  if (!response.ok) throw new Error("The sign-in provider keys are unavailable.");
  const body = (await response.json()) as { keys?: Record<string, unknown>[] };
  if (!body.keys?.length) throw new Error("The sign-in provider returned no signing keys.");
  jwksCache = { keys: body.keys, expiresAt: Date.now() + 15 * 60 * 1000 };
  return body.keys;
}

async function verifyIdToken(idToken: string, expectedNonce: string | undefined) {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("The sign-in response was malformed.");
  }

  const header = parseJwtPart(encodedHeader);
  const claims = parseJwtPart(encodedPayload);
  const configuration = await getOidcConfiguration();
  const key = (await getJwks(configuration.jwks_uri)).find((item) => item.kid === header.kid);
  if (!key) throw new Error("The sign-in response used an unknown signing key.");

  const publicKey = createPublicKey({ key: key as never, format: "jwk" });
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("The sign-in response signature was invalid.");

  const audience = claims.aud;
  const validAudience =
    audience === process.env.REPL_ID ||
    (Array.isArray(audience) && audience.includes(process.env.REPL_ID));
  if (claims.iss !== configuration.issuer || !validAudience) {
    throw new Error("The sign-in response was issued for another application.");
  }
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("The sign-in response has expired.");
  }
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error("The sign-in response nonce was invalid.");
  }
  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("The sign-in response did not identify a user.");
  }

  return claims;
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
  };
}

export async function upsertAuthUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: typeof claims.email === "string" ? claims.email : null,
    firstName: typeof claims.first_name === "string" ? claims.first_name : null,
    lastName: typeof claims.last_name === "string" ? claims.last_name : null,
    profileImageUrl:
      typeof claims.profile_image_url === "string"
        ? claims.profile_image_url
        : typeof claims.picture === "string"
          ? claims.picture
          : null,
  };
  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();
  if (!user) throw new Error("The signed-in user could not be saved.");
  return toAuthUser(user);
}

export async function authenticateAuthorizationCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  expectedNonce: string | undefined,
) {
  const configuration = await getOidcConfiguration();
  const response = await fetch(configuration.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.REPL_ID ?? "",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) throw new Error("The sign-in code could not be exchanged.");
  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("The sign-in provider returned no identity token.");
  return upsertAuthUser(await verifyIdToken(tokens.id_token, expectedNonce));
}

export async function createSession(user: AuthUser) {
  const sid = randomBytes(32).toString("hex");
  const session: SessionData = { user };
  await db.insert(sessionsTable).values({
    sid,
    sess: session,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string) {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid)).limit(1);
  if (!row) return null;
  if (row.expire < new Date()) {
    await deleteSession(sid);
    return null;
  }
  return row.sess as SessionData;
}

export async function deleteSession(sid: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export function getSessionId(req: Request) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return req.cookies?.[SESSION_COOKIE] as string | undefined;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export function createPkceVerifier() {
  return base64Url(randomBytes(32));
}

export function createPkceChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function createOpaqueValue() {
  return base64Url(randomBytes(32));
}

export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function getAuthOrigin(req: Request) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return `${proto || "https"}://${host || "localhost"}`;
}

export async function getAuthorizationUrl(redirectUri: string, state: string, nonce: string, verifier: string) {
  const configuration = await getOidcConfiguration();
  const authorizationUrl = new URL(configuration.authorization_endpoint);
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.REPL_ID ?? "",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    code_challenge: createPkceChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  }).toString();
  return authorizationUrl.toString();
}