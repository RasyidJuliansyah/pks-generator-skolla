// Uji emas: dokumen dan harga PO yang ada HARUS keluar persis sama, byte per byte.
//
// Ini penjaga utama spesifikasi 07 (kelompok PO). Pekerjaan itu menyentuh dokumen
// yang ditandatangani sekolah dan lantai harga — dan janjinya: PO satu kelompok, yaitu
// seluruh PO yang ada hari ini, tercetak dan terhitung PERSIS seperti sebelum
// perubahan. Janji itu diuji di sini, bukan diasumsikan.
//
// Berkas emasnya direkam 10 Sep 2026 SEBELUM kode dokumen disentuh. Kalau uji ini
// gagal, anggap dokumennya berubah — jangan buru-buru merekam ulang. Merekam ulang
// hanya sah bila perubahannya memang disengaja (misalnya pricelist baru), dengan:
//
//   BUAT_EMAS=1 node uji/emas.test.mjs
//
// lalu diff berkas di uji/emas/ diperiksa baris per baris sebelum di-commit.
//
// Hanya tier Price List dan Bottom yang direkam. Tier Acquisition sengaja tidak
// ditulis ke berkas mana pun di luar pricelist.
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { KOMPONEN, PRESET } = muat('pricelist');
const { ID_GURU } = muat('aturan-komponen');
const { hitung, paketDari } = muat('hitung');
const { hitungPerKelompok } = muat('kelompok');
const D = muat('dokumen-dari-po');
const { dokumenPo } = muat('dokumen-po');
const { dokumenPks } = muat('dokumen-pks');
const { dokumenSurat } = muat('dokumen-surat');

// ---- Fixture. Komponennya dipilih dari pricelist, jadi ikut sah kalau pricelist berubah.
const siswaInti = KOMPONEN.filter((k) => k.g === 'core' && !ID_GURU.includes(k.id));
const addonBersesi = KOMPONEN.find((k) => k.g === 'addon' && k.sesi && !ID_GURU.includes(k.id));
const guru = ID_GURU[0];
const juara = PRESET.find((p) => p.n === 'LMS Juara');
const terkecil = [...PRESET].sort((a, b) => a.ids.length - b.ids.length)[0];
const diluar = siswaInti.find((k) => !terkecil.ids.includes(k.id));
// Dua komponen inti yang BUKAN paket — supaya jalur a la carte ikut terekam.
let alaCarte = null;
for (let i = 0; i < siswaInti.length && !alaCarte; i++)
  for (let j = i + 1; j < siswaInti.length && !alaCarte; j++) {
    const ids = [siswaInti[i].id, siswaInti[j].id];
    if (!paketDari(ids.map((id) => ({ id, sesi: 1 })), KOMPONEN, PRESET)) alaCarte = ids;
  }
assert.ok(juara && addonBersesi && diluar && alaCarte, 'pricelist tidak lagi memuat bahan fixture');

const rombel = (kelas, huruf, n) =>
  kelas.flatMap((k) => huruf.map((h) => ({ kelas: k, rombel: h, jumlah_siswa: n })));
const termin = (nominal, n) => Array.from({ length: n }, (_, i) =>
  ({ urutan: i + 1, tanggal: `2026-${String(9 + i).padStart(2, '0')}-15`, nominal }));

function susun(dasar) {
  const pilih = dasar.po_komponen.map((k) => ({ id: k.komponen_id, sesi: k.sesi }));
  const h = hitung(pilih, dasar.jumlah_siswa, dasar.jumlah_guru, KOMPONEN, PRESET);
  const grand_total = dasar.harga_siswa * dasar.jumlah_siswa + dasar.harga_guru * dasar.jumlah_guru;
  return { po: { ...dasar, grand_total }, h };
}

// PO berkelompok: grand total dan harganya dari hitungPerKelompok — bentuk yang sama
// dengan yang ditulis simpanDraf dan diperiksa trigger jaga_lantai_po.
function susunBerkelompok(dasar) {
  const r = hitungPerKelompok({
    kelompok: dasar.po_kelompok.map((k) => ({ nomor: k.nomor, nama: k.nama ?? undefined, hargaSiswa: k.harga_siswa })),
    komponen: dasar.po_komponen.map((k) => ({ id: k.komponen_id, sesi: k.sesi, kelompok: k.kelompok })),
    rombel: dasar.po_rombel.map((x) => ({ kelas: x.kelas, rombel: x.rombel, jumlah: x.jumlah_siswa, kelompok: x.kelompok })),
    jumlahGuru: dasar.jumlah_guru, hargaGuru: dasar.harga_guru, daftar: KOMPONEN, daftarPaket: PRESET,
  });
  assert.deepEqual(r.masalah, [], 'fixture berkelompok tidak sah');
  return { po: { ...dasar, grand_total: r.grandTotal }, r };
}

const FIXTURE = {
  'sma-paket-guru': {
    sekolah: { nama: 'SMA SANTAMARIA MONICA', jenjang: 'SMA', kepala_sekolah: 'Dra. Maria Uji',
      alamat: 'Jl. Uji No. 1, Bekasi', telepon: '0800-0000-0001' },
    jumlah_siswa: 300, jumlah_guru: 20, harga_siswa: 350000, harga_guru: 150000,
    masa_mulai: '2026-09-01', masa_selesai: '2027-08-31',
    sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Bekasi', tanggal_ttd: '2026-08-20',
    jumlah_rombel: 1, nama_pm: 'Agung Uji', nama_sm: 'Zhurry Uji',
    po_komponen: [...juara.ids.map((id) => ({ komponen_id: id, sesi: 1 })), { komponen_id: guru, sesi: 2 }],
    po_rombel: rombel([10, 11, 12], ['A'], 100),
    po_termin: termin(35_000_000, 3),
    po_catatan: [{ jenis: 'pelaksanaan', isi: 'Mulai semester ganjil.' },
                 { jenis: 'sponsorship', isi: 'Tanpa sponsor.' }],
  },
  'sd-alacarte-addon': {
    sekolah: { nama: 'SD NEGERI UJI 2', jenjang: 'SD' },
    jumlah_siswa: 240, jumlah_guru: 0, harga_siswa: 90000, harga_guru: 0,
    masa_mulai: '2026-07-01', masa_selesai: '2027-06-30',
    sumber_dana: 'Lainnya', sumber_dana_lain: 'Komite sekolah', kota: 'Bandung', tanggal_ttd: null,
    jumlah_rombel: 2, nama_pm: null, nama_sm: null,
    po_komponen: [...alaCarte.map((id) => ({ komponen_id: id, sesi: 1 })),
                  { komponen_id: addonBersesi.id, sesi: 2 }],
    po_rombel: rombel([1, 2, 3, 4, 5, 6], ['A', 'B'], 20),
    po_termin: termin(10_800_000, 2),
    po_catatan: [],
  },
  'smp-paket-custom': {
    sekolah: { nama: 'SMP SARASWATI SERIRIT', jenjang: 'SMP' },
    jumlah_siswa: 30, jumlah_guru: 0, harga_siswa: 284000, harga_guru: 0,
    masa_mulai: '2026-09-01', masa_selesai: '2027-09-30',
    sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Jakarta', tanggal_ttd: '2026-08-07',
    jumlah_rombel: 2, nama_pm: 'Bintang Uji', nama_sm: 'Agung Uji',
    diverifikasi_pada: '2026-08-07T04:00:00Z',
    po_komponen: [...terkecil.ids, diluar.id].map((id) => ({ komponen_id: id, sesi: 1 })),
    po_rombel: [...rombel([7, 8, 9], ['A'], 10), { kelas: 9, rombel: 'B', jumlah_siswa: 0 }],
    po_termin: termin(8_520_000, 1),
    po_catatan: [{ jenis: 'pelaksanaan', isi: 'Kelas 9B belum terdaftar.' }],
  },
  // Empat penanda tangan (catatan/23): Sales Manager berlabel Head of Sales, Regional Head
  // di antara PM dan Head of Sales. Fikstur lain TIDAK punya skema_ttd dan harus tetap
  // tercetak tiga kotak persis seperti rekamannya.
  'sma-empat-ttd': {
    sekolah: { nama: 'SMA SANTAMARIA MONICA', jenjang: 'SMA', kepala_sekolah: 'Dra. Maria Uji',
      alamat: 'Jl. Uji No. 1, Bekasi', telepon: '0800-0000-0001' },
    jumlah_siswa: 300, jumlah_guru: 0, harga_siswa: 350000, harga_guru: 0,
    masa_mulai: '2026-10-01', masa_selesai: '2027-09-30',
    sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Bekasi', tanggal_ttd: '2026-09-25',
    jumlah_rombel: 1, nama_pm: 'Bintang Uji', nama_sm: 'Agung Uji',
    skema_ttd: 4, nama_rh: 'Teuku Zhurry Ariyandi Putra Uji',
    po_komponen: juara.ids.map((id) => ({ komponen_id: id, sesi: 1 })),
    po_rombel: rombel([10, 11, 12], ['A'], 100),
    po_termin: termin(35_000_000, 3),
    po_catatan: [{ jenis: 'pelaksanaan', isi: 'Mulai semester ganjil.' }],
  },
};

// Santamaria dengan pricelist 4.0 (catatan/07): kelas 10 a la carte, kelas 11 paket
// LMS Smart, kelas 12 paket LMS Juara, plus Pelatihan Guru di tingkat PO. Nama kelompok
// sengaja campuran — satu dikosongkan (jadi "Kelas 10"), satu memakai kurung.
const smart = PRESET.find((p) => p.n === 'LMS Smart').ids;
const BERKELOMPOK = {
  'sma-berkelompok': {
    sekolah: { nama: 'SMA SANTAMARIA MONICA', jenjang: 'SMA', kepala_sekolah: 'Dra. Maria Uji',
      alamat: 'Jl. Uji No. 1, Bekasi', telepon: '0800-0000-0001' },
    jumlah_siswa: 300, jumlah_guru: 20, harga_siswa: 0, harga_guru: 150000,
    masa_mulai: '2026-09-01', masa_selesai: '2027-08-31',
    sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Bekasi', tanggal_ttd: '2026-09-12',
    jumlah_rombel: 1, nama_pm: 'Agung Uji', nama_sm: 'Zhurry Uji', diverifikasi_pada: '2026-09-12T04:00:00Z',
    po_kelompok: [{ nomor: 1, nama: null, harga_siswa: 279000 }, { nomor: 2, nama: 'Kelas 11', harga_siswa: 240000 },
                  { nomor: 3, nama: 'Kelas 12 (TKA)', harga_siswa: 350000 }],
    po_komponen: [...[...smart, 'asesmen'].map((id) => ({ komponen_id: id, sesi: 1, kelompok: 1 })),
                  ...smart.map((id) => ({ komponen_id: id, sesi: 1, kelompok: 2 })),
                  ...juara.ids.map((id) => ({ komponen_id: id, sesi: 1, kelompok: 3 })),
                  { komponen_id: guru, sesi: 2, kelompok: 1 }],
    po_rombel: [{ kelas: 10, rombel: 'A', jumlah_siswa: 100, kelompok: 1 },
                { kelas: 11, rombel: 'A', jumlah_siswa: 100, kelompok: 2 },
                { kelas: 12, rombel: 'A', jumlah_siswa: 60, kelompok: 3 },
                { kelas: 12, rombel: 'B', jumlah_siswa: 40, kelompok: 3 }],
    po_termin: termin(29_966_667, 2).concat([{ urutan: 3, tanggal: '2026-11-15', nominal: 29_966_666 }]),
    po_catatan: [{ jenis: 'pelaksanaan', isi: 'Tiga kelompok per angkatan.' }],
  },
};

const keputusan = [
  { fungsi: 'education', hasil: 'setuju_catatan', catatan: 'Materi kelas 9 menyusul.', berlaku: true },
  { fungsi: 'tech_ops', hasil: 'setuju', catatan: null, berlaku: true },
  { fungsi: 'finance', hasil: 'tolak', catatan: 'Sudah diperbaiki.', berlaku: false },
  { fungsi: 'finance', hasil: 'setuju', catatan: null, berlaku: true },
  { fungsi: 'service_account', hasil: 'setuju', catatan: null, berlaku: true },
];

const buat = process.env.BUAT_EMAS === '1';
let n = 0;
for (const [nama, dasar] of [...Object.entries(FIXTURE), ...Object.entries(BERKELOMPOK)]) {
  const bk = !!dasar.po_kelompok;
  const { po, h, r } = bk ? susunBerkelompok(dasar) : susun(dasar);
  const keluaran = {
    'po.html': dokumenPo(D.dataDokumenDariPo(po)),
    'surat.html': dokumenSurat(D.dataSuratDariPo(po, keputusan, 'Dwiva Uji')),
    'pks.html': dokumenPks(D.dataPksDariPo(po, '/EXTSKOLLA/PKS/IX/2026')),
    // Tier 0 (Price List) dan 1 (Bottom — lantai yang ditegakkan periksa()) saja.
    'harga.json': JSON.stringify(bk ? {
      kelompok: r.kelompok.map((k) => ({ nomor: k.nomor, siswa: k.siswa, kelas: k.kelas, paket: k.hitungan.paket,
        perSiswa: k.hitungan.perSiswa.slice(0, 2), lantai: k.lantai, hargaSiswa: k.hargaSiswa, subtotal: k.subtotal })),
      guru: { perGuru: r.guru.hitungan.perGuru.slice(0, 2), lantai: r.guru.lantai, subtotal: r.guru.subtotal },
      grandTotal: r.grandTotal,
    } : {
      paket: h.paket,
      perSiswa: h.perSiswa.slice(0, 2), perGuru: h.perGuru.slice(0, 2), total: h.total.slice(0, 2),
      lantaiSiswa: h.perSiswa[1], grandTotal: po.grand_total,
    }, null, 2) + '\n',
  };
  for (const [berkas, isi] of Object.entries(keluaran)) {
    const jalur = new URL(`./emas/${nama}.${berkas}`, import.meta.url);
    if (buat) { writeFileSync(jalur, isi); continue; }
    const emas = readFileSync(jalur, 'utf8');
    assert.ok(isi === emas,
      `${nama}.${berkas} BERBEDA dari rekaman emas — dokumen atau harga PO lama berubah. `
      + `Bandingkan dengan: BUAT_EMAS=1 node uji/emas.test.mjs && git diff uji/emas/`);
    n++;
  }
  if (!buat) console.log(`  OK  ${nama}: Form PO, Surat, PKS, dan harga identik dengan rekaman`);
}
console.log(buat ? `\nrekaman emas ditulis ke uji/emas/` : `\n${n} berkas emas cocok byte per byte.`);
