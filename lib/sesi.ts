import { cookies } from 'next/headers';
import prisma from './prisma';
import { bacaSesiToken, COOKIE_SESI } from './auth';

export function wajib<R extends { error: { message: string } | null }>(hasil: R): R {
  if (hasil.error) throw new Error(hasil.error.message);
  return hasil;
}

export type Peran =
  | 'sales' | 'head_of_sales' | 'head_of_operations' | 'cbo' | 'c_level'
  | 'admin_utama' | 'admin_sales'
  | 'education' | 'tech_ops' | 'finance' | 'service_account' | 'tech_ops_lead'
  | 'regional_head';

export type Pengguna = { email: string; nama: string | null; peran: Peran[] };

export async function penggunaSaatIni(): Promise<
  { status: 'anonim' } |
  { status: 'domain_salah'; email: string } |
  { status: 'belum_terdaftar'; email: string } |
  { status: 'nonaktif'; email: string } |
  { status: 'tanpa_peran'; email: string } |
  { status: 'galat'; email: string } |
  { status: 'ok'; pengguna: Pengguna }
> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_SESI)?.value;
    if (!token) return { status: 'anonim' };

    const sesi = await bacaSesiToken(token);
    if (!sesi?.email) return { status: 'anonim' };

    const email = sesi.email.toLowerCase();
    const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';
    if (email.split('@')[1] !== domain) return { status: 'domain_salah', email };

    const data = await prisma.pengguna.findUnique({
      where: { email },
      select: { email: true, nama: true, peran: true, aktif: true },
    });

    if (!data) return { status: 'belum_terdaftar', email };
    if (!data.aktif) return { status: 'nonaktif', email };

    const daftarPeran = (Array.isArray(data.peran) ? data.peran : []) as Peran[];
    if (!daftarPeran.length) return { status: 'tanpa_peran', email };

    return {
      status: 'ok',
      pengguna: {
        email: data.email,
        nama: data.nama,
        peran: daftarPeran,
      },
    };
  } catch {
    return { status: 'galat', email: '' };
  }
}

export async function penggunaHalaman(): Promise<
  Exclude<Awaited<ReturnType<typeof penggunaSaatIni>>, { status: 'galat' }>
> {
  const hasil = await penggunaSaatIni();
  if (hasil.status === 'galat') throw new Error('Gagal memeriksa akses pengguna');
  return hasil;
}

export const LABEL_PERAN: Record<Peran, string> = {
  sales: 'Sales',
  head_of_sales: 'Head of Sales',
  head_of_operations: 'Head of Operations',
  cbo: 'Chief Business Officer',
  c_level: 'C Level',
  regional_head: 'Regional Head Division',
  admin_utama: 'Super Admin',
  admin_sales: 'Admin Sales',
  education: 'Education',
  tech_ops: 'Tech Ops',
  finance: 'Finance',
  service_account: 'Service Account',
  tech_ops_lead: 'Tech Ops Lead',
};

export const adalahSuperAdmin = (p: Peran[]) => p.includes('admin_utama');

const berperan = (p: Peran[], daftar: Peran[]) =>
  adalahSuperAdmin(p) || p.some((x) => daftar.includes(x));

export const bolehLihatAcquisition = (p: Peran[]) =>
  berperan(p, ['cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance', 'regional_head']);

export const adalahVerifikator = (p: Peran[]) =>
  berperan(p, ['education', 'tech_ops', 'finance', 'service_account']);

export const adalahLead = (p: Peran[]) => berperan(p, ['tech_ops_lead']);

export const adalahHoO = (p: Peran[]) => p.includes('head_of_operations');

export const bolehLihatSemua = (p: Peran[]) => berperan(p, [
  'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama',
  'admin_sales', 'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead',
  'regional_head',
]);

export const bolehBuatPo = (p: Peran[]) =>
  berperan(p, ['sales', 'head_of_sales', 'admin_sales']);

export const bolehKomentar = (p: Peran[]) => !p.includes('c_level');

export async function daftarPengguna(
  peran?: Peran[],
): Promise<{ email: string; nama: string | null }[]> {
  const baris = await prisma.pengguna.findMany({
    where: { aktif: true },
    select: { email: true, nama: true, peran: true },
    orderBy: { nama: 'asc' },
  });

  if (!peran || peran.length === 0) {
    return baris.map((b) => ({ email: b.email, nama: b.nama }));
  }

  return baris
    .filter((b) => {
      const p = (Array.isArray(b.peran) ? b.peran : []) as string[];
      return peran.some((r) => p.includes(r));
    })
    .map((b) => ({ email: b.email, nama: b.nama }));
}
