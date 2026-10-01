'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PengalihTema from '../tema';
import { masukAksi } from '@/lib/auth-aksi';

const PENGGUNA_LOKAL = [
  { nama: 'Rizki (Admin Utama & HoO)', email: 'rizki@skolla.education' },
  { nama: 'Akbar (CBO)', email: 'akbar@skolla.education' },
  { nama: 'Farid (Finance)', email: 'farid@skolla.education' },
  { nama: 'Dwiva (Tech Ops Lead)', email: 'dwiva@skolla.education' },
  { nama: 'Sales Skolla', email: 'sales@skolla.education' },
];

export default function Masuk() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);
  const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';
  const isDev = process.env.NODE_ENV === 'development';

  async function tanganiMasuk(targetEmail?: string, targetSandi?: string) {
    const surel = targetEmail || email;
    const kataSandi = targetSandi || sandi;

    setGalat(null);
    setSedang(true);

    const hasil = await masukAksi(surel, kataSandi);
    if (!hasil.sukses) {
      setSedang(false);
      setGalat(hasil.galat || 'Gagal masuk. Periksa kembali surel dan sandi Anda.');
    } else {
      router.push('/beranda');
      router.refresh();
    }
  }

  return (
    <main className="tengah">
      <div className="kartu" style={{ maxWidth: 400, width: '100%' }}>
        <p className="eyebrow">Skolla</p>
        <h1>Kerjasama Sekolah</h1>
        <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 22px' }}>
          Alat internal tim Skolla. Masuk dengan akun <strong>@{domain}</strong>.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            tanganiMasuk();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="f">
            <label htmlFor="masuk-email">Alamat Surel</label>
            <input
              id="masuk-email"
              type="email"
              placeholder={`nama@${domain}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={sedang}
            />
          </div>

          <div className="f">
            <label htmlFor="masuk-sandi">Kata Sandi</label>
            <input
              id="masuk-sandi"
              type="password"
              placeholder="••••••••"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              required
              disabled={sedang}
            />
          </div>

          <button className="tombol" type="submit" disabled={sedang} style={{ marginTop: 6 }}>
            {sedang ? 'Memverifikasi…' : 'Masuk ke Sistem'}
          </button>
        </form>

        {galat && <div className="galat" style={{ marginTop: 14 }}>{galat}</div>}

        {isDev && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
              Mode Pengembang (Akses Cepat Lokal):
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PENGGUNA_LOKAL.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  className="tombol sekunder"
                  style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left' }}
                  onClick={() => {
                    setEmail(p.email);
                    setSandi('password123');
                    tanganiMasuk(p.email, 'password123');
                  }}
                  disabled={sedang}
                >
                  {p.nama}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: 11.5, margin: '20px 0 16px' }}>
          Akun yang belum didaftarkan tidak bisa melihat apa pun, meski domainnya benar.
        </p>

        <div className="baris-kanan" style={{ justifyContent: 'center' }}>
          <PengalihTema />
        </div>
      </div>
    </main>
  );
}


