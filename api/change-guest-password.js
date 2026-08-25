import { Storage } from "@google-cloud/storage";
import bcrypt from "bcryptjs";
import { requireAdmin } from "./_auth.js";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
	projectId: key.project_id,
	credentials: key,
});

const CONFIG_BUCKET_NAME = process.env.GCLOUD_CONFIG_BUCKET;
const AUTH_FILE = process.env.GCLOUD_AUTH_FILE;

export default async function handler(req, res) {
	// CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method !== "POST") {
		return res.status(405).send("Method Not Allowed");
	}

	// Verify that the caller is authenticated as an admin
	const user = requireAdmin(req, res);

	if (!user) {
		return;
	}

	const { newPassword } = req.body || {};

	if (!newPassword) {
		return res.status(400).json({
			error: "New password is required",
		});
	}

	if (newPassword.length < 8) {
		return res.status(400).json({
			error: "Password must be at least 8 characters long",
		});
	}

	try {
		const bucket = storage.bucket(CONFIG_BUCKET_NAME);
		const file = bucket.file(AUTH_FILE);

		// Read existing authentication configuration
		const [contents] = await file.download();
		const authData = JSON.parse(contents.toString("utf8"));

		// Hash the new guest password
		const guestPasswordHash = await bcrypt.hash(newPassword, 12);

		// Update only the guest password
		authData.guestPasswordHash = guestPasswordHash;

		// Save updated configuration
		await file.save(JSON.stringify(authData, null, 2), {
			contentType: "application/json",
		});

		return res.status(200).json({
			success: true,
		});
	} catch (err) {
		console.error("Error changing guest password:", err);

		return res.status(500).json({
			error: "Failed to change guest password",
		});
	}
}
