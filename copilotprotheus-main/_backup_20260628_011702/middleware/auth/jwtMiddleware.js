// middleware/auth/jwtMiddleware.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "copilot_protheus_secret_CHANGE_IN_PROD";

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

function verifyToken(req, res, next) {
  const h = req.headers["authorization"];
  if (!h || !h.startsWith("Bearer "))
    return res.status(401).json({ error: "Token JWT ausente ou invalido." });
  try {
    req.jwtPayload = jwt.verify(h.split(" ")[1], JWT_SECRET);
    next();
  } catch (e) {
    return res.status(403).json({ error: "Token expirado ou invalido." });
  }
}

module.exports = { generateToken, verifyToken };
