/** Ringkasan harga di samping langkah 2 sampai 6; di layar sempit ditambah bilah ringkas di bawah layar. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from './use-form-po';
import { InputAngka } from './isian';
import { rp } from '@/lib/format';
import { batasBawahPeserta } from '@/lib/hitung';

export default function RingkasanHarga({ f }: PropsLangkah) {
  const { halanganSimpan, komponen, namaTier, asal, kelompok, siswa, setSiswa, guru, setGuru, harga, pilihan, totalRombel, nSiswa, h, halangan, lantaiSiswa, lantaiGuru, hSiswa, hGuru, hk, labelKelompok, grand, cocok, hematPaket, hampir } = f;
  return (
    <>
      <div className="ringkas-ponsel no-print" aria-hidden="true">
        <span>Grand total <b>{rp(grand)}</b></span>
        <span>{halanganSimpan.length ? `${halanganSimpan.length} halangan` : 'Siap disimpan'}</span>
      </div>
      <aside className="kotak ledger">
        <div className="peserta">
          <label htmlFor="n-siswa">Siswa</label>
          <InputAngka id="n-siswa" min={batasBawahPeserta(pilihan, 'siswa')} nilai={nSiswa}
            disabled={totalRombel > 0} set={setSiswa} />
          <label htmlFor="n-guru">Guru</label>
          <InputAngka id="n-guru" min={batasBawahPeserta(pilihan, 'guru')} nilai={guru} set={setGuru} />
        </div>

        {hk && (
          <ul className="ringkas-kelompok">
            {hk.kelompok.map((k) => (
              <li key={k.nomor}>
                <b>{labelKelompok(k)}</b> · {k.siswa} siswa × {rp(k.hargaSiswa)}
                <span>{k.hitungan.paket ? `paket ${k.hitungan.paket}` : 'a la carte'} · lantai {rp(k.lantai)}</span>
              </li>
            ))}
          </ul>
        )}

        {hk ? namaTier.map((nama, i) => {
          const total = hk.kelompok.reduce((a, k) => a + (k.hitungan.perSiswa[i] ?? 0) * k.siswa, 0)
            + (h.perGuru[i] ?? 0) * guru;
          return (
            <div className={`tier t${i}`} key={nama}>
              <div className="tier-atas">
                <span className="tier-nama">{nama}</span>
                <span className="tier-per">{hk.kelompok.length} kelompok{h.perGuru[i] > 0 && ` · ${rp(h.perGuru[i])} / guru`}</span>
              </div>
              <div className="tier-total">{rp(total)}</div>
            </div>
          );
        }) : namaTier.map((nama, i) => (
          <div className={`tier t${i}`} key={nama}>
            <div className="tier-atas">
              <span className="tier-nama">{nama}</span>
              <span className="tier-per">
                {rp(h.perSiswa[i])} / siswa{h.perGuru[i] > 0 && ` · ${rp(h.perGuru[i])} / guru`}
              </span>
            </div>
            <div className="tier-total">{rp(h.total[i])}{h.belumLengkap[i].length > 0 && ' +'}</div>
          </div>
        ))}

        {!hk && cocok && (
          <div className="cocok">
            <span className="titik" />
            <span>
              <b>Harga paket {cocok.n}</b>: {rp(cocok.p[0])} / siswa, lantai {rp(cocok.p[1])}.
              {hematPaket > 0 && (
                <> Lebih murah <b>{rp(hematPaket)} / siswa</b> daripada memilih komponennya
                satu per satu.</>
              )}
              {' '}Isinya persis paket ini, jadi otomatis memakai harga paket. Melepas satu
              komponen mengembalikannya ke harga a la carte.
            </span>
          </div>
        )}
        {!hk && hampir && (
          <div className="cocok">
            <span className="titik" />
            <span>
              <b>Harga a la carte</b>: lantai {rp(h.perSiswa[1])} / siswa. Tambah{' '}
              <b>{hampir.kurang.n}</b> dan susunannya jadi paket{' '}
              {hampir.p.n}: lantainya turun {rp(hampir.hemat)} / siswa.
            </span>
          </div>
        )}

        {asal === 'unggahan' && ((lantaiSiswa > 0 && hSiswa < lantaiSiswa)
          || (lantaiGuru > 0 && guru > 0 && hGuru < lantaiGuru)) && (
          <div className="halangan">
            <b>Di bawah bottom price: butuh persetujuan Head of Operations</b>
            <ul>
              {lantaiSiswa > 0 && hSiswa < lantaiSiswa && (
                <li>Harga siswa {rp(hSiswa)}, bottom price {rp(lantaiSiswa)}.</li>
              )}
              {lantaiGuru > 0 && guru > 0 && hGuru < lantaiGuru && (
                <li>Harga guru {rp(hGuru)}, bottom price {rp(lantaiGuru)}.</li>
              )}
              <li>
                Draf ini tetap bisa disimpan, kertasnya sudah ditandatangani dan itu
                tidak bisa dibatalkan. Tapi PO-nya tidak akan bisa diajukan sampai Head
                of Operations menyetujuinya.
              </li>
            </ul>
          </div>
        )}

      </aside>
    </>
  );
}
