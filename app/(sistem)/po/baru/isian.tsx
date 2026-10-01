/**
 * Isian bersama Form PO: bidang angka, bidang teks, pemilih komponen. Dipindah apa
 * adanya dari form-po.tsx (catatan/12, Tugas 3) supaya komponen tiap langkah wizard
 * bisa memakainya.
 */
import { useEffect, useRef, useState } from 'react';
import type { Komponen } from '@/lib/pricelist';
import { angkaRupiah, digitRupiah, digitRupiahDiketik } from '@/lib/format';

/** Termin dibatasi empat: itu yang muat di tabel Form Pre-Order tanpa meluber,
 *  dan yang disepakati sebagai pola pembayaran. */
export const MAKS_TERMIN = 4;

export const huruf = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
export const labelTermin = (i: number) => (i === 0 ? 'DP - Termin 1' : `Termin ${i + 1}`);

/**
 * Bidang angka yang bisa dikosongkan.
 *
 * Bidang terkendali biasa memaksa string kosong kembali jadi 0, sehingga nolnya
 * tidak bisa dihapus dan angka baru menempel di belakangnya — "12" jadi "012".
 * Di sini teksnya disimpan terpisah sehingga boleh kosong sementara diketik,
 * nol di depan dibuang, dan dirapikan lagi saat bidang ditinggalkan.
 */
export function InputAngka({
  nilai, set, lantai = 0, ...sisa
}: { nilai: number; set: (n: number) => void; lantai?: number }
  & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [teks, setTeks] = useState(String(nilai));
  useEffect(() => { if (Number(teks || 0) !== nilai) setTeks(String(nilai)); }, [nilai]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...sisa}
      type="number"
      value={teks}
      onChange={(e) => {
        const bersih = e.target.value.replace(/^0+(?=\d)/, '');
        setTeks(bersih);
        set(bersih === '' ? 0 : Math.max(0, Number(bersih) || 0));
      }}
      onBlur={() => {
        // Lantai ditegakkan SAAT DITINGGALKAN, bukan tiap ketukan: dengan lantai 55.000,
        // menaikkan "4" jadi 55000 seketika membuat 40.000 tidak akan pernah bisa diketik.
        const akhir = Math.max(nilai, lantai);
        if (akhir !== nilai) set(akhir);
        setTeks(String(akhir));
      }}
    />
  );
}

/**
 * Bidang uang: mengetik angka, menampilkan "1.000.000".
 *
 * type="number" tidak bisa menampilkan pemisah ribuan, dan nominal tanpa pemisah
 * salah dibaca — "15000000" sekilas tampak 1,5 juta. Jadi bidangnya teks biasa
 * dengan inputMode numerik, dirapikan tiap ketukan oleh digitRupiah. "Rp" adalah
 * hiasan di depan bidang, bukan bagian dari nilai yang diketik, supaya kursor
 * tidak pernah berebut tempat dengannya.
 *
 * Kontraknya sama dengan InputAngka: {nilai, set}. Penjepitan batas atas tetap
 * urusan pemanggil di `set` — useEffect di bawah menarik teksnya ikut turun.
 */
export function InputRupiah({
  nilai, set, ...sisa
}: { nilai: number; set: (n: number) => void }
  & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [teks, setTeks] = useState(digitRupiah(String(nilai)));
  useEffect(() => { if (angkaRupiah(teks) !== nilai) setTeks(digitRupiah(String(nilai))); }, [nilai]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tempelan dan ketikan dibaca dengan aturan berbeda (lihat digitRupiahDiketik):
  // hanya tempelan yang boleh punya desimal. onPaste dan onDrop selalu mendahului
  // onChange, jadi penanda ini sudah terpasang saat nilainya dibaca.
  const dariLuar = useRef(false);
  const tandai = () => { dariLuar.current = true; };
  return (
    <span className="uang">
      <span className="uang-awalan" aria-hidden="true">Rp</span>
      <input
        {...sisa}
        type="text"
        inputMode="numeric"
        value={teks}
        onPaste={tandai}
        onDrop={tandai}
        onChange={(e) => {
          const rapi = dariLuar.current ? digitRupiah(e.target.value)
            : digitRupiahDiketik(e.target.value);
          dariLuar.current = false;
          setTeks(rapi);
          set(angkaRupiah(rapi));
        }}
        onBlur={() => setTeks(digitRupiah(String(nilai)))}
      />
    </span>
  );
}

/** Klik di mana pun pada bidang tanggal membuka pemilih, bukan hanya di ikonnya. */
export function bukaKalender(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try { el.showPicker?.(); } catch { /* peramban lama: biarkan perilaku bawaan */ }
}

// Satu pemilih untuk dua tempat: seluruh PO (satu kelompok) dan tiap kelompok. Awalan
// id membuat label tiap kelompok menunjuk kotak centangnya sendiri.
export type Ubah = (f: (d: Record<string, number>) => Record<string, number>) => void;
export const pemilih = (dipilih: Record<string, number>, setDipilih: Ubah, awalan = '') => {
const alih = (id: string) => setDipilih((d) => {
  const b = { ...d }; if (id in b) delete b[id]; else b[id] = 1; return b;
});
const ubahSesi = (id: string, v: number) =>
  setDipilih((d) => (id in d ? { ...d, [id]: Math.max(1, d[id] + v) } : d));

return (k: Komponen) => (
  <li key={k.id}>
    <label className="baris" data-mati={k.id in dipilih ? '0' : '1'} htmlFor={`cb-${awalan}${k.id}`}>
      <input type="checkbox" id={`cb-${awalan}${k.id}`} checked={k.id in dipilih} onChange={() => alih(k.id)} />
      <span>
        <span className="nama">{k.n}</span>
        {k.note && <span className="meta">{k.note}</span>}
      </span>
      <span className="kanan">
        {k.sesi && (
          <span className="sesi">
            <button type="button" aria-label={`Kurangi sesi ${k.n}`}
              onClick={(e) => { e.preventDefault(); ubahSesi(k.id, -1); }}>−</button>
            <InputAngka min={1} nilai={dipilih[k.id] ?? 1} aria-label={`Jumlah sesi ${k.n}`}
              onClick={(e) => e.preventDefault()}
              set={(n) => setDipilih((d) => (k.id in d ? { ...d, [k.id]: Math.max(1, n || 1) } : d))} />
            <button type="button" aria-label={`Tambah sesi ${k.n}`}
              onClick={(e) => { e.preventDefault(); ubahSesi(k.id, 1); }}>+</button>
          </span>
        )}
      </span>
    </label>
  </li>
);
};

/**
 * `tanda` = penanda dari hasil baca scan (catatan/17 amandemen 2): "dari scan, periksa",
 * "AI ragu", "tidak terbaca", dan centang nomor HP. Ditaruh DI DALAM .f supaya menempel pada
 * isiannya, bukan melayang di kolom lain.
 */
export const isian = (label: string, nilai: string, set: (v: string) => void, tipe = 'text',
  lebar = false, tanda?: React.ReactNode) => (
  <div className={`f${lebar ? ' lebar' : ''}`} key={label}>
    <label htmlFor={`f-${label}`}>{label}</label>
    <input id={`f-${label}`} type={tipe} value={nilai}
      onClick={tipe === 'date' ? bukaKalender : undefined}
      onChange={(e) => set(e.target.value)} />
    {tanda}
  </div>
);
