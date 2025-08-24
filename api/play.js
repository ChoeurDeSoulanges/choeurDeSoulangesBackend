import { Storage } from "@google-cloud/storage";

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEYFILE,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  // CORS headers for all requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file parameter");

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const fileObj = bucket.file(file.toString());
    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).send("File not found");

    const [metadata] = await fileObj.getMetadata();
    const fileSize = parseInt(metadata.size, 10);
    const range = req.headers.range;

    if (range) {
      // Parse the range header
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "audio/mpeg",
      });

      const stream = fileObj.createReadStream({ start, end });
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      stream.pipe(res);
      req.on("close", () => stream.destroy());
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
      });

      const stream = fileObj.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      stream.pipe(res);
      req.on("close", () => stream.destroy());
    }
  } catch (err) {
    console.error("Audio play error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
