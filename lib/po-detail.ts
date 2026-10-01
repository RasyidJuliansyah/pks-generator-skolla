import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';

export async function ambilDetailPo(id: string, emailPengguna: string, peran: Peran[]) {
  const lihatSemua = bolehLihatSemua(peran);
  const poDb = await prisma.po.findUnique({
    where: { id },
    include: {
      sekolah: true,
      komponen: true,
      rombel: true,
      termin: true,
      catatan: true,
      tandaTangan: true,
      verifikasi: true,
      verifikasiOtomatis: true,
      riwayat: true,
      suratVerifikasi: true,
      pks: true,
      komentar: {
        include: {
          revisi: true,
        },
      },
      komentarDibaca: true,
      kelompok: true,
      dokumenSponsorship: true,
    },
  });

  if (!poDb) return null;
  if (!lihatSemua && poDb.dibuatOleh.toLowerCase() !== emailPengguna.toLowerCase()) {
    return null;
  }

  return petakanDetailPo(poDb);
}

function petakanDetailPo(poDb: any) {
  return {
    id: poDb.id,
    nomor: Number(poDb.nomor),
    sekolah_id: poDb.sekolahId,
    dibuat_oleh: poDb.dibuatOleh,
    status: poDb.status,
    versi: poDb.versi,
    jumlah_siswa: poDb.jumlahSiswa,
    jumlah_guru: poDb.jumlahGuru,
    harga_siswa: Number(poDb.hargaSiswa),
    harga_guru: Number(poDb.hargaGuru),
    grand_total: Number(poDb.grandTotal),
    masa_mulai: poDb.masaMulai ? poDb.masaMulai.toISOString().slice(0, 10) : null,
    masa_selesai: poDb.masaSelesai ? poDb.masaSelesai.toISOString().slice(0, 10) : null,
    sumber_dana: poDb.sumberDana,
    sumber_dana_lain: poDb.sumberDanaLain,
    kota: poDb.kota,
    tanggal_ttd: poDb.tanggalTtd ? poDb.tanggalTtd.toISOString().slice(0, 10) : null,
    jumlah_rombel: poDb.jumlahRombel,
    versi_pricelist: poDb.versiPricelist,
    dibuat_pada: poDb.dibuatPada.toISOString(),
    diubah_pada: poDb.diubahPada.toISOString(),
    nama_pm: poDb.namaPm,
    nama_sm: poDb.namaSm,
    nama_rh: poDb.namaRh,
    diverifikasi_oleh: poDb.diverifikasiOleh,
    diverifikasi_pada: poDb.diverifikasiPada?.toISOString() ?? null,
    sekolah_beku: poDb.sekolahBeku,
    asal: poDb.asal,
    berkas_unggahan: poDb.berkasUnggahan,
    ditinjau_pada: poDb.ditinjauPada?.toISOString() ?? null,
    ditinjau_oleh: poDb.ditinjauOleh,
    ditinjau_sidik: poDb.ditinjauSidik,
    versi_iom: poDb.versiIom,
    permintaan_tambahan: poDb.permintaanTambahan,
    nilai_sponsorship: poDb.nilaiSponsorship != null ? Number(poDb.nilaiSponsorship) : null,
    diverifikasi_otomatis: poDb.diverifikasiOtomatis,
    skema_ttd: poDb.skemaTtd,
    dibaca_ai_pada: poDb.dibacaAiPada?.toISOString() ?? null,
    ekstraksi_menunggu: poDb.ekstraksiMenunggu,

    sekolah: poDb.sekolah ? {
      id: poDb.sekolah.id,
      nama: poDb.sekolah.nama,
      npsn: poDb.sekolah.npsn,
      jenjang: poDb.sekolah.jenjang,
      alamat: poDb.sekolah.alamat,
      telepon: poDb.sekolah.telepon,
      email: poDb.sekolah.email,
      kepala_sekolah: poDb.sekolah.kepalaSekolah,
      kepsek_hp: poDb.sekolah.kepsekHp,
      bendahara: poDb.sekolah.bendahara,
      bendahara_hp: poDb.sekolah.bendaharaHp,
      dibuat_pada: poDb.sekolah.dibuatPada.toISOString(),
      diubah_pada: poDb.sekolah.diubahPada.toISOString(),
      dipegang_oleh: poDb.sekolah.dipegangOleh,
    } : null,
    po_komponen: (poDb.komponen || []).map((k: any) => ({
      po_id: k.poId,
      komponen_id: k.komponenId,
      sesi: k.sesi,
      kelompok: k.kelompok,
    })),

    po_rombel: (poDb.rombel || []).map((r: any) => ({
      po_id: r.poId,
      kelas: r.kelas,
      rombel: r.rombel,
      jumlah_siswa: r.jumlahSiswa,
      kelompok: r.kelompok,
    })),

    po_termin: (poDb.termin || []).map((t: any) => ({
      po_id: t.poId,
      urutan: t.urutan,
      tanggal: t.tanggal ? t.tanggal.toISOString().slice(0, 10) : null,
      nominal: Number(t.nominal),
    })),

    po_catatan: (poDb.catatan || []).map((c: any) => ({
      po_id: c.poId,
      jenis: c.jenis,
      isi: c.isi,
    })),

    tanda_tangan: (poDb.tandaTangan || []).map((t: any) => ({
      po_id: t.poId,
      pihak: t.pihak,
      nama: t.nama,
      berkas: t.berkas,
      dibubuhkan_oleh: t.dibubuhkanOleh,
      waktu: t.waktu.toISOString(),
      asal: t.asal,
      berkas_dihapus_pada: t.berkasDihapusPada?.toISOString() ?? null,
    })),

    verifikasi: (poDb.verifikasi || []).map((v: any) => ({
      id: v.id,
      po_id: v.poId,
      fungsi: v.fungsi,
      hasil: v.hasil,
      catatan: v.catatan,
      item: v.item,
      oleh: v.oleh,
      waktu: v.waktu.toISOString(),
      versi_po: v.versiPo,
      berlaku: v.berlaku,
      digantikan_pada: v.digantikanPada?.toISOString() ?? null,
      sebab_basi: v.sebabBasi,
    })),

    verifikasi_otomatis: (poDb.verifikasiOtomatis || []).map((vo: any) => ({
      id: vo.id,
      po_id: vo.poId,
      versi_po: vo.versiPo,
      versi_iom: vo.versiIom,
      lolos: vo.lolos,
      paket: vo.paket,
      kelompok: vo.kelompok,
      gagal: vo.gagal,
      hasil: vo.hasil,
      dicatat_pada: vo.dicatatPada.toISOString(),
    })),

    po_riwayat: (poDb.riwayat || []).map((rw: any) => ({
      id: Number(rw.id),
      po_id: rw.poId,
      status_lama: rw.statusLama,
      status_baru: rw.statusBaru,
      versi: rw.versi,
      oleh: rw.oleh,
      pada: rw.pada.toISOString(),
    })),

    surat_verifikasi: (poDb.suratVerifikasi || []).map((sv: any) => ({
      id: sv.id,
      po_id: sv.poId,
      nama_penanda: sv.namaPenanda,
      ditandatangani_oleh: sv.ditandatanganiOleh,
      berkas: sv.berkas,
      dibuat_pada: sv.dibuatPada.toISOString(),
      final_pada: sv.finalPada?.toISOString() ?? null,
      otomatis: sv.otomatis,
    })),

    pks: (poDb.pks || []).map((p: any) => ({
      id: p.id,
      po_id: p.poId,
      tahun: p.tahun,
      bulan: p.bulan,
      dibuat_oleh: p.dibuatOleh,
      dibuat_pada: p.dibuatPada.toISOString(),
      final_pada: p.finalPada?.toISOString() ?? null,
      diunggah_oleh: p.diunggahOleh,
      diunggah_pada: p.diunggahPada?.toISOString() ?? null,
      ditandatangani_pada: p.ditandatanganiPada?.toISOString().slice(0, 10) ?? null,
      berkas_basah: p.berkasBasah,
    })),

    pks_dokumen_sponsorship: poDb.dokumenSponsorship ? {
      po_id: poDb.dokumenSponsorship.poId,
      versi_po: poDb.dokumenSponsorship.versiPo,
      form_ditandatangani: poDb.dokumenSponsorship.formDitandatangani,
      rekening_atas_nama_lembaga: poDb.dokumenSponsorship.rekeningAtasNamaLembaga,
      meterai_bila_di_atas_5juta: poDb.dokumenSponsorship.meteraiBilaDiAtas5juta,
      oleh: poDb.dokumenSponsorship.oleh,
      pada: poDb.dokumenSponsorship.pada.toISOString(),
    } : null,

    po_komentar: (poDb.komentar || []).map((k: any) => ({
      id: k.id,
      po_id: k.poId,
      isi: k.isi,
      oleh: k.oleh,
      waktu: k.waktu.toISOString(),
      versi_po: k.versiPo,
      disunting_pada: k.disuntingPada?.toISOString() ?? null,
      dihapus_pada: k.dihapusPada?.toISOString() ?? null,
      dihapus_oleh: k.dihapusOleh,
      nama_penulis: k.namaPenulis,
      peran_penulis: k.peranPenulis,
      induk_kunci: k.indukKunci,
      kedalaman: k.kedalaman,
      po_komentar_revisi: (k.revisi || []).map((rv: any) => ({
        id: Number(rv.id),
        komentar_id: rv.komentarId,
        isi: rv.isi,
        digantikan_pada: rv.digantikanPada.toISOString(),
      })),
    })),

    po_komentar_dibaca: (poDb.komentarDibaca || []).map((kd: any) => ({
      po_id: kd.poId,
      oleh: kd.oleh,
      waktu: kd.waktu.toISOString(),
    })),

    po_kelompok: (poDb.kelompok || []).map((kl: any) => ({
      po_id: kl.poId,
      nomor: kl.nomor,
      nama: kl.nama,
      harga_siswa: Number(kl.hargaSiswa),
    })),
  };
}
