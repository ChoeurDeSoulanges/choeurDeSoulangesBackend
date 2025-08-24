import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEYFILE,
});
const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

    // Download entire file into buffer (works reliably on Vercel)
    const [contents] = await fileObj.download();

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": fileSize,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(contents);
  } catch (err) {
    console.error("Audio play error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
