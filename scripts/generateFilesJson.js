// scripts/generateFilesJson.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, "../data");
const jsonFile = path.join(publicDir, "files.json");

function scanFolder(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let structure = {};

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      structure[entry.name] = scanFolder(fullPath); // recurse
    } else {
      structure[entry.name] = null; // file
    }
  }

  return structure;
}

const folderStructure = scanFolder(publicDir);
fs.writeFileSync(jsonFile, JSON.stringify(folderStructure, null, 2));
console.log(`Updated ${jsonFile} with folder structure.`);
