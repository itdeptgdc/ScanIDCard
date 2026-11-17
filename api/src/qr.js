/**
 * Signed QR payload printed on each card:   PRC1.<ID_NUMBER>.<SIGNATURE>
 *
 * SIGNATURE = HMAC-SHA256(QR_SECRET, "<ID_NUMBER>|<CARD_NUMBER>") (first 20 hex chars).
 * - The QR never reveals the card number, but proves the QR was issued for the card that
 *   is currently registered. Re-issuing a card (new card number) makes old QR codes invalid.
 * - A QR made by hand (e.g. someone types another person's ID into a QR generator) fails.
 * Hex keeps it case-insensitive, so USB/keyboard QR scanners with Caps Lock still work.
 */
const crypto = require('crypto');
const cfg = require('./config');
const { norm } = require('./util');

const PREFIX = 'PRC1';

const sign = (idNumber, cardNumber) =>
  crypto.createHmac('sha256', cfg.qrSecret).update(`${idNumber}|${cardNumber || ''}`).digest('hex').slice(0, 20);

const build = (staff) => `${PREFIX}.${staff.id_number}.${sign(staff.id_number, staff.card_number)}`;

/** Returns null when the text is not a signed card QR, otherwise { id, sig } (or { invalid: true }). */
function parse(raw) {
  if (raw.slice(0, PREFIX.length + 1).toUpperCase() !== `${PREFIX}.`) return null;
  const rest = raw.slice(PREFIX.length + 1);
  const i = rest.lastIndexOf('.');
  if (i <= 0) return { invalid: true };
  return { id: norm(rest.slice(0, i)), sig: rest.slice(i + 1).trim().toLowerCase() };
}

function verify(parsed, staff) {
  const expected = Buffer.from(sign(staff.id_number, staff.card_number));
  const got = Buffer.from(parsed.sig);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

module.exports = { build, parse, verify };
