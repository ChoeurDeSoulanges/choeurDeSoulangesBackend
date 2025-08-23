import { Storage } from "@google-cloud/storage";

// Initialize Google Cloud client using env variables
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEYFILE,
});

// Name of your bucket
const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const [files] = await storage.bucket(BUCKET_NAME).getFiles({
      autoPaginate: false,
    });

    // Build a simple JSON structure of files/folders
    const data = files.map((file) => ({
      name: file.name,
      path: file.name,
      size: file.metadata.size,
    }));

    res.status(200).json(data);
  } catch (err) {
    console.error("Error listing files:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
}
