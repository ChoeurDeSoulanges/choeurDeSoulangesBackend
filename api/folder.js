import { Storage } from "@google-cloud/storage";
import archiver from "archiver";

const BUCKET_NAME = process.env.GCLOUD_BUCKET;
const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://choeur-de-soulanges.vercel.app",
  ];
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    if (!req.query.folder)
      return res.status(400).json({ error: "Missing folder parameter" });

    let folder = decodeURIComponent(req.query.folder).normalize("NFC");
    if (!folder.endsWith("/")) folder += "/";

    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: folder });

    if (!files.length)
      return res.status(404).json({ error: "Folder not found or empty" });

    // Encode filename safely for Content-Disposition
    const rawName = folder.split("/").filter(Boolean).pop() || "folder";
    const zipName = encodeURIComponent(rawName) + ".zip";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${zipName}`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    for (const fileObj of files) {
      const relativePath = fileObj.name.slice(folder.length);
      if (!relativePath) continue;
      const stream = fileObj.createReadStream();
      archive.append(stream, { name: relativePath });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Folder download error:", err);
    if (!res.headersSent)
      res.status(500).json({ error: err.message || "Internal server error" });
  }
}
