import { canonicalString, computeSignature, signaturesMatch } from '../internal-signature';

describe('internal signature', () => {
  const secret = 'test-secret';
  const timestamp = '1700000000000';

  it('matches the vectors produced by the ai-api implementation', () => {
    expect(
      computeSignature({
        secret,
        timestamp,
        method: 'POST',
        target: '/api/v1/internal/resources/callback?type=EXTRACT',
        body: Buffer.from('{"resourceId":"x"}'),
      }),
    ).toBe('0731547b939105b307e9e4d0ca118d9019d4f7c3718cb4cac4af06a3b55e9a43');

    expect(
      computeSignature({
        secret,
        timestamp,
        method: 'GET',
        target: '/api/v1/internal/resources/abc',
        body: Buffer.alloc(0),
      }),
    ).toBe('e831a76ae7cec5845df9566562726ffe8b2d9aedeabb4fec5a5b741644f68fa5');
  });

  it('signs the acting user and matches the vectors produced by the ai-api implementation', () => {
    const base = {
      secret,
      timestamp,
      method: 'GET',
      target: '/api/v1/internal/lessons/abc',
      body: Buffer.alloc(0),
    };

    expect(computeSignature({ ...base, actingUserId: 'user-1' })).toBe(
      '0e58cfbd1cf072b84d41919aed0a3e8b3367c6fb17b325caa6abe01c74d48e0b',
    );
    expect(computeSignature({ ...base, actingUserId: 'user-2' })).toBe(
      '40a44f2a610df13d991f0f2dcf2427aae10d14d18919e658ccaf393b3521fcd2',
    );
  });

  it('treats a missing acting user as an empty one', () => {
    const base = { secret, timestamp, method: 'GET', target: '/x', body: Buffer.alloc(0) };

    expect(computeSignature({ ...base, actingUserId: '' })).toBe(computeSignature(base));
    expect(computeSignature({ ...base, actingUserId: 'user-1' })).not.toBe(computeSignature(base));
  });

  it('normalises the method to upper case', () => {
    expect(canonicalString({ timestamp, method: 'post', target: '/x', body: '' })).toBe(
      canonicalString({ timestamp, method: 'POST', target: '/x', body: '' }),
    );
  });

  it('changes when any signed component changes', () => {
    const base = { secret, timestamp, method: 'POST', target: '/x?a=1', body: Buffer.from('{}') };
    const reference = computeSignature(base);
    expect(computeSignature({ ...base, secret: 'other' })).not.toBe(reference);
    expect(computeSignature({ ...base, timestamp: '1700000000001' })).not.toBe(reference);
    expect(computeSignature({ ...base, method: 'PUT' })).not.toBe(reference);
    expect(computeSignature({ ...base, target: '/x?a=2' })).not.toBe(reference);
    expect(computeSignature({ ...base, body: Buffer.from('{"a":1}') })).not.toBe(reference);
  });

  it('compares signatures without throwing on length mismatch', () => {
    expect(signaturesMatch('abc', 'abcd')).toBe(false);
    expect(signaturesMatch('abc', 'abc')).toBe(true);
  });
});
