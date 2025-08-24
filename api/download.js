import { Storage } from "@google-cloud/storage";
import archiver from "archiver";

// Parse JSON credentials from env
const key = JSON.parse(process.env.GCLOUD_KEYFILE_JSON || "{}");
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

  const { file, folder } = req.query;

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    if (file) {
      // Single file download
      const fileObj = bucket.file(file);
      const [exists] = await fileObj.exists();
      if (!exists) return res.status(404).send("File not found");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileObj.name.split("/").pop()}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");

      fileObj.createReadStream().pipe(res);
    } else if (folder) {
      // Zip folder contents
      const [files] = await bucket.getFiles({ prefix: folder });
      if (files.length === 0) return res.status(404).send("Folder not found");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folder}.zip"`
      );
      res.setHeader("Content-Type", "application/zip");

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      archive.pipe(res);

      for (const f of files) {
        const remoteStream = f.createReadStream();
        archive.append(remoteStream, {
          name: f.name.replace(`${folder}/`, ""),
        });
      }

      archive.finalize();
    } else {
      res.status(400).send("Missing file or folder parameter");
    }
  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
