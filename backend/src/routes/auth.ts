import { Router, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../prismaClient"; // adjust path if different
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// Ensure secrets exist
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ JWT secret missing. Set SUPABASE_JWT_SECRET or JWT_SECRET in your .env file.");
  process.exit(1);
}

// Helper: Create a token
const createToken = (payload: object, expiresIn: string = "1h"): string => {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET as string, options);
};

// ----------------------
// USER LOGIN
// ----------------------
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = createToken({ userId: user.id, email: user.email });
    res.json({ token });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------------
// VERIFY TOKEN (Middleware Example)
// ----------------------
router.get("/verify", (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET as string);
    res.json({ valid: true, decoded });
  } catch (error) {
    console.error("❌ Token verification error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

// ----------------------
// SIGN-UP (OPTIONAL)
// ----------------------
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { email, password: hashed },
    });

    const token = createToken({ userId: newUser.id, email: newUser.email });
    res.json({ token });
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
