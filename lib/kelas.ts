/**
 * Angkatan per jenjang. Satu-satunya definisi — dulu diketik dua kali, di
 * `dokumen-dari-po.ts` dan `form-po.tsx`.
 *
 * Sengaja berkas sendiri TANPA impor apa pun: form PO adalah komponen klien, dan
 * mengimpor ini dari `dokumen-dari-po.ts` akan ikut menyeret `pricelist.ts` ke
 * peramban.
 */
export const KELAS: Record<string, number[]> = {
  SD: [1, 2, 3, 4, 5, 6], SMP: [7, 8, 9], SMA: [10, 11, 12],
};
