/**
 * Perhitungan PO berkelompok — spesifikasi 07, langkah 3.
 *
 * Satu PO bisa memuat beberapa kelompok siswa (per angkatan), masing-masing dengan
 * komponen dan harganya sendiri. Contohnya: kelas 12 memakai paket LMS Juara, kelas 10
 * hanya LMS Smart + Asesmen. Tanpa kelompok, seluruh siswa ditagih seolah memakai
 * semua komponen — siswa hantu.
 *
 * Fungsi ini murni dan belum dipakai siapa pun. Ia menunggu `po_kelompok`, lantai per
 * kelompok di basis data, layar, dan dokumen — keempatnya harus masuk bersama dalam satu
 * rilis. Membukanya sebagian membuka celah lantai harga (lihat catatan/07).
 *
 * Aturan yang ditegakkan di sini, bukan di pemanggil:
 *   - Jumlah siswa kelompok TIDAK PERNAH diketik: selalu jumlah rombelnya. Itu yang
 *     membuat dokumen bisa berbunyi "Tryout — kelas 12, 100 siswa" dan bisa dicek.
 *   - Pencocokan paket berjalan PER KELOMPOK dengan aturan `paketDari` yang sama; satu
 *     PO boleh berisi kelompok berharga paket dan kelompok a la carte sekaligus.
 *   - Pelatihan Guru di tingkat PO, bukan kelompok: satu jumlah guru, satu harga guru,
 *     dihitung dari komponen guru di kelompok mana pun.
 */
import type { Komponen, Preset } from './pricelist';
import { ID_GURU } from './aturan-komponen';
import { hitung, type Hitungan, type Pilihan } from './hitung';

export type KomponenKelompok = Pilihan & { kelompok: number };
export type RombelKelompok = { kelas: number; rombel: string; jumlah: number; kelompok: number };
export type Kelompok = { nomor: number; nama?: string; hargaSiswa: number };

export type HasilKelompok = {
  nomor: number;
  nama?: string;
  /** Jumlah rombelnya — tidak ada jalan lain untuk mengisinya. */
  siswa: number;
  /** Kelas yang benar-benar terisi, urut. */
  kelas: number[];
  /** Hitungan komponen SISWA kelompok ini; komponen guru tidak ikut. */
  hitungan: Hitungan;
  /** Bottom price per siswa — tier 1. Nol bila tier itu tidak ada. */
  lantai: number;
  hargaSiswa: number;
  subtotal: number;
};

export type HasilPerKelompok = {
  kelompok: HasilKelompok[];
  guru: { hitungan: Hitungan; lantai: number; subtotal: number };
  grandTotal: number;
  /** Keadaan yang membuat PO tidak sah. Kosong berarti bentuknya benar. */
  masalah: string[];
  /** `masalah` yang sama, berikut langkah wizard tempat ia diperbaiki. Server cukup membaca `masalah`. */
  masalahBerlangkah: { langkah: 'paket' | 'rombel'; pesan: string }[];
};

export function hitungPerKelompok(p: {
  kelompok: Kelompok[];
  komponen: KomponenKelompok[];
  rombel: RombelKelompok[];
  jumlahGuru: number;
  hargaGuru: number;
  daftar: Komponen[];
  daftarPaket: Preset[];
}): HasilPerKelompok {
  const masalah: string[] = [];
  const masalahBerlangkah: HasilPerKelompok['masalahBerlangkah'] = [];
  const catat = (langkah: 'paket' | 'rombel', pesan: string) => {
    masalah.push(pesan);
    masalahBerlangkah.push({ langkah, pesan });
  };
  const nomor = new Set(p.kelompok.map((k) => k.nomor));
  const rombelTerisi = p.rombel.filter((r) => r.jumlah > 0);

  if (nomor.size !== p.kelompok.length) catat('paket', 'Nomor kelompok ada yang ganda.');
  // Batas yang sama dengan po_kelompok di basis data (20260912). Ditolak DI SINI, sebelum
  // simpanDraf menulis apa pun: bila baru ditolak basis data, persetujuan sudah telanjur
  // dibasikan dan baris po sudah tertulis, dan drafnya tertinggal setengah jadi.
  const nomorLuar = p.kelompok.filter((k) => !Number.isInteger(k.nomor) || k.nomor < 1 || k.nomor > 6);
  if (nomorLuar.length) catat('paket', 'Nomor kelompok harus 1 sampai 6.');
  const namaPanjang = p.kelompok.filter((k) => (k.nama?.trim().length ?? 0) > 60);
  if (namaPanjang.length)
    catat('paket', `Nama kelompok maksimal 60 karakter (${namaPanjang.map((k) => `kelompok ${k.nomor}`).join(', ')}).`);

  // Rombel yang sama dua kali. Skema menjamin satu rombel satu kelompok karena
  // `kelompok` adalah kolom di baris rombelnya — tapi kiriman berbentuk larik bisa
  // memuat baris ganda, dan siswanya lalu terhitung dua kali.
  const lihat = new Map<string, number>();
  for (const r of rombelTerisi) {
    const kunci = `${r.kelas}-${r.rombel}`;
    lihat.set(kunci, (lihat.get(kunci) ?? 0) + 1);
  }
  const ganda = [...lihat].filter(([, n]) => n > 1).map(([k]) => k);
  if (ganda.length) catat('rombel', `Rombel tercatat lebih dari sekali: ${ganda.join(', ')}.`);

  // Siswa yang tidak tertagih. Diam-diam kehilangan mereka lebih berbahaya daripada
  // menolak simpan: angka di dokumen jadi lebih kecil tanpa ada yang sadar.
  const yatim = rombelTerisi.filter((r) => !nomor.has(r.kelompok));
  if (yatim.length) {
    const n = yatim.reduce((a, r) => a + r.jumlah, 0);
    catat('rombel', `${n} siswa di rombel ${yatim.map((r) => `${r.kelas}-${r.rombel}`).join(', ')} `
      + 'belum masuk kelompok mana pun, jadi tidak tertagih.');
  }
  const komponenYatim = p.komponen.filter((k) => !ID_GURU.includes(k.id) && !nomor.has(k.kelompok));
  if (komponenYatim.length)
    catat('paket', `Komponen ${komponenYatim.map((k) => k.id).join(', ')} menunjuk kelompok yang tidak ada.`);

  const kelompok: HasilKelompok[] = [...p.kelompok].sort((a, b) => a.nomor - b.nomor).map((k) => {
    const rombel = rombelTerisi.filter((r) => r.kelompok === k.nomor);
    const siswa = rombel.reduce((a, r) => a + r.jumlah, 0);
    const pilihan = p.komponen
      .filter((x) => x.kelompok === k.nomor && !ID_GURU.includes(x.id))
      .map(({ id, sesi }) => ({ id, sesi }));
    const hitungan = hitung(pilihan, siswa, 0, p.daftar, p.daftarPaket);
    const label = k.nama?.trim() || `Kelompok ${k.nomor}`;
    if (!siswa) catat('rombel', `${label} belum berisi siswa.`);
    if (!pilihan.length) catat('paket', `${label} belum punya komponen.`);
    return {
      nomor: k.nomor,
      nama: k.nama,
      siswa,
      kelas: [...new Set(rombel.map((r) => r.kelas))].sort((a, b) => a - b),
      hitungan,
      lantai: hitungan.perSiswa[1] ?? 0,
      hargaSiswa: k.hargaSiswa,
      subtotal: k.hargaSiswa * siswa,
    };
  });

  const pilihanGuru = p.komponen.filter((x) => ID_GURU.includes(x.id)).map(({ id, sesi }) => ({ id, sesi }));
  const hGuru = hitung(pilihanGuru, 0, p.jumlahGuru, p.daftar, p.daftarPaket);
  const subtotalGuru = p.hargaGuru * Math.max(0, p.jumlahGuru);

  return {
    kelompok,
    guru: { hitungan: hGuru, lantai: hGuru.perGuru[1] ?? 0, subtotal: subtotalGuru },
    grandTotal: kelompok.reduce((a, k) => a + k.subtotal, 0) + subtotalGuru,
    masalah,
    masalahBerlangkah,
  };
}
