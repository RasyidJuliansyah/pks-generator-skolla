/**
 * Rentang waktu bersama untuk Dashboard dan Analytics.
 *
 * Disatukan supaya dua halaman tidak punya dua salinan aturan yang sama —
 * begitu salah satunya berubah, yang lain diam-diam menyimpang dan angkanya
 * tidak lagi bisa dibandingkan.
 */

export const PERIODE = [
  { kode: '3', label: '3 bulan' },
  { kode: '6', label: '6 bulan' },
  { kode: '12', label: '12 bulan' },
  { kode: 'semua', label: 'Semua' },
];

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Kunci bulan "2026-08" -> label "Agu 26". */
export const labelBulan = (kunci: string) => {
  const [t, b] = kunci.split('-');
  return `${BULAN[+b - 1]} ${t.slice(2)}`;
};

export const kunciBulan = (iso: string) => iso.slice(0, 7);

const kunci = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** `n` bulan terakhir sampai bulan ini. */
function deretBulan(n: number): string[] {
  const kini = new Date();
  return Array.from({ length: n }, (_, i) =>
    kunci(new Date(kini.getFullYear(), kini.getMonth() - (n - 1 - i), 1)));
}

/** Bulan ini dan `n-1` bulan berikutnya. */
export function deretBulanDepan(n: number): string[] {
  const kini = new Date();
  return Array.from({ length: n }, (_, i) =>
    kunci(new Date(kini.getFullYear(), kini.getMonth() + i, 1)));
}

/** Deret bulan dari `dari` sampai `sampai`, maksimal 24. */
function bulanAntara(dari: string, sampai: string): string[] {
  const a = new Date(dari + 'T00:00:00');
  const b = new Date(sampai + 'T00:00:00');
  const keluar: string[] = [];
  const d = new Date(a.getFullYear(), a.getMonth(), 1);
  while (d <= b && keluar.length < 24) {
    keluar.push(kunci(d));
    d.setMonth(d.getMonth() + 1);
  }
  return keluar.length ? keluar : [kunci(a)];
}

export type Rentang = {
  periode: string;
  khusus: boolean;
  dari?: string;
  sampai?: string;
  /** Batas bawah rentang sebagai tanggal ISO, untuk disaring di basis data.
   *  Kosong berarti "semua waktu". */
  sejak?: string;
  /** Batas atas, hanya terisi pada rentang khusus. */
  sampaiIso?: string;
  /** Menyaring apa pun yang punya tanggal pembuatan. */
  saring: <T extends { dibuat_pada: string }>(baris: T[]) => T[];
  /** Bulan yang perlu digambar pada grafik deret waktu. */
  bulan: (bawaan: number) => string[];
};

const sah = (t?: string) => !!t && /^\d{4}-\d{2}-\d{2}$/.test(t);

/**
 * Rentang khusus menang atas pilihan cepat; keduanya wajib terisi supaya
 * rentangnya tidak menggantung di satu sisi.
 */
export function bacaRentang(q: { periode?: string; dari?: string; sampai?: string }): Rentang {
  const khusus = sah(q.dari) && sah(q.sampai) && q.dari! <= q.sampai!;
  const periode = khusus ? '' : (PERIODE.some((x) => x.kode === q.periode) ? q.periode! : '12');
  const nBulan = khusus || periode === 'semua' ? null : Number(periode);
  const batas = nBulan
    ? new Date(new Date().getFullYear(), new Date().getMonth() - (nBulan - 1), 1)
    : null;

  return {
    periode, khusus, dari: q.dari, sampai: q.sampai,
    sejak: khusus ? q.dari : (batas ? batas.toISOString().slice(0, 10) : undefined),
    sampaiIso: khusus ? q.sampai : undefined,
    saring: (baris) => khusus
      ? baris.filter((x) => {
          const t = x.dibuat_pada.slice(0, 10);
          return t >= q.dari! && t <= q.sampai!;
        })
      : batas
        ? baris.filter((x) => new Date(x.dibuat_pada) >= batas)
        : baris,
    bulan: (bawaan) => khusus
      ? bulanAntara(q.dari!, q.sampai!)
      : deretBulan(nBulan ?? bawaan),
  };
}
