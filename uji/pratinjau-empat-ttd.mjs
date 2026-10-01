// Halaman 2 Form PO empat kotak (catatan/23), ditulis sebagai halaman statis untuk dipotret
// dan diukur di lebar A4 (794px) dan 375px. viewport sengaja diwajibkan.
// EMAS=<nama> untuk memotret golden lain sebagai pembanding (mis. sma-paket-guru).
import { writeFileSync, readFileSync } from 'node:fs';
const html = readFileSync(new URL(`./emas/${process.env.EMAS || 'sma-empat-ttd'}.po.html`, import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
writeFileSync(new URL('./_empat-ttd.html', import.meta.url),
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">`
  + `<style>${css}</style></head><body>${html}</body></html>`);
console.log('uji/_empat-ttd.html ditulis');
