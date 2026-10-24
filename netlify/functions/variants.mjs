// GET: list uploaded variants.  POST (logged in, multipart form): upload one.  DELETE ?id= (logged in): remove one.
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { currentUser, json, sameOrigin } from "../lib/auth.mjs";

const MAX_BYTES = 4 * 1024 * 1024; // stays under Netlify's synchronous request size limit
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

const meta = () => getStore({ name: "variants", consistency: "strong" });
const images = () => getStore({ name: "images", consistency: "strong" });

const clean = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "son";

// Image files start with fixed bytes; check them so a renamed non-image is rejected.
function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export default async (req) => {
  if (req.method === "GET") {
    const store = meta();
    const { blobs } = await store.list();
    const items = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
    items.sort((a, b) => (b.added || "").localeCompare(a.added || ""));
    return json(items);
  }

  if (!sameOrigin(req)) return json({ error: "Bad origin" }, 403);
  const user = currentUser(req);
  if (!user) return json({ error: "Log in first" }, 401);

  if (req.method === "POST") {
    let form;
    try { form = await req.formData(); } catch { return json({ error: "Expected a form upload" }, 400); }
    const name = clean(form.get("name"), 120);
    const file = form.get("image");
    if (!name) return json({ error: "Name is required" }, 400);
    if (!file || typeof file === "string") return json({ error: "Choose an image" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "Image must be 4 MB or smaller" }, 413);

    const buf = await file.arrayBuffer();
    const type = sniff(buf);
    if (!type) return json({ error: "Only PNG, JPG, GIF or WebP images" }, 415);

    const id = `${slug(name)}-${randomBytes(3).toString("hex")}`;
    const key = `${id}.${TYPES[type]}`;
    await images().set(key, buf, { metadata: { contentType: type } });

    const source = clean(form.get("source"));
    const entry = {
      id,
      name,
      description: clean(form.get("description"), 1000),
      origin: clean(form.get("origin"), 200),
      year: null,
      added: new Date().toISOString().slice(0, 10),
      tags: [...new Set(clean(form.get("tags")).toLowerCase().split(",").map((t) => t.trim().replace(/\s+/g, "-")).filter(Boolean))].slice(0, 12),
      image: `/api/image?key=${encodeURIComponent(key)}`,
      imageKey: key,
      source: /^https?:\/\//i.test(source) ? source : "",
      kym: "",
      uploader: user,
      uploaded: true,
    };
    await meta().setJSON(id, entry);
    return json(entry, 201);
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id") || "";
    const store = meta();
    const entry = await store.get(id, { type: "json" });
    if (!entry) return json({ error: "Not found" }, 404);
    if (entry.imageKey) await images().delete(entry.imageKey);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/variants" };
