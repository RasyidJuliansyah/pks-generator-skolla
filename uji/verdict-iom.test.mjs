// Verdict IoM di basis data (catatan/15). Perilakunya dibuktikan di produksi dalam transaksi
// yang dibatalkan; uji ini menjaga yang bisa diperiksa tanpa koneksi: kode aturan SQL sama
// dengan lib/iom.ts, salinan aturan komponen sama, dan tidak ada jalan tulis ke tabel verdict.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';
import { migrasiTerakhir } from './migrasi.mjs';

const baca = (n) => readFileSync(new URL(`../supabase/migrasi/${n}`, import.meta.url), 'utf8');
// DUA SUMBER, sengaja dipisah:
//   `sql`  = migrasi TERAKHIR yang mendefinisikan private.nilai_iom. Mesin aturannya ditulis
//            ulang tiap kali aturan berubah (20260920b yang terbaru), jadi nama berkasnya
//            tidak boleh dipatok — yang dipatok akan menjaga versi yang sudah tidak terpasang.
//   `asal` = migrasi verdict yang pertama. Tabel, hak akses, trigger, dan seed deklarasi
//            hanya ada di sana dan memang tidak ditulis ulang.
const sql = migrasiTerakhir(/function private\.nilai_iom/).isi;
const asal = baca('20260917b_verdict_iom.sql');
const ts = readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8');
const { BUTIR_DEKLARASI } = muat('iom');
const { MIN_PESERTA, KAPASITAS_SESI } = muat('aturan-komponen');
const { PRESET } = muat('pricelist');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const kodeTs = new Set([...ts.matchAll(/cek\('([a-z-]+)'/g)].map((m) => m[1]));
const kodeSql = new Set([...sql.matchAll(/aturan_iom\('([a-z-]+)'/g)].map((m) => m[1]));
kodeSql.delete('galat-evaluasi');
assert.deepEqual([...kodeSql].sort(), [...kodeTs].sort());
ok(`${kodeTs.size} kode aturan SQL sama dengan lib/iom.ts`);

const daftar = (penanda) => {
  const blok = sql.slice(sql.indexOf(`-- ${penanda}`));
  const nilai = blok.slice(blok.indexOf('(values'), blok.indexOf(') as a(id, n, per)'));
  return Object.fromEntries([...nilai.matchAll(/\('(\w+)', (\d+), '(siswa|guru)'\)/g)]
    .map((m) => [m[1], { n: Number(m[2]), per: m[3] }]));
};
assert.deepEqual(daftar('MIN_PESERTA'), MIN_PESERTA);
assert.deepEqual(daftar('KAPASITAS_SESI'), KAPASITAS_SESI);
ok('salinan MIN_PESERTA dan KAPASITAS_SESI sama dengan lib/aturan-komponen.ts');

const butirSql = [...sql.matchAll(/array\['a1'[^\]]*\]/g),
                  ...asal.matchAll(/array\['a1'[^\]]*\]/g)].map((m) => m[0]);
assert.ok(butirSql.length >= 2, `daftar butir cuma ketemu ${butirSql.length} kali`);
for (const b of butirSql) assert.equal(b, `array[${BUTIR_DEKLARASI.map((x) => `'${x}'`).join(',')}]`);
ok('daftar butir di seed dan di mesin sama dengan BUTIR_DEKLARASI');

const produk = [...asal.slice(asal.indexOf('(values (\'LMS Juara\')')).matchAll(/\('([^']+)'\)/g)].slice(0, 7).map((m) => m[1]);
assert.deepEqual(produk.slice().sort(), PRESET.map((p) => p.n).sort());
ok('tujuh deklarasi yang diisi = tujuh paket di lib/pricelist.ts');

assert.match(asal, /revoke all on verifikasi_otomatis from anon, authenticated;/);
assert.doesNotMatch(asal, /policy [^;]* on verifikasi_otomatis for (insert|update|delete|all)/);
assert.match(asal, /revoke all on deklarasi_kesiapan from anon, authenticated;/);
assert.doesNotMatch(asal, /policy [^;]* on deklarasi_kesiapan for (insert|update|delete|all)/);
ok('tabel verdict dan deklarasi tanpa jalan tulis untuk klien');

// PO berkelompok (catatan/13a Bagian 9): daftar paket disimpan per baris verdict, dan mesin
// menilai tiap kelompok dari komponennya sendiri.
assert.match(sql, /add column if not exists kelompok text\[\]/,
  'kolom kelompok tidak ditambahkan — PO berkelompok kehilangan daftar paketnya');
assert.match(sql, /function private\.kelompok_iom/, 'pengambil kelompok hilang');
assert.match(sql, /'kelompok', to_jsonb\(v_pakai\)/, 'nilai_iom tidak mengembalikan daftar paket');
assert.match(sql, /array\(select jsonb_array_elements_text\(coalesce\(v -> 'kelompok'/,
  'catat_verdict_iom tidak menyimpan daftar paket');
ok('PO berkelompok: daftar paket dihitung, dikembalikan, dan disimpan');

assert.match(asal, /create trigger po_verdict_iom after update of status on po/);
assert.match(asal, /exception when others then/);
assert.match(asal, /order by ditandatangani_pada desc limit 1/);
assert.match(asal, /now\(\) at time zone 'Asia\/Jakarta'/);
ok('verdict dicatat saat masuk verifikasi, fail-closed, deklarasi terakhir, zona Jakarta');

for (const f of ['private.nilai_iom(uuid)', 'private.aturan_iom(text, boolean, text)', 'private.catat_verdict_iom()'])
  assert.ok(asal.includes(`revoke all on function ${f} from public, anon, authenticated;`), `${f} masih bisa dieksekusi klien`);
ok('mesin verdict tidak bisa dipanggil klien (izin EXECUTE dicabut)');

// Badan trigger penutupan dibaca dari migrasi TERAKHIR yang mendefinisikannya — sejak PO
// berkelompok boleh otomatis (20260922) fungsi ini ditulis ulang lagi, lalu sekali lagi pada
// 20260922c ketika jalur IoM-nya berpindah dari peran Head of Operations ke penanda transaksi.
// Memaku nama berkas lama membuat asersi atas badan yang sudah tidak terpasang.
const tutupBadan = migrasiTerakhir(/function private\.jaga_penutupan_verifikasi/).isi;
assert.match(tutupBadan, /coalesce\(current_setting\('app\.penutup_iom', true\), ''\) <> '1'/,
  'jalur IoM tidak lagi dijaga penanda transaksi');
assert.doesNotMatch(tutupBadan, /punya_peran\('head_of_operations'\)/);
// Penutupan kini dikerjakan basis data sendiri. Kalau peran HoO kembali menentukan di sini,
// artinya keputusan 22 Sep 2026 diam-diam dibatalkan dan PO yang lolos menggantung lagi.
assert.doesNotMatch(tutupBadan, /'head_of_operations' = any\(private\.peran_saya\(\)\)/,
  'peran HoO masih menentukan penutupan, padahal penutupannya kini otomatis');
assert.match(tutupBadan, /order by dicatat_pada desc limit 1\) t\s+where t\.lolos and t\.versi_po = NEW\.versi and t\.versi_iom = private\.versi_iom_berlaku\(\)/);
assert.match(tutupBadan, /d\.berlaku_sampai >= \(now\(\) at time zone 'Asia\/Jakarta'\)::date/);
assert.ok(tutupBadan.includes(`d.butir @> array[${BUTIR_DEKLARASI.map((x) => `'${x}'`).join(',')}]`));
assert.match(tutupBadan, /NEW\.status = 'ditolak' and tolak = 0/);
// PO berkelompok bisa memakai beberapa paket: deklarasi SETIAP paket diperiksa, bukan satu.
assert.match(tutupBadan, /unnest\(coalesce\(t\.kelompok, array\[t\.paket\]\)\)/,
  'penutupan tidak memeriksa deklarasi tiap paket PO berkelompok');
ok('penutupan IoM: penanda transaksi, nol penolakan, verdict terakhir versi ini, deklarasi tiap paket masih berlaku');

// ---- penutupan otomatis (keputusan Rizki 22 Sep 2026, catatan/13a Bagian 11) ----
const auto = migrasiTerakhir(/function private\.tutup_otomatis/).isi;
assert.match(auto, /add column if not exists diverifikasi_otomatis boolean not null default false/,
  'kolom penanda otomatis tidak ditambahkan');
// Dipicu verdictnya sendiri, AFTER INSERT, hanya saat lolos: verdict gagal tidak memicu apa pun
// sehingga PO tetap di `verifikasi` untuk keempat fungsi.
assert.match(auto, /after insert on verifikasi_otomatis\s+for each row when \(new\.lolos\)/,
  'tidak ada yang menutup PO begitu verdictnya lolos');
assert.match(auto, /set_config\('app\.penutup_iom', '1', true\)/,
  'penanda tidak dipasang lokal transaksi, jadi bisa menempel di koneksi pool');
assert.match(auto, /insert into surat_verifikasi \(po_id, otomatis\)/,
  'surat otomatis tidak diterbitkan');
assert.match(auto, /update surat_verifikasi set final_pada = now\(\)/,
  'surat otomatis tidak dikunci, jadi PKS tetap tak bisa dibuat');
// `diverifikasi_oleh` WAJIB null: kolomnya ber-foreign key ke pengguna(email)
// (20260829072645), jadi nilai apa pun yang bukan email membuat penutupan otomatis GAGAL
// SELALU, dan kegagalannya menyeret seluruh transaksi pengajuan verifikasi Sales. Asersi ini
// ditulis justru karena versi pertama migrasi ini menulis 'sistem:iom-<versi>' di sana, dan
// tak satu pun pemeriksaan lama menangkapnya: yang menguji hanya memeriksa TEKS migrasi,
// bukan apakah nilainya sah bagi batasan basis data.
assert.match(auto, /diverifikasi_oleh = null/,
  'penutupan otomatis tidak mengosongkan diverifikasi_oleh');
assert.doesNotMatch(auto, /diverifikasi_oleh = '/,
  'penutupan otomatis menulis nilai bukan-email ke kolom ber-foreign-key ke pengguna(email)');
// Penanda otomatis dijaga trigger tersendiri yang juga berjalan pada INSERT. Versi pertama
// menaruhnya di penjaga penutupan yang `before update` saja, sehingga PO bisa DISISIPKAN
// langsung sebagai terverifikasi + otomatis.
assert.match(auto, /create or replace function private\.jaga_penanda_otomatis/,
  'kolom penanda otomatis tidak punya penjaganya sendiri');
assert.match(auto, /create trigger po_jaga_penanda before insert or update on po/,
  'penjaga penanda tidak berjalan pada insert, jadi PO palsu bisa disisipkan sebagai terverifikasi');
assert.match(auto, /NEW\.diverifikasi_otomatis is distinct from coalesce\(OLD\.diverifikasi_otomatis, false\)/);
// Kelahiran PO dibatasi ke draf. Status 'terverifikasi' pada INSERT toh sudah ditolak
// `jaga_lantai_po` sejak 9 Sep, jadi ini lapis kedua, bukan penambal lubang itu.
assert.match(auto, /create policy po_buat on po for insert to authenticated[\s\S]*?and status = 'draf'/,
  'po_buat tidak membatasi status kelahiran PO');
assert.match(auto, /revoke all on function private\.tutup_otomatis\(uuid\) from public, anon, authenticated;/);
// Kebijakan surat diperketat satu per satu: klien tidak boleh menyisipkan, menyunting, atau
// menghapus surat bertanda otomatis. Tanpa itu, seorang Tech Ops Lead bisa membuat surat
// "otomatis" lewat PostgREST dan melewati gerbang PKS tanpa satu pun keputusan fungsi.
for (const kebijakan of ['surat_terbit', 'surat_sunting', 'surat_batal'])
  assert.match(auto,
    new RegExp(`create policy ${kebijakan} on surat_verifikasi for \\w+ to authenticated[\\s\\S]*?not otomatis`),
    `kebijakan ${kebijakan} tidak menutup surat bertanda otomatis`);
// Batasan penanda: surat otomatis tanpa penanda, surat manual wajib berpenanda. Inilah yang
// menjaga jalur manual tetap seketat sebelum kedua kolomnya boleh kosong.
assert.match(auto, /or \(not otomatis and ditandatangani_oleh is not null and nama_penanda is not null\)/,
  'batasan surat tidak membedakan surat otomatis dari surat bertanda tangan');
// Dua jalur penutupan tidak boleh tersisa: jalan HoO dicabut, bukan dibiarkan menganggur.
assert.match(auto, /drop function if exists public\.tutup_verifikasi_otomatis\(uuid\)/,
  'RPC penutupan HoO tidak dicabut, jadi masih ada jalur penutupan kedua');
// Backfill: PO lama yang sudah ditutup lewat jalur IoM tetapi suratnya belum pernah terbit.
assert.match(auto, /update po p set diverifikasi_otomatis = true/,
  'PO lama yang macet sebelum PKS tidak dibereskan');
ok('penutupan otomatis: dipicu verdict lolos, surat terbit dan terkunci, diverifikasi_oleh dikosongkan (bukan nilai bukan-email), penanda dijaga pada insert dan update, po_buat dibatasi ke draf, jalan HoO dicabut');

// Temuan QA putaran 1: tanpa urutan status di basis data, PO tanpa tanda tangan bisa masuk verifikasi.
const urutan = baca('20260917d_urutan_status_po.sql');
assert.ok('po_urutan_status' > 'po_tinjauan_sidik' && 'po_urutan_status' > 'po_bekukan_sekolah');
assert.match(urutan, /create trigger po_urutan_status before update of status on po/);
assert.match(urutan, /old\.status <> 'ditandatangani' or v_ttd < 3/);
assert.match(urutan, /if new\.status = 'menunggu_ttd' and old\.status in \('draf', 'ditolak'\) then\s+delete from tanda_tangan where po_id = new\.id;/);
assert.match(urutan, /if old\.status = 'menunggu_ttd' and new\.asal = 'platform' then/);
assert.equal((urutan.match(/if v_ttd < 3 then|or v_ttd < 3/g) ?? []).length, 2);
assert.equal((urutan.match(/delete from tanda_tangan where po_id = new\.id;/g) ?? []).length, 2);
assert.match(urutan, /private\.sidik_tinjauan\(new\) is distinct from new\.ditinjau_sidik/);
assert.match(urutan, /revoke all on function private\.jaga_urutan_status_po\(\) from public, anon, authenticated;/);
ok('urutan status: verifikasi hanya dari ditandatangani bertiga, ditandatangani hanya lewat jalur sah');

console.log(`\n${n} pemeriksaan lolos.`);
