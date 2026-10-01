/**
 * Mesin aturan IoM (catatan/13a, versi di VERSI_IOM). Murni: tanpa basis data, tanpa
 * tanggal sistem, tanpa nilai pricelist. Pemanggil (Fase 2) membaca fakta PO dan harga
 * acuan dari basis data lalu mengopernya; tabel harga_komponen/harga_paket memang tidak
 * pernah memuat Acquisition, jadi modul ini aman dimuat di mana pun.
 *
 * Mesin ini TIDAK menggantikan penjagaan basis data: syarat maju (termin, masa aktif,
 * data sekolah) ditegakkan trigger po_syarat_maju. Di sini aturan yang sama dinilai ulang
 * supaya verdict mencatat buktinya sendiri, ditambah kelas PO (13a Bagian 4 dan 7).
 */
import type { Komponen } from './pricelist';
import { ID_GURU } from './aturan-komponen';
import { rp } from './format';
import { langgarMinimum, langgarKapasitas } from './hitung';

/** Sama dengan private.versi_iom_berlaku() di basis data; dijaga uji/syarat-maju.test.mjs. */
export const VERSI_IOM = 'iom-2026-09-22';

/** Langit-langit jumlah kelompok; sama dengan check nomor 1..6 di po_kelompok. */
export const BATAS_KEDALAMAN_KELOMPOK = 6;

/** Butir penilaian yang wajib dideklarasikan per paket (13a Bagian 3). */
export const BUTIR_DEKLARASI = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c2', 'd3', 'e3', 'e4'] as const;

type Teks = string | null | undefined;

export type FaktaPo = {
  /** Stempel saat PO dibuat; null = PO lama, selalu manual. */
  versiIom: string | null;
  asal: 'platform' | 'unggahan';
  /** Dari po.sekolah_beku. */
  sekolah: { nama?: Teks; npsn?: Teks; kepala_sekolah?: Teks; kepsek_hp?: Teks; bendahara?: Teks; bendahara_hp?: Teks };
  komponen: { id: string; sesi: number }[];
  /** Jumlah baris po_kelompok; 2 atau lebih = PO berkelompok. */
  jumlahKelompok: number;
  /** Baris po_kelompok berikut komponennya; wajib ada untuk PO berkelompok. */
  kelompok?: { nomor: number; hargaSiswa: number; komponen: { id: string }[] }[];
  jumlahSiswa: number; jumlahGuru: number;
  hargaSiswa: number; hargaGuru: number; grandTotal: number;
  masaMulai: string | null; masaSelesai: string | null;
  termin: { nominal: number }[];
  berkasUnggahan: string | null; ditinjauPada: string | null;
  adaPengecualianHoo: boolean;
  /** Ada po_catatan jenis 'sponsorship' yang berisi. */
  catatanSponsorship: boolean;
  /** po.nilai_sponsorship dalam Rupiah utuh; null berarti belum diisi. */
  nilaiSponsorship: number | null;
  permintaanTambahan: boolean;
};

export type HargaKomponen = { id: string; grup: string; untukGuru: boolean; perSesi: boolean; priceList: number; bottom: number };
export type HargaPaket = { nama: string; ids: string[]; priceList: number; bottom: number };
export type Deklarasi = { produk: string; butir: string[]; berlakuSampai: string };
export type HasilAturan = { kode: string; lolos: boolean; bukti: string };
export type Verdict = {
  versiIom: string; lolos: boolean; paket: string | null; gagal: string[]; hasil: HasilAturan[];
  /** Nama paket yang dipakai: satu untuk PO satu kelompok, satu per kelompok bila berkelompok. */
  paketDipakai: string[];
};

const kosong = (s: Teks) => !s?.trim();
const himpunanSama = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',');
const ISIAN_SEKOLAH = ['npsn', 'kepala_sekolah', 'kepsek_hp', 'bendahara', 'bendahara_hp'] as const;

/** hariIni: 'YYYY-MM-DD' dari pemanggil, supaya fungsi ini tetap murni dan bisa diuji. */
export function nilai(
  f: FaktaPo, komponen: HargaKomponen[], paket: HargaPaket[], deklarasi: Deklarasi[], hariIni: string,
): Verdict {
  const hasil: HasilAturan[] = [];
  const cek = (kode: string, lolos: boolean, bukti: string) => { hasil.push({ kode, lolos, bukti }); };

  // ---- Bagian 1 dan 2 (syarat maju dan kelengkapan) ----
  cek('po-berstempel-iom', f.versiIom !== null,
    f.versiIom ? `dibuat di bawah ${f.versiIom}` : 'PO dibuat sebelum IoM berlaku');
  cek('sekolah-terisi', !kosong(f.sekolah.nama), f.sekolah.nama?.trim() || 'nama sekolah kosong');

  const dikenal = new Set(komponen.map((k) => k.id));
  const asing = f.komponen.filter((k) => !dikenal.has(k.id)).map((k) => k.id);
  cek('komponen-dikenal', f.komponen.length > 0 && asing.length === 0,
    asing.length ? `tidak dikenal: ${asing.join(', ')}` : f.komponen.length ? 'semua dikenal' : 'tanpa komponen');
  cek('jumlah-siswa-minimal', f.jumlahSiswa >= 1, `${f.jumlahSiswa} siswa`);

  // hitung.ts butuh bentuk Komponen; `p` hanya dua tier, Acquisition memang tidak ada.
  const daftar = komponen.map((k): Komponen => ({
    id: k.id, s: k.id, n: k.id, g: k.grup === 'addon' ? 'addon' : 'core', p: [k.priceList, k.bottom] }));
  const minimal = langgarMinimum(f.komponen, f.jumlahSiswa, f.jumlahGuru, daftar);
  cek('minimal-peserta', minimal.length === 0, minimal.map((p) => p.pesan).join(' ') || 'terpenuhi');
  const kapasitas = langgarKapasitas(f.komponen, f.jumlahSiswa, f.jumlahGuru, daftar);
  cek('kapasitas-sesi', kapasitas.length === 0, kapasitas.map((p) => p.pesan).join(' ') || 'terpenuhi');

  const totalTermin = f.termin.reduce((a, t) => a + (t.nominal || 0), 0);
  cek('termin-sama-total', f.termin.length > 0 && totalTermin === f.grandTotal,
    f.termin.length ? `total termin ${totalTermin}, grand total ${f.grandTotal}` : 'tanpa termin');
  if (f.asal === 'unggahan')
    cek('unggahan-ditinjau', !!f.berkasUnggahan && !!f.ditinjauPada,
      !f.berkasUnggahan ? 'pindaian belum ada' : f.ditinjauPada ? `ditinjau ${f.ditinjauPada}` : 'belum ada pernyataan sesuai pindaian');

  cek('masa-aktif-lengkap', !!f.masaMulai && !!f.masaSelesai, `${f.masaMulai ?? '-'} s.d. ${f.masaSelesai ?? '-'}`);
  cek('masa-aktif-wajar', !!f.masaMulai && !!f.masaSelesai && f.masaSelesai > f.masaMulai,
    `${f.masaMulai ?? '-'} s.d. ${f.masaSelesai ?? '-'}`);
  const kurang = ISIAN_SEKOLAH.filter((k) => kosong(f.sekolah[k]));
  cek('sekolah-lengkap', kurang.length === 0, kurang.length ? `kosong: ${kurang.join(', ')}` : 'lengkap');

  // ---- Bagian 4 dan 7 (kelas PO yang boleh otomatis) ----
  // PO berkelompok DIBOLEHKAN lolos otomatis (keputusan Rizki 22 Sep 2026, catatan/13a
  // Bagian 9), asalkan tiap kelompok dinilai jujur: komponennya persis satu paket, ada
  // deklarasi yang berlaku untuk paket itu, dan harganya tidak di bawah bottom price
  // paketnya. Sebelumnya aturan `satu-kelompok` menutup jalan ini; `kelompok-terdefinisi`
  // menggantikannya sebagai penjaga himpunan kelompok yang lengkap dan terbaca.
  const berkelompok = f.jumlahKelompok >= 2;
  const kelompok = f.kelompok ?? [];
  cek('kelompok-terdefinisi',
    berkelompok
      ? kelompok.length === f.jumlahKelompok && kelompok.length >= 2 && kelompok.length <= BATAS_KEDALAMAN_KELOMPOK
      : f.jumlahKelompok < 2,
    berkelompok
      ? `${f.jumlahKelompok} baris kelompok, ${kelompok.length} terbaca`
      : `${f.jumlahKelompok} baris kelompok`);

  // Satu penilaian per kelompok. PO satu kelompok dinilai sebagai satu kelompok dari
  // f.hargaSiswa/f.komponen, persis seperti sebelum aturan kelompok ada.
  const dinilai = berkelompok
    ? kelompok.map((k) => ({ nomor: k.nomor, hargaSiswa: k.hargaSiswa, komponen: k.komponen }))
    : [{ nomor: 1, hargaSiswa: f.hargaSiswa, komponen: f.komponen }];
  const perPaket = dinilai.map((k) => ({
    k, p: paket.find((x) => himpunanSama(x.ids, k.komponen.map((c) => c.id))) ?? null }));
  const semuaPaket = perPaket.length > 0 && perPaket.every((x) => x.p);

  // Paketnya boleh BERBEDA antar kelompok (LMS Juara + LMS Smart); itu justru gunanya.
  const buktiPaket = perPaket.length
    ? perPaket.map((x) => (x.p ? x.p.nama : 'bukan paket persis')).join(' + ')
    : 'tanpa komponen';
  cek('paket-persis', semuaPaket, buktiPaket);
  // e1 (Bagian 7 butir 1): layanan sesuai PO bila susunannya persis paket yang dideklarasikan.
  cek('layanan-sesuai-paket', semuaPaket, buktiPaket);

  // Deklarasi WAJIB ada dan berlaku untuk SETIAP paket yang dipakai.
  const dekKurang: string[] = [];
  for (const x of perPaket) {
    if (!x.p) continue; // sudah dilaporkan `paket-persis`
    const dx = deklarasi.find((y) => y.produk === x.p!.nama);
    const butirKurang = BUTIR_DEKLARASI.filter((b) => !dx?.butir.includes(b));
    if (!dx) dekKurang.push(`tidak ada deklarasi ${x.p.nama}`);
    else if (dx.berlakuSampai < hariIni) dekKurang.push(`kedaluwarsa ${x.p.nama} ${dx.berlakuSampai}`);
    else if (butirKurang.length) dekKurang.push(`${x.p.nama} kurang butir ${butirKurang.join(', ')}`);
  }
  cek('deklarasi-berlaku', semuaPaket && dekKurang.length === 0,
    dekKurang.length ? dekKurang.join('; ')
      // Paket yang sama dipakai dua kelompok disebut SEKALI: yang diperiksa deklarasinya
      // adalah paketnya, bukan kelompoknya.
      : [...new Set(perPaket.map((x) => x.p?.nama).filter((n): n is string => !!n))].map((n) => {
          const dx = deklarasi.find((y) => y.produk === n);
          return dx ? `berlaku sampai ${dx.berlakuSampai}` : '-';
        }).join(' + '));

  // Harga dinilai PER KELOMPOK, tidak lagi dari `po.harga_siswa` yang bernilai 0 untuk PO
  // berkelompok (temuan PO-344, 21 Sep 2026).
  const hargaBukti = (batas: (p: HargaPaket) => number, nama: string) =>
    perPaket.map((x) => (x.p
      ? (berkelompok ? `kelompok ${x.k.nomor} (${x.p.nama}) ${x.k.hargaSiswa} vs ${nama} ${batas(x.p)}`
                     : `${x.k.hargaSiswa} vs ${nama} ${batas(x.p)}`)
      : 'tidak dinilai: bukan paket persis')).join(' · ');
  cek('lantai-siswa', perPaket.every((x) => x.p && x.k.hargaSiswa >= x.p.bottom),
    hargaBukti((p) => p.bottom, 'bottom'));
  // Pelatihan guru selalu membuat susunan bukan paket persis, jadi jalur otomatis tidak punya harga guru.
  const adaGuru = f.komponen.some((k) => ID_GURU.includes(k.id));
  cek('lantai-guru', !adaGuru, adaGuru ? 'ada pelatihan guru: dinilai manual' : 'tanpa pelatihan guru');
  // Diskon per kelompok DIIZINKAN sebatas bottom price (keputusan Rizki 22 Sep 2026):
  // po_kelompok memang cara resmi memberi harga berbeda per kelompok, jadi menuntut price
  // list penuh akan menutup jalur otomatis untuk PO berkelompok yang sehat. PO satu kelompok
  // tetap wajib tanpa diskon seperti sebelumnya.
  cek('tanpa-diskon',
    berkelompok ? true : perPaket.every((x) => x.p && x.k.hargaSiswa >= x.p.priceList),
    berkelompok
      ? 'PO berkelompok: diskon per kelompok diizinkan sebatas bottom price · ' + hargaBukti((p) => p.priceList, 'price list')
      : hargaBukti((p) => p.priceList, 'price list'));

  const paketDipakai = [...new Set(perPaket.filter((x) => x.p).map((x) => x.p!.nama))].sort();
  const paketTunggal = paketDipakai.length === 1 ? paketDipakai[0] : null;
  cek('tanpa-pengecualian-hoo', !f.adaPengecualianHoo, f.adaPengecualianHoo ? 'ada pengecualian HoO' : 'tidak ada');
  // Sponsorship mengambil 15% dari pendapatan (catatan/18). Yang dinilai batasnya, bukan
  // ada-tidaknya: dalam batas boleh lolos otomatis, di atas batas jatuh ke verifikasi manual.
  // Rumusnya bilangan bulat — `nilai * 100 <= grandTotal * 15` — supaya pembulatan tidak
  // pernah ikut menentukan hasil, dan sama persis dengan private.nilai_iom.
  const nilaiSp = f.nilaiSponsorship ?? 0;
  const adaNilaiSp = nilaiSp > 0;
  const batasSp = Math.floor((f.grandTotal * 15) / 100);
  const persenSp = f.grandTotal > 0
    ? `${((nilaiSp / f.grandTotal) * 100).toFixed(1).replace('.', ',')}%`
    : '—';
  cek('sponsorship-dalam-batas',
    !f.catatanSponsorship && !adaNilaiSp
      ? true
      : f.catatanSponsorship === adaNilaiSp && nilaiSp * 100 <= f.grandTotal * 15,
    !f.catatanSponsorship && !adaNilaiSp ? 'tidak ada'
      : f.catatanSponsorship !== adaNilaiSp ? 'catatan dan nilai sponsorship tidak berpasangan'
      : `${rp(nilaiSp)} = ${persenSp} dari ${rp(f.grandTotal)}, batas ${rp(batasSp)}`);
  cek('tanpa-permintaan-tambahan', !f.permintaanTambahan, f.permintaanTambahan ? 'Sales mencentang permintaan tambahan' : 'tidak ada');

  const gagal = hasil.filter((h) => !h.lolos).map((h) => h.kode);
  return { versiIom: VERSI_IOM, lolos: gagal.length === 0, paket: paketTunggal, gagal, hasil, paketDipakai };
}

/** Galat apa pun berarti tidak lolos: salah lolos jauh lebih mahal daripada salah manual. */
export function nilaiAman(...args: Parameters<typeof nilai>): Verdict {
  try {
    return nilai(...args);
  } catch (e) {
    return { versiIom: VERSI_IOM, lolos: false, paket: null, paketDipakai: [], gagal: ['galat-evaluasi'],
      hasil: [{ kode: 'galat-evaluasi', lolos: false, bukti: String(e) }] };
  }
}
