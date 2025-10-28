// backend/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Ensure secrets exist
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT secret missing. Set SUPABASE_JWT_SECRET or JWT_SECRET in your .env file.');
  process.exit(1);
}

// helper to create token - cast options to avoid TS typing issues
const createToken = (payload: object, expiresIn: string = '7d'): string => {
  const options = { expiresIn } as unknown;
  return jwt.sign(payload, JWT_SECRET as string, options as jwt.SignOptions);
};

// ----------------------
// REGISTER
// ----------------------
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists in auth.users table
    const existing = await query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password and insert user (DB generates UUID)
    const hashed = await bcrypt.hash(password, 10);
    const insert = await query(
      `INSERT INTO auth.users (email, encrypted_password, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, email`,
      [email, hashed]
    );

    const newUser = insert.rows[0];
    const token = createToken({ userId: newUser.id, email: newUser.email }, process.env.JWT_EXPIRES_IN || '7d');

    res.status(201).json({
      user: { id: newUser.id, email: newUser.email },
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------
// LOGIN
// ----------------------
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Fetch user - note column name encrypted_password as per init.sql
    const result = await query(
      'SELECT id, email, encrypted_password FROM auth.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.encrypted_password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ userId: user.id, email: user.email }, process.env.JWT_EXPIRES_IN || '7d');
    res.json({
      user: { id: user.id, email: user.email },
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------
// VERIFY
// ----------------------
router.get('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET as string);
    res.json({ valid: true, decoded });
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
