# Peran dan Keamanan

## Prinsip

Penjagaan sungguhan ada di basis data, bukan di tampilan. Tombol yang
disembunyikan, menu yang disaring, dan halaman yang mengalihkan hanyalah
kenyamanan — alamat rutenya bisa dibuka langsung.

Pola ini terbukti berulang kali: cetak PO di bawah bottom price diblokir di
tingkat dokumen; unduh PDF PKS ditolak rute bila belum final; penjaga Admin
Utama berupa trigger, bukan pemeriksaan halaman.

## Peran

`sales`, `head_of_sales`, `head_of_operations`, `cbo`, `admin_utama`,
`admin_sales`, `education`, `tech_ops`, `finance`, `service_account`,
`tech_ops_lead`.

Tabel `pengguna` sekaligus daftar izin: tanpa baris di sana, login Google yang
sah pun tidak melihat apa pun. Empat keadaan tanpa akses, masing-masing dengan
pesannya sendiri: domain salah, belum terdaftar, belum diberi peran, nonaktif.

## Fungsi pembantu

Ada di skema `private`, bukan `public`, supaya tidak terekspos sebagai endpoint
RPC PostgREST: `peran_saya()`, `punya_peran()`, `boleh_lihat_po()`,
`boleh_ubah_po()`, `milik_sales()`, `fungsi_saya_cocok()`.

Yang harus dipanggil dari aplikasi terpaksa berada di `public` dan memeriksa
izinnya sendiri di dalam fungsinya: `basikan_verifikasi`, `buat_pks`,
`finalisasi_pks`, `unggah_pks_basah`, `daftar_penanda_tangan`.

## Penjaga Admin Utama

Trigger menolak: mencabut peran Admin Utama dari akun sendiri, menonaktifkan
akun sendiri, dan menghapus Admin Utama aktif yang terakhir. Menyerahkan peran
harus lewat admin lain.

Akun tidak pernah dihapus, hanya dinonaktifkan — PO, tanda tangan, dan keputusan
verifikasi merujuk ke alamatnya.

## Berkas

Bucket privat. Tanda tangan PO di `tanda-tangan/`, tanda tangan surat di awalan
`surat/` pada bucket yang sama dengan izin terbatas ke awalan itu, dan pindaian
PKS di bucket `pks-basah` yang izin bacanya diikat ke PO-nya lewat awalan jalur —
bukan sekadar "punya peran apa pun", karena isinya perjanjian bermeterai milik
sekolah.
