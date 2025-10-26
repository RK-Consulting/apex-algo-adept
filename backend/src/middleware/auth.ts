import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    // Support both custom JWT and Supabase JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    
    if (!jwtSecret && !supabaseJwtSecret) {
      throw new Error('No JWT secret configured');
    }

    let decoded: any;
    let isSupabaseToken = false;

    // Try Supabase JWT first (if secret is available)
    if (supabaseJwtSecret) {
      try {
        decoded = jwt.verify(token, supabaseJwtSecret) as any;
        isSupabaseToken = true;
      } catch (err) {
        // If Supabase verification fails, try custom JWT
        if (jwtSecret) {
          decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
        } else {
          throw err;
        }
      }
    } else if (jwtSecret) {
      decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
    }

    // Extract user info based on token type
    if (isSupabaseToken) {
      // Supabase token structure: { sub: userId, email: userEmail, ... }
      req.user = { 
        id: decoded.sub, 
        email: decoded.email || '' 
      };
    } else {
      // Custom token structure: { userId: string, email: string }
      req.user = { 
        id: decoded.userId, 
        email: decoded.email 
      };
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
