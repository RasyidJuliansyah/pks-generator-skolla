import { redirect } from 'next/navigation';
import {
  penggunaHalaman, bolehLihatAcquisition, bolehBuatPo, daftarPengguna,
} from '@/lib/sesi';
import { komponenUntuk, presetUntuk, jumlahTier, NAMA_TIER, VERSI_PRICELIST } from '@/lib/pricelist';
import { gerbangEkstraksiMenyala } from '@/lib/ekstraksi-gerbang-aksi';
import FormPo from './form-po';

export const dynamic = 'force-dynamic';

// Batas 60 detik panggilan penyedia plus selisih render PDF di peramban (catatan/17 "Kegagalan").
// Dinaikkan pada HALAMAN, bukan pada berkas aksi: batas waktu Server Action mengikuti segmen
// rute yang memicunya.
export const maxDuration = 90;

export default async function PoBaru() {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');
  if (!bolehBuatPo(hasil.pengguna.peran)) redirect('/beranda');

  // Acquisition Price dipotong DI SINI, sebelum data meninggalkan server.
  // Dua daftar terpisah: PM diisi pemegang peran Sales, SM diisi Head of Sales.
  // Sebelumnya keduanya menarik dari daftar yang sama, jadi siapa pun bisa
  // terpilih sebagai penanda tangan mana pun.
  const [akunPm, akunSm, akunRh] = await Promise.all([
    daftarPengguna(['sales']),
    daftarPengguna(['head_of_sales']),
    daftarPengguna(['regional_head']),
  ]);
  const acq = bolehLihatAcquisition(hasil.pengguna.peran);

  const gerbang = await gerbangEkstraksiMenyala();

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Form Pre Order</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Centang fitur yang disepakati, isi data sekolah, lalu simpan sebagai draf.
        </p>
      </header>

      <FormPo
        komponen={komponenUntuk(acq)}
        preset={presetUntuk(acq)}
        namaTier={NAMA_TIER.slice(0, jumlahTier(acq)) as unknown as string[]}
        akunPm={akunPm}
        akunSm={akunSm}
        akunRh={akunRh}
        gerbangEkstraksi={gerbang === true}
      />

      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        Pricelist versi <code>{VERSI_PRICELIST}</code>
      </p>
    </main>
  );
}
