import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { penggunaHalaman } from '@/lib/sesi';
import { ambilDetailPo } from '@/lib/po-kueri';
import { satu } from '@/lib/relasi';
import { dokumenPks } from '@/lib/dokumen-pks';
import { dataPksDariPo, sekolahDokumen } from '@/lib/dokumen-dari-po';
import { ekorNomor } from '@/lib/nomor-pks';
import { pdfPks, kunciPdf } from '@/lib/pdf-pks';

export const runtime = 'nodejs';
// Chromium perlu waktu menyala pada permintaan pertama.
export const maxDuration = 60;

/**
 * Merakit PKS sekali, lalu menyinggahkan hasilnya.
 *
 * Yang mahal bukan merendernya — itu 154 ms — melainkan menyalakan Chromium:
 * lima detik lebih di mesin biasa, lebih lama lagi di Vercel karena bundelnya
 * harus dibuka dulu. Tanpa singgahan, tiap klik Unduh mengulang seluruhnya,
 * dan dengan belasan sales itu berarti belasan orang menunggu lalu menekan
 * tombolnya berkali-kali karena mengira tidak terjadi apa-apa.
 *
 * Kuncinya data dokumen itu sendiri, bukan id PO. Dengan begitu kebasian
 * mustahil menurut bentuknya: masukan sama menghasilkan berkas sama, dan
 * masukan yang berubah otomatis jadi entri baru. PKS yang sudah difinalisasi
 * pun sudah beku — isinya dijaga trigger po_bekukan_isi berikut salinan data
 * sekolahnya.
 *
 * Ukurannya terukur 0,14 MB, jauh di bawah batas 2 MB per entri Data Cache.
 * Disimpan sebagai base64 karena isi singgahan diserialkan sebagai JSON.
 */
const pdfTersinggah = unstable_cache(
  async (data: Parameters<typeof dokumenPks>[0]) => {
    const { pdf, halaman } = await pdfPks(dokumenPks(data));
    const terkunci = await kunciPdf(pdf);
    return { b64: Buffer.from(terkunci).toString('base64'), halaman };
  },
  ['pks-pdf-v1'],
  { revalidate: false },
);

/** Nama berkas yang aman dipakai lintas sistem operasi. */
function namaBerkas(sekolah: string | undefined, nomorPo: number) {
  const bersih = (sekolah ?? 'PKS').replace(/[^\p{L}\p{N} .-]/gu, '').trim().slice(0, 60);
  return `PKS ${bersih || 'Skolla'} (PO-${String(nomorPo).padStart(3, '0')}).pdf`;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // penggunaHalaman dan wajib melempar bila basis data gagal (jadi 500), supaya
  // galat server tidak terbaca "Tidak berhak" atau "PO tidak ditemukan".
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') {
    return NextResponse.json({ galat: 'Tidak berhak.' }, { status: 401 });
  }

  const po = await ambilDetailPo(id, hasil.pengguna.email, hasil.pengguna.peran);
  if (!po) return NextResponse.json({ galat: 'PO tidak ditemukan.' }, { status: 404 });

  const pks = satu<{ tahun: number; bulan: number; final_pada: string | null }>(po.pks);
  if (!pks) {
    return NextResponse.json({ galat: 'Draf PKS belum dibuat.' }, { status: 409 });
  }
  // Diperiksa di sini, bukan hanya dengan menyembunyikan tombolnya: alamat
  // rutenya bisa dibuka langsung, dan draf yang belum final belum boleh beredar.
  if (!pks.final_pada) {
    return NextResponse.json(
      { galat: 'PKS belum difinalisasi. Finalisasi dulu sebelum diunduh.' },
      { status: 409 }
    );
  }

  const { b64, halaman } = await pdfTersinggah(
    dataPksDariPo(po, ekorNomor(pks.bulan, pks.tahun)));

  return new NextResponse(Buffer.from(b64, 'base64'), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition':
        `attachment; filename="${namaBerkas(sekolahDokumen(po).nama, po.nomor)}"`,
      // Dokumen berisi data mitra; jangan disimpan perantara mana pun.
      'cache-control': 'no-store, private',
      'x-halaman': String(halaman),
    },
  });
}
