'use strict';
// Pure unit tests: no database, no HTTP.
const { validateSlot } = require('../src/services/booking');
const { sniff } = require('../src/services/files');

const doctor = { availability: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }, { dayOfWeek: 3, start: '13:00', end: '15:00' }] };
const NOW = new Date('2026-06-01T08:00:00Z'); // a Monday
const at = (iso) => new Date(iso);

describe('validateSlot (booking rules)', () => {
  test('accepts an aligned slot inside the doctor\'s hours', () => {
    expect(() => validateSlot(doctor, at('2026-06-08T09:30:00Z'), NOW)).not.toThrow();      // Monday 09:30
    expect(() => validateSlot(doctor, at('2026-06-10T14:30:00Z'), NOW)).not.toThrow();      // Wednesday, last slot of the day
  });
  test.each([
    ['not a date', new Date('nope'), /valid ISO date/],
    ['in the past', at('2026-05-31T09:00:00Z'), /future/],
    ['more than 180 days ahead', at('2027-01-05T09:00:00Z'), /days ahead/],
    ['not on a 30-minute boundary', at('2026-06-08T09:15:00Z'), /align/],
    ['with seconds', at('2026-06-08T09:00:30Z'), /align/],
    ['on a day the doctor does not work', at('2026-06-09T10:00:00Z'), /not available/],      // Tuesday
    ['before opening', at('2026-06-08T08:30:00Z'), /not available/],
    ['whose 30 minutes would run past closing', at('2026-06-08T11:45:00Z'), /align|not available/],
    ['exactly at closing time', at('2026-06-08T12:00:00Z'), /not available/],
  ])('rejects a slot %s', (_name, when, msg) => {
    expect(() => validateSlot(doctor, when, NOW)).toThrow(msg);
  });
});

describe('sniff (upload content check)', () => {
  test('recognises real file signatures regardless of the claimed type', () => {
    expect(sniff(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('image/jpeg');
    expect(sniff(Buffer.from('plain synthetic notes'))).toBe('text/plain');
  });
  test('rejects executables, binary data and invalid UTF-8', () => {
    expect(sniff(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toBeNull();                  // Windows executable header (contains NUL)
    expect(sniff(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x00]))).toBeNull();      // ELF
    expect(sniff(Buffer.from([0xc3, 0x28]))).toBeNull();                                    // invalid UTF-8
  });
});
