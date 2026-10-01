// Mesin aturan IoM (catatan/13a). Setiap aturan diuji dua sisi: PO yang
// memenuhi semuanya lolos, dan merusak satu hal menggagalkan PERSIS aturan itu.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { nilai, nilaiAman, VERSI_IOM, BUTIR_DEKLARASI } = muat('iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Angka rekaan: yang diuji aturannya, bukan harganya.
const KOMPONEN = [
  { id: 'lms', grup: 'core', untukGuru: false, perSesi: false, priceList: 100, bottom: 60 },
  { id: 'modul', grup: 'core', untukGuru: false, perSesi: false, priceList: 20, bottom: 10 },
  { id: 'live', grup: 'core', untukGuru: false, perSesi: false, priceList: 30, bottom: 20 },
  { id: 'psiOff', grup: 'addon', untukGuru: false, perSesi: true, priceList: 50, bottom: 40 },
  { id: 'guruOff', grup: 'addon', untukGuru: true, perSesi: true, priceList: 70, bottom: 50 },
];
const PAKET = [
  { nama: 'Paket Uji', ids: ['lms', 'modul'], priceList: 110, bottom: 65 },
  { nama: 'Paket Live', ids: ['lms', 'live'], priceList: 120, bottom: 70 },
];
const DEKLARASI = [
  { produk: 'Paket Uji', butir: [...BUTIR_DEKLARASI], berlakuSampai: '2027-03-17' },
  { produk: 'Paket Live', butir: [...BUTIR_DEKLARASI], berlakuSampai: '2027-03-17' },
];
const HARI = '2026-09-17';

const lolos = () => ({
  versiIom: VERSI_IOM, asal: 'platform',
  sekolah: { nama: 'SMA Uji', npsn: '12345678', kepala_sekolah: 'Kepala Uji', kepsek_hp: '0800',
    bendahara: 'Bendahara Uji', bendahara_hp: '0801' },
  komponen: [{ id: 'lms', sesi: 1 }, { id: 'modul', sesi: 1 }],
  jumlahKelompok: 0, jumlahSiswa: 100, jumlahGuru: 0,
  hargaSiswa: 110, hargaGuru: 0, grandTotal: 11000,
  masaMulai: '2026-10-01', masaSelesai: '2027-09-30',
  termin: [{ nominal: 5000 }, { nominal: 6000 }],
  berkasUnggahan: null, ditinjauPada: null,
  adaPengecualianHoo: false, catatanSponsorship: false, nilaiSponsorship: null,
  permintaanTambahan: false,
});
const nilaiDari = (f, dek = DEKLARASI) => nilai(f, KOMPONEN, PAKET, dek, HARI);

const v = nilaiDari(lolos());
assert.equal(v.lolos, true, JSON.stringify(v.gagal));
assert.equal(v.paket, 'Paket Uji');
assert.equal(v.versiIom, VERSI_IOM);
ok('PO yang memenuhi semua aturan lolos, paketnya dikenali');

// Setiap baris: merusak satu hal harus menggagalkan aturan yang disebut.
const kasus = [
  ['po-berstempel-iom', (f) => { f.versiIom = null; }],
  ['sekolah-terisi', (f) => { f.sekolah.nama = '  '; }],
  ['komponen-dikenal', (f) => { f.komponen.push({ id: 'hantu', sesi: 1 }); }],
  ['jumlah-siswa-minimal', (f) => { f.jumlahSiswa = 0; f.grandTotal = 0; f.termin = [{ nominal: 0 }]; }],
  ['minimal-peserta', (f) => { f.komponen = [{ id: 'lms', sesi: 1 }, { id: 'live', sesi: 1 }];
    f.jumlahSiswa = 10; f.hargaSiswa = 120; f.grandTotal = 1200; f.termin = [{ nominal: 1200 }]; }],
  ['kapasitas-sesi', (f) => { f.komponen.push({ id: 'psiOff', sesi: 1 }); }],
  ['termin-sama-total', (f) => { f.termin = []; }],
  ['termin-sama-total', (f) => { f.termin = [{ nominal: 1 }]; }],
  ['unggahan-ditinjau', (f) => { f.asal = 'unggahan'; f.berkasUnggahan = 'x/po.pdf'; }],
  ['masa-aktif-lengkap', (f) => { f.masaSelesai = null; }],
  ['masa-aktif-wajar', (f) => { f.masaSelesai = f.masaMulai; }],
  ['sekolah-lengkap', (f) => { f.sekolah.bendahara_hp = ''; }],
  ['kelompok-terdefinisi', (f) => { f.jumlahKelompok = 2; }],
  ['paket-persis', (f) => { f.komponen.push({ id: 'guruOff', sesi: 1 }); f.jumlahGuru = 10; }],
  ['layanan-sesuai-paket', (f) => { f.komponen = [{ id: 'lms', sesi: 1 }]; }],
  ['tanpa-diskon', (f) => { f.hargaSiswa = 109; f.grandTotal = 10900; f.termin = [{ nominal: 10900 }]; }],
  ['lantai-siswa', (f) => { f.hargaSiswa = 64; f.grandTotal = 6400; f.termin = [{ nominal: 6400 }]; }],
  ['tanpa-pengecualian-hoo', (f) => { f.adaPengecualianHoo = true; }],
  ['sponsorship-dalam-batas', (f) => { f.catatanSponsorship = true; }],
  ['tanpa-permintaan-tambahan', (f) => { f.permintaanTambahan = true; }],
];
for (const [kode, rusak] of kasus) {
  const f = lolos();
  rusak(f);
  const h = nilaiDari(f);
  assert.equal(h.lolos, false, `${kode}: masih lolos`);
  assert.ok(h.gagal.includes(kode), `${kode}: tidak ada di gagal ${JSON.stringify(h.gagal)}`);
}
ok(`${kasus.length} perusakan: masing-masing menggagalkan aturannya sendiri`);

// --- PO berkelompok: dinilai per kelompok, boleh lolos otomatis -----------------
//
// Keputusan Rizki 22 Sep 2026 (catatan/13a Bagian 9) menggantikan "PO berkelompok selalu
// manual". Harga per kelompok tinggal di po_kelompok dan `po.harga_siswa` sendiri 0, jadi
// menilai nol itu terhadap bottom/price list melahirkan kegagalan palsu (temuan PO-344,
// 21 Sep 2026). Sekarang TIAP KELOMPOK dinilai sendiri: komponennya persis satu paket, ada
// deklarasi berlaku untuk paket itu, dan harganya >= bottom paketnya.
const berkelompok = (kelompok, lain = {}) => {
  const f = lolos();
  f.jumlahKelompok = kelompok.length;
  f.hargaSiswa = 0;               // persis seperti yang tersimpan di produksi
  f.kelompok = kelompok;
  f.komponen = kelompok.flatMap((k) => k.komponen);  // union, seperti po_komponen
  Object.assign(f, lain);
  return f;
};
const BAIK = [
  { nomor: 1, hargaSiswa: 110, komponen: [{ id: 'lms' }, { id: 'modul' }] },  // Paket Uji
  { nomor: 2, hargaSiswa: 120, komponen: [{ id: 'lms' }, { id: 'live' }] },   // Paket Live
];

{
  const h = nilaiDari(berkelompok(BAIK));
  assert.deepEqual(h.gagal, [], `PO berkelompok yang patuh harus lolos, bukan ${JSON.stringify(h.gagal)}`);
  assert.equal(h.paket, null, 'dua paket berbeda tidak bisa diwakili satu nama');
  assert.deepEqual(h.paketDipakai, ['Paket Live', 'Paket Uji']);
  ok('PO berkelompok dengan tiap kelompok = paket & harga wajar LOLOS otomatis');
}

// Harga per kelompok di bawah price list TAPI masih >= bottom TIDAK memaksa manual:
// po_kelompok memang cara resmi memberi harga berbeda per kelompok (keputusan Rizki
// 22 Sep 2026). PO-344 nyata seperti ini (Juara 258k vs list 350k).
{
  const h = nilaiDari(berkelompok([
    { nomor: 1, hargaSiswa: 100, komponen: [{ id: 'lms' }, { id: 'modul' }] },  // < 110, >= 65
    { nomor: 2, hargaSiswa: 120, komponen: [{ id: 'lms' }, { id: 'live' }] },
  ]));
  assert.deepEqual(h.gagal, [], `diskon per kelompok sebatas bottom harus lolos, bukan ${JSON.stringify(h.gagal)}`);
  assert.match(h.hasil.find((x) => x.kode === 'tanpa-diskon').bukti, /diskon per kelompok diizinkan/);
  ok('diskon per kelompok sebatas bottom price lolos otomatis (keputusan 22 Sep 2026)');
}

// Merusak satu kelompok harus menggagalkan aturan yang tepat, berikut bukti yang menyebut
// kelompoknya — supaya Sales tahu KELOMPOK mana yang perlu diperiksa.
{
  const h = nilaiDari(berkelompok([BAIK[0], { nomor: 2, hargaSiswa: 120, komponen: [{ id: 'lms' }] }]));
  assert.ok(h.gagal.includes('paket-persis'), 'komponen kelompok bukan paket harus gagal');
  assert.match(h.hasil.find((x) => x.kode === 'paket-persis').bukti, /Paket Uji \+ bukan paket persis/);
  ok('kelompok yang komponennya bukan paket digagalkan paket-persis, berikut buktinya');
}
{
  const h = nilaiDari(berkelompok([
    { nomor: 1, hargaSiswa: 64, komponen: [{ id: 'lms' }, { id: 'modul' }] },  // < bottom 65
    BAIK[1],
  ]));
  assert.ok(h.gagal.includes('lantai-siswa'));
  assert.match(h.hasil.find((x) => x.kode === 'lantai-siswa').bukti, /kelompok 1 \(Paket Uji\) 64 vs bottom 65/);
  ok('harga satu kelompok di bawah bottom menggagalkan lantai-siswa dengan bukti per kelompok');
}
{
  const h = nilaiDari(berkelompok([BAIK[0], BAIK[1]]), [DEKLARASI[0]]);
  assert.ok(h.gagal.includes('deklarasi-berlaku'), 'paket tanpa deklarasi harus gagal');
  assert.match(h.hasil.find((x) => x.kode === 'deklarasi-berlaku').bukti, /tidak ada deklarasi Paket Live/);
  ok('deklarasi hilang untuk salah satu paket kelompok menggagalkan deklarasi-berlaku');
}
{
  // jumlahKelompok bilang 2 tapi barisnya tidak terbaca: penjaga himpunan, bukan diam-diam
  // menilai kosong lalu lolos.
  const f = lolos();
  f.jumlahKelompok = 2;
  const h = nilaiDari(f);
  assert.ok(h.gagal.includes('kelompok-terdefinisi'), 'kelompok tak terbaca harus ditolak');
  assert.match(h.hasil.find((x) => x.kode === 'kelompok-terdefinisi').bukti, /2 baris kelompok, 0 terbaca/);
  ok('PO berkelompok tanpa baris kelompok terbaca digagalkan kelompok-terdefinisi');
}

// PO satu kelompok TIDAK berubah perilakunya: harga dinilai dari po.harga_siswa seperti dulu.
{
  const h = nilaiDari(lolos());
  assert.equal(h.paket, 'Paket Uji');
  assert.deepEqual(h.paketDipakai, ['Paket Uji']);
  assert.match(h.hasil.find((x) => x.kode === 'lantai-siswa').bukti, /110 vs bottom 65/);
  ok('PO satu kelompok tetap dinilai dari harga siswa PO, paket tunggal');
}

// Deklarasi: tidak ada, kedaluwarsa, butir kurang. Hari terakhir masih berlaku.
assert.ok(nilaiDari(lolos(), []).gagal.includes('deklarasi-berlaku'));
assert.ok(nilaiDari(lolos(), [{ ...DEKLARASI[0], berlakuSampai: '2026-09-16' }]).gagal.includes('deklarasi-berlaku'));
assert.ok(nilaiDari(lolos(), [{ ...DEKLARASI[0], butir: BUTIR_DEKLARASI.slice(1) }]).gagal.includes('deklarasi-berlaku'));
assert.equal(nilaiDari(lolos(), [{ ...DEKLARASI[0], berlakuSampai: HARI }]).lolos, true);
ok('deklarasi wajib ada, lengkap sepuluh butir, dan belum lewat berlakuSampai');

// --- sponsorship-dalam-batas (catatan/18) ---
// grandTotal baku 11000, jadi batasnya 1650. Rumusnya bilangan bulat:
// nilai * 100 <= grandTotal * 15, supaya pembulatan tidak pernah ikut menentukan.
{
  const sp = (catatan, nilaiSp, ubah = () => {}) => {
    const f = lolos();
    f.catatanSponsorship = catatan;
    f.nilaiSponsorship = nilaiSp;
    ubah(f);
    return nilaiDari(f);
  };
  const kode = 'sponsorship-dalam-batas';

  assert.equal(sp(false, null).lolos, true, 'tanpa sponsorship harus lolos');
  assert.equal(sp(true, 1650).lolos, true, 'tepat 15% harus lolos');
  assert.ok(sp(true, 1651).gagal.includes(kode), 'satu Rupiah di atas batas harus gagal');
  assert.ok(sp(true, null).gagal.includes(kode), 'catatan tanpa nilai harus gagal');
  assert.ok(sp(true, 0).gagal.includes(kode), 'catatan dengan nilai 0 harus gagal');
  assert.ok(sp(false, 1000).gagal.includes(kode), 'nilai tanpa catatan harus gagal');

  // Grand total 0 dengan nilai > 0: 100*nilai > 0, jadi gagal tanpa pembagian nol.
  assert.ok(sp(true, 1, (f) => { f.grandTotal = 0; f.termin = [{ nominal: 0 }]; })
    .gagal.includes(kode), 'grand total 0 dengan nilai > 0 harus gagal');

  const bukti = sp(true, 1650).hasil.find((h) => h.kode === kode).bukti;
  assert.match(bukti, /Rp1\.650/, 'bukti harus memuat nominalnya');
  assert.match(bukti, /15,0%/, 'bukti harus memuat persennya');
  assert.match(bukti, /batas Rp1\.650/, 'bukti harus memuat batasnya');

  const buktiPasangan = sp(true, null).hasil.find((h) => h.kode === kode).bukti;
  assert.match(buktiPasangan, /tidak berpasangan/, 'catatan tanpa nilai: buktinya menyebut sebabnya');
}
ok('sponsorship: tanpa, tepat 15%, lebih satu Rupiah, tidak berpasangan, grand total 0, dan bunyi buktinya');

assert.deepEqual([...BUTIR_DEKLARASI], ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c2', 'd3', 'e3', 'e4']);
ok('sepuluh butir deklarasi sesuai 13a Bagian 3');

const rusak = lolos(); rusak.komponen = null;
const aman = nilaiAman(rusak, KOMPONEN, PAKET, DEKLARASI, HARI);
assert.equal(aman.lolos, false);
assert.deepEqual(aman.gagal, ['galat-evaluasi']);
ok('galat evaluasi berarti tidak lolos (fail-closed)');

const sumber = readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8');
assert.ok(!/import\s+(?!type\b)[^;]*from\s+'\.\/pricelist'/.test(sumber),
  'lib/iom.ts mengimpor NILAI dari pricelist: harga Acquisition bisa ikut terbawa');
ok('lib/iom.ts hanya mengimpor tipe dari pricelist');

console.log(`\n${n} pemeriksaan lolos.`);
