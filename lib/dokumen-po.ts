/**
 * Menghasilkan HTML dokumen Form Pre Order: tiga kotak A4 yang dicetak apa adanya.
 *
 * Markup dan kelasnya disalin dari kalkulator lama, yang tata letak cetaknya sudah
 * teruji. Sejak 22 Sep 2026 kalkulator itu tidak lagi membuat Form PO, jadi berkas ini
 * satu-satunya salinan markup itu — tidak ada lagi tempat kedua yang harus disamakan.
 * Paginasi ditentukan di sini — satu kotak = satu halaman — bukan diserahkan
 * ke browser, sehingga posisi paraf dan pemenggalan halaman pasti.
 *
 * Halaman 1 identitas + harga + rombel + termin, 2 tanda tangan, 3 catatan.
 * Rizki meminta catatan dan tanda tangan TIDAK sehalaman.
 */

import { esc, rp, BULAN, tglID } from './format';
import { pihakUntuk, labelPihak, type Pihak, type SkemaTtd } from './pihak';

export type DataDokumen = {
  sekolah: {
    nama?: string; npsn?: string; jenjang: 'SD' | 'SMP' | 'SMA';
    kepala_sekolah?: string; kepsek_hp?: string;
    bendahara?: string; bendahara_hp?: string;
  };
  rincianSiswa: string[];
  rincianGuru: string[];
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
  kelas: number[];
  kolomRombel: string[];
  rombel: Record<string, number>;
  termin: { urutan: number; tanggal?: string; nominal: number }[];
  catatan: { pelaksanaan?: string; sponsorship?: string };
  /** Nilai sponsorship, dicetak supaya sekolah menandatangani angkanya (catatan/18). */
  nilaiSponsorship?: number;
  namaPm?: string;
  namaSm?: string;
  /**
   * Hanya PO empat penanda tangan (catatan/23). Tanpa ini, seluruh PO lama dan PO skema 3,
   * halaman 2 tercetak persis seperti sebelumnya; dijaga uji/emas.test.mjs byte per byte.
   */
  skemaTtd?: SkemaTtd;
  /** Regional Head Division; hanya dibaca bila skemaTtd = 4. */
  namaRh?: string;
  /** URL gambar tanda tangan per pihak, bila sudah dibubuhkan. */
  ttd?: Partial<Record<Pihak, string>>;
  /**
   * Hanya untuk PO BERKELOMPOK (dua kelompok atau lebih). Tanpa ini — seluruh PO lama dan
   * PO satu kelompok — dokumen tercetak persis seperti sebelum kelompok ada; dijaga
   * uji/emas.test.mjs byte per byte. `rincianSiswa`, `jumlahSiswa`, dan `hargaSiswa`
   * diabaikan bila ini diisi.
   */
  kelompok?: KelompokDokumen[];
};

export type KelompokDokumen = {
  /** Nama dari Sales, atau "Kelas 10, 11" bila dikosongkan. */
  nama: string;
  siswa: number;
  harga: number;
  rincian: string[];
};





const isi = (v?: string) => (v ? esc(v) : '<span class="isian-kosong">&nbsp;</span>');
const kotak = (on: boolean) => `<span class="kotak-centang">(${on ? '&#10003;' : '&nbsp;&nbsp;'})</span>`;
const labelTermin = (i: number) => (i === 0 ? 'DP - Termin 1' : `Termin ${i + 1}`);

export function dokumenPo(d: DataDokumen): string {
  const berkelompok = (d.kelompok?.length ?? 0) >= 2;
  const subSiswa = berkelompok
    ? d.kelompok!.reduce((a, k) => a + k.siswa * k.harga, 0)
    : d.jumlahSiswa * d.hargaSiswa;
  const subGuru = d.jumlahGuru * d.hargaGuru;
  const grand = subSiswa + subGuru;
  // Kotak tanda tangan halaman 2 (catatan/23). Skema 3 = markup lama persis.
  const skema: SkemaTtd = d.skemaTtd === 4 ? 4 : 3;
  const daftarPihak = pihakUntuk(skema);
  const namaPihak: Record<Pihak, string | undefined> = {
    kepala_sekolah: d.sekolah.kepala_sekolah, partnership_manager: d.namaPm,
    regional_head: d.namaRh, sales_manager: d.namaSm,
  };
  const totalTermin = d.termin.reduce((a, t) => a + (t.nominal || 0), 0);
  const kepala = esc('Form Pre Order' + (d.sekolah.nama ? `: ${d.sekolah.nama}` : ''));

  const baris = (label: string, isiHtml: string) =>
    `<p class="idbaris"><span class="idlabel">${label}</span>: ${isiHtml}</p>`;

  const paraf = `
    <div class="po-paraf" aria-hidden="true">
      <span>Paraf Pihak Sekolah: <span class="paraf-garis"></span></span>
      <span>Paraf Skolla: <span class="paraf-garis"></span></span>
    </div>`;

  return `
<section class="po-halaman" data-hal="1"><span class="po-nomor no-print">Halaman 1</span>
  <h2>FORM PRE ORDER</h2>

  ${baris('Nama Sekolah', isi(d.sekolah.nama))}
  ${baris('NPSN', isi(d.sekolah.npsn))}
  ${baris('Jenjang', `${kotak(d.sekolah.jenjang === 'SD')} SD/MI &nbsp;&nbsp; ${kotak(d.sekolah.jenjang === 'SMP')} SMP/MTS &nbsp;&nbsp; ${kotak(d.sekolah.jenjang === 'SMA')} SMA/MA`)}
  ${baris('Kepala Sekolah', `${isi(d.sekolah.kepala_sekolah)} &nbsp;&nbsp; No. Hp : ${isi(d.sekolah.kepsek_hp)}`)}
  ${baris('Bendahara', `${isi(d.sekolah.bendahara)} &nbsp;&nbsp; No. Hp : ${isi(d.sekolah.bendahara_hp)}`)}
  ${berkelompok
    // Satu baris "Rincian Paket" per kelompok, supaya sekolah membaca siapa memakai apa —
    // bukan satu daftar gabungan yang membuat semua siswa tampak memakai semuanya.
    ? d.kelompok!.map((k) => baris(`Rincian ${esc(k.nama)}`,
        k.rincian.length ? esc(k.rincian.join(', ')) : '<span class="isian-kosong">&nbsp;</span>')).join('\n  ')
    : baris('Rincian Paket', d.rincianSiswa.length ? esc(d.rincianSiswa.join(', ')) : '<span class="isian-kosong">&nbsp;</span>')}
  ${d.rincianGuru.length ? baris('Pelatihan untuk Guru', esc(d.rincianGuru.join(', '))) : ''}
  ${baris('Sumber Dana', `${kotak(d.sumberDana === 'BOS')} BOS &nbsp;&nbsp; ${kotak(d.sumberDana === 'Swadaya')} Swadaya &nbsp;&nbsp; Lainnya: ${isi(d.sumberDana === 'Lainnya' ? d.sumberDanaLain : '')}`)}
  ${baris('Masa Aktif', `( ${isi(tglID(d.masaMulai))} &nbsp;s.d.&nbsp; ${isi(tglID(d.masaSelesai))} )`)}

  <table>
    <thead><tr><th>Kategori</th><th>Jumlah Akun</th><th>Harga</th><th>Total</th></tr></thead>
    <tbody>
      ${berkelompok
        ? d.kelompok!.map((k) => `<tr><td class="kiri">Siswa: ${esc(k.nama)}</td><td class="angka">${k.siswa || ''}</td><td class="angka">${k.harga ? rp(k.harga) : ''}</td><td class="angka">${k.siswa * k.harga ? rp(k.siswa * k.harga) : ''}</td></tr>`).join('\n      ')
        : `<tr><td class="kiri">Siswa</td><td class="angka">${d.jumlahSiswa || ''}</td><td class="angka">${d.hargaSiswa ? rp(d.hargaSiswa) : ''}</td><td class="angka">${subSiswa ? rp(subSiswa) : ''}</td></tr>`}
      <tr><td class="kiri">Guru</td><td class="angka">${d.jumlahGuru || ''}</td><td class="angka">${d.hargaGuru ? rp(d.hargaGuru) : ''}</td><td class="angka">${subGuru ? rp(subGuru) : ''}</td></tr>
      <tr class="jumlah"><td class="kiri">Grand Total</td><td></td><td></td><td class="angka">${grand ? rp(grand) : ''}</td></tr>
    </tbody>
  </table>

  <p class="po-seksi">Jumlah Siswa per Rombel</p>
  <table>
    <thead><tr><th>Kelas</th>${d.kolomRombel.map((r) => `<th>${esc(r)}</th>`).join('')}</tr></thead>
    <tbody>${d.kelas.map((k) => `<tr><td>${k}</td>${d.kolomRombel.map((r) => {
      const v = d.rombel[`${k}-${r}`] || 0;
      return `<td class="angka">${v || ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table>

  <p class="po-seksi">Termin Pembayaran</p>
  <table>
    <thead><tr><th>Termin</th><th>Tanggal</th><th>Nominal</th></tr></thead>
    <tbody>
      ${d.termin.map((t, i) => `<tr><td class="kiri">${labelTermin(i)}</td><td>${esc(tglID(t.tanggal))}</td><td class="angka">${t.nominal ? rp(t.nominal) : ''}</td></tr>`).join('')}
      <tr class="jumlah"><td class="kiri">Total</td><td></td><td class="angka">${totalTermin ? rp(totalTermin) : ''}</td></tr>
    </tbody>
  </table>
  ${paraf}
</section>

<section class="po-halaman" data-hal="2"><span class="po-nomor no-print">Halaman 2</span>
  <p class="po-lanjutan-kepala">${kepala} (Halaman 2 dari 3)</p>
  <p class="po-tempat" style="margin-top:0">${esc(d.kota || 'Jakarta')}, ${isi(tglID(d.tanggalTtd))}, ditandatangani dan disetujui oleh:</p>
  <table class="po-ttd${skema === 4 ? ' empat' : ''}">
    <thead><tr>${daftarPihak.map((p) => `<th>${labelPihak(p, skema)}</th>`).join('')}</tr></thead>
    <tbody><tr>
      ${daftarPihak.map((pihak) => {
        const n = namaPihak[pihak];
        const gambar = d.ttd?.[pihak];
        return `<td>${gambar
          ? `<img class="ttd-gambar-cetak" src="${esc(gambar)}" alt="Tanda tangan ${esc(n)}">`
          : '<span class="ttd-ruang"></span>'
        }<span class="ttd-nama">${esc(n)}</span></td>`;
      }).join('')}
    </tr></tbody>
  </table>
  ${paraf}
</section>

<section class="po-halaman" data-hal="3"><span class="po-nomor no-print">Halaman 3</span>
  <p class="po-lanjutan-kepala">${kepala} (Halaman 3 dari 3)</p>
  <p class="po-seksi" style="margin-top:0">Catatan</p>
  <table class="po-catatan">
    <tbody>
      <tr><td>1</td><td><span class="catatan-judul">Detail Pelaksanaan</span>${d.catatan.pelaksanaan ? `<span class="catatan-isi">${esc(d.catatan.pelaksanaan)}</span>` : ''}</td></tr>
      <tr><td>2</td><td><span class="catatan-judul">Sponsorship</span>${d.catatan.sponsorship ? `<span class="catatan-isi">${esc(d.catatan.sponsorship)}</span>` : ''}${d.nilaiSponsorship ? `<span class="catatan-isi">Nilai: ${rp(d.nilaiSponsorship)}</span>` : ''}</td></tr>
    </tbody>
  </table>
  ${paraf}
</section>`;
}
