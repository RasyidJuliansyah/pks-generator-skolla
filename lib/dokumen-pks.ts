/**
 * Menghasilkan HTML Perjanjian Kerja Sama, mengikuti PKS asli yang sudah
 * ditandatangani (rujukan: PKS SMKS PGRI 1 Surabaya, 175/EXTSKOLLA/PKS/VIII/2026).
 *
 * Isi keempat belas pasalnya disalin apa adanya; yang berubah hanya bagian yang
 * memang berbeda tiap sekolah. SATU ketentuan sengaja diperbaiki — lihat PAJAK
 * di bawah.
 *
 * Berbeda dari Form Pre Order yang paginasinya dipatok satu kotak per halaman,
 * PKS dibiarkan mengalir dan dipenggal CSS: panjangnya berubah menurut jumlah
 * komponen dan termin, sehingga kotak tetap justru akan meluber.
 *
 * Ruang yang sengaja dibiarkan kosong untuk diisi tangan saat tanda tangan basah:
 * hari, tanggal, dan tempat penandatanganan, Nomor Perjanjian Mitra, serta
 * alamat surel kedua pihak.
 *
 * Angka urut Nomor Perjanjian Skolla juga dikosongkan: penomorannya dipakai
 * bersama banyak jenis dokumen di luar sistem ini, jadi urutannya tidak bisa
 * ditentukan dari sini. Yang tetap dicetak hanya ekornya.
 */

import { esc, BULAN, tglID } from './format';
import { terbilang, rupiahPenuh } from './terbilang';

export type DataPks = {
  /** Ekor nomor perjanjian, mis. "/EXTSKOLLA/PKS/VIII/2026". Angka urutnya
   *  sengaja tidak dihasilkan sistem — lihat catatan di bawah. */
  nomorEkor: string;
  sekolah: {
    nama?: string; jenjang: 'SD' | 'SMP' | 'SMA';
    alamat?: string; telepon?: string; kepala_sekolah?: string;
  };
  namaPaket: string;
  layanan: string[];
  masaMulai?: string;
  masaSelesai?: string;
  jumlahSiswa: number;
  jumlahGuru: number;
  grandTotal: number;
  termin: { urutan: number; tanggal?: string; nominal: number }[];
  kelas: number[];
};




const JENJANG_PANJANG: Record<DataPks['sekolah']['jenjang'], string> = {
  SD: 'Sekolah Dasar (SD)',
  SMP: 'Sekolah Menengah Pertama (SMP)',
  SMA: 'Sekolah Menengah Atas (SMA)',
};

const URUTAN_KATA = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam',
  'ketujuh', 'kedelapan', 'kesembilan', 'kesepuluh'];

/** "A, B dan C" — tanpa koma sebelum "dan". */
const gabung = (d: string[]) =>
  d.length <= 1 ? d[0] ?? '' : `${d.slice(0, -1).join(', ')} dan ${d[d.length - 1]}`;

const kosong = (n = 24) => `<span class="pks-isian">${'&nbsp;'.repeat(n)}</span>`;

export function dokumenPks(d: DataPks): string {
  const sekolah = esc(d.sekolah.nama || '-');
  const paket = esc(d.namaPaket.toUpperCase());
  const nilai = rupiahPenuh(d.grandTotal);
  const kepsek = esc(d.sekolah.kepala_sekolah || '-');

  const pasal = (n: number, judul: string, isi: string) => `
    <section class="pks-pasal">
      <h3>PASAL ${n}<br><span>${judul}</span></h3>
      ${isi}
    </section>`;

  const ol = (butir: string[], kelas = '') =>
    `<ol class="${kelas}">${butir.map((b) => `<li>${b}</li>`).join('')}</ol>`;
  const ul = (butir: string[]) =>
    `<ul>${butir.map((b) => `<li>${b}</li>`).join('')}</ul>`;

  const rincianPeserta = [
    `jenjang ${esc(d.sekolah.jenjang)}${d.kelas.length ? ` Kelas ${gabung(d.kelas.map(String))}` : ''}`
    + ` sebanyak ${d.jumlahSiswa} siswa/i`,
    ...(d.jumlahGuru > 0 ? [`pelatihan untuk ${d.jumlahGuru} guru`] : []),
  ];

  const barisTermin = d.termin.map((t, i) =>
    `Termin ${URUTAN_KATA[i] ?? `ke-${i + 1}`} sebesar ${rupiahPenuh(t.nominal)}, `
    + `dibayarkan pada ${esc(tglID(t.tanggal))} dan setelah adanya <em>invoice</em> resmi `
    + `dari <strong>PIHAK PERTAMA</strong>.`);

  return `
<article class="pks">
  <div class="pks-kepala">
    <h2>PERJANJIAN KERJA SAMA</h2>
    <p>ANTARA</p>
    <p><strong>PT TEMAN SATU SKOLLA</strong></p>
    <p>DENGAN</p>
    <p><strong>${sekolah}</strong></p>
    <p>TENTANG</p>
    <p><strong>PEMBELIAN PAKET ${paket}</strong></p>
  </div>

  <p class="pks-nomor-baris">Nomor Perjanjian Skolla:
  <span class="pks-utuh">${kosong(9)}${esc(d.nomorEkor)}</span></p>
  <p class="pks-nomor-baris">Nomor Perjanjian Mitra: ${kosong(30)}</p>

  <p>Pada hari ini ${kosong(10)} tanggal ${kosong(8)} bulan ${kosong(10)} tahun ${kosong(10)}
  (${kosong(4)}-${kosong(4)}-${kosong(6)})
  <span class="pks-utuh">bertempat di ${kosong(16)}</span>, yang bertanda tangan di bawah ini:</p>

  <table class="pks-pihak">
    <tbody>
      <tr>
        <td><strong>1.</strong></td>
        <td><strong>MUH AKBAR BUANA TAFSILI, MBA</strong></td>
        <td>:</td>
        <td><strong>Chief Business Officer PT Teman Satu Skolla</strong>, beralamat di Graha Inti
        Fauzi Building, Lt.2, Jl. Buncit Raya No.22, Jakarta Selatan, DKI Jakarta 12510, dalam hal
        ini bertindak untuk dan atas nama jabatannya secara sah mewakili PT Teman Satu Skolla,
        selanjutnya disebut &ldquo;<strong>PIHAK PERTAMA</strong>&rdquo;.</td>
      </tr>
      <tr>
        <td><strong>2.</strong></td>
        <td><strong>${kepsek}</strong></td>
        <td>:</td>
        <td><strong>Kepala Sekolah ${sekolah}</strong> beralamat di
        ${d.sekolah.alamat ? esc(d.sekolah.alamat) : kosong(40)}, dalam hal ini bertindak untuk dan
        atas nama jabatannya serta secara sah mewakili ${sekolah}, selanjutnya disebut sebagai
        &ldquo;<strong>PIHAK KEDUA</strong>&rdquo;.</td>
      </tr>
    </tbody>
  </table>

  <p><strong>PIHAK PERTAMA</strong> dan <strong>PIHAK KEDUA</strong> selanjutnya masing-masing
  disebut &ldquo;<strong>PIHAK</strong>&rdquo; dan secara bersama-sama disebut
  &ldquo;<strong>PARA PIHAK</strong>&rdquo;, <strong>PARA PIHAK</strong> dalam kedudukannya
  tersebut diatas terlebih dahulu menerangkan sebagai berikut:</p>

  ${ol([
    'Bahwa <strong>PIHAK PERTAMA</strong> adalah perusahaan teknologi pendidikan yang memproduksi '
    + 'dan memberikan layanan pembelajaran hard skills, soft skills dan life skills secara '
    + 'Omni-Learning berupa integrasi <em>online</em> dan <em>offline</em> terpadu dengan teknologi '
    + 'canggih dengan nama merek Skolla;',
    `Bahwa <strong>PIHAK KEDUA</strong> adalah ${JENJANG_PANJANG[d.sekolah.jenjang]} yang bergerak `
    + 'dalam pendidikan formal;',
  ], 'huruf')}

  <p>Berdasarkan hal-hal sebagaimana tersebut di atas, <strong>PARA PIHAK</strong> sepakat untuk
  membuat <strong>Perjanjian Kerja Sama tentang PEMBELIAN PAKET ${paket}</strong> dengan ketentuan
  sebagai berikut:</p>

  ${pasal(1, 'MAKSUD DAN TUJUAN', ol([
    `Maksud dari Perjanjian Kerja Sama ini adalah sebagai dasar hukum kerja sama antara `
    + `<strong>PIHAK PERTAMA</strong> dan <strong>PIHAK KEDUA</strong> dalam <strong>PAKET ${paket}</strong> `
    + `khususnya pada ${sekolah}.`,
    'Tujuan Perjanjian Kerja Sama ini adalah untuk menetapkan hak dan kewajiban '
    + '<strong>PARA PIHAK</strong> dalam pelaksanaan pembelian layanan, menjamin terlaksananya '
    + 'layanan sesuai jumlah dan nilai yang disepakati, serta memberikan kepastian hukum dan '
    + 'kepastian pelaksanaan kerja sama antara <strong>PARA PIHAK</strong>.',
  ]))}

  ${pasal(2, 'RUANG LINGKUP', ol([
    `<strong>PARA PIHAK</strong> setuju dan sepakat bahwa ruang lingkup Perjanjian Kerja Sama ini `
    + `meliputi pemberian layanan PAKET ${paket} oleh <strong>PIHAK PERTAMA</strong> berupa:`
    + ul(d.layanan.map(esc)),
    'Ruang lingkup kerja sama ini dapat dikembangkan secara berkesinambungan sesuai dengan '
    + 'kebutuhan dan kesanggupan <strong>PARA PIHAK</strong>.',
  ]))}

  ${pasal(3, 'JANGKA WAKTU', ol([
    `Perjanjian Kerja Sama ini berlaku sejak ditandatangani oleh <strong>PARA PIHAK</strong> sampai `
    + `dengan tanggal ${esc(tglID(d.masaSelesai))} dan dapat diperpanjang berdasarkan kesepakatan `
    + `<strong>PARA PIHAK</strong> dengan rincian:`
    + ul([`PAKET ${paket} dimulai pada tanggal ${esc(tglID(d.masaMulai))} sampai dengan `
      + `${esc(tglID(d.masaSelesai))}.`]),
    'Selama jangka waktu tersebut <strong>PARA PIHAK</strong> wajib menunjukan itikad baik, '
    + 'mematuhi dan mentaati seluruh isi Perjanjian Kerja Sama ini.',
  ]))}

  ${pasal(4, 'KEWAJIBAN PARA PIHAK', ol([
    '<strong>PIHAK PERTAMA</strong> berkewajiban untuk:' + ol([
      'Memberikan <em>onboarding</em> aktivasi akun kepada Sekolah;',
      `Menyelenggarakan layanan PAKET ${paket} sesuai kesepakatan kepada <strong>PIHAK KEDUA</strong>.`,
      'Menyediakan layanan <em>after sales</em> atau <em>customer service</em> kepada '
      + '<strong>PIHAK KEDUA</strong> sebagai antisipasi jika terjadi kendala selama program berlangsung.',
    ], 'huruf'),
    '<strong>PIHAK KEDUA</strong> berkewajiban untuk:' + ol([
      'Memberikan rekap data siswa/i yang berisikan nama, jenjang, kelas, email, dan nomor telepon '
      + 'yang akan didaftarkan ke aplikasi;',
      `Membayar biaya layanan program kepada <strong>PIHAK PERTAMA</strong> sebesar ${nilai}, `
      + `yang terdiri atas:`
      + ul([`PAKET ${paket} untuk ${gabung(rincianPeserta)} dengan total biaya layanan senilai ${nilai}.`]),
      'Menyediakan dukungan operasional dan administratif selama kegiatan berlangsung.',
    ], 'huruf'),
  ]))}

  ${pasal(5, 'HAK PARA PIHAK', ol([
    '<strong>PIHAK PERTAMA</strong> berhak untuk:' + ol([
      'Mendapatkan rekap data siswa/i yang berisikan nama, jenjang, kelas, email, dan nomor telepon '
      + 'yang akan didaftarkan ke aplikasi;',
      `Mendapatkan pembayaran biaya layanan program dari <strong>PIHAK KEDUA</strong> sebesar `
      + `${nilai} atas pemberian layanan PAKET ${paket}.`,
      'Mendapatkan dukungan operasional dan administratif selama kegiatan berlangsung.',
    ], 'huruf'),
    '<strong>PIHAK KEDUA</strong> berhak untuk:' + ol([
      'Mendapatkan <em>onboarding</em> aktivasi kepada Sekolah;',
      `Mendapatkan penyelenggaraan layanan PAKET ${paket}.`,
      'Mendapatkan layanan <em>after sales</em> atau <em>customer service</em> dari '
      + '<strong>PIHAK PERTAMA</strong> sebagai antisipasi jika terjadi kendala selama program berlangsung.',
    ], 'huruf'),
  ]))}

  ${pasal(6, 'MEKANISME PEMBAYARAN', ol([
    `Nilai layanan adalah sebesar ${nilai} dibayarkan oleh <strong>PIHAK KEDUA</strong> kepada `
    + `<strong>PIHAK PERTAMA</strong> secara transfer bank ke rekening resmi `
    + `<strong>PIHAK PERTAMA</strong> yang akan diinformasikan melalui <em>invoice</em> resmi;`,
    'Pembayaran pada poin 1 (satu) di atas dilakukan dengan termin pembayaran sebagai berikut:'
    + ol(barisTermin, 'huruf'),
    'Pembayaran dilakukan oleh <strong>PIHAK KEDUA</strong> kepada rekening resmi milik '
    + '<strong>PIHAK PERTAMA</strong>, sebagai berikut:'
    + `<table class="pks-rekening"><tbody>
        <tr><td>Bank</td><td>: Bank BRI</td></tr>
        <tr><td>Nama Rekening</td><td>: PT Teman Satu Skolla</td></tr>
        <tr><td>Nomor Rekening</td><td>: 122201000071305</td></tr>
      </tbody></table>`,
    'Nilai pembelian layanan sebagaimana dimaksud pada ayat (1) merupakan nilai minimum yang tidak '
    + 'dapat dikurangi, namun dapat ditambah berdasarkan kesepakatan tertulis '
    + '<strong>PARA PIHAK</strong> dalam Addendum.',
    // PAJAK: PKS asli menyatakan nilai "belum termasuk pajak" dan membebankannya
    // ke sekolah. Itu bertentangan dengan pricelist, yang harganya sudah termasuk
    // pajak. Rizki menyatakan pricelist yang benar dan templatnya yang diperbaiki.
    'Nilai layanan sebagaimana dimaksud pada ayat (1) <strong>sudah termasuk pajak</strong>. '
    + 'Seluruh kewajiban perpajakan yang timbul sehubungan dengan pelaksanaan Perjanjian ini '
    + 'menjadi tanggung jawab <strong>PIHAK PERTAMA</strong> dan tidak menambah nilai pembayaran '
    + 'yang harus ditanggung <strong>PIHAK KEDUA</strong> sebagaimana tercantum dalam Perjanjian.',
  ]))}

  ${pasal(7, 'DENDA DAN PENALTI', ol([
    'Sebagai bentuk komitmen, dalam hal <strong>PIHAK KEDUA</strong> menghentikan atau mengakhiri '
    + 'kerja sama sebelum masa perjanjian berakhir, tanpa adanya kesalahan atau wanprestasi dari '
    + '<strong>PIHAK PERTAMA</strong>, maka berlaku ketentuan sebagai berikut:' + ol([
      'Apabila penghentian dilakukan pada 1 (satu) sampai dengan 3 (tiga) bulan sejak '
      + 'ditandatanganinya perjanjian ini, maka <strong>PIHAK KEDUA</strong> tetap wajib melakukan '
      + 'pembayaran sebesar 50% (lima puluh persen) dari total nilai perjanjian.',
      'Apabila penghentian dilakukan setelah melewati 3 (tiga) bulan sejak ditandatanganinya '
      + 'perjanjian ini, maka <strong>PIHAK KEDUA</strong> wajib melakukan pembayaran penuh (100%) '
      + 'sesuai dengan nilai perjanjian yang telah disepakati sejak awal.',
    ], 'huruf'),
    'Ketentuan pembayaran sebagaimana dimaksud pada ayat (1) berlaku tanpa mengurangi hak '
    + 'pembayaran kepada <strong>PIHAK PERTAMA</strong> atas layanan yang telah diberikan selama '
    + 'periode kerja sama berjalan.',
    'Apabila terjadi pembatalan sepihak oleh <strong>PIHAK PERTAMA</strong> yang bukan disebabkan '
    + 'oleh kelalaian atau wanprestasi <strong>PIHAK KEDUA</strong>, maka '
    + '<strong>PIHAK PERTAMA</strong> wajib mengembalikan biaya layanan yang telah dibayarkan oleh '
    + '<strong>PIHAK KEDUA</strong> secara proporsional terhadap layanan yang belum berjalan '
    + '(<em>unutilized service</em>), ditambah kewajiban membayar penalti sebesar 5% (lima persen) '
    + 'dari nilai sisa layanan yang belum berjalan tersebut.',
    'Jika <strong>PIHAK KEDUA</strong> telat membayarkan kewajiban biaya layanan dan tidak '
    + 'menyampaikan surat pernyataan komitmen pembayaran, maka untuk setiap hari keterlambatan '
    + '<strong>PIHAK KEDUA</strong> wajib membayar denda keterlambatan 1 o/oo (satu permil) per hari '
    + 'dari jumlah pembayaran biaya layanan;',
    'Dana sanksi keterlambatan yang dibayarkan oleh <strong>PIHAK KEDUA</strong> sepenuhnya akan '
    + 'disalurkan untuk kegiatan sosial atau disedekahkan.',
  ]))}

  ${pasal(8, 'KERAHASIAAN', ol([
    '<strong>PARA PIHAK</strong> sepakat untuk menjaga kerahasiaan seluruh data dan informasi yang '
    + 'diperoleh dalam rangka pelaksanaan Perjanjian Kerja Sama ini, termasuk namun tidak terbatas pada:'
    + ol([
      'Data pribadi peserta didik;', 'Data internal sekolah;',
      'Materi, instrumen, perangkat lunak dan sistem milik <strong>PIHAK PERTAMA</strong>;',
      'Hasil laporan kerja sama dan analisis internal.',
    ], 'huruf'),
    '<strong>PARA PIHAK</strong> tidak diperkenankan mengungkap, menggandakan, atau menyebarluaskan '
    + 'informasi tersebut kepada pihak ketiga tanpa persetujuan tertulis dari pihak yang memberikan '
    + 'informasi.',
    'Apabila terjadi pelanggaran terhadap ketentuan ini, pihak yang melakukan pelanggaran wajib '
    + 'memberikan ganti rugi sesuai dengan besarnya kerugian yang ditimbulkan, dan dapat '
    + 'ditindaklanjuti melalui proses hukum sesuai ketentuan perundang-undangan yang berlaku, '
    + 'termasuk Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi.',
  ]))}

  ${pasal(9, 'LARANGAN PENYIMPANGAN BIAYA DAN ANTI KORUPSI', ol([
    '<strong>PARA PIHAK</strong> dilarang keras melakukan segala bentuk tindakan korupsi, kolusi, '
    + 'nepotisme, atau praktik tidak etis lainnya, termasuk namun tidak terbatas pada:' + ol([
      `Permintaan atau pemberian uang di luar dari total nilai kerja sama yang telah ditentukan `
      + `yaitu sebesar ${nilai};`,
      'Gratifikasi, suap, komisi tersembunyi, imbalan pribadi, atau bentuk lain yang berpotensi '
      + 'menimbulkan konflik kepentingan;',
      'Pemalsuan dokumen, persekongkolan harga, atau penggelapan dana.',
    ], 'huruf'),
    '<strong>PARA PIHAK</strong> sepakat untuk menjalankan seluruh ketentuan dalam Perjanjian ini '
    + 'dengan menjunjung tinggi prinsip integritas, transparansi, dan akuntabilitas, serta '
    + 'berkomitmen untuk tidak melakukan tindakan yang dapat dikategorikan sebagai tindak pidana '
    + 'korupsi sebagaimana diatur dalam Undang-Undang Republik Indonesia Nomor 31 Tahun 1999 jo. '
    + 'UU No. 20 Tahun 2001 tentang Pemberantasan Tindak Pidana Korupsi;',
    'Apabila terdapat indikasi pelanggaran terhadap ketentuan pasal ini, maka:' + ol([
      '<strong>PARA PIHAK</strong> sepakat untuk melakukan pemeriksaan internal dan melaporkannya '
      + 'kepada penegak hukum atau instansi berwenang;',
      'Pihak yang terbukti melakukan pelanggaran dikenakan sanksi pemutusan kerja sama secara '
      + 'sepihak, tanpa mengurangi hak Pihak lain untuk menuntut ganti rugi dan/atau melaporkan '
      + 'kepada aparat penegak hukum.',
    ], 'huruf'),
  ]))}

  ${pasal(10, 'PENYELESAIAN PERSELISIHAN', ol([
    'Dalam hal terjadi perselisihan atau perbedaan penafsiran yang timbul berdasarkan atau '
    + 'sehubungan dengan Perjanjian Kerja Sama ini, maka salah satu Pihak dapat memberikan '
    + 'notifikasi tertulis untuk melakukan musyawarah dalam waktu 7 (tujuh) hari kalender sejak '
    + 'timbulnya perselisihan atau perbedaan penafsiran tersebut '
    + '(&ldquo;<strong>Pemberitahuan Perselisihan</strong>&rdquo;);',
    'Dalam waktu selambat-lambatnya 3 (tiga) hari kalender sejak Pemberitahuan Perselisihan, '
    + '<strong>PARA PIHAK</strong> sepakat untuk menyelesaikan perselisihan tersebut secara '
    + 'musyawarah untuk mufakat;',
    'Apabila tidak tercapai kata mufakat, maka dalam jangka waktu 14 (empat belas) hari kalender '
    + 'sejak Pemberitahuan Perselisihan diberikan oleh Pihak yang merasa dirugikan kepada Pihak '
    + 'lainnya tersebut, <strong>PARA PIHAK</strong> sepakat untuk menyelesaikan perselisihan '
    + 'melalui Badan Arbitrase Nasional Indonesia (BANI) dengan menunjuk 3 (tiga) Arbiter sesuai '
    + 'dengan Peraturan BANI;',
    'Pelaksanaan Arbitrase bertempat di Jakarta dan Bahasa yang digunakan adalah Bahasa Indonesia. '
    + 'Keputusan Arbitrase yang dihasilkan bersifat final dan mengikat <strong>PARA PIHAK</strong> '
    + 'serta tidak dapat diajukan upaya hukum apapun;',
    'BANI sebagaimana dimaksud adalah BANI yang didirikan berdasarkan Surat Keputusan Kamar Dagang '
    + 'dan Industri Indonesia No. SKEP/152/DPH/1977 tanggal 30 November 1977 tentang Badan Arbitrase '
    + 'Nasional Indonesia dan beralamat di Wahana Graha Lt. 1 &amp; 2, Jalan Mampang Prapatan No. 2, '
    + 'Duren Tiga, Pancoran, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12760.',
  ]))}

  ${pasal(11, 'KORESPONDENSI', `
    <p>Segala surat menyurat dan/atau pemberitahuan yang diperlukan dan diharuskan dalam
    melaksanakan Perjanjian Kerja Sama harus disampaikan kepada <strong>PARA PIHAK</strong> yang
    bersangkutan pada alamat dan tujuan sebagai berikut:</p>
    <div class="pks-korespondensi">
      <div>
        <p><strong>PIHAK PERTAMA</strong><br><strong>PT TEMAN SATU SKOLLA</strong></p>
        <table class="pks-rekening"><tbody>
          <tr><td>Telepon</td><td>: 0878-2228-9992</td></tr>
          <tr><td>Email</td><td>: ${kosong(20)}</td></tr>
          <tr><td>Up.</td><td>: Partnership Manager</td></tr>
        </tbody></table>
      </div>
      <div>
        <p><strong>PIHAK KEDUA</strong><br><strong>${sekolah}</strong></p>
        <table class="pks-rekening"><tbody>
          <tr><td>Telepon</td><td>: ${d.sekolah.telepon ? esc(d.sekolah.telepon) : kosong(20)}</td></tr>
          <tr><td>Email</td><td>: ${kosong(20)}</td></tr>
          <tr><td>Up.</td><td>: Kepala Sekolah</td></tr>
        </tbody></table>
      </div>
    </div>`)}

  ${pasal(12, 'FORCE MAJEURE', ol([
    '<em>Force Majeure</em> adalah keadaan di luar kemampuan dan kendali '
    + '<strong>PARA PIHAK</strong> yang secara langsung menghambat pelaksanaan Perjanjian, sepanjang '
    + 'bukan disebabkan oleh kelalaian atau kesalahan <strong>PIHAK</strong> yang mengalaminya.',
    '<em>Force Majeure</em> meliputi namun tidak terbatas pada bencana alam, pandemi, perang, '
    + 'kerusuhan, kebijakan pemerintah, perubahan peraturan perundang-undangan, tindakan otoritas, '
    + 'pemadaman listrik massal, gangguan jaringan internet nasional, gangguan sistem teknologi '
    + 'berskala luas di luar kendali <strong>PIHAK PERTAMA</strong>, serta keadaan kahar lainnya.',
    '<strong>PIHAK</strong> yang mengalami <em>Force Majeure</em> wajib memberitahukan secara '
    + 'tertulis kepada <strong>PIHAK</strong> lainnya paling lambat 7 (tujuh) Hari Kalender sejak '
    + 'terjadinya peristiwa tersebut, disertai penjelasan dan bukti yang wajar.',
    'Selama <em>Force Majeure</em> berlangsung, kewajiban <strong>PIHAK</strong> yang terdampak '
    + 'ditangguhkan sementara dan dibebaskan dari denda, penalti, atau ganti rugi atas keterlambatan '
    + 'atau kegagalan yang secara langsung disebabkan oleh <em>Force Majeure</em>.',
    'Apabila <em>Force Majeure</em> berlangsung lebih dari 30 (tiga puluh) Hari Kalender '
    + 'berturut-turut, <strong>PARA PIHAK</strong> akan bermusyawarah untuk menentukan kelanjutan, '
    + 'penyesuaian, atau pengakhiran Perjanjian tanpa tuntutan ganti rugi.',
    'Pengakhiran Perjanjian akibat <em>Force Majeure</em> tidak menghapus hak dan kewajiban yang '
    + 'telah timbul sebelumnya. Pembayaran atas layanan <strong>PIHAK PERTAMA</strong> yang telah '
    + 'diberikan dan/atau dimanfaatkan oleh <strong>PIHAK KEDUA</strong> tidak dapat diminta kembali.',
  ]))}

  ${pasal(13, 'ADDENDUM', ol([
    'Setiap perubahan, penambahan, atau pengurangan terhadap isi perjanjian ini hanya dapat '
    + 'dilakukan dengan persetujuan bersama secara tertulis oleh <strong>PARA PIHAK</strong>.',
    'Perubahan tersebut harus dituangkan dalam bentuk Addendum Perjanjian yang ditandatangani oleh '
    + '<strong>PARA PIHAK</strong> dan menjadi satu kesatuan yang tidak terpisahkan dari perjanjian ini.',
    'Addendum dapat memuat antara lain namun tidak terbatas pada hal-hal berikut:' + ol([
      'Penyesuaian jadwal pelaksanaan program;',
      'Skema pembayaran bertahap atau perubahan nominal layanan;',
      'Penambahan atau pengurangan bentuk layanan.',
    ], 'huruf'),
    'Selama belum ada Addendum yang ditandatangani, maka seluruh ketentuan dalam perjanjian pokok '
    + 'ini tetap berlaku dan mengikat <strong>PARA PIHAK</strong>.',
  ]))}

  ${pasal(14, 'PENUTUP', `
    <p>Demikian Perjanjian Kerja Sama ini dibuat dan ditandatangani oleh
    <strong>PARA PIHAK</strong> dalam 2 (dua) rangkap asli, ditandatangani dan bermaterai cukup yang
    masing-masing mempunyai kekuatan hukum yang sama serta mengikat <strong>PARA PIHAK</strong>
    sejak tanggal penandatanganan.</p>`)}

  <table class="pks-ttd">
    <tbody><tr>
      <td>
        <strong>PIHAK PERTAMA</strong><br><strong>PT TEMAN SATU SKOLLA</strong>
        <span class="pks-ruang-ttd"></span>
        <strong>MUH AKBAR BUANA TAFSILI, MBA</strong><br><strong>CHIEF BUSINESS OFFICER</strong>
      </td>
      <td>
        <strong>PIHAK KEDUA</strong><br><strong>${sekolah}</strong>
        <span class="pks-ruang-ttd"></span>
        <strong>${kepsek}</strong><br><strong>KEPALA SEKOLAH</strong>
      </td>
    </tr></tbody>
  </table>
</article>`;
}
