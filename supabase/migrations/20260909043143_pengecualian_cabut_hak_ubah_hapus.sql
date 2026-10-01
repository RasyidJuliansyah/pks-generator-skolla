-- RLS sudah menahan UPDATE dan DELETE, tapi menahannya DIAM-DIAM: pemanggil menerima
-- sukses dengan nol baris. Untuk catatan persetujuan, penolakannya sebaiknya terdengar —
-- mencabut haknya membuat percobaan mengubah atau menghapus gagal dengan galat izin,
-- bukan lewat tanpa jejak.
revoke update, delete on po_pengecualian from authenticated, anon;
