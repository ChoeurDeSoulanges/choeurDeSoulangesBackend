import { Storage } from "@google-cloud/storage";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for formidable
  },
};

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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const form = formidable({
    multiples: true,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    const folder = fields.folder
      ? String(fields.folder).replace(/\/$/, "").normalize("NFC")
      : null;

    if (!folder) {
      return res.status(400).json({ error: "Missing folder field" });
    }

    const bucket = storage.bucket(BUCKET_NAME);

    const uploadedFiles = Array.isArray(files.files)
      ? files.files
      : files.files
      ? [files.files]
      : [];

    if (!uploadedFiles.length) {
      return res.status(400).json({ error: "No files provided" });
    }

    try {
      const uploadPromises = uploadedFiles.map((file) => {
        const destination = `${folder}/${file.originalFilename}`;

        return bucket.upload(file.filepath, {
          destination,
          resumable: false,
          metadata: {
            contentType: file.mimetype,
          },
        });
      });

      await Promise.all(uploadPromises);

      return res.status(200).json({
        message: "Folder uploaded successfully",
        files: uploadedFiles.map((f) => f.originalFilename),
      });
    } catch (uploadErr) {
      console.error("Upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload files" });
    }
  });
}
