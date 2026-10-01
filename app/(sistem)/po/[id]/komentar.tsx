'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { tulisKomentar, suntingKomentar, hapusKomentar, tandaiKomentarDibaca, balasKomentar } from '@/lib/po-aksi';
import type { KomentarLini } from '@/lib/lini-masa';

const BATAS = 4000;
const waktuID = (w: string) =>
  new Date(w).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Menandai komentar PO ini sudah dibaca, sekali, saat halaman benar-benar terpasang di
 * peramban. Hanya dirender bila memang ada yang baru, supaya membuka PO tanpa komentar
 * baru tidak memicu penulisan dan penyegaran halaman yang sia-sia.
 */
export function TandaiDibaca({ poId }: { poId: string }) {
  useEffect(() => { void tandaiKomentarDibaca(poId); }, [poId]);
  return null;
}

/**
 * Kotak tulis di ujung lini masa. Lini masanya terbaru di atas, jadi "ujung" berarti
 * di atas — tempat komentar yang baru ditulis akan muncul.
 */
export function KotakKomentar({ poId }: { poId: string }) {
  const router = useRouter();
  const [isi, setIsi] = useState('');
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  function kirim() {
    setGalat(null);
    mulai(async () => {
      const h = await tulisKomentar(poId, isi);
      if (h.ok) { setIsi(''); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal mengirim.');
    });
  }

  return (
    <div className="f komentar-kotak no-print">
      <label htmlFor="komentar-baru">Tulis komentar</label>
      <textarea id="komentar-baru" value={isi} maxLength={BATAS}
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Pertanyaan, jawaban, atau konteks keputusan untuk PO ini." />
      <span className="bantuan">
        Terbaca oleh Sales pemilik PO dan semua peran yang bisa melihat PO ini. Jangan
        menulis hal yang tidak pantas dibaca mereka. Komentar dan balasannya sama-sama
        terbuka; tidak ada bagian yang tersembunyi.
      </span>
      <div className="ttd-aksi">
        <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
          disabled={kerja || !isi.trim()} onClick={kirim}>
          {kerja ? 'Mengirim…' : 'Kirim komentar'}
        </button>
      </div>
      {galat && <div className="halangan" role="alert" style={{ marginTop: 10 }}><ul><li>{galat}</li></ul></div>}
    </div>
  );
}

/**
 * Kotak balas di bawah satu butir lini masa.
 *
 * Setiap kotak menyimpan isiannya SENDIRI dan beberapa boleh terbuka bersamaan.
 * Rancangan awal "satu kotak pada satu waktu" dibatalkan: menutup kotak lain berarti
 * membuang kalimat yang sudah diketik orang di sana.
 */
export function KotakBalas({ poId, indukKunci }: { poId: string; indukKunci: string }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState('');
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  // `tautan-kecil`, BUKAN `tombol`. Ini disengaja dan ada alasannya di catatan/20
  // ("Risiko yang diterima"): kalau Balas jadi tindakan utama di bawah keputusan
  // verifikasi, alasan sebenarnya sebuah penolakan akan berakhir di utas, bukan di
  // verifikasi.catatan yang ikut basi bersama keputusannya dan terbaca jejak audit.
  // Jangan naikkan jadi tombol utama tanpa membaca bagian itu lebih dulu.
  if (!buka) {
    return (
      <div className="komentar-aksi no-print">
        <button type="button" className="tautan-kecil" onClick={() => setBuka(true)}>Balas</button>
      </div>
    );
  }

  return (
    <div className="f balas-kotak no-print">
      <textarea aria-label="Tulis balasan" value={isi} maxLength={BATAS} autoFocus
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Balas peristiwa ini." />
      <div className="ttd-aksi">
        <button type="button" className="preset" disabled={kerja}
          onClick={() => { setBuka(false); setIsi(''); setGalat(null); }}>Batal</button>
        <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
          disabled={kerja || !isi.trim()}
          onClick={() => {
            setGalat(null);
            mulai(async () => {
              const h = await balasKomentar(poId, indukKunci, isi);
              if (h.ok) { setIsi(''); setBuka(false); router.refresh(); }
              else setGalat(h.galat ?? 'Gagal mengirim balasan.');
            });
          }}>
          {kerja ? 'Mengirim…' : 'Kirim balasan'}
        </button>
      </div>
      {galat && <div className="halangan" role="alert" style={{ marginTop: 8 }}><ul><li>{galat}</li></ul></div>}
    </div>
  );
}

/**
 * Isi satu komentar di lini masa, berikut sunting/hapus bila milik sendiri.
 *
 * WAJIB diberi `key={k.id}` oleh pemanggil. Butir lini masa berkunci posisi, dan komentar
 * baru selalu muncul di atas — tanpa key stabil, state `isi` di sini tertinggal di
 * slotnya dan kotak sunting terbuka berisi teks komentar ORANG LAIN, siap disimpan
 * menimpa komentar sendiri. Ditemukan QA 10 Sep 2026, sebelum sempat tayang.
 */
export function IsiKomentar({ poId, k, milik }: { poId: string; k: KomentarLini; milik: boolean }) {
  const router = useRouter();
  const [sunting, setSunting] = useState(false);
  const [isi, setIsi] = useState(k.isi ?? '');
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  function jalankan(f: () => Promise<{ ok: boolean; galat?: string }>) {
    setGalat(null);
    mulai(async () => {
      const h = await f();
      if (h.ok) { setSunting(false); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal.');
    });
  }

  if (k.dihapus) {
    return (
      <div className="lini-rincian komentar-dihapus">
        Dihapus oleh {k.dihapus.oleh?.split('@')[0] ?? 'penulisnya'}, {waktuID(k.dihapus.pada)}.
      </div>
    );
  }

  return (
    <>
      {k.basi && (
        <div className="komentar-basi">Ditulis sebelum PO diubah, isinya mungkin sudah tidak berlaku.</div>
      )}
      {sunting ? (
        <div className="f" style={{ marginTop: 6 }}>
          <textarea aria-label="Sunting komentar" value={isi} maxLength={BATAS}
            onChange={(e) => setIsi(e.target.value)} />
          <span className="bantuan">Versi lama tetap tersimpan dan bisa dibuka siapa pun yang membaca PO ini.</span>
          <div className="ttd-aksi">
            <button type="button" className="preset" disabled={kerja}
              onClick={() => { setSunting(false); setIsi(k.isi ?? ''); }}>Batal</button>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja || !isi.trim() || isi === k.isi}
              onClick={() => jalankan(() => suntingKomentar(poId, k.id, isi))}>
              {kerja ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      ) : (
        <div className="komentar-isi">{k.isi}</div>
      )}

      {(k.disunting || k.revisi.length > 0) && !sunting && (
        <details className="komentar-revisi">
          <summary>disunting{k.disunting ? ` ${waktuID(k.disunting)}` : ''} · {k.revisi.length} versi sebelumnya</summary>
          <ol>
            {k.revisi.map((r, i) => (
              <li key={i}>
                <div className="komentar-isi">{r.isi}</div>
                <div className="ttd-waktu">digantikan {waktuID(r.digantikan_pada)}</div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {milik && !sunting && (
        <div className="komentar-aksi no-print">
          <button type="button" className="tautan-kecil" disabled={kerja} onClick={() => { setIsi(k.isi ?? ''); setSunting(true); }}>Sunting</button>
          <button type="button" className="tautan-kecil" disabled={kerja}
            onClick={() => {
              if (confirm('Hapus komentar ini? Tempatnya di lini masa tetap ada, dengan keterangan siapa menghapus dan kapan.'))
                jalankan(() => hapusKomentar(poId, k.id));
            }}>Hapus</button>
        </div>
      )}
      {galat && <div className="halangan" role="alert" style={{ marginTop: 8 }}><ul><li>{galat}</li></ul></div>}
    </>
  );
}
