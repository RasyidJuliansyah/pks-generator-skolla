# Dokumen dan Templat

## Form Pre Order

Tiga kotak A4, paginasi dipatok satu kotak per halaman. Halaman 1 identitas,
harga, rombel, termin; halaman 2 tanda tangan; halaman 3 catatan. Rizki meminta
catatan dan tanda tangan tidak sehalaman.

Cetak diblokir di tingkat dokumen bila harga di bawah bottom price — tombol yang
dinonaktifkan bukan pencegahan, karena Cmd+P tetap mencetak.

## Surat Verifikasi Kesiapan

Disalin dari sembilan surat asli terbitan Tech Ops Lead. **Tidak berkop** —
dokumen aslinya memang polos, satu-satunya gambar di dalamnya tanda tangan.

Dua penyimpangan sengaja: menyebut fungsi yang benar-benar memutuskan (bukan
"Education dan Tech Ops" saja), dan catatannya diambil dari keputusan "setuju
dengan catatan" yang masih berlaku — masalah yang sudah diperbaiki tinggal di
riwayat, tidak ikut tercetak.

## Perjanjian Kerja Sama

14 pasal disalin dari PKS asli SMKS PGRI 1 Surabaya
(`175/EXTSKOLLA/PKS/VIII/2026`).

Kop = gambar A4 penuh `public/kop-pks.png`, berulang tiap halaman. Kotak paraf
PIHAK I/PIHAK II 8mm dari tepi kiri dan 7,6mm dari tepi bawah; nomor halaman
26,5mm dari kanan, dasar teks 18,6mm dari bawah. Semua diukur dari render asli.

Halaman terakhir tanpa paraf: di situ para pihak menandatangani penuh.

Ruang yang dibiarkan kosong untuk diisi tangan: hari, tanggal, dan tempat
penandatanganan, angka nomor perjanjian, Nomor Perjanjian Mitra, surel kedua pihak.

**Terbilang** dipisah ke `lib/terbilang.ts` berikut ujinya: nilainya tercetak
berdampingan dengan angkanya di dokumen yang mengikat secara hukum.

**Paginasi diukur di peramban** (`lib/paginasi-pks.ts`), bukan diserahkan ke CSS:
CSS tidak bisa menyebut jumlah halaman total dan latar berulang tidak seragam
antar peramban. Seluruh pembantunya disarangkan dalam satu fungsi supaya utuh
saat dikirim ke peramban di server.
