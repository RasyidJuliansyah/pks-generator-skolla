import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { penggunaHalaman, bolehLihatAcquisition, bolehBuatPo, daftarPengguna, adalahLead, bolehKomentar, LABEL_PERAN, type Peran } from '@/lib/sesi';
import { ambilDetailPo } from '@/lib/po-kueri';
import { verdictTerakhir, type BarisVerdict } from '@/lib/verdict-iom';
import { satu } from '@/lib/relasi';
import { liniMasa, type Peristiwa } from '@/lib/lini-masa';
import { adaSponsorship } from '@/lib/sponsorship';
import { komponenUntuk, presetUntuk, jumlahTier, NAMA_TIER } from '@/lib/pricelist';
import type { IsiPo } from '@/lib/po-aksi';
import { urlTtd } from '@/lib/po-aksi';
import PanelTtd, { type TtdTersimpan } from './panel-ttd';
import { skemaDari } from '@/lib/pihak';
import PanelUnggahan from './panel-unggahan';
import { dokumenPo } from '@/lib/dokumen-po';
import { dataDokumenDariPo, sekolahDokumen, sekolahUntukSunting } from '@/lib/dokumen-dari-po';
import { URUT_FUNGSI, type Fungsi } from '@/lib/checklist';
import PanelVerifikasi, { type Keputusan } from './panel-verifikasi';
import FormPo from '../baru/form-po';
import { KotakKomentar, TandaiDibaca } from './komentar';
import ButirLini from './butir-lini';
import { penulisTerakhir } from '@/lib/komentar';

export const dynamic = 'force-dynamic';

export default async function PoUbah({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ baru?: string }>;
}) {
  const { id } = await params;
  const { baru } = await searchParams;
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');

  const po = await ambilDetailPo(id, hasil.pengguna.email, hasil.pengguna.peran);
  if (!po) notFound();

  // Dua daftar terpisah: PM diisi pemegang peran Sales, SM diisi Head of Sales.
  // Sebelumnya keduanya menarik dari daftar yang sama, jadi siapa pun bisa
  // terpilih sebagai penanda tangan mana pun.
  const [akunPm, akunSm, akunRh] = await Promise.all([
    daftarPengguna(['sales']),
    daftarPengguna(['head_of_sales']),
    daftarPengguna(['regional_head']),
  ]);
  const verdict = verdictTerakhir((po.verifikasi_otomatis ?? []) as BarisVerdict[]);
  const acq = bolehLihatAcquisition(hasil.pengguna.peran);
  const bisaUbah = bolehBuatPo(hasil.pengguna.peran) && ['draf', 'ditolak'].includes(po.status);
  const peristiwa = liniMasa({
    riwayat: po.po_riwayat ?? [],
    ttd: po.tanda_tangan ?? [],
    skema: po.skema_ttd,
    verifikasi: po.verifikasi ?? [],
    surat: satu(po.surat_verifikasi),
    pks: satu(po.pks),
    komentar: po.po_komentar ?? [],
    versiPo: po.versi,
    otomatis: po.diverifikasi_otomatis,
    dibacaAiPada: po.dibaca_ai_pada,
  });

  // Penanda baca milik saya sendiri — RLS hanya mengembalikan baris saya, tapi tetap
  // disaring email supaya tidak bergantung pada itu.
  const saya = hasil.pengguna.email;
  const dibacaPada = ((po.po_komentar_dibaca ?? []) as { oleh: string; waktu: string }[])
    .find((d) => d.oleh === saya)?.waktu ?? null;
  const komentarBaru = (e: Peristiwa) => !!e.komentar && !e.komentar.dihapus && e.oleh !== saya
    && (!dibacaPada || +new Date(e.waktu) > +new Date(dibacaPada));
  // Menelusuri balasan: lencana yang hanya melihat tingkat atas membuat PO tampak sudah
  // terbaca padahal ada balasan baru yang menunggu jawaban.
  const adaBaruDi = (e: Peristiwa): boolean => komentarBaru(e) || e.balasan.some(adaBaruDi);
  const adaBaru = peristiwa.some(adaBaruDi);
  const terakhir = penulisTerakhir(po.po_komentar ?? [], po.dibuat_oleh);

  const bisaBubuh =
    bolehBuatPo(hasil.pengguna.peran) &&
    (po.dibuat_oleh === hasil.pengguna.email ||
      hasil.pengguna.peran.some((r) => r === 'head_of_sales' || r === 'admin_sales'));

  // URL bertanda tangan berumur pendek; berkasnya tidak pernah publik.
  const ttd: TtdTersimpan[] = await Promise.all(
    ((po.tanda_tangan ?? []) as { pihak: TtdTersimpan['pihak']; nama: string; waktu: string; berkas: string }[])
      .map(async (t) => ({ pihak: t.pihak, nama: t.nama, waktu: t.waktu, url: await urlTtd(t.berkas) }))
  );

  // Sekolah yang dipegang sales lain dikunci. Yang tidak terlihat sama sekali (sudah
  // dialihkan dari pembuat PO-nya) diisi dari salinan beku.
  const isianSekolah = sekolahUntukSunting(po, hasil.pengguna);
  const awal: IsiPo & { skemaTtd: ReturnType<typeof skemaDari> } = {
    id: po.id,
    // Tanpa ini formulir menganggap PO unggahan sebagai 'platform', dan menyimpannya
    // mengubah jalurnya: lantai ikut menghalangi, pengajuan pindaian menolaknya.
    asal: po.asal,
    sekolah: isianSekolah.sekolah,
    komponen: (po.po_komponen ?? []).map((k: { komponen_id: string; sesi: number; kelompok: number }) =>
      ({ id: k.komponen_id, sesi: k.sesi, kelompok: k.kelompok })),
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
    namaPm: po.nama_pm ?? undefined,
    namaSm: po.nama_sm ?? undefined,
    namaRh: po.nama_rh ?? undefined,
    skemaTtd: skemaDari(po.skema_ttd),
    permintaanTambahan: po.permintaan_tambahan ?? false,
    nilaiSponsorship: po.nilai_sponsorship ?? undefined,
    jumlahRombel: po.jumlah_rombel,
    rombel: (po.po_rombel ?? []).map((r: { kelas: number; rombel: string; jumlah_siswa: number; kelompok: number }) =>
      ({ kelas: r.kelas, rombel: r.rombel, jumlah: r.jumlah_siswa, kelompok: r.kelompok })),
    // Dua baris atau lebih = PO berkelompok; nol = satu kelompok (jalur lama).
    ...((po.po_kelompok ?? []).length >= 2 ? {
      kelompok: (po.po_kelompok as { nomor: number; nama: string | null; harga_siswa: number }[])
        .slice().sort((a, b) => a.nomor - b.nomor)
        .map((k) => ({ nomor: k.nomor, nama: k.nama ?? undefined, hargaSiswa: k.harga_siswa })),
    } : {}),
    termin: (po.po_termin ?? [])
      .sort((a: { urutan: number }, b: { urutan: number }) => a.urutan - b.urutan)
      .map((t: { urutan: number; tanggal: string | null; nominal: number }) =>
        ({ urutan: t.urutan, tanggal: t.tanggal ?? '', nominal: t.nominal })),
    catatan: (po.po_catatan ?? []).map((c: { jenis: 'pelaksanaan' | 'sponsorship'; isi: string }) =>
      ({ jenis: c.jenis, isi: c.isi })),
    // Status konfirmasi per langkah hasil baca scan (catatan/17 amandemen 2 butir 5). TANPA baris
    // ini kolomnya jadi write-only: penanda "belum diperiksa" hilang begitu draf dibuka lagi, dan
    // Tinjau terbuka untuk PO yang isiannya belum dicocokkan siapa pun (temuan QA independen).
    ekstraksiMenunggu: po.ekstraksi_menunggu ?? undefined,
  };

  const peran = hasil.pengguna.peran;
  const fungsiSaya = URUT_FUNGSI.filter((f) => peran.includes(f)) as Fungsi[];
  const keputusan = ((po.verifikasi ?? []) as Keputusan[]);
  // PKS bergantung pada surat yang sudah final, bukan sekadar PO terverifikasi.
  const surat = satu<{ final_pada: string | null; otomatis?: boolean | null }>(po.surat_verifikasi);
  const suratFinal = !!surat?.final_pada;
  const pks = satu<{ final_pada: string | null }>(po.pks);

  const petaTtd = Object.fromEntries(
    ttd.filter((t) => t.url).map((t) => [t.pihak, t.url as string])
  ) as Record<TtdTersimpan['pihak'], string>;
  const html = dokumenPo(dataDokumenDariPo(po, petaTtd));

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>{sekolahDokumen(po).nama ?? 'Form Pre Order'}</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Status <span className="lencana">{po.status.replace(/_/g, ' ')}</span>
          {/* Isian awal PO ini dibaca AI dari pindaian (catatan/17 amandemen 1). Tampil di
              kepala halaman supaya HoO dan Tech Ops Lead bisa memeriksa acak sesudahnya --
              pemeriksaannya dilakukan ATAS dasar penanda ini, jadi ia harus terlihat. */}
          {po.dibaca_ai_pada && <> <span className="lencana kuning">dibaca AI</span></>}
          {!bisaUbah && ' · terkunci, tidak bisa disunting pada status ini'}
        </p>
      </header>

      {/* Peringatan sponsorship untuk Sales, sedini mungkin (catatan/22). Digerbangi
          `!bisaUbah` supaya tidak berdobel dengan catatan di langkah Penanda: pada draf
          formulirnya yang tampil, dan langkah itu sudah membawa catatannya sendiri. */}
      {adaSponsorship(po) && !bisaUbah && (
        <div className="pesan kuning" style={{ margin: '16px 0' }}>
          <span className="lencana kuning">Sponsorship</span>{' '}
          Sebelum PKS bermeterai bisa diunggah, <strong>Finance</strong> harus mengonfirmasi
          dokumen sponsorship-nya.{' '}
          <Link href={`/pks/${po.id}`}>Buka halaman PKS</Link>.
        </div>
      )}

      {po.status === 'terverifikasi' && (
        <div className={`pesan ${suratFinal ? 'baik' : ''}`} style={{ margin: '16px 0' }}>
          {suratFinal ? (
            <>
              {surat?.otomatis && 'Diverifikasi otomatis menurut aturan IoM, tanpa keputusan manual keempat fungsi. '}
              Surat Verifikasi Kesiapan sudah final.{' '}
              {pks
                ? (pks.final_pada
                    ? 'PKS-nya sudah final, siap ditandatangani basah.'
                    : 'PKS-nya masih draf.')
                : 'PKS sudah boleh disusun.'}
              {' '}Kelola lewat menu <Link href="/pks"><strong>Perjanjian (PKS)</strong></Link>.
              {' · '}
              <Link href={`/po/${po.id}/surat`}>Lihat surat</Link>
            </>
          ) : (
            <>
              PO terverifikasi. PKS belum bisa dibuat sampai Tech Ops Lead
              menandatangani dan memfinalisasi{' '}
              <Link href={`/po/${po.id}/surat`}><strong>Surat Verifikasi Kesiapan</strong></Link>.
            </>
          )}
        </div>
      )}

      {baru === '1' && (
        <div className="pesan baik" style={{ margin: '16px 0' }}>
          Draf tersimpan. Semua draf dan PO bisa dibuka lagi lewat menu{' '}
          <Link href="/po"><strong>Daftar PO</strong></Link> di panel kiri.
        </div>
      )}

      {bisaUbah ? (
        /* Membaca scan adalah tindakan SAAT MEMBUAT: langkah 0 tidak tampil untuk PO yang
           sudah ada, jadi kotaknya tidak akan muncul di sini walau gerbangnya menyala.
           Disetel `false` alih-alih dijadikan bawaan prop supaya pembaca berikutnya tidak
           menyimpulkan bahwa penyuntingan pun bisa membaca ulang pindaian. */
        <FormPo
          komponen={komponenUntuk(acq)}
          preset={presetUntuk(acq)}
          namaTier={NAMA_TIER.slice(0, jumlahTier(acq)) as unknown as string[]}
          awal={awal}
          sekolahTerkunci={isianSekolah.terkunci}
          berkasUnggahan={po.asal === 'unggahan' ? po.berkas_unggahan ?? null : null}
          akunPm={akunPm}
          akunSm={akunSm}
          akunRh={akunRh}
          gerbangEkstraksi={false}
        />
      ) : (
        <>
          <div className="kosong">
            <strong>PO terkunci untuk penyuntingan</strong>
            <p>Isi PO hanya bisa diubah saat status draf atau ditolak.</p>
          </div>
          {/* Untuk PO unggahan, PINDAIAN yang jadi dokumennya. Salinan sistem hanya
              muncul setelah Sales menyatakan datanya sesuai — sebelum itu ia cuma
              transkripsi yang belum diperiksa siapa pun, dan mencetaknya menciptakan
              berkas kedua yang terlihat sama sahnya. */}
          {po.asal === 'unggahan' && !po.ditinjau_pada ? (
            <section className="kotak no-print" style={{ marginTop: 16, padding: '16px 20px' }}>
              <strong style={{ fontSize: 14 }}>Salinan sistem belum tersedia</strong>
              <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0', maxWidth: 640 }}>
                Dokumen PO-nya adalah pindaian yang diunggah. Salinan rapi versi sistem
                baru bisa dibuka setelah Sales menyatakan data di sini sesuai dengan
                pindaian itu.
              </p>
            </section>
          ) : (
            <section className="po-dokumen">
              <h2 className="po-dokumen-judul no-print">
                {po.asal === 'unggahan' ? 'Salinan sistem' : 'Pratinjau Dokumen'}
              </h2>
              {po.asal === 'unggahan' && (
                <p className="muted no-print" style={{ fontSize: 13, margin: '0 0 12px', maxWidth: 640 }}>
                  <strong>Salinan sistem, bukan dokumen yang ditandatangani.</strong>{' '}
                  Yang ditandatangani sekolah adalah pindaiannya. Salinan ini disusun dari
                  data hasil tinjauan, untuk keperluan arsip dan lampiran.
                </p>
              )}
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          )}
        </>
      )}

      <PanelVerifikasi
        poId={po.id}
        status={po.status}
        nilaiSponsorship={po.nilai_sponsorship ?? null}
        grandTotal={po.grand_total}
        keputusan={keputusan}
        fungsiSaya={fungsiSaya}
        adalahLead={adalahLead(peran)}
        milikSaya={po.dibuat_oleh === hasil.pengguna.email || peran.includes('head_of_sales') || peran.includes('admin_sales')}
        berkasUnggahan={po.asal === 'unggahan' ? po.berkas_unggahan ?? null : null}
        verdict={verdict}
        versiPo={po.versi}
      />

      {/* Lini masa paling bawah: ia jawaban atas "kenapa PO ini begini", dan
          itu pertanyaan yang muncul SESUDAH orang membaca isinya. */}
      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Riwayat</h2>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
          {peristiwa.length
            ? `${peristiwa.length} peristiwa, terbaru di atas. Keputusan yang sudah tidak berlaku tetap tercantum, itu yang menjelaskan kenapa sebuah PO pernah tersendat.`
            : 'Belum ada peristiwa tercatat.'}
        </p>
        {terakhir && (
          <p className="komentar-bola">
            Komentar terakhir dari <strong>{terakhir.nama ?? terakhir.oleh.split('@')[0]}</strong>
            {(terakhir.peran.length > 0 || terakhir.pemilik) && ' ('}
            {[
              ...terakhir.peran.map((p) => LABEL_PERAN[p as Peran] ?? p),
              ...(terakhir.pemilik ? ['pemilik PO'] : []),
            ].join(' · ')}
            {(terakhir.peran.length > 0 || terakhir.pemilik) && ')'}
            , {new Date(terakhir.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.{' '}
            <span className="muted">Ini penanda siapa yang terakhir bicara, bukan penugasan.</span>
          </p>
        )}
        {adaBaru && <TandaiDibaca poId={po.id} />}
        {bolehKomentar(hasil.pengguna.peran) && <KotakKomentar poId={po.id} />}
        {peristiwa.length > 0 && (
          <ol className="lini-masa">
            {peristiwa.map((e: Peristiwa) => (
              <ButirLini key={e.kunci} e={e} tingkat={0} ctx={{
                poId: po.id,
                saya: hasil.pengguna.email,
                bolehTulis: bolehKomentar(hasil.pengguna.peran),
                baru: komentarBaru,
              }} />
            ))}
          </ol>
        )}
      </section>

      {/* PO unggahan tidak mengumpulkan tanda tangan lewat aplikasi — ketiganya sudah
          ada di dalam pindaian. Panelnya berbeda, bukan PanelTtd yang dilumpuhkan. */}
      {po.asal === 'unggahan' ? (
        <PanelUnggahan
          poId={po.id}
          status={po.status}
          berkas={po.berkas_unggahan ?? null}
          ditinjauOleh={po.ditinjau_oleh ?? null}
          ditinjauPada={po.ditinjau_pada ?? null}
          bisaAjukan={bisaBubuh}
        />
      ) : (
        <PanelTtd
          poId={po.id}
          status={po.status}
          ttd={ttd}
          nama={{
            kepala_sekolah: sekolahDokumen(po).kepala_sekolah ?? undefined,
            partnership_manager: po.nama_pm ?? undefined,
            regional_head: po.nama_rh ?? undefined,
            sales_manager: po.nama_sm ?? undefined,
          }}
          skema={skemaDari(po.skema_ttd)}
          bisaBubuh={bisaBubuh}
        />
      )}
    </main>
  );
}
