# Migrasi

Berkas di sini adalah catatan tertulis dari perubahan skema yang diterapkan ke
proyek Supabase `lzamazdfaidxuohhzpjd`. Penerapannya lewat MCP `apply_migration`,
jadi berkas ini bukan yang dijalankan — ia yang dibaca orang saat bertanya
"kenapa aturannya begini".

Setiap migrasi keamanan di sini sudah dibuktikan lebih dulu: serangannya
disimulasikan di dalam transaksi dengan `set local role authenticated` dan klaim
JWT peran yang bersangkutan, ditunjukkan lolos sebelum perbaikan dan ditolak
sesudahnya, berikut alur sahnya yang harus tetap jalan. Lalu `rollback`.
