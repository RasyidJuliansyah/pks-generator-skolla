-- Daftar penanda tangan diambil dari tabel pengguna, jadi sesama akun terdaftar
-- perlu bisa saling melihat. Isinya nama dan email kerja — direktori internal biasa.
-- Penyuntingan tetap hanya Admin Utama.
drop policy if exists pengguna_lihat_diri on pengguna;

create policy pengguna_lihat on pengguna for select to authenticated
  using (private.peran_saya() <> '{}');
