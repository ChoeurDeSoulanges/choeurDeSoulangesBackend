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

  const { folder } = req.query;
  if (!folder) return res.status(400).send("Missing folder parameter");

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    // List all files under the folder
    const [files] = await bucket.getFiles({
      prefix: folder.endsWith("/") ? folder : folder + "/",
    });

    if (!files.length) return res.status(404).send("Folder not found or empty");

    // Set headers for zip download
    const zipName = `${folder.split("/").pop() || "folder"}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).end();
    });

    archive.pipe(res);

    // Add each file to the archive
    for (const fileObj of files) {
      const stream = fileObj.createReadStream();
      const relativePath = fileObj.name
        .slice(folder.length)
        .replace(/^\/+/, ""); // path inside zip
      archive.append(stream, { name: relativePath });
    }

    archive.finalize();
  } catch (err) {
    console.error("Folder download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
