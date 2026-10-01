/**
 * Inti perhitungan PO. Sengaja murni — tanpa DOM, tanpa React — supaya bisa diuji
 * langsung dan dipakai ulang di server maupun peramban.
 *
 * Perilakunya menyalin kalkulator lama apa adanya. Kalau ada yang berubah di sini,
 * angka yang dikutip tim sales ikut berubah.
 */
// Hanya TIPE dari pricelist — nilai harganya tidak boleh ikut. Berkas ini dipakai form PO
// di peramban, jadi setiap impor nilai dari pricelist menyeret harga Acquisition ke sana.
// Daftar komponen dan paket karena itu selalu dioper pemanggil: server mengoper versi
// yang sudah dipotong per peran (komponenUntuk/presetUntuk).
import type { Komponen, Preset } from './pricelist';
import { ID_GURU, MIN_PESERTA, KAPASITAS_SESI } from './aturan-komponen';

export type Pilihan = { id: string; sesi: number };

export type BarisRincian = {
  id: string;
  nama: string;
  namaPendek: string;
  sesi: number;
  perSesi: boolean;
  untukGuru: boolean;
  nilai: (number | null)[];
};

export type Hitungan = {
  /** Harga per siswa per tier, komponen guru tidak ikut. */
  perSiswa: number[];
  /** Harga per guru per tier. */
  perGuru: number[];
  /** perSiswa x jumlah siswa + perGuru x jumlah guru. */
  total: number[];
  rincian: BarisRincian[];
  /** Nama komponen yang harganya belum ada, per tier. Bukan dianggap nol. */
  belumLengkap: string[][];
  /**
   * Nama paket kalau komponen INTI yang dicentang persis sebuah preset, kalau tidak null.
   * Inilah yang memindahkan PO dari harga a la carte ke harga paket — otomatis, karena
   * susunan yang sama tidak boleh punya dua harga.
   */
  paket: string | null;
};

export type Pelanggaran = {
  jenis: 'minimal' | 'kapasitas';
  nama: string;
  butuh: number;
  punya: number;
  satuan: 'siswa' | 'guru' | 'sesi';
  pesan: string;
};

const cari = (id: string, daftar: Komponen[]) => daftar.find((k) => k.id === id);

/**
 * Paket yang cocok dengan komponen INTI sebuah pilihan — SATU-SATUNYA aturan
 * pencocokan paket di seluruh sistem.
 *
 * Add-on per sesi sengaja diabaikan: LMS Juara + 2 sesi Konsultasi tetap paket
 * LMS Juara, persis cara sheet menjualnya. Dulu penamaan di dokumen memakai
 * `presetCocok` yang menuntut SELURUH pilihan sama, sehingga PO berharga paket
 * bisa tercetak sebagai "Paket Custom" di dokumen yang dibawa ke sekolah.
 */
export function paketDari(
  pilihan: Pilihan[],
  daftar: Komponen[],
  daftarPaket: Preset[],
): Preset | undefined {
  const inti = pilihan
    .map((p) => cari(p.id, daftar))
    .filter((k): k is Komponen => !!k && k.g === 'core' && !ID_GURU.includes(k.id))
    .map((k) => k.id);
  return daftarPaket.find(
    (p) => p.ids.length === inti.length && p.ids.every((id) => inti.includes(id)));
}

export function hitung(
  pilihan: Pilihan[],
  jumlahSiswa: number,
  jumlahGuru: number,
  daftar: Komponen[],
  daftarPaket: Preset[],
): Hitungan {
  const nTier = daftar[0]?.p.length ?? 3;
  const perSiswa = Array(nTier).fill(0);
  const perGuru = Array(nTier).fill(0);
  const belumLengkap: string[][] = Array.from({ length: nTier }, () => []);
  const rincian: BarisRincian[] = [];
  // Sumbangan komponen inti dicatat terpisah supaya bisa DITUKAR dengan harga paket.
  const inti = Array(nTier).fill(0);

  for (const p of pilihan) {
    const k = cari(p.id, daftar);
    if (!k) continue;
    const sesi = k.sesi ? Math.max(1, p.sesi || 1) : 1;
    const untukGuru = ID_GURU.includes(k.id);
    const ember = untukGuru ? perGuru : perSiswa;

    // Harga yang belum ada ditandai null dan sengaja TIDAK dianggap nol,
    // supaya total tier terkait tidak diam-diam kekecilan.
    const nilai = k.p.map((v) => (v == null ? null : v * sesi));
    nilai.forEach((v, i) => {
      if (v == null) belumLengkap[i].push(k.s);
      else {
        ember[i] += v;
        if (k.g === 'core' && !untukGuru) inti[i] += v;
      }
    });

    rincian.push({
      id: k.id, nama: k.n, namaPendek: k.s,
      sesi, perSesi: !!k.sesi, untukGuru, nilai,
    });
  }

  // Harga paket MENGGANTIKAN jumlah komponen intinya, bukan menambahinya. Add-on per
  // sesi tetap ditambah di atasnya, persis cara sheet menjualnya.
  //
  // Pencocokannya sengaja hanya melihat komponen INTI: LMS Juara + 2 sesi Konsultasi
  // tetap dihargai sebagai paket, karena add-on memang dijual terpisah per sesi.
  //
  // Lantai ikut berpindah tanpa perubahan lain, karena `periksa()` di po-aksi.ts membaca
  // perSiswa[1] dari sini. Konsekuensinya ada tebing yang harus dijelaskan ke Sales:
  // melepas satu komponen murah dari sebuah paket membuat susunannya bukan paket lagi,
  // sehingga lantainya melompat naik (LMS Juara tanpa Analisis SNBP: 186.000 -> 226.000,
  // padahal bottom SNBP sendiri cuma 3.000). Itu melekat pada harga bundel, bukan bug.
  const paket = paketDari(pilihan, daftar, daftarPaket);
  if (paket) paket.p.forEach((v, i) => { if (i < nTier) perSiswa[i] += v - inti[i]; });

  const nS = Math.max(0, jumlahSiswa);
  const nG = Math.max(0, jumlahGuru);
  const total = perSiswa.map((v, i) => v * nS + perGuru[i] * nG);

  return { perSiswa, perGuru, total, rincian, belumLengkap, paket: paket?.n ?? null };
}

/** Batas minimal peserta. Pelatihan Guru dihitung dari jumlah guru, bukan siswa. */
export function langgarMinimum(
  pilihan: Pilihan[], jumlahSiswa: number, jumlahGuru: number,
  daftar: Komponen[],
): Pelanggaran[] {
  const out: Pelanggaran[] = [];
  for (const p of pilihan) {
    const aturan = MIN_PESERTA[p.id];
    if (!aturan) continue;
    const k = cari(p.id, daftar);
    if (!k) continue;
    const punya = aturan.per === 'guru' ? jumlahGuru : jumlahSiswa;
    if (punya < aturan.n) {
      out.push({
        jenis: 'minimal', nama: k.s, butuh: aturan.n, punya, satuan: aturan.per,
        pesan: `${k.s} minimal ${aturan.n} ${aturan.per}, sekarang ${punya}.`,
      });
    }
  }
  return out;
}

/**
 * Kapasitas maksimal per sesi. Sesi minimal = peserta / kapasitas, dibulatkan ke atas.
 * Tanpa ini, satu sesi untuk 900 siswa lolos — mustahil dilaksanakan sekaligus
 * salah harga.
 */
export function langgarKapasitas(
  pilihan: Pilihan[], jumlahSiswa: number, jumlahGuru: number,
  daftar: Komponen[],
): Pelanggaran[] {
  const out: Pelanggaran[] = [];
  for (const p of pilihan) {
    const aturan = KAPASITAS_SESI[p.id];
    if (!aturan) continue;
    const k = cari(p.id, daftar);
    if (!k) continue;
    const peserta = aturan.per === 'guru' ? jumlahGuru : jumlahSiswa;
    const butuh = Math.ceil(peserta / aturan.n);
    const sesi = Math.max(1, p.sesi || 1);
    if (butuh > sesi) {
      out.push({
        jenis: 'kapasitas', nama: k.s, butuh, punya: sesi, satuan: 'sesi',
        pesan: `${k.s} butuh minimal ${butuh} sesi untuk ${peserta} ${aturan.per}, sekarang ${sesi}.`,
      });
    }
  }
  return out;
}

/** Batas bawah atribut `min` pada input jumlah siswa / guru. */
export function batasBawahPeserta(pilihan: Pilihan[], per: 'siswa' | 'guru') {
  const angka = pilihan
    .map((p) => MIN_PESERTA[p.id])
    .filter((a) => a && a.per === per)
    .map((a) => a.n);
  return angka.length ? Math.max(...angka) : per === 'guru' ? 0 : 1;
}

/** Preset dianggap cocok bila kumpulan id-nya sama persis. */
export function presetCocok(pilihan: Pilihan[], ids: string[]) {
  const a = pilihan.map((p) => p.id).slice().sort().join(',');
  return a === ids.slice().sort().join(',');
}
