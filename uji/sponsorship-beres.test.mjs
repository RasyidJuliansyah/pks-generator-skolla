// Syarat sponsorship di lib/sponsorship.ts: apakah sebuah PO bersponsorship, dan apakah
// konfirmasi Finance untuknya sudah berlaku (catatan/22).
//
// Yang dijaga di sini adalah kegagalan yang TIDAK bersuara. Syaratnya dipakai tiga tempat
// sekaligus — kotak konfirmasi di halaman PKS, peringatan di halaman PO, dan antrean Finance
// di daftar PKS — sementara gerbang yang sungguhan menolak ada di `public.unggah_pks_basah`.
// Salinan yang melenceng tidak memunculkan galat apa pun: yang terjadi hanyalah PO yang
// hilang dari antrean, atau Sales yang baru tahu di langkah terakhir. Tidak ada yang
// menangkapnya selain uji ini.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { adaSponsorship, konfirmasiBeres } = muat('sponsorship');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const catatan = (...isi) => isi.map((x) => ({ jenis: 'sponsorship', isi: x }));

// --- adaSponsorship: cerminan `v_sponsor` di public.unggah_pks_basah ---

assert.equal(adaSponsorship({ po_catatan: catatan('Sponsor Bank X'), nilai_sponsorship: 0 }), true);
ok('catatan berisi tanpa nilai tetap bersponsorship — PO lama wajib dikonfirmasi dokumennya');

assert.equal(adaSponsorship({ po_catatan: [], nilai_sponsorship: 5_000_000 }), true);
ok('nilai terisi tanpa catatan bersponsorship');

assert.equal(adaSponsorship({ po_catatan: catatan('   '), nilai_sponsorship: 0 }), false);
assert.equal(adaSponsorship({ po_catatan: catatan(null), nilai_sponsorship: 0 }), false);
ok('catatan kosong atau berisi spasi saja bukan sponsorship');

// Gerbang unggah memakai Postgres `btrim`, yang membuang SPASI saja. Tab, baris baru, dan
// spasi tak-terpisah BUKAN kosong baginya, jadi PO seperti itu tetap ditolak basis data dan
// wajib muncul di antrean Finance. Tiga asersi ini ada karena `isi.trim()` sempat dipakai di
// sini: `trim()` JavaScript membuang ketiganya, sehingga PO yang pasti ditolak justru hilang
// dari antrean — diam-diam, dan hanya pada PO lama yang ditulis lewat PostgREST.
for (const [nama, isi] of [['tab', '\t'], ['baris baru', '\n'], ['spasi tak-terpisah', '\u00a0']])
  assert.equal(adaSponsorship({ po_catatan: catatan(isi), nilai_sponsorship: 0 }), true,
    `catatan berisi ${nama} saja terbaca kosong, padahal btrim basis data menganggapnya berisi`);
ok('tab, baris baru, dan spasi tak-terpisah tetap terbaca berisi — sama seperti btrim');

assert.equal(adaSponsorship({
  po_catatan: [{ jenis: 'pelaksanaan', isi: 'Kegiatan dimulai Oktober' }],
  nilai_sponsorship: null,
}), false);
ok('catatan pelaksanaan bukan sponsorship');

// `po_catatan` ber-PK (po_id, jenis), jadi satu PO bisa membawa baris 'pelaksanaan' DAN
// 'sponsorship' sekaligus, dan urutan embeds tidak dijamin PostgREST. Syaratnya harus
// memeriksa seluruh baris — versi yang cuma melihat baris pertama tetap hijau tanpa asersi
// dua arah di bawah ini.
assert.equal(adaSponsorship({
  po_catatan: [
    { jenis: 'pelaksanaan', isi: 'Kegiatan dimulai Oktober' },
    ...catatan('Sponsor Bank X'),
  ],
  nilai_sponsorship: 0,
}), true);
assert.equal(adaSponsorship({
  po_catatan: [
    ...catatan('Sponsor Bank X'),
    { jenis: 'pelaksanaan', isi: 'Kegiatan dimulai Oktober' },
  ],
  nilai_sponsorship: 0,
}), true);
ok('baris sponsorship ditemukan di mana pun ia berada dalam larik catatan');

assert.equal(adaSponsorship({}), false);
assert.equal(adaSponsorship({ po_catatan: null, nilai_sponsorship: null }), false);
assert.equal(adaSponsorship({ po_catatan: null, nilai_sponsorship: 0 }), false);
ok('tanpa catatan dan tanpa nilai bukan sponsorship');

// --- konfirmasiBeres ---

const lengkap = {
  versi_po: 4,
  form_ditandatangani: true,
  rekening_atas_nama_lembaga: true,
  meterai_bila_di_atas_5juta: true,
};

assert.equal(konfirmasiBeres(lengkap, 4), true);
ok('ketiga centang dengan versi yang cocok = berlaku');

for (const k of ['form_ditandatangani', 'rekening_atas_nama_lembaga', 'meterai_bila_di_atas_5juta'])
  assert.equal(konfirmasiBeres({ ...lengkap, [k]: false }, 4), false, `${k} tidak dituntut`);
ok('satu centang yang kosong saja membuat konfirmasi belum beres');

// Yang paling mahal kalau melenceng: PO direvisi sehingga versinya naik, lalu konfirmasi
// lamanya diam-diam tetap terbaca berlaku — sementara gerbang unggah di basis data menolak,
// karena di sana yang dibandingkan `d.versi_po = p.versi`. Akibatnya Sales tertahan tanpa
// sebab yang terlihat di layar.
assert.equal(konfirmasiBeres({ ...lengkap, versi_po: 3 }, 4), false);
ok('konfirmasi untuk versi PO yang lama TIDAK berlaku');

// Arah sebaliknya ikut dituntut, walaupun tidak wajar: gerbang basis data membandingkan
// KESAMAAN versi (`d.versi_po = p.versi`), bukan urutan. Versi yang lebih baru pun tidak
// berlaku, dan versi yang cuma memakai `<` di sini tetap hijau tanpa asersi ini.
assert.equal(konfirmasiBeres({ ...lengkap, versi_po: 5 }, 4), false);
ok('konfirmasi untuk versi PO yang lebih baru pun TIDAK berlaku');

assert.equal(konfirmasiBeres(null, 4), false);
assert.equal(konfirmasiBeres(undefined, 4), false);
ok('belum ada konfirmasi berarti belum beres');

console.log(`\n${n} pemeriksaan lolos.`);
