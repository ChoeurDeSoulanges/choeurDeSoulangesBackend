import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";

import cors from "cors";

app.use(
  cors({
    origin: "*", // allow all origins; or specify your frontend URL for security
  })
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
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

app.get("/download", cors(corsOptions), async (req, res) => {
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
      console.error(err);
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
  } else if (file) {
    const filePath = path.join(BASE_FOLDER, file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return res.status(404).send("File not found");
    }
    res.download(filePath, path.basename(file), (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).send("Error downloading file");
      }
    });
  } else {
    res.status(400).send("Missing file or folder parameter");
  }
});

// Audio streaming endpoint
app.get("/audio", cors(corsOptions), (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file parameter");

  const decodedFile = decodeURIComponent(file.toString());
  const filePath = path.join(BASE_FOLDER, decodedFile);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send("File not found");
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "audio/mpeg", // change if needed
    });

    fileStream.pipe(res);
    fileStream.on("error", (err) => {
      console.error("Stream error:", err);
      res.end();
    });
  } else {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": "audio/mpeg",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Serve the JSON folder structure
app.get("/api/list", (req, res) => {
  const data = readFilesJson();
  if (!data) {
    return res.status(500).json({ error: "Failed to load files.json" });
  }
  // Ensure CORS headers are sent if needed
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(data);
  res.json(data);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
