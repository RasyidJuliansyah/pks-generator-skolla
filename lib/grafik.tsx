'use client';

/**
 * Grafik SVG.
 *
 * Tanpa pustaka grafik: isinya sedikit dan bentuknya tetap, jadi menambah 40KB
 * pustaka hanya untuk beberapa batang tidak sepadan. Warnanya memakai token tema
 * supaya ikut berubah di mode gelap.
 *
 * Berjalan di sisi klien hanya demi satu hal: angka rinci saat kursor menyentuh
 * grafik. Setiap bentuk juga membawa <title> bawaan SVG, sehingga di perangkat
 * sentuh dan tanpa JavaScript keterangannya tetap bisa didapat.
 *
 * Setiap grafik membawa ringkasan teksnya sendiri lewat aria-label — pembaca
 * layar tidak bisa membaca batang, dan angka di dasbor bukan hiasan.
 */

import { useState } from 'react';
import { PALET } from './status-po';
import { rpSingkat } from './format';

export type Titik = { label: string; nilai: number; ket?: string };

/** Batang tegak untuk deret waktu. */
export function BatangWaktu({
  data, judul, satuan = 'rupiah',
}: { data: Titik[]; judul: string; satuan?: 'rupiah' | 'angka' }) {
  const maks = Math.max(...data.map((d) => d.nilai), 1);
  // Ruang kiri harus memuat label terpanjang ("Rp812 jt" ~48px pada 11px);
  // 44px membuat huruf awalnya terpotong keluar bingkai.
  const L = 64, K = 8, A = 18, T = 150;   // kiri, kanan, atas, tinggi plot
  const W = 100 * data.length;
  const lebarBatang = Math.min(46, (W - L - K) / data.length * 0.6);
  const langkah = (W - L - K) / data.length;
  const format = satuan === 'rupiah' ? rpSingkat : (n: number) => String(n);
  const [aktif, setAktif] = useState<number | null>(null);

  // Seluruhnya nol: menggambar sumbu di atas plot kosong hanya menghasilkan
  // angka acuan yang menyesatkan ("Rp1" karena skalanya dipaksa minimal satu).
  if (data.every((d) => d.nilai === 0)) {
    return (
      <p className="muted" style={{ fontSize: 13.5, margin: '12px 0 0' }}>
        Belum ada data pada rentang ini.
      </p>
    );
  }

  const ringkas = `${judul}. `
    + data.map((d) => `${d.label} ${format(d.nilai)}`).join('; ');

  return (
    <div className="gulir grafik-bungkus">
      <svg viewBox={`0 0 ${W} ${T + A + 34}`} className="grafik" role="img" aria-label={ringkas}
        style={{ minWidth: Math.max(320, W * 0.7) }}>
        {[0, 0.5, 1].map((f) => {
          const y = A + T - f * T;
          return (
            <g key={f}>
              <line x1={L} y1={y} x2={W - K} y2={y} className="grafik-garis" />
              <text x={L - 6} y={y + 4} className="grafik-sumbu" textAnchor="end">
                {format(maks * f)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const t = (d.nilai / maks) * T;
          const x = L + i * langkah + (langkah - lebarBatang) / 2;
          const rinci = `${d.label}: ${format(d.nilai)}${d.ket ? ` · ${d.ket}` : ''}`;
          return (
            <g key={d.label} onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)}
              onFocus={() => setAktif(i)} onBlur={() => setAktif(null)} tabIndex={0}
              className="grafik-kolom">
              <title>{rinci}</title>
              {/* Bidang tangkap selebar kolom: batang pendek pun mudah disentuh. */}
              <rect x={L + i * langkah} y={A} width={langkah} height={T} fill="transparent" />
              {d.nilai > 0 && (
                <rect x={x} y={A + T - t} width={lebarBatang} height={Math.max(t, 2)}
                  rx="3" className={`grafik-batang${aktif === i ? ' aktif' : ''}`} />
              )}
              {aktif === i && (
                <g className="grafik-nilai" aria-hidden="true">
                  <text x={x + lebarBatang / 2} y={Math.max(A + T - t - 8, 12)}
                    textAnchor="middle">{format(d.nilai)}</text>
                </g>
              )}
              <text x={x + lebarBatang / 2} y={A + T + 16} className="grafik-sumbu"
                textAnchor="middle">{d.label}</text>
              {d.ket && (
                <text x={x + lebarBatang / 2} y={A + T + 30} className="grafik-sumbu kecil"
                  textAnchor="middle">{d.ket}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type Potong = { label: string; jumlah: number; warna?: string };

/**
 * Warna dipilih lewat NAMA KELAS, dan stylesheet yang mewarnainya.
 *
 * Tiga bentuk lain sudah terbukti gagal di peramban Rizki — cincinnya hitam,
 * sementara ketiganya tampak benar di peramban yang saya pakai memeriksa:
 *   1. `fill="var(--x)"`            atribut presentasi SVG
 *   2. `style={{ fill: 'var(--x)' }}`  properti inline
 *   3. `style={{ ['--warna']: ... }}`  custom property disetel inline
 *
 * Yang terbukti jalan hanya stylesheet membaca var() langsung, sebagaimana
 * `stroke:var(--surface)` pada sekat antar juring. Kelas `w-<nama>` memakai
 * bentuk itu, dan tidak ada nilai warna yang lewat inline sama sekali.
 */


/**
 * Nama warna sebuah potongan. Pemanggil boleh menyebutnya sendiri — status PO
 * dan PKS memakai warna tetapnya masing-masing — tapi kalau tidak, paletlah yang
 * memilih. Tanpa cadangan ini satu potongan tanpa `warna` menghasilkan kelas
 * `w-undefined` yang tidak diwarnai aturan mana pun, dan juringnya jadi hitam:
 * persis yang terjadi di layar Rizki meski seluruh pemanggil tampak mengisinya.
 */
const warnaKe = (d: { warna?: string }, i: number) => d.warna ?? PALET[i % PALET.length];

/** Titik pada lingkaran, sudut diukur dari atas searah jarum jam. */
function titik(sudut: number, jari: number) {
  const r = ((sudut - 90) * Math.PI) / 180;
  return [60 + jari * Math.cos(r), 60 + jari * Math.sin(r)] as const;
}

/**
 * Komposisi sebagai lingkaran cincin.
 *
 * Kategori bernilai nol tidak digambar sebagai juring — juring setebal nol
 * hanya menghasilkan garis yang menyesatkan — tetapi tetap tercantum di
 * keterangan supaya terlihat bahwa tahapnya memang kosong, bukan terlewat.
 */
export function Donat({
  data, judul, satuan = 'PO',
}: { data: Potong[]; judul: string; satuan?: string }) {
  const [aktif, setAktif] = useState<string | null>(null);
  const total = data.reduce((a, d) => a + d.jumlah, 0);
  if (!total) {
    return <p className="muted" style={{ fontSize: 13.5, margin: '12px 0 0' }}>
      Belum ada data untuk {judul.toLowerCase()}.
    </p>;
  }

  const isi = data.filter((d) => d.jumlah > 0);
  const ringkas = `${judul}. `
    + isi.map((d) => `${d.label} ${d.jumlah} (${Math.round((d.jumlah / total) * 100)}%)`).join('; ');

  const LUAR = 54, DALAM = 33;
  let jalan = 0;

  return (
    <div className="donat-baris">
      <svg viewBox="0 0 120 120" className="donat" role="img" aria-label={ringkas}>
        {isi.length === 1 ? (
          <circle cx="60" cy="60" r={(LUAR + DALAM) / 2} strokeWidth={LUAR - DALAM}
            className={`donat-cincin w-${warnaKe(isi[0], 0)}`} />
        ) : (
          isi.map((d, i) => {
            const sudut = (d.jumlah / total) * 360;
            const mulai = jalan;
            jalan += sudut;
            const [x1, y1] = titik(mulai, LUAR);
            const [x2, y2] = titik(mulai + sudut, LUAR);
            const [x3, y3] = titik(mulai + sudut, DALAM);
            const [x4, y4] = titik(mulai, DALAM);
            const besar = sudut > 180 ? 1 : 0;
            return (
              <path key={d.label}
                className={`donat-juring w-${warnaKe(d, i)}${aktif === d.label ? ' aktif' : ''}`}
                onMouseEnter={() => setAktif(d.label)} onMouseLeave={() => setAktif(null)}
                d={`M${x1} ${y1}A${LUAR} ${LUAR} 0 ${besar} 1 ${x2} ${y2}`
                  + `L${x3} ${y3}A${DALAM} ${DALAM} 0 ${besar} 0 ${x4} ${y4}Z`}>
                <title>{`${d.label}: ${d.jumlah} (${Math.round((d.jumlah / total) * 100)}%)`}</title>
              </path>
            );
          })
        )}
        {(() => {
          const p = aktif ? data.find((d) => d.label === aktif) : null;
          return (
            <>
              <text x="60" y="57" className="donat-total" textAnchor="middle">
                {p ? p.jumlah : total}
              </text>
              <text x="60" y="71" className="donat-satuan" textAnchor="middle">
                {p ? `${Math.round((p.jumlah / total) * 100)}%` : satuan}
              </text>
            </>
          );
        })()}
      </svg>

      <ul className="donat-ket">
        {data.map((d, i) => (
          <li key={d.label}
            className={[d.jumlah ? '' : 'nol', aktif === d.label ? 'aktif' : ''].filter(Boolean).join(' ')}
            onMouseEnter={() => d.jumlah && setAktif(d.label)}
            onMouseLeave={() => setAktif(null)}>
            <span className={`donat-titik w-${warnaKe(d, i)}`} />
            <span className="donat-label">{d.label}</span>
            <span className="donat-angka">
              {d.jumlah}
              <span className="muted"> · {Math.round((d.jumlah / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Corong sebagai alur bertahap.
 *
 * Tiap langkah membawa jumlahnya sendiri dan konversi dari langkah sebelumnya —
 * itu yang menunjukkan di mana proses tersendat. Persentase terhadap langkah
 * pertama sengaja tidak ditampilkan besar-besar: yang bisa ditindaklanjuti
 * adalah kebocoran antar dua tahap berdekatan, bukan sisa dari awal.
 */
export function AlurTahap({ tahap }: { tahap: { label: string; jumlah: number }[] }) {
  const ringkas = tahap.map((t) => `${t.label} ${t.jumlah}`).join(', lalu ');
  return (
    <div className="gulir">
      <ol className="alur" aria-label={`Alur tahapan PO: ${ringkas}`}>
        {tahap.map((t, i) => {
          const sebelum = i > 0 ? tahap[i - 1].jumlah : null;
          const konversi = sebelum ? Math.round((t.jumlah / sebelum) * 100) : null;
          const turun = sebelum !== null ? sebelum - t.jumlah : 0;
          return (
            <li key={t.label}>
              {i > 0 && (
                <span className="alur-panah" aria-hidden="true">
                  <span className={`alur-persen${konversi !== null && konversi < 70 ? ' rendah' : ''}`}>
                    {konversi === null ? '-' : `${konversi}%`}
                  </span>
                  <svg viewBox="0 0 24 12" className="alur-ikon"><path d="M0 6h18M14 2l5 4-5 4" /></svg>
                </span>
              )}
              <div className="alur-kotak">
                <span className="alur-angka">{t.jumlah}</span>
                <span className="alur-label">{t.label}</span>
                {turun > 0 && <span className="alur-turun">{turun} berhenti di sini</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export type Baris = { label: string; nilai: number; ket?: string; warna?: string };

/**
 * Satuan diberikan sebagai nama, bukan fungsi.
 *
 * Komponen ini berjalan di klien; mengoper fungsi dari Server Component ke sini
 * tidak bisa diserialkan dan melempar saat berjalan — bukan saat dibangun,
 * sehingga build tetap hijau sementara halamannya mati.
 */
export type Satuan = 'angka' | 'hari' | 'rupiah' | 'po';

const TULIS: Record<Satuan, (n: number) => string> = {
  angka: (n) => String(n),
  hari: (n) => `${n} hari`,
  rupiah: rpSingkat,
  po: (n) => `${n} PO`,
};

/**
 * Peringkat mendatar. Dipakai untuk hal yang dibandingkan besarannya —
 * lama tiap tahap, penolakan per fungsi, kinerja per orang — di mana urutan
 * lebih penting daripada proporsi terhadap keseluruhan.
 */
export function BatangPeringkat({
  data, judul, satuan = 'angka',
}: { data: Baris[]; judul: string; satuan?: Satuan }) {
  const [aktif, setAktif] = useState<number | null>(null);
  const maks = Math.max(...data.map((d) => d.nilai), 1);
  const tulis = TULIS[satuan];

  if (!data.length || data.every((d) => d.nilai === 0)) {
    return <p className="muted" style={{ fontSize: 13.5, margin: '12px 0 0' }}>
      Belum ada data untuk {judul.toLowerCase()}.
    </p>;
  }

  return (
    <ul className="peringkat" aria-label={`${judul}. ` + data.map((d) => `${d.label} ${tulis(d.nilai)}`).join('; ')}>
      {data.map((d, i) => (
        <li key={d.label} className={aktif === i ? 'aktif' : undefined}
          onMouseEnter={() => setAktif(i)} onMouseLeave={() => setAktif(null)}>
          {/* Label panjang dipangkas dengan elipsis; judul penuh tetap
              terbaca saat disentuh dan oleh pembaca layar. */}
          <span className="peringkat-label" title={d.label}>{d.label}</span>
          <span className="peringkat-jalur">
            <span className={`peringkat-isi w-${d.warna ?? 'primary-fill'}`}
              style={{ width: `${Math.max((d.nilai / maks) * 100, d.nilai ? 2 : 0)}%` }} />
          </span>
          <span className="peringkat-angka">
            {tulis(d.nilai)}
            {d.ket && <span className="muted"> · {d.ket}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
