// Masa simpan muncul di dua dokumen yang ditandatangani sekolah, satu sebagai angka
// dan satu dieja. Kalau keduanya diketik terpisah, mereka akan menyimpang saat
// kebijakannya berubah — dan yang tercetak di lembar bermeterai adalah yang salah.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

let mockPengguna = {
  status: 'ok',
  pengguna: { email: 'admin@skolla.id', peran: ['admin_utama'] },
};

let mockTandaTangan = [];
let mockSuratVerifikasi = [];
let updateTandaTanganCalls = [];
let updateSuratVerifikasiCalls = [];
let hapusBerkasCalls = [];
let revalidateCalls = [];

const mockPrisma = {
  tandaTangan: {
    findMany: async () => mockTandaTangan,
    updateMany: async (args) => {
      updateTandaTanganCalls.push(args);
      return { count: 1 };
    },
  },
  suratVerifikasi: {
    findMany: async () => mockSuratVerifikasi,
    updateMany: async (args) => {
      updateSuratVerifikasiCalls.push(args);
      return { count: 1 };
    },
  },
  $transaction: async (queries) => Promise.all(queries),
};

const customRequire = (id) => {
  if (id.includes('prisma')) return { default: mockPrisma, prisma: mockPrisma };
  if (id.includes('sesi')) return { penggunaSaatIni: async () => mockPengguna };
  if (id.includes('storage') || id.includes('supabase-server')) {
    return { hapusBerkas: async (bucket, jalur) => { hapusBerkasCalls.push({ bucket, jalur }); } };
  }
  if (id === 'next/cache') {
    return { revalidatePath: (p) => { revalidateCalls.push(p); } };
  }
  return {};
};

const js = ts.transpileModule(
  readFileSync(new URL('../lib/retensi.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, customRequire);
const { BULAN_SIMPAN_TANDA_TANGAN, SEBUT_SIMPAN_TANDA_TANGAN, TIDAK_DIHAPUS,
        jatuhTempoTandaTangan, daftarJatuhTempo, hapusBerkasJatuhTempo } = mod.exports;

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Angka dan ejaannya harus bicara hal yang sama.
const EJAAN = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan',
  'sembilan', 'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas',
  'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas', 'dua puluh'];
assert.ok(SEBUT_SIMPAN_TANDA_TANGAN.startsWith(String(BULAN_SIMPAN_TANDA_TANGAN)),
  'ejaan tidak diawali angkanya sendiri');
assert.ok(SEBUT_SIMPAN_TANDA_TANGAN.includes(EJAAN[BULAN_SIMPAN_TANDA_TANGAN]),
  `ejaan "${SEBUT_SIMPAN_TANDA_TANGAN}" tidak cocok dengan angka ${BULAN_SIMPAN_TANDA_TANGAN}`);
ok(`angka dan ejaan sepakat: "${SEBUT_SIMPAN_TANDA_TANGAN}"`);

// Jatuh tempo yang lurus.
assert.equal(jatuhTempoTandaTangan(new Date('2026-09-09')).toISOString().slice(0, 10),
  '2027-09-09');
ok('jatuh tempo 12 bulan sesudah PKS basah');

// Kasus tepi yang HARUS diketahui, bukan kebetulan: 29 Februari tidak ada di tahun
// berikutnya, jadi tanggalnya berguling ke 1 Maret — satu hari lebih lambat. Untuk
// tenggat penghapusan itu tidak berbahaya, tapi jangan sampai ditemukan sebagai kejutan.
assert.equal(jatuhTempoTandaTangan(new Date('2028-02-29')).toISOString().slice(0, 10),
  '2029-03-01');
ok('29 Februari berguling ke 1 Maret — terlambat sehari, disengaja dan diketahui');

// Akhir bulan yang panjang ke bulan yang sama panjangnya tidak bergeser.
assert.equal(jatuhTempoTandaTangan(new Date('2026-01-31')).toISOString().slice(0, 10),
  '2027-01-31');
ok('31 Januari tetap 31 Januari');

// Berkas yang tidak pernah dihapus harus disebut eksplisit, supaya tidak ada yang
// mengira ia luput dari kebijakan retensi.
assert.deepEqual([...TIDAK_DIHAPUS].sort(), ['pks-basah', 'po-unggahan']);
ok('dua bucket yang sengaja tidak pernah dihapus tercantum');

// --- Uji daftarJatuhTempo dengan Prisma ---
mockPengguna = { status: 'ok', pengguna: { email: 'sales@skolla.id', peran: ['sales'] } };
await assert.rejects(
  async () => await daftarJatuhTempo(),
  /Hanya Super Admin yang boleh melihat daftar jatuh tempo./,
  'non-admin_utama harus ditolak'
);
ok('daftarJatuhTempo menolak non-admin_utama');

mockPengguna = { status: 'ok', pengguna: { email: 'admin@skolla.id', peran: ['admin_utama'] } };
mockTandaTangan = [
  {
    berkas: 'ttd/po-1.png',
    po: {
      id: 'po-uuid-1',
      nomor: 101n,
      diubahPada: new Date('2024-01-01'),
      sekolahBeku: { nama: 'SMA 1' },
      pks: [{ ditandatanganiPada: new Date('2024-01-15') }],
    },
  },
  {
    berkas: 'ttd/po-2.png',
    po: {
      id: 'po-uuid-2',
      nomor: 102n,
      diubahPada: new Date('2099-01-01'),
      sekolahBeku: { nama: 'SMA 2' },
      pks: [],
    },
  },
];
mockSuratVerifikasi = [
  {
    berkas: 'surat/sv-1.png',
    po: {
      id: 'po-uuid-3',
      nomor: 100n,
      diubahPada: new Date('2024-02-01'),
      sekolahBeku: { nama: 'SMP 3' },
      pks: [{ ditandatanganiPada: new Date('2024-02-10') }],
    },
  },
];

const daftar = await daftarJatuhTempo();
assert.equal(daftar.length, 2, 'hanya 2 berkas yang jatuh tempo');
assert.equal(daftar[0].nomor, 101);
assert.equal(daftar[0].jenis, 'Tanda tangan PO');
assert.equal(daftar[1].nomor, 100);
assert.equal(daftar[1].jenis, 'Tanda tangan Surat Verifikasi');
ok('daftarJatuhTempo memfilter dan menyusun data dengan benar via Prisma');

// --- Uji hapusBerkasJatuhTempo dengan Prisma ---
mockPengguna = { status: 'ok', pengguna: { email: 'sales@skolla.id', peran: ['sales'] } };
const resTolak = await hapusBerkasJatuhTempo('tanda-tangan', 'ttd/po-1.png');
assert.equal(resTolak.ok, false);
assert.match(resTolak.galat, /Hanya Super Admin/);
ok('hapusBerkasJatuhTempo menolak non-admin_utama');

mockPengguna = { status: 'ok', pengguna: { email: 'admin@skolla.id', peran: ['admin_utama'] } };
hapusBerkasCalls = [];
updateTandaTanganCalls = [];
updateSuratVerifikasiCalls = [];
revalidateCalls = [];

const resSukses = await hapusBerkasJatuhTempo('tanda-tangan', 'ttd/po-1.png');
assert.equal(resSukses.ok, true);
assert.equal(hapusBerkasCalls.length, 1);
assert.equal(hapusBerkasCalls[0].jalur, 'ttd/po-1.png');
assert.equal(updateTandaTanganCalls.length, 1);
assert.equal(updateSuratVerifikasiCalls.length, 1);
assert.equal(revalidateCalls.includes('/retensi'), true);
ok('hapusBerkasJatuhTempo menghapus berkas fisik dan memperbarui tanda tangan & surat via prisma transaction');

console.log(`\n${n} pemeriksaan lolos.`);
