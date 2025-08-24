import { Storage } from "@google-cloud/storage";

const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEYFILE,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  // CORS headers
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

    // Generate a signed URL valid for 10 minutes
    const [url] = await fileObj.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 10,
    });

    res.status(200).json({ url });
  } catch (err) {
    console.error("Error generating signed URL:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
