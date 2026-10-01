/**
 * Mengambil satu baris dari relasi tersemat PostgREST.
 *
 * PostgREST menyematkan relasi sebagai LARIK bila kunci asingnya boleh berulang,
 * tetapi sebagai OBJEK tunggal bila kolom itu unik. surat_verifikasi dan pks
 * memakai `unique (po_id)` — satu PO satu dokumen — sehingga keduanya datang
 * sebagai objek. Membacanya dengan `[0]` selalu menghasilkan undefined, dan
 * dokumen yang sudah tersimpan tampak seolah tidak pernah ada.
 */
export function satu<T>(nilai: T | T[] | null | undefined): T | undefined {
  if (nilai == null) return undefined;
  return Array.isArray(nilai) ? nilai[0] : nilai;
}
