/** Langkah 1: data sekolah dan jenjang. Isinya dipindah apa adanya dari form PO satu halaman (catatan/12, Tugas 5). */
import type { PropsLangkah } from '../use-form-po';
import { isian } from '../isian';
import KonfirmasiLangkah from '../konfirmasi-langkah';

export default function Sekolah({ f }: PropsLangkah) {
  const { sekolahTerkunci, pesan, sekolah, setSekolah, lain } = f;

  /**
   * Penanda per isian (catatan/17 amandemen 2 butir 2 dan 3). Hanya muncul selama kuncinya
   * masih menunggu, jadi isian yang sudah diperiksa kembali bersih tanpa aksi tambahan.
   * Tanda ragu/tidak terbaca hanya diketahui dari hasil baca; setelah draf dibuka lagi ia
   * hilang, dan yang tersisa penanda "dari scan, periksa" -- itu jujur: alasan keraguannya
   * memang tidak ikut tersimpan.
   */
  const tanda = (kunci: string) => {
    if (!f.menunggu(kunci)) return null;
    const buta = f.ekstraksi?.tidakTerbaca.includes(kunci);
    const ragu = f.ekstraksi?.ragu.includes(kunci);
    return (
      <span className={`lencana${buta || ragu ? ' kuning' : ''}`}>
        {buta ? 'tidak terbaca di scan' : ragu ? 'AI ragu, periksa lebih teliti' : 'dari scan, periksa'}
      </span>
    );
  };

  /** Nomor HP wajib dicentang eksplisit, ditandai ragu atau tidak (butir 4). */
  const centangHp = (kunci: string, teks: string) => (f.menunggu(kunci) ? (
    <label className="baris" style={{ padding: '4px 0 0' }}>
      <input type="checkbox" checked={false} onChange={() => f.centang(kunci)} />
      <span className="meta">{teks}</span>
    </label>
  ) : null);

  return (
    <>
        <section className="kotak">
          <div className="panel-head"><h2>Data Sekolah</h2><span className="hint">dipakai PO dan PKS</span></div>
          {sekolahTerkunci && (
            <div className="pesan buruk">
              Sekolah ini sekarang dipegang sales lain. Data sekolah tidak bisa diubah dari
              sini, minta Head of Sales atau Admin Sales bila perlu dikoreksi. Isian lain di PO
              ini tetap bisa disunting.
            </div>
          )}
          {/* fieldset disabled mengunci semua isian di dalamnya sekaligus; server tetap
              menolak perubahan sekolah terkunci (simpanDraf), ini hanya kejujuran tampilan. */}
          <fieldset disabled={sekolahTerkunci} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="isian">
            {isian('Nama sekolah', sekolah.nama, (v) => setSekolah({ ...sekolah, nama: v }), 'text', false, tanda('sekolah.nama'))}
            {isian('NPSN', sekolah.npsn ?? '', (v) => setSekolah({ ...sekolah, npsn: v }), 'text', false, tanda('sekolah.npsn'))}
            <div className="f">
              <label htmlFor="f-jenjang">Jenjang</label>
              <select id="f-jenjang" value={sekolah.jenjang}
                onChange={(e) => setSekolah({ ...sekolah, jenjang: e.target.value as 'SD' | 'SMP' | 'SMA' })}>
                <option value="SD">SD/MI</option><option value="SMP">SMP/MTS</option><option value="SMA">SMA/MA</option>
              </select>
              {tanda('sekolah.jenjang')}
            </div>
            {isian('Alamat sekolah', sekolah.alamat ?? '', (v) => setSekolah({ ...sekolah, alamat: v }), 'text', true, tanda('sekolah.alamat'))}
            {isian('Telepon sekolah', sekolah.telepon ?? '', (v) => setSekolah({ ...sekolah, telepon: v }), 'tel', false, tanda('sekolah.telepon'))}
            {isian('Email sekolah', sekolah.email ?? '', (v) => setSekolah({ ...sekolah, email: v }), 'email', false, tanda('sekolah.email'))}
            {isian('Kepala sekolah', sekolah.kepala_sekolah ?? '', (v) => setSekolah({ ...sekolah, kepala_sekolah: v }), 'text', false, tanda('sekolah.kepala_sekolah'))}
            {isian('No. HP kepala sekolah', sekolah.kepsek_hp ?? '', (v) => setSekolah({ ...sekolah, kepsek_hp: v }), 'tel', false, <>
              {tanda('sekolah.kepsek_hp')}
              {centangHp('sekolah.kepsek_hp', 'Nomor HP kepala sekolah sudah saya cocokkan satu angka demi satu angka dengan kertasnya')}
            </>)}
            {isian('Bendahara', sekolah.bendahara ?? '', (v) => setSekolah({ ...sekolah, bendahara: v }), 'text', false, tanda('sekolah.bendahara'))}
            {isian('No. HP bendahara', sekolah.bendahara_hp ?? '', (v) => setSekolah({ ...sekolah, bendahara_hp: v }), 'tel', false, <>
              {tanda('sekolah.bendahara_hp')}
              {centangHp('sekolah.bendahara_hp', 'Nomor HP bendahara sudah saya cocokkan satu angka demi satu angka dengan kertasnya')}
            </>)}
          </div>
          </fieldset>

          <KonfirmasiLangkah f={f} langkah="sekolah" label="Sekolah" />
        </section>
    </>
  );
}
