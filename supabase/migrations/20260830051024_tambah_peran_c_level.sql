-- Peran C Level: melihat seluruh sistem, tidak menulis apa pun.
--
-- Kemampuannya sendiri bukan hal baru — `cbo` dan `head_of_operations` sudah
-- persis begitu, dan sudah dibuktikan lewat sepuluh probe. Yang baru cuma
-- labelnya, dan itu tetap ada gunanya: memberi CEO peran bernama `cbo` keliru
-- dan membingungkan orang yang membaca daftar pengguna setahun lagi.
--
-- Nilai enum ditambahkan di migrasi terpisah karena Postgres tidak mengizinkan
-- nilai enum baru DIPAKAI di transaksi yang sama dengan penambahannya.
alter type peran add value if not exists 'c_level';
