// Mengunci jumlah komponen tiap paket. Angka ini DULU disalin dari tab "Skolla Package
// 2026" sebagai pembanding merdeka. Pricelist 3.0 cuma punya satu tab dan tidak memuat
// angka paket, jadi sejak 31 Agu 2026 angka di bawah DIHITUNG dari KOMPONEN — uji ini
// tidak lagi membuktikan harga komponennya benar, ia menahan angka paket supaya
// suntingan satu komponen yang tak disengaja langsung ketahuan. Kalau tab paket
// terbit lagi, kembalikan angkanya ke sumber merdeka itu.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const ts = readFileSync(new URL('../lib/pricelist.ts', import.meta.url), 'utf8');
const ambil = (nama, bukaKurung = '[', src = ts) => {
  const i = src.indexOf(nama);
  // indexOf('= [', -1) dijepit ke 0 dan diam-diam mengambil array pertama di berkas,
  // jadi penanda yang hilang HARUS ditangkap di sini, bukan dibiarkan lolos.
  assert.notEqual(i, -1, `penanda "${nama}" tidak ada di berkas sumbernya — parser uji ini perlu diperbarui`);
  // Cari kurung milik nilainya, bukan '[' dari anotasi tipe `Komponen[]` atau
  // '{' dari `Record<string, { ... }>` — makanya dicari lewat '= ' dulu.
  const tutupKurung = bukaKurung === '[' ? ']' : '}';
  const buka = src.indexOf(bukaKurung, src.indexOf('= ' + bukaKurung, i));
  let d = 0, j = buka;
  for (; j < src.length; j++) {
    if (src[j] === bukaKurung) d++;
    else if (src[j] === tutupKurung && --d === 0) break;
  }
  return eval('(' + src.slice(buka, j + 1) + ')');
};

const KOMPONEN = ambil('export const KOMPONEN');
const PRESET = ambil('export const PRESET');

// Angka paket RESMI (IoM) dari tab "Skolla Package 2026 Paket Penjualan" — sumber
// pembanding merdeka, disalin tangan. Sengaja TIDAK sama dengan HARAP_JUMLAH: paket
// dihargai sebagai bundel, a la carte dijumlah dari komponen 4.0.
const HARAP_PAKET = {
  'LMS Juara':               [350000, 186000, 123000],
  'LMS Smart':               [240000, 135000,  88000],
  'LMS Lite':                [100000,  66000,  43000],
  'Bimbel UTBK/TKA Premium': [285000, 120000,  80000],
  'Bimbel UTBK/TKA Lite':    [150000,  99000,  66000],
  'Asesmen Psikologi':       [ 75000,  50000,  10000],
  'Tryout':                  [ 25000,  20000,   9000],
};

const HARAP = {
  'LMS Juara':               [340000, 229000, 123000],
  'LMS Smart':               [204000, 135000,  88000],
  'LMS Lite':                [100000,  66000,  43000],
  'Bimbel UTBK/TKA Premium': [240000, 163000,  80000],
  'Bimbel UTBK/TKA Lite':    [208000, 142000,  66000],
  'Asesmen Psikologi':       [ 75000,  50000,  10000],
  'Tryout':                  [ 25000,  20000,   9000],
};

assert.ok(KOMPONEN.length > 0, 'KOMPONEN kosong — parser berkas uji rusak');
assert.ok(PRESET.length > 0, 'PRESET kosong — parser berkas uji rusak');

let n = 0;
for (const p of PRESET) {
  const jumlah = [0, 1, 2].map((i) =>
    p.ids.reduce((a, id) => a + KOMPONEN.find((k) => k.id === id).p[i], 0)
  );
  assert.deepEqual(jumlah, HARAP[p.n], `${p.n}: dapat ${jumlah}, harusnya ${HARAP[p.n]}`);
  console.log(`  OK  ${p.n.padEnd(24)} ${jumlah.join(' / ')}`);
  n++;
}

for (const p of PRESET) {
  assert.deepEqual(p.p, HARAP_PAKET[p.n], `harga paket ${p.n}: dapat ${p.p}`);
}
console.log(`  OK  ${PRESET.length} harga paket cocok dengan tab Paket Penjualan`);

// Hubungan kedua mekanisme, dikunci persis.
//
// Acquisition terurai sempurna di KETUJUH paket. Bottom terurai juga, KECUALI di bundel
// yang memuat Asesmen atau Tryout: pricelist 4.0 menaikkan keduanya ke tarif SATUAN
// (14.000 -> 50.000 dan 13.000 -> 20.000), sedangkan di dalam bundel keduanya tetap
// memakai tarif lamanya. Selisih 43.000 pada LMS Juara, Bimbel Premium, dan Bimbel Lite
// seluruhnya berasal dari situ — bukan angka acak, jadi dihitung ulang di sini.
const TARIF_BUNDEL = { asesmen: 14000, tryout: 13000 };
for (const p of PRESET) {
  const harga = (id) => KOMPONEN.find((k) => k.id === id).p;
  const jml = (i) => p.ids.reduce((a, id) => a + harga(id)[i], 0);

  assert.equal(p.p[2], jml(2), `${p.n}: acquisition paket ${p.p[2]} != jumlah komponen ${jml(2)}`);

  // Paket satu komponen memang dijual satuan, jadi tidak dapat potongan bundel.
  const potongan = p.ids.length === 1 ? 0 : Object.entries(TARIF_BUNDEL)
    .filter(([id]) => p.ids.includes(id))
    .reduce((a, [id, tarif]) => a + (harga(id)[1] - tarif), 0);
  assert.equal(p.p[1], jml(1) - potongan,
    `${p.n}: bottom paket ${p.p[1]} != jumlah komponen ${jml(1)} dikurangi potongan ${potongan}`);

  if (p.ids.length === 1) {
    assert.equal(p.p[0], jml(0), `${p.n}: paket satu komponen harusnya sama dengan komponennya`);
  } else {
    assert.notEqual(p.p[0], jml(0), `${p.n}: price list paket kebetulan sama dengan jumlah komponen`);
  }
}
console.log('  OK  acquisition terurai di 7 paket; bottom terurai kecuali potongan bundel');

// Harga paket mengikuti angka IoM APA ADANYA (Rizki, 9 Sep 2026).
//
// Sempat berlaku aturan "harga paket harus lebih murah daripada membeli komponennya
// satu per satu" (4 Sep 2026), dan tiga paket melanggarnya. Aturan itu DICABUT: yang
// mengikat adalah angka dari tab Paket Penjualan, dan HARAP_PAKET di atas sudah
// menguncinya. Jadi blok ini tidak lagi menuduh apa pun — ia hanya MELAPORKAN selisih,
// supaya angkanya tetap terlihat setiap kali uji dijalankan dan tidak jadi hal yang
// diam-diam terlupakan.
//
// Yang tetap ditegakkan sebagai aturan ada di blok TARIF_BUNDEL di atas: bottom dan
// acquisition tiap paket HARUS terurai jadi komponennya. Keduanya memang terurai rapi,
// jadi pelanggaran di sana berarti ada yang benar-benar salah — bukan kebijakan harga.
{
  const laporan = [];
  for (const p of PRESET) {
    if (p.ids.length === 1) continue;   // paket satu komponen memang selalu sama
    const jml = p.ids.reduce((a, id) => a + KOMPONEN.find((k) => k.id === id).p[0], 0);
    const d = p.p[0] - jml;
    if (d !== 0) laporan.push(`${p.n}: paket ${p.p[0]} vs komponen ${jml} (${d > 0 ? '+' : ''}${d})`);
  }
  console.log(`  ..  selisih price list paket vs jumlah komponen (informasi, bukan aturan):`);
  for (const x of laporan) console.log('      - ' + x);
}

// PM Online menyalin Live Class persis
const pm = KOMPONEN.find((k) => k.id === 'pmOn');
const lc = KOMPONEN.find((k) => k.id === 'live');
assert.deepEqual(pm.p, lc.p, 'PM Online harus sama persis dengan Live Class');
console.log(`  OK  PM Online = Live Class    ${pm.p.join(' / ')}`);

// tidak boleh ada harga yang hilang
const kosong = KOMPONEN.filter((k) => k.p.length !== 3 || k.p.some((v) => v == null));
assert.equal(kosong.length, 0, `harga tidak lengkap: ${kosong.map((k) => k.id)}`);
console.log(`  OK  ${KOMPONEN.length} komponen, semua harga lengkap`);
console.log(`\n${n} preset cocok dengan angka paket.`);

// Cap versi dulu cuma string yang diketik tangan di dua aplikasi: harga berubah,
// cap tetap, dan penjaga dua-salinan itu lolos padahal kedua salinan sudah beda.
// Sekarang capnya dihitung dari harga, jadi yang lupa diperbarui jatuh di sini.
// Harga paket ikut dijaga cap: sejak ia yang menentukan total DAN lantai, bottom paket
// yang melenceng antar-aplikasi adalah persis kegagalan yang cap ini ada untuk mencegah.
// Acquisition tetap DIPOTONG — cap ini terbit di respons publik kalkulator lama.
const capDari = (k, pr) =>
  createHash('sha256').update([
    ...k.map((x) => `${x.id}:${x.p.slice(0, 2).join(',')}`),
    ...pr.map((x) => `paket|${x.n}:${x.p.slice(0, 2).join(',')}`),
  ].join('|')).digest('hex').slice(0, 12);
const versi = ts.match(/VERSI_PRICELIST = '([0-9a-f]+)'/)[1];
assert.equal(versi, capDari(KOMPONEN, PRESET),
  'VERSI_PRICELIST tidak cocok dengan harga — hitung ulang, lalu samakan di KEDUA aplikasi');
console.log(`  OK  cap versi ${versi} cocok dengan harga`);

// ---- cap lengkap: SEMUA yang tidak dijaga VERSI_PRICELIST ----
// VERSI_PRICELIST cuma menghash id + price list + bottom price, karena ia terbit di
// respons publik kalkulator lama dan tersimpan di `po.versi_pricelist`. Yang lolos dari
// situ dan terbukti bisa melenceng diam-diam antar-aplikasi (semuanya dibuktikan lewat
// mutasi di ronde QA):
//   · acquisition price 6 addon yang bukan anggota preset mana pun
//   · field non-harga (s, g, n, sesi, note)
//   · komposisi PRESET — pmOn dan live harganya identik by design, jadi menukar
//     salah satunya di dalam sebuah preset TIDAK menggeser totalnya sama sekali
//   · MIN_PESERTA, KAPASITAS_SESI & ID_GURU, aturan bisnis yang menggerbang pembuatan PO
// KAPASITAS_SESI ikut sejak 22 Sep 2026. Sebelumnya ia SENGAJA dilewatkan karena
// kalkulator lama memang tidak menegakkan batas atas per sesi; sejak kalkulator itu ikut
// menegakkannya, aturan yang berlaku di dua aplikasi wajib punya penjaga.
// Cap ini hidup DI BERKAS UJI SAJA (repo privat) dan TIDAK PERNAH ikut respons publik
// mana pun, juga tidak masuk basis data. Samakan dengan skolla-pricing-calculator.
const aturan = readFileSync(new URL('../lib/aturan-komponen.ts', import.meta.url), 'utf8');
const MIN_PESERTA = ambil('export const MIN_PESERTA', '{', aturan);
const KAPASITAS_SESI = ambil('export const KAPASITAS_SESI', '{', aturan);
const ID_GURU = ambil('export const ID_GURU', '[', aturan);

const CAP_LENGKAP = 'a9512c5cdbbc';
const kanonik = [
  ...KOMPONEN.map((k) => `k|${k.id}|${k.s}|${k.g}|${k.n}|${k.p.join(',')}|${k.sesi ? 1 : 0}|${k.note || ''}`),
  ...PRESET.map((p) => `p|${p.n}|${p.ids.join(',')}|${p.p.join(',')}`),
  // urutan kunci objek tidak bermakna, jadi diurutkan; urutan KOMPONEN & PRESET
  // BERMAKNA (urutan tampil) jadi sengaja dibiarkan apa adanya.
  ...Object.keys(MIN_PESERTA).sort().map((id) => `m|${id}|${MIN_PESERTA[id].n}|${MIN_PESERTA[id].per}`),
  ...Object.keys(KAPASITAS_SESI).sort().map((id) => `s|${id}|${KAPASITAS_SESI[id].n}|${KAPASITAS_SESI[id].per}`),
  `g|${[...ID_GURU].sort().join(',')}`,
].join('\n');
const capLengkap = createHash('sha256').update(kanonik).digest('hex').slice(0, 12);
if (capLengkap !== CAP_LENGKAP) {
  // Cap tunggal tidak memberi tahu APA yang bergeser. Cetak string kanoniknya supaya
  // tinggal dibandingkan baris per baris dengan keluaran repo satunya.
  console.error('\n--- string kanonik di repo ini ---\n' + kanonik + '\n');
}
assert.equal(capLengkap, CAP_LENGKAP,
  'Ada yang berubah di luar price list/bottom — hitung ulang CAP_LENGKAP, lalu samakan di KEDUA aplikasi');
console.log(`  OK  cap lengkap ${capLengkap} cocok (harga+field+preset+MIN_PESERTA+KAPASITAS_SESI+ID_GURU)`);
