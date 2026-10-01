// Dokumen HARUS memakai salinan data sekolah yang dibekukan di PO, bukan baris
// `sekolah` yang hidup.
//
// Baris itu dipakai bersama seluruh sales dan disatukan lewat NPSN, jadi kalau
// dokumen membacanya hidup, PKS yang sudah ditandatangani basah di atas meterai
// akan mencetak nama berbeda begitu sales lain membetulkan ejaan sekolah itu.
// Terbukti bisa terjadi: kebijakan `sekolah_ubah` mengizinkan seluruh keluarga
// sales menimpa data sekolah milik siapa pun.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const D = muat('dokumen-dari-po');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const BEKU = { nama: 'SMA Nama Saat Ditandatangani', jenjang: 'SMA',
  kepala_sekolah: 'Kepsek Saat Ditandatangani', alamat: 'Alamat Lama' };
const HIDUP = { nama: 'SMA Nama Ditimpa Sales Lain', jenjang: 'SMA',
  kepala_sekolah: 'Kepsek Ditimpa', alamat: 'Alamat Baru' };

const po = {
  sekolah: HIDUP, sekolah_beku: BEKU,
  jumlah_siswa: 100, jumlah_guru: 2, harga_siswa: 150000, harga_guru: 200000,
  grand_total: 15400000, masa_mulai: '2026-01-01', masa_selesai: '2026-12-31',
  sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Jakarta', tanggal_ttd: '2026-08-30',
  jumlah_rombel: 2, nama_pm: 'PM', nama_sm: 'SM', diverifikasi_pada: '2026-08-30T00:00:00Z',
  po_komponen: [{ komponen_id: 'lms', sesi: 1 }],
  po_rombel: [{ kelas: 10, rombel: 'A', jumlah_siswa: 30 }],
  po_termin: [{ urutan: 1, tanggal: '2026-02-01', nominal: 15400000 }],
  po_catatan: [],
};

assert.equal(D.sekolahDokumen(po).nama, BEKU.nama);
assert.equal(D.sekolahDokumen(po).kepala_sekolah, BEKU.kepala_sekolah);
ok('sekolahDokumen memilih salinan beku, bukan baris hidup');

const dokPo = D.dataDokumenDariPo(po);
assert.equal(dokPo.sekolah.nama, BEKU.nama);
assert.equal(dokPo.sekolah.kepala_sekolah, BEKU.kepala_sekolah);
ok('Form Pre Order memakai salinan beku');

const surat = D.dataSuratDariPo(po, [], 'Lead');
assert.equal(surat.namaMitra, BEKU.nama);
ok('Surat Verifikasi Kesiapan memakai salinan beku');

const pks = D.dataPksDariPo(po, '/EXTSKOLLA/PKS/VIII/2026');
assert.equal(pks.sekolah.nama, BEKU.nama);
assert.equal(pks.sekolah.kepala_sekolah, BEKU.kepala_sekolah);
ok('PKS memakai salinan beku');

// Tanpa salinan beku, jatuh ke baris hidup — bukan mencetak kosong. Ini jalur
// PO yang masih draf, yang memang menyegarkan salinannya tiap kali disimpan.
const tanpaBeku = { ...po, sekolah_beku: null };
assert.equal(D.sekolahDokumen(tanpaBeku).nama, HIDUP.nama);
assert.equal(D.dataPksDariPo(tanpaBeku, 'x').sekolah.nama, HIDUP.nama);
ok('tanpa salinan beku, jatuh ke baris hidup alih-alih kosong');

// Tanpa keduanya pun dokumen tetap terbentuk, dengan jenjang bawaan.
assert.equal(D.sekolahDokumen({}).jenjang, 'SMA');
ok('tanpa dua-duanya, jenjang bawaan dipakai dan dokumen tetap terbentuk');

// Formulir sunting. Sekolah yang dialihkan ke sales lain tak terlihat (sematan null):
// isian dari salinan beku, id sekolah TETAP id PO — tanpa id, simpanDraf mengira
// sekolah baru dan membuat duplikat (dibuktikan dalam simulasi, 11 Sep 2026).
const SALES = { email: 'a@skolla.education', peran: ['sales'] };
const MILIK = { ...HIDUP, dipegang_oleh: 'a@skolla.education' };
const terlihat = D.sekolahUntukSunting({ sekolah_id: 's1', sekolah: MILIK, sekolah_beku: BEKU }, SALES);
assert.deepEqual([terlihat.terkunci, terlihat.sekolah.nama, terlihat.sekolah.id], [false, HIDUP.nama, 's1']);
const dialihkan = D.sekolahUntukSunting({ sekolah_id: 's1', sekolah: null, sekolah_beku: BEKU }, SALES);
assert.deepEqual([dialihkan.terkunci, dialihkan.sekolah.nama, dialihkan.sekolah.id], [true, BEKU.nama, 's1']);
ok('formulir sunting: sekolah tak terlihat -> salinan beku, id sama, terkunci');

// Terlihat BUKAN berarti boleh ditulis: {finance, sales} melihat semua sekolah, tapi
// sekolah_ubah menolaknya menulis milik sales lain (QA 11 Sep 2026: 42501).
const LAIN = { ...HIDUP, dipegang_oleh: 'b@skolla.education' };
const fin = D.sekolahUntukSunting({ sekolah_id: 's1', sekolah: LAIN, sekolah_beku: BEKU },
  { email: 'a@skolla.education', peran: ['finance', 'sales'] });
assert.deepEqual([fin.terkunci, fin.sekolah.nama], [true, HIDUP.nama]);
for (const [peran, harap] of [[['sales'], false], [['finance', 'sales'], false],
  [['head_of_sales'], true], [['admin_sales'], true], [['admin_utama'], true]])
  assert.equal(D.bolehUbahSekolah('b@skolla.education', { email: 'a@skolla.education', peran }), harap, peran.join());
assert.equal(D.bolehUbahSekolah('A@Skolla.education', SALES), true);
assert.equal(D.bolehUbahSekolah(null, SALES), false);
ok('bolehUbahSekolah mencerminkan sekolah_ubah: pemegang, Head/Admin Sales, Super Admin');

// Penjaga di server: kiriman yang sama dengan salinan beku lolos, sekecil apa pun
// perubahannya ditolak. Spasi di tepi dan kosong-vs-null bukan perubahan.
const { id: _id, ...kirim } = dialihkan.sekolah;
assert.deepEqual(D.sekolahDiubah(kirim, BEKU), []);
assert.deepEqual(D.sekolahDiubah({ ...kirim, alamat: ' Alamat Lama ', telepon: '' }, BEKU), []);
assert.deepEqual(D.sekolahDiubah({ ...kirim, kepala_sekolah: 'Kepsek Baru' }, BEKU), ['kepala_sekolah']);
assert.deepEqual(D.sekolahDiubah({ nama: 'X' }, null), ['nama']);
ok('sekolahDiubah: hanya perubahan nyata terhadap salinan beku yang terhitung');

console.log(`\n${n} pemeriksaan lolos.`);
