import { Storage } from "@google-cloud/storage";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://choeur-de-soulanges.vercel.app",
];

// Load Google Cloud key from environment variable
const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
  projectId: key.project_id,
  credentials: key,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  try {
    const [files] = await storage
      .bucket(BUCKET_NAME)
      .getFiles({ autoPaginate: false });

    const fileArray = Array.isArray(files) ? files : [];

    // Build nested tree structure
    const root = {};

    fileArray.forEach((file) => {
      const parts = file.name.split("/").filter(Boolean); // remove empty parts
      let current = root;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        current = current[part] || {};
      });
    });

    // Convert nested object to AntD TreeDataNode[]
    const buildTree = (node, currentPath = "") => {
      return Object.entries(node)
        .filter(([key]) => key) // skip empty keys
        .map(([key, value]) => {
          const path = currentPath ? `${currentPath}/${key}` : key;

          if (value === null) {
            return { title: key, key: path, isLeaf: true };
          } else {
            const children = buildTree(value, path);
            return {
              title: key,
              key: path,
              children: children.length ? children : undefined,
            };
          }
        });
    };

    const treeData = buildTree(root);

    res.status(200).json(treeData);
  } catch (err) {
    console.error("Error listing files:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
}
