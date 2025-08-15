// api/files.js
import path from "path";
import fs from "fs";

export default function handler(req, res) {
  try {
    const jsonPath = path.join(process.cwd(), "data", "files.json");
    const content = fs.readFileSync(jsonPath, "utf-8");
    res.status(200).json(JSON.parse(content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load files.json" });
  }
}
