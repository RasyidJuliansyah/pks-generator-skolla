/**
 * Pemetaan hasil baca AI ke isian wizard (catatan/17, amandemen 2 dan 3).
 *
 * SENGAJA tidak mengimpor lib/pricelist.ts: modul ini jalan di peramban, dan pricelist memuat
 * harga Acquisition. Himpunan ids sebuah paket disuntikkan pemanggil lewat `idsPaket`, jadi
 * modul ini tetap murni dan teruji tanpa membawa satu pun angka harga.
 *
 * Kaidah yang dijaga di sini (catatan/17 "Aturan pengisian"):
 *   - nilai tidak sah DIBUANG, tidak ditebak;
 *   - jenis catatan selalu kosong, Sales yang memilih;
 *   - nilai sponsorship tidak pernah diisi dari scan;
 *   - nomor HP selalu wajib dicentang, ditandai ragu atau tidak.
 */
import { KELAS } from './kelas';
import type { KodeLangkah } from './langkah-po';

/** Bentuk JSON yang diminta dari model. Semua bidang opsional: hasil baca boleh tidak lengkap. */
export type IsianScan = {
  sekolah?: Partial<Record<
    'nama' | 'npsn' | 'jenjang' | 'alamat' | 'telepon' | 'email'
    | 'kepala_sekolah' | 'kepsek_hp' | 'bendahara' | 'bendahara_hp', string>>;
  kotak_paket?: string[];
  kotak_lain?: string[];
  custom_teks?: string | null;
  harga_siswa?: number;
  harga_guru?: number;
  rombel?: { kelas?: string; rombel?: string; jumlah?: number }[];
  termin?: { tanggal?: string; nominal?: number }[];
  masa_mulai?: string;
  masa_selesai?: string;
  sumber_dana?: string;
  kota?: string;
  tanggal_ttd?: string;
  catatan?: string[];
  ragu?: string[];
  tidak_terbaca?: string[];
  peringatan?: string[];
};

export type HasilPetakan = {
  sekolah: Record<string, string>;
  /** null = tidak ada komponen yang boleh diisi dari kotak; alasannya di catatanPaket. */
  komponen: { id: string; sesi: number }[] | null;
  catatanPaket: string | null;
  harga: { siswa: number | null; guru: number | null };
  rombel: { kelas: number; rombel: string; jumlah: number }[];
  /** Bila kolom rombel di kertas lebih banyak dari bawaan wizard. */
  nRombel: number | null;
  termin: { urutan: number; tanggal: string | null; nominal: number }[];
  lain: {
    masaMulai: string | null; masaSelesai: string | null; sumberDana: string | null;
    kota: string | null; tanggalTtd: string | null;
    nilaiSponsorship?: undefined;
  };
  /** Isi catatan dari scan. JENISNYA selalu kosong: Sales yang memilih (aturan 1). */
  catatan: { isi: string; jenis: null }[];
  ragu: string[];
  tidakTerbaca: string[];
  peringatan: string[];
  /** Semua kunci isian yang datang dari scan, termasuk yang nilainya kosong. */
  dariScan: string[];
};

/** Kotak paket di kertas Form PO yang mengisi komponen (catatan/17). Nama = nama PRESET. */
export const KOTAK_PAKET = ['LMS Lite', 'LMS Smart', 'LMS Juara', 'Asesmen Psikologi'] as const;

/** Selalu dituntut centangnya, ditandai ragu atau tidak (catatan/17 aturan 4). */
export const HP_KEYS = ['sekolah.kepsek_hp', 'sekolah.bendahara_hp'] as const;

/**
 * Awalan di dalam `sisa` untuk isian yang menuntut centang SENDIRI, bukan sekadar tombol langkah:
 * nomor HP, isian yang ditandai ragu, dan isian yang tidak terbaca (catatan/17 amandemen 2
 * butir 2). Dibedakan DI DALAM kolom yang sudah ada, bukan di kolom baru, supaya keadaannya ikut
 * tersimpan dan tetap terbaca saat draf dibuka lagi -- di sana hasil baca sudah tidak ada, jadi
 * "kunci mana yang menuntut centang" tidak bisa dihitung ulang dari apa pun.
 */
export const PENANDA_WAJIB = 'wajib:';

/** Kunci apa adanya untuk ditampilkan (tanpa awalan penanda). */
export const kunciTampil = (k: string) =>
  k.startsWith(PENANDA_WAJIB) ? k.slice(PENANDA_WAJIB.length) : k;

const tandaiWajib = (k: string) => PENANDA_WAJIB + k;

const KUNCI_LANGKAH: { langkah: KodeLangkah; kunci: string[] }[] = [
  { langkah: 'sekolah', kunci: ['sekolah.nama', 'sekolah.npsn', 'sekolah.jenjang', 'sekolah.alamat',
      'sekolah.telepon', 'sekolah.email', 'sekolah.kepala_sekolah', 'sekolah.kepsek_hp',
      'sekolah.bendahara', 'sekolah.bendahara_hp'] },
  { langkah: 'paket', kunci: ['komponen', 'harga.siswa', 'harga.guru'] },
  { langkah: 'rombel', kunci: ['rombel'] },
  { langkah: 'termin', kunci: ['termin', 'masa.mulai', 'masa.selesai', 'sumberDana'] },
  { langkah: 'penanda', kunci: ['kota', 'tanggalTtd', 'catatan'] },
];

const ROMAWI: Record<string, number> = { X: 10, XI: 11, XII: 12 };

/**
 * Kunci yang dikenal salah satu langkah wizard. Kunci di luar ini tidak punya isian di form,
 * jadi menuntut konfirmasinya mustahil dipenuhi.
 */
const KUNCI_DIKENAL = new Set(KUNCI_LANGKAH.flatMap((l) => l.kunci));

/**
 * Nama isian seperti yang terbaca Sales. Pesan yang menyuruhnya memeriksa sesuatu yang tidak ia
 * kenali ("sekolah.kepsek_hp") hanya membuatnya menebak.
 */
export const LABEL_KUNCI: Record<string, string> = {
  'sekolah.nama': 'nama sekolah', 'sekolah.npsn': 'NPSN', 'sekolah.jenjang': 'jenjang',
  'sekolah.alamat': 'alamat sekolah', 'sekolah.telepon': 'telepon sekolah',
  'sekolah.email': 'email sekolah', 'sekolah.kepala_sekolah': 'nama kepala sekolah',
  'sekolah.kepsek_hp': 'nomor HP kepala sekolah', 'sekolah.bendahara': 'nama bendahara',
  'sekolah.bendahara_hp': 'nomor HP bendahara', komponen: 'komponen paket',
  'harga.siswa': 'harga per siswa', 'harga.guru': 'harga per guru', rombel: 'tabel rombel',
  termin: 'termin pembayaran', 'masa.mulai': 'masa aktif mulai', 'masa.selesai': 'masa aktif selesai',
  sumberDana: 'sumber dana', kota: 'kota', tanggalTtd: 'tanggal tanda tangan', catatan: 'catatan',
};

/** Nama isian untuk pesan ke Sales; kunci yang tidak dikenal tampil apa adanya. */
export const labelKunci = (k: string) => LABEL_KUNCI[kunciTampil(k)] ?? kunciTampil(k);

/**
 * Apakah sebuah isian masih menunggu konfirmasi, dalam bentuk bertanda MAUPUN polos.
 *
 * Dipakai layar untuk menempelkan penanda pada isiannya. Bentuk penyimpanan (bertanda atau tidak)
 * adalah urusan dalam modul ini; pemanggil tidak boleh perlu tahu, dan versi pertama penanda ini
 * sempat membuat penanda "dari scan, periksa" hilang dari layar karena membandingkan kunci polos
 * dengan daftar yang sudah bertanda.
 */
export const kunciMenunggu = (sisa: string[], kunci: string) =>
  sisa.includes(kunci) || sisa.includes(tandaiWajib(kunci));

/** Label kelas di kertas -> angka kelas jenjang. "X"/"10" -> 10; label asing -> null. */
export function kelasDari(label: string, jenjang: string): number | null {
  const ada = KELAS[jenjang];
  if (!ada) return null;
  const t = label.trim().toUpperCase().replace(/[\s-]/g, '');
  const angka = /^\d+$/.test(t) ? Number(t) : ROMAWI[t] ?? null;
  // `includes`, BUKAN `in`: `in` pada larik menguji KUNCI larik itu (indeks), jadi `10 in [10,11,12]`
  // bernilai salah dan seluruh rombel SMA hilang -- sementara `6 in [1,2,3,4,5,6]` juga salah
  // karena lariknya hanya berindeks 0..5, sehingga kelas 6 SD ikut lenyap.
  return angka !== null && ada.includes(angka) ? angka : null;
}

const hurufKe = (h: string): number | null => {
  const t = h.trim().toUpperCase();
  return /^[A-H]$/.test(t) ? t.charCodeAt(0) - 64 : null;
};

/** Tanggal ISO yang masuk akal; selain itu dibuang (catatan/17 aturan 6). */
const tanggalSah = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  const t = v.trim();
  const d = new Date(t + 'T00:00:00Z');
  if (Number.isNaN(+d)) return null;
  // Peramban TIDAK menolak tanggal yang harinya tidak ada: '2026-02-30' digeser diam-diam jadi
  // 2 Maret. Pada dokumen kontrak, tanggal yang bergeser dua hari lebih buruk daripada tanggal
  // kosong -- ia lolos ke PKS dan ke gerbang masa aktif -- jadi hasilnya diputar balik dan
  // dicocokkan dengan masukannya.
  return d.toISOString().slice(0, 10) === t ? t : null;
};

const angkaSah = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null;
  // String diterima HANYA bila ia memang angka polos. "350.000" tidak diterima: Number()
  // membacanya 350, dan nominal yang salah seratus kali lebih buruk daripada nominal kosong
  // (aturan 6: nilai tidak sah dibuang, tidak ditebak). Temuan QA.
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
};

const teksSah = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

const daftarTeks = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function petakanEkstraksi(
  m: unknown,
  p: { idsPaket: (nama: string) => string[] | null },
): HasilPetakan {
  const s = (typeof m === 'object' && m !== null ? m : {}) as IsianScan;
  const sekolahMasuk = (typeof s.sekolah === 'object' && s.sekolah !== null ? s.sekolah : {}) as Record<string, unknown>;
  const ragu = daftarTeks(s.ragu);
  const tidakTerbaca = daftarTeks(s.tidak_terbaca);
  const peringatan = daftarTeks(s.peringatan);
  const dariScan: string[] = [];

  // --- Sekolah ---
  const sekolah: Record<string, string> = {};
  for (const k of ['nama', 'npsn', 'alamat', 'telepon', 'email', 'kepala_sekolah',
                   'kepsek_hp', 'bendahara', 'bendahara_hp'] as const) {
    const t = teksSah(sekolahMasuk[k]);
    if (t !== null) { sekolah[k] = t; dariScan.push(`sekolah.${k}`); }
  }
  const jenjangKertas = teksSah(sekolahMasuk.jenjang);
  const jenjang = jenjangKertas && KELAS[jenjangKertas.toUpperCase()]
    ? jenjangKertas.toUpperCase() : null;
  if (jenjang) { sekolah.jenjang = jenjang; dariScan.push('sekolah.jenjang'); }
  else if (jenjangKertas) { tidakTerbaca.push('sekolah.jenjang'); dariScan.push('sekolah.jenjang'); }

  // --- Kotak paket ---
  // HANYA satu kotak JELAS yang dicentang yang mengisi komponen. Lebih dari satu, atau nama
  // yang tidak dikenal, berarti kertasnya ambigu: komponen dibiarkan kosong dan semuanya
  // tampil sebagai catatan supaya Sales memutuskan (catatan/17 "Kotak paket").
  const kotak = daftarTeks(s.kotak_paket);
  const jelas = kotak.filter((k) => KOTAK_PAKET.includes(k as (typeof KOTAK_PAKET)[number]));
  let komponen: HasilPetakan['komponen'] = null;
  let catatanPaket: string | null = null;
  if (kotak.length === 1 && jelas.length === 1) {
    const ids = p.idsPaket(jelas[0]);
    if (ids && ids.length) {
      komponen = ids.map((id) => ({ id, sesi: 0 }));
      dariScan.push('komponen');
    } else {
      catatanPaket = `Scan: ${jelas[0]} dicentang, tapi komposisinya tidak dikenali sistem`;
    }
  }
  const lainLabel = daftarTeks(s.kotak_lain);
  const custom = teksSah(s.custom_teks);
  const potonganCatatan = [
    ...kotak,
    ...lainLabel.map((k) => `${k} dicentang`),
    ...(custom ? [`Custom: ${custom}`] : []),
  ];
  if (komponen === null && potonganCatatan.length) {
    catatanPaket = `Scan: ${potonganCatatan.join(', ')}`;
    dariScan.push('komponen');
  }

  // --- Harga ---
  const hargaSiswa = angkaSah(s.harga_siswa);
  const hargaGuru = angkaSah(s.harga_guru);
  if (hargaSiswa !== null) dariScan.push('harga.siswa');
  if (hargaGuru !== null) dariScan.push('harga.guru');

  // --- Rombel ---
  const rombel: HasilPetakan['rombel'] = [];
  let nRombel: number | null = null;
  for (const r of Array.isArray(s.rombel) ? s.rombel : []) {
    const kelas = jenjang ? kelasDari(String(r?.kelas ?? ''), jenjang) : null;
    const kolom = hurufKe(String(r?.rombel ?? ''));
    const jumlah = angkaSah(r?.jumlah);
    if (kelas === null || kolom === null || jumlah === null) { tidakTerbaca.push('rombel'); continue; }
    rombel.push({ kelas, rombel: String.fromCharCode(64 + kolom), jumlah });
    nRombel = Math.max(nRombel ?? 0, kolom);
  }
  if (rombel.length) dariScan.push('rombel');

  // --- Termin ---
  const termin: HasilPetakan['termin'] = [];
  for (const t of Array.isArray(s.termin) ? s.termin : []) {
    const nominal = angkaSah(t?.nominal);
    const tanggal = tanggalSah(t?.tanggal);
    if (nominal === null && tanggal === null) { tidakTerbaca.push('termin'); continue; }
    termin.push({ urutan: termin.length + 1, tanggal, nominal: nominal ?? 0 });
  }
  if (termin.length) dariScan.push('termin');

  // --- Masa aktif, sumber dana, kota, tanggal tanda tangan ---
  const masaMulai = tanggalSah(s.masa_mulai);
  const masaSelesai = tanggalSah(s.masa_selesai);
  if (masaMulai) dariScan.push('masa.mulai');
  if (masaSelesai) dariScan.push('masa.selesai');
  const sumberDana = teksSah(s.sumber_dana);
  if (sumberDana) dariScan.push('sumberDana');
  const kota = teksSah(s.kota);
  if (kota) dariScan.push('kota');
  const tanggalTtd = tanggalSah(s.tanggal_ttd);
  if (tanggalTtd) dariScan.push('tanggalTtd');

  // Peringatan turunan: model sendiri sudah menandai tanggal selesai yang mendahului mulai
  // (diuji 17 Sep), tetapi kalau ia lupa, layarnya tetap memberi tahu.
  if (masaMulai && masaSelesai && masaSelesai <= masaMulai) {
    peringatan.push('Tanggal selesai tidak sesudah tanggal mulai.');
  }

  // --- Catatan: isinya diisi, JENISNYA selalu kosong ---
  const isiCatatan = daftarTeks(s.catatan).map((isi) => isi.trim()).filter(Boolean);
  const catatan = isiCatatan.map((isi) => ({ isi, jenis: null as null }));
  if (catatan.length) dariScan.push('catatan');

  // Isian yang ditandai ragu atau tidak terbaca ikut ditagih walau nilainya ada. Kunci yang
  // TIDAK dikenal satu langkah pun DIBUANG dari daftar tuntutan dan dipindahkan ke peringatan:
  // kunci seperti itu tidak akan pernah bisa dibersihkan siapa pun, dan SATU kunci saja mengunci
  // Tinjau selamanya lalu membuat drafnya tidak bisa disimpan (temuan QA). Model tidak pernah
  // dijanjikan bahwa kunci ragu harus berbentuk `sekolah.*`, jadi ini harus tahan terhadapnya.
  for (const k of [...ragu, ...tidakTerbaca]) {
    if (dariScan.includes(k)) continue;
    if (KUNCI_DIKENAL.has(k)) dariScan.push(k);
    else peringatan.push(`Model menandai "${k}", yang tidak punya isian di form ini. Periksa sendiri di pindaian.`);
  }

  return {
    sekolah, komponen, catatanPaket,
    harga: { siswa: hargaSiswa, guru: hargaGuru },
    rombel, nRombel, termin,
    lain: { masaMulai, masaSelesai, sumberDana, kota, tanggalTtd },
    catatan,
    ragu, tidakTerbaca, peringatan,
    dariScan: [...new Set(dariScan)],
  };
}

/**
 * Isian yang wajib dicentang satu per satu sebelum langkahnya boleh dikonfirmasi: nomor HP selalu,
 * ditambah isian yang ditandai ragu atau tidak terbaca -- TETAPI hanya yang punya isian di form.
 * Kunci asing yang lolos ke sini tidak akan pernah bisa dicentang siapa pun, dan satu kunci saja
 * mengunci Tinjau selamanya (temuan QA).
 */
export function wajibDicentang(h: HasilPetakan): string[] {
  const set = new Set<string>([...HP_KEYS]);
  for (const k of [...h.ragu, ...h.tidakTerbaca]) if (KUNCI_DIKENAL.has(k)) set.add(k);
  return [...set];
}

/** Lima langkah wizard yang memuat isian dari scan, urut wizard. */
export function langkahIsian(h: HasilPetakan): { langkah: KodeLangkah; kunci: string[] }[] {
  return KUNCI_LANGKAH
    .map((l) => ({ langkah: l.langkah, kunci: l.kunci.filter((k) => h.dariScan.includes(k)) }))
    .filter((l) => l.kunci.length > 0);
}

/** Seluruh kunci isian sebuah langkah, tanpa perlu hasil baca. */
export function kunciLangkah(k: KodeLangkah): string[] {
  return KUNCI_LANGKAH.find((l) => l.langkah === k)?.kunci ?? [];
}

/**
 * Kunci yang menunggu konfirmasi Sales SESUDAH sebuah scan dibaca.
 *
 * `dariScan` saja tidak cukup: nomor HP selalu dituntut walau model tidak mengembalikannya sama
 * sekali (catatan/17 aturan 4), jadi himpunannya digabung dengan `wajibDicentang`. Yang menuntut
 * centang SENDIRI ditandai `PENANDA_WAJIB`, karena tombol langkah tidak boleh membersihkannya.
 */
export function kunciAwal(h: HasilPetakan): string[] {
  const wajib = new Set<string>(wajibDicentang(h));
  return [...new Set([...h.dariScan, ...wajib])]
    .map((k) => (wajib.has(k) ? tandaiWajib(k) : k));
}

/**
 * Kunci yang masih menunggu, dikelompokkan per langkah wizard.
 *
 * Diturunkan dari DAFTARNYA, bukan dari hasil baca: draf yang dibuka lagi tidak punya hasil baca
 * di peramban (yang tersimpan hanya `po.ekstraksi_menunggu`), dan menuntut hasil baca untuk tahu
 * langkah mana yang tersisa berarti penanda konfirmasinya hilang justru saat paling dibutuhkan.
 */
export function langkahDari(sisa: string[]): { langkah: KodeLangkah; kunci: string[] }[] {
  const ada = (k: string) => sisa.includes(k) || sisa.includes(tandaiWajib(k));
  return KUNCI_LANGKAH
    .map((l) => ({ langkah: l.langkah, kunci: l.kunci.filter(ada) }))
    .filter((l) => l.kunci.length > 0);
}

/** Sisa setelah satu isian berisiko dicentang (catatan/17 amandemen 2 butir 2). */
export const sisaSetelahDicentang = (sisa: string[], kunci: string): string[] =>
  sisa.filter((k) => k !== kunci && k !== tandaiWajib(kunci));

/**
 * Isian di sebuah langkah yang menuntut centang SENDIRI dan belum dicentang; tombol langkahnya
 * mati selama ini terisi. Nomor HP selalu termasuk (aturan 4), begitu pula isian yang ditandai
 * ragu atau tidak terbaca (amandemen 2 butir 2) -- itu sebabnya penandanya disimpan, bukan
 * dihitung dari hasil baca yang sudah tidak ada lagi.
 */
export function terkunciRisiko(sisa: string[], langkah: KodeLangkah): string[] {
  return kunciLangkah(langkah).filter((k) =>
    sisa.includes(tandaiWajib(k))
    || ((HP_KEYS as readonly string[]).includes(k) && sisa.includes(k)));
}

/**
 * Sisa setelah sebuah langkah dikonfirmasi. Dua hal yang TIDAK ikut hilang:
 *   - isian berisiko (`wajib:`), apa pun jenisnya, karena tuntutan centangnya berdiri sendiri
 *     (amandemen 2 butir 2 dan 3);
 *   - kunci yang tidak dimiliki langkah ini.
 * Kunci HP polos (tanpa penanda) juga tetap tinggal, supaya daftar yang tersimpan dari versi
 * sebelum penanda ada tidak kehilangan tuntutannya.
 */
export function sisaSetelahDikonfirmasi(
  sisa: string[], langkah: KodeLangkah, kunciLangkahIni: string[],
): string[] {
  return sisa.filter((k) => !(
    kunciLangkahIni.includes(k) && !(HP_KEYS as readonly string[]).includes(k)
  ));
}

/**
 * Tinjau hanya boleh dibuka bila tidak ada sisa konfirmasi, setiap catatan dari scan sudah
 * berjenis, dan tidak ada langkah yang terkunci (amandemen 2 butir 4).
 */
export function layakTinjau(
  sisa: string[], catatanTanpaJenis: string[], langkahTerkunci: KodeLangkah[],
): boolean {
  return sisa.length === 0 && catatanTanpaJenis.length === 0 && langkahTerkunci.length === 0;
}

/**
 * Isian wizard yang HARUS diubah oleh hasil baca, sebagai DATA.
 *
 * Ditulis sebagai data, bukan sebagai deretan pemanggilan setState di hook, supaya bisa diuji:
 * pemetaan yang benar tetapi tidak pernah dituliskan ke isian adalah fitur yang tidak ada --
 * dan itu persis yang terjadi sebelum ini (hasil baca tersimpan di state, layarnya kosong).
 * `null` berarti JANGAN disentuh, bukan "kosongkan": model yang tidak membaca sebuah isian tidak
 * boleh menghapus apa yang sudah ada.
 */
export type TambalanWizard = {
  sekolah: Record<string, string>;
  komponen: { id: string; sesi: number }[] | null;
  hargaSiswa: number | null;
  hargaGuru: number | null;
  rombel: { kelas: number; rombel: string; jumlah: number }[];
  nRombel: number | null;
  termin: { urutan: number; tanggal: string | null; nominal: number }[];
  masaMulai: string | null;
  masaSelesai: string | null;
  kota: string | null;
  tanggalTtd: string | null;
  sumberDana: string | null;
  sumberDanaLain: string | null;
  catatan: { isi: string; jenis: null }[];
};

/** Pilihan sumber dana yang ADA di wizard; kertas boleh menulis apa saja. */
export const SUMBER_DANA_WIZARD = ['BOS', 'Swadaya', 'Lainnya'] as const;

export function tambalanWizard(h: HasilPetakan): TambalanWizard {
  const dana = h.lain.sumberDana;
  const dikenal = dana !== null && (SUMBER_DANA_WIZARD as readonly string[]).includes(dana);
  return {
    sekolah: h.sekolah,
    komponen: h.komponen,
    hargaSiswa: h.harga.siswa,
    hargaGuru: h.harga.guru,
    rombel: h.rombel,
    nRombel: h.nRombel,
    termin: h.termin,
    masaMulai: h.lain.masaMulai,
    masaSelesai: h.lain.masaSelesai,
    kota: h.lain.kota,
    tanggalTtd: h.lain.tanggalTtd,
    // Kertas menulis sumber dana apa adanya, sedangkan wizard punya tiga pilihan. Yang tidak
    // dikenal dipetakan ke "Lainnya" BERIKUT teksnya -- bukan dipaksa jadi "BOS" (salah, dan
    // tampak sah) dan bukan dibuang (hilang tanpa jejak).
    sumberDana: dana === null ? null : (dikenal ? dana : 'Lainnya'),
    sumberDanaLain: dana !== null && !dikenal ? dana : null,
    catatan: h.catatan,
  };
}
