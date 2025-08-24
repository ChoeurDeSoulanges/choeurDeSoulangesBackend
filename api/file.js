import { Storage } from "@google-cloud/storage";

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
    const fileObj = bucket.file(decodeURIComponent(file));
    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).send("File not found");

    const filename = fileObj.name.split("/").pop();

    // Set headers for audio download
    res.setHeader("Content-Type", "audio/mpeg"); // or detect .wav
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="file.mp3"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`
    );

    fileObj.createReadStream().pipe(res);
  } catch (err) {
    console.error("Audio download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
