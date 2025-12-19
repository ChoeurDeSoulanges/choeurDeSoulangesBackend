import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCLOUD_DATA_BUCKET;
const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  const { file } = req.query;
  if (!file) return res.status(400).json({ error: "Missing file parameter" });

  try {
    const decodedFile = decodeURIComponent(file).normalize("NFC");
    const bucket = storage.bucket(BUCKET_NAME);
    const fileObj = bucket.file(decodedFile);
    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).json({ error: "File not found" });

    const filename = fileObj.name.split("/").pop() || "file";
    const ext = filename.split(".").pop().toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "wav") contentType = "audio/wav";

    // Set headers for download with safe encoding for special characters
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    // Pipe file stream directly to the response
    const stream = fileObj.createReadStream();
    stream.on("error", (err) => {
      console.error("File stream error:", err);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error("File download error:", err);
    if (!res.headersSent)
      res.status(500).json({ error: err.message || "Internal server error" });
  }
}
