import { Storage } from "@google-cloud/storage";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

const BUCKET_NAME = process.env.GCLOUD_DATA_BUCKET;
const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const form = formidable({ multiples: true, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    // folder normalization
    const folderRaw = Array.isArray(fields.folder)
      ? fields.folder[0]
      : fields.folder;
    const folder = folderRaw
      ? String(folderRaw).replace(/\/$/, "").normalize("NFC")
      : null;
    if (!folder) return res.status(400).json({ error: "Missing folder field" });

    // Collect all files from any key
    const allFiles = [];
    for (const key of Object.keys(files || {})) {
      const f = files[key];
      if (Array.isArray(f)) allFiles.push(...f);
      else if (f) allFiles.push(f);
    }

    // Only keep files with a valid filepath
    const validFiles = allFiles.filter((f) => f && f.filepath);

    if (!validFiles.length) {
      return res
        .status(400)
        .json({ error: "No valid file provided or wrong field name" });
    }

    const bucket = storage.bucket(BUCKET_NAME);

    try {
      await Promise.all(
        validFiles.map((file) => {
          const destination = `${folder}/${file.originalFilename}`;
          return bucket.upload(file.filepath, {
            destination,
            resumable: false,
            metadata: {
              contentType: file.mimetype || "application/octet-stream",
            },
          });
        })
      );

      return res.status(200).json({
        message: "Folder uploaded successfully",
        folder,
        files: validFiles.map((f) => f.originalFilename),
      });
    } catch (uploadErr) {
      console.error("Upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload files" });
    }
  });
}
