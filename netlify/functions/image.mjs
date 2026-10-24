// Serves an uploaded image. Add &download=1 to save it as a file.
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!/^[a-z0-9-]+\.(png|jpg|gif|webp)$/.test(key)) return new Response("Not found", { status: 404 });

  const entry = await getStore({ name: "images", consistency: "strong" }).getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry) return new Response("Not found", { status: 404 });

  const headers = {
    "content-type": entry.metadata?.contentType || "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  };
  if (url.searchParams.get("download")) headers["content-disposition"] = `attachment; filename="${key}"`;
  return new Response(entry.data, { headers });
};

export const config = { path: "/api/image" };
