/**
 * Membagi isi PKS ke dalam halaman A4 berdasarkan tinggi sebenarnya di peramban.
 *
 * Dipisah dari komponennya supaya bisa dijalankan apa adanya terhadap dokumen
 * nyata: inilah bagian yang diam-diam bisa memotong isi perjanjian bila keliru.
 *
 * Pemecahan menelusuri daftar bersarang, bukan hanya butir tingkat atas. Daftar
 * termin hidup sebagai satu butir di dalam ayat Pasal 6; tanpa penelusuran itu,
 * PKS dengan banyak termin menghasilkan satu butir yang lebih tinggi dari satu
 * halaman dan isinya hilang di balik batas halaman.
 *
 * Seluruh pembantunya sengaja disarangkan di dalam fungsi ini. Pembuatan PDF di
 * server menjalankan fungsi yang sama di dalam peramban lewat
 * Function.prototype.toString; rujukan ke fungsi di luar cakupannya akan hilang
 * di sana, dan halaman PDF jadi berbeda dari yang dilihat di layar.
 *
 * @param wadah  Wadah pengukur berisi <article class="pks">, selebar area isi halaman.
 * @param batas  Tinggi area isi satu halaman, dalam piksel.
 */
export function paginasiPks(wadah: HTMLElement, batas: number): string[] {
  /** Tinggi elemen berikut jarak antar-blok di sekitarnya. */
  function tinggi(el: HTMLElement): number {
    const g = getComputedStyle(el);
    return el.getBoundingClientRect().height
      + parseFloat(g.marginTop) + parseFloat(g.marginBottom);
  }

  function daftarAnak(el: HTMLElement) { return el.querySelector(':scope > ol'); }

  /** Menyalin kerangka elemen tanpa isinya. */
  function kerangka(el: HTMLElement) { return el.cloneNode(false) as HTMLElement; }

  /**
   * Membelah satu blok berdaftar menjadi bagian yang muat dan sisanya.
   *
   * Berlaku untuk pasal (judul + daftar ayat) maupun butir (teks + daftar
   * bersarang). Mengembalikan [null, el] bila tidak ada yang muat sama sekali.
   */
  function belah(el: HTMLElement, ruang: number): [HTMLElement | null, HTMLElement | null] {
    // Elemen daftar dibelah pada dirinya sendiri; elemen lain dibelah pada
    // daftar yang dikandungnya. Tanpa cabang pertama, daftar yang berdiri
    // sendiri — seperti butir pembuka sebelum Pasal 1 — pindah utuh ke halaman
    // berikutnya dan meninggalkan ruang kosong sepertiga halaman.
    const daftarSendiri = el.tagName === 'OL';
    const ol = daftarSendiri ? el : daftarAnak(el);
    if (!ol) return [null, el];

    // Semua simpul sebelum daftar, termasuk simpul teks: teks pembuka sebuah
    // butir hidup sebagai simpul teks, dan menyaring hanya elemen akan
    // membuangnya diam-diam dari perjanjian.
    const kepala: Node[] = [];
    if (!daftarSendiri) {
      for (const n of [...el.childNodes]) {
        if (n === ol) break;
        kepala.push(n);
      }
    }
    const pakaiKepala = kepala
      .filter((n): n is HTMLElement => n.nodeType === 1)
      .reduce((a, n) => a + tinggi(n), 0);

    const butir = [...ol.children] as HTMLElement[];
    const mulai = Number(ol.getAttribute('start') || 1);

    // Marjin dan jarak milik blok itu sendiri — selisih antara tingginya dan
    // jumlah tinggi isinya. Tanpa ini potongan selalu sedikit lebih tinggi dari
    // perkiraan dan halaman meluber beberapa milimeter.
    const beban = Math.max(0,
      tinggi(el) - pakaiKepala - butir.reduce((a, b) => a + tinggi(b), 0));
    const muatSampai = ruang - beban;
    if (pakaiKepala >= muatSampai) return [null, el];

    let pakai = pakaiKepala;
    let n = 0;
    while (n < butir.length && pakai + tinggi(butir[n]) <= muatSampai) {
      pakai += tinggi(butir[n]);
      n++;
    }

    // Butir yang menghadang mungkin masih bisa dibelah dari dalam — inilah yang
    // menyelamatkan ayat berisi daftar termin panjang. Bila tidak ada yang muat,
    // butir itu dibiarkan utuh di sisa; ia TIDAK boleh dipakai apa adanya,
    // karena memasukkannya berarti memindahkan node asli keluar dari sumber.
    let potongan: HTMLElement | null = null;
    let sisaButir: HTMLElement | null = null;
    if (n < butir.length) {
      const [p, sisaDalam] = belah(butir[n], muatSampai - pakai);
      if (p) { potongan = p; sisaButir = sisaDalam; }
    }
    if (n === 0 && !potongan) return [null, el];

    const salinOl = (awal: number, isi: HTMLElement[]) => {
      const baru = kerangka(ol as HTMLElement);
      baru.setAttribute('start', String(awal));
      isi.forEach((b) => baru.appendChild(b));
      return baru;
    };
    const klon = (d: HTMLElement[]) => d.map((b) => b.cloneNode(true) as HTMLElement);

    const isiAwal = [...klon(butir.slice(0, n)), ...(potongan ? [potongan] : [])];
    let bagian: HTMLElement;
    if (daftarSendiri) {
      bagian = salinOl(mulai, isiAwal);
    } else {
      bagian = kerangka(el);
      kepala.forEach((h) => bagian.appendChild(h.cloneNode(true)));
      bagian.appendChild(salinOl(mulai, isiAwal));
    }

    // Butir yang tersisa: sambungan butir yang terbelah, lalu butir sesudahnya.
    const mulaiSisa = n + (potongan ? 1 : 0);
    const ekor = [...(sisaButir ? [sisaButir] : []), ...klon(butir.slice(mulaiSisa))];
    if (!ekor.length) return [bagian, null];
    if (daftarSendiri) return [bagian, salinOl(mulai + n, ekor)];

    const sisa = kerangka(el);
    // Judul pasal diulang dengan penanda, supaya pembaca tahu ini sambungan.
    const judul = el.querySelector(':scope > h3');
    if (judul) {
      const lanjutan = judul.cloneNode(true) as HTMLElement;
      const nama = lanjutan.querySelector('span');
      if (nama) nama.textContent = `${nama.textContent} (lanjutan)`;
      sisa.appendChild(lanjutan);
    }
    sisa.appendChild(salinOl(mulai + n, ekor));
    return [bagian, sisa];
  }

  const artikel = wadah.querySelector('.pks');
  if (!artikel) return [];

  const keluar: string[] = [];
  let kini = '';
  let terpakai = 0;

  // Potongan hasil belahan harus menempel di wadah supaya bisa diukur. Hanya
  // yang kita tempelkan yang dilepas lagi — melepas atau memindahkan node asli
  // membuat pengukuran berikutnya kehilangan pasal.
  const ditempel = new Set<HTMLElement>();
  const tempel = (n: HTMLElement) => { wadah.appendChild(n); ditempel.add(n); };
  const lepas = (n: HTMLElement) => {
    if (ditempel.delete(n) && n.parentNode === wadah) wadah.removeChild(n);
  };
  const tutup = () => { if (kini) { keluar.push(kini); kini = ''; terpakai = 0; } };

  const taruh = (awal: HTMLElement) => {
    let node: HTMLElement | null = awal;
    for (let putaran = 0; node && putaran < 200; putaran++) {
      const t = tinggi(node);
      if (terpakai + t <= batas) { kini += node.outerHTML; terpakai += t; lepas(node); return; }

      const [muat, sisa] = belah(node, batas - terpakai);
      if (!muat) {
        // Tidak ada yang muat di sisa halaman ini. Kalau halamannya memang sudah
        // kosong, blok ini tidak akan pernah muat: keluarkan apa adanya agar
        // isinya tetap tercetak, biar meluber daripada hilang.
        if (terpakai === 0) { kini = node.outerHTML; terpakai = t; lepas(node); return; }
        tutup();
        continue;
      }
      kini += muat.outerHTML;
      tutup();
      lepas(node);
      if (!sisa) return;
      node = sisa;
      tempel(node);
    }
    if (node) { kini += node.outerHTML; lepas(node); }
  };

  ([...artikel.children] as HTMLElement[]).forEach((el) => taruh(el));
  if (kini) keluar.push(kini);
  return keluar.filter((h) => h.trim());
}
