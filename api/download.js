import { Storage } from "@google-cloud/storage";

// Initialize Google Cloud client
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_KEYFILE,
});

const BUCKET_NAME = process.env.GCLOUD_BUCKET;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  const { file } = req.query;
  if (!file) return res.status(400).send("Missing file parameter");

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const remoteFile = bucket.file(file);

    // Check if file exists
    const [exists] = await remoteFile.exists();
    if (!exists) return res.status(404).send("File not found");

    // Stream the file to the response
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.split("/").pop()}"`
    );

    remoteFile
      .createReadStream()
      .pipe(res)
      .on("error", (err) => {
        console.error("Download error:", err);
        if (!res.headersSent) res.status(500).end();
      });
  } catch (err) {
    console.error("Download handler error:", err);
    if (!res.headersSent) res.status(500).end();
  }
}
