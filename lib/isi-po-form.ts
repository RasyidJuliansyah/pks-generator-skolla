import type { IsiPo } from './po-aksi';
import { ID_GURU } from './aturan-komponen';

/**
 * Kiriman ke simpanDraf, disusun dari keadaan form PO.
 *
 * Dipindah apa adanya dari simpan() di form-po.tsx supaya bisa direkam
 * (uji/isi-po.test.mjs) dan dibuktikan tidak berubah saat form menjadi wizard
 * (catatan/11). Setiap variabel yang dulu dibaca langsung dari komponen kini
 * bidang `p`.
 */
export type MasukanIsiPo = {
  awalId?: string;
  adaAwal: boolean;
  pindaian: boolean;
  sekolah: IsiPo['sekolah'];
  pilihan: { id: string; sesi: number }[];
  /** Kelompok berharga efektif (sesudah dua lintasan harga); null = PO satu kelompok. */
  kelompok: { nomor: number; nama?: string; hargaSiswa: number }[] | null;
  komponenKelompok: { id: string; sesi: number; kelompok: number }[];
  /** Nomor kelompok yang ada di state; komponen kelompok lain tidak ikut terkirim. */
  nomorKelompok: number[];
  nSiswa: number; guru: number; hSiswa: number; hGuru: number;
  lain: {
    masaMulai: string; masaSelesai: string; sumberDana: string; sumberDanaLain: string;
    kota: string; tanggalTtd: string; namaPm: string; namaSm: string; cat1: string; cat2: string;
    /** Regional Head Division (catatan/23); kosong = tidak terkirim. */
    namaRh?: string;
    permintaanTambahan: boolean;
    nilaiSponsorship: number;
  };
  nRombel: number; barisKelas: number[]; kolomRombel: string[];
  rombel: Record<string, number>;
  kelompokKelas: (k: number) => number;
  termin: { urutan: number; tanggal?: string; nominal: number }[];
  asal: 'platform' | 'unggahan';
  /** Centang "Form kertas lama (3 kotak)" di langkah 0; hanya bermakna saat membuat PO unggahan. */
  formKertasLama?: boolean;
  /**
   * Kunci isian hasil baca scan yang belum dicocokkan Sales (catatan/17 amandemen 2). Kosong =
   * semua langkah sudah dikonfirmasi, dan kolomnya dikosongkan di basis data.
   */
  ekstraksiMenunggu?: string[];
  /**
   * Catatan hasil baca scan yang JENISNYA sudah dipilih Sales. Yang belum dipilih tidak pernah
   * sampai ke sini: jenis catatan tidak boleh ditentukan mesin (catatan/17 aturan 1).
   */
  catatanScan?: { jenis: 'pelaksanaan' | 'sponsorship'; isi: string }[];
};

export function susunIsiPo(p: MasukanIsiPo): IsiPo {
  const bk = !!p.kelompok;
  return {
    id: p.awalId,
    // Server membatalkan pernyataan kesesuaian SEBELUM berkas baru naik.
    pindaianBaru: p.adaAwal && p.pindaian,
    sekolah: p.sekolah,
    komponen: bk
      ? p.komponenKelompok.filter((x) => ID_GURU.includes(x.id) || p.nomorKelompok.includes(x.kelompok))
      : p.pilihan,
    jumlahSiswa: p.nSiswa,
    jumlahGuru: p.guru,
    hargaSiswa: bk ? 0 : p.hSiswa,
    hargaGuru: p.hGuru,
    masaMulai: p.lain.masaMulai || undefined,
    masaSelesai: p.lain.masaSelesai || undefined,
    sumberDana: p.lain.sumberDana,
    sumberDanaLain: p.lain.sumberDanaLain || undefined,
    kota: p.lain.kota,
    tanggalTtd: p.lain.tanggalTtd || undefined,
    namaPm: p.lain.namaPm || undefined,
    namaSm: p.lain.namaSm || undefined,
    namaRh: p.lain.namaRh || undefined,
    jumlahRombel: p.nRombel,
    rombel: p.barisKelas.flatMap((k) => p.kolomRombel.map((r) => ({
      kelas: k, rombel: r, jumlah: p.rombel[`${k}-${r}`] || 0,
      ...(bk ? { kelompok: p.kelompokKelas(k) } : {}) }))),
    ...(bk ? { kelompok: p.kelompok!.map((k) => ({
      nomor: k.nomor, nama: k.nama?.trim() || undefined, hargaSiswa: k.hargaSiswa })) } : {}),
    termin: p.termin.filter((t) => t.nominal > 0 || t.tanggal),
    catatan: [
      { jenis: 'pelaksanaan' as const, isi: p.lain.cat1 },
      { jenis: 'sponsorship' as const, isi: p.lain.cat2 },
      // Catatan dari scan menyusul di belakang, jenisnya sudah dipilih Sales.
      ...(p.catatanScan?.length ? p.catatanScan : []),
    ],
    // Hanya terkirim bila dicentang: kiriman PO lain tetap sama dengan rekaman emasnya.
    ...(p.formKertasLama && p.asal === 'unggahan' && !p.adaAwal ? { formKertasLama: true as const } : {}),
    // Hanya terkirim bila ADA isinya: kiriman PO lain tetap identik dengan rekaman emasnya.
    // Kosong berarti kolomnya dikosongkan di basis data (semua langkah sudah dicocokkan).
    ...(p.ekstraksiMenunggu?.length ? { ekstraksiMenunggu: p.ekstraksiMenunggu } : {}),
    asal: p.asal,
    permintaanTambahan: p.lain.permintaanTambahan,
    // 0 berarti belum diisi; kolomnya nullable supaya "belum diisi" dan "nol" tidak tertukar.
    nilaiSponsorship: p.lain.nilaiSponsorship || undefined,
  };
}
