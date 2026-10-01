// Bidang uang di wizard (termin, nilai sponsorship) mengetik teks, bukan angka:
// type="number" tidak bisa menampilkan pemisah ribuan, dan tanpa pemisah "15000000"
// salah dibaca sebagai 1,5 juta oleh mata yang lelah. Dua fungsi di bawah adalah
// seluruh isi bidang itu yang bisa diuji tanpa DOM, jadi di sinilah kaidahnya dijaga.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { digitRupiah, digitRupiahDiketik, angkaRupiah, rupiahDariPersen, persenTeks, angkaPersen }
  = muat('format');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Bentuk yang dilihat Sales saat mengetik
{
  assert.equal(digitRupiah('1000000'), '1.000.000');
  assert.equal(digitRupiah('75000'), '75.000');
  assert.equal(digitRupiah('500'), '500');
  ok('digit dikelompokkan gaya id-ID');
}

// Bidang boleh kosong sementara diketik: memaksanya jadi "0" membuat nolnya tidak
// bisa dihapus, dan angka baru menempel di belakangnya - "12" jadi "012".
{
  assert.equal(digitRupiah(''), '');
  assert.equal(angkaRupiah(''), 0);
  ok('kosong tetap kosong, bukan nol');
}

// Nol di depan dibuang, sama seperti InputAngka
{
  assert.equal(digitRupiah('0001000'), '1.000');
  assert.equal(digitRupiah('0'), '0');
  assert.equal(digitRupiah('00'), '0');
  ok('nol di depan dibuang, nol tunggal bertahan');
}

// Yang diketik orang sungguhan: titik dari format sebelumnya, spasi, "Rp", huruf
{
  assert.equal(digitRupiah('1.000.000'), '1.000.000');
  assert.equal(digitRupiah('Rp 2.500.000'), '2.500.000');
  assert.equal(digitRupiah('abc'), '');
  ok('non-digit dibuang, termasuk titik dan Rp dari tempelan');
}

// Tempelan dari Sheets/Excel membawa desimal. Membuang SEMUA non-digit membuat
// "Rp1.500.000,00" jadi 150.000.000 — seratus kali lipat, diam-diam, lalu ikut
// tercetak di PO yang ditandatangani. Bidang type="number" yang lama menolaknya
// terang-terangan (kosong); penggantinya tidak boleh gagal lebih halus.
//
// Kaidahnya: ekor "<pemisah><1-2 digit>" di UJUNG teks adalah desimal, sebab
// kelompok ribuan selalu tepat tiga digit. Berlaku untuk koma (id-ID) maupun
// titik (en-US), jadi tempelan dua-duanya terbaca benar.
{
  assert.equal(digitRupiah('Rp1.500.000,00'), '1.500.000');
  assert.equal(digitRupiah('1.500.000,50'), '1.500.000');
  assert.equal(digitRupiah('1500000,00'), '1.500.000', 'tanpa pemisah ribuan pun terbaca');
  assert.equal(digitRupiah('1,500,000.00'), '1.500.000', 'format en-US');
  assert.equal(digitRupiah('1.500.000'), '1.500.000', 'ribuan tiga digit bukan desimal');
  ok('ekor desimal dibuang, kelompok ribuan tidak');
}

// Tempelan dari Excel/Sheets membawa sampah di ujung. Format Accounting menyisipkan
// SATU SPASI di belakang angka positif untuk menyediakan kolom tanda minus, dan
// angka negatifnya dikurung. Tanpa dirapikan dulu, jangkar $ meleset dan ekor
// desimalnya lolos - persis kembali ke salah seratus kali lipat.
{
  assert.equal(digitRupiah('1.500.000,00 '), '1.500.000', 'spasi buntut Accounting');
  assert.equal(digitRupiah('1.500.000,00\u00a0'), '1.500.000', 'spasi tanpa putus');
  assert.equal(digitRupiah('(1.500.000,00)'), '1.500.000', 'kurung Accounting');
  ok('spasi dan kurung dari Excel tidak menggagalkan pembacaan desimal');
}

// Koma yang DIKETIK, bukan ditempel.
//
// Aturan ekor desimal bersandar pada satu anggapan: koma tidak mungkin lahir dari
// mengetik, sebab pemformat di sini hanya mengeluarkan titik. Anggapan itu benar soal
// pemformatnya, tapi tidak soal penggunanya — papan ketik angka Indonesia punya tombol
// koma, dan inputMode="numeric" cuma anjuran, bukan pagar. Menaruh kursor di tengah
// nilai lalu menekan koma membuat "1.500.000" jadi "1.500.0,00", dan aturan desimal
// membacanya sebagai ,00 lalu memangkasnya jadi Rp15.000.
//
// Karena itu ada dua pintu: yang diketik membuang koma dulu (koma jadi tidak berarti
// apa-apa, tidak ada digit yang hilang), yang ditempel baru dikenai aturan desimal.
// Komponen InputRupiah-lah yang memilih pintunya, jadi anggapan di atas bukan lagi
// harapan melainkan jaminan.
{
  assert.equal(digitRupiahDiketik('1.500.0,00'), '1.500.000', 'koma diketik di tengah nilai');
  assert.equal(digitRupiahDiketik('1.500.000,'), '1.500.000', 'koma diketik di ujung');
  assert.equal(digitRupiahDiketik('1,5'), '15', 'yang diketik dibaca apa adanya');
  assert.equal(digitRupiah('1.500.000,00'), '1.500.000', 'yang ditempel tetap kena aturan desimal');
  ok('koma yang diketik diabaikan, koma yang ditempel jadi desimal');
}

// Sapuan: koma diketik di SETIAP posisi nilai terformat tidak boleh menghilangkan digit.
{
  for (const nilai of ['1.234', '1.500.000', '13.200.250']) {
    const digitSemula = nilai.replace(/\D/g, '');
    for (let i = 0; i <= nilai.length; i++) {
      const disisipi = nilai.slice(0, i) + ',' + nilai.slice(i);
      assert.equal(digitRupiahDiketik(disisipi).replace(/\D/g, ''), digitSemula,
        `koma di posisi ${i} pada ${nilai} menghilangkan digit`);
    }
  }
  ok('koma diketik di posisi mana pun tidak menghilangkan digit');
}

// Sampah buntut tidak boleh menggagalkan pembacaan desimal: tempelan dari Sheets bisa
// membawa titik, kurung tak berpasangan, atau spasi di belakang koma desimalnya.
{
  assert.equal(digitRupiah('Rp1.500.000,00.'), '1.500.000', 'titik buntut');
  assert.equal(digitRupiah('1.500.000,00)'), '1.500.000', 'kurung tutup tak berpasangan');
  assert.equal(digitRupiah('1.500.000,00 -'), '1.500.000', 'tanda buntut');
  ok('ekor desimal tetap terbaca meski ada sampah di belakangnya');
}

// PENJAGA UTAMA bidang uang: menghapus satu karakter TIDAK BOLEH melahap nilainya.
//
// Ini yang jebol pada percobaan pertama: aturan ekor desimal dipasang di jalur
// mengetik, padahal "1.500.000" yang dihapus satu karakternya menjadi "1.500.00" -
// bentuk yang sama persis dengan desimal. Satu ketukan Backspace mengubah
// Rp1.500.000 jadi Rp1.500, seribu kali lipat meleset, ke arah sebaliknya dari
// kekeliruan yang hendak diperbaiki.
//
// Pembedanya: pemformat kita HANYA pernah mengeluarkan titik sebagai pemisah ribuan,
// jadi koma di dalam teks pasti datang dari tempelan, bukan dari yang sedang diketik.
{
  for (const tampil of ['1.234', '12.345', '123.456', '1.500.000', '1.980.037']) {
    const digitSemula = tampil.replace(/\D/g, '');
    for (const [nama, f] of [['digitRupiah', digitRupiah], ['digitRupiahDiketik', digitRupiahDiketik]]) {
      assert.equal(f(tampil.slice(0, -1)).replace(/\D/g, ''), digitSemula.slice(0, -1),
        `${nama}: menghapus satu karakter dari ${tampil} harus menyisakan tepat satu digit lebih sedikit`);
    }
  }
  ok('Backspace membuang tepat satu digit, bukan seluruh nilai');
}

// Jalan mundur sampai habis: tiap langkah tepat satu digit berkurang, tidak ada
// langkah yang melompat.
{
  let teks = '1.500.000';
  const panjang = [];
  while (teks !== '') { panjang.push(teks.replace(/\D/g, '').length); teks = digitRupiah(teks.slice(0, -1)); }
  assert.deepEqual(panjang, [7, 6, 5, 4, 3, 2, 1], 'tiap Backspace turun satu digit');
  ok('hapus berulang turun satu-satu sampai kosong');
}

// Mengetik maju juga harus utuh, termasuk saat pemisah ribuan mulai muncul.
{
  let teks = '';
  for (const d of '1500000') teks = digitRupiah(teks + d);
  assert.equal(teks, '1.500.000');
  ok('mengetik maju digit demi digit sampai di angka yang benar');
}

// Persen hanya cara lain mengetik rupiah. Pembulatannya KE BAWAH, sama dengan
// batas yang ditampilkan: dengan Math.round, mengetik tepat "15" bisa menghasilkan
// nilai satu rupiah DI ATAS gerbang 15% (nilai*100 <= grand*15), sehingga PO yang
// seharusnya lolos otomatis malah jatuh ke verifikasi manual. Lihat catatan/18.
{
  const grand = 13_200_250; // 250 siswa x Rp52.801 — pembulatan jatuh tepat di ,5
  const nilai = rupiahDariPersen(15, grand);
  assert.equal(nilai, Math.floor((grand * 15) / 100));
  assert.ok(nilai * 100 <= grand * 15, 'mengetik tepat 15% harus lolos gerbang 15%');
  assert.equal(rupiahDariPersen(0, grand), 0);
  assert.equal(rupiahDariPersen(12.5, 75_000_000), 9_375_000);
  ok('persen ke rupiah dibulatkan ke bawah, tepat 15% tetap lolos');
}

// Desimal koma dua arah, dan tanpa nol buntut yang tidak berguna
{
  assert.equal(persenTeks(12.5), '12,5');
  assert.equal(persenTeks(15), '15');
  assert.equal(angkaPersen('12,5'), 12.5);
  assert.equal(angkaPersen('12.5'), 12.5);
  assert.equal(angkaPersen(''), 0);
  assert.equal(angkaPersen('abc'), 0);
  ok('persen: koma maupun titik terbaca, tampilannya berkoma');
}

// Bolak-balik: apa yang tampil harus terbaca kembali jadi angka yang sama
{
  for (const v of [0, 500, 75_000, 1_000_000, 22_500_000, 1_234_567_890]) {
    assert.equal(angkaRupiah(digitRupiah(String(v))), v, `bolak-balik ${v}`);
  }
  ok('format lalu urai mengembalikan angka semula');
}

// Di atas 15 digit presisi Number mulai berbohong; potong sebelum itu terjadi
// supaya yang tersimpan selalu sama dengan yang terlihat.
{
  assert.equal(angkaRupiah(digitRupiah('9'.repeat(20))), 999_999_999_999_999);
  assert.ok(Number.isSafeInteger(angkaRupiah(digitRupiah('9'.repeat(20)))));
  ok('dipotong 15 digit, tetap bilangan bulat yang aman');
}

console.log(`\n${n} pemeriksaan format rupiah lolos`);
