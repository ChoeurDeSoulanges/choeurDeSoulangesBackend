import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
	console.error("JWT_SECRET environment variable is not configured");
}

/**
 * Extract the session token from the request cookie.
 */
function getSessionToken(req) {
	const cookies = req.headers.cookie;

	if (!cookies) {
		return null;
	}

	const sessionCookie = cookies
		.split(";")
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith("session="));

	if (!sessionCookie) {
		return null;
	}

	return decodeURIComponent(sessionCookie.substring("session=".length));
}

/**
 * Verify that the request has a valid authenticated session.
 *
 * Returns the authenticated user, or sends a 401 response and returns null.
 */
export function requireAuth(req, res) {
	if (!JWT_SECRET) {
		res.status(500).json({
			error: "Authentication is not configured",
		});
		return null;
	}

	const token = getSessionToken(req);

	if (!token) {
		res.status(401).json({
			error: "Authentication required",
		});
		return null;
	}

	try {
		const user = jwt.verify(token, JWT_SECRET);

		return user;
	} catch (error) {
		console.error("Invalid session token:", error);

		res.status(401).json({
			error: "Invalid or expired session",
		});

		return null;
	}
}

/**
 * Verify that the request has a valid admin session.
 *
 * Returns the authenticated admin, or sends an appropriate response
 * and returns null.
 */
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
