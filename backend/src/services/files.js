'use strict';
// Verify real content, not just the client-declared mimetype.
function sniff(buf) {
  if (buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (!buf.includes(0)) { try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return 'text/plain'; } catch { /* not text */ } }
  return null;
}
module.exports = { sniff };
