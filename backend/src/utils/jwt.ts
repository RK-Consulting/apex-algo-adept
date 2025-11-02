import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme_please";
const JWT_EXPIRES_IN = "12h";

export const generateToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET);
};
