/**
 * Tampilan verdict IoM (catatan/16). Verdict dihitung basis data (catatan/15); modul ini hanya
 * membacanya. Tanpa impor nilai pricelist, jadi aman di peramban dan teruji.
 *
 * "Lolos" di layar HARUS berarti PO ini benar-benar berakhir terverifikasi. Sejak 22 Sep 2026
 * (catatan/13a Bagian 11) penutupannya dikerjakan basis data sendiri begitu verdict lolos,
 * jadi yang perlu dicerminkan tinggal dua syarat: versi PO dan versi IoM verdictnya masih
 * yang berlaku, dan tidak ada fungsi yang menolak.
 *
 * Dua syarat yang dulu ikut diperiksa di sini sudah tidak relevan, dan menghapusnya bukan
 * kehilangan penjagaan:
 *
 *   - Deklarasi kesiapan paket. Dulu diperiksa ulang di sini karena penutupan terjadi
 *     belakangan, satu klik kemudian, sehingga deklarasi bisa kedaluwarsa di antaranya.
 *     Celah itu kini tidak ada: verdict dan penutupan terjadi dalam transaksi yang sama.
 *     Deklarasi yang tidak berlaku sudah membuat verdictnya sendiri gagal lewat aturan
 *     `deklarasi-berlaku`.
 *   - Ada tidaknya Head of Operations aktif. Penutupan tidak lagi menuntut peran itu, jadi
 *     PO buatan satu-satunya HoO pun tidak bisa lagi menggantung tak bisa ditutup siapa pun
 *     (temuan QA 3a putaran 2).
 */
import { VERSI_IOM } from './iom';

export type BarisVerdict = {
  lolos: boolean;
  gagal: string[];
  hasil: { kode: string; lolos: boolean; bukti: string }[];
  paket: string | null;
  /** Paket yang dipakai, satu per kelompok. Kosong/absen pada baris lama (sebelum PO berkelompok otomatis). */
  kelompok?: string[] | null;
  versi_po: number;
  versi_iom: string;
  dicatat_pada: string;
};

/** Label manusia per kode aturan `lib/iom.ts` (dijaga uji: tidak boleh ada yang hilang). */
export const LABEL_ATURAN: Record<string, string> = {
  'po-berstempel-iom': 'Dibuat di bawah aturan IoM',
  'sekolah-terisi': 'Nama sekolah terisi',
  'komponen-dikenal': 'Semua komponen dikenal pricelist',
  'jumlah-siswa-minimal': 'Jumlah siswa minimal 1',
  'minimal-peserta': 'Batas minimal peserta terpenuhi',
  'kapasitas-sesi': 'Kapasitas sesi cukup',
  'termin-sama-total': 'Total termin sama dengan grand total',
  'unggahan-ditinjau': 'Pindaian sudah dinyatakan sesuai',
  'masa-aktif-lengkap': 'Masa aktif lengkap',
  'masa-aktif-wajar': 'Masa aktif berakhir sesudah mulai',
  'sekolah-lengkap': 'Data sekolah lengkap',
  'satu-kelompok': 'PO satu kelompok',
  'kelompok-terdefinisi': 'Jumlah kelompok terbaca utuh',
  'paket-persis': 'Komponen persis satu paket',
  'layanan-sesuai-paket': 'Layanan sesuai paket',
  'deklarasi-berlaku': 'Deklarasi kesiapan paket berlaku',
  'lantai-siswa': 'Harga siswa tidak di bawah bottom price',
  'lantai-guru': 'Tanpa pelatihan guru',
  'tanpa-diskon': 'Harga siswa tanpa diskon dari price list',
  'tanpa-pengecualian-hoo': 'Tanpa pengecualian Head of Operations',
  'sponsorship-dalam-batas': 'Sponsorship dalam batas 15%',
  'tanpa-permintaan-tambahan': 'Tanpa permintaan di luar paket',
  'galat-evaluasi': 'Penilaian otomatis gagal dijalankan',
};

/** Baris dengan `dicatat_pada` terbesar. Stempel waktu PostgREST satu zona, jadi urutan teks = urutan waktu. */
export function verdictTerakhir<T extends { dicatat_pada: string }>(daftar: T[] | null | undefined): T | null {
  return (daftar ?? []).reduce<T | null>((a, v) => (!a || v.dicatat_pada > a.dicatat_pada ? v : a), null);
}

/**
 * `basi`: verdict untuk versi PO atau versi IoM lain, jadi tidak dipakai lagi.
 * `gagal`: aturan tidak terpenuhi, ATAU ada fungsi yang menolak. Penolakan disamakan dengan
 * gagal karena akibatnya sama di layar: PO ini butuh keempat fungsi, bukan penutupan otomatis.
 * Pada keadaan normal ia tidak pernah muncul bersama verdict lolos -- verdict lolos langsung
 * menutup PO dalam transaksi yang sama -- jadi cabang ini cuma jaring pengaman.
 */
export type KeadaanVerdict = 'tidak-ada' | 'lolos' | 'gagal' | 'basi';

export type KonteksVerdict = { versiPo: number; adaPenolakan: boolean };

export function keadaanVerdict(
  v: { lolos: boolean; versi_po: number; versi_iom: string } | null, k: KonteksVerdict,
): KeadaanVerdict {
  if (!v) return 'tidak-ada';
  if (v.versi_po !== k.versiPo || v.versi_iom !== VERSI_IOM) return 'basi';
  if (!v.lolos) return 'gagal';
  return k.adaPenolakan ? 'gagal' : 'lolos';
}
