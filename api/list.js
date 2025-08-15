import fs from "fs";
import path from "path";

const BASE_FOLDER = path.join(process.cwd(), "data");
const JSON_FILE_PATH = path.join(BASE_FOLDER, "files.json");

export default function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); // or your frontend URL
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const content = fs.readFileSync(JSON_FILE_PATH, "utf8");
    const data = JSON.parse(content);
    res.status(200).json(data);
  } catch (err) {
    console.error("Failed to load files.json:", err);
    res.status(500).json({ error: "Failed to load files.json" });
  }
}
