import Link from 'next/link';
import { PERIODE, type Rentang } from '@/lib/periode';

/**
 * Baris rentang waktu: pilihan cepat di kiri, rentang khusus di pojok kanan.
 * Formulir GET biasa — rentangnya tersimpan di alamat sehingga bisa ditandai
 * dan dibagikan, dan tetap jalan tanpa JavaScript.
 */
export default function SaringWaktu({
  dasar, r, simpan, bawaan = '12',
}: {
  dasar: string;
  r: Rentang;
  /** Periode yang berarti "tanpa parameter di alamat". Dashboard dan Analytics
   *  memakai 12 bulan; direktori Sekolah memakai 'semua', karena daftar sekolah
   *  tidak boleh menyembunyikan siapa pun secara bawaan. */
  bawaan?: string;
  /** Penyaring lain di halaman yang sama, ikut dibawa supaya tidak terbuang
   *  saat rentang waktunya diganti. */
  simpan?: Record<string, string | undefined>;
}) {
  const hariIni = new Date().toISOString().slice(0, 10);
  const lain = Object.entries(simpan ?? {}).filter(([, v]) => v);
  const taut = (param?: [string, string]) => {
    const p = new URLSearchParams();
    if (param) p.set(param[0], param[1]);
    for (const [k, v] of lain) p.set(k, v!);
    const s = p.toString();
    return s ? `${dasar}?${s}` : dasar;
  };
  return (
    <div className="saring-waktu">
      <div className="status-baris" role="group" aria-label="Rentang cepat">
        {PERIODE.map((x) => (
          <Link key={x.kode} href={x.kode === bawaan ? taut() : taut(['periode', x.kode])}
            className="status-chip" aria-current={r.periode === x.kode}>
            <span>{x.label}</span>
          </Link>
        ))}
      </div>
      <form className="saring-tanggal" method="get" action={dasar}>
        {lain.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label htmlFor="s-dari">Dari</label>
        <input id="s-dari" type="date" name="dari" defaultValue={r.khusus ? r.dari : ''} max={hariIni} />
        <label htmlFor="s-sampai">sampai</label>
        <input id="s-sampai" type="date" name="sampai" defaultValue={r.khusus ? r.sampai : ''} max={hariIni} />
        <button type="submit" className="preset">Terapkan</button>
        {r.khusus && <Link href={taut()} className="preset">Hapus</Link>}
      </form>
    </div>
  );
}
