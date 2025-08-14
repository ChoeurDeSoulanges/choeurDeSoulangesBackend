import path from "path";
import fs from "fs";
import archiver from "archiver";

export default async function handler(req, res) {
  try {
    const { folder } = req.query;
    if (!folder) return res.status(400).send("Missing folder parameter");

    // Path to folder in backendData
    const folderPath = path.join(process.cwd(), "backendData", folder);

    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return res.status(404).send("Folder not found");
    }

    // Set response headers to download as zip
    const zipName = `${path.basename(folderPath)}.zip`;
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    res.setHeader("Content-Type", "application/zip");

    // Create a zip stream
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    // Append all files recursively
    archive.directory(folderPath, false);

    await archive.finalize();
  } catch (err) {
    console.error("Zip failed:", err);
    res.status(500).send("Failed to zip folder");
  }
}
