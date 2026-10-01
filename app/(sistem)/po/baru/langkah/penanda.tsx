/** Langkah 5: tempat dan tanggal tanda tangan, penanda tangan Skolla, dan catatan. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import { useState } from 'react';
import type { PropsLangkah } from '../use-form-po';
import { isian, InputRupiah } from '../isian';
import KonfirmasiLangkah from '../konfirmasi-langkah';
import { rp, persenTeks, angkaPersen, rupiahDariPersen } from '@/lib/format';
import { labelPihak } from '@/lib/pihak';

export default function Penanda({ f }: PropsLangkah) {
  const { akunPm, akunSm, akunRh, skema, lain, setLain, grand } = f;
  // Batas yang DITAMPILKAN dibulatkan ke bawah; yang menentukan lolos atau tidak tetap
  // perbandingan bilangan bulat di aturan IoM (nilai * 100 <= grand * 15). Persen yang
  // terlihat sama belum tentu lolos — lihat catatan/18.
  const batasSp = Math.floor((grand * 15) / 100);
  const diAtasBatas = lain.nilaiSponsorship > 0 && lain.nilaiSponsorship * 100 > grand * 15;
  // Dinyalakan oleh nilai ATAU catatan, bukan keduanya: Sales sedang mengetik, dan
  // peringatannya justru paling berguna sebelum barisnya lengkap.
  const adaSp = lain.nilaiSponsorship > 0 || lain.cat2.trim() !== '';
  // Persen hanya cara lain mengetik angka yang SAMA: yang tersimpan tetap rupiah di
  // lain.nilaiSponsorship, jadi aturan IoM, Form PO tercetak, dan PKS tidak ikut berubah.
  // Teks persennya disimpan terpisah supaya "12,5" bisa diketik utuh tanpa dibulatkan
  // bolak-balik oleh pembulatan rupiah di tengah jalan.
  const [satuan, setSatuan] = useState<'rp' | 'persen'>('rp');
  const [teksPersen, setTeksPersen] = useState('');
  // Tanpa grand total tidak ada yang bisa dipersenkan; pilihannya dimatikan, bukan
  // disembunyikan, supaya Sales tahu ia ada dan kenapa belum bisa dipakai.
  const pakaiPersen = grand > 0 && satuan === 'persen';
  const persenNilai = grand > 0 ? (lain.nilaiSponsorship * 100) / grand : 0;
  return (
    <>
        <section className="kotak">
          <div className="panel-head"><h2>Penanda Tangan &amp; Catatan</h2><span className="hint">halaman 2 dan 3 Form PO</span></div>
          <div className="isian">
            {isian('Kota', lain.kota, (v) => setLain({ ...lain, kota: v }))}
            {isian('Tanggal tanda tangan', lain.tanggalTtd, (v) => setLain({ ...lain, tanggalTtd: v }), 'date')}
            <div className="f">
              <label htmlFor="f-pm">Partnership Manager</label>
              <select id="f-pm" value={lain.namaPm} onChange={(e) => setLain({ ...lain, namaPm: e.target.value })}>
                <option value="">- pilih -</option>
                {akunPm.map((a) => (
                  <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                ))}
              </select>
            </div>
            {skema === 4 && (
              <div className="f">
                <label htmlFor="f-rh">Regional Head Division</label>
                <select id="f-rh" value={lain.namaRh} disabled={!akunRh.length}
                  onChange={(e) => setLain({ ...lain, namaRh: e.target.value })}>
                  <option value="">- pilih -</option>
                  {akunRh.map((a) => (
                    <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                  ))}
                </select>
                {!akunRh.length && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Belum ada akun Regional Head Division. Minta Super Admin memberikan perannya di Kelola Pengguna.
                  </span>
                )}
              </div>
            )}
            <div className="f">
              <label htmlFor="f-sm">{labelPihak('sales_manager', skema)}</label>
              <select id="f-sm" value={lain.namaSm} onChange={(e) => setLain({ ...lain, namaSm: e.target.value })}>
                <option value="">- pilih -</option>
                {akunSm.map((a) => (
                  <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                ))}
              </select>
            </div>
            <div className="f lebar">
              <label htmlFor="f-c1">Catatan 1: Detail pelaksanaan</label>
              <textarea id="f-c1" value={lain.cat1} onChange={(e) => setLain({ ...lain, cat1: e.target.value })} />
            </div>
            <div className="f lebar">
              <label htmlFor="f-c2">Catatan 2: Sponsorship</label>
              <textarea id="f-c2" value={lain.cat2} onChange={(e) => setLain({ ...lain, cat2: e.target.value })} />
            </div>
            {/* Catatan dari hasil baca scan: isinya datang dari model, JENISNYA dipilih Sales
                (catatan/17 aturan 1). Label yang salah -- sponsorship terbaca sebagai
                pelaksanaan -- membuat nilainya tidak pernah dituntut dan batas 15% tidak
                pernah diperiksa, jadi jenis tidak boleh ditentukan mesin. */}
            {f.catatanScan.length > 0 && (
              <div className="f lebar">
                <p className="bantuan" style={{ margin: 0 }}>
                  <strong>Catatan dari hasil baca scan.</strong> Pilih jenisnya; Tinjau terkunci
                  sampai semuanya berjenis, dan catatan yang belum berjenis tidak ikut tersimpan.
                </p>
                {f.catatanScan.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <select aria-label={`Jenis catatan hasil scan ke-${i + 1}`} value={c.jenis ?? ''}
                      onChange={(e) => f.setCatatanScan(f.catatanScan.map((x, j) => j === i
                        ? { ...x, jenis: (e.target.value || null) as 'pelaksanaan' | 'sponsorship' | null } : x))}>
                      <option value="">- pilih jenis -</option>
                      <option value="pelaksanaan">Pelaksanaan</option>
                      <option value="sponsorship">Sponsorship</option>
                    </select>
                    <span className="meta">{c.isi}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="f lebar">
              <label htmlFor="f-sp">Nilai sponsorship</label>
              <div className="alih-satuan">
                <button type="button" className="preset" aria-pressed={!pakaiPersen}
                  onClick={() => setSatuan('rp')}>Rupiah</button>
                <button type="button" className="preset" aria-pressed={pakaiPersen}
                  disabled={grand <= 0}
                  onClick={() => { setTeksPersen(persenNilai ? persenTeks(persenNilai) : ''); setSatuan('persen'); }}>
                  Persen
                </button>
              </div>
              {pakaiPersen ? (
                <span className="uang">
                  <input id="f-sp" type="text" inputMode="decimal" value={teksPersen}
                    placeholder="0" aria-label="Nilai sponsorship dalam persen dari grand total"
                    onChange={(e) => {
                      const t = e.target.value.replace(/[^\d.,]/g, '');
                      setTeksPersen(t);
                      setLain({ ...lain, nilaiSponsorship: rupiahDariPersen(angkaPersen(t), grand) });
                    }} />
                  <span className="uang-akhiran" aria-hidden="true">%</span>
                </span>
              ) : (
                <InputRupiah id="f-sp" nilai={lain.nilaiSponsorship}
                  aria-label="Nilai sponsorship dalam rupiah"
                  set={(n) => setLain({ ...lain, nilaiSponsorship: n })} />
              )}
              <span className="bantuan">
                {grand <= 0
                  ? 'Grand total masih nol, jadi nilainya belum bisa diisi dalam persen.'
                  : pakaiPersen
                    ? <>Setara {rp(lain.nilaiSponsorship)} dari grand total {rp(grand)}.</>
                    : <>Setara {persenTeks(persenNilai)}% dari grand total.</>}
              </span>
              <span className="meta">
                Total nilai, termasuk barang dan media dengan harga pokoknya bagi Skolla.
                Batas 15%: {rp(batasSp)}.
              </span>
              {diAtasBatas && (
                <span className="lencana kuning">
                  Di atas 15% dari total. PO ini akan diverifikasi manual.
                </span>
              )}
              {adaSp && (
                // Sengaja pendek: `.lencana` itu `white-space:nowrap` dan `.kotak`
                // `overflow:hidden`, jadi teks yang lebih panjang dari ini terpotong di
                // 375px, bukan membungkus. Kalimat lengkapnya ada di halaman PO.
                <span className="lencana kuning">
                  Perlu konfirmasi Finance sebelum PKS diunggah
                </span>
              )}
            </div>
          </div>
          <label className="baris" style={{ padding: '12px 16px' }}>
            <input type="checkbox" checked={lain.permintaanTambahan}
              onChange={(e) => setLain({ ...lain, permintaanTambahan: e.target.checked })} />
            <span>
              <span className="nama">Ada permintaan penambahan produk atau layanan di luar paket</span>
              <span className="meta">
                Centang bila sekolah meminta fitur atau layanan yang tidak ada di paket. PO ini lalu
                diverifikasi manual, karena permintaannya butuh komitmen Operational.
              </span>
            </span>
          </label>

          <KonfirmasiLangkah f={f} langkah="penanda" label="Penanda tangan & catatan" />
        </section>
    </>
  );
}
