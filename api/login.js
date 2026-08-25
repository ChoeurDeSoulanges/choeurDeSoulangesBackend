import { Storage } from "@google-cloud/storage";
import bcrypt from "bcryptjs";

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
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method !== "POST") {
		return res.status(405).send("Method Not Allowed");
	}

	const { username, password } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({
			error: "Username and password are required",
		});
	}

	try {
		// Load authentication configuration from Google Cloud Storage
		const bucket = storage.bucket(CONFIG_BUCKET_NAME);
		const file = bucket.file(AUTH_FILE);

		const [contents] = await file.download();
		const authData = JSON.parse(contents.toString("utf8"));

		// Check admin credentials
		if (username === authData.adminUsername) {
			const passwordMatches = await bcrypt.compare(password, authData.adminPasswordHash);

			if (passwordMatches) {
				return res.status(200).json({
					authenticated: true,
					role: "admin",
				});
			}
		}

		// Check guest credentials
		if (username === authData.guestUsername) {
			const passwordMatches = await bcrypt.compare(password, authData.guestPasswordHash);

			if (passwordMatches) {
				return res.status(200).json({
					authenticated: true,
					role: "guest",
				});
			}
		}

		// Invalid credentials
		return res.status(401).json({
			error: "Invalid username or password",
		});
	} catch (err) {
		console.error("Login error:", err);

		return res.status(500).json({
			error: "Authentication failed",
		});
	}
}
