import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Apply middleware
app.use(cors()); // global CORS
app.use(express.json());

const BASE_FOLDER = path.join(__dirname, "..", "data");
const JSON_FILE_PATH = path.join(BASE_FOLDER, "files.json");

// Utility function to read files.json
function readFilesJson() {
  try {
    const content = fs.readFileSync(JSON_FILE_PATH, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading files.json:", err);
    return null;
  }
}

// Download endpoint (file or folder)
app.get("/download", async (req, res) => {
  const { file, folder } = req.query;

  if (folder) {
    const folderPath = path.join(BASE_FOLDER, folder);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
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

    res.download(filePath, path.basename(filePath), (err) => {
      if (err && !res.headersSent) {
        console.error("Download error:", err);
        res.status(500).send("Error downloading file");
      }
    });
  } else {
    res.status(400).send("Missing file or folder parameter");
  }
});

// Audio streaming endpoint
app.get("/audio", (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file parameter");

  const filePath = path.join(BASE_FOLDER, decodeURIComponent(file));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send("File not found");
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  const handleStreamError = (err) => {
    console.error("Stream error:", err);
    if (!res.headersSent) res.status(500).end();
  };

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on("error", handleStreamError);

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "audio/mpeg",
    });

    stream.pipe(res);

    req.on("close", () => stream.destroy());
  } else {
    const stream = fs.createReadStream(filePath);
    stream.on("error", handleStreamError);

    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": "audio/mpeg",
    });

    stream.pipe(res);

    req.on("close", () => stream.destroy());
  }
});

// Serve the JSON folder structure
app.get("/api/list", (req, res) => {
  const data = readFilesJson();
  if (!data)
    return res.status(500).json({ error: "Failed to load files.json" });
  res.json(data); // send JSON once
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
