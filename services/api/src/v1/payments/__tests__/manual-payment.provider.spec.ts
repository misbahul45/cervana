import { ConfigService } from '@nestjs/config';
import { PaymentIntent, PaymentProvider, Prisma } from '@prisma/client';
import { PaymentConfig } from '../payment.config';
import { PaymentProviderRegistry } from '../payment-provider.registry';
import { PaymentProviderAdapter } from '../payment.types';
import { ManualPaymentProvider } from '../providers/manual/manual-payment.provider';
import { manualReferenceCode, parseManualAccounts } from '../providers/manual/manual-payment.accounts';

const ACCOUNTS = JSON.stringify([
  { method: 'BANK_TRANSFER', label: 'Bank transfer', accountNumber: '111222333', accountName: 'ReduCera' },
  { method: 'BANK_TRANSFER', label: 'Bank transfer', accountNumber: '444555666', accountName: 'ReduCera' },
  { method: 'QRIS', label: 'QRIS', accountNumber: 'QR-1', accountName: 'ReduCera' },
]);

const configWith = (env: Record<string, string> = {}) =>
  new PaymentConfig(new ConfigService({ MANUAL_PAYMENT_ACCOUNTS: ACCOUNTS, ...env }));

const intent = (overrides: Partial<PaymentIntent> = {}): PaymentIntent =>
  ({
    id: 'intent-1',
    orderId: '12345678-90ab-cdef-1234-567890abcdef',
    provider: PaymentProvider.MANUAL,
    providerPaymentId: null,
    amount: new Prisma.Decimal('100000'),
    currency: 'IDR',
    status: 'PENDING',
    expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    metadata: { method: null },
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as PaymentIntent;

const tx = (submissions: unknown[] = [], captures: unknown[] = []) =>
  ({
    manualPaymentSubmission: {
      findFirst: jest.fn().mockResolvedValue(submissions[submissions.length - 1] ?? null),
      findMany: jest.fn().mockResolvedValue(submissions),
    },
    paymentTransaction: { findMany: jest.fn().mockResolvedValue(captures) },
  }) as any;

describe('ManualPaymentProvider', () => {
  const provider = new ManualPaymentProvider(configWith());

  it('declares that manual payments have no checkout, webhook or capture', () => {
    expect(provider.provider).toBe('MANUAL');
    expect(provider.capabilities).toEqual({
      supportsCheckout: false,
      supportsWebhook: false,
      supportsRefund: true,
      supportsCapture: false,
      supportsPartialRefund: false,
    });
  });

  it('lists each configured method once', () => {
    expect(provider.listMethods()).toEqual([
      { method: 'BANK_TRANSFER', label: 'Bank transfer' },
      { method: 'QRIS', label: 'QRIS' },
    ]);
  });

  it('accepts a configured method and rejects an unknown one', async () => {
    const base = { orderId: 'o', buyerId: 'u', amount: new Prisma.Decimal(1), currency: 'IDR', expiresAt: new Date() };
    await expect(provider.createPaymentIntent({ tx: tx() }, { ...base, options: { method: 'QRIS' } })).resolves.toEqual({
      providerPaymentId: null,
      metadata: { method: 'QRIS' },
    });
    await expect(provider.createPaymentIntent({ tx: tx() }, base)).resolves.toMatchObject({ metadata: { method: null } });
    await expect(
      provider.createPaymentIntent({ tx: tx() }, { ...base, options: { method: 'CRYPTO' } }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('reports the provider unavailable when the accounts are missing or malformed', async () => {
    const base = { orderId: 'o', buyerId: 'u', amount: new Prisma.Decimal(1), currency: 'IDR', expiresAt: new Date() };
    for (const raw of [undefined, '', 'not json', '[]', JSON.stringify([{ method: 'lower', label: 'x' }])]) {
      const broken = new ManualPaymentProvider(
        new PaymentConfig(new ConfigService(raw === undefined ? {} : { MANUAL_PAYMENT_ACCOUNTS: raw })),
      );
      await expect(broken.createPaymentIntent({ tx: tx() }, base)).rejects.toMatchObject({
        statusCode: 503,
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
      });
      expect(broken.listMethods()).toEqual([]);
      expect(broken.presentPayment(intent()).data.accounts).toEqual([]);
    }
  });

  it('presents instructions filtered to the chosen method, with the amount and a reference code', () => {
    const all = provider.presentPayment(intent());
    expect(all.type).toBe('MANUAL_INSTRUCTIONS');
    expect((all.data.accounts as unknown[]).length).toBe(3);
    expect(all.data).toMatchObject({
      amount: '100000',
      currency: 'IDR',
      referenceCode: manualReferenceCode('12345678-90ab-cdef-1234-567890abcdef'),
      expiresAt: '2026-10-01T00:00:00.000Z',
    });

    const qris = provider.presentPayment(intent({ metadata: { method: 'QRIS' } }));
    expect(qris.data.accounts).toEqual([
      { method: 'QRIS', label: 'QRIS', accountNumber: 'QR-1', accountName: 'ReduCera' },
    ]);
  });

  it('only allows cancelling before a proof is under review', async () => {
    const cancel = (status: string) => provider.cancelPayment({ tx: tx() }, intent({ status: status as never }));
    await expect(cancel('CREATED')).resolves.toEqual({ allowed: true });
    await expect(cancel('PENDING')).resolves.toEqual({ allowed: true });
    await expect(cancel('SUBMITTED')).resolves.toMatchObject({ allowed: false });
    for (const status of ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED']) {
      await expect(cancel(status)).resolves.toMatchObject({ allowed: false });
    }
  });

  it('creates a manual refund request only for a full refund of a paid payment', async () => {
    const paid = intent({ status: 'PAID' });
    await expect(
      provider.refundPayment({ tx: tx() }, paid, { amount: new Prisma.Decimal('100000'), reason: 'duplicate' }),
    ).resolves.toMatchObject({ mode: 'MANUAL', status: 'PENDING' });
    await expect(
      provider.refundPayment({ tx: tx() }, paid, { amount: new Prisma.Decimal('50000'), reason: 'partial' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      provider.refundPayment({ tx: tx() }, intent({ status: 'PENDING' }), {
        amount: new Prisma.Decimal('100000'),
        reason: 'not paid',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  describe('reconciliation', () => {
    const approved = { id: 'sub-1', status: 'APPROVED', amount: new Prisma.Decimal('100000') };
    const capture = { id: 'cap-1', amount: new Prisma.Decimal('100000'), providerTransactionId: 'sub-1' };

    it('is consistent for a paid payment with one approval and one matching capture', async () => {
      const result = await provider.reconcilePayment({ tx: tx([approved], [capture]) }, intent({ status: 'PAID' }));
      expect(result).toEqual({ providerStatus: 'APPROVED', consistent: true, discrepancies: [] });
    });

    it('flags a paid payment with no capture or no approval', async () => {
      const noCapture = await provider.reconcilePayment({ tx: tx([approved], []) }, intent({ status: 'PAID' }));
      expect(noCapture.consistent).toBe(false);
      expect(noCapture.discrepancies.join(' ')).toContain('successful capture');

      const noApproval = await provider.reconcilePayment({ tx: tx([], [capture]) }, intent({ status: 'PAID' }));
      expect(noApproval.discrepancies.join(' ')).toContain('approved submission');
    });

    it('flags amount mismatches and captures that do not reference the approval', async () => {
      const wrongAmount = await provider.reconcilePayment(
        { tx: tx([{ ...approved, amount: new Prisma.Decimal('90000') }], [capture]) },
        intent({ status: 'PAID' }),
      );
      expect(wrongAmount.discrepancies.join(' ')).toContain('amount differs');

      const wrongRef = await provider.reconcilePayment(
        { tx: tx([approved], [{ ...capture, providerTransactionId: 'other' }]) },
        intent({ status: 'PAID' }),
      );
      expect(wrongRef.discrepancies.join(' ')).toContain('does not reference');
    });

    it('flags money recorded against an unpaid payment and open submissions in the wrong state', async () => {
      const unpaid = await provider.reconcilePayment({ tx: tx([approved], [capture]) }, intent({ status: 'PENDING' }));
      expect(unpaid.consistent).toBe(false);
      expect(unpaid.discrepancies).toEqual(
        expect.arrayContaining([
          'Approved submission exists but the payment is not paid',
          'Successful capture exists but the payment is not paid',
        ]),
      );

      const open = { id: 'sub-2', status: 'SUBMITTED', amount: new Prisma.Decimal('100000') };
      const awaiting = await provider.reconcilePayment({ tx: tx([open]) }, intent({ status: 'SUBMITTED' }));
      expect(awaiting.consistent).toBe(true);
      const missing = await provider.reconcilePayment({ tx: tx([]) }, intent({ status: 'SUBMITTED' }));
      expect(missing.discrepancies.join(' ')).toContain('one open submission');
      const stray = await provider.reconcilePayment({ tx: tx([open]) }, intent({ status: 'PENDING' }));
      expect(stray.discrepancies.join(' ')).toContain('Open submission exists');
    });
  });
});

describe('manual accounts config', () => {
  it('parses a valid list and derives a stable reference code', () => {
    expect(parseManualAccounts(ACCOUNTS)).toHaveLength(3);
    expect(manualReferenceCode('12345678-90ab-cdef-1234-567890abcdef')).toBe('1234567890');
  });
});

describe('PaymentConfig', () => {
  it('defaults to the manual provider and reads valid overrides', () => {
    expect(configWith().activeProvider).toBe('MANUAL');
    expect(configWith({ PAYMENT_PROVIDER: 'midtrans' }).activeProvider).toBe('MIDTRANS');
    expect(configWith({ PAYMENT_PROVIDER: ' Stripe ' }).activeProvider).toBe('STRIPE');
    expect(configWith({ PAYMENT_PROVIDER: 'unknown' }).activeProvider).toBe('OTHER');
  });

  it('bounds the intent lifetime and the proof attempts', () => {
    expect(configWith().intentTtlMinutes).toBe(1440);
    expect(configWith({ PAYMENT_INTENT_TTL_MINUTES: '60' }).intentTtlMinutes).toBe(60);
    for (const bad of ['1', '999999', 'abc', '10.5']) {
      expect(configWith({ PAYMENT_INTENT_TTL_MINUTES: bad }).intentTtlMinutes).toBe(1440);
    }
    expect(configWith().maxSubmissionsPerIntent).toBe(5);
    expect(configWith({ MANUAL_PAYMENT_MAX_SUBMISSIONS: '3' }).maxSubmissionsPerIntent).toBe(3);
    expect(configWith({ MANUAL_PAYMENT_MAX_SUBMISSIONS: '0' }).maxSubmissionsPerIntent).toBe(5);
  });
});

describe('PaymentProviderRegistry', () => {
  const gateway = { provider: PaymentProvider.MIDTRANS } as PaymentProviderAdapter;
  const manual = new ManualPaymentProvider(configWith());

  it('selects the configured provider and still resolves every registered one', () => {
    const registry = new PaymentProviderRegistry([manual, gateway], configWith({ PAYMENT_PROVIDER: 'midtrans' }));
    expect(registry.active()).toBe(gateway);
    expect(registry.get(PaymentProvider.MANUAL)).toBe(manual);
    expect(registry.registered().sort()).toEqual(['MANUAL', 'MIDTRANS']);
  });

  it('fails clearly when the configured provider is not registered', () => {
    const registry = new PaymentProviderRegistry([manual], configWith({ PAYMENT_PROVIDER: 'stripe' }));
    expect(() => registry.active()).toThrow(/not available/);
    try {
      registry.get(PaymentProvider.STRIPE);
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 503, code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
    }
  });
});
