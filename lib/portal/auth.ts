import { scrypt, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPin(pin: string, storedHash?: string): Promise<boolean> {
  const stored = storedHash || process.env.SLOTWISE_PIN_HASH;
  if (!stored) return false;

  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedKey = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
    if (hashBuffer.length !== derivedKey.length) return false;
    return timingSafeEqual(hashBuffer, derivedKey);
  } catch {
    return false;
  }
}

// AES-256-GCM encryption for storing university passwords securely
function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET || 'lms-default-encryption-secret-key-32b';
  // Generate deterministic 32-byte key from SESSION_SECRET
  const hash = Buffer.alloc(32);
  const source = Buffer.from(secret, 'utf-8');
  source.copy(hash, 0, 0, Math.min(source.length, 32));
  return hash;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !dataHex) return null;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (err) {
    console.error('[Auth] Failed to decrypt secret:', err);
    return null;
  }
}
