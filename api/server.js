import express from "express";
import cors from "cors";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Cloud Storage client
const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GCLOUD_BUCKET;
const bucket = storage.bucket(bucketName);

// Admin upload endpoint
// Expects JSON body: { folder: "semester1/projectA", filename: "file.mp3", fileContent: "<base64>" }
app.post("/upload", async (req, res) => {
  try {
    const { folder, filename, fileContent } = req.body;
    if (!folder || !filename || !fileContent)
      return res.status(400).json({ error: "Missing parameters" });

    const file = bucket.file(`${folder}/${filename}`);
    const buffer = Buffer.from(fileContent, "base64");

    await file.save(buffer, { resumable: false });
    res.json({ message: "File uploaded successfully" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Generate signed URL for downloading a file
app.get("/download", async (req, res) => {
  try {
    const { folder, filename } = req.query;
    if (!folder || !filename)
      return res.status(400).json({ error: "Missing parameters" });

    const file = bucket.file(`${folder}/${filename}`);
    const exists = await file.exists();
    if (!exists[0]) return res.status(404).json({ error: "File not found" });

    // Signed URL valid for 1 hour
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    res.json({ url });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Failed to generate download URL" });
  }
});

// List files in a folder
app.get("/list", async (req, res) => {
  try {
    const { folder } = req.query;
    if (!folder)
      return res.status(400).json({ error: "Missing folder parameter" });

    const [files] = await bucket.getFiles({ prefix: folder });
    const fileList = files.map((f) => ({
      name: path.basename(f.name),
      path: f.name,
    }));

    res.json(fileList);
  } catch (err) {
    console.error("List error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
