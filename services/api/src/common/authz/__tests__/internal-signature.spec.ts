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
    ).toBe('0701934646b2b65fb28ac0579df3663956fcc02c313ab5d15b0cb1c4f6bbf3a2');

    expect(
      computeSignature({
        secret,
        timestamp,
        method: 'GET',
        target: '/api/v1/internal/resources/abc',
        body: Buffer.alloc(0),
      }),
    ).toBe('8396f8bf7c5d931115f46af03ad4e81ca45fc48559eb502adff0a478e03567af');
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
