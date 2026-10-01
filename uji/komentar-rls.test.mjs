// Penjaga komentar PO — dibaca dari berkas migrasinya sendiri.
//
// Aturannya sudah dibuktikan langsung di basis data: serangan disimulasikan dalam
// transaksi dengan `set local role authenticated`, ditunjukkan ditolak, lalu di-rollback
// (13 pemeriksaan + 5 uji mutasi, 10 Sep 2026). Yang TIDAK bisa dilakukan uji itu adalah
// ikut jalan di `npm test` — ia butuh kredensial basis data.
//
// Berkas ini menjaga sisi yang bisa diperiksa tanpa koneksi: bentuk aturannya. Ia tidak
// membuktikan basis datanya benar; ia menangkap saat seseorang kelak "merapikan"
// migrasinya dan diam-diam membuka salah satu pintu yang sengaja ditutup.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

const sql = readFileSync(new URL('../supabase/migrasi/20260910_komentar_po.sql', import.meta.url), 'utf8');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// --- C Level ---------------------------------------------------------------
//
// Jebakan yang sudah terbukti: private.punya_peran('c_level') bernilai TRUE untuk
// siapa pun yang memegang admin_utama. Penjaga yang ditulis dengan fungsi itu mengunci
// Super Admin, dan itu jenis kesalahan yang tidak berbunyi sampai ada yang mengeluh.
assert.ok(!/not\s+private\.punya_peran\(\s*'c_level'/.test(sql),
  "penjaga c_level lewat punya_peran() — fungsi itu meloloskan admin_utama, jadi Super Admin ikut terkunci");
assert.equal((sql.match(/'c_level'\s*=\s*any\s*\(\s*private\.peran_saya\(\)\s*\)/g) ?? []).length, 2,
  'pemeriksaan c_level harfiah harus ada dua: di kebijakan INSERT dan di trigger');
ok('c_level diperiksa harfiah dari array peran, di kebijakan DAN di trigger');

// --- Tidak ada jalan sunting/hapus langsung --------------------------------
for (const aksi of ['update', 'delete']) {
  assert.ok(!new RegExp(`create policy \\w+ on po_komentar for ${aksi}`, 'i').test(sql),
    `ada kebijakan ${aksi.toUpperCase()} pada po_komentar — sunting langsung melewati pencatatan revisi`);
}
assert.match(sql, /revoke update, delete on po_komentar from anon, authenticated/,
  'UPDATE dan DELETE pada po_komentar harus dicabut dari klien');
ok('po_komentar tidak bisa disunting atau dihapus langsung dari klien');

// --- Revisi hanya ditulis trigger ------------------------------------------
assert.match(sql, /revoke insert, update, delete on po_komentar_revisi from anon, authenticated/,
  'klien tidak boleh mengarang baris revisi');
// Penyalinan HARUS berada di fungsi trigger, bukan cuma di dalam sunting_komentar():
// fungsi bisa dilewati jalur lain, trigger tidak. Sudah dibuktikan dengan mencabut
// triggernya — tanpa dia, sunting tidak meninggalkan jejak sama sekali.
const trigger = sql.slice(sql.indexOf('function private.jaga_komentar_sunting'),
                          sql.indexOf('drop trigger if exists jaga_komentar_sunting'));
assert.match(trigger, /insert into po_komentar_revisi/,
  'penyalinan revisi tidak ada di trigger — kalau hanya di sunting_komentar(), jalur lain lolos tanpa jejak');
ok('revisi disalin oleh trigger, dan klien tidak bisa menulisnya sendiri');

// --- Kolom yang tidak boleh berpindah --------------------------------------
for (const kolom of ['po_id', 'oleh', 'waktu', 'versi_po']) {
  assert.ok(new RegExp(`new\\.${kolom}\\s*:=\\s*old\\.${kolom}`).test(trigger),
    `${kolom} bisa diubah saat sunting — komentar tidak boleh berpindah PO, penulis, atau versi`);
}
ok('sunting tidak bisa memindahkan komentar ke PO, penulis, atau versi lain');

// --- Menghapus berarti menandai --------------------------------------------
const hapus = sql.slice(sql.indexOf('function hapus_komentar'));
assert.ok(!/delete\s+from\s+po_komentar/.test(hapus),
  'hapus_komentar benar-benar MENGHAPUS baris — yang diminta hanya menandai dihapus_pada');
assert.match(hapus, /set dihapus_pada = now\(\)/);
ok('hapus_komentar menandai, bukan membuang');

// --- Kedua RPC harus tertutup dengan benar ---------------------------------
for (const f of ['sunting_komentar(uuid, text)', 'hapus_komentar(uuid)']) {
  assert.ok(sql.includes(`revoke all on function ${f} from public, anon`),
    `${f} tidak dicabut dari public/anon`);
  assert.ok(sql.includes(`grant execute on function ${f} to authenticated`),
    `${f} tidak diberikan ke authenticated`);
}
// security definer melewati RLS, jadi search_path yang tidak dipatok adalah lubang.
assert.equal((sql.match(/security definer\s*\nset search_path to public/g) ?? []).length, 4,
  'setiap fungsi security definer harus memaku search_path');
ok('kedua RPC tertutup untuk anon, dan semua security definer memaku search_path');

// --- versi_po tidak boleh dipercayakan ke klien ----------------------------
const baru = sql.slice(sql.indexOf('function private.jaga_komentar_baru'),
                       sql.indexOf('drop trigger if exists jaga_komentar_baru'));
for (const kolom of ['oleh', 'waktu', 'versi_po']) {
  assert.ok(new RegExp(`new\\.${kolom}\\s*:=`).test(baru),
    `${kolom} tidak ditimpa server — versi_po palsu membuat komentar basi tampak masih berlaku`);
}
ok('oleh, waktu, dan versi_po diisi server, bukan diterima dari klien');

// --- Temuan QA 10 Sep 2026 -------------------------------------------------
//
// Versi RPC yang berlaku ada di migrasi pengeras, bukan di migrasi awal.
const keras = readFileSync(new URL('../supabase/migrasi/20260910c_komentar_rpc_diperketat.sql', import.meta.url), 'utf8');
for (const f of ['sunting_komentar', 'hapus_komentar']) {
  const badan = keras.slice(keras.indexOf(`function ${f}`));
  const potong = badan.slice(0, badan.indexOf('$$;'));
  // `<>` dengan NULL menghasilkan NULL, IF menganggapnya tidak-benar, dan penolakannya
  // dilewati: sesi tanpa email menyunting komentar siapa pun.
  assert.ok(!/lower\(v_oleh\)\s*<>\s*v_saya/.test(potong),
    `${f}: pemeriksaan kepemilikan pakai <> — bernilai NULL untuk sesi tanpa email, dan penolakannya dilewati`);
  assert.match(potong, /is distinct from v_saya/, `${f}: kepemilikan harus diperiksa dengan is distinct from`);
  assert.match(potong, /if v_saya is null then/, `${f}: sesi tanpa email harus ditolak tegas`);
  assert.match(potong, /'c_level' = any \(private\.peran_saya\(\)\)/,
    `${f}: C Level tidak ditolak — tombol tersembunyi bukan penjaga`);
}
ok('sunting/hapus menolak sesi tanpa email dan C Level, kepemilikan tanpa jebakan NULL');

// Butir lini masa berkunci stabil, dan komentar baru selalu muncul di atas. Tanpa key
// stabil, kotak sunting terbuka berisi teks komentar orang lain.
//
// Sejak balasan (catatan/20) render IsiKomentar pindah ke butir-lini.tsx, dan kunci
// stabilnya jadi dua lapis: ButirLini berkunci e.kunci di page.tsx (tak berpindah saat
// butir baru menyisip), dan IsiKomentar berkunci e.komentar.id di dalam butir. Keduanya
// dibaca; penjaga lama yang cuma melihat page.tsx akan hijau padahal halamannya sudah
// tidak merender komentar sama sekali.
const halaman = readFileSync(new URL('../app/(sistem)/po/[id]/page.tsx', import.meta.url), 'utf8');
const butir = readFileSync(new URL('../app/(sistem)/po/[id]/butir-lini.tsx', import.meta.url), 'utf8');
assert.match(butir, /<IsiKomentar key=\{e\.komentar\.id\}/,
  'IsiKomentar tanpa key={e.komentar.id} — state sunting akan tertukar antar komentar');
assert.match(halaman, /<ButirLini key=\{e\.kunci\}/,
  'ButirLini tanpa key={e.kunci} — kunci posisi membuat state sunting tertinggal slotnya');
ok('butir lini masa berkunci stabil (ButirLini e.kunci, IsiKomentar komentar.id)');

// --- Langkah 3: penanda baca dan penulis ---------------------------------
const baca = readFileSync(new URL('../supabase/migrasi/20260910d_komentar_dibaca_dan_penulis.sql', import.meta.url), 'utf8');
const sunting3 = baca.slice(baca.indexOf('function private.jaga_komentar_sunting'));
const sunting3Badan = sunting3.slice(0, sunting3.indexOf('$$;'));
for (const kolom of ['po_id', 'oleh', 'nama_penulis', 'peran_penulis', 'waktu', 'versi_po']) {
  assert.ok(new RegExp(`new\\.${kolom}\\s*:=\\s*old\\.${kolom}`).test(sunting3Badan),
    `langkah 3 menulis ulang trigger sunting tanpa mengunci ${kolom} — komentar bisa berganti penulis`);
}
ok('trigger sunting versi langkah 3 tetap mengunci penulis, termasuk nama dan perannya');

// Kedua RPC HARUS invoker. Sebagai definer, RLS lepas dan hitungan belum-dibaca ikut
// menghitung komentar di PO yang tidak boleh dilihat pemanggilnya.
for (const f of ['komentar_belum_dibaca()', 'tandai_komentar_dibaca(p_po uuid)']) {
  const b = baca.slice(baca.indexOf(`function ${f}`));
  const kepala = b.slice(0, b.indexOf('as $$'));
  assert.match(kepala, /security invoker/, `${f} bukan security invoker — RLS terlewati`);
  assert.ok(!/security definer/.test(kepala), `${f} security definer — RLS terlewati`);
}
ok('RPC penanda baca berjalan sebagai pemanggil, jadi RLS tetap berlaku');

assert.match(baca, /create policy dibaca_milik_sendiri[\s\S]*?with check \([\s\S]*?boleh_lihat_po/,
  'penanda baca bisa dibuat untuk PO yang tidak terlihat');
ok('penanda baca hanya untuk PO yang terlihat');

// --- Balasan (catatan/20) --------------------------------------------------
//
// Dibaca dari migrasi TERAKHIR yang mendefinisikan triggernya, bukan nama berkas yang
// dipatok: fungsi yang ditulis ulang di migrasi lebih baru membuat asersi atas berkas
// lama tetap hijau sementara yang terpasang sudah lain.
const migrasiBaru = migrasiTerakhir(/function private\.jaga_komentar_baru/).isi;
const migrasiSunting = migrasiTerakhir(/function private\.jaga_komentar_sunting/).isi;

// Balasan ke komentar WAJIB satu PO dengan induknya.
assert.match(migrasiBaru, /v_induk_po\s*<>\s*new\.po_id/,
  'trigger tidak memeriksa induk komentar berada di PO yang sama');

// Kedalaman dihitung server. `new.kedalaman :=` harus muncul; yang TIDAK boleh adalah
// membacanya dari kiriman klien sebagai dasar hitungan.
assert.match(migrasiBaru, /new\.kedalaman\s*:=\s*0/,
  'kedalaman tidak dinolkan lebih dulu — kiriman klien bisa lolos');
assert.match(migrasiBaru, /new\.kedalaman\s*:=\s*v_induk_dalam\s*\+\s*1/,
  'kedalaman tidak dihitung dari induk');

// Pagar 50, dengan kalimat yang bisa dibaca orang.
assert.match(migrasiBaru, /new\.kedalaman\s*>\s*50/, 'pagar kedalaman 50 hilang');
assert.match(migrasiBaru, /Balasan sudah bersarang 50 tingkat/,
  'pagar kedalaman menolak tanpa kalimat yang terbaca');

// Penjagaan c_level harus TETAP berdiri di trigger yang ditulis ulang.
assert.match(migrasiBaru, /'c_level'\s*=\s*any\s*\(\s*private\.peran_saya\(\)\s*\)/,
  'trigger baru kehilangan penjagaan c_level harfiah');

// Sunting memaku kolom SATU PER SATU. Diperiksa per kolom, bukan dengan mencari kata
// "induk" di mana saja dalam berkas — itu akan hijau hanya karena ada di komentar.
for (const kolom of ['induk_kunci', 'kedalaman']) {
  assert.match(migrasiSunting, new RegExp(`new\\.${kolom}\\s*:=\\s*old\\.${kolom}`),
    `jaga_komentar_sunting tidak memaku ${kolom} — ia bisa diubah lewat jalur sunting, dan induk yang bisa diubah berarti siklus`);
}

// Tidak ada kebijakan tulis baru yang diam-diam ditambahkan bersama balasan.
for (const aksi of ['update', 'delete']) {
  assert.ok(!new RegExp(`create policy \\w+ on po_komentar for ${aksi}`, 'i').test(migrasiBaru),
    `migrasi balasan menambahkan kebijakan ${aksi.toUpperCase()} pada po_komentar`);
}

// --- Penjagaan 20260910d yang harus ikut terbawa ---------------------------------
//
// Tugas 1 sempat menulis ulang KEDUA trigger di atas tanpa dua penjagaan yang hidup di
// 20260910d_komentar_dibaca_dan_penulis.sql. Akibatnya bukan kosmetik: seluruh komentar
// baru lahir tanpa salinan nama/peran penulis. Asersi di bawah menangkap regresi itu.
for (const kolom of ['nama_penulis', 'peran_penulis']) {
  assert.match(migrasiBaru, new RegExp(`new\\.${kolom}\\s*:=`),
    `trigger baru tidak mengisi ${kolom} — komentar lahir tanpa penulis`);
}
assert.match(migrasiBaru, /new\.nama_penulis\s*:=\s*v_nama/,
  'nama_penulis tidak diisi dari tabel pengguna');
assert.match(migrasiBaru, /new\.peran_penulis\s*:=\s*v_peran/,
  'peran_penulis tidak diisi dari tabel pengguna');
assert.match(migrasiBaru, /'Sesi tidak dikenali\.'/,
  'sesi tanpa email tidak lagi ditolak tegas saat menulis komentar');

for (const kolom of ['nama_penulis', 'peran_penulis']) {
  assert.match(migrasiSunting, new RegExp(`new\\.${kolom}\\s*:=\\s*old\\.${kolom}`),
    `jaga_komentar_sunting tidak memaku ${kolom} — penulis komentar bisa diganti lewat jalur sunting`);
}

ok('balasan: induk se-PO, kedalaman dari server, pagar 50, sunting memaku induk');
ok('balasan: penjagaan 20260910d (salinan penulis saat insert, paku saat sunting) tetap terbawa');

console.log(`\n${n} pemeriksaan lolos.`);
