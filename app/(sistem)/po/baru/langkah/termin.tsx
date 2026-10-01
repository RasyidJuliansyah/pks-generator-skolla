/** Langkah 4: termin pembayaran, masa aktif, dan sumber dana. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import { isian, InputRupiah, bukaKalender, labelTermin, MAKS_TERMIN } from '../isian';
import KonfirmasiLangkah from '../konfirmasi-langkah';
import { rp } from '@/lib/format';

export default function Termin({ f }: PropsLangkah) {
  const { rombel, termin, setTermin, lain, setLain, grand, totalTermin, sisaUntuk } = f;
  return (
    <>
        <section className="kotak">
          <div className="panel-head"><h2>Termin Pembayaran</h2><span className="hint">totalnya wajib sama dengan grand total</span></div>
          <div className="isian rapat">
            {termin.map((t, i) => (
              <div className="f" key={t.urutan}>
                <label htmlFor={`f-t${i}`}>{labelTermin(i)}</label>
                <input id={`f-t${i}`} type="date" value={t.tanggal ?? ''} onClick={bukaKalender}
                  onChange={(e) => setTermin(termin.map((x, j) => j === i ? { ...x, tanggal: e.target.value } : x))} />
                <InputRupiah nilai={t.nominal} placeholder="Nominal"
                  aria-label={`Nominal ${labelTermin(i)} dalam rupiah`}
                  set={(n) => setTermin(termin.map((x, j) =>
                    j === i ? { ...x, nominal: Math.min(n, sisaUntuk(i)) } : x))} />
                <span className="bantuan">
                  {sisaUntuk(i) > 0 ? `Sisa yang bisa diisi ${rp(sisaUntuk(i))}` : 'Grand total sudah terpenuhi'}
                </span>
              </div>
            ))}
          </div>
          <div className="aksi-termin">
            <button type="button" disabled={termin.length >= MAKS_TERMIN}
              onClick={() => setTermin([...termin, { urutan: termin.length + 1, tanggal: '', nominal: 0 }])}>
              + Tambah termin
            </button>
            <button type="button" disabled={termin.length <= 1} onClick={() => setTermin(termin.slice(0, -1))}>− Hapus termin terakhir</button>
          </div>
          <p className="jumlah-rombel">
            Total termin: <b>{rp(totalTermin)}</b> · Grand total: <b>{rp(grand)}</b>
            {termin.length >= MAKS_TERMIN && ` · maksimal ${MAKS_TERMIN} termin`}
          </p>

          <div className="panel-head"><h2>Masa Aktif &amp; Sumber Dana</h2><span className="hint">tercetak di PO dan PKS</span></div>
          <div className="isian">
            {isian('Masa aktif mulai', lain.masaMulai, (v) => setLain({ ...lain, masaMulai: v }), 'date')}
            {isian('Masa aktif selesai', lain.masaSelesai, (v) => setLain({ ...lain, masaSelesai: v }), 'date')}
            <div className="f">
              <label htmlFor="f-dana">Sumber dana</label>
              <select id="f-dana" value={lain.sumberDana} onChange={(e) => setLain({ ...lain, sumberDana: e.target.value })}>
                <option>BOS</option><option>Swadaya</option><option value="Lainnya">Lainnya</option>
              </select>
            </div>
            {isian('Sumber dana lainnya', lain.sumberDanaLain, (v) => setLain({ ...lain, sumberDanaLain: v }))}
          </div>

          <KonfirmasiLangkah f={f} langkah="termin" label="Termin & masa aktif" />
        </section>
    </>
  );
}
