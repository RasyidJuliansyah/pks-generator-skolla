/**
 * Satu-satunya tempat aplikasi memanggil penyedia ekstraksi (catatan/17).
 *
 * Dikurung di sini supaya penggantian penyedia cukup satu perubahan: tidak ada berkas lain yang
 * tahu nama host, bentuk permintaan, atau nama model. Modul ini hanya boleh diimpor berkas
 * server; `uji/ekstraksi-bundel.test.mjs` dan `uji/pindai-bundel.mjs` menolak nama kunci dan
 * hostnya muncul di chunk klien.
 *
 * DeepSeek V4.1 Flash lewat OpenCode Go. Tanpa DPA: risiko diterima Rizki 17 Sep 2026 dan
 * dicatat di gerbang organisasi (tabel pengaturan_ekstraksi), bukan di sini.
 */

export const MODEL_EKSTRAKSI = 'deepseek-v4.1-flash';
export const PENYEDIA_EKSTRAKSI = 'OpenCode Go';

const ALAMAT_EKSTRAKSI = 'https://opencode.ai/zen/go/v1/chat/completions';

/** ID sesi stabil; permintaan tanpa header ini dijawab 400 MissingSessionID. */
const SESI = 'skolla-kerjasama-ekstraksi';
const AGEN = 'skolla-kerjasama/1.0 (+https://skolla-kerjasama.vercel.app)';

/** Permintaan skema JSON yang diminta: lihat IsianScan di lib/ekstraksi-po.ts. */
const PERMINTAAN = `Kamu membaca pindaian Form Pre Order (PO) Skolla yang diisi tangan dan ditandatangani.
Balas HANYA satu objek JSON, tanpa penjelasan, tanpa pagar kode.

Kunci yang boleh ada:
{"sekolah":{"nama","npsn","jenjang","alamat","telepon","email","kepala_sekolah","kepsek_hp","bendahara","bendahara_hp"},
"kotak_paket":[],"kotak_lain":[],"custom_teks":null,
"harga_siswa":0,"harga_guru":0,"rombel":[{"kelas","rombel","jumlah"}],
"termin":[{"tanggal","nominal"}],"masa_mulai":null,"masa_selesai":null,"sumber_dana":null,
"kota":null,"tanggal_ttd":null,"catatan":[],"ragu":[],"tidak_terbaca":[],"peringatan":[]}

Aturan:
- Tanggal dalam bentuk YYYY-MM-DD. Yang bentuknya tidak demikian, atau yang harinya tidak ada
  (mis. 2026-02-30), JANGAN ditebak: masukkan kuncinya ke "tidak_terbaca".
- "kotak_paket" hanya berisi label kotak yang JELAS tercentang, dari: LMS Lite, LMS Smart,
  LMS Juara, Asesmen Psikologi. Kotak lain (TKA, UTBK, ANBK, Custom) masuk "kotak_lain"; teks di
  sebelah Custom masuk "custom_teks".
- "ragu": kunci isian yang kamu sendiri tidak yakin. Nomor HP yang tidak yakin JANGAN didiamkan.
- "peringatan": hal yang perlu diperiksa manusia, misalnya tabel termin tidak rapi.
- Jangan mengisi apa pun yang tidak ada di kertas.`;

type Balasan = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Membaca halaman-halaman scan (JPEG dalam base64, tanpa awalan data:) dan mengembalikan JSON
 * mentah model yang sudah diurai. Melempar bila penyedia menjawab galat, lewat batas waktu, atau
 * balasannya bukan JSON yang sah.
 */
export async function bacaScan(gambar: string[]): Promise<{
  hasil: unknown; tokenMasuk: number | null; tokenKeluar: number | null;
}> {
  const kunci = process.env.OPENCODE_GO_API_KEY;
  if (!kunci) throw new Error('Kunci penyedia ekstraksi belum dipasang di server.');

  // Batas waktu 60 detik; uji terlama 34 detik (catatan/17 "Kegagalan").
  const batal = AbortSignal.timeout(60_000);
  const balasan = await fetch(ALAMAT_EKSTRAKSI, {
    method: 'POST',
    signal: batal,
    headers: {
      'Authorization': `Bearer ${kunci}`,
      'Content-Type': 'application/json',
      // Wajib: tanpa ini penyedia menjawab 400 MissingSessionID.
      'x-opencode-session': SESI,
      'User-Agent': AGEN,
    },
    body: JSON.stringify({
      model: MODEL_EKSTRAKSI,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PERMINTAAN },
          ...gambar.map((g) => ({
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${g}` },
          })),
        ],
      }],
    }),
  });

  if (!balasan.ok) {
    // Pesan penyedia TIDAK pernah memuat gambar atau isi scan; aman ditampilkan.
    throw new Error(`Penyedia menjawab ${balasan.status}.`);
  }

  const muatan = (await balasan.json()) as Balasan;
  const isi = muatan.choices?.[0]?.message?.content;
  if (typeof isi !== 'string' || isi.trim() === '') {
    throw new Error('Penyedia tidak mengembalikan isi.');
  }
  let hasil: unknown;
  try {
    hasil = JSON.parse(isi);
  } catch {
    // Hasil yang sah secara JSON tetapi tidak sesuai skema ditangani pemetaan (satu per satu);
    // yang tidak bisa diurai sama sekali adalah kegagalan pembacaan.
    throw new Error('Balasan penyedia bukan JSON yang sah.');
  }
  return {
    hasil,
    tokenMasuk: muatan.usage?.prompt_tokens ?? null,
    tokenKeluar: muatan.usage?.completion_tokens ?? null,
  };
}
