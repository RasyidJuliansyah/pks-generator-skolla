/** Langkah 3: jumlah siswa per kelas per rombel, dan kelompok tiap kelas. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import { isian, InputAngka } from '../isian';
import KonfirmasiLangkah from '../konfirmasi-langkah';

export default function Rombel({ f }: PropsLangkah) {
  const { barisKelas, hk, kelasKe, kelompokKelas, kolomRombel, labelKelompok, nRombel, rombel, setKelasKe, setNRombel, setRombel, siswa, totalRombel } = f;
  return (
    <>
        <section className="kotak">
          <div className="panel-head"><h2>Jumlah Siswa per Rombel</h2><span className="hint">mengisi jumlah siswa otomatis</span></div>
          <div className="isian rapat">
            <div className="f">
              <label htmlFor="f-nrombel">Jumlah rombel per kelas</label>
              <InputAngka id="f-nrombel" min={1} max={20} nilai={nRombel}
                set={(n) => setNRombel(Math.min(20, Math.max(1, n || 1)))} />
              <span className="bantuan">Kelas yang rombelnya lebih sedikit cukup dikosongkan.</span>
            </div>
          </div>
          <div className="kisi-rombel">
            <table>
              <thead><tr><th>Kelas</th>{hk && <th>Kelompok</th>}{kolomRombel.map((r) => <th key={r}>{r}</th>)}</tr></thead>
              <tbody>
                {barisKelas.map((k) => (
                  <tr key={k}>
                    <td>Kelas {k}</td>
                    {hk && (
                      <td>
                        <select aria-label={`Kelompok kelas ${k}`} value={kelompokKelas(k)}
                          onChange={(e) => setKelasKe({ ...kelasKe, [k]: +e.target.value })}>
                          {hk.kelompok.map((x) => <option key={x.nomor} value={x.nomor}>{labelKelompok(x)}</option>)}
                        </select>
                      </td>
                    )}
                    {kolomRombel.map((r) => (
                      <td key={r}>
                        <InputAngka min={0} aria-label={`Kelas ${k} rombel ${r}`}
                          nilai={rombel[`${k}-${r}`] ?? 0}
                          set={(n) => setRombel({ ...rombel, [`${k}-${r}`]: n })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="jumlah-rombel">
            Total siswa dari tabel rombel: <b>{totalRombel}</b>{' '}
            {totalRombel > 0 ? '(dipakai sebagai jumlah siswa)' : '(kosong, jumlah siswa diisi manual di ringkasan harga)'}
          </p>

          <KonfirmasiLangkah f={f} langkah="rombel" label="Rombel" />
        </section>
    </>
  );
}
