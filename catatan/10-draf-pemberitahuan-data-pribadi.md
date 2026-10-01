# Draf pemberitahuan data pribadi — untuk ditinjau legal

Status: **DRAF. Belum ditinjau, belum dipasang ke dokumen mana pun.**

Ditulis 9 Sep 2026 sebagai bahan tinjauan, bukan sebagai teks final. Keputusan
kebijakannya sudah diambil (lihat `catatan/retensi-data-pribadi.md`); yang belum ada
adalah kalimatnya.

**Jangan memasang teks ini ke Form Pre-Order atau PKS sebelum ditinjau orang legal.**
Memasang kalimat kewajiban hukum yang belum ditinjau ke lembar yang ditandatangani
sekolah bukan mengurangi risiko — ia memindahkannya, dan menambah kesan bahwa
kewajibannya sudah dipenuhi.

## Kenapa ini ada

UU PDP 27/2022 mewajibkan pemberitahuan tujuan pemrosesan dan masa simpan kepada
subjek data. Di sistem ini subjek datanya **individu**, bukan sekolah sebagai lembaga:
kepala sekolah dan bendahara — nama, nomor HP, dan tanda tangan mereka.

Diputuskan 9 Sep 2026: pemberitahuan dipasang di **Form Pre-Order dan PKS**.

## Draf A — Form Pre-Order (halaman 3, bagian catatan)

Ringkas, karena tempatnya sempit dan pembacanya sedang menandatangani.

> **Pemberitahuan Pelindungan Data Pribadi**
>
> Skolla memproses nama, nomor telepon, dan tanda tangan kepala sekolah serta bendahara
> untuk keperluan penyusunan, verifikasi, dan pelaksanaan kerja sama ini. Gambar tanda
> tangan pada dokumen ini disimpan paling lama 12 bulan setelah perjanjian kerja sama
> ditandatangani, sedangkan dokumen perjanjian beserta pindaiannya disimpan sesuai
> kewajiban penyimpanan dokumen perusahaan. Bapak/Ibu berhak meminta akses, perbaikan,
> atau penghapusan data pribadi sesuai UU No. 27 Tahun 2022 melalui
> [alamat kontak — BELUM DITENTUKAN].

## Draf B — PKS (pasal tersendiri)

Lebih lengkap, karena PKS adalah dokumen yang mengikat.

> **Pasal … — Pelindungan Data Pribadi**
>
> 1. PARA PIHAK sepakat bahwa data pribadi yang dipertukarkan dalam Perjanjian ini
>    terbatas pada nama, jabatan, nomor telepon, dan tanda tangan wakil masing-masing
>    pihak, serta data peserta didik sebagaimana diperlukan untuk pelaksanaan layanan.
> 2. PIHAK PERTAMA memproses data tersebut semata-mata untuk penyusunan, verifikasi,
>    pelaksanaan, dan pelaporan Perjanjian ini.
> 3. Gambar tanda tangan pada dokumen prapesanan disimpan paling lama 12 (dua belas)
>    bulan sejak Perjanjian ini ditandatangani. Perjanjian ini beserta pindaiannya
>    disimpan sesuai kewajiban penyimpanan dokumen perusahaan.
> 4. PIHAK PERTAMA menerapkan langkah pengamanan yang wajar dan tidak mengalihkan data
>    tersebut kepada pihak ketiga selain pemroses yang ditunjuk berdasarkan perjanjian
>    pemrosesan data.
> 5. Subjek data berhak mengajukan akses, perbaikan, dan penghapusan sesuai UU No. 27
>    Tahun 2022 melalui kontak yang tercantum dalam Perjanjian ini.

## Yang HARUS dipastikan legal, bukan oleh saya

1. **Apakah dasar hukum pemrosesannya persetujuan atau pelaksanaan perjanjian.**
   Draf di atas menghindari kata "persetujuan" karena kalau dasarnya pelaksanaan
   perjanjian, meminta persetujuan justru mengaburkan — dan persetujuan bisa ditarik,
   sementara kewajiban penyimpanan dokumen tidak bisa dibatalkan sepihak.
2. **Alamat kontak untuk permintaan subjek data.** Belum ada, dan tanpa itu kalimat
   "berhak meminta" jadi kosong.
3. **Ayat 4 pada Draf B** menyiapkan jalan untuk ekstraksi pindaian di kemudian hari,
   yang pemrosesannya boleh di luar negeri **dengan** perjanjian pemrosesan data
   (keputusan 9 Sep 2026, lihat `catatan/08-spesifikasi-po-unggahan.md`). Perlu
   dipastikan bunyinya memang cukup sebagai dasar transfer lintas negara — kalau tidak,
   ayatnya perlu diperluas SEBELUM fase dua dimulai, bukan sesudah.
4. **Data peserta didik.** Sistem menyimpan jumlah siswa per rombel, bukan identitas
   siswa. Tapi layanannya sendiri memproses data siswa. Perlu dipastikan batas antara
   apa yang diatur PKS ini dan apa yang diatur perjanjian layanan.
5. **Apakah 12 bulan bisa dipertahankan** sebagai "tidak lebih lama dari yang
   diperlukan", mengingat pindaian PO unggahan memuat tanda tangan yang sama dan
   disimpan tanpa batas.

Butir 5 adalah ketidaklurusan yang sudah kami pilih sadar dan tercatat, tapi justru
karena itu ia perlu dilihat orang yang tahu apakah ia bisa dibela.

## Kalau sudah ditinjau

Masa simpan hidup sebagai **satu konstanta** yang dipakai kedua dokumen —
`lib/retensi.ts`, sudah dibuat. Jangan mengetik "12 bulan" langsung di templat: kalau
diketik dua kali, keduanya akan menyimpang saat kebijakannya berubah, dan yang tercetak
di dokumen bermeterai adalah yang salah.

Untuk **PO unggahan**, kertasnya dicetak Sales sendiri dan bisa templat lama tanpa
kalimat ini. Karena itu Sales mencentang konfirmasi bahwa pemberitahuan sudah
disampaikan — bukan mengandalkan kertasnya memuat teks yang benar.
