// backend/src/routes/iciciBroker.ts
import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { query } from '../config/database.js';
import crypto from 'crypto';

const router = Router();

// Encryption utilities
async function encryptData(data: string, key: Buffer): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString('base64'),
    iv: iv.toString('base64')
  };
}

async function decryptData(encryptedData: string, iv: string, key: Buffer): Promise<string> {
  const ivBuffer = Buffer.from(iv, 'base64');
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');

  const authTag = encryptedBuffer.slice(-16);
  const encrypted = encryptedBuffer.slice(0, -16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY not configured');
  }

  return crypto.pbkdf2Sync(
    masterSecret,
    'alphaforge-credentials-v1',
    100000,
    32,
    'sha256'
  );
}

// ----------------------------------------
// POST /api/credentials/store
// ----------------------------------------
router.post('/store', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;   // ✅ FIXED (was req.user!.id)
    const { broker_name, api_key, api_secret } = req.body;

    if (!broker_name || !api_key) {
      return res.status(400).json({
        error: 'Missing required fields: broker_name and api_key are required'
      });
    }

    const encryptionKey = getEncryptionKey();

    const encryptedApiKey = await encryptData(api_key, encryptionKey);
    const encryptedApiSecret = api_secret
      ? await encryptData(api_secret, encryptionKey)
      : null;

    const existing = await query(
      'SELECT id FROM user_credentials WHERE user_id = $1 AND broker_name = $2',
      [userId, broker_name]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE user_credentials 
         SET api_key = $1, api_secret = $2, updated_at = NOW()
         WHERE user_id = $3 AND broker_name = $4
         RETURNING id`,
        [
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
          userId,
          broker_name
        ]
      );
    } else {
      result = await query(
        `INSERT INTO user_credentials (user_id, broker_name, api_key, api_secret)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          userId,
          broker_name,
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null
        ]
      );
    }

    res.json({
      success: true,
      message: 'Credentials securely stored',
      credential_id: result.rows[0].id
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------
// POST /api/credentials/retrieve
// ----------------------------------------
router.post('/retrieve', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;   // ✅ FIXED
    const { broker_name } = req.body;

    if (!broker_name) {
      return res.status(400).json({ error: 'Missing required field: broker_name' });
    }

    const result = await query(
      'SELECT api_key, api_secret, broker_name FROM user_credentials WHERE user_id = $1 AND broker_name = $2',
      [userId, broker_name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credentials not found' });
    }

    const credentials = result.rows[0];
    const encryptionKey = getEncryptionKey();

    const apiKeyData = JSON.parse(credentials.api_key);
    const decryptedApiKey = await decryptData(apiKeyData.encrypted, apiKeyData.iv, encryptionKey);

    let decryptedApiSecret = null;
    if (credentials.api_secret) {
      const apiSecretData = JSON.parse(credentials.api_secret);
      decryptedApiSecret = await decryptData(apiSecretData.encrypted, apiSecretData.iv, encryptionKey);
    }

    res.json({
      broker_name: credentials.broker_name,
      api_key: decryptedApiKey,
      api_secret: decryptedApiSecret
    });
  } catch (error) {
    next(error);
  }
});

export { router as credentialsRouter };
