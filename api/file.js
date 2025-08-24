import { Storage } from "@google-cloud/storage";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { file } = req.query;
  if (!req.query.folder)
    return res.status(400).json({ error: "Missing folder parameter" });

  try {
    const decodedFile = decodeURIComponent(file);
    const bucket = storage.bucket(BUCKET_NAME);
    const fileObj = bucket.file(decodedFile);
    const [exists] = await fileObj.exists();

    if (!exists) {
      return res.end("File not found");
    }

    const filename = fileObj.name.split("/").pop() || "file";
    const ext = filename.split(".").pop().toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "wav") contentType = "audio/wav";

    // Send headers first (including CORS) before streaming
    res.writeHead(200, {
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
      res.status(500).json({ error: err.message || "Internal server error" });
    else res.end();
  }
}
