// Downloads an image hosted on Know Your Meme's CDN as a file.
// Browsers ignore the download attribute for other sites' images, so the file is passed through here.
const ALLOWED_HOSTS = new Set(["i.kym-cdn.com"]);
const MAX_BYTES = 15 * 1024 * 1024;
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export default async (req) => {
  const params = new URL(req.url).searchParams;
  let src;
  try { src = new URL(params.get("src") || ""); } catch { return new Response("Bad image URL", { status: 400 }); }
  if (src.protocol !== "https:" || !ALLOWED_HOSTS.has(src.hostname)) return new Response("Host not allowed", { status: 400 });

  // Follow up to 3 redirects, but only while they stay on an allowed host.
  let upstream = null;
  for (let hop = 0; hop < 4; hop++) {
    upstream = await fetch(src, { redirect: "manual", headers: { "user-agent": "son-meme-db" } }).catch(() => null);
    if (!upstream || upstream.status < 300 || upstream.status >= 400) break;
    let next;
    try { next = new URL(upstream.headers.get("location") || "", src); } catch { upstream = null; break; }
    if (next.protocol !== "https:" || !ALLOWED_HOSTS.has(next.hostname)) { upstream = null; break; }
    src = next;
  }
  if (!upstream || !upstream.ok) return new Response("Could not fetch image", { status: 502 });

  const type = (upstream.headers.get("content-type") || "").split(";")[0].trim();
  if (!EXT[type]) return new Response("Not an image", { status: 415 });
  const len = Number(upstream.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return new Response("Image too large", { status: 413 });

  const base = (params.get("name") || "son-meme").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "son-meme";
  return new Response(upstream.body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${base}.${EXT[type]}"`,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
};

export const config = { path: "/api/download" };
