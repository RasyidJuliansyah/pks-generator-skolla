import Link from 'next/link';
import type { Halaman } from '@/lib/paginasi';
import { jendela } from '@/lib/paginasi';

/**
 * Kendali halaman. Dipakai bersama empat daftar, supaya tombolnya berada di
 * tempat yang sama dan berperilaku sama di semuanya.
 *
 * `taut` diserahkan ke halaman pemanggil karena tiap daftar punya penyaingnya
 * sendiri yang harus ikut terbawa. Yang TIDAK boleh ikut terbawa: nomor halaman
 * saat penyaringnya diganti — itu urusan pemanggil juga.
 */
export default function HalamanNav({
  h, taut, label,
}: {
  h: Halaman;
  /** Alamat untuk sebuah nomor halaman; `undefined` berarti halaman pertama. */
  taut: (hal?: string) => string;
  label?: string;
}) {
  if (h.jumlah <= 1) return null;
  return (
    <nav className="halaman-baris" aria-label={label ?? 'Navigasi halaman'}>
      <Link href={taut(h.adaSebelum ? String(h.kini - 1) : undefined)}
        className={`status-chip${h.adaSebelum ? '' : ' nol'}`}
        aria-disabled={!h.adaSebelum || undefined}>
        <span>← Sebelumnya</span>
      </Link>
      {jendela(h.kini, h.jumlah).map((n) => (
        <Link key={n} href={taut(n === 1 ? undefined : String(n))}
          className="status-chip" aria-current={n === h.kini}
          aria-label={`Halaman ${n}`}>
          <span>{n}</span>
        </Link>
      ))}
      <Link href={taut(h.adaSesudah ? String(h.kini + 1) : undefined)}
        className={`status-chip${h.adaSesudah ? '' : ' nol'}`}
        aria-disabled={!h.adaSesudah || undefined}>
        <span>Berikutnya →</span>
      </Link>
    </nav>
  );
}
