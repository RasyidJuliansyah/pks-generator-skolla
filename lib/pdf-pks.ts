/**
 * Menyusun PKS menjadi PDF di server.
 *
 * Halaman dirakit oleh peramban yang sama dengan yang dipakai layar, memakai
 * gaya dan pemecah halaman yang sama pula — supaya berkas yang diunduh tidak
 * menyimpang dari pratinjau. Mencetak lewat dialog cetak peramban masing-masing
 * orang tidak bisa diandalkan: margin, kop bawaan, dan penskalaan berbeda-beda
 * per perangkat.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { paginasiPks } from './paginasi-pks';

/** Tinggi area isi satu halaman; sama dengan yang dipakai KertasPks. */
const TINGGI_ISI_MM = 242;

/**
 * Times New Roman tidak ada di Chromium Linux. Tinos punya metrik yang sama,
 * jadi pemenggalan barisnya identik dengan yang terlihat di layar Mac/Windows.
 */
const FONT_TINOS = 'https://fonts.gstatic.com/s/tinos/v24/buE4poGnedXvwjX-Rt1s0CoV_NxLeiw.woff2';
const FONT_TINOS_TEBAL = 'https://fonts.gstatic.com/s/tinos/v24/buE1poGnedXvwj1AW0Fp2i4CudB9.woff2';

async function berkas(relatif: string) {
  return readFile(path.join(process.cwd(), relatif));
}

/** Halaman lengkap yang siap dirakit peramban: gaya, kop, isi, dan pemecahnya. */
async function halamanPks(isiHtml: string): Promise<string> {
  const [css, kop] = await Promise.all([
    berkas('app/globals.css').then((b) => b.toString('utf8')),
    berkas('public/kop-pks.png').then((b) => b.toString('base64')),
  ]);

  // Kop disisipkan sebagai data URI: dokumen dimuat lewat setContent, tanpa
  // alamat asal, sehingga rujukan relatif ke /kop-pks.png tidak akan ketemu.
  const gaya = css.replace("url('/kop-pks.png')", `url('data:image/png;base64,${kop}')`);

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Times New Roman';src:url('${FONT_TINOS}') format('woff2');
  font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'Times New Roman';src:url('${FONT_TINOS_TEBAL}') format('woff2');
  font-weight:700;font-style:normal;font-display:block}
${gaya}
/* Cetak: satu kotak = satu halaman, tanpa bayangan dan jarak layar.
   Ukuran halaman ditetapkan lewat @page dan dipakai apa adanya oleh Chromium
   (preferCSSPageSize). Menyerahkannya ke pilihan width/height membuat tinggi
   kotak dan tinggi halaman berbeda kurang dari satu piksel — cukup untuk
   melemparkan tiap kotak ke halaman kedua dan menyisipkan halaman kosong di
   antaranya. */
@page{size:210mm 297mm;margin:0}
html,body{margin:0;padding:0;background:#fff}
.pks-kertas{box-shadow:none;margin:0;break-inside:avoid;break-after:page;
  /* 297mm sama persis dengan tinggi halaman, dan pembulatan sepersekian piksel
     membuat kotak terakhir meluber jadi satu halaman kosong tambahan. Dipotong
     0,2mm; kop tetap digambar pada ukuran 297mm penuh. */
  height:296.8mm;min-height:296.8mm}
.pks-kertas:last-of-type{break-after:auto}
</style></head>
<body>
<div id="ukur" class="pks-ukur pks">${isiHtml}</div>
<div id="keluar"></div>
</body></html>`;
}

/** Merakit halaman di dalam peramban, lalu mengembalikan PDF-nya. */
export async function pdfPks(
  isiHtml: string, tanpaParafDiAkhir = true,
): Promise<{ pdf: Uint8Array; halaman: number }> {
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);

  const lokal = process.env.CHROME_LOKAL;
  const peramban = await puppeteer.default.launch(
    lokal
      ? { executablePath: lokal, args: ['--no-sandbox'], headless: true }
      : {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        }
  );

  try {
    const hal = await peramban.newPage();
    // Di bawah 860px berlaku tata letak layar sempit: kertas A4 kehilangan
    // posisi mutlaknya, kop hanya muncul di atas, dan paraf ikut mengalir.
    // Lebar ini hanya menentukan tata letak; ukuran cetak diatur @page.
    await hal.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
    await hal.setContent(await halamanPks(isiHtml), { waitUntil: 'load' });
    await hal.evaluate(() => document.fonts.ready);

    // Fungsi pemecah dikirim utuh; seluruh pembantunya bersarang di dalamnya.
    const halamanDirakit: number = await hal.evaluate(
      (sumberFungsi: string, tinggiMm: number, tanpaParaf: boolean) => {
        const MM = 96 / 25.4;
        // Sebagian penyusun berkas menyisipkan penanda seperti __name ke dalam
        // fungsi yang ditranspilasi. Penanda itu ikut terbawa saat fungsinya
        // diserialkan, tapi definisinya tidak — jadi disediakan penggantinya
        // yang tidak melakukan apa-apa. Muncul atau tidaknya bergantung cara
        // pembundelan, sehingga tidak bisa diandalkan absen.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const bagi = new Function('__name', `return (${sumberFungsi})`)(
          (f: unknown) => f
        ) as (w: HTMLElement, b: number) => string[];
        const ukur = document.getElementById('ukur')!;
        const halaman = bagi(ukur, tinggiMm * MM);
        ukur.style.display = 'none';
        document.getElementById('keluar')!.innerHTML = halaman
          .map((isi, i) => {
            const paraf = tanpaParaf && i === halaman.length - 1 ? '' :
              '<table class="pks-paraf"><tbody><tr><td></td><td></td></tr>'
              + '<tr><td>PIHAK I</td><td>PIHAK II</td></tr></tbody></table>';
            return `<section class="pks-kertas"><div class="pks-isi pks">${isi}</div>`
              + `${paraf}<span class="pks-halaman">Halaman ${i + 1} dari ${halaman.length}</span>`
              + '</section>';
          })
          .join('');
        return halaman.length;
      },
      paginasiPks.toString(), TINGGI_ISI_MM, tanpaParafDiAkhir
    );

    // Ukuran halaman datang dari kotak .pks-kertas itu sendiri; margin nol
    // supaya kop yang sudah selebar A4 tidak ikut diperkecil.
    const pdf = await hal.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return { pdf, halaman: halamanDirakit };
  } finally {
    await peramban.close();
  }
}

/**
 * Mengunci PDF: boleh dicetak, tidak boleh disunting atau disalin isinya.
 *
 * Ini penghalang, bukan pengaman. Bendera izin dihormati pembaca PDF umum tapi
 * bisa dilewati alat khusus; yang benar-benar mengikat tetap tanda tangan basah
 * di atas meterai beserta arsip aslinya.
 */
export async function kunciPdf(pdf: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const dok = await PDFDocument.load(pdf);
  dok.encrypt({
    // Sandi pemilik acak dan tidak disimpan: tidak ada yang perlu membukanya,
    // dan menyimpannya justru menciptakan rahasia yang harus dijaga.
    ownerPassword: crypto.randomUUID() + crypto.randomUUID(),
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });
  return dok.save();
}
