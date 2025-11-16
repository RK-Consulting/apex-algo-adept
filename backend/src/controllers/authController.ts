// backend/src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/database.js";
import { generateToken } from "../utils/jwt.js";
import debug from "debug";

const log = debug("apex:auth");

/* ------------------------------------------------------------------
   POST /api/auth/login
------------------------------------------------------------------- */
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Retrieve user
    const result = await query(
      `SELECT id, email, password_hash 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) {
      // Prevent user enumeration
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Create JWT token
    const token = generateToken(user.id, user.email);

    log(`User logged in: ${user.email}`);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err: any) {
    log("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/* ------------------------------------------------------------------
   POST /api/auth/register
------------------------------------------------------------------- */
export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Prevent duplicate accounts
    const existing = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Password hashing (improved rounds for production security)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user
    const result = await query(
      `INSERT INTO users (email, password_hash, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, email`,
      [email.toLowerCase(), passwordHash]
    );

    const newUser = result.rows[0];

    // Create JWT
    const token = generateToken(newUser.id, newUser.email);

    log(`New user registered: ${newUser.email}`);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (err: any) {
    log("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
