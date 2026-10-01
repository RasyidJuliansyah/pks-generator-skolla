/**
 * Primitif pemformatan dan pelolosan yang dipakai lintas berkas.
 *
 * Dipisah dari lib/grafik.tsx yang bertanda 'use client': mengimpor fungsi dari
 * berkas klien ke dalam Server Component memberi rujukan klien, bukan fungsinya,
 * dan pemanggilannya di server akan gagal saat berjalan — bukan saat dibangun.
 */

export const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));

/**
 * Isi bidang uang yang diketik: "1000000" -> "1.000.000".
 *
 * Bidang termin dan nilai sponsorship memakai type="text", bukan "number", karena
 * angka tanpa pemisah ribuan salah dibaca — "15000000" sekilas tampak 1,5 juta.
 * Non-digit dibuang, jadi titik dari format sebelumnya dan "Rp" yang ikut tertempel
 * tidak menumpuk. Teks kosong tetap kosong: memaksanya jadi "0" membuat nolnya tidak
 * bisa dihapus dan angka baru menempel di belakangnya.
 *
 * Dipotong 15 digit karena di atas itu presisi Number mulai berbeda dari yang
 * terlihat, dan yang tersimpan harus sama dengan yang dibaca Sales di layar.
 */
export const digitRupiah = (teks: string) => {
  const digit = tanpaEkorDesimal(teks).replace(/\D/g, '').slice(0, 15).replace(/^0+(?=\d)/, '');
  return digit === '' ? '' : new Intl.NumberFormat('id-ID').format(Number(digit));
};

/**
 * Membuang ekor desimal sebelum digitnya dikumpulkan.
 *
 * Sales menempel angka dari Sheets, dan tempelan itu membawa desimal. Tanpa ini
 * "Rp1.500.000,00" menjadi 150.000.000 — seratus kali lipat, tanpa suara, lalu ikut
 * tercetak di PO yang ditandatangani. Bidang type="number" yang lama menolak tempelan
 * semacam itu terang-terangan (bidangnya kosong); penggantinya tidak boleh gagal
 * lebih halus daripada yang digantikannya.
 *
 * Ini pintu untuk NILAI UTUH — tempelan, atau nilai yang dimuat dari basis data.
 * Untuk teks yang diketik pakai digitRupiahDiketik di bawah.
 *
 * KOMA-lah penandanya, bukan panjang kelompok. Percobaan pertama memakai "pemisah
 * apa pun diikuti satu atau dua digit di ujung", dan itu jebol di jalur mengetik:
 * fungsi ini dipanggil SETIAP KETUKAN, dan "1.500.000" yang dihapus satu karakternya
 * menjadi "1.500.00" — bentuk yang sama persis dengan desimal. Satu Backspace
 * mengubah Rp1.500.000 jadi Rp1.500. Lihat uji "Backspace membuang tepat satu digit".
 *
 * Yang membedakan tempelan dari ketikan: pemformat di sini HANYA pernah mengeluarkan
 * TITIK sebagai pemisah ribuan. Koma dari ketikan disaring oleh digitRupiahDiketik
 * SEBELUM sampai ke sini, jadi koma yang tiba di fungsi ini memang dari luar. Maka:
 *   - koma diikuti 1-2 digit di ujung  -> desimal id-ID ("1.500.000,00", "1500000,00")
 *   - ada koma DAN titik diikuti 1-2 digit di ujung -> desimal en-US ("1,500,000.00")
 * Titik di ujung tanpa koma di mana pun dibiarkan: itu ketikan setengah jadi.
 *
 * Dirapikan dulu dari spasi dan kurung: format Accounting di Excel memberi spasi
 * buntut pada angka positif untuk menyediakan kolom tanda minus, dan mengurung yang
 * negatif. Tanpa dirapikan, jangkar $ meleset dan ekornya lolos.
 *
 * Rupiah di sini selalu bulat dan besar, jadi tidak ada yang hilang saat dibuang.
 */
const tanpaEkorDesimal = (teks: string) => {
  const rapi = teks.trim().replace(/^\((.*)\)$/, '$1').trim();
  if (/,\d{1,2}(?=\D*$)/.test(rapi)) return rapi.replace(/,\d{1,2}(?=\D*$)[\s\S]*$/, '');
  if (rapi.includes(',')) return rapi.replace(/\.\d{1,2}(?=\D*$)[\s\S]*$/, '');
  return rapi;
};

/**
 * Pintu untuk teks yang DIKETIK, bukan ditempel.
 *
 * Aturan ekor desimal di atas bersandar pada satu anggapan: koma tidak lahir dari
 * mengetik. Itu benar soal pemformatnya, tapi tidak soal penggunanya — papan ketik
 * angka Indonesia punya tombol koma, dan inputMode="numeric" hanya anjuran. Menaruh
 * kursor di tengah "1.500.000" lalu menekan koma menghasilkan "1.500.0,00", yang
 * terbaca sebagai desimal dan memangkas nilainya jadi Rp15.000 — dua digit hilang
 * tanpa suara, di bidang uang, pada dokumen yang ditandatangani.
 *
 * Di sini komanya dibuang lebih dulu, jadi menekannya tidak berarti apa-apa dan tidak
 * ada digit yang hilang. InputRupiah memakai pintu ini untuk ketikan dan digitRupiah
 * untuk tempelan, sehingga anggapan di atas menjadi jaminan, bukan harapan.
 */
export const digitRupiahDiketik = (teks: string) => digitRupiah(teks.replace(/,/g, ''));

/** Kebalikan digitRupiah: "1.000.000" -> 1000000. Kosong atau tanpa digit -> 0. */
export const angkaRupiah = (teks: string) =>
  Number(tanpaEkorDesimal(teks).replace(/\D/g, '').slice(0, 15)) || 0;

/**
 * Nilai rupiah dari persen grand total, DIBULATKAN KE BAWAH.
 *
 * Ke bawah, bukan ke terdekat: batas yang ditampilkan juga Math.floor, sedangkan
 * yang menentukan lolos atau tidak adalah perbandingan bilangan bulat di aturan IoM
 * (nilai * 100 <= grand * 15). Dengan pembulatan ke terdekat, mengetik tepat "15"
 * pada grand total yang pas jatuh di ,5 menghasilkan nilai SATU rupiah di atas
 * gerbang, dan PO yang seharusnya lolos otomatis jatuh ke verifikasi manual.
 * Lihat catatan/18.
 */
export const rupiahDariPersen = (persen: number, grand: number) =>
  Math.floor((grand * persen) / 100);

/** "12,5" / "15" — desimal koma, tanpa nol buntut yang tidak berguna. */
export const persenTeks = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Kebalikannya: menerima koma maupun titik, sisanya dibuang. */
export const angkaPersen = (t: string) => Number(t.replace(',', '.').replace(/[^\d.]/g, '')) || 0;

/** "Rp1,2 M" / "Rp340 jt" — sumbu jadi terbaca tanpa deretan nol. */
export function rpSingkat(n: number): string {
  if (n >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000_000) return `Rp${Math.round(n / 1_000_000)} jt`;
  if (n >= 1_000) return `Rp${Math.round(n / 1_000)} rb`;
  return `Rp${Math.round(n)}`;
}

/**
 * Meloloskan teks yang masuk ke HTML dokumen.
 *
 * Nama sekolah dan kepala sekolah diketik sales lalu disisipkan ke surat dan
 * PKS yang dirender lewat dangerouslySetInnerHTML. Tanpa ini, satu tanda kurung
 * siku di nama sekolah cukup untuk menjalankan skrip di layar Tech Ops Lead.
 *
 * Cukup empat karakter: seluruh sisipan berada di simpul teks atau di dalam
 * atribut berkutip ganda, jadi kutip tunggal tidak bisa keluar dari konteksnya.
 */
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-08-30" -> "30 Agustus 2026". Kosong bila tanggalnya belum diisi. */
export function tglID(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d} ${BULAN[+m - 1]} ${y}`;
}
