'use client';
/**
 * Print one ID card on its own CR80 page (54 × 86 mm), with nothing else from the page.
 * The card's rendered HTML is copied into a hidden iframe together with the app's stylesheets,
 * so the printout matches the on-screen card exactly (built-in designs and custom templates).
 */
export function printCard(cardEl) {
  if (!cardEl) return;
  const card = cardEl.classList?.contains('idcard') ? cardEl : cardEl.querySelector('.idcard');
  if (!card) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join('\n');
  const doc = frame.contentDocument;
  doc.open();
  const title = `ID card ${card.querySelector('.idc-row .v, .idc-name b')?.textContent || ''}`.trim();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&"]/g, '')}</title><base href="${location.origin}/">${styles}
<style>
  @page { size: 54mm 86mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; width: 54mm; height: 86mm; overflow: hidden; background: #fff !important; }
  body::before, body::after { display: none !important; }
  .sheet { width: 54mm; height: 86mm; overflow: hidden; position: relative; }
  /* 300 × 478 px card -> 54 × 86 mm */
  .sheet .idcard { transform: scale(0.68) !important; transform-origin: top left !important; box-shadow: none !important; border-radius: 0 !important;
    outline: none !important; filter: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; animation: none !important; transition: none !important; }
  /* the app stylesheet hides everything except .print-area when printing - undo that here */
  @media print {
    @page { size: 54mm 86mm; margin: 0; }
    html, body, body * { visibility: visible !important; }
    .sheet { position: absolute; left: 0; top: 0; }
  }
</style></head><body><div class="sheet">${card.outerHTML}</div></body></html>`);
  doc.close();

  let printed = false;
  const go = () => {
    if (printed) return;
    printed = true;
    const w = frame.contentWindow;
    w.focus();
    w.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // wait for photo / background / QR images and fonts before printing
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const imgs = [...doc.images];
    const bgs = [...doc.querySelectorAll('[style*="background-image"]')]
      .map((el) => (el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1])
      .filter(Boolean)
      .map((src) => Object.assign(new Image(), { src }));
    const all = [...imgs, ...bgs].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; })));
    for (const l of doc.querySelectorAll('link[rel="stylesheet"]')) {
      if (!l.sheet) all.push(new Promise((r) => { l.onload = l.onerror = r; }));
    }
    Promise.race([Promise.all([...all, doc.fonts?.ready]), new Promise((r) => setTimeout(r, 4000))]).then(() => setTimeout(go, 150));
  };
  frame.onload = start;
  setTimeout(start, 1200); // some browsers fire load before the handler is attached
}
