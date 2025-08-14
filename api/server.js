import express from "express";
import path from "path";
import fs from "fs";
import archiver from "archiver";

const app = express();
const PORT = process.env.PORT || 3000;

// Base folder where your files are stored
const BASE_FOLDER = path.join(__dirname, "public"); // adjust as needed

// Serve individual files
app.get("/files/*", (req, res) => {
  const filePath = path.join(BASE_FOLDER, req.params[0]);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.sendFile(filePath);
});

// Zip a folder and return it
app.get("/zip", (req, res) => {
  const folder = req.query.folder; // <-- removed TypeScript 'as string'
  if (!folder) return res.status(400).send("Missing folder parameter");

  const folderPath = path.join(BASE_FOLDER, folder);

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return res.status(404).send("Folder not found");
  }

  const zipName = `${path.basename(folderPath)}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error(err);
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
