import { Storage } from "@google-cloud/storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const key = JSON.parse(process.env.GCLOUD_KEYFILE);

const storage = new Storage({
	projectId: key.project_id,
	credentials: key,
});

const CONFIG_BUCKET_NAME = process.env.GCLOUD_CONFIG_BUCKET;
const AUTH_FILE = process.env.GCLOUD_AUTH_FILE;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

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

	if (!JWT_SECRET) {
		console.error("JWT_SECRET is not configured");
		return res.status(500).json({
			error: "Authentication is not configured",
		});
	}

	try {
		const { username, password } = req.body || {};

		if (!username || !password) {
			return res.status(400).json({
				error: "Username and password are required",
			});
		}

		// Read authentication configuration from Google Cloud
		const bucket = storage.bucket(CONFIG_BUCKET_NAME);
		const file = bucket.file(AUTH_FILE);

		const [contents] = await file.download();

		const authData = JSON.parse(contents.toString("utf8"));

		let role = null;
		let passwordHash = null;

		// Determine which account is being used
		if (username === authData.adminUsername) {
			role = "admin";
			passwordHash = authData.adminPasswordHash;
		} else if (username === authData.guestUsername) {
			role = "guest";
			passwordHash = authData.guestPasswordHash;
		}

		// Don't reveal whether the username exists
		if (!role || !passwordHash) {
			return res.status(401).json({
				error: "Invalid username or password",
			});
		}

		// Verify password against bcrypt hash
		const passwordValid = await bcrypt.compare(password, passwordHash);

		if (!passwordValid) {
			return res.status(401).json({
				error: "Invalid username or password",
			});
		}

		// Create authentication token
		const token = jwt.sign(
			{
				username,
				role,
			},
			JWT_SECRET,
			{
				expiresIn: "8h",
			},
		);

		return res.status(200).json({
			authenticated: true,
			role,
			token,
		});
	} catch (err) {
		console.error("Login error:", err);

		return res.status(500).json({
			error: "Login failed",
		});
	}
}
