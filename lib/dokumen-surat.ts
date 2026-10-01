/**
 * Menghasilkan HTML Surat Verifikasi Kesiapan: satu kotak A4 yang dicetak apa adanya.
 *
 * Susunannya mengikuti sembilan surat asli yang sudah diterbitkan Tech Ops Lead
 * (SMP Saraswati Seririt, SMA Madinatul Quran, SMA Muhammadiyah 2 Surakarta, dan
 * seterusnya) — kalimat pembuka, penutup, dan urutan barisnya disalin apa adanya
 * supaya surat terbitan sistem tidak terbaca berbeda dari yang selama ini dipakai.
 *
 * Tiga penyimpangan yang disengaja dari surat asli, semuanya karena prosesnya
 * memang sudah berubah:
 *
 * 1. Surat asli menyebut verifikasi dilakukan "dari sisi Education dan Tech Ops".
 *    Sekarang yang memberi lampu hijau ada empat fungsi, Finance dan Service
 *    Account ikut. Kalimatnya menyebut fungsi yang benar-benar memutuskan.
 * 2. Catatan tidak diketik ulang: isinya diambil dari keputusan "setuju dengan
 *    catatan" yang masih berlaku. Masalah yang sudah diperbaiki Sales tidak ikut
 *    tercetak — jejaknya ada di riwayat PO.
 * 3. Sejak 22 Sep 2026 (catatan/13a Bagian 11) PO yang lolos seluruh aturan IoM
 *    diverifikasi dan ditutup OTOMATIS. Surat untuk PO seperti itu punya variannya
 *    sendiri (`otomatis`): yang menyatakan adalah SISTEM menurut ketentuan IoM yang
 *    berlaku, dan Head of Operations serta Tech Ops Lead disebut sebagai pihak yang
 *    DIINFORMASIKAN — bukan penanda tangan. Surat itu sengaja tidak mencetak kalimat
 *    "dari sisi ...", karena tidak ada fungsi yang memutuskan; mencetaknya dengan
 *    daftar kosong menghasilkan "dari sisi  untuk", dan itu pernah jadi alasan surat
 *    otomatis ditahan sepenuhnya.
 */

import { esc, BULAN, tglID } from './format';

export type DataSurat = {
  namaMitra: string;
  masaMulai?: string;
  masaSelesai?: string;
  /** Ringkasan satu kalimat: paket, jenjang, kelas, jumlah siswa. */
  keterangan: string;
  /** Rincian layanan, satu butir per baris. */
  layanan: string[];
  /** Catatan yang masih berlaku, beserta fungsi yang memberikannya. */
  catatan: { fungsi: string; isi: string }[];
  /**
   * Fungsi yang memberi lampu hijau, sudah berlabel. Diabaikan bila `otomatis` ada,
   * dan itu disengaja: untuk PO otomatis daftarnya memang kosong, bukan lupa diisi.
   */
  fungsiVerifikator: string[];
  kota?: string;
  tanggal?: string;
  penandaTangan: string;
  /** Gambar tanda tangan Tech Ops Lead, bila sudah dibubuhkan. Tidak ada di varian otomatis. */
  ttdUrl?: string;
  /**
   * Varian otomatis. Isinya cuma versi IoM yang berlaku saat itu, dan itu diambil dari
   * basis data (`private.versi_iom_berlaku()`), bukan dari kode aplikasi: surat yang
   * mencantumkan aturan yang salah lebih buruk daripada surat tanpa varian otomatis.
   */
  otomatis?: { versiIom: string };
};

/** "Agustus 2026 - Juli 2027", seperti pada surat-surat asli. */
function masaAktif(mulai?: string, selesai?: string) {
  const bulan = (iso?: string) => {
    if (!iso) return '';
    const [y, m] = iso.split('-');
    return `${BULAN[+m - 1]} ${y}`;
  };
  const a = bulan(mulai), b = bulan(selesai);
  if (a && b) return a === b ? a : `${a} - ${b}`;
  return a || b || '-';
}

/** "A, B dan C" — tanpa koma sebelum "dan", sesuai kaidah bahasa Indonesia. */
export function gabung(daftar: string[]) {
  if (daftar.length <= 1) return daftar[0] ?? '';
  return `${daftar.slice(0, -1).join(', ')} dan ${daftar[daftar.length - 1]}`;
}

export function dokumenSurat(d: DataSurat): string {
  const baris = (label: string, isi: string) =>
    `<p class="surat-baris"><span class="surat-label">${label}</span>`
    + `<span class="surat-nilai">: ${esc(isi)}</span></p>`;

  const butir = (daftar: string[]) =>
    daftar.length ? `<ul class="surat-daftar">${daftar.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';

  // Surat asli tanpa catatan berhenti di "(PKS)." — tidak menggantung frasa
  // "dengan catatan sebagai berikut" lalu kosong.
  const adaCatatan = d.catatan.length > 0;
  const ekorCatatan = adaCatatan ? ' dengan catatan sebagai berikut :' : '.';
  const kalimatLanjut =
    'telah dilakukan sesuai dengan ketentuan dan standar yang berlaku. Berdasarkan hasil '
    + 'verifikasi, proses dapat dilanjutkan ke tahap penyusunan Draft Perjanjian Kerja (PKS)'
    + ekorCatatan;

  const auto = d.otomatis;
  // Pembungkusan baris paragraf manual dipertahankan PERSIS seperti rekaman emas: surat yang
  // sudah terbit tidak boleh berubah satu byte pun hanya karena berkas ini dirapikan.
  // `uji/emas.test.mjs` yang menahannya, dan itulah gunanya.
  const pembuka = auto
    ? `Surat ini diterbitkan otomatis oleh sistem Skolla menurut ketentuan IoM `
      + `${esc(auto.versiIom)} yang berlaku. Dengan ini dinyatakan bahwa proses pengecekan `
      + 'dan verifikasi kesiapan terhadap:'
    : 'Yang bertanda tangan di bawah ini selaku TechOps Lead menyatakan bahwa proses\n'
      + '  pengecekan dan verifikasi kesiapan terhadap:';

  const lanjutAuto = auto
    ? 'telah dilakukan sesuai dengan ketentuan dan standar yang berlaku, dan seluruh aturan '
      + `yang diperiksa mesin terpenuhi. Berdasarkan hasil verifikasi otomatis menurut `
      + `ketentuan IoM ${esc(auto.versiIom)}, proses dapat dilanjutkan ke tahap penyusunan `
      + `Draft Perjanjian Kerja (PKS)`
      + ekorCatatan
    : kalimatLanjut;

  const bukti = auto
    ? `<p>Surat ini dibuat sebagai bukti formal telah dilakukannya verifikasi kesiapan secara `
      + `otomatis menurut ketentuan IoM ${esc(auto.versiIom)} untuk PO ${esc(d.namaMitra)}.</p>

  <p>Surat ini diinformasikan kepada Head of Operations dan Tech Ops Lead.</p>`
    : `<p>Surat ini dibuat sebagai bukti formal telah dilakukannya verifikasi kesiapan
  dari sisi ${esc(gabung(d.fungsiVerifikator))} untuk PO ${esc(d.namaMitra)}.</p>`;

  // Varian otomatis tanpa blok tanda tangan: tidak ada yang membubuhkan goresan, jadi
  // mencetak ruang kosong di situ akan terbaca seperti surat yang belum selesai.
  const ttd = auto
    ? `<div class="surat-ttd">
    <p>${esc(d.kota || 'Jakarta')}, ${esc(tglID(d.tanggal))}</p>
    <p>Sistem Skolla</p>
    <p class="surat-nama">Dikonfirmasi otomatis</p>
    <p class="surat-sumber">Ketentuan IoM ${esc(auto.versiIom)}</p>
  </div>`
    : `<div class="surat-ttd">
    <p>${esc(d.kota || 'Jakarta')}, ${esc(tglID(d.tanggal))}</p>
    <p>Hormat kami,</p>
    ${d.ttdUrl
      ? `<img class="surat-gambar-ttd" src="${esc(d.ttdUrl)}" alt="Tanda tangan ${esc(d.penandaTangan)}">`
      : '<span class="surat-ruang-ttd"></span>'}
    <p class="surat-nama">${esc(d.penandaTangan)}</p>
  </div>`;

  return `
<section class="po-halaman surat" data-hal="1"><span class="po-nomor no-print">Halaman 1</span>
  <h2>SURAT VERIFIKASI KESIAPAN</h2>

  <p>${pembuka}</p>

  ${baris('Model Kerja Sama (B2B/B2S)', 'B2S')}
  ${baris('Nama Mitra', d.namaMitra)}
  ${baris('Masa Aktif', masaAktif(d.masaMulai, d.masaSelesai))}

  <p class="surat-baris"><span class="surat-label">Keterangan</span>
  <span class="surat-nilai">: ${esc(d.keterangan)}</span></p>
  ${butir(d.layanan)}

  <p>${lanjutAuto}</p>
  ${adaCatatan
    ? `<ul class="surat-daftar">${d.catatan.map((c) =>
        `<li>${esc(c.isi)} <span class="surat-sumber">(${esc(c.fungsi)})</span></li>`).join('')}</ul>`
    : ''}

  ${bukti}

  ${ttd}
</section>`;
}
