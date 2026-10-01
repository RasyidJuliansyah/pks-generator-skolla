/**
 * Dua syarat sponsorship di satu tempat: apakah sebuah PO bersponsorship, dan apakah
 * konfirmasi Finance untuknya sudah berlaku.
 *
 * Syarat pertama adalah cerminan `v_sponsor` di `public.unggah_pks_basah`, dan keduanya
 * dipakai EMPAT tempat: kotak konfirmasi dan kotak unggah di halaman PKS, peringatan di
 * halaman PO, dan antrean Finance di daftar PKS. Salinan yang melenceng tidak memunculkan
 * galat apa pun — yang terjadi hanyalah PO yang hilang dari antrean, atau kotak yang
 * mengaku "sudah dikonfirmasi" sementara unggahannya tetap ditolak basis data. Karena itu
 * syaratnya tidak boleh ditulis ulang di tempat lain, termasuk oleh komponen yang memakainya.
 *
 * Sengaja tanpa impor apa pun: `uji/muat.mjs` memuatnya, dan uji itu menyelesaikan impor
 * relatif secara rekursif — modul tanpa impor tidak bisa pecah karenanya.
 */

export type KonfirmasiSponsorship = {
  versi_po: number;
  form_ditandatangani: boolean;
  rekening_atas_nama_lembaga: boolean;
  meterai_bila_di_atas_5juta: boolean;
  oleh: string;
  pada: string;
};

/**
 * `btrim(coalesce(isi, '')) <> ''` — sama PERSIS dengan gerbang unggah, bukan `isi.trim()`.
 *
 * Postgres `btrim` membuang spasi saja, sedangkan `trim()` JavaScript juga membuang tab,
 * baris baru, dan spasi tak-terpisah. Bedanya nyata dan satu arah: catatan berisi tab saja
 * terbaca KOSONG oleh `trim()` tetapi TIDAK kosong bagi basis data — sehingga PO yang pasti
 * ditolak saat diunggah justru hilang dari antrean Finance, dan peringatan untuk Sales ikut
 * diam. Karena itu yang dipakai di sini "apakah masih ada karakter selain spasi", bukan trim.
 */
const adaIsi = (isi: string | null) => (isi ?? '').replace(/ /g, '') !== '';

/** Catatan berisi ATAU nilainya diisi — PO lama tanpa nilai tetap bersponsorship. */
export function adaSponsorship(po: {
  po_catatan?: { jenis: string; isi: string | null }[] | null;
  nilai_sponsorship?: number | null;
}): boolean {
  return (po.po_catatan ?? []).some((c) => c.jenis === 'sponsorship' && adaIsi(c.isi))
    || (po.nilai_sponsorship ?? 0) > 0;
}

/**
 * Konfirmasi untuk versi PO yang bukan versi sekarang TIDAK berlaku — bukan karena ada yang
 * menghapusnya, melainkan karena nomor versinya tidak cocok. PO yang direvisi harus
 * dikonfirmasi ulang, dan gerbang unggah di basis data menuntut hal yang sama.
 */
export function konfirmasiBeres(
  k: KonfirmasiSponsorship | null | undefined, versiPo: number,
): boolean {
  return !!k && k.versi_po === versiPo
    && k.form_ditandatangani && k.rekening_atas_nama_lembaga && k.meterai_bila_di_atas_5juta;
}
