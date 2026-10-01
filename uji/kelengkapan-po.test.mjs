// Syarat cetak Form Pre-Order. Yang dijaga di sini: dokumen setengah jadi tidak
// boleh bisa dicetak, karena yang dicetak dibawa ke sekolah untuk ditandatangani
// dan tiap isian kosong tercetak sebagai garis kosong.
//
// Daftar semacam ini gampang ketinggalan satu bidang tanpa ada yang menyadari,
// jadi ujinya menyapu SETIAP bidang satu per satu.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

// muat() menyelesaikan impor relatif (kelengkapan-po kini mengimpor ./pihak, catatan/23).
const { kurangLengkapPo, kekuranganPo } = muat('kelengkapan-po');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

/** PO yang benar-benar lengkap: tidak boleh menghasilkan satu keluhan pun. */
const lengkap = () => ({
  sekolah: {
    nama: 'SMA Negeri 1 Cibadak', npsn: '20203344',
    kepala_sekolah: 'Dra. Sri Wahyuni, M.Pd.', kepsek_hp: '081234567890',
    bendahara: 'Hendra Gunawan', bendahara_hp: '081298765432',
  },
  masaMulai: '2026-07-01', masaSelesai: '2027-06-30',
  sumberDana: 'BOS', sumberDanaLain: '',
  tanggalTtd: '2026-06-20', namaPm: 'Bintang', namaSm: 'Agung',
  jumlahSiswa: 300,
  termin: [
    { tanggal: '2026-07-01', nominal: 30_000_000 },
    { tanggal: '2026-10-01', nominal: 15_000_000 },
  ],
  grandTotal: 45_000_000,
});

assert.deepEqual(kurangLengkapPo(lengkap()), []);
ok('PO yang lengkap tidak menghasilkan keluhan apa pun');

// Setiap bidang wajib disapu satu per satu. Kalau ada yang terlewat dari daftar
// syarat, salah satu baris di bawah ini gagal.
const bidang = [
  ['sekolah.nama', (d) => { d.sekolah.nama = ''; }],
  ['sekolah.npsn', (d) => { d.sekolah.npsn = ''; }],
  ['sekolah.kepala_sekolah', (d) => { d.sekolah.kepala_sekolah = ''; }],
  ['sekolah.kepsek_hp', (d) => { d.sekolah.kepsek_hp = ''; }],
  ['sekolah.bendahara', (d) => { d.sekolah.bendahara = ''; }],
  ['sekolah.bendahara_hp', (d) => { d.sekolah.bendahara_hp = ''; }],
  ['sumberDana', (d) => { d.sumberDana = ''; }],
  ['masaMulai', (d) => { d.masaMulai = ''; }],
  ['masaSelesai', (d) => { d.masaSelesai = ''; }],
  ['tanggalTtd', (d) => { d.tanggalTtd = ''; }],
  ['namaPm', (d) => { d.namaPm = ''; }],
  ['namaSm', (d) => { d.namaSm = ''; }],
  ['jumlahSiswa', (d) => { d.jumlahSiswa = 0; }],
  ['termin', (d) => { d.termin = []; }],
];
for (const [nama, rusak] of bidang) {
  const d = lengkap();
  rusak(d);
  assert.ok(kurangLengkapPo(d).length > 0, `${nama} kosong tapi tidak dikeluhkan`);
}
ok(`${bidang.length} bidang wajib: mengosongkan salah satunya selalu menghalangi cetak`);

// Spasi bukan isian.
const spasi = lengkap();
spasi.sekolah.kepala_sekolah = '   ';
assert.ok(kurangLengkapPo(spasi).some((x) => x.includes('kepala sekolah')));
ok('spasi tidak dianggap terisi');

// Termin yang terisi separuh justru yang berbahaya: ia lolos "sudah ada termin"
// tapi tercetak dengan kolom kosong.
const separuh = lengkap();
separuh.termin = [{ tanggal: '2026-07-01', nominal: 0 }];
assert.ok(kurangLengkapPo(separuh).some((x) => x.includes('kosong')));
const separuh2 = lengkap();
separuh2.termin = [{ tanggal: '', nominal: 45_000_000 }];
assert.ok(kurangLengkapPo(separuh2).some((x) => x.includes('kosong')));
ok('termin yang terisi separuh tetap ditagih');

const timpang = lengkap();
timpang.termin = [{ tanggal: '2026-07-01', nominal: 1_000_000 }];
assert.ok(kurangLengkapPo(timpang).some((x) => x.includes('belum sama dengan grand total')));
ok('total termin yang tidak sama dengan grand total menghalangi cetak');

// "Lainnya" tanpa penjelasan tercetak sebagai garis kosong di dokumen.
const lainnya = lengkap();
lainnya.sumberDana = 'Lainnya';
assert.ok(kurangLengkapPo(lainnya).some((x) => x.includes('Lainnya')));
lainnya.sumberDanaLain = 'Dana komite';
assert.deepEqual(kurangLengkapPo(lainnya), []);
ok('sumber dana "Lainnya" wajib dijelaskan, dan penjelasannya menutup keluhan');

// Masa aktif terbalik lolos pemeriksaan "terisi" tapi jelas salah.
const terbalik = lengkap();
terbalik.masaSelesai = '2026-06-30';
terbalik.masaMulai = '2026-07-01';
assert.ok(kurangLengkapPo(terbalik).some((x) => x.includes('berakhir sebelum')));
ok('masa aktif yang berakhir sebelum mulainya ditolak');

// Empat penanda tangan (catatan/23): Regional Head hanya ditagih pada skema 4.
{
  const tanpaSkema = kekuranganPo({ ...lengkap() });
  assert.ok(!tanpaSkema.some((h) => /Regional Head/.test(h.pesan)), 'skema 3 tidak menagih Regional Head');
  const empat = kekuranganPo({ ...lengkap(), skemaTtd: 4 });
  assert.ok(empat.some((h) => h.langkah === 'penanda' && h.pesan === 'Regional Head Division belum dipilih.'));
  const empatLengkap = kekuranganPo({ ...lengkap(), skemaTtd: 4, namaRh: 'RH' });
  assert.ok(!empatLengkap.some((h) => /Regional Head/.test(h.pesan)));
  const label4 = kekuranganPo({ ...lengkap(), skemaTtd: 4, namaRh: 'RH', namaSm: '' });
  assert.ok(label4.some((h) => h.pesan === 'Head of Sales belum dipilih.'));
  const label3 = kekuranganPo({ ...lengkap(), namaSm: '' });
  assert.ok(label3.some((h) => h.pesan === 'Sales Manager belum dipilih.'));
  ok('Regional Head ditagih hanya pada skema 4; label SM mengikuti skema');
}

console.log(`\n${n} pemeriksaan lolos.`);
