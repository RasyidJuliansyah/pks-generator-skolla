/**
 * Mengubah angka rupiah menjadi kata, seperti "Tujuh Puluh Lima Juta Rupiah"
 * pada PKS asli.
 *
 * Dipisah ke berkasnya sendiri karena inilah bagian PKS yang paling mudah salah
 * tanpa ketahuan: nilainya tercetak berdampingan dengan angkanya di dokumen yang
 * mengikat secara hukum, jadi selisih satu kata pun berarti dua nilai berbeda
 * dalam satu perjanjian.
 *
 * Kaidah yang dipakai: "seratus" dan "seribu" (bukan "satu ratus"), "sebelas"
 * sampai "sembilan belas", dan "sepuluh".
 */

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];

/** Mengeja bilangan 0-999. */
function ratusan(n: number): string {
  if (n === 0) return '';
  if (n < 10) return SATUAN[n];
  if (n < 20) {
    if (n === 10) return 'Sepuluh';
    if (n === 11) return 'Sebelas';
    return `${SATUAN[n - 10]} Belas`;
  }
  if (n < 100) {
    const puluh = Math.floor(n / 10), sisa = n % 10;
    return `${SATUAN[puluh]} Puluh${sisa ? ' ' + SATUAN[sisa] : ''}`;
  }
  const ratus = Math.floor(n / 100), sisa = n % 100;
  const awal = ratus === 1 ? 'Seratus' : `${SATUAN[ratus]} Ratus`;
  return `${awal}${sisa ? ' ' + ratusan(sisa) : ''}`;
}

const SKALA = ['', 'Ribu', 'Juta', 'Miliar', 'Triliun'];

/** Mengeja bilangan bulat non-negatif menjadi kata. */
export function terbilang(n: number): string {
  const bulat = Math.floor(Math.abs(n));
  if (bulat === 0) return 'Nol';

  // Dipecah per tiga angka dari belakang: ribuan, jutaan, dan seterusnya.
  const kelompok: number[] = [];
  for (let sisa = bulat; sisa > 0; sisa = Math.floor(sisa / 1000)) kelompok.push(sisa % 1000);
  if (kelompok.length > SKALA.length) throw new RangeError('Angka terlalu besar untuk dieja.');

  const bagian: string[] = [];
  for (let i = kelompok.length - 1; i >= 0; i--) {
    if (kelompok[i] === 0) continue;
    // "Seribu", bukan "Satu Ribu" — tapi "Satu Juta" tetap "Satu Juta".
    const kata = i === 1 && kelompok[i] === 1 ? 'Seribu' : `${ratusan(kelompok[i])} ${SKALA[i]}`.trim();
    bagian.push(kata);
  }
  return bagian.join(' ');
}

/** "Rp 75.000.000,- (Tujuh Puluh Lima Juta Rupiah)", format PKS asli. */
export function rupiahPenuh(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))},- (${terbilang(n)} Rupiah)`;
}
