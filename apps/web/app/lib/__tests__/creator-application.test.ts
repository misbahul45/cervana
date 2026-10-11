import { describe, expect, it } from 'vitest';
import { applicationPayload, applicationProblem, applicationStage } from '~/lib/creator-application';

const form = { fullName: 'Rina Kreator', bio: '', expertise: '', portfolioUrl: '', cvUrl: '' };

describe('applicationProblem', () => {
  it('needs only a name and accepts empty optional fields', () => {
    expect(applicationProblem(form)).toBeNull();
  });

  it('names what is wrong', () => {
    expect(applicationProblem({ ...form, fullName: ' a ' })).toContain('Nama');
    expect(applicationProblem({ ...form, bio: 'x'.repeat(5001) })).toContain('Bio');
    expect(applicationProblem({ ...form, expertise: 'x'.repeat(1001) })).toContain('keahlian');
    expect(applicationProblem({ ...form, portfolioUrl: 'javascript:alert(1)' })).toContain('portofolio');
    expect(applicationProblem({ ...form, cvUrl: 'ftp://x' })).toContain('CV');
  });

  it('accepts https and http links', () => {
    expect(applicationProblem({ ...form, portfolioUrl: 'https://rina.example/karya', cvUrl: 'http://rina.example/cv.pdf' })).toBeNull();
  });
});

describe('applicationPayload', () => {
  it('trims and leaves empty optional fields out so the strict API accepts it', () => {
    expect(applicationPayload({ ...form, fullName: '  Rina  ', bio: ' Akuntan ' })).toEqual({ fullName: 'Rina', bio: 'Akuntan' });
  });
});

describe('applicationStage', () => {
  it('maps the API status to a stage and treats no application as none', () => {
    expect(applicationStage(null)).toBe('none');
    expect(applicationStage({ status: 'PENDING' })).toBe('pending');
    expect(applicationStage({ status: 'APPROVED' })).toBe('approved');
    expect(applicationStage({ status: 'REJECTED' })).toBe('rejected');
  });
});
