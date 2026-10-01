'use server';

import { cookies } from 'next/headers';
import prisma from './prisma';
import { verifikasiPassword, buatSesiToken, COOKIE_SESI } from './auth';

type HasilMasuk = {
  sukses: boolean;
  galat?: string;
};

export async function masukAksi(email: string, sandi: string): Promise<HasilMasuk> {
  try {
    if (!email || !sandi) {
      return { sukses: false, galat: 'Surel dan kata sandi wajib diisi.' };
    }

    const surelBersih = email.trim().toLowerCase();
    const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';

    if (surelBersih.split('@')[1] !== domain) {
      return { sukses: false, galat: `Hanya akun domain @${domain} yang diizinkan.` };
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { email: surelBersih },
    });

    if (!pengguna) {
      return { sukses: false, galat: 'Akun belum terdaftar di sistem kerjasama.' };
    }

    if (!pengguna.aktif) {
      return { sukses: false, galat: 'Akun telah dinonaktifkan oleh Administrator.' };
    }

    const cocok = await verifikasiPassword(sandi, pengguna.password);
    if (!cocok) {
      return { sukses: false, galat: 'Kata sandi tidak sesuai.' };
    }

    const peran = Array.isArray(pengguna.peran) ? (pengguna.peran as string[]) : [];
    if (!peran.length) {
      return { sukses: false, galat: 'Akun belum memiliki peran akses.' };
    }

    const token = await buatSesiToken({
      id: pengguna.id,
      email: pengguna.email,
      peran,
    });

    const jar = await cookies();
    jar.set(COOKIE_SESI, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });

    return { sukses: true };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
    return { sukses: false, galat: pesan };
  }
}

export async function keluarAksi() {
  const jar = await cookies();
  jar.delete(COOKIE_SESI);
}
