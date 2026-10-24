// GET: who is logged in.  POST {username,password}: log in.  DELETE: log out.
import { checkPassword, sessionCookie, clearCookie, currentUser, json, sameOrigin } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method === "GET") {
    const user = currentUser(req);
    return user ? json({ user }) : json({ user: null }, 401);
  }
  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const user = checkPassword(body.username, body.password);
    if (!user) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
      return json({ error: "Wrong username or password" }, 401);
    }
    return json({ user }, 200, { "set-cookie": sessionCookie(user) });
  }
  if (req.method === "DELETE") return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/auth" };
