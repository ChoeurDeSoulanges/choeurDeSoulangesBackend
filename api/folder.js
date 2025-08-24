import { Storage } from "@google-cloud/storage";
import archiver from "archiver";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://choeur-de-soulanges.vercel.app",
];

const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  // Always set CORS headers first
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

  try {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

    if (!req.query.folder)
      return res.status(400).send("Missing folder parameter");

    let folder = decodeURIComponent(req.query.folder).normalize("NFC");
    if (!folder.endsWith("/")) folder += "/";

    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: folder });

    if (!files.length) return res.status(404).send("Folder not found or empty");

    const zipName = `${
      folder.split("/").filter(Boolean).pop() || "folder"
    }.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    for (const fileObj of files) {
      const relativePath = fileObj.name.slice(folder.length);
      if (!relativePath) continue;
      archive.append(fileObj.createReadStream(), { name: relativePath });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Folder download error:", err);
    // Make sure CORS headers are always sent
    if (!res.headersSent) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.status(500).json({ error: err.message || "Internal error" });
    }
  }
}
