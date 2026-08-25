import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

function getToken(req) {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return null;
	}

	if (!authHeader.startsWith("Bearer ")) {
		return null;
	}

	return authHeader.substring(7);
}

export function requireAuth(req, res) {
	if (!JWT_SECRET) {
		console.error("JWT_SECRET is not configured");

		res.status(500).json({
			error: "Authentication is not configured",
		});

		return null;
	}

	const token = getToken(req);

	if (!token) {
		res.status(401).json({
			error: "Authentication required",
		});

		return null;
	}

	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (err) {
		console.error("Invalid token:", err);

		res.status(401).json({
			error: "Invalid or expired token",
		});

		return null;
	}
}

export function requireAdmin(req, res) {
	const user = requireAuth(req, res);

	if (!user) {
		return null;
	}

	if (user.role !== "admin") {
		res.status(403).json({
			error: "Administrator access required",
		});

		return null;
	}

	return user;
}
