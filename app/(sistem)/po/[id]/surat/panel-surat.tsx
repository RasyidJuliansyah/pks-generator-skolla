'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import KanvasTtd from '../kanvas-ttd';
import { simpanTtdSurat, hapusTtdSurat, finalisasiSurat } from '@/lib/surat-aksi';

export default function PanelSurat({
  poId, namaLead, sudahTtd, finalPada, otomatis, versiIom, adalahLead,
}: {
  poId: string;
  namaLead: string;
  sudahTtd: boolean;
  finalPada: string | null;
  /** Diterbitkan dan dikunci basis data, tanpa tanda tangan manusia (catatan/13a Bagian 11). */
  otomatis: boolean;
  versiIom: string | null;
  adalahLead: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [buka, setBuka] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const aksi = (fn: () => Promise<{ ok: boolean; galat?: string }>) =>
    mulai(async () => {
      setGalat(null);
      const h = await fn();
      if (h.ok) { setBuka(false); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal.');
    });

  function simpan(png: Blob) {
    const baca = new FileReader();
    baca.onload = () => aksi(() => simpanTtdSurat(poId, String(baca.result)));
    baca.readAsDataURL(png);
  }

  // Surat otomatis: tidak ada yang ditandatangani maupun difinalisasi siapa pun. Yang perlu
  // terlihat justru sebaliknya — bahwa tidak ada langkah tersisa, dan siapa yang menanggung.
  if (otomatis) {
    return (
      <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
        <div className="baris-kanan" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="lencana hijau">Final · otomatis</span>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5, maxWidth: 620 }}>
              PO ini memenuhi seluruh aturan IoM, jadi verifikasinya dikonfirmasi sistem
              menurut ketentuan {versiIom ?? 'IoM yang berlaku'} dan surat ini terkunci
              sejak terbit. Head of Operations dan Tech Ops Lead diinformasikan, bukan
              menandatangani. PKS sudah boleh dibuat.
            </p>
          </div>
          <div className="ttd-aksi" style={{ margin: 0 }}>
            <Link href={`/po/${poId}`} className="preset">Kembali ke PO</Link>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              onClick={() => window.print()}>Cetak / Simpan PDF</button>
          </div>
        </div>
      </div>
    );
  }

  // Surat yang sudah final hanya bisa dibaca dan dicetak.
  if (finalPada) {
    return (
      <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
        <div className="baris-kanan" style={{ justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="lencana hijau">Final</span>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
              Difinalisasi {new Date(finalPada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              {' '}oleh {namaLead}. Isinya terkunci, dan PKS sudah boleh dibuat.
            </p>
          </div>
          <div className="ttd-aksi" style={{ margin: 0 }}>
            <Link href={`/po/${poId}`} className="preset">Kembali ke PO</Link>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              onClick={() => window.print()}>Cetak / Simpan PDF</button>
          </div>
        </div>
      </div>
    );
  }

  if (!adalahLead) {
    return (
      <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
        <span className="lencana">Draf</span>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
          Surat belum difinalisasi Tech Ops Lead. Selama masih draf, isinya belum
          berlaku dan PKS belum bisa dibuat.
        </p>
        <Link href={`/po/${poId}`} className="preset" style={{ marginTop: 12, display: 'inline-block' }}>
          Kembali ke PO
        </Link>
      </div>
    );
  }

  return (
    <div className="kotak no-print" style={{ padding: '18px 20px', marginTop: 16 }}>
      <span className="lencana">Draf</span>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '10px 0 0' }}>
        {sudahTtd ? 'Siap Difinalisasi' : 'Bubuhkan Tanda Tangan'}
      </h2>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
        {sudahTtd
          ? 'Periksa isi surat di bawah. Setelah difinalisasi, surat terkunci dan tidak bisa diubah lagi.'
          : `Surat ditandatangani atas nama ${namaLead}. Finalisasi baru terbuka setelah tanda tangan dibubuhkan.`}
      </p>

      {buka && (
        <div style={{ marginTop: 14 }}>
          <KanvasTtd batal={() => setBuka(false)} simpan={simpan} sedang={kerja} />
        </div>
      )}

      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}

      {!buka && (
        <div className="ttd-aksi">
          <Link href={`/po/${poId}`} className="preset">Kembali ke PO</Link>
          {sudahTtd && (
            <button type="button" className="preset" disabled={kerja}
              onClick={() => aksi(() => hapusTtdSurat(poId))}>Ulangi tanda tangan</button>
          )}
          <button type="button" className={sudahTtd ? 'preset' : 'tombol'}
            style={{ width: 'auto', margin: 0 }} disabled={kerja}
            onClick={() => { setGalat(null); setBuka(true); }}>
            {sudahTtd ? 'Tanda tangan ulang' : 'Bubuhkan tanda tangan'}
          </button>
          {sudahTtd && (
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja} onClick={() => aksi(() => finalisasiSurat(poId))}>
              {kerja ? 'Memproses…' : 'Finalisasi Surat'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
