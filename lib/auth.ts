import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'skolla-kerjasama-secret-key-32-chars-min!!';
const KUNCI_RAHASIA = new TextEncoder().encode(JWT_SECRET);

export const COOKIE_SESI = 'skolla_sesi';

export type SesiPengguna = {
  id: string;
  email: string;
  peran: string[];
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifikasiPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export async function buatSesiToken(payload: SesiPengguna): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(KUNCI_RAHASIA);
}

export async function bacaSesiToken(token: string): Promise<SesiPengguna | null> {
  try {
    const { payload } = await jwtVerify(token, KUNCI_RAHASIA);
    return {
      id: payload.id as string,
      email: payload.email as string,
      peran: (payload.peran as string[]) || [],
    };
  } catch {
    return null;
  }
}
