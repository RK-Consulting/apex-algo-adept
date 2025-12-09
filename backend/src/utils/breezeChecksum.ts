cat > src/utils/breezeChecksum.ts << 'EOF'
import crypto from 'crypto';

export function calculateChecksum(
  timestamp: string,
  payload: object,
  secretKey: string
): string {
  const compactPayload = JSON.stringify(payload).replace(/\s+/g, '');
  const checksumInput = timestamp + compactPayload + secretKey;
  return crypto.createHash('sha256').update(checksumInput).digest('hex');
}

export function getTimestamp(): string {
  return new Date().toISOString().split('.')[0] + '.000Z';
}
EOF
