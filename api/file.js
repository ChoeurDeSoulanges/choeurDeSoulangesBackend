import { Storage } from "@google-cloud/storage";
import path from "path";

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

  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file parameter");

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const decodedFile = decodeURIComponent(file);
    const fileObj = bucket.file(decodedFile);

    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).send("File not found");

    const filename = path.basename(fileObj.name);
    const ext = path.extname(filename).toLowerCase();

    // Determine content type
    let contentType = "application/octet-stream";
    if (ext === ".mp3") contentType = "audio/mpeg";
    else if (ext === ".wav") contentType = "audio/wav";

    // Set headers before streaming
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(
        /"/g,
        ""
      )}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    // Stream the file
    fileObj
      .createReadStream()
      .pipe(res)
      .on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });
  } catch (err) {
    console.error("Audio download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
