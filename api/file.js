// api/file.js
import path from "path";
import fs from "fs";

export default function handler(req, res) {
  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file");

  const filePath = path.join(process.cwd(), "data", file);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(filePath)}"`
  );
  res.sendFile(filePath); // if using Express in local dev
}
