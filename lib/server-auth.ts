import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import firebaseConfig from '../firebase-applet-config.json';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const PROJECT_ID = firebaseConfig.projectId;

// Deterministic fallback across serverless/edge isolates if EXAM_SEAL_SECRET is not configured in env
function getSealKey(): Buffer {
  const envSecret = process.env.EXAM_SEAL_SECRET;
  if (envSecret && envSecret.trim().length > 0) {
    return crypto.createHash('sha256').update(envSecret.trim()).digest();
  }
  return crypto
    .createHash('sha256')
    .update(`ujianku-seal:${firebaseConfig.projectId}:${firebaseConfig.appId}`)
    .digest();
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export async function verifyFirebaseBearerToken(
  authHeader: string | null
): Promise<VerifiedFirebaseToken> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token autentikasi tidak ditemukan.');
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Error('Token kosong.');
  }

  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });

  if (!payload.sub) {
    throw new Error('Token tidak memiliki UID.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: payload.email_verified === true,
  };
}

export interface SealedKeyPayload {
  examId: string;
  teacherUid: string;
  keys: Record<string, { correctOptionId: string; points: number; voided?: 'none' | 'all_correct' | 'excluded'; explanation?: string }>;
  sealedAt: number;
}

export function sealAnswerKeys(payload: SealedKeyPayload): string {
  const key = getSealKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealAnswerKeys(token: string): SealedKeyPayload {
  const key = getSealKey();
  const raw = Buffer.from(token, 'base64url');
  if (raw.length < 28) {
    throw new Error('Token segel tidak valid.');
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as SealedKeyPayload;
}
