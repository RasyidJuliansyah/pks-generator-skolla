'use client';

import { useEffect, useState } from 'react';
import { useFormPo, type PropsFormPo, type PropsLangkah } from './use-form-po';
import { LANGKAH, langkahTampil, langkahAwal, statusLangkah, type KodeLangkah } from '@/lib/langkah-po';
import RingkasanHarga from './ringkasan-harga';
import PenampilScan from './penampil-scan';
import DaftarHalangan from './langkah/daftar-halangan';
import Cara from './langkah/cara';
import Sekolah from './langkah/sekolah';
import Paket from './langkah/paket';
import Rombel from './langkah/rombel';
import Termin from './langkah/termin';
import Penanda from './langkah/penanda';
import Tinjau from './langkah/tinjau';

const ISI: Record<KodeLangkah, (p: PropsLangkah) => React.ReactElement> = {
  cara: Cara, sekolah: Sekolah, paket: Paket, rombel: Rombel, termin: Termin, penanda: Penanda, tinjau: Tinjau,
};
const DENGAN_RINGKASAN: KodeLangkah[] = ['paket', 'rombel', 'termin', 'penanda', 'tinjau'];

/**
 * Form PO sebagai wizard (catatan/11). Seluruh state di useFormPo; berkas ini hanya
 * kerangka: bilah langkah, isi langkah, scan (PO unggahan), ringkasan harga, dan kaki.
 * "Lanjut" tidak pernah dikunci: draf boleh setengah jadi.
 */
export default function FormPo(props: PropsFormPo & { mulaiDi?: KodeLangkah }) {
  const f = useFormPo(props);
  const daftar = langkahTampil(!!props.awal);
  const [kini, setKini] = useState<KodeLangkah>(props.mulaiDi ?? langkahAwal(!!props.awal));
  const [dikunjungi, setDikunjungi] = useState<Set<KodeLangkah>>(() => new Set([kini]));
  const ke = (k: KodeLangkah) => { setKini(k); setDikunjungi((d) => new Set(d).add(k)); };
  // Hasil baca scan baru terpasang: buka langkah pertama yang isiannya datang dari AI. Tanpa
  // ini Sales tetap berdiri di langkah 0 dan isian baru itu masuk diam-diam -- persis keadaan
  // yang paling tidak boleh terjadi pada data yang wajib ia periksa.
  useEffect(() => {
    if (!f.ekstraksi) return;
    ke('sekolah');
    // `ke` sengaja tidak masuk daftar ketergantungan: ia fungsi baru tiap render, dan memasukkannya
    // membuat efek ini jalan terus sehingga Sales tidak bisa pindah langkah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.ekstraksi]);
  const i = daftar.findIndex((l) => l.kode === kini);
  const Isi = ISI[kini];
  const denganScan = f.asal === 'unggahan' && kini !== 'cara';
  const denganRingkasan = DENGAN_RINGKASAN.includes(kini);

  return (
    <>
      <nav className="bilah-langkah no-print" aria-label="Langkah Form PO">
        <ol>
          {daftar.map((l, n) => {
            const status = statusLangkah(l.kode, f.halanganCetak, dikunjungi);
            // Tinjau terkunci selama isian hasil baca scan belum dicocokkan (catatan/17
            // amandemen 2 butir 4). Untuk PO tanpa ekstraksi `tinjauTerbuka` selalu true, jadi
            // jalur lama persis seperti sebelumnya.
            const terkunci = l.kode === 'tinjau' && !f.tinjauTerbuka;
            return (
              <li key={l.kode}>
                <button type="button" aria-current={l.kode === kini ? 'step' : undefined}
                  data-status={status} disabled={terkunci} onClick={() => ke(l.kode)}>
                  <span className="bilah-nomor" aria-hidden="true">{n + 1}</span>
                  {l.judul}
                  {status === 'halangan' && <span className="sr">, ada halangan</span>}
                  {terkunci && <span className="sr">, terkunci sampai isian scan dicocokkan</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {denganScan ? (
        <div className="langkah-dengan-scan">
          <PenampilScan f={f} langkah={kini} />
          <div>
            <Isi f={f} ke={ke} />
            {denganRingkasan && <RingkasanHarga f={f} ke={ke} />}
          </div>
        </div>
      ) : denganRingkasan && kini !== 'tinjau' ? (
        <div className="grid-po">
          <div><Isi f={f} ke={ke} /></div>
          <RingkasanHarga f={f} ke={ke} />
        </div>
      ) : (
        // Tinjau: dokumen A4 lebih lebar dari kolom kisi, jadi ringkasannya di bawah,
        // sama seperti PO unggahan. Pembungkusnya mematikan sticky .ledger; tanpa itu
        // panelnya melayang di atas kaki dan panel verifikasi di /po/[id].
        <div className="langkah-tinjau">
          <Isi f={f} ke={ke} />
          {denganRingkasan && <RingkasanHarga f={f} ke={ke} />}
        </div>
      )}

      {f.pesan && (
        <div className={`pesan ${f.pesan.baik ? 'baik' : 'buruk'} no-print`} role={f.pesan.baik ? 'status' : 'alert'}
          style={{ margin: '16px 0 0' }}>
          {f.pesan.isi.length === 1 ? f.pesan.isi[0] : <ul>{f.pesan.isi.map((g, n) => <li key={n}>{g}</li>)}</ul>}
        </div>
      )}

      <div className="langkah-kaki no-print">
        <button type="button" className="preset" disabled={i <= 0} onClick={() => ke(daftar[i - 1].kode)}>
          ← Kembali
        </button>
        <div className="langkah-simpan">
          <button type="button" className="tombol" disabled={f.rintangan.length > 0 || f.kirim} onClick={f.simpan}>
            {f.kirim ? 'Menyimpan…' : f.awal?.id ? 'Simpan perubahan' : 'Simpan sebagai draf'}
          </button>
          {f.halanganSimpan.length > 0 && kini !== 'tinjau' && (
            <DaftarHalangan judul="Belum bisa disimpan" halangan={f.halanganSimpan} ke={ke} />
          )}
        </div>
        <button type="button" className="preset"
          disabled={i >= daftar.length - 1 || (daftar[i + 1]?.kode === 'tinjau' && !f.tinjauTerbuka)}
          onClick={() => ke(daftar[i + 1].kode)}>
          {i < daftar.length - 1 ? `Lanjut: ${LANGKAH.find((l) => l.kode === daftar[i + 1].kode)!.judul} →` : 'Lanjut →'}
        </button>
      </div>
    </>
  );
}
