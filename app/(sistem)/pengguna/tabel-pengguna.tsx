'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Peran } from '@/lib/sesi';
import { tambahPengguna, ubahPeran, ubahNama, ubahAktif } from '@/lib/pengguna-aksi';

type Baris = { email: string; nama: string; peran: Peran[]; aktif: boolean; dibuat_pada: string };

export default function TabelPengguna({
  daftar, akuSendiri, labelPeran,
}: {
  daftar: Baris[];
  akuSendiri: string;
  labelPeran: Record<Peran, string>;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const [sunting, setSunting] = useState<string | null>(null);
  const [pilih, setPilih] = useState<Peran[]>([]);
  const [nama, setNama] = useState('');
  const [baru, setBaru] = useState(false);
  const [email, setEmail] = useState('');

  const semuaPeran = Object.keys(labelPeran) as Peran[];

  const aksi = (fn: () => Promise<{ ok: boolean; galat?: string }>) =>
    mulai(async () => {
      setGalat(null);
      const h = await fn();
      if (h.ok) { setSunting(null); setBaru(false); setEmail(''); setNama(''); setPilih([]); router.refresh(); }
      else setGalat(h.galat ?? 'Gagal.');
    });

  function bukaSunting(b: Baris) {
    setGalat(null); setBaru(false);
    setSunting(b.email); setPilih(b.peran); setNama(b.nama);
  }

  const alih = (p: Peran) =>
    setPilih((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]));

  const kotakPeran = (
    <fieldset className="peran-pilih">
      <legend>Peran</legend>
      {semuaPeran.map((p) => (
        <label key={p}>
          <input type="checkbox" checked={pilih.includes(p)} onChange={() => alih(p)} />
          <span>{labelPeran[p]}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <>
      <div className="ttd-aksi" style={{ margin: '18px 0 0' }}>
        <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
          onClick={() => { setBaru(true); setSunting(null); setPilih([]); setNama(''); setEmail(''); setGalat(null); }}>
          Tambah akun
        </button>
      </div>

      {baru && (
        <div className="kotak" style={{ padding: '18px 20px', marginTop: 14, maxWidth: 620 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Akun Baru</h2>
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="p-email">Alamat surel</label>
            <input id="p-email" type="email" value={email} placeholder="nama@skolla.education"
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="p-nama">Nama</label>
            <input id="p-nama" value={nama} onChange={(e) => setNama(e.target.value)} />
            <span className="bantuan">Dipakai sebagai nama penanda tangan di PO dan surat.</span>
          </div>
          {kotakPeran}
          <div className="ttd-aksi">
            <button type="button" className="preset" disabled={kerja}
              onClick={() => setBaru(false)}>Batal</button>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja} onClick={() => aksi(() => tambahPengguna(email, nama, pilih))}>
              {kerja ? 'Menyimpan…' : 'Tambahkan'}
            </button>
          </div>
        </div>
      )}

      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}

      <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
        <div className="gulir">
          <table className="tabel-daftar">
            <thead>
              <tr><th>Nama</th><th>Alamat surel</th><th>Peran</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {daftar.map((b) => (
                <tr key={b.email} style={b.aktif ? undefined : { opacity: 0.6 }}>
                  <td>{b.nama}{b.email === akuSendiri && <span className="muted"> · kamu</span>}</td>
                  <td className="muted">{b.email}</td>
                  <td style={{ whiteSpace: 'normal' }}>
                    {b.peran.map((p) => labelPeran[p]).join(', ')}
                  </td>
                  <td>
                    <span className={`lencana ${b.aktif ? 'hijau' : ''}`}>
                      {b.aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div className="ttd-aksi" style={{ margin: 0, justifyContent: 'flex-end' }}>
                      <button type="button" className="preset" style={{ padding: '6px 12px' }}
                        disabled={kerja} onClick={() => bukaSunting(b)}>Sunting</button>
                      <button type="button" className="preset" style={{ padding: '6px 12px' }}
                        disabled={kerja || b.email === akuSendiri}
                        title={b.email === akuSendiri ? 'Akun sendiri tidak bisa dinonaktifkan' : undefined}
                        onClick={() => aksi(() => ubahAktif(b.email, !b.aktif))}>
                        {b.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sunting && (
        <div className="kotak" style={{ padding: '18px 20px', marginTop: 14, maxWidth: 620 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Sunting {sunting}</h2>
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="p-nama2">Nama</label>
            <input id="p-nama2" value={nama} onChange={(e) => setNama(e.target.value)} />
          </div>
          {kotakPeran}
          <div className="ttd-aksi">
            <button type="button" className="preset" disabled={kerja}
              onClick={() => setSunting(null)}>Batal</button>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
              disabled={kerja}
              onClick={() => aksi(async () => {
                const a = await ubahNama(sunting, nama);
                if (!a.ok) return a;
                return ubahPeran(sunting, pilih);
              })}>
              {kerja ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
