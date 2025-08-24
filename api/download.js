import { Storage } from "@google-cloud/storage";
import archiver from "archiver";

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

  const { file, folder } = req.query;

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    if (folder) {
      // Zip a folder
      const archive = archiver("zip", { zlib: { level: 9 } });
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folder}.zip"`
      );
      res.setHeader("Content-Type", "application/zip");

      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      archive.pipe(res);

      // List files in folder and append to archive
      const [files] = await bucket.getFiles({ prefix: folder + "/" });
      files.forEach((f) =>
        archive.append(f.createReadStream(), {
          name: f.name.replace(folder + "/", ""),
        })
      );

      archive.finalize();
    } else if (file) {
      // Single file download
      const fileObj = bucket.file(file);
      const [exists] = await fileObj.exists();
      if (!exists) return res.status(404).send("File not found");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.split("/").pop()}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");

      fileObj.createReadStream().pipe(res);
    } else {
      return res.status(400).send("Missing file or folder parameter");
    }
  } catch (err) {
    console.error("Download handler error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
