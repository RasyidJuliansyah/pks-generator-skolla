import React from 'react';
// Perkakas pemeriksaan manual untuk halaman riwayat sekolah.
//
// Halaman sungguhannya butuh sesi login, jadi bagian riwayatnya dipisah sebagai
// komponen dan dirender di sini dengan data contoh — dua tema sekaligus:
//
//   npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-sekolah.tsx
//   lalu buka _sekolah-terang.html dan _sekolah-gelap.html
//
// Ada sebabnya: kartu KPI halaman ini pernah tayang dengan label dan angka
// menempel sebaris karena tidak pernah benar-benar dilihat sebelum dikirim.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import RiwayatKerjaSama, { type PoRiwayat } from '../app/(sistem)/sekolah/[id]/riwayat-kerja-sama';
import { rp } from '../lib/format';

const t = (h: string) => `2026-0${h}T04:00:00.000Z`;

const po: PoRiwayat[] = [
  {
    id: 'a', nomor: 7, status: 'pks_ditandatangani', grand_total: 128_400_000,
    jumlah_siswa: 428, jumlah_guru: 22, masa_mulai: '2026-07-01', masa_selesai: '2027-06-30',
    dibuat_oleh: 'bintang@skolla.education', dibuat_pada: t('6-01'),
    diverifikasi_oleh: 'dwiva@skolla.education',
    diverifikasi_otomatis: false,
    po_riwayat: [
      { status_lama: null, status_baru: 'draf', versi: 1, oleh: 'bintang@skolla.education', pada: t('6-01') },
      { status_lama: 'draf', status_baru: 'draf', versi: 2, oleh: 'bintang@skolla.education', pada: t('6-02') },
      { status_lama: 'draf', status_baru: 'menunggu_ttd', versi: 2, oleh: 'bintang@skolla.education', pada: t('6-03') },
      { status_lama: 'ditandatangani', status_baru: 'verifikasi', versi: 2, oleh: 'bintang@skolla.education', pada: t('6-05') },
      { status_lama: 'verifikasi', status_baru: 'terverifikasi', versi: 2, oleh: 'dwiva@skolla.education', pada: t('6-09') },
    ],
    tanda_tangan: [
      { pihak: 'kepala_sekolah', nama: 'Dra. Sri Wahyuni, M.Pd.', dibubuhkan_oleh: 'bintang@skolla.education', waktu: t('6-04') },
      { pihak: 'partnership_manager', nama: 'Agung Septiansyah', dibubuhkan_oleh: 'bintang@skolla.education', waktu: t('6-04') },
    ],
    verifikasi: [
      { fungsi: 'finance', hasil: 'tolak', catatan: 'Harga siswa di bawah bottom price paket ini.',
        oleh: 'farid@skolla.education', waktu: t('6-06'), berlaku: false, sebab_basi: 'Direvisi: harga_siswa berubah' },
      { fungsi: 'finance', hasil: 'setuju', catatan: null,
        oleh: 'farid@skolla.education', waktu: t('6-07'), berlaku: true, sebab_basi: null },
      { fungsi: 'education', hasil: 'setuju_catatan', catatan: 'Materi kelas 12 menyusul paling lambat Agustus.',
        oleh: 'rini@skolla.education', waktu: t('6-07'), berlaku: true, sebab_basi: null },
      { fungsi: 'tech_ops', hasil: 'setuju', catatan: null,
        oleh: 'taufiq@skolla.education', waktu: t('6-08'), berlaku: true, sebab_basi: null },
      { fungsi: 'service_account', hasil: 'setuju', catatan: null,
        oleh: 'riska@skolla.education', waktu: t('6-08'), berlaku: true, sebab_basi: null },
    ],
    surat_verifikasi: { nama_penanda: 'Dwiva Yulian Edfi', ditandatangani_oleh: 'dwiva@skolla.education',
      dibuat_pada: t('6-10'), final_pada: t('6-10') },
    pks: { dibuat_oleh: 'bintang@skolla.education', dibuat_pada: t('6-11'), final_pada: t('6-12'),
      diunggah_oleh: 'bintang@skolla.education', diunggah_pada: t('6-20'), ditandatangani_pada: '2026-06-18' },
  },
  {
    id: 'b', nomor: 3, status: 'selesai', grand_total: 96_000_000,
    jumlah_siswa: 320, jumlah_guru: 0, masa_mulai: '2025-07-01', masa_selesai: '2026-06-30',
    dibuat_oleh: 'bintang@skolla.education', dibuat_pada: t('5-02'),
    diverifikasi_oleh: 'dwiva@skolla.education',
    diverifikasi_otomatis: false,
    po_riwayat: [
      { status_lama: null, status_baru: 'draf', versi: 1, oleh: 'bintang@skolla.education', pada: t('5-02') },
      { status_lama: 'aktif', status_baru: 'selesai', versi: 1, oleh: 'riska@skolla.education', pada: t('5-30') },
    ],
    tanda_tangan: [], verifikasi: [], surat_verifikasi: null, pks: null,
  },
  {
    id: 'c', nomor: 1, status: 'ditolak', grand_total: 44_000_000,
    jumlah_siswa: 150, jumlah_guru: 8, masa_mulai: null, masa_selesai: null,
    dibuat_oleh: 'bintang@skolla.education', dibuat_pada: t('4-11'), diverifikasi_oleh: null,
    diverifikasi_otomatis: false,
    po_riwayat: [
      { status_lama: null, status_baru: 'draf', versi: 1, oleh: 'bintang@skolla.education', pada: t('4-11') },
      { status_lama: 'verifikasi', status_baru: 'ditolak', versi: 1, oleh: 'dwiva@skolla.education', pada: t('4-14') },
    ],
    tanda_tangan: [], surat_verifikasi: null, pks: null,
    verifikasi: [
      { fungsi: 'service_account', hasil: 'tolak', catatan: 'Jadwal tutor tidak tersedia untuk kelas paralel sebanyak ini.',
        oleh: 'riska@skolla.education', waktu: t('4-13'), berlaku: true, sebab_basi: null },
    ],
  },
  {
    // Ditutup OTOMATIS oleh basis data (catatan/13a Bagian 11). Perhatikan `oleh` pada baris
    // riwayat `terverifikasi`: itu nama Sales yang mengajukan, karena penutupannya berjalan di
    // dalam transaksinya. Kartu ini ada untuk MEMBUKTIKAN bahwa lini masa tidak menyebutnya
    // sebagai yang memutuskan, dan tidak melabeli suratnya "ditandatangani".
    id: 'd', nomor: 9, status: 'terverifikasi', grand_total: 63_000_000,
    jumlah_siswa: 210, jumlah_guru: 0, masa_mulai: '2026-09-01', masa_selesai: '2027-08-31',
    dibuat_oleh: 'bintang@skolla.education', dibuat_pada: t('8-01'),
    diverifikasi_oleh: null,
    diverifikasi_otomatis: true,
    // Isian awalnya dibaca AI (catatan/17): lini masanya harus memuat peristiwa itu, dan
    // peristiwanya TIDAK boleh menyebut pelaku mesin sebagai yang memutuskan.
    dibaca_ai_pada: t('8-01'),
    po_riwayat: [
      { status_lama: null, status_baru: 'draf', versi: 1, oleh: 'bintang@skolla.education', pada: t('8-01') },
      { status_lama: 'ditandatangani', status_baru: 'verifikasi', versi: 1, oleh: 'bintang@skolla.education', pada: t('8-05') },
      { status_lama: 'verifikasi', status_baru: 'terverifikasi', versi: 1, oleh: 'bintang@skolla.education', pada: t('8-06') },
    ],
    tanda_tangan: [], verifikasi: [],
    surat_verifikasi: { nama_penanda: null, ditandatangani_oleh: null,
      dibuat_pada: t('8-06'), final_pada: t('8-06'), otomatis: true },
    pks: null,
  },
];

const kpi = [
  { label: 'PO seumur hidup', nilai: String(po.length) },
  { label: 'Jadi PKS', nilai: '1' },
  { label: 'Ditolak', nilai: '1' },
  { label: 'Nilai seluruhnya', nilai: rp(po.reduce((a, p) => a + p.grand_total, 0)) },
];

const isi = renderToStaticMarkup(
  <main className="wrap">
    <header className="top">
      <div>
        <p className="eyebrow">Sekolah</p>
        <h1>SMA Negeri 1 Cibadak</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          SMA · NPSN 20203344 · dipegang bintang
        </p>
      </div>
    </header>
    <div className="kpi">
      {kpi.map((k) => (
        <div className="kpi-kotak" key={k.label}>
          <div className="kpi-label">{k.label}</div>
          <div className={`kpi-angka${k.nilai === '0' ? ' kpi-kosong' : ''}`}>{k.nilai}</div>
        </div>
      ))}
    </div>
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-head"><h2>Kontak</h2></div>
      <div className="sekolah-kisi" style={{ marginTop: 10 }}>
        <div>
          <div className="kpi-label">Kepala Sekolah</div>
          <div>Dra. Sri Wahyuni, M.Pd.</div>
          <div className="ttd-waktu">081234567890</div>
        </div>
        <div>
          <div className="kpi-label">Bendahara</div>
          <div>Hendra Gunawan</div>
          <div className="ttd-waktu">081298765432</div>
        </div>
        <div>
          <div className="kpi-label">Alamat</div>
          <div style={{ fontSize: 13.5 }}>Jl. Siliwangi No. 45, Cibadak, Sukabumi</div>
        </div>
      </div>
    </section>
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Riwayat Kerja Sama</h2>
      <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13.5 }}>
        Seluruh PO untuk sekolah ini, terbaru di atas. PO yang sudah jadi PKS
        tetap tercantum — di sinilah riwayat perpanjangan terbaca.
      </p>
      <RiwayatKerjaSama po={po} />
    </section>
  </main>
);

const css = readFileSync('app/globals.css', 'utf8');
for (const [nama, tema] of [['terang', 'light'], ['gelap', 'dark']] as const) {
  writeFileSync(`_sekolah-${nama}.html`,
    `<!doctype html><html lang="id" data-theme="${tema}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Sekolah ${nama}</title><style>${css}</style><body>${isi}</body></html>`);
}
console.log('dua berkas pratinjau ditulis');
