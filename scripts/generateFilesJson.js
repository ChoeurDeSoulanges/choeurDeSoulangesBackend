// scripts/generateFilesJson.js
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../public");
const jsonFile = path.join(publicDir, "files.json");

function scanFolder(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let structure = {};

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      structure[entry.name] = scanFolder(fullPath); // recurse into subfolder
    } else {
      structure[entry.name] = null; // file: no children
    }
  });

  return structure;
}

const folderStructure = scanFolder(publicDir);
fs.writeFileSync(jsonFile, JSON.stringify(folderStructure, null, 2));
console.log(`Updated ${jsonFile} with folder structure.`);
