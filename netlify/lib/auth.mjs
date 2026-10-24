// Session auth for uploaders.
// Accounts come from the USERS env var: "alice:password1,bob:password2".
// Sessions are HMAC-signed cookies keyed by the SESSION_SECRET env var.
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "smdb_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const env = (k) => (process.env[k] || "").trim();

function secret() {
  const s = env("SESSION_SECRET");
  if (s.length < 16) throw new Error("SESSION_SECRET env var missing or shorter than 16 characters");
  return s;
}

function users() {
  const map = new Map();
  for (const pair of env("USERS").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) map.set(pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1).trim());
  }
  return map;
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const sign = (data) => createHmac("sha256", secret()).update(data).digest("base64url");

export function checkPassword(username, password) {
  const u = String(username || "").trim().toLowerCase();
  const expected = users().get(u);
  if (!u || expected === undefined) {
    safeEq(password, "dummy-value-to-even-out-timing");
    return null;
  }
  return safeEq(password, expected) ? u : null;
}

export function sessionCookie(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

// Returns the username for a valid session, otherwise null.
export function currentUser(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig || !safeEq(sig, sign(payload))) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!u || exp < Date.now() / 1000 || !users().has(u)) return null; // removing a user revokes their session
    return u;
  } catch {
    return null;
  }
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

// Blocks cross-site form posts on state-changing requests.
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}
