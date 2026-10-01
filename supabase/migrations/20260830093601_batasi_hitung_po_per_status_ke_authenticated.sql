-- Ditemukan saat pemeriksaan menyeluruh sebelum demo: hitung_po_per_status
-- terbuka untuk PUBLIC dan anon, sementara lima fungsi lain di skema ini
-- dibatasi `authenticated`. Saya yang membuatnya dan lupa menyamakan.
--
-- Tidak membocorkan apa pun — fungsinya SECURITY INVOKER, jadi tunduk RLS
-- pemanggilnya, dan pemanggil anonim memang menerima daftar kosong (sudah
-- diuji lewat REST). Tapi endpoint anonim yang tidak dipakai siapa pun tidak
-- perlu ada, dan pola yang tidak seragam adalah pola yang cepat atau lambat
-- disalin ke tempat yang lebih berbahaya.
revoke execute on function public.hitung_po_per_status() from public, anon;
