'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import { hashPassword } from './auth';
import { penggunaSaatIni, type Peran } from './sesi';

type Hasil = { ok: boolean; galat?: string };

const SEMUA_PERAN: Peran[] = [
  'sales', 'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama',
  'admin_sales', 'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead',
  'regional_head',
];

async function adminSaatIni() {
  const h = await penggunaSaatIni();
  if (h.status !== 'ok') return { galat: 'Sesi berakhir. Masuk lagi.' } as const;
  if (!h.pengguna.peran.includes('admin_utama'))
    return { galat: 'Hanya Admin Utama yang bisa mengelola pengguna.' } as const;
  return { pengguna: h.pengguna } as const;
}

/** Menyaring peran yang dikirim peramban terhadap daftar yang sah. */
function bersihkanPeran(peran: string[]): Peran[] | null {
  const sah = peran.filter((p): p is Peran => (SEMUA_PERAN as string[]).includes(p));
  return sah.length ? [...new Set(sah)] : null;
}

export async function tambahPengguna(
  email: string, nama: string, peran: string[]
): Promise<Hasil> {
  const a = await adminSaatIni();
  if ('galat' in a) return { ok: false, galat: a.galat };

  const alamat = email.trim().toLowerCase();
  const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';
  if (alamat.split('@')[1] !== domain)
    return { ok: false, galat: `Alamat harus berakhiran @${domain}.` };
  if (!nama.trim()) return { ok: false, galat: 'Nama belum diisi.' };

  const sah = bersihkanPeran(peran);
  if (!sah) return { ok: false, galat: 'Pilih minimal satu peran.' };

  try {
    const ada = await prisma.pengguna.findUnique({ where: { email: alamat } });
    if (ada) return { ok: false, galat: 'Akun dengan alamat itu sudah terdaftar.' };

    const defaultPass = await hashPassword('password123');

    await prisma.$transaction(async (tx) => {
      await tx.pengguna.create({
        data: {
          email: alamat,
          nama: nama.trim(),
          peran: sah,
          password: defaultPass,
          aktif: true,
        },
      });
      await tx.penggunaRiwayat.create({
        data: {
          email: alamat,
          aksi: 'tambah',
          peranBaru: sah,
          namaBaru: nama.trim(),
          aktifBaru: true,
          oleh: a.pengguna.email,
        },
      });
    });

    revalidatePath('/pengguna');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

export async function ubahPeran(email: string, peran: string[]): Promise<Hasil> {
  const a = await adminSaatIni();
  if ('galat' in a) return { ok: false, galat: a.galat };

  const sah = bersihkanPeran(peran);
  if (!sah) return { ok: false, galat: 'Pilih minimal satu peran.' };

  const targetEmail = email.trim().toLowerCase();
  if (a.pengguna.email === targetEmail && !sah.includes('admin_utama')) {
    return { ok: false, galat: 'Tidak bisa mencabut peran admin_utama dari akun sendiri.' };
  }

  try {
    const target = await prisma.pengguna.findUnique({ where: { email: targetEmail } });
    if (!target) return { ok: false, galat: 'Pengguna tidak ditemukan.' };

    const peranLama = (Array.isArray(target.peran) ? target.peran : []) as Peran[];
    const sedangAdmin = peranLama.includes('admin_utama');
    const akanAdmin = sah.includes('admin_utama');

    if (sedangAdmin && !akanAdmin) {
      const semuaAdmin = await prisma.pengguna.findMany({
        where: { aktif: true },
        select: { email: true, peran: true },
      });
      const sisa = semuaAdmin.filter(
        (u) => u.email !== targetEmail && Array.isArray(u.peran) && (u.peran as string[]).includes('admin_utama')
      ).length;
      if (sisa === 0) {
        return { ok: false, galat: 'Tidak bisa menurunkan Super Admin terakhir.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pengguna.update({
        where: { email: targetEmail },
        data: { peran: sah },
      });
      await tx.penggunaRiwayat.create({
        data: {
          email: targetEmail,
          aksi: 'ubah',
          peranLama,
          peranBaru: sah,
          namaLama: target.nama,
          namaBaru: target.nama,
          aktifLama: target.aktif,
          aktifBaru: target.aktif,
          oleh: a.pengguna.email,
        },
      });
    });

    revalidatePath('/pengguna');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

export async function ubahNama(email: string, nama: string): Promise<Hasil> {
  const a = await adminSaatIni();
  if ('galat' in a) return { ok: false, galat: a.galat };
  if (!nama.trim()) return { ok: false, galat: 'Nama belum diisi.' };

  const targetEmail = email.trim().toLowerCase();

  try {
    const target = await prisma.pengguna.findUnique({ where: { email: targetEmail } });
    if (!target) return { ok: false, galat: 'Pengguna tidak ditemukan.' };

    const namaBaru = nama.trim();
    if (target.nama === namaBaru) return { ok: true };

    const peranLama = (Array.isArray(target.peran) ? target.peran : []) as Peran[];

    await prisma.$transaction(async (tx) => {
      await tx.pengguna.update({
        where: { email: targetEmail },
        data: { nama: namaBaru },
      });
      await tx.penggunaRiwayat.create({
        data: {
          email: targetEmail,
          aksi: 'ubah',
          peranLama,
          peranBaru: peranLama,
          namaLama: target.nama,
          namaBaru,
          aktifLama: target.aktif,
          aktifBaru: target.aktif,
          oleh: a.pengguna.email,
        },
      });
    });

    revalidatePath('/pengguna');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

/**
 * Menonaktifkan atau mengaktifkan kembali akun.
 *
 * Akun tidak pernah dihapus: PO, tanda tangan, dan keputusan verifikasi merujuk
 * ke alamatnya, dan menghapusnya berarti memutus jejak siapa mengerjakan apa.
 */
export async function ubahAktif(email: string, aktif: boolean): Promise<Hasil> {
  const a = await adminSaatIni();
  if ('galat' in a) return { ok: false, galat: a.galat };

  const targetEmail = email.trim().toLowerCase();
  if (a.pengguna.email === targetEmail && !aktif) {
    return { ok: false, galat: 'Tidak bisa menonaktifkan akun sendiri.' };
  }

  try {
    const target = await prisma.pengguna.findUnique({ where: { email: targetEmail } });
    if (!target) return { ok: false, galat: 'Pengguna tidak ditemukan.' };

    const peranLama = (Array.isArray(target.peran) ? target.peran : []) as Peran[];

    if (!aktif && peranLama.includes('admin_utama')) {
      const semuaAdmin = await prisma.pengguna.findMany({
        where: { aktif: true },
        select: { email: true, peran: true },
      });
      const sisa = semuaAdmin.filter(
        (u) => u.email !== targetEmail && Array.isArray(u.peran) && (u.peran as string[]).includes('admin_utama')
      ).length;
      if (sisa === 0) {
        return { ok: false, galat: 'Tidak bisa menonaktifkan Super Admin terakhir.' };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pengguna.update({
        where: { email: targetEmail },
        data: { aktif },
      });
      await tx.penggunaRiwayat.create({
        data: {
          email: targetEmail,
          aksi: 'ubah',
          peranLama,
          peranBaru: peranLama,
          namaLama: target.nama,
          namaBaru: target.nama,
          aktifLama: target.aktif,
          aktifBaru: aktif,
          oleh: a.pengguna.email,
        },
      });
    });

    revalidatePath('/pengguna');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}
