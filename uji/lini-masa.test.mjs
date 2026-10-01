// Lini masa PO merangkai lima sumber jadi satu urutan. Yang diuji di sini bukan
// tampilannya melainkan sifat-sifat yang gampang rusak diam-diam: urutan, cara
// membedakan revisi dari perpindahan status, dan keputusan verifikasi yang sudah
// basi yang tetap harus terlihat sebagai riwayat, bukan menghilang.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sumber = {};
const muat = (p, n) => {
  const js = ts.transpileModule(readFileSync(new URL(p, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, (x) => sumber[x.replace('./', '')] ?? {});
  if (n) sumber[n] = m.exports;
  return m.exports;
};
muat('../lib/format.ts', 'format');
muat('../lib/checklist.ts', 'checklist');
muat('../lib/pihak.ts', 'pihak');
const { liniMasa, kunciPeristiwa } = muat('../lib/lini-masa.ts');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const t = (jam) => `2026-08-29T0${jam}:00:00.000Z`;

const peristiwa = liniMasa({
  riwayat: [
    { id: 1, status_lama: null, status_baru: 'draf', versi: 1, oleh: 'sales@x', pada: t(1) },
    { id: 2, status_lama: 'draf', status_baru: 'draf', versi: 2, oleh: 'sales@x', pada: t(2) },
    { id: 3, status_lama: 'draf', status_baru: 'menunggu_ttd', versi: 2, oleh: 'sales@x', pada: t(3) },
    { id: 4, status_lama: 'ditandatangani', status_baru: 'verifikasi', versi: 2, oleh: 'sales@x', pada: t(5) },
  ],
  ttd: [{ pihak: 'kepala_sekolah', nama: 'Budi', dibubuhkan_oleh: 'sales@x', waktu: t(4) }],
  verifikasi: [
    { fungsi: 'finance', hasil: 'tolak', catatan: 'Harga di bawah bottom price',
      oleh: 'farid@x', waktu: t(6), berlaku: false, sebab_basi: 'Direvisi: harga_siswa berubah' },
    { fungsi: 'finance', hasil: 'setuju', catatan: null,
      oleh: 'farid@x', waktu: t(7), berlaku: true, sebab_basi: null },
    { fungsi: 'education', hasil: 'setuju_catatan', catatan: 'Materi kelas 12 menyusul',
      oleh: 'rini@x', waktu: t(8), berlaku: true, sebab_basi: null },
  ],
  surat: { nama_penanda: 'Dwiva', ditandatangani_oleh: 'dwiva@x',
           dibuat_pada: t(9), final_pada: null },
  pks: null,
});

assert.equal(peristiwa.length, 4 + 1 + 3 + 1);
ok('kelima sumber terangkai, tidak ada yang tercecer');

const waktu = peristiwa.map((p) => +new Date(p.waktu));
assert.deepEqual(waktu, [...waktu].sort((a, b) => b - a), 'harus terbaru di atas');
ok('urut terbaru di atas');

const revisi = peristiwa.find((p) => p.judul.includes('Direvisi'));
assert.ok(revisi, 'kenaikan versi tanpa ganti status harus jadi "Direvisi"');
assert.equal(revisi.judul, 'Direvisi menjadi versi 2');
ok('kenaikan versi dibedakan dari perpindahan status');

// Keputusan yang sudah basi TETAP tampil — itu yang menjelaskan kenapa sebuah PO
// pernah tersendat. Yang berubah hanya warnanya jadi redup.
const basi = peristiwa.find((p) => p.judul === 'Finance menolak');
assert.ok(basi, 'penolakan yang sudah diperbaiki tetap harus terlihat');
assert.equal(basi.warna, 'muted');
assert.match(basi.rincian, /Tidak berlaku lagi \(Direvisi: harga_siswa berubah\)/);
ok('keputusan basi tetap tampil, redup, berikut sebabnya');

const hijau = peristiwa.find((p) => p.judul === 'Finance memberi lampu hijau');
assert.equal(hijau.warna, 'terverifikasi');
assert.equal(hijau.oleh, 'farid@x');
ok('keputusan yang berlaku berwarna dan menyebut pelakunya');

const catatan = peristiwa.find((p) => p.judul === 'Education setuju dengan catatan');
assert.equal(catatan.rincian, 'Materi kelas 12 menyusul');
ok('setuju dengan catatan membawa catatannya, bukan cuma labelnya');

// Sumber kosong tidak boleh melempar: PO yang baru dibuat belum punya apa-apa.
assert.deepEqual(liniMasa({}), []);
assert.deepEqual(liniMasa({ surat: null, pks: null, riwayat: [] }), []);
ok('sumber kosong menghasilkan lini masa kosong, bukan galat');

// Dua kali rangkai harus sama persis, termasuk saat waktunya kembar.
const kembar = { riwayat: [
  { id: 1, status_lama: null, status_baru: 'draf', versi: 1, oleh: 'a', pada: t(1) },
  { id: 2, status_lama: 'draf', status_baru: 'menunggu_ttd', versi: 1, oleh: 'a', pada: t(1) },
] };
assert.deepEqual(liniMasa(kembar).map((p) => p.judul), liniMasa(kembar).map((p) => p.judul));
ok('urutan tetap meski dua peristiwa berwaktu sama');

// Tanggal penandatanganan sempat tampil mentah sebagai "2026-06-18".
const unggah = liniMasa({ pks: {
  dibuat_oleh: 'a', dibuat_pada: null, final_pada: null,
  diunggah_oleh: 'a', diunggah_pada: t(9), ditandatangani_pada: '2026-06-18',
} });
assert.equal(unggah[0].rincian, 'Ditandatangani 18 Juni 2026');
ok('tanggal ditulis dalam bahasa Indonesia, bukan ISO mentah');

// --- Komentar, sumber keenam ---------------------------------------------
//
// Keputusan #6 catatan/09 ("garis pemisah keputusan") tidak punya kode sendiri: ia
// hanya benar kalau komentar dan keputusan verifikasi terurut benar di garis yang
// sama. Jadi yang diuji justru kasus paling rapat — selisih satu detik.
const detik = (s) => `2026-09-10T03:00:0${s}.000Z`;
const kom = (id, w, lain = {}) => ({
  id, isi: `isi ${id}`, oleh: 'rini@x', waktu: w, versi_po: 2,
  disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, ...lain,
});
const rapat = liniMasa({
  verifikasi: [{ fungsi: 'finance', hasil: 'tolak', catatan: null, oleh: 'farid@x',
                 waktu: detik(2), berlaku: true, sebab_basi: null }],
  komentar: [kom('sebelum', detik(1)), kom('sesudah', detik(3))],
  versiPo: 2,
});
assert.deepEqual(rapat.map((p) => p.komentar?.id ?? p.judul),
  ['sesudah', 'Finance menolak', 'sebelum'],
  'komentar dan keputusan berselisih satu detik harus tetap berurutan benar');
ok('komentar dan keputusan berselisih satu detik tetap berurutan benar');

const [basiK, segarK] = liniMasa({
  komentar: [kom('lama', detik(2), { versi_po: 1 }), kom('baru', detik(1), { versi_po: 2 })],
  versiPo: 2,
}).map((p) => p.komentar);
assert.equal(basiK.basi, true, 'versi_po lebih lama dari po.versi harus ditandai basi');
assert.equal(segarK.basi, false);
ok('komentar yang ditulis sebelum PO diubah ditandai basi, yang sesudahnya tidak');

// Tanpa versiPo (halaman sekolah tidak mengirimnya), jangan menebak basi.
assert.equal(liniMasa({ komentar: [kom('x', detik(1), { versi_po: 1 })] })[0].komentar.basi, false);
ok('tanpa pembanding versi, tidak ada komentar yang dituduh basi');

const hapus = liniMasa({ komentar: [kom('h', detik(1), {
  dihapus_pada: detik(5), dihapus_oleh: 'rini@x',
  po_komentar_revisi: [{ isi: 'versi pertama', digantikan_pada: detik(3) }],
})] })[0];
assert.equal(hapus.komentar.isi, null, 'isi komentar yang dihapus tidak boleh ditampilkan');
assert.deepEqual(hapus.komentar.revisi, [], 'versi lama tidak boleh memajang sisa komentar yang dihapus');
assert.equal(hapus.komentar.dihapus.oleh, 'rini@x');
assert.equal(hapus.waktu, detik(1), 'komentar yang dihapus tetap di tempatnya, bukan pindah ke waktu hapus');
ok('komentar dihapus: tetap di tempatnya, isi dan versi lamanya tidak dipajang');

const sunting = liniMasa({ komentar: [kom('s', detik(1), {
  disunting_pada: detik(6),
  po_komentar_revisi: [{ isi: 'v1', digantikan_pada: detik(3) }, { isi: 'v2', digantikan_pada: detik(5) }],
})] })[0];
assert.deepEqual(sunting.komentar.revisi.map((r) => r.isi), ['v2', 'v1'], 'versi lama terbaru dulu');
ok('versi lama tersusun terbaru dulu');

// --- Penanda "bolanya di siapa" -------------------------------------------
const { penulisTerakhir } = muat('../lib/komentar.ts');
const kb = (oleh, w, lain = {}) => ({ oleh, waktu: w, dihapus_pada: null,
  nama_penulis: oleh.split('@')[0], peran_penulis: ['finance'], ...lain });
assert.equal(penulisTerakhir([], 'sales@x'), null);
ok('tanpa komentar, tidak ada penanda');

const pt = penulisTerakhir([kb('sales@x', detik(1)), kb('yudi@x', detik(3)), kb('rini@x', detik(2))], 'sales@x');
assert.equal(pt.oleh, 'yudi@x', 'harus penulis TERBARU, bukan urutan larik');
assert.equal(pt.pemilik, false);
assert.deepEqual(pt.peran, ['finance']);
ok('penanda mengambil penulis terbaru, tidak bergantung urutan larik');

const ph = penulisTerakhir([kb('sales@x', detik(1)), kb('yudi@x', detik(3), { dihapus_pada: detik(4) })], 'sales@x');
assert.equal(ph.oleh, 'sales@x', 'komentar yang dihapus tidak boleh memindahkan bola');
assert.equal(ph.pemilik, true);
ok('komentar yang dihapus tidak memindahkan penanda, dan pemilik PO dikenali');

assert.equal(penulisTerakhir([kb('a@x', detik(1), { dihapus_pada: detik(2) })], 'a@x'), null);
ok('semua komentar dihapus berarti tidak ada penanda');

// --- Kestabilan kunci (catatan/20) --------------------------------------
// Kunci sama untuk masukan sama, dua kali render berturut-turut.
{
  const s = { verifikasi: [{ fungsi: 'finance', hasil: 'tolak', catatan: null,
    oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', berlaku: true, sebab_basi: null }] };
  assert.equal(liniMasa(s)[0].kunci, liniMasa(s)[0].kunci);
  assert.equal(liniMasa(s)[0].kunci, 'verifikasi:finance:2026-09-10T01:00:00.000Z');
  ok('kunci peristiwa stabil dan berbentuk sesuai catatan/20');
}

// Tanda tangan yang DIHAPUS lalu dibubuhkan ulang oleh pihak yang sama harus berkunci
// BEDA. Tanpa waktu di dalam kunci, balasan lama menempel diam-diam ke tanda tangan
// baru, dan percakapan tentang tanda tangan yang dibatalkan muncul di bawah
// penggantinya seolah membicarakannya.
{
  const k = (waktu) => liniMasa({ ttd: [{ pihak: 'kepala_sekolah', nama: 'Bu Uji',
    dibubuhkan_oleh: 'a@x', waktu }] })[0].kunci;
  assert.notEqual(k('2026-09-10T01:00:00.000Z'), k('2026-09-11T01:00:00.000Z'));
  ok('tanda tangan ulang berkunci beda — balasan lama tidak diwarisi');
}

// --- Pohon balasan (catatan/20) ------------------------------------------
// Balasan tersusun sebagai pohon; tingkat atas terbaru di atas, balasan terlama di atas.
{
  const K = (id, waktu, induk) => ({ id, isi: `k${id}`, oleh: 'a@x', waktu, versi_po: 1,
    disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: induk ?? null });
  const p = liniMasa({ versiPo: 1, komentar: [
    K('a', '2026-09-10T01:00:00.000Z'),
    K('c', '2026-09-10T03:00:00.000Z', 'komentar:a'),
    K('b', '2026-09-10T02:00:00.000Z', 'komentar:a'),
    K('d', '2026-09-10T04:00:00.000Z'),
  ] });
  assert.deepEqual(p.map((e) => e.kunci), ['komentar:d', 'komentar:a'], 'tingkat atas terbaru di atas');
  assert.deepEqual(p[1].balasan.map((e) => e.kunci), ['komentar:b', 'komentar:c'],
    'balasan terlama di atas');
  ok('pohon tersusun: tingkat atas terbaru dulu, balasan terlama dulu');
}

// Balasan TIDAK muncul dua kali.
{
  const p = liniMasa({ versiPo: 1, komentar: [
    { id: 'a', isi: 'a', oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: null },
    { id: 'b', isi: 'b', oleh: 'a@x', waktu: '2026-09-10T02:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: 'komentar:a' },
  ] });
  assert.equal(p.length, 1, 'balasan ikut muncul sebagai butir tingkat atas');
  ok('komentar yang jadi balasan tidak muncul dua kali');
}

// Induk yang tidak ada -> kembali ke tingkat atas, ditandai yatim. Ini yang terjadi saat
// tanda tangan dihapus karena PO dikembalikan untuk ditandatangani ulang.
{
  const p = liniMasa({ versiPo: 1, komentar: [
    { id: 'z', isi: 'z', oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: 'ttd:kepala_sekolah:2026-09-01T00:00:00.000Z' },
  ] });
  assert.equal(p.length, 1);
  assert.equal(p[0].yatim, true, 'balasan yatim harus ditandai, bukan dihilangkan');
  assert.equal(p[0].komentar.isi, 'z', 'isi balasan yatim tetap utuh');
  ok('balasan yatim kembali ke tingkat atas dengan isinya utuh');
}

// Rantai dalam tersusun benar dan tidak menghabiskan tumpukan.
{
  const komentar = [];
  for (let i = 0; i < 20; i++) {
    komentar.push({ id: `k${i}`, isi: `k${i}`, oleh: 'a@x',
      waktu: `2026-09-10T${String(i).padStart(2, '0')}:00:00.000Z`, versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: i === 0 ? null : `komentar:k${i - 1}` });
  }
  const p = liniMasa({ versiPo: 1, komentar });
  let e = p[0], dalam = 0;
  while (e.balasan.length) { e = e.balasan[0]; dalam++; }
  assert.equal(p.length, 1, 'rantai dalam harus satu butir tingkat atas');
  assert.equal(dalam, 19, 'rantai 20 tingkat tersusun utuh');
  ok('rantai bersarang 20 tingkat tersusun tanpa kehabisan tumpukan');
}

// --- Penutupan otomatis (catatan/13a Bagian 11) ---------------------------
//
// Penutupan otomatis dikerjakan basis data DI DALAM transaksi pengajuan Sales, jadi baris
// riwayatnya tercatat atas nama Sales itu. Kalau tampilan mempercayainya, lini masa
// menyatakan ada orang yang memutuskan padahal tidak ada — dan surat otomatis dilabeli
// "ditandatangani" padahal tidak ada yang meneken. Dua-duanya pernyataan palsu di bagian
// yang justru menjelaskan "kenapa PO ini begini".
{
  const dasar = {
    riwayat: [
      { id: 1, status_lama: 'ditandatangani', status_baru: 'verifikasi', versi: 1, oleh: 'sales@x', pada: t(5) },
      { id: 2, status_lama: 'verifikasi', status_baru: 'terverifikasi', versi: 1, oleh: 'sales@x', pada: t(6) },
    ],
  };

  // Tanpa penanda: perilaku lama, nama orangnya tetap tampil.
  const lama = liniMasa({ ...dasar, surat: { nama_penanda: 'Dwiva', ditandatangani_oleh: 'dwiva@x',
    dibuat_pada: t(7), final_pada: t(8) } });
  assert.equal(lama.find((p) => p.judul === 'Dinyatakan terverifikasi').oleh, 'sales@x');
  assert.ok(lama.find((p) => p.judul === 'Surat Verifikasi Kesiapan ditandatangani'));

  // Dengan penanda: pelaku manusia tidak diklaim, dan suratnya tidak mengaku ditandatangani.
  const auto = liniMasa({ ...dasar, otomatis: true,
    surat: { nama_penanda: null, ditandatangani_oleh: null, dibuat_pada: t(7), final_pada: t(8), otomatis: true } });
  const verif = auto.find((p) => p.judul.includes('terverifikasi'));
  assert.equal(verif.judul, 'Dinyatakan terverifikasi otomatis oleh sistem');
  assert.equal(verif.oleh, null, 'penutupan otomatis tidak boleh menyebut orang yang mengajukan');
  assert.ok(auto.find((p) => p.judul === 'Surat Verifikasi Kesiapan terbit otomatis'));
  assert.ok(auto.find((p) => p.judul === 'Surat terkunci otomatis: gerbang PKS terbuka'));
  assert.ok(!auto.some((p) => /ditandatangani|difinalisasi/i.test(p.judul)),
    'surat otomatis tidak boleh dilabeli perbuatan manusia');
  // Peristiwanya TIDAK dihilangkan, hanya pelakunya yang tidak dikarang.
  assert.equal(auto.length, lama.length);
  ok('penutupan otomatis: pelaku manusia tidak diklaim, surat tidak mengaku ditandatangani');
}

// Label tanda tangan mengikuti skema PO (catatan/23).
{
  const ttd = [{ pihak: 'sales_manager', nama: 'Agung', waktu: '2026-09-25T01:00:00Z', dibubuhkan_oleh: 's@uji' },
               { pihak: 'regional_head', nama: 'Zhurry', waktu: '2026-09-25T02:00:00Z', dibubuhkan_oleh: 's@uji' }];
  const empat = liniMasa({ ttd, skema: 4 });
  assert.ok(empat.some((e) => e.judul === 'Head of Sales menandatangani'));
  assert.ok(empat.some((e) => e.judul === 'Regional Head Division menandatangani'));
  const lama = liniMasa({ ttd: ttd.slice(0, 1) });
  assert.ok(lama.some((e) => e.judul === 'Sales Manager menandatangani'), 'PO lama tetap Sales Manager');
  ok('label tanda tangan di lini masa mengikuti skema');
}

// Penanda "dibaca AI" muncul di lini masa sebagai peristiwa biasa, dan bisa dibalas seperti
// peristiwa lain (catatan/17 amandemen 1). Kuncinya WAJIB berakhiran waktu peristiwanya:
// tanpa itu, pembacaan ulang yang kelak diizinkan akan mewarisi balasan lama diam-diam.
{
  const dgn = liniMasa({ riwayat: [], dibacaAiPada: '2026-09-26T03:00:00Z' });
  const ev = dgn.find((e) => e.kunci.startsWith('ekstraksi:'));
  assert.ok(ev, 'peristiwa isian awal dari AI tidak muncul');
  assert.equal(ev.waktu, '2026-09-26T03:00:00Z');
  assert.equal(ev.judul, 'Isian awal dibaca AI');
  assert.ok(ev.kunci.endsWith('2026-09-26T03:00:00Z'), 'kunci selain komentar wajib berakhiran waktu');

  assert.deepEqual(
    liniMasa({ riwayat: [] }).filter((e) => e.kunci.startsWith('ekstraksi:')), []);
  ok('peristiwa isian awal AI tampil dan berkunci berakhiran waktu');

  // Pelakunya orang yang MEMBUAT PO, diambil dari baris riwayat TERAWAL -- dihitung dari
  // waktunya, bukan dari urutan larik kiriman: pemanggil yang berbeda mengurutkannya berbeda.
  const acak = liniMasa({ dibacaAiPada: '2026-09-26T03:00:00Z', riwayat: [
    { id: 9, status_lama: 'draf', status_baru: 'menunggu_ttd', versi: 2, oleh: 'sales2@x', pada: t(9) },
    { id: 1, status_lama: null, status_baru: 'draf', versi: 1, oleh: 'sales@x', pada: t(1) },
  ] });
  assert.equal(acak.find((e) => e.kunci.startsWith('ekstraksi:')).oleh, 'sales@x');
  // Tanpa riwayat sama sekali (PO yang belum pernah berpindah status), pelakunya tidak dikarang.
  assert.equal(ev.oleh, null);
  ok('pelaku peristiwa AI diambil dari riwayat terawal, dan tidak dikarang bila tidak ada');
}

// Setiap pemanggil liniMasa di app mengoper skema: tanpa itu tanda tangan Head of Sales pada
// PO skema 4 terbaca "Sales Manager" (temuan QA akhir: halaman sekolah).
{
  const { readdirSync, statSync } = await import('node:fs');
  const telusuri = (d) => readdirSync(d).flatMap((f) => {
    const j = `${d}/${f}`;
    return statSync(j).isDirectory() ? telusuri(j) : /\.tsx?$/.test(f) ? [j] : [];
  });
  const akar = new URL('../app', import.meta.url).pathname;
  const panggilan = telusuri(akar).flatMap((f) => {
    const src = readFileSync(f, 'utf8');
    return [...src.matchAll(/liniMasa\(\{/g)].map((m) => {
      let d = 0, j = m.index + 'liniMasa('.length;
      for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
      return { f, arg: src.slice(m.index, j + 1) };
    });
  });
  assert.ok(panggilan.length >= 2, 'pemanggil liniMasa tidak ditemukan; penjaga ini tidak menjaga apa pun');
  const tanpa = panggilan.filter((p) => !/\bskema\s*:/.test(p.arg)).map((p) => p.f.replace(akar, 'app'));
  assert.deepEqual(tanpa, [], 'liniMasa dipanggil tanpa skema: ' + tanpa.join(', '));
  ok(`${panggilan.length} pemanggil liniMasa semuanya mengoper skema`);
}

console.log(`\n${n} pemeriksaan lolos.`);
