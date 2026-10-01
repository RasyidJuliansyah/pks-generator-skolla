/**
 * Merender halaman PDF menjadi JPEG di PERAMBAN (catatan/17 amandemen 3).
 *
 * Di peramban, bukan di server: merender di server berarti menambah langkah Chromium yang berat
 * di setiap permintaan, dan langkah itu sudah cukup mahal untuk PDF PKS (5,5 detik hanya untuk
 * meluncurkan Chromium, catatan/30 Agu). Modul ini dipisah dari komponen supaya aturan ukurannya
 * bisa diuji tanpa peramban.
 *
 * Worker pdf.js disajikan sebagai berkas statis `public/pdf.worker.min.mjs`, disalin manual dari
 * `pdfjs-dist` dan DIKOMIT: satu berkas statis lebih tahan daripada langkah build yang bisa gagal
 * diam-diam. Naikkan berkas itu setiap kali `pdfjs-dist` diperbarui.
 */
export const MUTU = 0.72;
/**
 * Batas sisi terpanjang. HARUS di atas 1754: itulah sisi panjang A4 pada 150 dpi (1240x1754),
 * dan batas yang lebih rendah dari itu memperkecil SETIAP halaman A4 diam-diam -- kerapatan
 * yang diukur jadi tidak pernah tercapai, dan yang terbaca model lebih buram daripada yang
 * diuji. 1800 memberi ruang untuk itu sekaligus tetap memangkas pindaian 300 dpi (2480x3508).
 */
export const MAKS_PANJANG = 1800;
/**
 * Halaman dirender pada 150 dpi.
 *
 * DIUKUR 25 Sep 2026 lewat modul ini sendiri di Chromium, atas PDF rekaan tiga halaman (teks dan
 * tabel, BUKAN pindaian; tanpa satu pun data asli), lalu batas atasnya:
 *   - rekaan 3 halaman: 254.332 karakter base64 seluruhnya (144.844 / 65.288 / 44.200), 194 ms;
 *   - derau seragam pada geometri yang sama: 1.510.252 karakter untuk SATU halaman -- JPEG tidak
 *     bisa memampatkan derau, jadi ini batas atas yang tidak mungkin dilewati pindaian sungguhan.
 * Pindaian asli jatuh di antara keduanya. Dua halaman -- bentuk normal Form PO -- muat di bawah
 * pagar 900.000 di lib/ekstraksi-aksi.ts; tiga halaman pindaian yang ramai bisa DITOLAK pagar itu
 * dengan pesan yang jelas, dan Sales tinggal mengetik. Kalau itu jadi keluhan nyata, yang
 * diturunkan adalah angka di sini, BUKAN batas badan Server Action.
 */
export const DPI = 150;

/** Ukuran gambar yang benar-benar dikirim ke penyedia; rasionya dijaga. */
export function langkahTurun(lebar: number, tinggi: number): { lebar: number; tinggi: number } {
  const terpanjang = Math.max(lebar, tinggi);
  if (terpanjang <= MAKS_PANJANG) return { lebar, tinggi };
  const skala = MAKS_PANJANG / terpanjang;
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

/** Halaman PDF (ArrayBuffer) menjadi daftar JPEG base64, tanpa awalan data:. */
export async function halamanKeJpeg(berkas: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  // destroy() ada di TUGAS pemuatan, bukan di dokumennya (pdf.js v6), dan itulah yang membebaskan
  // worker-nya. Satu Sales bisa membaca beberapa scan berturut-turut di tab yang sama.
  const tugas = pdfjs.getDocument({ data: berkas });
  const dok = await tugas.promise;
  const hasil: string[] = [];
  try {
    for (let i = 1; i <= dok.numPages; i++) {
      const halaman = await dok.getPage(i);
      const skala = DPI / 72;
      const dasar = halaman.getViewport({ scale: skala });
      const { lebar, tinggi } = langkahTurun(Math.round(dasar.width), Math.round(dasar.height));
      const kanvas = document.createElement('canvas');
      kanvas.width = lebar;
      kanvas.height = tinggi;
      const ctx = kanvas.getContext('2d');
      if (!ctx) throw new Error('Kanvas tidak tersedia di peramban ini.');
      // Latar putih: JPEG tidak punya kanal alfa, dan latar transparan jadi hitam.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, lebar, tinggi);
      // `canvas`, bukan `canvasContext`: sejak v6 kanvasnya yang wajib, dan konteksnya hanya
      // dipertahankan untuk keserasian ke belakang.
      await halaman.render({
        canvas: kanvas,
        viewport: halaman.getViewport({ scale: skala * (lebar / Math.round(dasar.width)) }),
      }).promise;
      const dataUrl = kanvas.toDataURL('image/jpeg', MUTU);
      hasil.push(dataUrl.slice(dataUrl.indexOf(',') + 1));
    }
  } finally {
    await tugas.destroy();
  }
  return hasil;
}
