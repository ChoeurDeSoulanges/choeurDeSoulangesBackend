import { Storage } from "@google-cloud/storage";
import formidable from "formidable";
import { requireAdmin } from "./_auth.js";

export const config = { api: { bodyParser: false } };

const BUCKET_NAME = process.env.GCLOUD_DATA_BUCKET;
const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
	projectId: key.project_id,
	credentials: key,
});

export default async function handler(req, res) {
	// ---- CORS headers ----
	const allowedOrigin = req.headers.origin || "*";
	res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
	res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
	res.setHeader("Access-Control-Allow-Credentials", "true");

	// ---- Preflight request ----
	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	const user = requireAdmin(req, res);
	if (!user) return;

	const form = formidable({ multiples: true, keepExtensions: true });

	form.parse(req, async (err, fields, files) => {
		if (err) {
			console.error("Form parse error:", err);
			return res.status(500).json({ error: "Failed to parse form data" });
		}

		// ---- Normalize folder ----
		const folderRaw = Array.isArray(fields.folder) ? fields.folder[0] : fields.folder;
		const folder = folderRaw ? String(folderRaw).replace(/\/$/, "").normalize("NFC") : null;
		if (!folder) return res.status(400).json({ error: "Missing folder field" });

		// ---- Normalize files ----
		let uploadedFiles = [];
		for (const keyName in files) {
			const f = files[keyName];
			if (Array.isArray(f)) uploadedFiles.push(...f);
			else if (f) uploadedFiles.push(f);
		}
		uploadedFiles = uploadedFiles.filter((f) => f && f.filepath);

		if (!uploadedFiles.length) {
			return res.status(400).json({ error: "No valid file provided or wrong field name" });
		}

		const bucket = storage.bucket(BUCKET_NAME);

		try {
			await Promise.all(
				uploadedFiles.map((file) => {
					const destination = `${folder}/${file.originalFilename}`;
					console.log("Uploading file:", file.originalFilename, "to", destination);
					return bucket.upload(file.filepath, {
						destination,
						resumable: false,
						metadata: {
							contentType: file.mimetype || "application/octet-stream",
						},
					});
				}),
			);

			return res.status(200).json({
				message: "Files uploaded successfully",
				folder,
				files: uploadedFiles.map((f) => f.originalFilename),
			});
		} catch (uploadErr) {
			console.error("Upload error:", uploadErr);
			return res.status(500).json({ error: "Failed to upload files" });
		}
	});
}
