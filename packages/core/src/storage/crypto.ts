import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey(): Buffer {
  const hexKey = process.env.MASTER_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  return Buffer.from(hexKey, 'hex');
}

export function encryptPayload(data: Record<string, any>): { encryptedPayload: string; iv: string; tag: string } {
  const masterKey = getMasterKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  
  const jsonStr = JSON.stringify(data);
  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encryptedPayload: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

export function decryptPayload(encryptedPayload: string, ivHex: string, tagHex: string): Record<string, any> {
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
