import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = process.env.SLOTWISE_PIN_HASH;
  if (!stored) throw new Error('SLOTWISE_PIN_HASH is not configured');

  const [salt, hash] = stored.split(':');
  if (!salt || !hash) throw new Error('SLOTWISE_PIN_HASH format is invalid');

  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedKey = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(hashBuffer, derivedKey);
}
