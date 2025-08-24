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
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Access-Control-Allow-Origin": corsOrigin });
    return res.end("Method Not Allowed");
  }

  const { file } = req.query;
  if (!file) {
    res.writeHead(400, { "Access-Control-Allow-Origin": corsOrigin });
    return res.end("Missing file parameter");
  }

  try {
    const decodedFile = decodeURIComponent(file);
    const bucket = storage.bucket(BUCKET_NAME);
    const fileObj = bucket.file(decodedFile);
    const [exists] = await fileObj.exists();

    if (!exists) {
      res.writeHead(404, { "Access-Control-Allow-Origin": corsOrigin });
      return res.end("File not found");
    }

    const filename = fileObj.name.split("/").pop() || "file";
    const ext = filename.split(".").pop().toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "wav") contentType = "audio/wav";

    // Send headers first (including CORS) before streaming
    res.writeHead(200, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="file.${ext}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
    });

    // Pipe GCS stream directly
    const stream = fileObj.createReadStream();
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) res.writeHead(500).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent)
      res.writeHead(500, { "Access-Control-Allow-Origin": corsOrigin }).end();
    else res.end();
  }
}
