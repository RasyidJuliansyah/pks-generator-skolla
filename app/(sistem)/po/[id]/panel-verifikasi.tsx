'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CHECKLIST, LABEL_FUNGSI, URUT_FUNGSI, type Fungsi } from '@/lib/checklist';
import { putuskanVerifikasi, tutupVerifikasi, tarikKeDraf, urlUnggahanPo } from '@/lib/po-aksi';
import { LABEL_ATURAN, keadaanVerdict, type BarisVerdict, type KeadaanVerdict } from '@/lib/verdict-iom';
import { rp } from '@/lib/format';

export type Keputusan = {
  fungsi: Fungsi;
  hasil: 'setuju' | 'setuju_catatan' | 'tolak';
  catatan: string | null;
  item: Record<string, boolean>;
  oleh: string;
  waktu: string;
  berlaku: boolean;
  versi_po: number;
  sebab_basi: string | null;
};

const LENCANA: Record<Keputusan['hasil'], { teks: string; kelas: string }> = {
  setuju:         { teks: 'Lampu hijau',            kelas: 'hijau' },
  setuju_catatan: { teks: 'Hijau dengan catatan',   kelas: 'kuning' },
  tolak:          { teks: 'Ditolak',                kelas: 'merah' },
};

const LENCANA_OTOMATIS: Record<KeadaanVerdict, { teks: string; kelas: string }> = {
  lolos:       { teks: 'Lolos',                   kelas: 'hijau' },
  gagal:       { teks: 'Perlu verifikasi manual', kelas: 'merah' },
  basi:        { teks: 'Untuk versi lama',        kelas: '' },
  'tidak-ada': { teks: '',                        kelas: '' },
};

export default function PanelVerifikasi({
  poId, status, keputusan, fungsiSaya, adalahLead, milikSaya, berkasUnggahan,
  nilaiSponsorship, grandTotal,
  verdict, versiPo,
}: {
  poId: string;
  status: string;
  /** Verdict IoM terakhir untuk PO ini (dihitung basis data, catatan/15), atau null. */
  verdict: BarisVerdict | null;
  versiPo: number;
  /**
   * Jalur pindaian, kalau PO ini diunggah. Verifikator memutuskan berdasarkan KERTASNYA,
   * bukan berdasarkan transkripsi yang diketik Sales — tanpa tautan ini ia menilai
   * angka tanpa pernah bisa melihat sumbernya.
   */
  berkasUnggahan?: string | null;
  keputusan: Keputusan[];
  /** Fungsi yang boleh diputuskan pengguna ini. Kosong berarti hanya menonton. */
  fungsiSaya: Fungsi[];
  /** Nilai sponsorship PO ini; null berarti belum diisi. Ditampilkan di kartu Finance. */
  nilaiSponsorship?: number | null;
  grandTotal: number;
  adalahLead: boolean;
  milikSaya: boolean;
}) {
  const router = useRouter();
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);
  const [buka, setBuka] = useState<Fungsi | null>(null);

  function bukaPindaian() {
    mulai(async () => {
      if (!berkasUnggahan) return;
      const url = await urlUnggahanPo(berkasUnggahan);
      if (url) window.open(url, '_blank', 'noopener');
      else setGalat('Pindaian tidak bisa dibuka. Coba muat ulang halaman.');
    });
  }
  const [centang, setCentang] = useState<Record<string, boolean>>({});
  const [catatan, setCatatan] = useState('');

  const berlaku = keputusan.filter((k) => k.berlaku);
  const riwayat = keputusan.filter((k) => !k.berlaku)
    .sort((a, b) => +new Date(b.waktu) - +new Date(a.waktu));
  const cari = (f: Fungsi) => berlaku.find((k) => k.fungsi === f);
  const lengkap = URUT_FUNGSI.every(cari);
  const adaTolak = berlaku.some((k) => k.hasil === 'tolak');
  const keadaanOtomatis = keadaanVerdict(verdict, { versiPo, adaPenolakan: adaTolak });
  const lolosOtomatis = keadaanOtomatis === 'lolos';
  // Syarat yang tetap berlaku setelah PO ini disetujui — inilah yang tercetak di
  // Surat Verifikasi Kesiapan. Masalah yang sudah diperbaiki tidak ikut: jejaknya
  // ada di riwayat, bukan di surat.
  const syarat = berlaku.filter((k) => k.hasil === 'setuju_catatan' && k.catatan);

  const aksi = (fn: () => Promise<{ ok: boolean; galat?: string }>, tulisGalat = setGalat) =>
    mulai(async () => {
      setGalat(null);
      const h = await fn();
      if (h.ok) { setBuka(null); setCentang({}); setCatatan(''); router.refresh(); }
      else tulisGalat(h.galat ?? 'Gagal.');
    });

  function bukaForm(f: Fungsi) {
    const ada = cari(f);
    setCentang(ada?.item ?? {});
    setCatatan(ada?.catatan ?? '');
    setGalat(null);
    setBuka(f);
  }

  if (status !== 'verifikasi' && !keputusan.length && !verdict) {
    if (status !== 'ditolak') return null;
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Verifikasi</h2>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
        {status === 'verifikasi'
          ? lolosOtomatis && !berlaku.length
            ? 'Lolos verifikasi otomatis, jadi keempat fungsi tidak perlu memutuskan.'
            : `${berlaku.length} dari 4 fungsi sudah memutuskan. Keempatnya berjalan paralel.`
          : status === 'ditolak'
            ? 'PO ditolak. Perbaiki lalu ajukan ulang: hanya persetujuan yang wilayahnya berubah yang perlu diulang.'
            : 'Riwayat keputusan verifikasi.'}
      </p>

      {verdict && (() => {
        const keadaan = keadaanOtomatis;
        const gagal = verdict.hasil.filter((h) => !h.lolos);
        // PO berkelompok memakai beberapa paket sekaligus; sebutkan semuanya.
        const daftarPaket = verdict.kelompok?.length ? verdict.kelompok : verdict.paket ? [verdict.paket] : [];
        const namaPaket = daftarPaket.join(' + ');
        return (
          <div className="kotak" style={{ padding: '16px 20px', marginTop: 12 }}>
            <div className="riwayat-kepala">
              <strong>Verifikasi otomatis IoM</strong>
              <span className={`lencana ${LENCANA_OTOMATIS[keadaan].kelas}`}>{LENCANA_OTOMATIS[keadaan].teks}</span>
              <span className="muted">{verdict.versi_iom}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
              {keadaan === 'lolos'
                ? `Paket ${namaPaket}. Keempat fungsi tidak perlu memeriksa: `
                  + (status === 'verifikasi'
                      // Verdict lolos tetapi PO ini TIDAK tertutup otomatis. Keadaan normal
                      // tidak pernah sampai ke sini -- penutupan terjadi di transaksi yang
                      // sama dengan penulisan verdict -- jadi ini tanda ada yang tertinggal
                      // (mis. verdict dari sebelum penutupan otomatis ada). Dulu kalimatnya
                      // menjanjikan penutupan yang toh tidak akan datang.
                      ? 'verdictnya lolos, tetapi penutupan otomatisnya belum terjadi. '
                        + 'Laporkan ini: seharusnya sistem yang menutupnya.'
                      : 'verifikasinya sudah dikonfirmasi sistem dan suratnya terbit otomatis.')
                : keadaan === 'gagal'
                  ? 'PO ini tidak memenuhi aturan otomatis, jadi diputuskan keempat fungsi seperti biasa.'
                  : 'Penilaian ini dibuat untuk versi PO atau aturan IoM yang lebih lama, jadi tidak dipakai. PO ini diputuskan keempat fungsi.'}
            </p>
            {keadaan === 'gagal' && gagal.length > 0 && (
              <div className="halangan" style={{ marginTop: 10 }}>
                <b>Aturan yang tidak terpenuhi</b>
                <ul>
                  {gagal.map((h) => (
                    <li key={h.kode}>{LABEL_ATURAN[h.kode] ?? h.kode}: <span className="muted">{h.bukti}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {berkasUnggahan && (
        <div className="cocok" style={{ marginTop: 12, display: 'block' }}>
          <p style={{ margin: 0 }}>
            <b>PO ini diunggah, bukan dibuat di platform.</b> Dokumen yang ditandatangani
            sekolah adalah pindaiannya; isian di sistem adalah transkripsi yang dibuat
            Sales. Putuskan berdasarkan kertasnya.
          </p>
          <button type="button" className="preset" style={{ marginTop: 10 }}
            onClick={bukaPindaian} disabled={kerja}>
            {kerja ? 'Membuka…' : 'Buka pindaian PO'}
          </button>
        </div>
      )}

      <div className="ttd-kisi">
        {URUT_FUNGSI.map((f) => {
          const k = cari(f);
          const bisa = status === 'verifikasi' && fungsiSaya.includes(f);
          return (
            <div className="ttd-kartu" key={f}>
              <h3>{LABEL_FUNGSI[f]}</h3>
              {f === 'finance' && !!nilaiSponsorship && (
                // Batas yang ditampilkan dibulatkan ke bawah; yang menentukan lolos tetap
                // perbandingan bulat di aturan IoM. Lihat catatan/18.
                <p className="meta" style={{ margin: 0 }}>
                  Sponsorship {rp(nilaiSponsorship)}
                  {grandTotal > 0 && <> · {((nilaiSponsorship / grandTotal) * 100).toFixed(1).replace('.', ',')}% dari {rp(grandTotal)}</>}
                  {' '}· batas {rp(Math.floor((grandTotal * 15) / 100))}
                </p>
              )}
              {k ? (
                <>
                  <span className={`lencana ${LENCANA[k.hasil].kelas}`}>{LENCANA[k.hasil].teks}</span>
                  {k.catatan && <p style={{ margin: 0, fontSize: 13 }}>{k.catatan}</p>}
                  <div className="ttd-waktu">
                    {k.oleh.split('@')[0]} ·{' '}
                    {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </>
              ) : (
                <div className="ttd-waktu">
                  {lolosOtomatis ? 'Tidak perlu diperiksa: lolos otomatis' : 'Menunggu keputusan'}
                </div>
              )}
              {bisa && (
                <button type="button" className={k ? 'preset' : 'tombol'}
                  style={{ width: 'auto', margin: 0 }} disabled={kerja}
                  onClick={() => bukaForm(f)}>
                  {k ? 'Ubah keputusan' : 'Periksa'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {buka && (
        <div className="kotak" style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{CHECKLIST[buka].bagian}</h3>
          <ul className="periksa">
            {CHECKLIST[buka].item.map((it) => (
              <li key={it.kode}>
                <label>
                  <input type="checkbox" checked={!!centang[it.kode]}
                    onChange={(e) => setCentang({ ...centang, [it.kode]: e.target.checked })} />
                  <span>{it.teks}{it.opsional && <em className="muted"> · opsional</em>}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="f" style={{ marginTop: 12 }}>
            <label htmlFor="v-catatan">Catatan</label>
            <textarea id="v-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)}
              placeholder="Wajib diisi bila menolak atau setuju dengan catatan." />
            <span className="bantuan">
              <strong>Setuju dengan catatan</strong> dipakai bila tidak menghambat tapi ada syarat
              yang harus dibawa ke pelaksanaan: catatannya ikut tercetak di Surat Verifikasi Kesiapan.
            </span>
          </div>
          <div className="ttd-aksi">
            <button type="button" className="preset" onClick={() => setBuka(null)} disabled={kerja}>Batal</button>
            <button type="button" className="preset merah" disabled={kerja}
              onClick={() => aksi(() => putuskanVerifikasi(poId, buka, 'tolak', catatan, centang))}>
              Tolak
            </button>
            <button type="button" className="preset kuning" disabled={kerja}
              onClick={() => aksi(() => putuskanVerifikasi(poId, buka, 'setuju_catatan', catatan, centang))}>
              Setuju dengan catatan
            </button>
            <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }} disabled={kerja}
              onClick={() => aksi(() => putuskanVerifikasi(poId, buka, 'setuju', catatan, centang))}>
              {kerja ? 'Menyimpan…' : 'Beri lampu hijau'}
            </button>
          </div>
        </div>
      )}

      {riwayat.length > 0 && (
        <details className="riwayat">
          <summary>Riwayat Keputusan Sebelumnya ({riwayat.length})</summary>
          <ol className="riwayat-daftar">
            {riwayat.map((k, i) => (
              <li key={i}>
                <div className="riwayat-kepala">
                  <span className={`lencana ${LENCANA[k.hasil].kelas}`}>{LENCANA[k.hasil].teks}</span>
                  <strong>{LABEL_FUNGSI[k.fungsi]}</strong>
                  <span className="muted">versi {k.versi_po}</span>
                </div>
                {k.catatan && <p style={{ margin: '6px 0 0', fontSize: 13 }}>{k.catatan}</p>}
                <div className="ttd-waktu">
                  {k.oleh.split('@')[0]} ·{' '}
                  {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  {k.sebab_basi && ` · ${k.sebab_basi}`}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {galat && <div className="pesan buruk" style={{ margin: '14px 0 0' }}>{galat}</div>}

      {/* Kotak Lead untuk jalur manual: PO yang verdictnya TIDAK lolos. PO yang lolos tidak
          pernah berhenti di `verifikasi` -- basis data menutupnya sendiri -- jadi bila ia toh
          tampil di sini, itu keadaan darurat dan keempat fungsi yang menyelesaikannya. */}
      {status === 'verifikasi' && adalahLead && (!lolosOtomatis || lengkap) && (
        <div className="kotak" style={{ padding: '18px 20px', marginTop: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Penutupan oleh Tech Ops Lead</h3>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
            {adaTolak
              ? 'Ada fungsi yang menolak. Tutup sebagai ditolak, lalu sampaikan alasannya ke Sales.'
              : lengkap
                ? syarat.length
                  ? `Keempat lampu hijau lengkap, dengan ${syarat.length} catatan yang ikut terbawa ke surat.`
                  : 'Keempat lampu hijau lengkap, tanpa catatan. Surat Verifikasi Kesiapan bisa diterbitkan.'
                : 'Menunggu keempat fungsi memberi keputusan.'}
          </p>
          {!adaTolak && syarat.length > 0 && (
            <>
              <p className="po-seksi" style={{ marginBottom: 4 }}>Catatan yang Terbawa ke Surat</p>
              <ul className="syarat">
                {syarat.map((k, i) => (
                  <li key={i}><strong>{LABEL_FUNGSI[k.fungsi]}</strong>: {k.catatan}</li>
                ))}
              </ul>
            </>
          )}
          <div className="ttd-aksi">
            {adaTolak ? (
              <button type="button" className="preset merah" disabled={kerja}
                onClick={() => aksi(() => tutupVerifikasi(poId, 'ditolak'))}>
                Tutup sebagai ditolak
              </button>
            ) : (
              <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
                disabled={kerja || !lengkap}
                onClick={() => aksi(() => tutupVerifikasi(poId, 'terverifikasi'))}>
                Nyatakan terverifikasi
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'ditolak' && milikSaya && (
        <button type="button" className="tombol" style={{ width: 'auto', margin: '14px 0 0' }}
          disabled={kerja} onClick={() => aksi(() => tarikKeDraf(poId))}>
          Tarik kembali ke draf untuk diperbaiki
        </button>
      )}
    </section>
  );
}
