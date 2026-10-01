/** Langkah 2: kelompok, paket, komponen, Pelatihan Guru, dan harga kesepakatan. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import { isian, InputAngka, pemilih } from '../isian';
import KonfirmasiLangkah from '../konfirmasi-langkah';
import { rp } from '@/lib/format';
import { presetCocok } from '@/lib/hitung';
import { ID_GURU } from '@/lib/aturan-komponen';

export default function Paket({ f }: PropsLangkah) {
  const { komponen, preset, asal, setDipilih, kelompok, setKelompok, pilihKe, berkelompok, siswa, guru, rombel, harga, setHarga, pilihan, barisKelas, h, lantaiSiswa, lantaiGuru, hk, labelKelompok, barisFitur, ubahKelompok, pisah, tambahKelompok, hapusKelompok } = f;
  // Bidang harga menolak turun di bawah bottom price: nilainya naik lagi ke lantai saat
  // bidang ditinggalkan. KECUALI PO unggahan — kertasnya sudah ditandatangani, dan di
  // sana lantai ditegakkan saat pengajuan, tempat pengecualian Head of Operations
  // berlaku (alasan yang sama dengan halangan di use-form-po.ts).
  const kunciLantai = asal !== 'unggahan';
  return (
    <>
        {/* Kotak paket yang ambigu atau kotak lain di kertas: TIDAK ada komponen yang diisi
            otomatis (catatan/17 "Kotak paket"), dan alasannya harus terbaca Sales di langkah
            ini -- kalau tidak, isian paket yang kosong tampak seperti kegagalan sistem. */}
        {f.ekstraksi?.catatanPaket && (
          <div className="pesan buruk no-print" style={{ marginBottom: 16 }}>
            {f.ekstraksi.catatanPaket}. Pilih sendiri paket dan komponennya di bawah.
          </div>
        )}
        {f.ekstraksi && f.ekstraksi.peringatan.length > 0 && (
          <div className="pesan buruk no-print" style={{ marginBottom: 16 }}>
            <strong>Perlu diperiksa dari hasil baca scan:</strong>
            <ul>{f.ekstraksi.peringatan.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        )}
        {asal === 'platform' && (
          <section className="kotak no-print">
            <div className="panel-head"><h2>Kelompok Siswa</h2>
              <span className="hint">{berkelompok ? `${kelompok.length} kelompok` : 'satu harga untuk semua kelas'}</span></div>
            <div style={{ padding: '4px 16px 14px' }}>
              <p className="muted" style={{ fontSize: 13.5, margin: '0 0 10px', maxWidth: 640 }}>
                {berkelompok
                  ? <>Tiap kelompok punya komponen dan harganya sendiri. Kelas mana masuk kelompok mana
                    diatur di tabel rombel. Pelatihan Guru berlaku untuk seluruh PO.</>
                  : <>Bila angkatan memakai isi berbeda, misalnya kelas 12 paket lengkap, kelas 10 hanya
                    LMS, pisahkan jadi beberapa kelompok, supaya tidak ada siswa yang ditagih untuk
                    layanan yang tidak dipakainya.</>}
              </p>
              {berkelompok ? (
                <button type="button" className="preset" onClick={tambahKelompok}
                  disabled={kelompok.length >= Math.min(6, barisKelas.length)}>+ Tambah kelompok</button>
              ) : (
                <button type="button" className="preset" onClick={pisah}>Pisah jadi beberapa kelompok</button>
              )}
            </div>
          </section>
        )}

        {hk ? (<>
        {kelompok.map((kel) => {
          const hasil = hk.kelompok.find((x) => x.nomor === kel.nomor)!;
          const pilihDi = pilihKe[kel.nomor] ?? {};
          const setPilihDi = ubahKelompok(kel.nomor);
          const baris = pemilih(pilihDi, setPilihDi, `k${kel.nomor}-`);
          const pilihanDi = Object.entries(pilihDi).map(([id, sesi]) => ({ id, sesi }));
          return (
            <section className="kotak" key={kel.nomor}>
              <div className="panel-head">
                <h2>{labelKelompok(hasil)}</h2>
                <span className="hint">
                  {hasil.siswa} siswa · {hasil.hitungan.paket ? `paket ${hasil.hitungan.paket}` : 'a la carte'}
                </span>
              </div>
              <div className="isian rapat">
                {isian(`Nama kelompok ${kel.nomor}`, kel.nama,
                  (v) => setKelompok(kelompok.map((x) => x.nomor === kel.nomor ? { ...x, nama: v } : x)))}
                <div className="f">
                  <label htmlFor={`f-hk${kel.nomor}`}>Harga / akun siswa</label>
                  <InputAngka id={`f-hk${kel.nomor}`} min={hasil.lantai || 0} step={500}
                    lantai={kunciLantai ? hasil.lantai || 0 : 0}
                    nilai={kel.harga || hasil.hitungan.perSiswa[0] || 0}
                    set={(n) => setKelompok(kelompok.map((x) => x.nomor === kel.nomor ? { ...x, harga: n } : x))} />
                  <span className="bantuan">Batas bawah {hasil.lantai ? rp(hasil.lantai) : '-'}</span>
                </div>
              </div>
              <div className="presets">
                {preset.map((p) => (
                  <button key={p.n} type="button" className="preset" aria-pressed={presetCocok(pilihanDi, p.ids)}
                    onClick={() => setPilihDi(() => Object.fromEntries(p.ids.map((id) => [id, 1])))}>{p.n}</button>
                ))}
              </div>
              <ul className="daftar">{komponen.filter((k) => k.g === 'core' && !ID_GURU.includes(k.id)).map(baris)}</ul>
              <ul className="daftar">{komponen.filter((k) => k.g === 'addon' && !ID_GURU.includes(k.id)).map(baris)}</ul>
              <div style={{ padding: '4px 16px 14px' }}>
                <button type="button" className="preset" onClick={() => hapusKelompok(kel.nomor)}>Hapus kelompok ini</button>
              </div>
            </section>
          );
        })}
        <section className="kotak">
          <div className="panel-head"><h2>Pelatihan Guru</h2><span className="hint">tingkat PO · per guru</span></div>
          <ul className="daftar">{komponen.filter((k) => ID_GURU.includes(k.id)).map(barisFitur)}</ul>
        </section>
        </>) : (<>
        <section className="kotak">
          <div className="panel-head"><h2>Paket Siap Pakai</h2><span className="hint">klik untuk mencentang otomatis</span></div>
          <div className="presets">
            {preset.map((p) => (
              <button key={p.n} type="button" className="preset" aria-pressed={presetCocok(pilihan, p.ids)}
                onClick={() => setDipilih(Object.fromEntries(p.ids.map((id) => [id, 1])))}>{p.n}</button>
            ))}
          </div>
        </section>

        <section className="kotak">
          <div className="panel-head"><h2>Fitur Inti</h2><span className="hint">per siswa · 1 tahun ajaran</span></div>
          <ul className="daftar">{komponen.filter((k) => k.g === 'core').map(barisFitur)}</ul>
        </section>

        <section className="kotak">
          <div className="panel-head"><h2>Add-on</h2><span className="hint">per siswa · per sesi</span></div>
          <ul className="daftar">{komponen.filter((k) => k.g === 'addon').map(barisFitur)}</ul>
        </section>
        </>)}
        <section className="kotak">
          <div className="panel-head"><h2>Harga Kesepakatan</h2><span className="hint">yang tercetak di PO</span></div>
          <div className="isian rapat">
            {!hk && <div className="f">
              <label htmlFor="f-hs">Harga / akun siswa</label>
              <InputAngka id="f-hs" min={lantaiSiswa || 0} step={500} nilai={harga.siswa || h.perSiswa[0] || 0}
                lantai={kunciLantai ? lantaiSiswa || 0 : 0}
                set={(n) => setHarga({ ...harga, siswa: n })} />
              <span className="bantuan">Batas bawah {lantaiSiswa ? rp(lantaiSiswa) : '-'}</span>
            </div>}
            <div className="f">
              <label htmlFor="f-hg">Harga / akun guru</label>
              <InputAngka id="f-hg" min={lantaiGuru || 0} step={500} nilai={harga.guru || h.perGuru[0] || 0}
                lantai={kunciLantai ? lantaiGuru || 0 : 0}
                set={(n) => setHarga({ ...harga, guru: n })} />
              <span className="bantuan">Batas bawah {lantaiGuru ? rp(lantaiGuru) : '-'}</span>
            </div>
          </div>

        </section>
        <KonfirmasiLangkah f={f} langkah="paket" label="Paket & harga" />
    </>
  );
}
