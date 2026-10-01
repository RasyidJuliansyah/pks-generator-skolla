/**
 * Hitungan halaman untuk daftar panjang.
 *
 * Dipisah sebagai fungsi murni karena tiga hal di sini gampang salah dan
 * salahnya tidak berisik: halaman di luar jangkauan, pembagian yang menyisakan
 * halaman kosong di ujung, dan jendela nomor yang bergeser di dekat tepi.
 * Batas `range()` PostgREST inklusif di kedua ujung, jadi salah satu saja
 * membuat satu baris terlewat di tiap halaman tanpa ada yang menyadarinya.
 */

export type Halaman = {
  kini: number;
  jumlah: number;
  /** Indeks awal, untuk .range() PostgREST. */
  dari: number;
  /** Indeks akhir, INKLUSIF. */
  sampai: number;
  adaSebelum: boolean;
  adaSesudah: boolean;
};

export function halaman(total: number, per: number, minta: unknown): Halaman {
  const n = Math.max(1, Math.floor(per) || 1);
  const jumlah = Math.max(1, Math.ceil(Math.max(0, total) / n));
  const diminta = Math.floor(Number(minta));
  const kini = Number.isFinite(diminta) ? Math.min(Math.max(1, diminta), jumlah) : 1;
  const dari = (kini - 1) * n;
  return {
    kini, jumlah, dari, sampai: dari + n - 1,
    adaSebelum: kini > 1, adaSesudah: kini < jumlah,
  };
}

/**
 * Nomor halaman yang pantas ditampilkan. Selalu selebar `lebar` selama
 * halamannya cukup, dan menempel ke tepi alih-alih menyempit di sana — jendela
 * yang menyusut di halaman pertama dan terakhir membuat tombolnya berpindah
 * tempat saat ditekan berturut-turut.
 */
export function jendela(kini: number, jumlah: number, lebar = 7): number[] {
  const n = Math.min(lebar, jumlah);
  let mulai = kini - Math.floor(n / 2);
  if (mulai < 1) mulai = 1;
  if (mulai + n - 1 > jumlah) mulai = jumlah - n + 1;
  return Array.from({ length: n }, (_, i) => mulai + i);
}
