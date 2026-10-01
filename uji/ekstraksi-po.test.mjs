// Pemetaan hasil baca AI ke isian wizard (catatan/17 + amandemen 2). Murni: tanpa pricelist,
// tanpa jaringan. Himpunan ids paket disuntikkan, seperti di aplikasi.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muat } from './muat.mjs';

const E = muat('ekstraksi-po');

const idsPaket = (nama) => ({ 'LMS Juara': ['lms', 'modul', 'video'], 'LMS Lite': ['lms'] }[nama] ?? null);
const dummy = JSON.parse(readFileSync(new URL('./emas/ekstraksi-dummy.json', import.meta.url), 'utf8'));

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 1. Kotak paket jelas -> himpunan ids paket itu PERSIS, tidak ditambah harga berkelompok.
const h = E.petakanEkstraksi(dummy, { idsPaket });
assert.deepEqual(h.komponen, [{ id: 'lms', sesi: 0 }, { id: 'modul', sesi: 0 }, { id: 'video', sesi: 0 }]);
ok('satu kotak paket jelas mengisi komponen persis himpunan paketnya');

// 2. Dua kotak jelas atau kotak tak dikenal: tanpa komponen, tampil sebagai catatan.
const dua = E.petakanEkstraksi({ ...dummy, kotak_paket: ['LMS Juara', 'LMS Lite'] }, { idsPaket });
assert.equal(dua.komponen, null);
assert.match(dua.catatanPaket, /LMS Juara/);
const asing = E.petakanEkstraksi({ ...dummy, kotak_paket: ['Paket Karangan'] }, { idsPaket });
assert.equal(asing.komponen, null);
assert.match(asing.catatanPaket, /Paket Karangan/);
ok('dua kotak atau kotak asing: komponen kosong, alasannya tampil sebagai catatan');

// 3. Kotak lain tampil sebagai catatan, Custom disertakan apa adanya.
const lain = E.petakanEkstraksi({ ...dummy, kotak_paket: [], kotak_lain: ['UTBK'], custom_teks: 'PM OFFLINE' }, { idsPaket });
assert.equal(lain.komponen, null);
assert.match(lain.catatanPaket, /UTBK/);
assert.match(lain.catatanPaket, /PM OFFLINE/);
ok('kotak lain dan teks Custom tampil sebagai catatan langkah 2');

// 4. Rombel: X/XI/XII diurai ke angka kelas SMA; baris di luar jenjang dibuang.
assert.deepEqual(h.rombel, [
  { kelas: 10, rombel: 'A', jumlah: 32 },
  { kelas: 11, rombel: 'A', jumlah: 30 },
  { kelas: 12, rombel: 'B', jumlah: 28 },
]);
const luar = E.petakanEkstraksi({ ...dummy, rombel: [{ kelas: 'VII', rombel: 'A', jumlah: 30 }] }, { idsPaket });
assert.deepEqual(luar.rombel, []);
ok('rombel di luar jenjang dibuang, bukan ditebak');

// 4b. Angka kelas yang sah untuk jenjang LAIN juga dibuang: SD tidak punya kelas 10, dan
// sebaliknya. Tanpa ini, satu kelas yang salah baca menambah baris rombel yang tidak ada.
const sd = E.petakanEkstraksi({ ...dummy, sekolah: { ...dummy.sekolah, jenjang: 'SD' },
  rombel: [{ kelas: '10', rombel: 'A', jumlah: 30 }, { kelas: '3', rombel: 'A', jumlah: 30 }] }, { idsPaket });
assert.deepEqual(sd.rombel, [{ kelas: 3, rombel: 'A', jumlah: 30 }]);
ok('kelas yang tidak ada di jenjangnya dibuang (SD tanpa kelas 10)');

// 5. Nilai tidak sah dibuang dengan keterangan "tidak terbaca", bukan ditebak.
const rusak = E.petakanEkstraksi({
  ...dummy, tanggal_ttd: '31 Februari', harga_siswa: 'tiga ratus',
  sekolah: { ...dummy.sekolah, jenjang: 'SMK' },
}, { idsPaket });
assert.equal(rusak.lain.tanggalTtd, null);
assert.equal(rusak.harga.siswa, null);
// Jenjang di luar SD/SMP/SMA dibuang, TIDAK ditebak jadi SMA: wizard tetap memakai bawaannya.
assert.equal(rusak.sekolah.jenjang, undefined);
assert.ok(rusak.tidakTerbaca.includes('sekolah.jenjang'));
ok('tanggal ngawur, nominal bukan angka, jenjang di luar SD/SMP/SMA dibuang');

// 5b. Tanggal yang bentuknya benar tapi harinya tidak ada (31 Februari) ditolak `Date`.
const kabisat = E.petakanEkstraksi({ ...dummy, masa_mulai: '2026-02-30' }, { idsPaket });
assert.equal(kabisat.lain.masaMulai, null);
ok('tanggal ISO yang harinya tidak ada dibuang');

// 6. Jenis catatan SELALU kosong: AI mengisi isinya, Sales yang memilih jenisnya.
assert.deepEqual(h.catatan, [{ isi: 'Pelaksanaan dimulai Januari', jenis: null }]);
ok('jenis catatan selalu kosong dari hasil baca');

// 7. Nomor HP selalu wajib dicentang, ditandai ragu atau tidak; isian ragu ikut dituntut.
const tuntut = E.wajibDicentang(h);
for (const k of E.HP_KEYS) assert.ok(tuntut.includes(k), `${k} harus dituntut`);
assert.ok(tuntut.includes('sekolah.email'), 'isian tidak terbaca harus dituntut');
ok('nomor HP dan isian ragu/tidak terbaca selalu dituntut centangnya');

// 8. Tanda ragu dan peringatan diteruskan apa adanya.
assert.deepEqual(h.ragu, ['sekolah.bendahara_hp']);
assert.equal(h.peringatan.length, 1);
ok('tanda ragu dan peringatan AI diteruskan ke layar');

// 8b. Tanggal selesai yang mendahului mulai: model sudah diminta menandainya, tetapi kalau ia
// lupa, layarnya tetap memberi tahu. Peringatan AI TIDAK diganti, hanya ditambah.
const terbalik = E.petakanEkstraksi({ ...dummy, masa_mulai: '2026-12-31', masa_selesai: '2026-01-01' }, { idsPaket });
assert.equal(terbalik.peringatan.length, 2);
assert.match(terbalik.peringatan[1], /selesai tidak sesudah/);
ok('tanggal terbalik memunculkan peringatan turunan');

// 9. Nilai sponsorship TIDAK PERNAH diisi dari scan.
assert.equal(h.lain.nilaiSponsorship, undefined);
ok('nilai sponsorship tidak pernah datang dari hasil baca');

// 10. Langkah isian: lima langkah yang memuat isian dari scan, urut wizard.
assert.deepEqual(E.langkahIsian(h).map((x) => x.langkah),
  ['sekolah', 'paket', 'rombel', 'termin', 'penanda']);
ok('lima langkah memuat isian dari scan, urut seperti wizard');

// 11. Hasil baca yang sama sekali tidak sesuai skema tidak melempar.
const kosong = E.petakanEkstraksi('bukan objek', { idsPaket });
assert.deepEqual(kosong.dariScan, []);
ok('hasil tidak sesuai skema menghasilkan pemetaan kosong, bukan galat');

// 12. Paket yang dikenali tetapi komposisinya tidak ada: komponen kosong, alasannya tampil.
const tanpaIds = E.petakanEkstraksi(dummy, { idsPaket: () => null });
assert.equal(tanpaIds.komponen, null);
assert.match(tanpaIds.catatanPaket, /LMS Juara/);
ok('paket tanpa komposisi tidak diisi komponennya, hanya jadi catatan');

// 13. Tambalan wizard: hasil baca HARUS benar-benar sampai ke isian. Pemetaan yang benar tetapi
// tidak pernah dituliskan ke isian adalah fitur yang tidak ada -- layarnya tetap kosong.
const t = E.tambalanWizard(h);
assert.equal(t.sekolah.nama, 'SMA DUMMY NUSANTARA');
assert.deepEqual(t.komponen, [{ id: 'lms', sesi: 0 }, { id: 'modul', sesi: 0 }, { id: 'video', sesi: 0 }]);
assert.equal(t.hargaSiswa, 350000);
assert.equal(t.hargaGuru, 0);
assert.deepEqual(t.rombel, h.rombel);
assert.equal(t.nRombel, 2);
assert.equal(t.termin.length, 2);
assert.equal(t.masaMulai, '2026-01-01');
assert.equal(t.masaSelesai, '2026-12-31');
assert.equal(t.kota, 'Surabaya');
assert.equal(t.tanggalTtd, '2026-01-10');
assert.deepEqual(t.catatan, h.catatan);
ok('tambalan wizard memuat seluruh isian yang harus ditulis ke form');

// 14. Yang TIDAK terbaca bernilai null = JANGAN disentuh, bukan "kosongkan": model yang tidak
// membaca sebuah isian tidak boleh menghapus apa yang sudah diketik Sales.
const kosongT = E.tambalanWizard(E.petakanEkstraksi({}, { idsPaket }));
assert.equal(kosongT.hargaSiswa, null);
assert.equal(kosongT.hargaGuru, null);
assert.equal(kosongT.masaMulai, null);
assert.equal(kosongT.nRombel, null);
assert.equal(kosongT.sumberDana, null);
assert.equal(kosongT.komponen, null);
assert.deepEqual(kosongT.rombel, []);
assert.deepEqual(kosongT.sekolah, {});
ok('isian yang tidak terbaca tidak menghapus isian yang sudah ada');

// 15. Sumber dana di kertas tidak selalu salah satu dari tiga pilihan wizard. Yang dikenal
// dipakai apa adanya; yang asing jadi "Lainnya" BERIKUT teksnya -- bukan dipaksa "BOS" (salah,
// dan tampak sah) dan bukan dibuang (hilang tanpa jejak).
assert.equal(E.tambalanWizard(E.petakanEkstraksi({ sumber_dana: 'BOS' }, { idsPaket })).sumberDana, 'BOS');
const asingDana = E.tambalanWizard(E.petakanEkstraksi({ sumber_dana: 'Komite Sekolah' }, { idsPaket }));
assert.equal(asingDana.sumberDana, 'Lainnya');
assert.equal(asingDana.sumberDanaLain, 'Komite Sekolah');
ok('sumber dana asing jadi "Lainnya" berikut teksnya');

console.log(`\n${n} pemeriksaan lolos.`);
