import { readFileSync } from 'fs';
import { join } from 'path';

const SEED_PATH = join(__dirname, '..', '..', '..', '..', 'prisma', 'seed-data', 'agents.json');

describe('I4 enforcement: agents cannot call payout/approval (Phase 7)', () => {
  const agents = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));

  it('no agent tool points to a payout or moderation endpoint', () => {
    const FORBIDDEN = ['/v1/studio/withdrawals', '/v1/admin/moderation', '/v1/payouts', '/admin/moderation'];
    for (const a of agents) {
      for (const t of a.tools) {
        for (const pattern of FORBIDDEN) {
          expect(t.endpoint).not.toContain(pattern);
        }
      }
    }
  });

  it('all 5 agent scopes are represented', () => {
    const scopes = new Set(agents.map((a: { scope: string }) => a.scope));
    expect(scopes.has('TUTOR')).toBe(true);
    expect(scopes.has('CURRICULUM')).toBe(true);
    expect(scopes.has('ASSESSMENT')).toBe(true);
    expect(scopes.has('CREATOR_ASSISTANT')).toBe(true);
    expect(scopes.has('CAREER')).toBe(true);
  });
});