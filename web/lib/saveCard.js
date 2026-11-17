'use client';
/**
 * Save one rendered ID card as a PNG (3× resolution: 900 × 1434 px for the 300 × 478 px card),
 * so it matches the on-screen card exactly (built-in designs and custom templates).
 */
export async function saveCardPng(cardEl, filename = 'id-card.png') {
  if (!cardEl) return;
  const card = cardEl.classList?.contains('idcard') ? cardEl : cardEl.querySelector('.idcard');
  if (!card) return;

  const { toPng } = await import('html-to-image');
  // wait for the photo / QR / logo images and fonts
  await Promise.all([
    document.fonts?.ready,
    ...[...card.querySelectorAll('img')].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))),
  ]);

  const opts = {
    pixelRatio: 3,
    style: { boxShadow: 'none', transform: 'none', margin: '0', animation: 'none' },
  };
  // the first pass loads embedded images/fonts into the clone; the second renders reliably (Safari / some Chrome builds)
  await toPng(card, opts).catch(() => null);
  const url = await toPng(card, opts);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
