import { KOMPONEN, PRESET } from './pricelist';
import { ID_GURU } from './aturan-komponen';
import { paketDari } from './hitung';
import { LABEL_FUNGSI, URUT_FUNGSI, isianBerubah, type Fungsi } from './checklist';
import { gabung, type DataSurat } from './dokumen-surat';
import type { DataPks } from './dokumen-pks';
import type { DataDokumen, KelompokDokumen } from './dokumen-po';
import { KELAS } from './kelas';
import { skemaDari } from './pihak';

/**
 * Data sekolah untuk dokumen: SELALU dari salinan beku bila ada.
 *
 * Baris `sekolah` dipakai bersama seluruh sales dan disatukan lewat NPSN, jadi
 * membacanya hidup berarti PKS yang sudah ditandatangani basah bisa mencetak
 * nama berbeda begitu sales lain membetulkan ejaan sekolah itu. Salinan bekunya
 * diisi trigger po_bekukan_sekolah dan ikut terkunci oleh po_bekukan_isi.
 *
 * Baris hidupnya hanya jadi cadangan: PO yang masih draf memang menyegarkan
 * salinannya tiap kali disimpan, dan sisanya kembali ke perilaku lama alih-alih
 * mencetak kosong.
 */
export const sekolahDokumen = (
  po: { sekolah_beku?: Sekolah | null; sekolah?: Sekolah | null },
): Sekolah => po.sekolah_beku ?? po.sekolah ?? { jenjang: 'SMA' };

/**
 * Boleh menulis baris sekolah ini? Cermin WITH CHECK kebijakan `sekolah_ubah`: pemegangnya
 * sendiri, atau Head of Sales/Admin Sales (Super Admin lolos semua peran lewat
 * punya_peran). BUKAN "terlihat": peran seperti Finance melihat semua sekolah tapi tetap
 * tidak boleh mengubah milik sales lain — terbukti QA, pemegang {finance, sales} gagal 42501.
 */
export const bolehUbahSekolah = (
  pemegang: string | null | undefined, p: { email: string; peran: readonly string[] },
): boolean =>
  (!!pemegang && pemegang.toLowerCase() === p.email.toLowerCase())
  || p.peran.some((r) => r === 'head_of_sales' || r === 'admin_sales' || r === 'admin_utama');

/**
 * Data sekolah untuk formulir sunting PO, dan apakah isiannya harus dikunci.
 *
 * Sales hanya melihat sekolah yang dipegangnya (RLS sekolah_lihat). Begitu sekolah itu
 * dialihkan ke sales lain, sematan `sekolah(*)` di PO miliknya kembali null — dulu
 * formulirnya lalu tampil kosong dan menyimpannya membuat sekolah duplikat. Isiannya
 * diambil dari salinan beku PO itu sendiri, dengan id sekolah yang sama, dan dikunci.
 * Yang terlihat tapi tidak boleh ditulis ikut dikunci, dengan isian dari baris hidupnya
 * — itulah yang akan tercetak, karena trigger menyegarkan salinannya dari sana.
 */
export const sekolahUntukSunting = (po: {
  sekolah_id: string; sekolah?: Sekolah | null; sekolah_beku?: Sekolah | null;
}, p: { email: string; peran: readonly string[] }): { sekolah: Sekolah & { id: string; nama: string }; terkunci: boolean } =>
  po.sekolah
    ? { sekolah: { nama: '', ...po.sekolah, id: po.sekolah_id }, terkunci: !bolehUbahSekolah(po.sekolah.dipegang_oleh, p) }
    : { sekolah: { nama: '', ...(po.sekolah_beku ?? { jenjang: 'SMA' }), id: po.sekolah_id }, terkunci: true };

/** Isian sekolah kiriman formulir yang berbeda dari salinan beku PO. */
export const sekolahDiubah = (kirim: Record<string, unknown>, beku: unknown): string[] =>
  Object.entries(kirim)
    .filter(([k, v]) => isianBerubah(((beku ?? {}) as Record<string, unknown>)[k], v))
    .map(([k]) => k);
const huruf = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

export type Sekolah = DataDokumen['sekolah'] & { alamat?: string; telepon?: string; dipegang_oleh?: string | null };

type BarisPo = {
  jumlah_siswa: number; jumlah_guru: number; harga_siswa: number; harga_guru: number;
  masa_mulai: string | null; masa_selesai: string | null;
  sumber_dana: string | null; sumber_dana_lain: string | null;
  kota: string | null; tanggal_ttd: string | null; jumlah_rombel: number;
  nama_pm: string | null; nama_sm: string | null;
  /** Tak ada pada data lama dan fikstur lama; tidak ada = skema 3. */
  skema_ttd?: number | null;
  nama_rh?: string | null;
  nilai_sponsorship?: number | null;
  sekolah: Sekolah | null;
  /** Salinan data sekolah yang dibekukan saat PO keluar dari draf. */
  sekolah_beku?: Sekolah | null;
  po_komponen?: { komponen_id: string; sesi: number; kelompok?: number }[];
  po_rombel?: { kelas: number; rombel: string; jumlah_siswa: number; kelompok?: number }[];
  /** Dua baris atau lebih = PO berkelompok. Nol baris = satu kelompok (jalur lama). */
  po_kelompok?: { nomor: number; nama: string | null; harga_siswa: number }[];
  po_termin?: { urutan: number; tanggal: string | null; nominal: number }[];
  po_catatan?: { jenis: string; isi: string }[];
};

const namaKomponen = (id: string, sesi: number) => {
  const k = KOMPONEN.find((x) => x.id === id);
  if (!k) return id;
  return k.n + (k.sesi && sesi > 1 ? ` ×${sesi} sesi` : '');
};

type KelompokPo = KelompokDokumen & { kelas: number[]; ids: string[] };

/**
 * Kelompok PO untuk dokumen, urut nomor — hanya bila PO berkelompok (dua baris atau lebih
 * di po_kelompok). Selain itu `null`, dan setiap pembangun dokumen menempuh jalur lamanya
 * persis seperti sebelum kelompok ada.
 *
 * Jumlah siswanya dihitung dari rombel, sama dengan cara trigger jaga_lantai_po
 * memeriksanya — bukan dari angka yang disimpan terpisah. Komponen guru tidak masuk
 * kelompok mana pun: Pelatihan Guru di tingkat PO.
 */
export function kelompokPo(po: Pick<BarisPo, 'po_kelompok' | 'po_komponen' | 'po_rombel'>): KelompokPo[] | null {
  const baris = po.po_kelompok ?? [];
  if (baris.length < 2) return null;
  return [...baris].sort((a, b) => a.nomor - b.nomor).map((k) => {
    const rombel = (po.po_rombel ?? []).filter((r) => (r.kelompok ?? 1) === k.nomor && r.jumlah_siswa > 0);
    const kelas = [...new Set(rombel.map((r) => r.kelas))].sort((a, b) => a - b);
    const komp = (po.po_komponen ?? []).filter((x) => (x.kelompok ?? 1) === k.nomor && !ID_GURU.includes(x.komponen_id));
    return {
      nama: k.nama?.trim() || `Kelas ${kelas.join(', ')}`,
      siswa: rombel.reduce((a, r) => a + r.jumlah_siswa, 0),
      harga: k.harga_siswa,
      rincian: komp.map((x) => namaKomponen(x.komponen_id, x.sesi)),
      kelas,
      ids: komp.map((x) => x.komponen_id),
    };
  });
}

/** Menyusun data dokumen dari satu baris PO beserta tabel anaknya. */
export function dataDokumenDariPo(
  po: BarisPo,
  ttd?: DataDokumen['ttd']
): DataDokumen {
  const nama = (id: string, sesi: number) => {
    const k = KOMPONEN.find((x) => x.id === id);
    if (!k) return id;
    return k.n + (k.sesi && sesi > 1 ? ` ×${sesi} sesi` : '');
  };
  const komponen = po.po_komponen ?? [];
  const sekolah = sekolahDokumen(po);
  const jenjang = sekolah.jenjang ?? 'SMA';

  return {
    sekolah,
    rincianSiswa: komponen.filter((k) => !ID_GURU.includes(k.komponen_id)).map((k) => nama(k.komponen_id, k.sesi)),
    rincianGuru: komponen.filter((k) => ID_GURU.includes(k.komponen_id)).map((k) => nama(k.komponen_id, k.sesi)),
    jumlahSiswa: po.jumlah_siswa,
    jumlahGuru: po.jumlah_guru,
    hargaSiswa: po.harga_siswa,
    hargaGuru: po.harga_guru,
    masaMulai: po.masa_mulai ?? undefined,
    masaSelesai: po.masa_selesai ?? undefined,
    sumberDana: po.sumber_dana ?? undefined,
    sumberDanaLain: po.sumber_dana_lain ?? undefined,
    kota: po.kota ?? undefined,
    tanggalTtd: po.tanggal_ttd ?? undefined,
    kelas: KELAS[jenjang],
    kolomRombel: huruf(po.jumlah_rombel || 8),
    rombel: Object.fromEntries((po.po_rombel ?? []).map((r) => [`${r.kelas}-${r.rombel}`, r.jumlah_siswa])),
    termin: (po.po_termin ?? []).slice().sort((a, b) => a.urutan - b.urutan)
      .map((t) => ({ urutan: t.urutan, tanggal: t.tanggal ?? undefined, nominal: t.nominal })),
    catatan: {
      pelaksanaan: (po.po_catatan ?? []).find((c) => c.jenis === 'pelaksanaan')?.isi,
      sponsorship: (po.po_catatan ?? []).find((c) => c.jenis === 'sponsorship')?.isi,
    },
    nilaiSponsorship: po.nilai_sponsorship ?? undefined,
    namaPm: po.nama_pm ?? undefined,
    namaSm: po.nama_sm ?? undefined,
    // Kunci ini hanya ADA untuk PO empat penanda tangan, pola yang sama dengan `kelompok`
    // di bawah: objek data PO lama tetap sama dengan kemarin.
    ...(skemaDari(po.skema_ttd) === 4 ? { skemaTtd: 4 as const, namaRh: po.nama_rh ?? undefined } : {}),
    ttd,
    // Kunci ini hanya ADA untuk PO berkelompok. Menambahkan `kelompok: undefined` pada PO
    // lama tidak mengubah HTML-nya, tapi objeknya tidak lagi sama dengan kemarin.
    ...(kelompokPo(po) ? { kelompok: kelompokPo(po)!.map(({ nama, siswa, harga, rincian }) => ({ nama, siswa, harga, rincian })) } : {}),
  };
}

/**
 * Menyusun data Surat Verifikasi Kesiapan dari satu PO yang sudah terverifikasi.
 *
 * Catatannya tidak diketik ulang: hanya keputusan "setuju dengan catatan" yang
 * masih berlaku yang ikut. Penolakan yang sudah diperbaiki tinggal di riwayat.
 */
export function dataSuratDariPo(
  po: BarisPo & {
    masa_mulai: string | null; masa_selesai: string | null;
    diverifikasi_pada?: string | null;
    /** Ditutup jalur IoM otomatis; suratnya memakai varian yang menyatakan sistem. */
    diverifikasi_otomatis?: boolean | null;
  },
  keputusan: { fungsi: Fungsi; hasil: string; catatan: string | null; berlaku: boolean }[],
  penandaTangan: string,
  ttdUrl?: string,
  /** Versi IoM yang menutup PO ini, dari baris verdict — sumber paling jujur yang ada. */
  versiIom?: string,
): DataSurat {
  const komponen = po.po_komponen ?? [];
  const jenjang = sekolahDokumen(po).jenjang ?? 'SMA';
  const nama = (id: string, sesi: number) => {
    const k = KOMPONEN.find((x) => x.id === id);
    if (!k) return id;
    return k.n + (k.sesi && sesi > 1 ? ` ×${sesi} sesi` : '');
  };

  const berlaku = keputusan.filter((k) => k.berlaku);
  // Aturan yang sama dengan penentu harga — kalau berbeda, PO berharga paket bisa
  // tercetak sebagai "Paket Custom" di dokumen yang ditandatangani sekolah.
  const paket = paketDari(komponen.map((k) => ({ id: k.komponen_id, sesi: k.sesi })), KOMPONEN, PRESET);

  // Kelas yang benar-benar terisi, bukan seluruh jenjang.
  const kelas = [...new Set((po.po_rombel ?? []).filter((r) => r.jumlah_siswa > 0).map((r) => r.kelas))]
    .sort((a, b) => a - b);

  const kel = kelompokPo(po);
  // PO berkelompok: paketnya dicocokkan PER KELOMPOK dengan aturan yang sama dengan
  // penentu harga — satu nama paket untuk seluruh PO akan menyebut paket yang tidak
  // dipakai sebagian siswanya.
  const keterangan = kel
    ? `Jenjang ${jenjang} dalam ${kel.length} kelompok: `
      + kel.map((k) => {
          const p = paketDari(k.ids.map((id) => ({ id, sesi: 1 })), KOMPONEN, PRESET);
          return `${k.nama}, ${k.siswa} siswa, Paket ${p?.n ?? 'Custom'}`;
        }).join('; ')
      + `, dengan total ${po.jumlah_siswa} siswa`
      + (po.jumlah_guru > 0 ? ` dan ${po.jumlah_guru} guru` : '')
    : `Paket ${paket?.n ?? 'Custom'} jenjang ${jenjang}`
      + (kelas.length ? ` kelas ${gabung(kelas.map(String))}` : '')
      + ` dengan total ${po.jumlah_siswa} siswa`
      + (po.jumlah_guru > 0 ? ` dan ${po.jumlah_guru} guru` : '');

  return {
    namaMitra: sekolahDokumen(po).nama ?? '-',
    masaMulai: po.masa_mulai ?? undefined,
    masaSelesai: po.masa_selesai ?? undefined,
    keterangan,
    layanan: kel ? layananBerkelompok(kel, komponen) : komponen.map((k) => nama(k.komponen_id, k.sesi)),
    catatan: berlaku
      .filter((k) => k.hasil === 'setuju_catatan' && k.catatan)
      .map((k) => ({ fungsi: LABEL_FUNGSI[k.fungsi], isi: k.catatan! })),
    fungsiVerifikator: URUT_FUNGSI.filter((f) => berlaku.some((k) => k.fungsi === f))
      .map((f) => LABEL_FUNGSI[f]),
    kota: po.kota ?? undefined,
    tanggal: po.diverifikasi_pada?.slice(0, 10),
    penandaTangan,
    ttdUrl,
    // Penanda otomatis hanya bermakna bila versinya diketahui: surat yang menyebut
    // "otomatis" tanpa aturan mana yang berlaku tidak bisa diperiksa siapa pun.
    ...(po.diverifikasi_otomatis && versiIom ? { otomatis: { versiIom } } : {}),
  };
}

/**
 * Nama paket untuk PKS. PKS asli memakai "LMS SMART CUSTOM": nama preset yang
 * cocok, ditambah CUSTOM bila ada komponen di luar preset itu.
 */
export function namaPaketPks(ids: string[]): string {
  const punya = new Set(ids);
  // Preset terbesar yang seluruh komponennya ada di pilihan.
  const cocok = PRESET
    .filter((p) => p.ids.every((i) => punya.has(i)))
    .sort((a, b) => b.ids.length - a.ids.length)[0];
  if (!cocok) return 'CUSTOM';
  return cocok.ids.length === punya.size ? cocok.n : `${cocok.n} CUSTOM`;
}

/** Menyusun data PKS dari satu PO beserta ekor nomor perjanjiannya. */
export function dataPksDariPo(
  po: BarisPo & { masa_mulai: string | null; masa_selesai: string | null; grand_total: number },
  nomorEkor: string,
): DataPks {
  const komponen = po.po_komponen ?? [];
  const nama = (id: string, sesi: number) => {
    const k = KOMPONEN.find((x) => x.id === id);
    if (!k) return id;
    return k.n + (k.sesi && sesi > 1 ? ` ×${sesi} sesi` : '');
  };
  return {
    nomorEkor,
    sekolah: sekolahDokumen(po),
    // Nama paket tetap PENDEK (keputusan 9 Sep 2026): ia tertanam empat kali di kalimat
    // hukum PKS. Untuk PO berkelompok dihitung dari gabungan komponennya — paket terbesar
    // yang termuat plus CUSTOM — dan rincian per angkatan masuk ke daftar layanan.
    namaPaket: namaPaketPks([...new Set(komponen.map((k) => k.komponen_id))]),
    layanan: kelompokPo(po) ? layananBerkelompok(kelompokPo(po)!, komponen) : komponen.map((k) => nama(k.komponen_id, k.sesi)),
    masaMulai: po.masa_mulai ?? undefined,
    masaSelesai: po.masa_selesai ?? undefined,
    jumlahSiswa: po.jumlah_siswa,
    jumlahGuru: po.jumlah_guru,
    grandTotal: po.grand_total,
    termin: (po.po_termin ?? []).slice().sort((a, b) => a.urutan - b.urutan)
      .map((t) => ({ urutan: t.urutan, tanggal: t.tanggal ?? undefined, nominal: t.nominal })),
    kelas: [...new Set((po.po_rombel ?? []).filter((r) => r.jumlah_siswa > 0).map((r) => r.kelas))]
      .sort((a, b) => a - b),
  };
}

/** Daftar layanan PO berkelompok: satu butir per kelompok, lalu Pelatihan Guru. */
function layananBerkelompok(kel: KelompokPo[], komponen: { komponen_id: string; sesi: number }[]): string[] {
  return [
    ...kel.map((k) => `${k.nama}, ${k.siswa} siswa: ${k.rincian.join(', ')}`),
    ...komponen.filter((x) => ID_GURU.includes(x.komponen_id)).map((x) => namaKomponen(x.komponen_id, x.sesi)),
  ];
}
