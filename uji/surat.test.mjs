// Menguji Surat Verifikasi Kesiapan terhadap susunan sembilan surat asli yang
// sudah diterbitkan Tech Ops Lead.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const S = muat('dokumen-surat');
const D = muat('dokumen-dari-po');
const { PRESET } = muat('pricelist');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const juara = PRESET.find((p) => p.n === 'LMS Juara');
const poDasar = {
  sekolah: { nama: 'SMP SARASWATI SERIRIT', jenjang: 'SMP' },
  jumlah_siswa: 30, jumlah_guru: 0, harga_siswa: 284000, harga_guru: 0,
  masa_mulai: '2026-09-01', masa_selesai: '2027-09-30',
  kota: 'Jakarta', diverifikasi_pada: '2026-08-07T04:00:00Z',
  po_komponen: juara.ids.map((id) => ({ komponen_id: id, sesi: 1 })),
  po_rombel: [
    { kelas: 7, rombel: 'A', jumlah_siswa: 10 },
    { kelas: 8, rombel: 'A', jumlah_siswa: 10 },
    { kelas: 9, rombel: 'A', jumlah_siswa: 10 },
    { kelas: 9, rombel: 'B', jumlah_siswa: 0 },
  ],
};
const empatHijau = ['education', 'tech_ops', 'finance', 'service_account']
  .map((f) => ({ fungsi: f, hasil: 'setuju', catatan: null, berlaku: true }));

// 1. Susunan dan kalimat baku surat asli
{
  const d = D.dataSuratDariPo(poDasar, empatHijau, 'Dwiva Yulian Edfi');
  const h = S.dokumenSurat(d);
  for (const frasa of [
    'SURAT VERIFIKASI KESIAPAN',
    'Yang bertanda tangan di bawah ini selaku TechOps Lead',
    'Model Kerja Sama (B2B/B2S)',
    'telah dilakukan sesuai dengan ketentuan dan standar yang berlaku',
    'dilanjutkan ke tahap penyusunan Draft Perjanjian Kerja (PKS)',
    'Surat ini dibuat sebagai bukti formal',
    'Hormat kami,',
    'Dwiva Yulian Edfi',
  ]) assert.ok(h.includes(frasa), 'frasa hilang: ' + frasa);
  ok('kalimat baku surat asli utuh');

  assert.ok(h.includes('September 2026 - September 2027'), 'masa aktif salah');
  assert.ok(h.includes('Jakarta, 7 Agustus 2026'), 'tanggal penutupan tidak tercetak');
  ok('masa aktif dan tanggal mengikuti format surat asli');

  assert.equal(d.keterangan,
    'Paket LMS Juara jenjang SMP kelas 7, 8 dan 9 dengan total 30 siswa');
  ok('keterangan menyebut paket, jenjang, kelas terisi, dan jumlah siswa');
}

// 2. Tanpa catatan: kalimatnya berhenti di "(PKS)." — tidak menggantung
{
  const h = S.dokumenSurat(D.dataSuratDariPo(poDasar, empatHijau, 'X'));
  assert.ok(h.includes('(PKS).'), 'kalimat tanpa catatan tidak ditutup titik');
  assert.ok(!h.includes('dengan catatan sebagai berikut'),
    'frasa catatan muncul padahal tidak ada catatan');
  ok('tanpa catatan, frasa "dengan catatan sebagai berikut" tidak menggantung');
}

// 3. Hanya catatan yang masih berlaku yang tercetak
{
  const campur = [
    { fungsi: 'education', hasil: 'setuju', catatan: null, berlaku: true },
    { fungsi: 'tech_ops', hasil: 'setuju_catatan', catatan: 'Anbuso baru rilis Oktober.', berlaku: true },
    { fungsi: 'finance', hasil: 'setuju', catatan: null, berlaku: true },
    { fungsi: 'service_account', hasil: 'setuju', catatan: null, berlaku: true },
    // sudah digantikan karena Sales merevisi harga
    { fungsi: 'finance', hasil: 'tolak', catatan: 'Termin tidak sama dengan grand total.', berlaku: false },
  ];
  const h = S.dokumenSurat(D.dataSuratDariPo(poDasar, campur, 'X'));
  assert.ok(h.includes('Anbuso baru rilis Oktober.'), 'catatan berlaku tidak tercetak');
  assert.ok(!h.includes('Termin tidak sama'), 'catatan penolakan lama ikut tercetak');
  assert.ok(h.includes('dengan catatan sebagai berikut'), 'frasa catatan hilang');
  ok('catatan berlaku tercetak, penolakan yang sudah diperbaiki tidak');
}

// 4. Fungsi yang disebut = yang benar-benar memutuskan
{
  const tiga = empatHijau.filter((k) => k.fungsi !== 'finance');
  const h = S.dokumenSurat(D.dataSuratDariPo(poDasar, tiga, 'X'));
  assert.ok(h.includes('dari sisi Education, Tech Ops dan Service Account'),
    'daftar fungsi verifikator salah');
  assert.ok(!h.includes('Finance'), 'Finance disebut padahal belum memutuskan');
  ok('surat menyebut fungsi yang benar-benar memberi lampu hijau');
}

// 5. Isi dari sekolah tidak boleh lolos sebagai HTML
{
  const jahat = { ...poDasar, sekolah: { nama: '<script>alert(1)</script>', jenjang: 'SMP' } };
  const h = S.dokumenSurat(D.dataSuratDariPo(jahat, empatHijau, 'X'));
  assert.ok(!h.includes('<script>'), 'nama sekolah tidak dilolos-amankan');
  assert.ok(h.includes('&lt;script&gt;'), 'nama sekolah tidak ter-escape');
  ok('nama sekolah dan catatan di-escape, bukan disisipkan mentah');
}

// 6. Paket tanpa preset yang cocok disebut Custom
{
  // 'lms' saja justru preset LMS Lite; kombinasi ini sengaja tidak cocok apa pun.
  const custom = { ...poDasar, po_komponen: [
    { komponen_id: 'lms', sesi: 1 }, { komponen_id: 'tryout', sesi: 3 },
  ] };
  const d = D.dataSuratDariPo(custom, empatHijau, 'X');
  assert.ok(d.keterangan.startsWith('Paket Custom'), 'paket tak dikenal tidak disebut Custom');
  ok('kombinasi di luar preset disebut Paket Custom');
}

// 7. Varian otomatis: sistem yang mengkonfirmasi, HoO dan Tech Ops Lead diinformasikan
{
  const po = { ...poDasar, diverifikasi_otomatis: true };
  const d = D.dataSuratDariPo(po, [], 'Sistem Skolla', undefined, 'iom-2026-09-22');
  assert.deepEqual(d.otomatis, { versiIom: 'iom-2026-09-22' }, 'varian otomatis tidak aktif');
  const h = S.dokumenSurat(d);
  assert.ok(h.includes('diterbitkan otomatis oleh sistem Skolla'), 'pembuka otomatis tidak menyebut sistem');
  assert.ok(h.includes('ketentuan IoM iom-2026-09-22'), 'versi IoM tidak tercetak');
  assert.ok(h.includes('diinformasikan kepada Head of Operations dan Tech Ops Lead'),
    'pihak yang diinformasikan tidak disebut');
  // Kalimat "dari sisi ..." hanya bermakna bila ada fungsi yang memutuskan. Pada PO otomatis
  // daftarnya kosong, dan mencetaknya menghasilkan "dari sisi  untuk" — cacat yang dulu
  // membuat surat otomatis ditahan sepenuhnya.
  assert.ok(!h.includes('dari sisi'), '"dari sisi" tercetak padahal tidak ada fungsi yang memutuskan');
  assert.ok(!h.includes('selaku TechOps Lead'), 'surat otomatis masih mengaku ditandatangani TechOps Lead');
  assert.ok(!h.includes('Hormat kami'), 'surat otomatis masih memuat blok tanda tangan');
  ok('varian otomatis: sistem yang mengkonfirmasi, HoO dan Tech Ops Lead diinformasikan, tanpa tanda tangan');
}

// 8. Tanpa versi IoM, varian otomatis TIDAK dipakai
{
  const po = { ...poDasar, diverifikasi_otomatis: true };
  const d = D.dataSuratDariPo(po, empatHijau, 'X');
  assert.equal(d.otomatis, undefined,
    'varian otomatis menyala tanpa versi IoM: suratnya akan menyebut "otomatis" tanpa menyebut aturan mana yang berlaku');
  ok('varian otomatis menuntut versi IoM; tanpa itu surat kembali ke jalur biasa');
}

console.log(`\n${n} pemeriksaan lolos.`);
