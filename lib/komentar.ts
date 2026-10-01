import prisma from './prisma';

/**
 * "Bolanya di siapa" — DITURUNKAN dari penulis komentar terakhir, bukan status yang
 * disetel orang. Ini heuristik, dan layar harus menyebutnya begitu: orang yang terakhir
 * bicara belum tentu orang yang ditunggu. Kalau penandanya terbaca sebagai penugasan
 * resmi, ia mulai dipakai untuk menyalahkan — padahal tidak ada yang pernah menugaskan.
 */
export type PenulisTerakhir = {
  oleh: string;
  nama: string | null;
  /** Peran SAAT menulis, disalin trigger — bukan peran hari ini. */
  peran: string[];
  waktu: string;
  pemilik: boolean;
};

type Komentar = {
  oleh: string; waktu: string; dihapus_pada: string | null;
  nama_penulis?: string | null; peran_penulis?: string[] | null;
};

export function penulisTerakhir(komentar: Komentar[], pemilikPo: string): PenulisTerakhir | null {
  // Komentar yang dihapus tidak dihitung: "saya salah tanya, abaikan" yang lalu dihapus
  // tidak boleh membuat bolanya tampak ada di orang yang menghapusnya.
  let k: Komentar | null = null;
  for (const x of komentar) {
    if (x.dihapus_pada) continue;
    if (!k || +new Date(x.waktu) > +new Date(k.waktu)) k = x;
  }
  if (!k) return null;
  return {
    oleh: k.oleh, nama: k.nama_penulis ?? null, peran: k.peran_penulis ?? [],
    waktu: k.waktu, pemilik: k.oleh === pemilikPo,
  };
}

export type KomentarBelumDibaca = {
  po_id: string;
  jumlah: number;
  terakhir: string;
};

/**
 * Menghitung komentar yang belum dibaca per PO untuk seorang pengguna.
 * Menggantikan RPC `komentar_belum_dibaca`.
 */
export async function komentarBelumDibaca(emailPengguna: string): Promise<KomentarBelumDibaca[]> {
  const email = emailPengguna.toLowerCase();

  const dibaca = await prisma.poKomentarDibaca.findMany({
    where: { oleh: email },
  });
  const mapDibaca = new Map<string, Date>(dibaca.map((d) => [d.poId, d.waktu]));

  const komentar = await prisma.poKomentar.findMany({
    where: {
      dihapusPada: null,
      oleh: { not: email },
    },
    select: {
      poId: true,
      waktu: true,
    },
  });

  const hasilPerPo = new Map<string, { jumlah: number; terakhir: Date }>();
  for (const k of komentar) {
    const waktuDibaca = mapDibaca.get(k.poId);
    if (!waktuDibaca || k.waktu > waktuDibaca) {
      const data = hasilPerPo.get(k.poId);
      if (!data) {
        hasilPerPo.set(k.poId, { jumlah: 1, terakhir: k.waktu });
      } else {
        data.jumlah += 1;
        if (k.waktu > data.terakhir) {
          data.terakhir = k.waktu;
        }
      }
    }
  }

  return Array.from(hasilPerPo.entries()).map(([po_id, v]) => ({
    po_id,
    jumlah: v.jumlah,
    terakhir: v.terakhir.toISOString(),
  }));
}

