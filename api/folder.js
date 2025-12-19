import { Storage } from "@google-cloud/storage";
import archiver from "archiver";
import formidable from "formidable";

const BUCKET_NAME = process.env.GCLOUD_DATA_BUCKET;
const key = JSON.parse(process.env.GCLOUD_KEYFILE);
const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

export const config = {
  api: {
    bodyParser: false, // important for file uploads
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const bucket = storage.bucket(BUCKET_NAME);

  // -----------------------------
  // GET: download folder (existing code)
  // -----------------------------
  if (req.method === "GET") {
    try {
      if (!req.query.folder)
        return res.status(400).json({ error: "Missing folder parameter" });

      let folder = decodeURIComponent(req.query.folder).normalize("NFC");
      if (!folder.endsWith("/")) folder += "/";

      const [files] = await bucket.getFiles({ prefix: folder });

      if (!files.length)
        return res.status(404).json({ error: "Folder not found or empty" });

      const rawName = folder.split("/").filter(Boolean).pop() || "folder";
      const zipName = encodeURIComponent(rawName) + ".zip";

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${zipName}`
      );

      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      archive.pipe(res);

      for (const fileObj of files) {
        const relativePath = fileObj.name.slice(folder.length);
        if (!relativePath) continue;
        const stream = fileObj.createReadStream();
        archive.append(stream, { name: relativePath });
      }

      await archive.finalize();
    } catch (err) {
      console.error("Folder download error:", err);
      if (!res.headersSent)
        res.status(500).json({ error: err.message || "Internal server error" });
    }
    return;
  }

  // -----------------------------
  // POST: upload folder
  // -----------------------------
  if (req.method === "POST") {
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "Failed to parse files" });
      }

      const folder = fields.folder
        ? String(fields.folder).normalize("NFC")
        : "";
      if (!folder)
        return res.status(400).json({ error: "Missing folder field" });

      const uploadPromises = [];

      const fileArray = Array.isArray(files.files)
        ? files.files
        : [files.files];

      for (const file of fileArray) {
        const gcsPath = `${folder}/${file.originalFilename}`;
        uploadPromises.push(
          bucket.upload(file.filepath, {
            destination: gcsPath,
            resumable: false,
          })
        );
      }

      try {
        await Promise.all(uploadPromises);
        return res
          .status(200)
          .json({ message: "Folder uploaded successfully" });
      } catch (uploadErr) {
        console.error("Folder upload error:", uploadErr);
        return res.status(500).json({ error: "Failed to upload files" });
      }
    });
    return;
  }

  res.status(405).json({ error: "Method Not Allowed" });
}
