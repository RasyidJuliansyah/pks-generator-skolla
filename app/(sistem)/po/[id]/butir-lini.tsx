/**
 * Satu butir lini masa berikut balasannya, rekursif.
 *
 * Dipisah dari page.tsx karena render rekursif butuh komponen yang bisa memanggil
 * dirinya sendiri, dan halaman itu sudah cukup panjang.
 */
import { IsiKomentar, KotakBalas } from './komentar';
import type { Peristiwa } from '@/lib/lini-masa';

/** Jorokan tiap tingkat, piksel. Tetap, TIDAK dikali tingkatnya — lihat `jorok` di bawah. */
const JOROK = 18;

/**
 * Tingkat terakhir yang masih dijorokkan. DATANYA tetap tanpa batas; yang berhenti
 * hanya jorokannya, di 4 x 18 = 72px, dan di situ ia benar-benar berhenti.
 */
const INDENT_MAKS = 4;

export type KonteksButir = {
  poId: string;
  saya: string;
  bolehTulis: boolean;
  baru: (e: Peristiwa) => boolean;
};

// JANGAN "rapikan" ini dengan mengimpor waktuID dari ./komentar. Berkas itu bertanda
// 'use client', dan NILAI bukan-komponen yang diimpor Server Component dari modul klien
// berubah jadi rujukan klien — nilainya undefined di server, TANPA galat, lalu mati saat
// berjalan. Sudah menggigit lewat PALET di lib/grafik.tsx, dan uji/batas-klien.test.mjs
// ada persis untuk menangkapnya. Menyalin dua baris lebih murah daripada itu.
const waktuID = (w: string) =>
  new Date(w).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function ButirLini(
  { e, tingkat, ctx }: { e: Peristiwa; tingkat: number; ctx: KonteksButir },
) {
  // Margin pada <li> bersarang itu RELATIF terhadap induknya, jadi ia MENJUMLAH sendiri.
  // Karena itu tiap tingkat menyumbang jorokan TETAP, bukan dikali tingkatnya.
  //
  // Versi pertama memakai `Math.min(tingkat, INDENT_MAKS) * JOROK` dan itu keliru dua
  // kali: totalnya tumbuh kuadratik (tingkat 4 = 180px), dan pagar INDENT_MAKS cuma
  // membuat PERTAMBAHANNYA tetap 72px per tingkat, bukan menghentikannya — tingkat 7
  // berjorok 396px, lebih lebar daripada layar ponsel 375px, jadi utas dalam menggulir
  // menyamping. Diukur, bukan dikira: lihat uji/pratinjau-komentar.tsx utas dalamnya.
  const jorok = tingkat > 0 && tingkat <= INDENT_MAKS ? JOROK : 0;
  return (
    <li className={tingkat > 0 ? 'lini-balasan' : undefined}
        style={jorok ? { marginLeft: jorok } : undefined}>
      <span className={`lini-titik w-${e.warna}`} aria-hidden="true" />
      <div>
        {e.yatim && (
          <div className="komentar-dihapus lini-rincian">
            Peristiwa yang dibalas sudah tidak ada di lini masa — mungkin tanda tangan
            yang dibatalkan saat PO dikembalikan.
          </div>
        )}
        <div className="lini-judul">
          {e.judul}
          {ctx.baru(e) && <span className="hitung-baru" style={{ marginLeft: 8 }}>baru</span>}
        </div>
        {e.rincian && <div className="lini-rincian">{e.rincian}</div>}
        {e.komentar && (
          <IsiKomentar key={e.komentar.id} poId={ctx.poId} k={e.komentar}
            milik={e.oleh === ctx.saya && ctx.bolehTulis} />
        )}
        <div className="ttd-waktu">
          {e.oleh ? `${e.oleh.split('@')[0]} · ` : ''}{waktuID(e.waktu)}
        </div>
        {ctx.bolehTulis && <KotakBalas poId={ctx.poId} indukKunci={e.kunci} />}
        {e.balasan.length > 0 && (
          <ol className="lini-masa lini-utas">
            {e.balasan.map((b) => (
              <ButirLini key={b.kunci} e={b} tingkat={tingkat + 1} ctx={ctx} />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}
