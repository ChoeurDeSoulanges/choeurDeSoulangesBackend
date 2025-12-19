import { Storage } from "@google-cloud/storage";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

const BUCKET_NAME = process.env.GCLOUD_CONFIG_BUCKET;
const FILE_NAME = "selectedKeys.json";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(FILE_NAME);

  try {
    if (req.method === "GET") {
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ error: "File not found" });

      const [contents] = await file.download();
      const json = JSON.parse(contents.toString());
      return res.status(200).json(json);
    }

    if (req.method === "PUT") {
      const body = req.body;

      if (!body || !Array.isArray(body.selectedKeys)) {
        return res.status(400).json({ error: "selectedKeys must be an array" });
      }

      await file.save(JSON.stringify(body, null, 2), {
        contentType: "application/json",
      });

      return res.sendStatus(204);
    }

    // Method not allowed
    res.status(405).end();
  } catch (err) {
    console.error("Error accessing file:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
