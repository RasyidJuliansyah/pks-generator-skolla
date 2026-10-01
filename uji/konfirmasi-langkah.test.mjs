// Aturan konfirmasi per langkah (catatan/17 amandemen 2). Fungsi murni: sisa diturunkan dari
// daftar kunci, sehingga aturannya bisa diuji tanpa peramban.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muat } from './muat.mjs';

const E = muat('ekstraksi-po');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const sisa0 = ['sekolah.nama', 'sekolah.kepsek_hp', 'sekolah.bendahara_hp', 'komponen', 'rombel'];

// Tombol langkah TIDAK bisa ditekan selama centang berisiko di langkah itu belum lengkap.
const terkunci = E.terkunciRisiko(sisa0, 'sekolah');
assert.deepEqual(terkunci.sort(), ['sekolah.bendahara_hp', 'sekolah.kepsek_hp']);
ok('dua nomor HP menahan konfirmasi langkah Sekolah');

const terkunciPaket = E.terkunciRisiko(sisa0, 'paket');
assert.deepEqual(terkunciPaket, []);
ok('langkah tanpa isian berisiko tidak tertahan');

// Centang membersihkan satu kunci; tombol langkah baru bisa ditekan setelah semuanya bersih.
let sisa = E.sisaSetelahDicentang(sisa0, 'sekolah.kepsek_hp');
sisa = E.sisaSetelahDicentang(sisa, 'sekolah.bendahara_hp');
assert.deepEqual(E.terkunciRisiko(sisa, 'sekolah'), []);
ok('centang membersihkan isian berisiko satu per satu');

// Konfirmasi langkah membersihkan sisa isian BIASA di langkah itu; kunci HP TETAP dituntut
// walau langkahnya sudah dikonfirmasi, sesuai amandemen 2 butir 3 (tombolnya mati selama HP
// belum dicentang, jadi keadaan ini hanya mungkin lewat jalur lain).
const sesudah = E.sisaSetelahDikonfirmasi(sisa0, 'sekolah', ['sekolah.nama', 'sekolah.kepsek_hp', 'sekolah.bendahara_hp']);
assert.deepEqual(sesudah.sort(), ['komponen', 'rombel', 'sekolah.bendahara_hp', 'sekolah.kepsek_hp']);
ok('mengonfirmasi langkah tidak membebaskan centang HP yang belum lengkap');

// Isian "tidak terbaca" yang tidak wajib pun ikut ditagih, bukan cuma yang terisi AI.
const h = { dariScan: ['sekolah.email'], ragu: [], tidakTerbaca: ['sekolah.email'] };
assert.ok(E.wajibDicentang(h).includes('sekolah.email'));
ok('isian tidak terbaca ikut dituntut walau tidak wajib');

// Tinjau terkunci sampai tiga syaratnya lengkap.
assert.equal(E.layakTinjau([], [], []), true);
assert.equal(E.layakTinjau(['rombel'], [], []), false);
assert.equal(E.layakTinjau([], ['catatan'], []), false);
assert.equal(E.layakTinjau([], [], ['SMA']), false);
ok('Tinjau terkunci selama ada sisa, catatan berjenis kosong, atau langkah terkunci');

// Kunci awal: nomor HP SELALU ikut walau model tidak mengembalikannya sama sekali. Tanpa ini,
// scan yang tidak memuat satu pun nomor HP akan lolos dari tuntutan aturan 4. Yang menuntut
// centang sendiri DITANDAI, karena tombol langkah tidak boleh membersihkannya.
const tanpaHp = E.kunciAwal({ dariScan: ['sekolah.nama'], ragu: [], tidakTerbaca: [] });
for (const k of E.HP_KEYS) {
  assert.ok(tanpaHp.includes(E.PENANDA_WAJIB + k), `${k} harus dituntut sejak awal, bertanda`);
}
assert.ok(tanpaHp.includes('sekolah.nama'), 'isian biasa tidak bertanda');
ok('kunci awal selalu memuat kedua nomor HP bertanda, bukan hanya yang terbaca');

// Isian yang ditandai ragu / tidak terbaca menuntut centang SENDIRI (amandemen 2 butir 2). Di
// rencana, isian ragu disebut cukup dengan "mengubah isinya", tetapi sambungan onChange itu tidak
// pernah dibangun -- dan tanpa penanda ini, satu klik tombol langkah melewatinya (temuan QA).
const raguSaja = E.kunciAwal({ dariScan: ['sekolah.nama', 'harga.siswa'],
  ragu: ['harga.siswa'], tidakTerbaca: ['sekolah.telepon'] });
assert.ok(raguSaja.includes(E.PENANDA_WAJIB + 'harga.siswa'));
assert.ok(raguSaja.includes(E.PENANDA_WAJIB + 'sekolah.telepon'));
assert.ok(!raguSaja.includes(E.PENANDA_WAJIB + 'sekolah.nama'));
ok('isian ragu dan tidak terbaca ditandai butuh centang sendiri');

// Tombol langkah membersihkan isian biasa, dan TIDAK membebaskan isian bertanda.
const campur = E.kunciAwal({ dariScan: ['sekolah.nama', 'sekolah.telepon'],
  ragu: [], tidakTerbaca: ['sekolah.telepon'] });
const sesudahKonfirmasi = E.sisaSetelahDikonfirmasi(campur, 'sekolah',
  E.langkahDari(campur).find((l) => l.langkah === 'sekolah').kunci);
// Yang tinggal hanya yang BERTANDA: isian tidak terbaca, plus kedua nomor HP yang memang selalu
// dituntut sejak awal.
assert.deepEqual(sesudahKonfirmasi.sort(), [
  E.PENANDA_WAJIB + 'sekolah.bendahara_hp',
  E.PENANDA_WAJIB + 'sekolah.kepsek_hp',
  E.PENANDA_WAJIB + 'sekolah.telepon',
].sort());
assert.equal(E.layakTinjau(sesudahKonfirmasi, [], E.langkahDari(sesudahKonfirmasi)
  .filter((l) => E.terkunciRisiko(sesudahKonfirmasi, l.langkah).length).map((l) => l.langkah)), false);
assert.deepEqual(E.terkunciRisiko(sesudahKonfirmasi, 'sekolah').sort(),
  ['sekolah.bendahara_hp', 'sekolah.kepsek_hp', 'sekolah.telepon']);
ok('tombol langkah tidak membebaskan isian bertanda, dan Tinjau tetap terkunci');

// `terkunciRisiko` mengembalikan kunci TANPA penanda, supaya layar bisa menamainya.
assert.deepEqual(E.sisaSetelahDicentang(sesudahKonfirmasi, 'sekolah.telepon').sort(),
  [E.PENANDA_WAJIB + 'sekolah.bendahara_hp', E.PENANDA_WAJIB + 'sekolah.kepsek_hp'].sort());
ok('centang membersihkan isian bertanda satu per satu, kunci lain tinggal');

// Setiap kunci punya nama yang terbaca Sales; tombol langkah menyebut nama, bukan kunci mentah.
assert.equal(E.labelKunci('sekolah.kepsek_hp'), 'nomor HP kepala sekolah');
assert.equal(E.labelKunci(E.PENANDA_WAJIB + 'sekolah.telepon'), 'telepon sekolah');
assert.equal(E.labelKunci('kunci.asal.bukan.isian'), 'kunci.asal.bukan.isian');
ok('nama isian terbaca Sales, kunci asing tampil apa adanya');

// Kunci yang TIDAK dikenal satu langkah pun tidak boleh masuk daftar tuntutan: ia tidak akan
// pernah bisa dibersihkan, dan SATU kunci seperti itu mengunci Tinjau selamanya lalu membuat
// drafnya tidak bisa disimpan (temuan QA). Model tidak pernah dijanjikan bentuk kuncinya.
const kunciAneh = E.petakanEkstraksi({ ragu: ['kepsek_hp'], tidak_terbaca: ['telepon sekolah'] },
  { idsPaket: () => null });
const kunciBersih = E.kunciAwal(kunciAneh).map(E.kunciTampil);
assert.ok(!kunciBersih.includes('kepsek_hp'), 'kunci ragu yang tidak dikenal masuk daftar tuntutan');
assert.ok(!kunciBersih.includes('telepon sekolah'));
// Yang tinggal hanya kedua nomor HP, yang memang selalu dituntut sejak awal.
assert.deepEqual(kunciBersih.sort(), [...E.HP_KEYS].sort());
const semuaPeringatan = kunciAneh.peringatan.join(' | ');
assert.match(semuaPeringatan, /kepsek_hp/, 'kunci tak dikenal harus tetap diberitahukan');
assert.match(semuaPeringatan, /telepon sekolah/, 'kunci tak dikenal harus tetap diberitahukan');
// Hanya HP yang tersisa, jadi Tinjau masih terkunci sampai keduanya dicentang -- bukan terkunci
// selamanya seperti sebelum perbaikan ini.
assert.equal(E.layakTinjau(E.kunciAwal(kunciAneh), [], ['sekolah']), false);
ok('kunci tak dikenal tidak mengunci form, tetapi tetap diberitahukan sebagai peringatan');

// `langkahDari` mengelompokkan sisa tanpa perlu hasil baca: inilah yang membuat penanda
// konfirmasi tetap muncul saat draf dibuka lagi (hasil baca tidak ada di peramban).
const perLangkah = E.langkahDari([...sisa0, 'kota']);
assert.deepEqual(perLangkah.map((x) => x.langkah), ['sekolah', 'paket', 'rombel', 'penanda']);
assert.deepEqual(perLangkah[0].kunci.sort(),
  ['sekolah.bendahara_hp', 'sekolah.kepsek_hp', 'sekolah.nama']);
assert.deepEqual(E.langkahDari(['kunci.asal.bukan.isian']), []);
ok('sisa dikelompokkan per langkah tanpa hasil baca, kunci asing diabaikan');

// Kunci yang TIDAK dikenal tidak boleh membuat langkah palsu: langkah hanya muncul bila ada
// kunci yang memang miliknya.
assert.deepEqual(E.langkahDari([]), []);
ok('sisa kosong berarti tidak ada langkah yang menunggu');

// Penjaga sumber: `hapusPernyataan` di simpanDraf WAJIB mengecualikan ekstraksi_menunggu dari
// perbandingan isi. Kalau baris ini hilang, Sales yang sedang menyelesaikan centangannya
// membatalkan pernyataan "sesuai pindaian" miliknya sendiri -- tanpa galat, tanpa jejak, dan
// tanpa uji lain yang menangkapnya.
const aksi = readFileSync(new URL('../lib/po-aksi.ts', import.meta.url), 'utf8');
assert.match(aksi, /k !== 'ekstraksi_menunggu'/,
  'simpanDraf menghitung ekstraksi_menunggu sebagai perubahan isi');
ok('ekstraksi_menunggu tidak dihitung sebagai perubahan isi di simpanDraf');

// Penjaga sumber kedua, dan alasannya sama: `terapkanEkstraksi` adalah satu-satunya yang
// menuliskan hasil baca ke isian wizard. Tanpa panggilan itu, seluruh pemetaan berjalan,
// penandanya muncul, dan ISIANNYA TETAP KOSONG -- persis bug yang ditemukan saat pratinjau
// pertama. Tidak ada uji murni yang bisa mencapai sambungan itu, jadi yang dijaga di sini
// adalah keberadaannya.
const hook = readFileSync(new URL('../app/(sistem)/po/baru/use-form-po.ts', import.meta.url), 'utf8');
assert.match(hook, /terapkanEkstraksi\(h\)/,
  'pasangEkstraksi tidak menuliskan hasil baca ke isian wizard');
assert.match(hook, /setSekolah\(\(s\) => \(\{ \.\.\.s, \.\.\.t\.sekolah \}\)\)/);
ok('hasil baca benar-benar dituliskan ke isian wizard, bukan hanya disimpan di state');

// Penjaga sumber ketiga: halaman PO yang sudah ada harus MENGOPER kembali status konfirmasi yang
// tersimpan. Tanpa itu kolomnya write-only -- penanda "belum diperiksa" hilang saat draf dibuka
// lagi dan Tinjau terbuka untuk PO yang belum dicocokkan siapa pun. Ditemukan QA independen;
// tidak ada uji murni yang bisa mencapai sambungan ini, dan `ekstraksiMenunggu` opsional jadi
// kelalaiannya tidak terlihat oleh tsc.
const halamanPo = readFileSync(new URL('../app/(sistem)/po/[id]/page.tsx', import.meta.url), 'utf8');
assert.match(halamanPo, /ekstraksiMenunggu:\s*po\.ekstraksi_menunggu/,
  'halaman PO tidak mengoper po.ekstraksi_menunggu ke formulir, jadi status konfirmasi tidak pernah dibaca lagi');
ok('status konfirmasi yang tersimpan dibaca lagi saat draf dibuka');

console.log(`\n${n} pemeriksaan lolos.`);
