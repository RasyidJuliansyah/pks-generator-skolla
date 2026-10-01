'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { pihakUntuk, labelPihak, type Pihak, type SkemaTtd } from '@/lib/pihak';
import { simpanTtd, hapusTtd, kirimUntukTtd, kembalikanKeDraf, ajukanVerifikasi } from '@/lib/po-aksi';
import KanvasTtd from './kanvas-ttd';

export type TtdTersimpan = {
  pihak: Pihak; nama: string; waktu: string; url: string | null;
};

export default function PanelTtd({
  poId, status, ttd, nama, bisaBubuh, skema,
}: {
  poId: string;
  /** po.skema_ttd: tiga atau empat penanda tangan (catatan/23). */
  skema: SkemaTtd;
  status: string;
  ttd: TtdTersimpan[];
  /** Nama tiap pihak, diambil dari data sekolah dan dropdown penanda tangan
   *  di form — bukan diketik ulang saat membubuhkan. */
  nama: Partial<Record<Pihak, string>>;
  bisaBubuh: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [aktif, setAktif] = useState<Pihak | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const sudah = (p: Pihak) => ttd.find((t) => t.pihak === p);
  const daftar = pihakUntuk(skema);
  const lengkap = daftar.every(sudah);

  function bukaKanvas(p: Pihak) {
    setGalat(null);
    setAktif(p);
  }

  function simpan(png: Blob) {
    const baca = new FileReader();
    baca.onload = () => {
      mulai(async () => {
        const h = await simpanTtd(poId, aktif!, nama[aktif!] ?? '', String(baca.result));
        if (h.ok) { setAktif(null); router.refresh(); }
        else setGalat(h.galat ?? 'Gagal menyimpan tanda tangan.');
      });
    };
    baca.readAsDataURL(png);
  }

  const aksi = (fn: () => Promise<{ ok: boolean; galat?: string }>) =>
    mulai(async () => {
      const h = await fn();
      if (h.ok) router.refresh();
      else setGalat(h.galat ?? 'Gagal.');
    });

  if (status === 'draf' || status === 'ditolak') {
    return (
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Tanda Tangan</h2>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
          Kirim PO untuk ditandatangani setelah isinya final. Setelah dikirim, PO terkunci
          dan tidak bisa disunting sampai dikembalikan ke draf.
        </p>
        {bisaBubuh && (
          <button type="button" className="tombol" style={{ width: 'auto', margin: '14px 0 0' }}
            disabled={kerja} onClick={() => aksi(() => kirimUntukTtd(poId))}>
            {kerja ? 'Memproses…' : 'Kirim untuk ditandatangani'}
          </button>
        )}
        {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}
      </section>
    );
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Tanda Tangan</h2>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
        {lengkap
          ? 'Semua pihak sudah menandatangani.'
          : `${ttd.filter((t) => daftar.includes(t.pihak)).length} dari ${daftar.length} pihak sudah menandatangani.`}
        {' '}Tanda tangan ini tidak tersertifikasi, PKS tetap ditandatangani basah di atas meterai.
      </p>

      <div className="ttd-kisi">
        {daftar.map((p) => {
          const t = sudah(p);
          return (
            <div className="ttd-kartu" key={p}>
              <h3>{labelPihak(p, skema)}</h3>
              {t ? (
                <>
                  <div className="ttd-gambar">
                    {t.url
                      ? <img src={t.url} alt={`Tanda tangan ${labelPihak(p, skema)}`} />
                      : <span className="muted" style={{ fontSize: 12 }}>Berkas tidak terbaca</span>}
                  </div>
                  <div>
                    <div className="ttd-nama-kartu">{t.nama}</div>
                    <div className="ttd-waktu">
                      {new Date(t.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  {bisaBubuh && status === 'menunggu_ttd' && (
                    <button type="button" className="preset" disabled={kerja}
                      onClick={() => aksi(() => hapusTtd(poId, p))}>Ulangi</button>
                  )}
                </>
              ) : (
                <>
                  <div className="ttd-kosong">Belum ditandatangani</div>
                  <div className="ttd-nama-kartu">
                    {nama[p] || <span className="muted" style={{ fontWeight: 400 }}>Nama belum diisi</span>}
                  </div>
                  {bisaBubuh && status === 'menunggu_ttd' && (
                    nama[p]
                      ? <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
                          disabled={kerja} onClick={() => bukaKanvas(p)}>Bubuhkan</button>
                      : <p className="ttd-waktu">
                          Isi namanya dulu lewat <strong>Kembalikan ke draf</strong> di bawah,
                          {p === 'kepala_sekolah' ? ' di langkah Sekolah.' : ' di langkah Penanda tangan & catatan.'}
                        </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {aktif && (
        <div className="kotak" style={{ padding: '16px 18px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Tanda tangan {labelPihak(aktif, skema)}
          </h3>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            Atas nama <strong>{nama[aktif]}</strong>
          </p>
          <KanvasTtd batal={() => setAktif(null)} simpan={simpan} sedang={kerja} />
        </div>
      )}

      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}

      {bisaBubuh && status === 'menunggu_ttd' && (
        <button type="button" className="preset" style={{ marginTop: 8 }} disabled={kerja}
          onClick={() => aksi(() => kembalikanKeDraf(poId))}>
          Kembalikan ke draf untuk disunting
        </button>
      )}

      {status === 'ditandatangani' && (
        <div className="kotak" style={{ padding: '18px 20px', marginTop: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Siap Diverifikasi</h3>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            Semua tanda tangan lengkap. Setelah diajukan, PO masuk antrean Education,
            Tech Ops, Finance, dan Service Account, dan tidak bisa diubah lagi dari sisi sales.
          </p>
          {bisaBubuh && (
            <button type="button" className="tombol" style={{ width: 'auto', margin: '14px 0 0' }}
              disabled={kerja} onClick={() => aksi(() => ajukanVerifikasi(poId))}>
              {kerja ? 'Memproses…' : 'Ajukan untuk verifikasi'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
