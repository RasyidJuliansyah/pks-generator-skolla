/**
 * Seluruh state Form PO dan turunannya. Dipindah apa adanya dari form-po.tsx
 * (catatan/12, Tugas 3); form-po.tsx kini hanya menampilkan. Wizard memakai hook
 * yang sama untuk semua langkahnya.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Komponen, Preset } from '@/lib/pricelist';
import {
  hitung, langgarMinimum, langgarKapasitas, batasBawahPeserta, presetCocok,
  type Pilihan,
} from '@/lib/hitung';
import { rp } from '@/lib/format';
import { kekuranganPo, PESAN_TANPA_RH } from '@/lib/kelengkapan-po';
import { skemaDari, type SkemaTtd } from '@/lib/pihak';
import type { Halangan, KodeLangkah } from '@/lib/langkah-po';
import { simpanDraf, catatUnggahanPo, konfirmasiTinjauan, urlUnggahanPo, type IsiPo } from '@/lib/po-aksi';
import { unggahBerkasAksi } from '@/lib/storage-aksi';
import { dokumenPo } from '@/lib/dokumen-po';
import { KELAS } from '@/lib/kelas';
import { hitungPerKelompok } from '@/lib/kelompok';
import { ID_GURU } from '@/lib/aturan-komponen';
import { susunIsiPo } from '@/lib/isi-po-form';
import {
  petakanEkstraksi, kunciAwal, langkahDari, terkunciRisiko as terkunciRisikoLangkah,
  sisaSetelahDicentang, sisaSetelahDikonfirmasi, layakTinjau, tambalanWizard, kunciMenunggu,
  type HasilPetakan,
} from '@/lib/ekstraksi-po';
import { tautkanEkstraksi } from '@/lib/ekstraksi-aksi';
import { huruf, pemilih, type Ubah } from './isian';

export type PropsFormPo = {
  komponen: Komponen[]; preset: Preset[]; namaTier: string[]; awal?: IsiPo & { skemaTtd?: SkemaTtd };
  /** Sekolahnya sudah dialihkan ke sales lain: isian diambil dari salinan beku, tak bisa diubah. */
  sekolahTerkunci?: boolean;
  /** Pindaian yang sudah tersimpan, untuk PO unggahan yang sedang disunting. */
  berkasUnggahan?: string | null;
  /** Pemegang peran Sales — calon Partnership Manager. */
  akunPm: { email: string; nama: string | null }[];
  /** Pemegang peran Head of Sales — calon Head of Sales (Sales Manager pada PO lama). */
  akunSm: { email: string; nama: string | null }[];
  /** Pemegang peran Regional Head Division (catatan/23). */
  akunRh: { email: string; nama: string | null }[];
  /**
   * Gerbang organisasi ekstraksi scan (catatan/17), dibaca halaman dari basis data. Mati berarti
   * jalur unggah berperilaku persis seperti sebelum fitur ini ada.
   */
  gerbangEkstraksi: boolean;
  /**
   * HANYA untuk pratinjau statis (`uji/pratinjau-wizard.tsx`), pola yang sama dengan `mulaiDi`:
   * menyemai keadaan "scan sudah dibaca" yang tidak bisa datang dari prop mana pun karena ia
   * state di dalam hook ini. Aplikasi tidak pernah mengirimnya -- halaman Form PO hanya menerima
   * prop dari `page.tsx`/`po/[id]/page.tsx`, dan keduanya tidak menyebutnya.
   */
  ekstraksiPratinjau?: { klaimId: string; hasil: unknown };
};

export type PropsLangkah = { f: ReturnType<typeof useFormPo>; ke: (k: KodeLangkah) => void };

export function useFormPo(props: PropsFormPo) {
  const { komponen, preset, namaTier, awal, sekolahTerkunci, berkasUnggahan, akunPm, akunSm, akunRh,
    gerbangEkstraksi } = props;
  const router = useRouter();
  const [kirim, mulaiKirim] = useTransition();

  // Jalur pembuatan PO. Hanya bisa dipilih saat MEMBUAT; PO yang sudah ada memakai
  // asal yang tersimpan, dan basis data membekukannya begitu PO meninggalkan draf.
  const [asal, setAsal] = useState<'platform' | 'unggahan'>(awal?.asal ?? 'platform');
  const [pindaian, setPindaian] = useState<File | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [sesuaiPindaian, setSesuaiPindaian] = useState(false);
  // Hanya saat MEMBUAT PO unggahan. Skema PO yang sudah ada dibaca dari data dan beku.
  const [formKertasLama, setFormKertasLama] = useState(false);

  // Hasil baca AI untuk PO yang sedang dibuat (catatan/17). `klaimId` adalah baris klaimnya di
  // ekstraksi_po; penautannya ke PO baru terjadi SESUDAH draf dan pindaiannya ada (amandemen 3),
  // dan sebelum itu hasil bacanya hanya hidup di state ini.
  //
  // `awalEkstraksi` hanya terisi dari prop pratinjau (lihat PropsFormPo.ekstraksiPratinjau).
  const awalEkstraksi = useMemo(() => (props.ekstraksiPratinjau
    ? petakanEkstraksi(props.ekstraksiPratinjau.hasil, {
        idsPaket: (nama) => preset.find((p) => p.n === nama)?.ids ?? null,
      })
    : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [ekstraksi, setEkstraksi] = useState<HasilPetakan | null>(awalEkstraksi);
  const [klaimId, setKlaimId] = useState<string | null>(props.ekstraksiPratinjau?.klaimId ?? null);
  const [pemberitahuanAi, setPemberitahuanAi] = useState(false);
  /**
   * Kunci isian dari scan yang MASIH menunggu konfirmasi Sales. Dimulai dari daftar tersimpan
   * (draf dibuka lagi) atau dari hasil baca (scan baru dibaca), lalu menyusut saat Sales
   * mencentang dan mengonfirmasi langkah. Inilah satu-satunya sumber penanda "belum diperiksa",
   * dan ia yang ikut tersimpan supaya membuka ulang draf tidak menuntut ulang yang sudah.
   */
  const [sisa, setSisa] = useState<string[]>(awalEkstraksi
    ? kunciAwal(awalEkstraksi) : (awal?.ekstraksiMenunggu ?? []));
  /**
   * Catatan hasil baca. JENISNYA selalu kosong dari AI (catatan/17 aturan 1), dan Sales yang
   * memilih. Jenisnya sengaja TIDAK disimpan di po_catatan sebelum dipilih: melabeli sponsorship
   * jadi pelaksanaan secara otomatis adalah persis kesalahan yang aturan itu cegah.
   */
  const [catatanScan, setCatatanScan] = useState<
    { isi: string; jenis: 'pelaksanaan' | 'sponsorship' | null }[]
  >(() => (awalEkstraksi?.catatan ?? []).map((c) => ({ isi: c.isi, jenis: null })));
  const skema: SkemaTtd = awal
    ? skemaDari(awal.skemaTtd)
    : asal === 'unggahan' && formKertasLama ? 3 : 4;

  // Pratinjau dibuat LOKAL di peramban, sebelum apa pun diunggah. Itu yang membuat
  // perbandingan berdampingan bisa terjadi sebelum PO ada — kebijakan penyimpanan
  // menuntut PO sudah ada dan masih draf sebelum berkasnya boleh naik.
  useEffect(() => {
    if (!pindaian) { setPratinjau(null); return; }
    const url = URL.createObjectURL(pindaian);
    setPratinjau(url);
    return () => URL.revokeObjectURL(url);
  }, [pindaian]);

  // PO unggahan yang disunting: pindaian yang TERSIMPAN juga ditampilkan berdampingan,
  // supaya pernyataan kesesuaian bisa diperbarui tanpa mengunggah ulang. Pindaian baru
  // yang dipilih menggantikannya di layar.
  const [pratinjauTersimpan, setPratinjauTersimpan] = useState<string | null>(null);
  // Jalur pindaian selalu {id}/po.pdf, jadi berkasUnggahan tidak berubah saat pindaian
  // diganti. Tanpa hitungan ini layar terus menampilkan tautan lama — berkas lama dari
  // cache — dan pernyataan berikutnya dicentang sambil melihat pindaian yang salah.
  const [versiTersimpan, setVersiTersimpan] = useState(0);
  useEffect(() => {
    if (!berkasUnggahan) { setPratinjauTersimpan(null); return; }
    let batal = false;
    // Gagal mengambil tautannya bukan galat simpan: pemilih berkas tetap tersedia.
    urlUnggahanPo(berkasUnggahan)
      .then((u) => { if (!batal) setPratinjauTersimpan(u); })
      .catch(() => { if (!batal) setPratinjauTersimpan(null); });
    return () => { batal = true; };
  }, [berkasUnggahan, versiTersimpan]);
  const [pesan, setPesan] = useState<{ baik: boolean; isi: string[] } | null>(null);

  // PO BERKELOMPOK (dua kelompok atau lebih): komponen siswa hidup per kelompok di
  // `pilihKe`, dan `dipilih` tinggal memuat Pelatihan Guru, yang di tingkat PO. PO satu
  // kelompok — bawaannya — memakai `dipilih` untuk semuanya, dan layarnya persis seperti
  // sebelum kelompok ada.
  const awalBerkelompok = (awal?.kelompok?.length ?? 0) >= 2;
  const [dipilih, setDipilih] = useState<Record<string, number>>(
    () => Object.fromEntries((awal?.komponen ?? [])
      .filter((k) => !awalBerkelompok || ID_GURU.includes(k.id)).map((k) => [k.id, k.sesi]))
  );
  const [kelompok, setKelompok] = useState<{ nomor: number; nama: string; harga: number }[]>(
    () => (awalBerkelompok ? awal!.kelompok! : [])
      .map((k) => ({ nomor: k.nomor, nama: k.nama ?? '', harga: k.hargaSiswa })));
  const [pilihKe, setPilihKe] = useState<Record<number, Record<string, number>>>(() => {
    const o: Record<number, Record<string, number>> = {};
    if (awalBerkelompok)
      for (const k of awal!.komponen) if (!ID_GURU.includes(k.id)) (o[k.kelompok ?? 1] ??= {})[k.id] = k.sesi;
    return o;
  });
  // Pengelompokan per ANGKATAN (keputusan 9 Sep 2026): seluruh rombel satu kelas selalu
  // di satu kelompok. Skemanya sudah per rombel, jadi per rombel bisa menyusul tanpa migrasi.
  const [kelasKe, setKelasKe] = useState<Record<number, number>>(
    () => Object.fromEntries((awal?.rombel ?? []).map((r) => [r.kelas, r.kelompok ?? 1])));
  const berkelompok = kelompok.length >= 2;
  const [siswa, setSiswa] = useState(awal?.jumlahSiswa ?? 1);
  const [guru, setGuru] = useState(awal?.jumlahGuru ?? 0);
  const [sekolah, setSekolah] = useState(
    awal?.sekolah ?? { nama: '', npsn: '', jenjang: 'SMA' as const, alamat: '', telepon: '', email: '', kepala_sekolah: '', kepsek_hp: '', bendahara: '', bendahara_hp: '' }
  );
  const [nRombel, setNRombel] = useState(awal?.jumlahRombel ?? 8);
  const [rombel, setRombel] = useState<Record<string, number>>(
    () => Object.fromEntries((awal?.rombel ?? []).map((r) => [`${r.kelas}-${r.rombel}`, r.jumlah]))
  );
  const [termin, setTermin] = useState(
    awal?.termin?.length ? awal.termin : [1, 2, 3, 4].map((u) => ({ urutan: u, tanggal: '', nominal: 0 }))
  );
  const [harga, setHarga] = useState({ siswa: awal?.hargaSiswa ?? 0, guru: awal?.hargaGuru ?? 0 });
  const [lain, setLain] = useState({
    masaMulai: awal?.masaMulai ?? '', masaSelesai: awal?.masaSelesai ?? '',
    sumberDana: awal?.sumberDana ?? 'BOS', sumberDanaLain: awal?.sumberDanaLain ?? '',
    kota: awal?.kota ?? 'Jakarta', tanggalTtd: awal?.tanggalTtd ?? new Date().toISOString().slice(0, 10),
    cat1: awal?.catatan?.find((c) => c.jenis === 'pelaksanaan')?.isi ?? '',
    cat2: awal?.catatan?.find((c) => c.jenis === 'sponsorship')?.isi ?? '',
    namaPm: awal?.namaPm ?? '',
    namaSm: awal?.namaSm ?? '',
    namaRh: awal?.namaRh ?? '',
    permintaanTambahan: awal?.permintaanTambahan ?? false,
    nilaiSponsorship: awal?.nilaiSponsorship ?? 0,
  });

  const pilihan: Pilihan[] = useMemo(
    () => Object.entries(dipilih).map(([id, sesi]) => ({ id, sesi })), [dipilih]);

  const kolomRombel = huruf(nRombel);
  const barisKelas = KELAS[sekolah.jenjang];
  const totalRombel = useMemo(
    () => barisKelas.reduce((a, k) => a + kolomRombel.reduce((b, r) => b + (rombel[`${k}-${r}`] || 0), 0), 0),
    [rombel, barisKelas, kolomRombel]
  );
  // PO berkelompok: selalu dari rombel — jumlah siswa kelompok tidak pernah diketik.
  const nSiswa = totalRombel > 0 ? totalRombel : siswa;

  const h = useMemo(() => hitung(pilihan, nSiswa, guru, komponen, preset),
    [pilihan, nSiswa, guru, komponen, preset]);
  const halangan = useMemo(() => [
    ...langgarMinimum(pilihan, nSiswa, guru, komponen),
    ...langgarKapasitas(pilihan, nSiswa, guru, komponen),
  ], [pilihan, nSiswa, guru, komponen]);

  const lantaiSiswa = h.perSiswa[1] ?? 0;
  const lantaiGuru = h.perGuru[1] ?? 0;
  const hSiswa = harga.siswa || h.perSiswa[0];
  const hGuru = harga.guru || h.perGuru[0];

  // ---------- PO berkelompok ----------
  // Kelas yang belum ditetapkan kelompoknya jatuh ke kelompok pertama, bukan hilang.
  const kelompokKelas = (k: number) => kelasKe[k] ?? kelompok[0]?.nomor ?? 1;
  const komponenKelompok = useMemo(() => [
    ...Object.entries(pilihKe).flatMap(([n, d]) => Object.entries(d).map(([id, sesi]) => ({ id, sesi, kelompok: +n }))),
    ...pilihan.filter((p) => ID_GURU.includes(p.id)).map((p) => ({ ...p, kelompok: 1 })),
  ], [pilihKe, pilihan]);
  const rombelKelompok = useMemo(() => barisKelas.flatMap((k) => kolomRombel.map((r) => ({
    kelas: k, rombel: r, jumlah: rombel[`${k}-${r}`] || 0, kelompok: kelasKe[k] ?? kelompok[0]?.nomor ?? 1,
  }))), [barisKelas, kolomRombel, rombel, kelasKe, kelompok]);
  // Dua lintasan: harga yang dikosongkan memakai Price List kelompoknya sendiri, sama
  // dengan harga siswa pada PO satu kelompok — dan itu baru diketahui sesudah dihitung.
  const hk = useMemo(() => {
    if (!berkelompok) return null;
    const dasar = { komponen: komponenKelompok, rombel: rombelKelompok, jumlahGuru: guru, hargaGuru: hGuru,
      daftar: komponen, daftarPaket: preset };
    const awalHk = hitungPerKelompok({ ...dasar,
      kelompok: kelompok.map((k) => ({ nomor: k.nomor, nama: k.nama, hargaSiswa: k.harga })) });
    // Dicari PER NOMOR, bukan per posisi: hitungPerKelompok mengurutkan hasilnya menurut
    // nomor, sedangkan daftar di layar bisa berurutan lain. Mencocokkan per posisi pernah
    // membuat kartu kelompok 3 menampilkan angka kelompok 2, dan harga yang dikosongkan
    // terisi Price List kelompok lain (temuan QA 12 Sep 2026).
    const listDari = (n: number) => awalHk.kelompok.find((x) => x.nomor === n)?.hitungan.perSiswa[0] || 0;
    return hitungPerKelompok({ ...dasar, kelompok: kelompok.map((k) => ({
      nomor: k.nomor, nama: k.nama, hargaSiswa: k.harga || listDari(k.nomor) })) });
  }, [berkelompok, komponenKelompok, rombelKelompok, guru, hGuru, komponen, preset, kelompok]);
  const labelKelompok = (k: { nama?: string; kelas: number[]; nomor: number }) =>
    k.nama?.trim() || (k.kelas.length ? `Kelas ${k.kelas.join(', ')}` : `Kelompok ${k.nomor}`);

  const grand = hk ? hk.grandTotal : nSiswa * hSiswa + guru * hGuru;
  const totalTermin = termin.reduce((a, t) => a + (t.nominal || 0), 0);

  // Setiap halangan membawa langkah tempat ia diperbaiki (catatan/11). Teks dan urutannya
  // sama dengan sebelum label ada: `rintangan` di bawah tetap daftar pesan yang sama.
  const di = (langkah: KodeLangkah, pesan: string): Halangan => ({ langkah, pesan });
  const halanganSimpan: Halangan[] = hk ? [
    ...hk.masalahBerlangkah,
    ...hk.kelompok.flatMap((k) => {
      const label = labelKelompok(k);
      const pil = komponenKelompok.filter((x) => x.kelompok === k.nomor && !ID_GURU.includes(x.id));
      return [
        ...[...langgarMinimum(pil, k.siswa, 0, komponen), ...langgarKapasitas(pil, k.siswa, 0, komponen)]
          .map((p) => di('paket', `${label}: ${p.pesan}`)),
        ...(k.lantai && k.hargaSiswa < k.lantai
          ? [di('paket', `${label}: harga ${rp(k.hargaSiswa)} di bawah bottom price ${rp(k.lantai)}.`)] : []),
      ];
    }),
    ...halangan.map((p) => di('paket', p.pesan)),
    ...(lantaiGuru && guru > 0 && hGuru < lantaiGuru ? [di('paket', `Harga guru ${rp(hGuru)} di bawah bottom price ${rp(lantaiGuru)}.`)] : []),
    ...(totalTermin > 0 && totalTermin !== grand ? [di('termin', `Total termin ${rp(totalTermin)} tidak sama dengan grand total ${rp(grand)}.`)] : []),
    ...(!!lain.cat2.trim() !== (lain.nilaiSponsorship > 0)
      ? [di('penanda', lain.cat2.trim()
          ? 'Catatan sponsorship sudah diisi, tapi nilainya belum.'
          : 'Nilai sponsorship sudah diisi, tapi catatannya belum.')] : []),
    ...(!sekolah.nama.trim() ? [di('sekolah', 'Nama sekolah belum diisi.')] : []),
    ...(asal === 'unggahan' ? [di('paket', 'PO unggahan belum bisa berkelompok: kertas Form PO hanya punya satu baris siswa.')] : []),
  ] : [
    ...halangan.map((p) => di('paket', p.pesan)),
    // Lantai TIDAK menghalangi penyimpanan PO unggahan: kertasnya sudah ditandatangani,
    // dan menolak mencatatnya tidak membatalkan tanda tangan itu. Lantainya ditegakkan
    // saat PENGAJUAN, tempat pengecualian Head of Operations berlaku — lihat peringatan
    // di bawah, yang muncul justru supaya Sales tahu apa yang menantinya.
    ...(asal !== 'unggahan' && lantaiSiswa && hSiswa < lantaiSiswa
      ? [di('paket', `Harga siswa ${rp(hSiswa)} di bawah bottom price ${rp(lantaiSiswa)}.`)] : []),
    ...(asal !== 'unggahan' && lantaiGuru && guru > 0 && hGuru < lantaiGuru
      ? [di('paket', `Harga guru ${rp(hGuru)} di bawah bottom price ${rp(lantaiGuru)}.`)] : []),
    ...(totalTermin > 0 && totalTermin !== grand ? [di('termin', `Total termin ${rp(totalTermin)} tidak sama dengan grand total ${rp(grand)}.`)] : []),
    ...(!!lain.cat2.trim() !== (lain.nilaiSponsorship > 0)
      ? [di('penanda', lain.cat2.trim()
          ? 'Catatan sponsorship sudah diisi, tapi nilainya belum.'
          : 'Nilai sponsorship sudah diisi, tapi catatannya belum.')] : []),
    ...(!sekolah.nama.trim() ? [di('sekolah', 'Nama sekolah belum diisi.')] : []),
    ...(pilihan.length === 0 ? [di('paket', 'Belum ada komponen yang dicentang.')] : []),
    // Jalur unggah: pindaian dan pernyataan kesesuaian keduanya WAJIB. Pernyataan itu
    // satu-satunya yang menjamin data di sistem mewakili kertas yang ditandatangani -
    // tidak ada mesin yang memeriksanya.
    // Hanya saat MEMBUAT: PO unggahan yang sudah ada sudah punya pindaiannya.
    ...(!awal && asal === 'unggahan' && !pindaian ? [di('cara', 'Pindaian PO belum dipilih.')] : []),
    ...(asal === 'unggahan' && pindaian && !sesuaiPindaian
      ? [di('tinjau', 'Belum menyatakan bahwa data ini sesuai dengan pindaian.')] : []),
  ];
  const rintangan = halanganSimpan.map((h) => h.pesan);

  /**
   * Syarat CETAK, terpisah dari syarat simpan.
   *
   * Draf boleh disimpan setengah jadi — itu gunanya draf. Tapi yang dicetak
   * akan dibawa ke sekolah untuk ditandatangani, dan tiap isian yang kosong
   * tercetak sebagai garis kosong di dokumen. Jadi tombol Cetak menuntut
   * seluruh isian yang muncul di dokumen sudah terisi.
   */
  const halanganCetak: Halangan[] = [
    ...halanganSimpan,
    ...kekuranganPo({
      sekolah, masaMulai: lain.masaMulai, masaSelesai: lain.masaSelesai,
      sumberDana: lain.sumberDana, sumberDanaLain: lain.sumberDanaLain,
      tanggalTtd: lain.tanggalTtd, namaPm: lain.namaPm, namaSm: lain.namaSm,
      namaRh: lain.namaRh, skemaTtd: skema,
      jumlahSiswa: nSiswa, termin, grandTotal: grand,
    // Yang sudah disebut di daftar simpan tidak diulang di daftar cetak.
    }).filter((x) => !rintangan.includes(x.pesan))
      // Tanpa satu pun akun Regional Head, "belum dipilih" menyesatkan: tidak ada yang bisa
      // dipilih. Sebutkan siapa yang bisa membukanya.
      .map((h) => skema === 4 && !akunRh.length && h.pesan === PESAN_TANPA_RH
        ? { ...h, pesan: 'Belum ada akun Regional Head Division. Minta Super Admin memberikan perannya.' } : h),
  ];
  const kurangLengkap = halanganCetak.map((h) => h.pesan);

  // ---------- Konfirmasi per langkah (catatan/17 amandemen 2) ----------
  // Seluruhnya DITURUNKAN dari `sisa`, tanpa state kedua yang bisa menyimpang darinya: langkah
  // yang kuncinya masih menunggu itulah yang menampilkan penanda, dan daftar itu jugalah yang
  // tersimpan bersama draf. Draf yang dibuka lagi tidak punya hasil baca di peramban, tetapi
  // penandanya tetap muncul karena yang dibutuhkan cuma daftar kuncinya.
  const langkahScan = useMemo(() => langkahDari(sisa), [sisa]);
  const kunciLangkah = (k: KodeLangkah) => langkahScan.find((l) => l.langkah === k)?.kunci ?? [];
  const terkunciRisiko = (k: KodeLangkah) => terkunciRisikoLangkah(sisa, k);
  /** Mengonfirmasi langkah membersihkan isian biasanya; centang HP tetap dituntut terpisah. */
  const konfirmasiLangkah = (k: KodeLangkah) =>
    setSisa((s) => sisaSetelahDikonfirmasi(s, k, kunciLangkah(k)));
  const centang = (kunci: string) => setSisa((s) => sisaSetelahDicentang(s, kunci));
  /**
   * Apakah isian ini masih menunggu konfirmasi. Layar memakai INI, bukan `sisa.includes(...)`:
   * kunci yang menuntut centang sendiri disimpan dalam bentuk bertanda (lihat lib/ekstraksi-po.ts),
   * dan perbandingan dengan kunci polos membuat penandanya hilang dari layar.
   */
  const menunggu = (kunci: string) => kunciMenunggu(sisa, kunci);
  const catatanTanpaJenis = catatanScan.filter((c) => c.jenis === null).map((c) => c.isi);
  const langkahTerkunci = langkahScan
    .filter((l) => terkunciRisikoLangkah(sisa, l.langkah).length > 0).map((l) => l.langkah);
  // Gerbang Tinjau: tiga syarat, dan pernyataan "sesuai pindaian" tetap gerbang terakhir.
  const tinjauTerbuka = layakTinjau(sisa, catatanTanpaJenis, langkahTerkunci);

  /**
   * Menuliskan hasil baca ke isian wizard. Tambalannya dihitung fungsi murni (diuji), dan di sini
   * hanya diterapkan: `null` berarti jangan disentuh, jadi model yang tidak membaca sebuah isian
   * tidak menghapus apa pun yang sudah ada.
   */
  function terapkanEkstraksi(h: HasilPetakan) {
    const t = tambalanWizard(h);
    if (Object.keys(t.sekolah).length) setSekolah((s) => ({ ...s, ...t.sekolah }));
    if (t.komponen) setDipilih(Object.fromEntries(t.komponen.map((k) => [k.id, k.sesi || 1])));
    setHarga((x) => ({
      siswa: t.hargaSiswa ?? x.siswa,
      guru: t.hargaGuru ?? x.guru,
    }));
    if (t.rombel.length) {
      setRombel(Object.fromEntries(t.rombel.map((r) => [`${r.kelas}-${r.rombel}`, r.jumlah])));
    }
    if (t.nRombel !== null) setNRombel(Math.min(20, Math.max(1, t.nRombel)));
    if (t.termin.length) {
      setTermin(t.termin.map((x) => ({ urutan: x.urutan, tanggal: x.tanggal ?? '', nominal: x.nominal })));
    }
    setLain((x) => ({
      ...x,
      masaMulai: t.masaMulai ?? x.masaMulai,
      masaSelesai: t.masaSelesai ?? x.masaSelesai,
      kota: t.kota ?? x.kota,
      tanggalTtd: t.tanggalTtd ?? x.tanggalTtd,
      sumberDana: t.sumberDana ?? x.sumberDana,
      sumberDanaLain: t.sumberDanaLain ?? x.sumberDanaLain,
    }));
    setCatatanScan(t.catatan.map((c) => ({ isi: c.isi, jenis: null })));
    // Seluruh isian dari scan (termasuk kedua nomor HP, yang dituntut walau tidak terbaca)
    // mulai sebagai "belum diperiksa".
    setSisa(kunciAwal(h));
  }

  /**
   * Batas atas satu termin: grand total dikurangi termin lain. Mencegah total
   * termin melebihi nilai kerjasama, yang tetap diperiksa lagi di server.
   */
  const sisaUntuk = (i: number) =>
    Math.max(0, grand - termin.reduce((a, t, j) => a + (j === i ? 0 : t.nominal || 0), 0));

  // Mode harga ditentukan oleh ISI, bukan oleh tombol: begitu komponen inti yang
  // dicentang persis sebuah paket, harganya pindah ke harga paket dengan sendirinya.
  const cocok = preset.find((p) => p.n === h.paket);

  // Sisi tajamnya: melepas SATU komponen membuat susunannya bukan paket lagi, dan
  // lantainya bisa melompat naik puluhan ribu meski komponen yang dilepas murah.
  // Jadi kalau tinggal satu komponen lagi menuju sebuah paket, katakan — berikut
  // selisih lantainya, karena itu yang paling terasa buat Sales.
  const inti = pilihan.filter((x) => komponen.find((k) => k.id === x.id)?.g === 'core').map((x) => x.id);

  // Penghematan paket DIHITUNG dari harga komponennya, tidak pernah dijanjikan begitu
  // saja: per 4 Sep 2026 ada tiga paket yang justru LEBIH MAHAL daripada isinya, dan
  // menuliskan "lebih murah" di sana berarti Sales mengulanginya ke sekolah. Kalimatnya
  // muncul hanya kalau angkanya memang membuktikannya — dan muncul sendiri begitu
  // harga paketnya diperbaiki.
  const hematPaket = cocok
    ? cocok.ids.reduce((a, id) => a + (komponen.find((k) => k.id === id)?.p[0] ?? 0), 0) - cocok.p[0]
    : 0;
  const hampir = cocok || inti.length === 0 ? null : preset
    .filter((p) => p.ids.length === inti.length + 1 && inti.every((id) => p.ids.includes(id)))
    .map((p) => ({
      p,
      kurang: komponen.find((k) => k.id === p.ids.find((id) => !inti.includes(id)))!,
      hemat: h.perSiswa[1] - p.p[1],
    }))
    .sort((a, b) => b.hemat - a.hemat)[0] ?? null;

  const html = useMemo(() => {
    const pakai = (g: boolean) => h.rincian.filter((r) => r.untukGuru === g)
      .map((r) => r.nama + (r.perSesi && r.sesi > 1 ? ` \u00d7${r.sesi} sesi` : ''));
    return dokumenPo({
      sekolah,
      rincianSiswa: pakai(false),
      rincianGuru: pakai(true),
      jumlahSiswa: nSiswa, jumlahGuru: guru,
      hargaSiswa: hSiswa, hargaGuru: hGuru,
      masaMulai: lain.masaMulai, masaSelesai: lain.masaSelesai,
      sumberDana: lain.sumberDana, sumberDanaLain: lain.sumberDanaLain,
      kota: lain.kota, tanggalTtd: lain.tanggalTtd,
      namaPm: lain.namaPm, namaSm: lain.namaSm,
      ...(skema === 4 ? { skemaTtd: 4 as const, namaRh: lain.namaRh } : {}),
      kelas: barisKelas, kolomRombel, rombel,
      termin, catatan: { pelaksanaan: lain.cat1, sponsorship: lain.cat2 },
      nilaiSponsorship: lain.nilaiSponsorship || undefined,
      ...(hk ? { kelompok: hk.kelompok.map((k) => ({
        nama: labelKelompok(k), siswa: k.siswa, harga: k.hargaSiswa,
        rincian: k.hitungan.rincian.map((r) => r.nama + (r.perSesi && r.sesi > 1 ? ` \u00d7${r.sesi} sesi` : '')),
      })) } : {}),
    });
    // labelKelompok bergantung pada data yang sudah ada di hk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sekolah, h.rincian, nSiswa, guru, hSiswa, hGuru, lain, barisKelas, kolomRombel, rombel, termin, hk, skema]);

  // Satu penangan untuk dua pemilih berkas: saat membuat PO, dan saat mengganti
  // pindaian PO unggahan yang disunting.
  function pilihPindaian(e: { target: HTMLInputElement }) {
    const b = e.target.files?.[0] ?? null;
    setSesuaiPindaian(false);   // berkas berganti, pernyataan lama batal
    if (b && b.size > 15 * 1024 * 1024) {
      setPesan({ baik: false, isi: [
        `Pindaian ini ${(b.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB, `
        + 'sedangkan batasnya 15 MB. Pindai ulang pada 200 dpi hitam-putih, '
        + 'atau kompres PDF-nya, lalu pilih lagi.',
      ] });
      setPindaian(null);
      return;
    }
    setPindaian(b);
  }

  // ponytail: disusun tiap render, murah; tandanya string, jadi efek di bawah hanya
  // jalan bila isinya betul berubah.
  const isiSekarang: IsiPo = susunIsiPo({
    awalId: awal?.id, adaAwal: !!awal, pindaian: !!pindaian, sekolah, pilihan,
    kelompok: hk ? hk.kelompok.map((k) => ({ nomor: k.nomor, nama: k.nama, hargaSiswa: k.hargaSiswa })) : null,
    komponenKelompok, nomorKelompok: kelompok.map((k) => k.nomor),
    nSiswa, guru, hSiswa, hGuru, lain, nRombel, barisKelas, kolomRombel, rombel,
    kelompokKelas, termin, asal, formKertasLama,
    // Status konfirmasi ikut tersimpan (amandemen 2 butir 5) supaya membuka ulang draf tidak
    // menuntut ulang yang sudah. Kosong berarti kolomnya dikosongkan di basis data.
    ekstraksiMenunggu: sisa,
    // Hanya catatan yang JENISNYA sudah dipilih Sales yang ikut tersimpan; yang belum dipilih
    // tidak dilabeli paksa (aturan 1), dan Tinjau tetap terkunci karenanya.
    catatanScan: catatanScan
      .filter((c): c is { isi: string; jenis: 'pelaksanaan' | 'sponsorship' } => c.jenis !== null)
      .map((c) => ({ jenis: c.jenis, isi: c.isi })),
  });

  // Pernyataan kesesuaian berlaku untuk isi SAAT dicentang. Di wizard Sales bisa
  // mencentang di Tinjau lalu kembali menyunting langkah lain, jadi setiap perubahan
  // isi membatalkannya (catatan/11). Ganti pindaian sudah dibatalkan di pilihPindaian.
  const tandaIsi = JSON.stringify({ ...isiSekarang, pindaianBaru: undefined });
  const tandaSaatDicentang = useRef<string | null>(null);
  useEffect(() => {
    if (!sesuaiPindaian) { tandaSaatDicentang.current = null; return; }
    if (tandaSaatDicentang.current === null) { tandaSaatDicentang.current = tandaIsi; return; }
    if (tandaSaatDicentang.current !== tandaIsi) {
      setSesuaiPindaian(false);
      setPesan({ baik: false, isi: [
        'Isi PO berubah, jadi pernyataan kesesuaian dibatalkan. Centang lagi di langkah Tinjau bila masih sesuai dengan pindaian.',
      ] });
    }
  }, [sesuaiPindaian, tandaIsi]);

  function simpan() {
    setPesan(null);
    const isi = isiSekarang;
    mulaiKirim(async () => {
      const hasil = await simpanDraf(isi);
      if (!hasil.ok) return setPesan({ baik: false, isi: hasil.galat });

      // Pindaian baru bisa naik SESUDAH PO ada: kebijakan penyimpanan memakai id PO
      // sebagai awalan nama berkas, dan hanya mengizinkan tulis selagi PO masih draf.
      if (asal === 'unggahan' && pindaian) {
        const jalur = `${hasil.id}/po.pdf`;
        const fd = new FormData();
        fd.append('bucket', 'po-unggahan');
        fd.append('jalur', jalur);
        fd.append('berkas', pindaian);

        const res = await unggahBerkasAksi(fd);
        if (!res.ok) {
          return setPesan({ baik: false, isi: [
            `Draf tersimpan, tetapi pindaiannya gagal diunggah: ${res.galat}`,
            'Buka drafnya lalu unggah ulang pindaiannya.',
          ] });
        }
        const c = await catatUnggahanPo(hasil.id, jalur);
        if (!c.ok) return setPesan({ baik: false, isi: [c.galat ?? 'Gagal mencatat pindaian.'] });
        setVersiTersimpan((v) => v + 1);   // ambil tautan baru untuk pindaian pengganti
      }

      // Hasil baca AI ditautkan SESUDAH draf dan pindaiannya ada (catatan/17 amandemen 3).
      // Gagal menautkan TIDAK menghalangi Sales menyimpan: PO-nya tetap draf yang bisa diketik
      // penuh, dan yang hilang hanya penanda "dibaca AI"-nya -- yang memang lebih baik hilang
      // daripada salah: penanda yang terpasang tanpa hasil baca akan mengaku-aku.
      if (asal === 'unggahan' && klaimId) {
        const t = await tautkanEkstraksi(klaimId, hasil.id);
        if (!t.ok) setPesan({ baik: false, isi: [t.galat ?? 'Hasil pembacaan tidak tertaut.'] });
      }

      // Konfirmasi dicatat SESUDAH pindaiannya ada — menyatakan "sesuai dengan
      // pindaian" saat pindaiannya belum tersimpan tidak bermakna apa-apa. Saat
      // menyunting, pindaian yang dimaksud boleh yang sudah tersimpan.
      if (asal === 'unggahan' && sesuaiPindaian) {
        const k = await konfirmasiTinjauan(hasil.id);
        if (!k.ok) return setPesan({ baik: false, isi: [k.galat ?? 'Gagal mencatat konfirmasi.'] });
      }

      // Formulirnya tetap terpasang sesudah pindah ke halaman PO yang sama. Tanpa ini
      // simpan berikutnya mengunggah ulang berkas yang sama dan menyatakan ulang
      // kesesuaiannya tanpa dicentang lagi.
      setPindaian(null);
      setSesuaiPindaian(false);
      setPesan({ baik: true, isi: ['Draf tersimpan. Membuka…'] });
      router.push(`/po/${hasil.id}?baru=1`);
      router.refresh();
    });
  }

  const barisFitur = pemilih(dipilih, setDipilih);
  const ubahKelompok = (n: number): Ubah => (f) => setPilihKe((o) => ({ ...o, [n]: f(o[n] ?? {}) }));

  /** Satu kelompok -> dua. Isi yang sudah ada menjadi Kelompok 1; guru tetap di tingkat PO. */
  function pisah() {
    setPilihKe({ 1: Object.fromEntries(Object.entries(dipilih).filter(([id]) => !ID_GURU.includes(id))), 2: {} });
    setDipilih((d) => Object.fromEntries(Object.entries(d).filter(([id]) => ID_GURU.includes(id))));
    setKelompok([{ nomor: 1, nama: '', harga: harga.siswa }, { nomor: 2, nama: '', harga: 0 }]);
    setKelasKe(Object.fromEntries(barisKelas.map((k) => [k, 1])));
  }
  function tambahKelompok() {
    const n = [1, 2, 3, 4, 5, 6].find((x) => !kelompok.some((k) => k.nomor === x));
    if (n) setKelompok([...kelompok, { nomor: n, nama: '', harga: 0 }].sort((a, b) => a.nomor - b.nomor));
  }
  /** Kelasnya pindah ke kelompok pertama yang tersisa. Tinggal satu = kembali satu kelompok. */
  function hapusKelompok(n: number) {
    const sisa = kelompok.filter((k) => k.nomor !== n);
    const tujuan = sisa[0].nomor;
    setKelasKe((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === n ? tujuan : v])));
    if (sisa.length > 1) {
      setKelompok(sisa);
      setPilihKe((o) => { const b = { ...o }; delete b[n]; return b; });
      return;
    }
    setDipilih((d) => ({ ...d, ...(pilihKe[tujuan] ?? {}) }));
    setHarga((h) => ({ ...h, siswa: sisa[0].harga }));
    setKelompok([]);
    setPilihKe({});
  }

  return {
    halanganSimpan,
    halanganCetak,
    komponen,
    preset,
    namaTier,
    awal,
    sekolahTerkunci,
    berkasUnggahan,
    akunPm,
    akunSm,
    akunRh,
    gerbangEkstraksi,
    ekstraksi,
    klaimId,
    pemberitahuanAi,
    setPemberitahuanAi,
    pasangEkstraksi: (id: string, hasil: unknown) => {
      const h = petakanEkstraksi(hasil, {
        // Himpunan ids paket datang dari preset yang SUDAH dipotong Acquisition untuk peran ini.
        // Modul pemetaannya sendiri sengaja tidak mengimpor pricelist.
        idsPaket: (nama) => preset.find((p) => p.n === nama)?.ids ?? null,
      });
      setKlaimId(id);
      setEkstraksi(h);
      // Pemetaan yang benar tetapi tidak pernah DITULISKAN ke isian adalah fitur yang tidak ada:
      // layar tetap kosong walau modelnya membaca semuanya. Inilah langkah yang menuliskannya.
      terapkanEkstraksi(h);
    },
    langkahScan,
    kunciLangkah,
    terkunciRisiko,
    konfirmasiLangkah,
    centang,
    menunggu,
    sisa,
    catatanScan,
    setCatatanScan,
    catatanTanpaJenis,
    langkahTerkunci,
    tinjauTerbuka,
    skema,
    formKertasLama,
    setFormKertasLama,
    router,
    kirim,
    mulaiKirim,
    asal,
    setAsal,
    pindaian,
    setPindaian,
    pratinjau,
    setPratinjau,
    sesuaiPindaian,
    setSesuaiPindaian,
    pratinjauTersimpan,
    setPratinjauTersimpan,
    versiTersimpan,
    setVersiTersimpan,
    pesan,
    setPesan,
    awalBerkelompok,
    dipilih,
    setDipilih,
    kelompok,
    setKelompok,
    pilihKe,
    setPilihKe,
    kelasKe,
    setKelasKe,
    berkelompok,
    siswa,
    setSiswa,
    guru,
    setGuru,
    sekolah,
    setSekolah,
    nRombel,
    setNRombel,
    rombel,
    setRombel,
    termin,
    setTermin,
    harga,
    setHarga,
    lain,
    setLain,
    pilihan,
    kolomRombel,
    barisKelas,
    totalRombel,
    nSiswa,
    h,
    halangan,
    lantaiSiswa,
    lantaiGuru,
    hSiswa,
    hGuru,
    kelompokKelas,
    komponenKelompok,
    rombelKelompok,
    hk,
    labelKelompok,
    grand,
    totalTermin,
    rintangan,
    kurangLengkap,
    sisaUntuk,
    cocok,
    inti,
    hematPaket,
    hampir,
    html,
    pilihPindaian,
    simpan,
    barisFitur,
    ubahKelompok,
    pisah,
    tambahKelompok,
    hapusKelompok,
  };
}
