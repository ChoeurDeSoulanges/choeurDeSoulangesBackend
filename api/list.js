import { Storage } from "@google-cloud/storage";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
  projectId: key.project_id,
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

  try {
    const [files] = await storage
      .bucket(BUCKET_NAME)
      .getFiles({ autoPaginate: false });

    const tree = {};

    files.forEach((file) => {
      // Split path by "/" and remove trailing slashes
      const parts = file.name.split("/").map((p) => p.replace(/\/$/, ""));
      let current = tree;

      parts.forEach((part, idx) => {
        if (!part) return; // skip empty parts

        if (idx === parts.length - 1) {
          // last part: file
          current[part] = null;
        } else {
          // folder
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });

    res.status(200).json(tree);
  } catch (err) {
    console.error("Error listing files:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
}
