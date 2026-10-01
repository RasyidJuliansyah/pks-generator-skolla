// Skrip tema di app/layout.tsx SENGAJA menyentuh <html> sebelum React menghidrasi:
// itu satu-satunya cara menghindari kedipan tema saat memuat. Akibatnya DOM punya
// data-theme yang tidak ada di HTML kiriman server, dan React 19 mengadukannya:
//
//   "A tree hydrated but some attributes of the server rendered HTML didn't match
//    the client properties" -> <html lang="id"> - data-theme="light"
//
// Peringatan itu muncul di SETIAP halaman dan menenggelamkan galat sungguhan di
// konsol. Penawarnya suppressHydrationWarning pada elemen <html> itu sendiri —
// hanya satu tingkat, jadi anak-anaknya tetap diperiksa React.
//
// Uji ini menjaga pasangannya: selama skrip pra-hidrasi masih ada, penandanya tidak
// boleh ikut terhapus. Tanpa penjaga, peringatannya kembali diam-diam.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const jalan = new URL('../app/layout.tsx', import.meta.url).pathname;
const sumber = readFileSync(jalan, 'utf8');
const pohon = ts.createSourceFile(jalan, sumber, ts.ScriptTarget.Latest, true);

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

/** Elemen JSX pembuka bernama `nama`, dicari lewat pengurai, bukan regex. */
function elemen(nama) {
  let temu = null;
  const jelajah = (simpul) => {
    if ((ts.isJsxOpeningElement(simpul) || ts.isJsxSelfClosingElement(simpul))
      && simpul.tagName.getText() === nama) temu ??= simpul;
    ts.forEachChild(simpul, jelajah);
  };
  jelajah(pohon);
  return temu;
}

const atribut = (el, nama) => el.attributes.properties.find(
  (a) => ts.isJsxAttribute(a) && a.name.getText() === nama) ?? null;

const punyaAtribut = (el, nama) => atribut(el, nama) !== null;

const html = elemen('html');
assert.ok(html, 'elemen <html> tidak ditemukan di app/layout.tsx');

// Skrip pra-hidrasi masih ada? Kalau dicabut, penandanya tidak lagi diperlukan.
const adaSkripTema = sumber.includes('documentElement.dataset.theme');

{
  assert.ok(adaSkripTema,
    'Skrip tema pra-hidrasi hilang dari app/layout.tsx. Bila itu disengaja, uji ini '
    + 'ikut dicabut; bila tidak, temanya akan berkedip saat memuat.');
  ok('skrip tema pra-hidrasi masih terpasang');
}

{
  const tanda = atribut(html, 'suppressHydrationWarning');
  assert.ok(tanda,
    'Elemen <html> di app/layout.tsx kehilangan suppressHydrationWarning, padahal skrip '
    + 'tema masih menyetel data-theme sebelum hidrasi. Peringatan hidrasi React akan '
    + 'kembali muncul di setiap halaman.');
  // Atribut telanjang berarti true. `suppressHydrationWarning={false}` akan lolos
  // pemeriksaan "ada atributnya" padahal mematikan penawarnya sama sekali.
  assert.ok(!tanda.initializer || tanda.initializer.getText() !== '{false}',
    'suppressHydrationWarning disetel {false}: penandanya ada tapi mati.');
  ok('<html> ditandai suppressHydrationWarning, dan tidak dimatikan {false}');
}

// Bawaannya TERANG, apa pun setelan sistem (DESIGN.md dan app/tema.tsx). Yang menjaga
// itu di sisi pra-hidrasi hanya satu baris skrip; kalau ia berubah jadi membaca
// prefers-color-scheme, seluruh aturan "gelap hanya bila dipilih sendiri" batal.
{
  const skrip = sumber.slice(sumber.indexOf('try{'), sumber.indexOf('</script>') + 1);
  assert.ok(/'light'/.test(sumber) && /'dark'/.test(sumber),
    'skrip tema tidak lagi menyebut kedua tema');
  assert.ok(!/prefers-color-scheme/.test(sumber),
    'app/layout.tsx membaca prefers-color-scheme. Bawaannya harus TERANG apa pun setelan '
    + 'sistem; gelap hanya berlaku bila pengguna memilihnya sendiri.');
  assert.ok(/\?\s*'dark'\s*:\s*'light'/.test(sumber),
    "skrip tema tidak lagi jatuh ke 'light' sebagai bawaan");
  ok('bawaan terang, setelan sistem diabaikan');
}

// Server TIDAK boleh ikut merender data-theme: satu-satunya sumbernya localStorage,
// dan nilai tebakan dari server justru yang bisa salah lalu berkedip.
{
  assert.ok(!punyaAtribut(html, 'data-theme'),
    'app/layout.tsx merender data-theme dari server. Nilainya tidak bisa diketahui di '
    + 'sana, jadi tebakannya berpeluang salah dan berkedip saat skrip membetulkannya.');
  ok('server tidak menebak data-theme');
}

console.log(`\n${n} pemeriksaan tema-hidrasi lolos`);
