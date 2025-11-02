import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/database.js";
import { generateToken } from "../utils/jwt.js";

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT token.
 */
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // 1️⃣ Find user by email
    const result = await query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // 2️⃣ Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // 3️⃣ Generate JWT
    const token = generateToken(user.id, user.email);

    // 4️⃣ Return success
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/auth/register
 * Registers a new user.
 */
export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Check if email already exists
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await query(
      "INSERT INTO users (email, password_hash, created_at) VALUES ($1, $2, NOW()) RETURNING id, email",
      [email, passwordHash]
    );

    const newUser = result.rows[0];

    // Generate JWT
    const token = generateToken(newUser.id, newUser.email);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
