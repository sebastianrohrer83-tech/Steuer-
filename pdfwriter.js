// Minimaler PDF-Writer: bettet JPEG-Seiten (DCTDecode) in A4-Seiten ein.
// Keine Abhängigkeiten, funktioniert offline.
const A4_W = 595.28;
const A4_H = 841.89;
// PDF-Textstring als UTF-16BE mit BOM (Umlaute bleiben erhalten)
function utf16Hex(str) {
  let out = 'FEFF';
  for (const ch of str) {
    let cp = ch.codePointAt(0);
    if (cp > 0xffff) { cp -= 0x10000; out += (0xd800 + (cp >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (cp & 0x3ff)).toString(16).padStart(4, '0'); }
    else out += cp.toString(16).padStart(4, '0');
  }
  return out.toUpperCase();
}
const num = (v) => (Math.round(v * 100) / 100).toString();

export async function makePdf(pages, meta = {}) {
  const enc = new TextEncoder();
  const parts = [];
  let offset = 0;
  const offsets = [];
  const push = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(b);
    offset += b.length;
  };
  const addObj = (n, body) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const n = pages.length;
  const objCount = 3 + 3 * n; // catalog, pages, info + 3 je Seite
  const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  addObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  const title = utf16Hex(meta.title || 'Dokument');
  addObj(3, `<< /Title <${title}> /Producer (Ordni) /Creator (Ordni) >>`);

  for (let i = 0; i < n; i++) {
    const pg = pages[i];
    const bytes = new Uint8Array(await pg.blob.arrayBuffer());
    const landscape = pg.w > pg.h;
    const pw = landscape ? A4_H : A4_W;
    const ph = landscape ? A4_W : A4_H;
    const s = Math.min(pw / pg.w, ph / pg.h);
    const iw = pg.w * s;
    const ih = pg.h * s;
    const x = (pw - iw) / 2;
    const y = (ph - ih) / 2;
    const pnum = 4 + i * 3;
    const inum = pnum + 1;
    const cnum = pnum + 2;

    addObj(pnum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pw)} ${num(ph)}] /Resources << /XObject << /Im${i} ${inum} 0 R >> >> /Contents ${cnum} 0 R >>`);

    offsets[inum] = offset;
    push(`${inum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push('\nendstream\nendobj\n');

    const content = `q ${num(iw)} 0 0 ${num(ih)} ${num(x)} ${num(y)} cm /Im${i} Do Q`;
    addObj(cnum, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  const xref = offset;
  push(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objCount; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
