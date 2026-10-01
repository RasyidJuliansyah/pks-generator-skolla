'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import { penggunaSaatIni, bolehBuatPo, bolehLihatAcquisition, adalahLead } from './sesi';
import { simpanBerkas, hapusBerkas, urlBerkas } from './storage';
import { KOMPONEN, VERSI_PRICELIST, komponenUntuk, presetUntuk } from './pricelist';
import {
  BULAN_SIMPAN_TANDA_TANGAN,
  type BerkasJatuhTempo,
  daftarJatuhTempo as retensiDaftarJatuhTempo,
  hapusBerkasJatuhTempo as retensiHapusBerkasJatuhTempo,
} from './retensi';
import { hitung, langgarMinimum, langgarKapasitas, type Pilihan } from './hitung';
import { hitungPerKelompok, type HasilPerKelompok } from './kelompok';
import { ID_GURU } from './aturan-komponen';
import { SEMUA_PIHAK, pihakUntuk, skemaDari, type Pihak } from './pihak';
import { fungsiTerdampak, isianBerubah, tandaDaftar, type Fungsi } from './checklist';
import { bolehUbahSekolah, sekolahDiubah } from './dokumen-dari-po';

export type IsiPo = {
  id?: string;
  /** PO unggahan yang disunting: pindaian baru akan diunggah sesudah simpan ini. */
  pindaianBaru?: boolean;
  sekolah: {
    id?: string;
    nama: string;
    npsn?: string;
    jenjang: 'SD' | 'SMP' | 'SMA';
    alamat?: string;
    telepon?: string;
    email?: string;
    kepala_sekolah?: string;
    kepsek_hp?: string;
    bendahara?: string;
    bendahara_hp?: string;
  };
  /** `kelompok` hanya bermakna untuk PO berkelompok; komponen guru selalu disimpan di 1. */
  komponen: (Pilihan & { kelompok?: number })[];
  jumlahSiswa: number;
  jumlahGuru: number;
  hargaSiswa: number;
  hargaGuru: number;
  masaMulai?: string;
  masaSelesai?: string;
  sumberDana?: string;
  sumberDanaLain?: string;
  kota?: string;
  tanggalTtd?: string;
  namaPm?: string;
  namaSm?: string;
  /** Regional Head Division; hanya bermakna pada PO skema 4 (catatan/23). */
  namaRh?: string;
  /**
   * PO unggahan dari form kertas lama tiga kotak. Hanya dibaca saat PO DIBUAT; basis data
   * (jaga_syarat_maju) mengabaikannya untuk PO platform dan membekukan skemanya sesudah lahir.
   */
  formKertasLama?: true;
  jumlahRombel: number;
  rombel: { kelas: number; rombel: string; jumlah: number; kelompok?: number }[];
  /**
   * PO BERKELOMPOK: dua kelompok atau lebih, masing-masing dengan harganya. Kosong atau
   * satu = PO satu kelompok, jalur lama persis: harga di `hargaSiswa`, semua di kelompok 1.
   * Bentuk ini sama dengan yang ditegakkan trigger jaga_lantai_po (20260912).
   */
  kelompok?: { nomor: number; nama?: string; hargaSiswa: number }[];
  termin: { urutan: number; tanggal?: string; nominal: number }[];
  catatan: { jenis: 'pelaksanaan' | 'sponsorship'; isi: string }[];
  /**
   * 'platform' = diisi lewat aplikasi. 'unggahan' = diisi manual di kertas lalu
   * dipindai. Hanya bermakna saat PO dibuat; sesudah PO meninggalkan draf, kolomnya
   * dibekukan basis data.
   */
  asal?: 'platform' | 'unggahan';
  /** b4: Sales menyatakan ada permintaan di luar paket; PO jadi diverifikasi manual (catatan/13a Bagian 7). */
  permintaanTambahan?: boolean;
  /**
   * Nilai sponsorship dalam Rupiah utuh, satu angka total (catatan/18). Kosong = belum diisi.
   * Batas 15% dinilai aturan IoM, BUKAN ditolak di sini: melewati batas hanya membuat PO
   * diverifikasi manual, bukan gagal disimpan.
   */
  nilaiSponsorship?: number;
  /**
   * Kunci isian dari hasil baca scan yang MASIH menunggu konfirmasi Sales (catatan/17 amandemen 2).
   * Kosong/absen = semua langkah sudah dicocokkan. Penanda kemajuan layar, BUKAN isi dokumen:
   * karena itu ia tidak pernah masuk `private.sidik_tinjauan` dan tidak boleh dihitung sebagai
   * perubahan isi di sini -- centang yang selesai akan membatalkan pernyataan "sesuai pindaian".
   */
  ekstraksiMenunggu?: string[];
};

export type HasilSimpan = { ok: true; id: string } | { ok: false; galat: string[] };

/**
 * Angka yang disimpan ke baris `po` — SATU sumber untuk periksa() dan simpanDraf(), supaya
 * yang diperiksa dan yang ditulis mustahil berbeda.
 *
 * PO berkelompok menyimpan harga per kelompok di po_kelompok; `harga_siswa` PO-nya 0 dan
 * jumlah siswanya jumlah rombel seluruh kelompok — persis bentuk yang dituntut trigger.
 */
function ringkasan(isi: IsiPo, bolehAcq: boolean): {
  kelompok: NonNullable<IsiPo['kelompok']> | null;
  jumlahSiswa: number; hargaSiswa: number; grand: number;
  hasil: HasilPerKelompok | null;
} {
  const kelompok = (isi.kelompok?.length ?? 0) >= 2 ? isi.kelompok! : null;
  if (!kelompok) {
    return { kelompok: null, jumlahSiswa: isi.jumlahSiswa, hargaSiswa: isi.hargaSiswa,
      grand: isi.jumlahSiswa * isi.hargaSiswa + isi.jumlahGuru * isi.hargaGuru, hasil: null };
  }
  const hasil = hitungPerKelompok({
    kelompok,
    komponen: isi.komponen.map((k) => ({ id: k.id, sesi: k.sesi, kelompok: kelompokKomponen(k) })),
    rombel: isi.rombel.map((r) => ({ kelas: r.kelas, rombel: r.rombel, jumlah: r.jumlah, kelompok: r.kelompok ?? 1 })),
    jumlahGuru: isi.jumlahGuru, hargaGuru: isi.hargaGuru,
    daftar: komponenUntuk(bolehAcq), daftarPaket: presetUntuk(bolehAcq),
  });
  return { kelompok, jumlahSiswa: hasil.kelompok.reduce((a, k) => a + k.siswa, 0),
    hargaSiswa: 0, grand: hasil.grandTotal, hasil };
}

/** Pelatihan Guru di tingkat PO: disimpan di kelompok 1, dari kelompok mana pun ia dikirim. */
const kelompokKomponen = (k: { id: string; kelompok?: number }) =>
  ID_GURU.includes(k.id) ? 1 : (k.kelompok ?? 1);

/**
 * Memeriksa ulang seluruh aturan di server. Penjagaan di peramban hanya membantu
 * pengguna; yang mengikat adalah pemeriksaan di sini, karena permintaan bisa
 * dikirim tanpa melewati antarmuka sama sekali.
 */
/**
 * @param lewatiLantai Untuk PO UNGGAHAN saja. Kertasnya sudah ditandatangani; menolak
 *   MENYIMPANnya tidak membatalkan tanda tangan itu, hanya membuat kesepakatannya tidak
 *   tercatat di mana pun — dan pengecualian tidak akan pernah bisa dimintakan karena
 *   PO-nya tidak pernah ada. Lantainya tetap ditegakkan, tapi pada saat PENGAJUAN,
 *   oleh trigger `jaga_lantai_po` yang mengenali pengecualian Head of Operations.
 *
 *   Hanya lantai yang dilewati. Batas minimal peserta dan kapasitas sesi tetap
 *   menghalangi: keduanya soal apakah layanannya bisa dijalankan, bukan soal harga,
 *   dan tidak ada pengecualian yang membuat 25 siswa cukup untuk sesi minimal 30.
 */
function periksa(isi: IsiPo, bolehAcq: boolean, lewatiLantai = false): string[] {
  const galat: string[] = [];

  if (!isi.sekolah.nama?.trim()) galat.push('Nama sekolah wajib diisi.');
  if (!isi.komponen.length) galat.push('Belum ada komponen yang dipilih.');
  const rk = ringkasan(isi, bolehAcq);
  if (rk.jumlahSiswa < 1) galat.push('Jumlah siswa minimal 1.');

  const idSah = new Set(KOMPONEN.map((k) => k.id));
  const asing = isi.komponen.filter((k) => !idSah.has(k.id)).map((k) => k.id);
  if (asing.length) galat.push(`Komponen tidak dikenal: ${asing.join(', ')}.`);

  if (rk.hasil) {
    // ---------- PO berkelompok: setiap aturan berlaku per kelompok ----------
    if (isi.asal === 'unggahan')
      galat.push('PO unggahan belum bisa berkelompok: kertas Form PO hanya punya satu baris siswa.');
    galat.push(...rk.hasil.masalah);
    for (const k of rk.hasil.kelompok) {
      const label = k.nama?.trim() || `Kelompok ${k.nomor}`;
      const pil = isi.komponen.filter((x) => kelompokKomponen(x) === k.nomor && !ID_GURU.includes(x.id));
      for (const p of [...langgarMinimum(pil, k.siswa, 0, KOMPONEN), ...langgarKapasitas(pil, k.siswa, 0, KOMPONEN)])
        galat.push(`${label}: ${p.pesan}`);
      if (!lewatiLantai && k.lantai && k.hargaSiswa < k.lantai)
        galat.push(`${label}: harga siswa di bawah bottom price (${k.lantai} per siswa).`);
    }
    const guru = isi.komponen.filter((x) => ID_GURU.includes(x.id));
    for (const p of [...langgarMinimum(guru, 0, isi.jumlahGuru, KOMPONEN), ...langgarKapasitas(guru, 0, isi.jumlahGuru, KOMPONEN)])
      galat.push(p.pesan);
    const lg = rk.hasil.guru.lantai;
    if (!lewatiLantai && lg && isi.jumlahGuru > 0 && isi.hargaGuru < lg)
      galat.push(`Harga guru di bawah bottom price (${lg} per guru).`);
  } else {
  for (const p of [
    ...langgarMinimum(isi.komponen, isi.jumlahSiswa, isi.jumlahGuru, KOMPONEN),
    ...langgarKapasitas(isi.komponen, isi.jumlahSiswa, isi.jumlahGuru, KOMPONEN),
  ]) galat.push(p.pesan);

  // Lantai Bottom Price. Semua peran melihat Bottom Price, jadi selalu bisa dicek.
  // Lantai mengikuti harga PAKET begitu komponen intinya persis sebuah preset, dan
  // harga a la carte 4.0 untuk susunan lain. Ditegakkan DI SINI, di server — tombol
  // yang mati di layar bukan penjagaan.
  const h = hitung(isi.komponen, isi.jumlahSiswa, isi.jumlahGuru,
    komponenUntuk(bolehAcq), presetUntuk(bolehAcq));
  const lantaiSiswa = h.perSiswa[1] ?? 0;
  const lantaiGuru = h.perGuru[1] ?? 0;
  if (!lewatiLantai) {
    if (lantaiSiswa && isi.hargaSiswa < lantaiSiswa)
      galat.push(`Harga siswa di bawah bottom price (${lantaiSiswa} per siswa).`);
    if (lantaiGuru && isi.jumlahGuru > 0 && isi.hargaGuru < lantaiGuru)
      galat.push(`Harga guru di bawah bottom price (${lantaiGuru} per guru).`);
  }
  }

  const totalTermin = isi.termin.reduce((a, t) => a + (t.nominal || 0), 0);
  const grand = rk.grand;
  if (totalTermin > 0 && totalTermin !== grand)
    galat.push(`Total termin (${totalTermin}) tidak sama dengan grand total (${grand}).`);

  return galat;
}

const SEKOLAH_DIPEGANG_LAIN = 'Sekolah PO ini sekarang dipegang sales lain, jadi datanya tidak bisa diubah '
  + 'dari sini. Minta Head of Sales atau Admin Sales bila perlu dikoreksi.';

export async function simpanDraf(isi: IsiPo): Promise<HasilSimpan> {
  const hasil = await penggunaSaatIni();
  if (hasil.status !== 'ok') return { ok: false, galat: ['Sesi berakhir. Masuk lagi.'] };
  if (!bolehBuatPo(hasil.pengguna.peran))
    return { ok: false, galat: ['Peranmu tidak berhak membuat PO.'] };

  let asal: 'platform' | 'unggahan' = isi.asal === 'unggahan' ? 'unggahan' : 'platform';
  if (isi.id) {
    const adaPo = await prisma.po.findUnique({
      where: { id: isi.id },
      select: { asal: true },
    });
    if (adaPo?.asal === 'unggahan' || adaPo?.asal === 'platform') asal = adaPo.asal as 'platform' | 'unggahan';
  }

  const galat = periksa(isi, bolehLihatAcquisition(hasil.pengguna.peran),
    asal === 'unggahan');
  if (galat.length) return { ok: false, galat };
  const rk = ringkasan(isi, bolehLihatAcquisition(hasil.pengguna.peran));
  const grand = rk.grand;

  // Sekolah dibuat sekali lalu dipakai ulang; NPSN jadi kuncinya bila ada.
  let sekolahId = isi.sekolah.id;
  if (!sekolahId) {
    const npsn = isi.sekolah.npsn?.trim();
    if (npsn) {
      const data = await prisma.sekolah.findFirst({
        where: { npsn },
        select: { id: true },
      });
      sekolahId = data?.id;
    }
  }
  const kolomSekolah = { ...isi.sekolah };
  delete (kolomSekolah as { id?: string }).id;

  const kunciSekolah = async (id: string | undefined) => {
    if (!id) return null;
    const data = await prisma.sekolah.findUnique({ where: { id } });
    return data && bolehUbahSekolah(data.dipegangOleh, hasil.pengguna) ? null : { baris: data };
  };
  const kunci = await kunciSekolah(sekolahId);
  if (kunci && !isi.id) return { ok: false, galat: [SEKOLAH_DIPEGANG_LAIN] };

  // Nilai yang akan ditulis, dihitung SEKALI: dipakai untuk membandingkan dengan isi
  // lama dan untuk menulis, supaya "berubah" berarti persis "yang tersimpan berbeda".
  const kolomIsi = {
    asal,
    jumlah_siswa: rk.jumlahSiswa,
    jumlah_guru: isi.jumlahGuru,
    harga_siswa: rk.hargaSiswa,
    harga_guru: isi.hargaGuru,
    grand_total: grand,
    masa_mulai: isi.masaMulai || null,
    masa_selesai: isi.masaSelesai || null,
    sumber_dana: isi.sumberDana || null,
    sumber_dana_lain: isi.sumberDanaLain || null,
    kota: isi.kota || 'Jakarta',
    tanggal_ttd: isi.tanggalTtd || null,
    jumlah_rombel: isi.jumlahRombel,
    nama_pm: isi.namaPm || null,
    nama_sm: isi.namaSm || null,
    nama_rh: isi.namaRh || null,
    versi_pricelist: VERSI_PRICELIST,
    permintaan_tambahan: !!isi.permintaanTambahan,
    nilai_sponsorship: isi.nilaiSponsorship ?? null,
    ekstraksi_menunggu: isi.ekstraksiMenunggu?.length ? isi.ekstraksiMenunggu : null,
  };
  const rombelIsi = isi.rombel.filter((r) => r.jumlah > 0);
  const catatanIsi = isi.catatan.filter((c) => c.isi?.trim());

  let poId = isi.id;
  let versiBaru: number | undefined;
  // Pernyataan "data sesuai dengan pindaian" hanya berlaku untuk isi yang dinyatakan.
  let hapusPernyataan = false;
  if (poId) {
    const lama = await prisma.po.findUnique({
      where: { id: poId },
      include: {
        komponen: true,
        termin: true,
        catatan: true,
        rombel: true,
        kelompok: true,
      },
    });
    if (!lama) return { ok: false, galat: ['PO tidak ditemukan.'] };
    if (lama.status !== 'draf' && lama.status !== 'ditolak')
      return { ok: false, galat: ['PO ini sudah dikirim dan tidak bisa disunting. Kembalikan ke draf dulu.'] };

    if (lama.sekolahId !== sekolahId) {
      if (kunci || await kunciSekolah(lama.sekolahId))
        return { ok: false, galat: [SEKOLAH_DIPEGANG_LAIN] };
    } else if (kunci && sekolahDiubah(kolomSekolah, kunci.baris ?? (lama.sekolahBeku as any)).length) {
      return { ok: false, galat: [SEKOLAH_DIPEGANG_LAIN] };
    }

    const berubah: string[] = [];
    const tanda = (v: unknown) => JSON.stringify(v ?? null);
    if (lama.jumlahSiswa !== rk.jumlahSiswa) berubah.push('jumlah_siswa');
    if (lama.jumlahGuru !== isi.jumlahGuru) berubah.push('jumlah_guru');
    if (Number(lama.hargaSiswa) !== rk.hargaSiswa) berubah.push('harga_siswa');
    if (Number(lama.hargaGuru) !== isi.hargaGuru) berubah.push('harga_guru');
    if (Number(lama.grandTotal) !== grand) berubah.push('grand_total');
    const masaMulaiStr = lama.masaMulai ? lama.masaMulai.toISOString().slice(0, 10) : null;
    const masaSelesaiStr = lama.masaSelesai ? lama.masaSelesai.toISOString().slice(0, 10) : null;
    if (masaMulaiStr !== (isi.masaMulai ?? null)) berubah.push('masa_mulai');
    if (masaSelesaiStr !== (isi.masaSelesai ?? null)) berubah.push('masa_selesai');
    if (isianBerubah(lama.sumberDana, isi.sumberDana ?? null)
        || isianBerubah(lama.sumberDanaLain, isi.sumberDanaLain ?? null)) berubah.push('sumber_dana');
    if (lama.sekolahId !== sekolahId) berubah.push('sekolah');
    const beku = lama.sekolahBeku as { kepala_sekolah?: string | null; jenjang?: string | null } | null;
    if (isianBerubah(beku?.kepala_sekolah, isi.sekolah.kepala_sekolah)) berubah.push('kepala_sekolah');
    if (isianBerubah(beku?.jenjang, isi.sekolah.jenjang)) berubah.push('jenjang');

    const urut = <T extends Record<string, unknown>>(a: T[], k: keyof T) =>
      a.slice().sort((x, y) => String(x[k]).localeCompare(String(y[k])));
    const kompLama = (lama.komponen ?? []).map((k) => [k.kelompok ?? 1, k.komponenId, k.sesi]);
    const kompBaru = isi.komponen.map((k) => [kelompokKomponen(k), k.id, Math.max(1, k.sesi)]);
    if (tandaDaftar(kompLama) !== tandaDaftar(kompBaru)) berubah.push('komponen');

    const kelLama = (lama.kelompok ?? []).map((k) => [k.nomor, k.nama, Number(k.hargaSiswa)]);
    const kelBaru = (rk.kelompok ?? []).map((k) => [k.nomor, k.nama?.trim() || null, k.hargaSiswa]);
    const bagiLama = (lama.rombel ?? [])
      .filter((r) => r.jumlahSiswa > 0).map((r) => [r.kelas, r.rombel, r.kelompok ?? 1]);
    const bagiBaru = rombelIsi.map((r) => [r.kelas, r.rombel, rk.kelompok ? (r.kelompok ?? 1) : 1]);
    if (tandaDaftar(kelLama) !== tandaDaftar(kelBaru) || tandaDaftar(bagiLama) !== tandaDaftar(bagiBaru))
      berubah.push('kelompok');

    const terLama = urut((lama.termin ?? []).map((t) => ({
      urutan: t.urutan,
      nominal: Number(t.nominal),
      tanggal: t.tanggal ? t.tanggal.toISOString().slice(0, 10) : null,
    })), 'urutan');
    const terBaru = urut(isi.termin, 'urutan')
      .map((t) => ({ urutan: t.urutan, nominal: t.nominal, tanggal: t.tanggal || null }));
    if (tanda(terLama) !== tanda(terBaru)) berubah.push('termin');

    const sponsor = (a: { jenis: string; isi: string | null }[]) =>
      a.filter((c) => c.jenis === 'sponsorship').map((c) => (c.isi ?? '').trim()).filter(Boolean).sort();
    const nilaiLama = lama.nilaiSponsorship != null ? Number(lama.nilaiSponsorship) : null;
    const nilaiBaru = isi.nilaiSponsorship ?? null;
    if (tanda(sponsor((lama.catatan ?? []).map((c) => ({ jenis: c.jenis, isi: c.isi }))))
        !== tanda(sponsor(isi.catatan)) || nilaiLama !== nilaiBaru) berubah.push('sponsorship');
    if (!!lama.permintaanTambahan !== !!isi.permintaanTambahan)
      berubah.push('permintaan_tambahan');

    if (asal === 'unggahan') {
      const l = lama as unknown as Record<string, unknown>;
      hapusPernyataan = !!isi.pindaianBaru
        || berubah.length > 0
        || Object.entries(kolomIsi).some(([k, v]) =>
             k !== 'asal' && k !== 'versi_pricelist' && k !== 'ekstraksi_menunggu'
             && isianBerubah(l[k], v))
        || (['nama', 'npsn', 'jenjang', 'alamat', 'telepon', 'email', 'kepala_sekolah',
             'kepsek_hp', 'bendahara', 'bendahara_hp'] as const)
             .some((k) => isianBerubah((beku as any)?.[k], (isi.sekolah as any)[k]))
        || tandaDaftar((lama.rombel ?? []).map((r) => [r.kelas, r.rombel, r.jumlahSiswa]))
           !== tandaDaftar(rombelIsi.map((r) => [r.kelas, r.rombel, r.jumlah]))
        || tandaDaftar((lama.catatan ?? []).filter((c) => c.isi?.trim()).map((c) => [c.jenis, c.isi]))
           !== tandaDaftar(catatanIsi.map((c) => [c.jenis, c.isi]));
    }

    const basi = fungsiTerdampak(berubah);
    if (basi.length) {
      await prisma.verifikasi.updateMany({
        where: {
          poId,
          fungsi: { in: basi as any },
          berlaku: true,
        },
        data: {
          berlaku: false,
          digantikanPada: new Date(),
          sebabBasi: `Direvisi: ${berubah.join(', ')} berubah`,
        },
      });
    }
    if (berubah.length) versiBaru = (lama?.versi ?? 1) + 1;
  }

  if (sekolahId) {
    if (!kunci) {
      await prisma.sekolah.update({
        where: { id: sekolahId },
        data: {
          nama: kolomSekolah.nama,
          npsn: kolomSekolah.npsn || '',
          jenjang: kolomSekolah.jenjang,
          alamat: kolomSekolah.alamat || '',
          telepon: kolomSekolah.telepon || '',
          email: kolomSekolah.email || '',
          kepalaSekolah: kolomSekolah.kepala_sekolah || '',
          kepsekHp: kolomSekolah.kepsek_hp || '',
          bendahara: kolomSekolah.bendahara || '',
          bendaharaHp: kolomSekolah.bendahara_hp || '',
        },
      });
    }
  } else {
    try {
      const dataSekolah = await prisma.sekolah.create({
        data: {
          id: crypto.randomUUID(),
          nama: kolomSekolah.nama,
          npsn: kolomSekolah.npsn || '',
          jenjang: kolomSekolah.jenjang,
          alamat: kolomSekolah.alamat || '',
          telepon: kolomSekolah.telepon || '',
          email: kolomSekolah.email || '',
          kepalaSekolah: kolomSekolah.kepala_sekolah || '',
          kepsekHp: kolomSekolah.kepsek_hp || '',
          bendahara: kolomSekolah.bendahara || '',
          bendaharaHp: kolomSekolah.bendahara_hp || '',
          dipegangOleh: hasil.pengguna.email.toLowerCase(),
        },
      });
      sekolahId = dataSekolah.id;
    } catch (err: any) {
      if (err.code === 'P2002' || String(err).includes('npsn')) {
        return { ok: false, galat: [
          `Sekolah dengan NPSN ${isi.sekolah.npsn?.trim()} sudah dipegang sales lain. `
          + 'Minta Head of Sales atau Admin Sales mengalihkannya lebih dulu.',
        ] };
      }
      return { ok: false, galat: [`Gagal menyimpan sekolah: ${err.message}`] };
    }
  }

  const sekolahBeku = {
    nama: isi.sekolah.nama,
    npsn: isi.sekolah.npsn,
    jenjang: isi.sekolah.jenjang,
    alamat: isi.sekolah.alamat,
    telepon: isi.sekolah.telepon,
    email: isi.sekolah.email,
    kepala_sekolah: isi.sekolah.kepala_sekolah,
    kepsek_hp: isi.sekolah.kepsek_hp,
    bendahara: isi.sekolah.bendahara,
    bendahara_hp: isi.sekolah.bendahara_hp,
  };

  const dataPo = {
    sekolahId: sekolahId!,
    asal,
    jumlahSiswa: rk.jumlahSiswa,
    jumlahGuru: isi.jumlahGuru,
    hargaSiswa: BigInt(rk.hargaSiswa),
    hargaGuru: BigInt(isi.hargaGuru),
    grandTotal: BigInt(grand),
    masaMulai: isi.masaMulai ? new Date(isi.masaMulai) : new Date(),
    masaSelesai: isi.masaSelesai ? new Date(isi.masaSelesai) : new Date(),
    sumberDana: isi.sumberDana || '',
    sumberDanaLain: isi.sumberDanaLain || null,
    kota: isi.kota || 'Jakarta',
    tanggalTtd: isi.tanggalTtd ? new Date(isi.tanggalTtd) : null,
    jumlahRombel: isi.jumlahRombel,
    namaPm: isi.namaPm || null,
    namaSm: isi.namaSm || null,
    namaRh: isi.namaRh || null,
    versiPricelist: VERSI_PRICELIST,
    permintaanTambahan: !!isi.permintaanTambahan,
    nilaiSponsorship: BigInt(isi.nilaiSponsorship ?? 0),
    ekstraksiMenunggu: (isi.ekstraksiMenunggu?.length ? isi.ekstraksiMenunggu : null) as any,
    sekolahBeku,
  };

  if (poId) {
    await prisma.po.update({
      where: { id: poId },
      data: {
        ...dataPo,
        ...(versiBaru ? { versi: versiBaru } : {}),
        ...(hapusPernyataan ? { ditinjauPada: null, ditinjauOleh: null } : {}),
      },
    });
  } else {
    poId = crypto.randomUUID();
    const agg = await prisma.po.aggregate({ _max: { nomor: true } });
    const nomorBerikutnya = (agg._max.nomor ?? 0n) + 1n;

    await prisma.po.create({
      data: {
        id: poId,
        nomor: nomorBerikutnya,
        dibuatOleh: hasil.pengguna.email.toLowerCase(),
        skemaTtd: asal === 'unggahan' && isi.formKertasLama ? 3 : 4,
        ...dataPo,
      },
    });
  }

  const catatanPerJenis = new Map<string, string[]>();
  for (const c of catatanIsi) {
    const list = catatanPerJenis.get(c.jenis) || [];
    list.push(c.isi.trim());
    catatanPerJenis.set(c.jenis, list);
  }
  const catatanData = Array.from(catatanPerJenis.entries()).map(([jenis, list]) => ({
    poId: poId!,
    jenis,
    isi: list.join('\n'),
  }));

  await prisma.$transaction([
    prisma.poKelompok.deleteMany({ where: { poId } }),
    prisma.poKomponen.deleteMany({ where: { poId } }),
    prisma.poRombel.deleteMany({ where: { poId } }),
    prisma.poTermin.deleteMany({ where: { poId } }),
    prisma.poCatatan.deleteMany({ where: { poId } }),
    ...(rk.kelompok && rk.kelompok.length > 0 ? [
      prisma.poKelompok.createMany({
        data: rk.kelompok.map((k) => ({
          poId: poId!,
          nomor: k.nomor,
          nama: k.nama?.trim() || `Kelompok ${k.nomor}`,
          hargaSiswa: BigInt(k.hargaSiswa),
        })),
      }),
    ] : []),
    ...(isi.komponen.length > 0 ? [
      prisma.poKomponen.createMany({
        data: isi.komponen.map((k) => ({
          poId: poId!,
          komponenId: k.id,
          sesi: Math.max(1, k.sesi),
          kelompok: rk.kelompok ? kelompokKomponen(k) : 1,
        })),
      }),
    ] : []),
    ...(rombelIsi.length > 0 ? [
      prisma.poRombel.createMany({
        data: rombelIsi.map((r) => ({
          poId: poId!,
          kelas: r.kelas,
          rombel: r.rombel,
          jumlahSiswa: r.jumlah,
          kelompok: rk.kelompok ? (r.kelompok ?? 1) : 1,
        })),
      }),
    ] : []),
    ...(isi.termin.length > 0 ? [
      prisma.poTermin.createMany({
        data: isi.termin.map((t) => ({
          poId: poId!,
          urutan: t.urutan,
          tanggal: t.tanggal ? new Date(t.tanggal) : new Date(),
          nominal: BigInt(t.nominal),
        })),
      }),
    ] : []),
    ...(catatanData.length > 0 ? [
      prisma.poCatatan.createMany({
        data: catatanData,
      }),
    ] : []),
  ]);

  revalidatePath('/po');
  revalidatePath('/beranda');
  return { ok: true, id: poId! };
}

/* ---------- tanda tangan ---------- */

/** Draf -> menunggu tanda tangan. Setelah ini PO tidak bisa disunting lagi. */
export async function kirimUntukTtd(id: string): Promise<{ ok: boolean; galat?: string }> {
  try {
    const res = await prisma.po.updateMany({
      where: {
        id,
        status: { in: ['draf', 'ditolak'] },
      },
      data: {
        status: 'menunggu_ttd',
      },
    });
    if (res.count === 0) return { ok: false, galat: 'PO tidak ditemukan atau tidak berstatus draf/ditolak.' };
    await hapusBerkas('tanda-tangan', SEMUA_PIHAK.map((p) => `${id}/${p}.png`)).catch(() => {});
    revalidatePath(`/po/${id}`);
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

/** Membatalkan pengiriman supaya PO bisa disunting lagi. Tanda tangan ikut dihapus. */
export async function kembalikanKeDraf(id: string): Promise<{ ok: boolean; galat?: string }> {
  try {
    await hapusBerkas('tanda-tangan', SEMUA_PIHAK.map((p) => `${id}/${p}.png`)).catch(() => {});
    await prisma.$transaction([
      prisma.tandaTangan.deleteMany({ where: { poId: id } }),
      prisma.po.updateMany({
        where: { id, status: 'menunggu_ttd' },
        data: { status: 'draf' },
      }),
    ]);
    revalidatePath(`/po/${id}`);
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

export async function simpanTtd(
  poId: string, pihak: Pihak, nama: string, pngBase64: string
): Promise<{ ok: boolean; galat?: string }> {
  const hasil = await penggunaSaatIni();
  if (hasil.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (!nama.trim()) return { ok: false, galat: 'Nama penanda tangan belum diisi.' };

  const biner = Buffer.from(pngBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
  if (biner.length > 512 * 1024) return { ok: false, galat: 'Berkas tanda tangan terlalu besar.' };

  const jalur = `${poId}/${pihak}.png`;
  try {
    await simpanBerkas('tanda-tangan', jalur, biner);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat simpan berkas';
    return { ok: false, galat: `Gagal mengunggah: ${msg}` };
  }

  try {
    await prisma.tandaTangan.upsert({
      where: {
        poId_pihak: {
          poId,
          pihak: pihak as any,
        },
      },
      create: {
        poId,
        pihak: pihak as any,
        nama: nama.trim(),
        berkas: jalur,
        dibubuhkanOleh: hasil.pengguna.email.toLowerCase(),
        asal: 'kanvas',
      },
      update: {
        nama: nama.trim(),
        berkas: jalur,
        dibubuhkanOleh: hasil.pengguna.email.toLowerCase(),
        waktu: new Date(),
        berkasDihapusPada: null,
      },
    });

    const po = await prisma.po.findUnique({
      where: { id: poId },
      select: { skemaTtd: true, status: true },
    });
    const semua = await prisma.tandaTangan.findMany({
      where: { poId },
      select: { pihak: true },
    });
    const ada = new Set(semua.map((t) => t.pihak));
    if (po && pihakUntuk(skemaDari(po.skemaTtd)).every((p) => ada.has(p as any))) {
      await prisma.po.updateMany({
        where: { id: poId, status: 'menunggu_ttd' },
        data: { status: 'ditandatangani' },
      });
    }

    revalidatePath(`/po/${poId}`);
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat menyimpan';
    return { ok: false, galat: msg };
  }
}

export async function hapusTtd(poId: string, pihak: Pihak): Promise<{ ok: boolean; galat?: string }> {
  await hapusBerkas('tanda-tangan', `${poId}/${pihak}.png`).catch(() => {});
  try {
    await prisma.tandaTangan.deleteMany({
      where: {
        poId,
        pihak: pihak as any,
      },
    });
    revalidatePath(`/po/${poId}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat menghapus tanda tangan';
    return { ok: false, galat: msg };
  }
}

/** URL internal untuk gambar tanda tangan. */
export async function urlTtd(jalur: string): Promise<string | null> {
  return urlBerkas('tanda-tangan', jalur);
}

/**
 * Ditandatangani -> verifikasi. Syaratnya semua tanda tangan skema PO lengkap; diperiksa
 * di sini, bukan hanya di antarmuka. Setelah ini PO keluar dari fase sales.
 */
export async function ajukanVerifikasi(id: string): Promise<{ ok: boolean; galat?: string }> {
  try {
    const po = await prisma.po.findUnique({
      where: { id },
      select: { skemaTtd: true, status: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };
    const semua = await prisma.tandaTangan.findMany({
      where: { poId: id },
      select: { pihak: true },
    });
    const ada = new Set(semua.map((t) => t.pihak));
    if (!pihakUntuk(skemaDari(po.skemaTtd)).every((p) => ada.has(p as any)))
      return { ok: false, galat: 'Belum semua pihak menandatangani.' };

    await prisma.po.updateMany({
      where: { id, status: 'ditandatangani' },
      data: { status: 'verifikasi' },
    });

    revalidatePath(`/po/${id}`);
    revalidatePath('/po');
    revalidatePath('/beranda');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat mengajukan verifikasi';
    return { ok: false, galat: msg };
  }
}

/* ---------- verifikasi ---------- */

/** Keputusan satu fungsi. Menimpa keputusan sebelumnya bila diubah. */
export async function putuskanVerifikasi(
  poId: string,
  fungsi: Fungsi,
  hasil: 'setuju' | 'setuju_catatan' | 'tolak',
  catatan: string,
  item: Record<string, boolean>
): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (hasil === 'tolak' && !catatan.trim())
    return { ok: false, galat: 'Penolakan wajib disertai catatan alasannya.' };
  if (hasil === 'setuju_catatan' && !catatan.trim())
    return { ok: false, galat: 'Pilihan "setuju dengan catatan" wajib menyebutkan catatannya.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      select: { versi: true, status: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };
    if (po.status !== 'verifikasi') return { ok: false, galat: 'PO tidak sedang dalam tahap verifikasi.' };

    await prisma.$transaction([
      prisma.verifikasi.updateMany({
        where: {
          poId,
          fungsi: fungsi as any,
          berlaku: true,
        },
        data: {
          berlaku: false,
          digantikanPada: new Date(),
          sebabBasi: 'Keputusan diubah',
        },
      }),
      prisma.verifikasi.create({
        data: {
          poId,
          fungsi: fungsi as any,
          hasil: hasil as any,
          catatan: catatan.trim() || null,
          item: item as any,
          oleh: p.pengguna.email.toLowerCase(),
          versiPo: po.versi,
          berlaku: true,
        },
      }),
    ]);

    revalidatePath(`/po/${poId}`);
    revalidatePath('/verifikasi');
    revalidatePath('/beranda');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat menyimpan verifikasi';
    return { ok: false, galat: msg };
  }
}

/**
 * Tech Ops Lead menutup tahap verifikasi. Keempat lampu hijau -> terverifikasi;
 * ada satu saja yang menolak -> ditolak, lalu dikomunikasikan ke Sales.
 */
export async function tutupVerifikasi(
  poId: string, ke: 'terverifikasi' | 'ditolak'
): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok' || !adalahLead(p.pengguna.peran))
    return { ok: false, galat: 'Hanya Tech Ops Lead yang bisa menutup tahap verifikasi.' };

  try {
    const daftar = await prisma.verifikasi.findMany({
      where: {
        poId,
        berlaku: true,
      },
      select: {
        fungsi: true,
        hasil: true,
      },
    });

    if (ke === 'terverifikasi') {
      if (daftar.length < 4) return { ok: false, galat: 'Belum keempat fungsi memberi keputusan.' };
      if (daftar.some((x) => x.hasil === 'tolak'))
        return { ok: false, galat: 'Masih ada fungsi yang menolak.' };
    } else if (!daftar.some((x) => x.hasil === 'tolak')) {
      return { ok: false, galat: 'Tidak ada fungsi yang menolak.' };
    }

    await prisma.po.updateMany({
      where: { id: poId, status: 'verifikasi' },
      data: ke === 'terverifikasi'
        ? { status: ke, diverifikasiOleh: p.pengguna.email.toLowerCase(), diverifikasiPada: new Date() }
        : { status: ke },
    });

    revalidatePath(`/po/${poId}`);
    revalidatePath('/verifikasi');
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat menutup verifikasi';
    return { ok: false, galat: msg };
  }
}

/** PO ditolak ditarik kembali ke draf oleh Sales untuk diperbaiki. */
export async function tarikKeDraf(id: string): Promise<{ ok: boolean; galat?: string }> {
  try {
    const res = await prisma.po.updateMany({
      where: { id, status: 'ditolak' },
      data: { status: 'draf' },
    });
    if (res.count === 0) return { ok: false, galat: 'PO tidak ditemukan atau bukan berstatus ditolak.' };
    revalidatePath(`/po/${id}`);
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}


/**
 * Mencatat pindaian PO yang sudah diunggah ke penyimpanan.
 *
 * Berkasnya diunggah langsung dari peramban, bukan lewat aksi ini — pindaian
 * berukuran megabyte sementara badan Server Action dibatasi 1MB. Sama seperti
 * pindaian PKS bermeterai.
 *
 * Urutannya terpaksa begini: kebijakan penyimpanan menuntut PO sudah ada dan masih
 * draf, karena id PO menjadi awalan nama berkas. Jadi draf disimpan dulu, pindaian
 * menyusul.
 */
export async function catatUnggahanPo(poId: string, jalur: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const res = await prisma.po.updateMany({
      where: {
        id: poId,
        asal: 'unggahan',
        status: { in: ['draf', 'ditolak'] },
      },
      data: {
        berkasUnggahan: jalur,
        ditinjauPada: null,
        ditinjauOleh: null,
      },
    });
    if (res.count === 0)
      return { ok: false, galat: 'Pindaian tidak bisa dicatat: PO sudah tidak berstatus draf, atau bukan PO unggahan.' };

    revalidatePath(`/po/${poId}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat mencatat pindaian';
    return { ok: false, galat: msg };
  }
}

/**
 * Sales menyatakan data hasil tinjauan sesuai dengan pindaian.
 *
 * Ini pernyataan orang, bukan hasil mesin — dan satu-satunya hal yang menjamin data di
 * sistem benar-benar mewakili kertas yang ditandatangani. Karena itu ia dicatat berikut
 * siapa dan kapan, lalu dibekukan bersama isi PO lainnya.
 */
export async function konfirmasiTinjauan(poId: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const res = await prisma.po.updateMany({
      where: {
        id: poId,
        asal: 'unggahan',
        status: { in: ['draf', 'ditolak'] },
        berkasUnggahan: { not: null },
      },
      data: {
        ditinjauPada: new Date(),
        ditinjauOleh: p.pengguna.email.toLowerCase(),
      },
    });
    if (res.count === 0)
      return { ok: false, galat: 'Belum bisa dikonfirmasi: pindaiannya belum terunggah, atau PO sudah tidak berstatus draf.' };

    revalidatePath(`/po/${poId}`);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat konfirmasi';
    return { ok: false, galat: msg };
  }
}

/** URL internal untuk pindaian PO. */
export async function urlUnggahanPo(jalur: string): Promise<string | null> {
  return urlBerkas('po-unggahan', jalur);
}

/**
 * Mengajukan PO unggahan: dari draf langsung ke `ditandatangani`, berikut tiga baris
 * tanda tangan yang berasal dari pindaian.
 */
export async function ajukanUnggahan(poId: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      include: { sekolah: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };

    const emailSaya = p.pengguna.email.toLowerCase();
    const pembuat = po.dibuatOleh.toLowerCase();
    const peranSaya = p.pengguna.peran;
    const bolehSales = pembuat === emailSaya
      || peranSaya.some((r) => ['head_of_sales', 'admin_sales', 'admin_utama'].includes(r));
    if (!bolehSales) return { ok: false, galat: 'PO ini bukan milikmu.' };

    if (po.asal !== 'unggahan') {
      return { ok: false, galat: 'Jalur ini hanya untuk PO unggahan. PO platform mengumpulkan tanda tangan lewat aplikasi.' };
    }
    if (!['draf', 'ditolak'].includes(po.status)) {
      return { ok: false, galat: `PO berstatus ${po.status} sudah tidak bisa diajukan lagi.` };
    }
    if (!po.berkasUnggahan) {
      return { ok: false, galat: 'Pindaian PO belum diunggah.' };
    }
    if (!po.ditinjauPada) {
      return { ok: false, galat: 'Belum ada pernyataan bahwa data ini sesuai dengan pindaian.' };
    }

    const beku = (po.sekolahBeku as { kepala_sekolah?: string } | null) ?? { kepala_sekolah: po.sekolah?.kepalaSekolah };
    const kepsek = beku?.kepala_sekolah?.trim() || po.sekolah?.kepalaSekolah?.trim() || '—';
    const pm = po.namaPm?.trim() || '—';
    const sm = po.namaSm?.trim() || '—';
    const rh = po.namaRh?.trim() || '—';

    const skema = (po.skemaTtd === 3 ? 3 : 4) as 3 | 4;
    const pihakWajib = pihakUntuk(skema);

    const ttdData = pihakWajib.map((pihak) => {
      let nama = '—';
      if (pihak === 'kepala_sekolah') nama = kepsek;
      else if (pihak === 'partnership_manager') nama = pm;
      else if (pihak === 'regional_head') nama = rh;
      else if (pihak === 'sales_manager') nama = sm;
      return {
        poId,
        pihak: pihak as any,
        nama,
        berkas: po.berkasUnggahan!,
        dibubuhkanOleh: emailSaya,
        asal: 'pindaian',
      };
    });

    await prisma.$transaction([
      prisma.tandaTangan.deleteMany({ where: { poId } }),
      prisma.po.update({
        where: { id: poId },
        data: { status: 'ditandatangani' },
      }),
      prisma.tandaTangan.createMany({
        data: ttdData,
      }),
    ]);

    revalidatePath(`/po/${poId}`);
    revalidatePath('/po');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat mengajukan PO unggahan';
    return { ok: false, galat: msg };
  }
}


export async function daftarJatuhTempo(): Promise<BerkasJatuhTempo[]> {
  return retensiDaftarJatuhTempo();
}

export async function hapusBerkasJatuhTempo(
  bucket: string,
  jalur: string,
): Promise<{ ok: boolean; galat?: string }> {
  return retensiHapusBerkasJatuhTempo(bucket, jalur);
}

/* ---------- komentar ---------- */

/**
 * Menulis komentar. Penolakan C Level, kuota panjang, dan versi PO
 * ditegakkan sebelum penyimpanan ke basis data.
 */
export async function tulisKomentar(poId: string, isi: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (p.pengguna.peran.includes('c_level')) {
    return { ok: false, galat: 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.' };
  }
  const isiBersih = isi.trim();
  if (!isiBersih) return { ok: false, galat: 'Komentar masih kosong.' };
  if (isi.length > 4000) return { ok: false, galat: 'Komentar terlalu panjang: maksimal 4.000 karakter.' };

  const po = await prisma.po.findUnique({
    where: { id: poId },
    select: { versi: true, dibuatOleh: true },
  });
  if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };

  if (p.pengguna.peran.includes('sales') && !p.pengguna.peran.includes('admin_utama') && !p.pengguna.peran.includes('admin_sales') && !p.pengguna.peran.includes('head_of_sales')) {
    if (po.dibuatOleh.toLowerCase() !== p.pengguna.email.toLowerCase()) {
      return { ok: false, galat: 'Kamu tidak bisa berkomentar di PO ini.' };
    }
  }

  await prisma.poKomentar.create({
    data: {
      poId,
      isi,
      oleh: p.pengguna.email.toLowerCase(),
      namaPenulis: p.pengguna.nama,
      peranPenulis: p.pengguna.peran,
      versiPo: po.versi,
      kedalaman: 0,
    },
  });

  revalidatePath(`/po/${poId}`);
  return { ok: true };
}

/**
 * Membalas satu peristiwa lini masa. Balasan adalah baris po_komentar biasa yang membawa
 * penambat, jadi RLS, sunting, hapus, revisi, dan penandaan basi ikut apa adanya.
 */
export async function balasKomentar(
  poId: string, indukKunci: string, isi: string,
): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (p.pengguna.peran.includes('c_level')) {
    return { ok: false, galat: 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.' };
  }
  const isiBersih = isi.trim();
  if (!isiBersih) return { ok: false, galat: 'Balasan masih kosong.' };
  if (isi.length > 4000) return { ok: false, galat: 'Komentar terlalu panjang: maksimal 4.000 karakter.' };
  if (!indukKunci.trim()) return { ok: false, galat: 'Balasan ini tidak punya penambat.' };
  if (indukKunci.length > 200) return { ok: false, galat: 'Penambat balasan tidak dikenali.' };

  const po = await prisma.po.findUnique({
    where: { id: poId },
    select: { versi: true, dibuatOleh: true },
  });
  if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };

  if (p.pengguna.peran.includes('sales') && !p.pengguna.peran.includes('admin_utama') && !p.pengguna.peran.includes('admin_sales') && !p.pengguna.peran.includes('head_of_sales')) {
    if (po.dibuatOleh.toLowerCase() !== p.pengguna.email.toLowerCase()) {
      return { ok: false, galat: 'Kamu tidak bisa berkomentar di PO ini.' };
    }
  }

  let kedalaman = 0;
  if (indukKunci.startsWith('komentar:')) {
    const indukId = indukKunci.slice('komentar:'.length);
    const induk = await prisma.poKomentar.findUnique({
      where: { id: indukId },
      select: { poId: true, kedalaman: true },
    });
    if (!induk) return { ok: false, galat: 'Komentar yang dibalas tidak ditemukan.' };
    if (induk.poId !== poId) {
      return { ok: false, galat: 'Balasan harus berada di PO yang sama dengan komentar yang dibalas.' };
    }
    kedalaman = induk.kedalaman + 1;
    if (kedalaman > 50) {
      return { ok: false, galat: 'Balasan sudah bersarang 50 tingkat. Mulai utas baru di tingkat atas.' };
    }
  }

  await prisma.poKomentar.create({
    data: {
      poId,
      isi,
      oleh: p.pengguna.email.toLowerCase(),
      namaPenulis: p.pengguna.nama,
      peranPenulis: p.pengguna.peran,
      versiPo: po.versi,
      indukKunci,
      kedalaman,
    },
  });

  revalidatePath(`/po/${poId}`);
  return { ok: true };
}

/** Isi lama disalin ke po_komentar_revisi, jadi tidak pernah hilang. */
export async function suntingKomentar(poId: string, id: string, isi: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (p.pengguna.peran.includes('c_level')) {
    return { ok: false, galat: 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.' };
  }
  const isiBersih = isi.trim();
  if (!isiBersih) return { ok: false, galat: 'Isi komentar tidak boleh kosong.' };
  if (isi.length > 4000) return { ok: false, galat: 'Komentar terlalu panjang: maksimal 4.000 karakter.' };

  const k = await prisma.poKomentar.findUnique({ where: { id } });
  if (!k) return { ok: false, galat: 'Komentar tidak ditemukan.' };
  if (k.oleh.toLowerCase() !== p.pengguna.email.toLowerCase()) {
    return { ok: false, galat: 'Hanya penulisnya yang bisa menyunting komentar ini.' };
  }
  if (k.dihapusPada) return { ok: false, galat: 'Komentar ini sudah dihapus.' };

  if (k.isi !== isi) {
    await prisma.$transaction([
      prisma.poKomentarRevisi.create({
        data: {
          komentarId: id,
          isi: k.isi,
        },
      }),
      prisma.poKomentar.update({
        where: { id },
        data: {
          isi,
          disuntingPada: new Date(),
        },
      }),
    ]);
  }

  revalidatePath(`/po/${poId}`);
  return { ok: true };
}

/** Menandai, bukan membuang. Tempatnya di lini masa tetap ada. */
export async function hapusKomentar(poId: string, id: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (p.pengguna.peran.includes('c_level')) {
    return { ok: false, galat: 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.' };
  }

  const k = await prisma.poKomentar.findUnique({ where: { id } });
  if (!k) return { ok: false, galat: 'Komentar tidak ditemukan.' };
  if (k.oleh.toLowerCase() !== p.pengguna.email.toLowerCase()) {
    return { ok: false, galat: 'Hanya penulisnya yang bisa menghapus komentar ini.' };
  }

  await prisma.poKomentar.update({
    where: { id },
    data: {
      dihapusPada: new Date(),
      dihapusOleh: p.pengguna.email.toLowerCase(),
    },
  });

  revalidatePath(`/po/${poId}`);
  return { ok: true };
}

/**
 * Menandai komentar PO ini sudah dibaca. Dipanggil dari klien SAAT halaman benar-benar
 * terpasang, bukan saat dirender di server.
 */
export async function tandaiKomentarDibaca(poId: string): Promise<void> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return;

  await prisma.poKomentarDibaca.upsert({
    where: {
      poId_oleh: {
        poId,
        oleh: p.pengguna.email.toLowerCase(),
      },
    },
    create: {
      poId,
      oleh: p.pengguna.email.toLowerCase(),
      waktu: new Date(),
    },
    update: {
      waktu: new Date(),
    },
  });

  revalidatePath('/', 'layout');
}

export async function tambahKomentarPo(poId: string, isi: string): Promise<{ ok: boolean; galat?: string }> {
  return tulisKomentar(poId, isi);
}

export async function suntingKomentarPo(poId: string, id: string, isi: string): Promise<{ ok: boolean; galat?: string }> {
  return suntingKomentar(poId, id, isi);
}

export async function hapusKomentarPo(poId: string, id: string): Promise<{ ok: boolean; galat?: string }> {
  return hapusKomentar(poId, id);
}

export async function tandaiKomentarPoDibaca(poId: string): Promise<void> {
  return tandaiKomentarDibaca(poId);
}

