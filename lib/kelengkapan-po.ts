/**
 * Syarat CETAK sebuah Form Pre-Order — terpisah dari syarat simpan.
 *
 * Draf boleh disimpan setengah jadi; itu gunanya draf. Tapi yang dicetak dibawa
 * ke sekolah untuk ditandatangani, dan tiap isian yang kosong tercetak sebagai
 * garis kosong di dokumen. Jadi tombol Cetak menuntut seluruh isian yang muncul
 * di dokumen sudah terisi.
 *
 * Dipisah sebagai fungsi murni karena inilah yang memutuskan apakah dokumen
 * setengah jadi boleh sampai ke tangan sekolah — dan daftar semacam ini gampang
 * ketinggalan satu bidang tanpa ada yang menyadari.
 */

import type { Halangan } from './langkah-po';
import { labelPihak, type SkemaTtd } from './pihak';

/** Sama persis dengan pesan basis data (jaga_syarat_maju, Keputusan D, catatan/23). */
export const PESAN_TANPA_RH = 'Regional Head Division belum dipilih.';

export type IsianPo = {
  sekolah: {
    nama?: string; npsn?: string;
    kepala_sekolah?: string; kepsek_hp?: string;
    bendahara?: string; bendahara_hp?: string;
  };
  masaMulai?: string;
  masaSelesai?: string;
  sumberDana?: string;
  sumberDanaLain?: string;
  tanggalTtd?: string;
  namaPm?: string;
  namaSm?: string;
  /** Regional Head Division; hanya ditagih pada skema 4. */
  namaRh?: string;
  /** Tanpa = 3: PO lama dan draf yang dibuat sebelum 25 Sep 2026 (catatan/23). */
  skemaTtd?: SkemaTtd;
  jumlahSiswa: number;
  termin: { tanggal?: string; nominal: number }[];
  grandTotal: number;
};

const kosong = (s?: string) => !s?.trim();

/** Rupiah ringkas untuk pesan; tidak memakai lib/format supaya modul ini tidak
 *  menyeret apa pun dan bisa dipakai di klien maupun server. */
const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));

/**
 * Setiap kekurangan berikut langkah wizard tempat ia diperbaiki. Label diberikan DI SINI,
 * di sumbernya, bukan ditebak dari teks pesan oleh layar.
 */
export function kekuranganPo(d: IsianPo): Halangan[] {
  // Termin yang benar-benar diisi. Baris kosong bawaan tidak dihitung sebagai
  // "ada termin", tapi baris yang terisi separuh tetap ditagih.
  const terisi = d.termin.filter((t) => t.nominal > 0 || t.tanggal);
  const total = terisi.reduce((a, t) => a + (t.nominal || 0), 0);
  const di = (langkah: Halangan['langkah'], pesan: string): Halangan => ({ langkah, pesan });

  return [
    ...(kosong(d.sekolah.nama) ? [di('sekolah', 'Nama sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.npsn) ? [di('sekolah', 'NPSN belum diisi.')] : []),
    ...(kosong(d.sekolah.kepala_sekolah) ? [di('sekolah', 'Nama kepala sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.kepsek_hp) ? [di('sekolah', 'Nomor HP kepala sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.bendahara) ? [di('sekolah', 'Nama bendahara belum diisi.')] : []),
    ...(kosong(d.sekolah.bendahara_hp) ? [di('sekolah', 'Nomor HP bendahara belum diisi.')] : []),
    ...(kosong(d.sumberDana) ? [di('termin', 'Sumber dana belum dipilih.')] : []),
    ...(d.sumberDana === 'Lainnya' && kosong(d.sumberDanaLain)
      ? [di('termin', 'Sumber dana "Lainnya" belum dijelaskan.')] : []),
    ...(kosong(d.masaMulai) || kosong(d.masaSelesai) ? [di('termin', 'Masa aktif belum lengkap.')] : []),
    ...(!kosong(d.masaMulai) && !kosong(d.masaSelesai) && d.masaSelesai! <= d.masaMulai!
      ? [di('termin', 'Masa aktif berakhir sebelum atau pada tanggal mulainya.')] : []),
    ...(kosong(d.tanggalTtd) ? [di('penanda', 'Tanggal penandatanganan belum diisi.')] : []),
    ...(kosong(d.namaPm) ? [di('penanda', 'Partnership Manager belum dipilih.')] : []),
    ...(d.skemaTtd === 4 && kosong(d.namaRh) ? [di('penanda', PESAN_TANPA_RH)] : []),
    ...(kosong(d.namaSm)
      ? [di('penanda', `${labelPihak('sales_manager', d.skemaTtd === 4 ? 4 : 3)} belum dipilih.`)] : []),
    ...(d.jumlahSiswa < 1 ? [di('rombel', 'Jumlah siswa belum diisi.')] : []),
    ...(!terisi.length ? [di('termin', 'Termin pembayaran belum diisi.')] : []),
    ...(terisi.some((t) => kosong(t.tanggal) || !t.nominal)
      ? [di('termin', 'Ada termin yang tanggal atau nominalnya masih kosong.')] : []),
    ...(terisi.length && total !== d.grandTotal
      ? [di('termin', `Total termin ${rp(total)} belum sama dengan grand total ${rp(d.grandTotal)}.`)] : []),
  ];
}

/** Pesannya saja, untuk pemanggil yang tidak butuh label langkah. */
export const kurangLengkapPo = (d: IsianPo): string[] => kekuranganPo(d).map((h) => h.pesan);
