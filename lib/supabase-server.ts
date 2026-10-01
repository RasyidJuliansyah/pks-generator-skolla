export {
  penggunaSaatIni,
  penggunaHalaman,
  daftarPengguna,
  wajib,
} from './sesi';

export type Peran =
  | 'sales' | 'head_of_sales' | 'head_of_operations' | 'cbo' | 'c_level'
  | 'admin_utama' | 'admin_sales'
  | 'education' | 'tech_ops' | 'finance' | 'service_account' | 'tech_ops_lead'
  | 'regional_head';

export type Pengguna = { email: string; nama: string | null; peran: Peran[] };

export const LABEL_PERAN: Record<Peran, string> = {
  sales: 'Sales',
  head_of_sales: 'Head of Sales',
  regional_head: 'Regional Head Division',
  head_of_operations: 'Head of Operations',
  cbo: 'Chief Business Officer',
  c_level: 'C Level',
  admin_utama: 'Admin Utama (Super Admin)',
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







