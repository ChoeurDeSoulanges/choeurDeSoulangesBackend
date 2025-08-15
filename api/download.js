import fs from "fs";
import path from "path";
import archiver from "archiver";

const BASE_FOLDER = path.join(process.cwd(), "data");

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const { file, folder } = req.query;

  try {
    if (folder) {
      const folderPath = path.join(BASE_FOLDER, folder);
      if (
        !fs.existsSync(folderPath) ||
        !fs.statSync(folderPath).isDirectory()
      ) {
        return res.status(404).send("Folder not found");
      }

      const zipName = `${path.basename(folderPath)}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) res.status(500).send({ error: err.message });
      });

      archive.pipe(res);
      archive.directory(folderPath, false);
      archive.finalize();
    } else if (file) {
      const filePath = path.join(BASE_FOLDER, decodeURIComponent(file));
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return res.status(404).send("File not found");
      }

      // Important: set headers before streaming
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${path.basename(filePath)}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");

      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        console.error("File stream error:", err);
        if (!res.headersSent) res.status(500).end();
      });

      stream.pipe(res);
    } else {
      return res.status(400).send("Missing file or folder parameter");
    }
  } catch (err) {
    console.error("Download handler error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
