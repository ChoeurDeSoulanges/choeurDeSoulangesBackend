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
  // Always get origin first
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

  // Decode safely
  const decodedFile = decodeURIComponent(file);

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const fileObj = bucket.file(decodedFile);

    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).send("File not found");

    const filename = fileObj.name.split("/").pop() || "file";

    // Detect extension for Content-Type
    const ext = filename.split(".").pop().toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "wav") contentType = "audio/wav";

    res.setHeader("Content-Type", contentType);

    // Proper Content-Disposition with UTF-8 safe filename
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="file.${ext}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`
    );

    // Stream the file
    const stream = fileObj.createReadStream();
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
