// Bidang harga di langkah "Paket & harga" menolak turun di bawah bottom price: nilainya
// naik lagi ke lantai saat bidang ditinggalkan. Dua hal yang mudah hilang tanpa disadari
// saat berkas itu disunting lagi, dan keduanya tidak terlihat dari uji mana pun:
//
//  1. Prop `lantai` pada ketiga InputAngka harga. Tanpa itu clamp-nya mati diam-diam —
//     `min` bawaan HTML tidak menghalangi apa pun yang diketik.
//  2. Pengecualian PO unggahan. Kertasnya sudah ditandatangani, jadi lantainya TIDAK
//     boleh dipaksakan di layar; penegakannya di basis data saat pengajuan, tempat
//     pengecualian Head of Operations berlaku (lihat use-form-po.ts dan
//     supabase/migrasi/20260909_lantai_harga_di_basis_data.sql). Clamp yang ikut
//     berlaku di jalur unggahan membuat PO kertas tidak bisa dicatat apa adanya.
//
// Lantai di layar hanyalah kenyamanan; gerbang sebenarnya trigger basis data. Uji ini
// menjaga kenyamanan itu tetap ada DAN tetap tidak berlaku untuk PO unggahan.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const jalan = new URL('../app/(sistem)/po/baru/langkah/paket.tsx', import.meta.url).pathname;
const sumber = readFileSync(jalan, 'utf8');
const pohon = ts.createSourceFile(jalan, sumber, ts.ScriptTarget.Latest, true);

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

/** Semua elemen JSX bernama `nama`, dicari lewat pengurai, bukan regex. */
function elemen(nama) {
  const temu = [];
  const jelajah = (s) => {
    if ((ts.isJsxOpeningElement(s) || ts.isJsxSelfClosingElement(s))
      && s.tagName.getText() === nama) temu.push(s);
    ts.forEachChild(s, jelajah);
  };
  jelajah(pohon);
  return temu;
}

const atribut = (el, nama) => el.attributes.properties.find(
  (a) => ts.isJsxAttribute(a) && a.name.getText() === nama) ?? null;

// Hanya bidang HARGA yang berlantai. Penghitung sesi juga InputAngka, dan ia memang
// tidak boleh ikut: lantainya bukan rupiah.
const HARGA = ['f-hs', 'f-hg', 'f-hk'];
const bidangHarga = elemen('InputAngka').filter((el) => {
  const id = atribut(el, 'id');
  return id ? HARGA.some((h) => id.initializer.getText().includes(h)) : false;
});

{
  assert.equal(bidangHarga.length, 3,
    `Diharapkan 3 bidang harga (${HARGA.join(', ')}), ketemu ${bidangHarga.length}. `
    + 'Bila bidangnya memang bertambah atau berkurang, sesuaikan uji ini bersamaan.');
  ok('ketiga bidang harga ditemukan');
}

{
  const tanpa = bidangHarga.filter((el) => !atribut(el, 'lantai'));
  assert.equal(tanpa.length, 0,
    `${tanpa.length} bidang harga kehilangan prop \`lantai\`, jadi harga di bawah bottom `
    + 'price bisa diketik dan dibiarkan begitu saja. `min` HTML tidak menghalangi apa pun.');
  ok('ketiga bidang harga memakai prop lantai');
}

// Gerbangnya harus benar-benar dirangkai ke asal PO, bukan lantai telanjang.
{
  assert.match(sumber, /const\s+kunciLantai\s*=\s*asal\s*!==\s*'unggahan'/,
    'kunciLantai tidak lagi diturunkan dari `asal !== \'unggahan\'`. Lantai yang ikut '
    + 'berlaku di jalur unggahan membuat PO kertas yang sudah ditandatangani tidak bisa '
    + 'dicatat apa adanya.');

  // Bentuknya diperiksa, bukan sekadar disebut: `kunciLantai ? 0 : lantai` juga
  // mengandung kata "kunciLantai" tapi mematikan clamp justru di jalur platform dan
  // menyalakannya di jalur unggahan — kebalikan dari yang dimaksud.
  const BENAR = /^kunciLantai\s*\?\s*(?!0\s*:)[^:]+:\s*0$/;
  const lupaGerbang = bidangHarga.filter(
    (el) => !BENAR.test(atribut(el, 'lantai').initializer.getText().replace(/^\{|\}$/g, '').trim()));
  assert.equal(lupaGerbang.length, 0,
    `${lupaGerbang.length} bidang harga tidak memakai bentuk `
    + '`kunciLantai ? <lantai> : 0`, jadi clamp-nya bisa berlaku untuk PO unggahan atau '
    + 'justru mati untuk PO platform.');
  ok('lantai selalu lewat kunciLantai dengan arah yang benar');
}

console.log(`\n${n} pemeriksaan lantai-klien lolos`);
