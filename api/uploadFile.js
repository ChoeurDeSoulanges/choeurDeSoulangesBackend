import { Storage } from "@google-cloud/storage";
import formidable from "formidable";

export const config = {
  api: {
    bodyParser: false, // Required for formidable
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

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  const form = formidable({
    multiples: true, // <-- allow multiple files
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    console.log("Form parse error:", err);
    console.log("Fields received:", fields);
    console.log("Files received:", files);

    if (err) {
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    // ---- Normalize folder field (can be array) ----
    const folderRaw = Array.isArray(fields.folder)
      ? fields.folder[0]
      : fields.folder;
    const folder = folderRaw
      ? String(folderRaw).replace(/\/$/, "").normalize("NFC")
      : null;
    if (!folder) return res.status(400).json({ error: "Missing folder field" });

    // ---- Normalize files into an array ----
    let uploadedFiles = [];
    for (const keyName of Object.keys(files || {})) {
      const f = files[keyName];
      if (Array.isArray(f)) uploadedFiles.push(...f);
      else if (f) uploadedFiles.push(f);
    }

    // ---- Filter valid files ----
    uploadedFiles = uploadedFiles.filter((f) => f && f.filepath);

    if (!uploadedFiles.length) {
      return res
        .status(400)
        .json({ error: "No valid file provided or wrong field name" });
    }

    const bucket = storage.bucket(BUCKET_NAME);

    try {
      // ---- Upload all files ----
      const uploadResults = await Promise.all(
        uploadedFiles.map((file) => {
          const destination = `${folder}/${file.originalFilename}`;
          console.log(
            "Uploading file:",
            file.originalFilename,
            "to",
            destination
          );
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
        message: "Files uploaded successfully",
        folder,
        files: uploadedFiles.map((f) => f.originalFilename),
      });
    } catch (uploadErr) {
      console.error("Upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload files" });
    }
  });
}
