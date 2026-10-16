import crypto from 'node:crypto';
import { env } from '../config/env.js';

// ---------------------------------------------------------------- Verhoeff checksum

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits) {
  let c = 0;
  const rev = String(digits).split('').reverse();
  for (let i = 0; i < rev.length; i += 1) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

/** 12 digits, does not start with 0 or 1, valid Verhoeff check digit. */
export const isValidAadhaar = (value) => /^[2-9]\d{11}$/.test(value) && verhoeffValid(value);

export const maskAadhaar = (last4) => (last4 ? `XXXX XXXX ${last4}` : '');

// ---------------------------------------------------------------- AES-256-GCM

/** "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function encryptAadhaar(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', env.aadhaarEncKey, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptAadhaar(stored) {
  const [version, iv, tag, data] = String(stored || '').split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unknown Aadhaar format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', env.aadhaarEncKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
