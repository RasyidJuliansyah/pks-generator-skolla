/**
 * Merangkai riwayat satu PO dari enam sumber jadi satu lini masa berurutan.
 *
 * Datanya tidak dikarang di sini — semuanya memang sudah tersimpan sejak awal,
 * hanya tersebar: perpindahan status di `po_riwayat`, tanda tangan tiga pihak di
 * `tanda_tangan`, keputusan empat fungsi di `verifikasi` (termasuk yang sudah
 * dibasikan berikut sebabnya), penerbitan surat di `surat_verifikasi`, dan
 * penyusunan sampai unggahan bermeterai di `pks`. Sumber keenam, `po_komentar`,
 * adalah percakapannya.
 *
 * Yang belum pernah tercatat cuma perpindahan status, dan itu yang ditambahkan
 * trigger `po_catat`. Untuk PO yang lahir sebelum trigger itu ada, lini masanya
 * memang bolong di bagian awal — sengaja dibiarkan bolong daripada diisi
 * rekaan yang kelihatan rapi.
 */

import { LABEL_FUNGSI, type Fungsi } from './checklist';
import { tglID } from './format';
import { labelPihak, skemaDari, type Pihak } from './pihak';

export type Peristiwa = {
  /** Penambat balasan. Lihat kunciPeristiwa. */
  kunci: string;
  waktu: string;
  /** Dipakai sebagai kelas warna titik lini masa: `w-<warna>`. */
  warna: string;
  judul: string;
  rincian?: string;
  oleh?: string | null;
  /** Hanya pada peristiwa komentar — tampilannya butuh lebih dari judul dan rincian. */
  komentar?: KomentarLini;
  /** Balasan langsung, TERLAMA DI ATAS — percakapan dibaca dari awal. */
  balasan: Peristiwa[];
  /** Peristiwa yang dibalas sudah tidak ada di lini masa. */
  yatim?: boolean;
};

export type KomentarTersimpan = {
  id: string; isi: string; oleh: string; waktu: string; versi_po: number;
  disunting_pada: string | null; dihapus_pada: string | null; dihapus_oleh: string | null;
  /** null = komentar tingkat atas. Lihat catatan/20. */
  induk_kunci?: string | null;
  po_komentar_revisi?: { isi: string; digantikan_pada: string }[];
};

export type KomentarLini = {
  id: string;
  /** null bila sudah dihapus — isinya tetap tersimpan, tapi tidak ditampilkan. */
  isi: string | null;
  /** Ditulis sebelum PO berubah; "harga termin kedua kurang" mungkin sudah tidak benar. */
  basi: boolean;
  disunting: string | null;
  dihapus: { oleh: string | null; pada: string } | null;
  /** Versi-versi sebelumnya, terbaru dulu. */
  revisi: { isi: string; digantikan_pada: string }[];
};

const LABEL_STATUS: Record<string, string> = {
  draf: 'Draf dibuat',
  menunggu_ttd: 'Dikirim untuk ditandatangani',
  ditandatangani: 'Semua tanda tangan lengkap',
  verifikasi: 'Diajukan untuk verifikasi',
  ditolak: 'Ditolak, dikembalikan ke Sales',
  terverifikasi: 'Dinyatakan terverifikasi',
  pks_terbit: 'PKS diterbitkan',
  pks_ditandatangani: 'PKS ditandatangani basah',
  aktif: 'Layanan aktif',
  selesai: 'Kerja sama selesai',
};

const WARNA_STATUS: Record<string, string> = {
  draf: 'draf', menunggu_ttd: 'menunggu-ttd', ditandatangani: 'ditandatangani',
  verifikasi: 'verifikasi', ditolak: 'ditolak', terverifikasi: 'terverifikasi',
  pks_terbit: 'pks-terbit', pks_ditandatangani: 'pks-ditandatangani',
  aktif: 'aktif', selesai: 'selesai',
};

const HASIL: Record<string, { teks: string; warna: string }> = {
  setuju: { teks: 'memberi lampu hijau', warna: 'terverifikasi' },
  setuju_catatan: { teks: 'setuju dengan catatan', warna: 'menunggu-ttd' },
  tolak: { teks: 'menolak', warna: 'ditolak' },
};


/**
 * Penambat balasan (catatan/20).
 *
 * SATU-SATUNYA hal di berkas ini yang wajib stabil selamanya: mengubah bentuk kunci
 * memutus SEMUA balasan dari induknya sekaligus, tanpa cara memulihkannya.
 *
 * Kaidahnya satu — setiap kunci selain komentar diakhiri waktu peristiwanya sendiri.
 * Tanda tangan yang dihapus lalu dibubuhkan lagi oleh pihak yang sama memakai kunci
 * BERBEDA, jadi percakapan tentang tanda tangan yang dibatalkan tidak muncul di bawah
 * penggantinya. Komentar tidak butuh waktu: uuid-nya unik dan permanen, karena komentar
 * dihapus dengan ditandai, tidak pernah dibuang.
 */
export const kunciPeristiwa = {
  komentar: (id: string) => `komentar:${id}`,
  riwayat: (id: number | string) => `riwayat:${id}`,
  ttd: (pihak: string, waktu: string) => `ttd:${pihak}:${waktu}`,
  verifikasi: (fungsi: string, waktu: string) => `verifikasi:${fungsi}:${waktu}`,
  surat: (bagian: 'dibuat' | 'final', waktu: string) => `surat:${bagian}:${waktu}`,
  pks: (bagian: 'dibuat' | 'final' | 'unggah', waktu: string) => `pks:${bagian}:${waktu}`,
  ekstraksi: (waktu: string) => `ekstraksi:${waktu}`,
};

export type SumberLiniMasa = {
  riwayat?: { id: number | string; status_lama: string | null; status_baru: string;
              versi: number; oleh: string | null; pada: string }[];
  ttd?: { pihak: string; nama: string; dibubuhkan_oleh: string | null; waktu: string }[];
  /** po.skema_ttd; tanpa = 3, jadi Sales Manager tetap berlabel Sales Manager (catatan/23). */
  skema?: number | null;
  verifikasi?: { fungsi: string; hasil: string; catatan: string | null; oleh: string | null;
                 waktu: string; berlaku: boolean; sebab_basi: string | null }[];
  surat?: { nama_penanda: string | null; ditandatangani_oleh: string | null;
            dibuat_pada: string | null; final_pada: string | null;
            /** Surat terbit otomatis oleh basis data; tidak ada penanda tangan. */
            otomatis?: boolean | null } | null;
  pks?: { dibuat_oleh: string | null; dibuat_pada: string | null; final_pada: string | null;
          diunggah_oleh: string | null; diunggah_pada: string | null;
          ditandatangani_pada: string | null } | null;
  komentar?: KomentarTersimpan[];
  /** `po.versi` sekarang — pembanding untuk menandai komentar yang sudah basi. */
  versiPo?: number;
  /**
   * `po.diverifikasi_otomatis`: PO ini ditutup basis data, bukan oleh orang. Dipakai untuk
   * menyembunyikan nama penghubung pada peristiwa yang sebenarnya dikerjakan mesin.
   */
  otomatis?: boolean | null;
  /** `po.dibaca_ai_pada`: isian awal PO ini dibaca AI dari pindaian (catatan/17). */
  dibacaAiPada?: string | null;
};

export function liniMasa(s: SumberLiniMasa): Peristiwa[] {
  const p: Peristiwa[] = [];

  for (const r of s.riwayat ?? []) {
    // Status yang tidak berpindah tapi versinya naik berarti PO direvisi selagi
    // masih draf. Itu penjelasan kenapa persetujuan sebuah fungsi bisa tiba-tiba
    // basi, jadi tidak boleh tampil sebagai perpindahan status biasa.
    const revisi = r.status_lama !== null && r.status_lama === r.status_baru;
    // Penutupan otomatis dikerjakan basis data DI DALAM transaksi pengajuan Sales, jadi
    // baris riwayatnya tercatat atas nama Sales itu (trigger `po_catat` memakai
    // `auth.jwt()`). Menampilkannya apa adanya membuat lini masa menyatakan ada orang yang
    // memutuskan, padahal tidak ada. Yang disembunyikan nama penghubungnya, bukan barisnya:
    // kapan persisnya PO itu ditutup tetap harus terbaca.
    const auto = !!s.otomatis && r.status_baru === 'terverifikasi';
    p.push({
      kunci: kunciPeristiwa.riwayat(r.id),
      balasan: [],
      waktu: r.pada,
      warna: revisi ? 'draf' : (WARNA_STATUS[r.status_baru] ?? 'muted'),
      judul: revisi ? `Direvisi menjadi versi ${r.versi}`
                    : auto ? 'Dinyatakan terverifikasi otomatis oleh sistem'
                    : (LABEL_STATUS[r.status_baru] ?? r.status_baru),
      oleh: auto ? null : r.oleh,
    });
  }

  // Isian awal dari AI adalah peristiwa PO, bukan keputusan sesiapa: yang perlu terbaca adalah
  // KAPAN isiannya datang dari mesin, supaya HoO dan Tech Ops Lead bisa memeriksa acak sesudahnya.
  if (s.dibacaAiPada) {
    // Pelakunya manusia yang MENBUAT PO -- dialah yang menekan "Baca scan", dan lini masa
    // menyebutnya supaya peninjau tahu siapa yang bisa ditanya. Diambil dari baris riwayat
    // TERAWAL menurut WAKTUNYA, bukan `riwayat[0]`: pemanggil yang berbeda mengurutkan lariknya
    // berbeda (ada yang menaik, ada yang menurun), dan `[0]` pada yang menurun adalah orang
    // terakhir yang menyentuh PO. Tanpa riwayat sama sekali, pelakunya tidak dikarang.
    const pembuat = (s.riwayat ?? []).reduce<{ pada: string; oleh: string | null } | null>(
      (a, r) => (!a || +new Date(r.pada) < +new Date(a.pada) ? { pada: r.pada, oleh: r.oleh } : a),
      null);
    p.push({
      kunci: kunciPeristiwa.ekstraksi(s.dibacaAiPada),
      balasan: [],
      waktu: s.dibacaAiPada, warna: 'draf',
      judul: 'Isian awal dibaca AI',
      rincian: 'Diperiksa dan dikonfirmasi Sales terhadap pindaiannya',
      oleh: pembuat?.oleh ?? null,
    });
  }

  for (const t of s.ttd ?? []) {
    p.push({
      kunci: kunciPeristiwa.ttd(t.pihak, t.waktu),
      balasan: [],
      waktu: t.waktu, warna: 'ditandatangani',
      judul: `${labelPihak(t.pihak as Pihak, skemaDari(s.skema))} menandatangani`,
      rincian: t.nama, oleh: t.dibubuhkan_oleh,
    });
  }

  for (const v of s.verifikasi ?? []) {
    const h = HASIL[v.hasil] ?? { teks: v.hasil, warna: 'muted' };
    const fungsi = LABEL_FUNGSI[v.fungsi as Fungsi] ?? v.fungsi;
    p.push({
      kunci: kunciPeristiwa.verifikasi(v.fungsi, v.waktu),
      balasan: [],
      waktu: v.waktu,
      warna: v.berlaku ? h.warna : 'muted',
      judul: `${fungsi} ${h.teks}`,
      rincian: [v.catatan, v.berlaku ? null : `Tidak berlaku lagi (${v.sebab_basi ?? 'digantikan'})`]
        .filter(Boolean).join(' · ') || undefined,
      oleh: v.oleh,
    });
  }

  // Surat yang terbit otomatis tidak ditandatangani dan tidak difinalisasi siapa pun; label
  // "ditandatangani"/"difinalisasi" akan menyatakan perbuatan manusia yang tidak terjadi.
  const suratAuto = !!s.surat?.otomatis;
  if (s.surat?.dibuat_pada) {
    p.push({
      kunci: kunciPeristiwa.surat('dibuat', s.surat.dibuat_pada),
      balasan: [],
      waktu: s.surat.dibuat_pada, warna: 'terverifikasi',
      judul: suratAuto ? 'Surat Verifikasi Kesiapan terbit otomatis'
                       : 'Surat Verifikasi Kesiapan ditandatangani',
      rincian: suratAuto ? 'Dikonfirmasi sistem menurut ketentuan IoM'
                         : (s.surat.nama_penanda ?? undefined),
      oleh: suratAuto ? null : s.surat.ditandatangani_oleh,
    });
  }
  if (s.surat?.final_pada) {
    p.push({
      kunci: kunciPeristiwa.surat('final', s.surat.final_pada),
      balasan: [],
      waktu: s.surat.final_pada, warna: 'terverifikasi',
      judul: suratAuto ? 'Surat terkunci otomatis: gerbang PKS terbuka'
                       : 'Surat difinalisasi: gerbang PKS terbuka',
      oleh: suratAuto ? null : s.surat.ditandatangani_oleh,
    });
  }

  if (s.pks?.dibuat_pada) {
    p.push({
      kunci: kunciPeristiwa.pks('dibuat', s.pks.dibuat_pada),
      balasan: [],
      waktu: s.pks.dibuat_pada, warna: 'pks-terbit',
      judul: 'Draf PKS disusun', oleh: s.pks.dibuat_oleh,
    });
  }
  if (s.pks?.final_pada) {
    p.push({
      kunci: kunciPeristiwa.pks('final', s.pks.final_pada),
      balasan: [],
      waktu: s.pks.final_pada, warna: 'pks-terbit',
      judul: 'PKS difinalisasi', oleh: s.pks.dibuat_oleh,
    });
  }
  if (s.pks?.diunggah_pada) {
    p.push({
      kunci: kunciPeristiwa.pks('unggah', s.pks.diunggah_pada),
      balasan: [],
      waktu: s.pks.diunggah_pada, warna: 'pks-ditandatangani',
      judul: 'Pindaian PKS bermeterai diunggah',
      rincian: s.pks.ditandatangani_pada
        ? `Ditandatangani ${tglID(s.pks.ditandatangani_pada)}` : undefined,
      oleh: s.pks.diunggah_oleh,
    });
  }

  // Komentar tidak diberi garis pemisah keputusan tersendiri: ia tersusun di garis
  // yang sama dengan keputusan verifikasi, jadi yang ditulis sesudah sebuah keputusan
  // otomatis tampil sesudahnya. Keputusan #6 di catatan/09 selesai tanpa kode.
  for (const k of s.komentar ?? []) {
    p.push({
      kunci: kunciPeristiwa.komentar(k.id),
      balasan: [],
      waktu: k.waktu, warna: 'komentar', judul: 'Komentar', oleh: k.oleh,
      komentar: {
        id: k.id,
        isi: k.dihapus_pada ? null : k.isi,
        basi: s.versiPo !== undefined && k.versi_po < s.versiPo,
        disunting: k.disunting_pada,
        dihapus: k.dihapus_pada ? { oleh: k.dihapus_oleh, pada: k.dihapus_pada } : null,
        // Versi lama ikut tidak ditampilkan setelah komentarnya dihapus — kalau tidak,
        // menghapus cuma menyembunyikan versi terakhir dan memajang sisanya. Ini soal
        // TAMPILAN saja: isinya tetap tersimpan dan terbaca lewat basis data, memang
        // begitu keputusannya (catatan/09).
        revisi: k.dihapus_pada ? [] : [...(k.po_komentar_revisi ?? [])]
          .sort((a, b) => +new Date(b.digantikan_pada) - +new Date(a.digantikan_pada)),
      },
    });
  }

  // Penyusunan pohon. Induk dicari lewat kunci, bukan rujukan objek: penambatnya memang
  // string, dan peristiwa yang ditunjuk bisa saja tidak ada lagi.
  const indeks = new Map<string, Peristiwa>();
  for (const e of p) indeks.set(e.kunci, e);

  const indukDari = new Map<string, string | null>();
  for (const k of s.komentar ?? []) {
    indukDari.set(kunciPeristiwa.komentar(k.id), k.induk_kunci ?? null);
  }

  const atas: Peristiwa[] = [];
  for (const e of p) {
    const induk = indukDari.get(e.kunci) ?? null;
    if (!induk) { atas.push(e); continue; }
    const ind = indeks.get(induk);
    if (ind) { ind.balasan.push(e); continue; }
    // Peristiwa yang dibalas sudah tidak ada — tanda tangan yang dibatalkan, biasanya.
    // Balasannya TIDAK disembunyikan: menghilangkan kalimat yang ditulis orang karena
    // peristiwa LAIN dihapus adalah kehilangan yang lebih mahal daripada satu butir
    // yang tampak ganjil.
    e.yatim = true;
    atas.push(e);
  }

  // Balasan terlama di atas: percakapan dibaca dari awal. Kebalikan dari lini masanya
  // sendiri, dan itu disengaja — lini masa dibaca untuk "apa yang terakhir terjadi".
  // Rekursi aman: kedalaman dipagari 50 di basis data, dan siklus mustahil karena induk
  // hanya bisa ditetapkan saat insert.
  const urutkan = (e: Peristiwa) => {
    e.balasan.sort((a, b) =>
      (+new Date(a.waktu) - +new Date(b.waktu)) || a.kunci.localeCompare(b.kunci));
    e.balasan.forEach(urutkan);
  };
  atas.forEach(urutkan);

  return atas.sort((a, b) =>
    (+new Date(b.waktu) - +new Date(a.waktu)) || a.judul.localeCompare(b.judul));
}
