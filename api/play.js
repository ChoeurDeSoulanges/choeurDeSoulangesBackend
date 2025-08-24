import { Storage } from "@google-cloud/storage";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
  projectId: key.project_id, // extracted from the JSON
  credentials: key,
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
    const fileObj = bucket.file(file);
    const [exists] = await fileObj.exists();
    if (!exists) return res.status(404).send("File not found");

    // Generate a signed URL valid for 1 hour
    const [url] = await fileObj.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    res.status(200).json({ url });
  } catch (err) {
    console.error("Audio play error:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
}
