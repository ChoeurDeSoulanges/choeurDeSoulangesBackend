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
  if (!file && !folder)
    return res.status(400).send("Missing file or folder parameter");

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    if (folder) {
      // List all files with this folder prefix
      const [files] = await bucket.getFiles({ prefix: folder + "/" });
      if (!files || files.length === 0)
        return res.status(404).send("Folder not found or empty");

      const zipName = `${folder.split("/").pop() || "folder"}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      archive.pipe(res);

      files.forEach((f) => {
        // Remove the folder prefix from the filename inside the zip
        const nameInZip = f.name.replace(folder + "/", "");
        archive.append(f.createReadStream(), { name: nameInZip });
      });

      archive.finalize();
    } else if (file) {
      const fileObj = bucket.file(file);
      const [exists] = await fileObj.exists();
      if (!exists) return res.status(404).send("File not found");

      const [metadata] = await fileObj.getMetadata();
      const fileSize = parseInt(metadata.size, 10);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.split("/").pop()}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", fileSize);

      fileObj.createReadStream().pipe(res);
    }
  } catch (err) {
    console.error("Download handler error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
