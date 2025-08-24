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
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  if (!req.query.folder)
    return res.status(400).send("Missing folder parameter");

  // 🔑 decode, normalize, and ensure trailing slash
  let folder = decodeURIComponent(req.query.folder).normalize("NFC");
  if (!folder.endsWith("/")) folder += "/";

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    // Debug: list all files under the parent folder
    const parentPrefix = folder.split("/").slice(0, -1).join("/") + "/";
    const [allFiles] = await bucket.getFiles({ prefix: parentPrefix });
    console.log("All files under parent prefix:");
    allFiles.forEach((f) => console.log(JSON.stringify(f.name)));

    // List files under the requested folder
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
      // Normalize object name
      const normalizedName = fileObj.name.normalize("NFC");
      const relativePath = normalizedName.slice(folder.length);
      if (!relativePath) continue; // skip empty "folder" objects

      console.log("Adding file to zip:", relativePath);
      const stream = fileObj.createReadStream();
      archive.append(stream, { name: relativePath });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Folder download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
