import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ADMIN_A, asUser, createHttpApp } from '@/test-utils/http-harness';
import { ThemesController } from '../themes.controller';
import { ThemesService } from '../themes.service';
import { ThemeProposerService } from '../theme-proposer.service';
import type { ThemeProposal } from '../theme-proposer.service';

describe('POST /themes/propose', () => {
  let app: INestApplication;
  let themesService: Record<string, jest.Mock>;
  let themeProposerMock: jest.Mock;

  const validProposal = (): ThemeProposal => {
    const svc = new ThemeProposerService();
    return svc.propose({ name: 'Akademik', level: 'intermediate', mood: ['calm'], intensity: 0.5 });
  };

  const lowContrastProposal = (): ThemeProposal => {
    const svc = new ThemeProposerService();
    const p = svc.propose({ name: 'Akademik', level: 'intermediate', mood: ['calm'], intensity: 0.5 });
    return {
      ...p,
      tokens: {
        ...p.tokens,
        light: {
          ...p.tokens.light,
          primary: '#cccccc',
        },
      },
    };
  };

  beforeEach(async () => {
    themesService = {
      findDefault: jest.fn(),
      create: jest.fn(),
      createIcon: jest.fn(),
      findAll: jest.fn(),
      findAllIcons: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      transition: jest.fn(),
      setDefault: jest.fn(),
      remove: jest.fn(),
      removeIcon: jest.fn(),
      buildNormalizedTheme: jest.fn(),
    };
    themeProposerMock = jest.fn();
    app = await createHttpApp({
      controllers: [ThemesController],
      providers: [
        { provide: ThemesService, useValue: themesService },
        { provide: ThemeProposerService, useValue: { propose: themeProposerMock } },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('rejects empty name with error invalid_input', async () => {
    const res = await http()
      .post('/themes/propose')
      .set(asUser(ADMIN_A))
      .send({ name: '' })
      .expect(400);

    expect(res.body.error.code).toBe('invalid_input');
  });

  it('schema-valid input returns 200 with proposal and validation.ok === true', async () => {
    const proposal = validProposal();
    themeProposerMock.mockReturnValue(proposal);

    const res = await http()
      .post('/themes/propose')
      .set(asUser(ADMIN_A))
      .send({ name: 'Akademik', level: 'intermediate', mood: ['calm'], intensity: 0.5 })
      .expect(200);

    expect(res.body.proposal.slug).toBe('akademik');
    expect(res.body.proposal.title).toBe('Akademik');
    expect(res.body.validation.ok).toBe(true);
    expect(res.body.validation.issues).toEqual([]);
    expect(res.body.proposal.tokens.light.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(res.body.proposal.tokens.dark.primary).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('validation failure returns 400 with proposal and validation issues preserved', async () => {
    const proposal = lowContrastProposal();
    themeProposerMock.mockReturnValue(proposal);

    const res = await http()
      .post('/themes/propose')
      .set(asUser(ADMIN_A))
      .send({ name: 'Akademik', level: 'intermediate', mood: ['calm'], intensity: 0.5 })
      .expect(400);

    expect(res.body.error.code).not.toBe('invalid_input');
    expect(res.body.proposal).toBeDefined();
    expect(res.body.proposal.tokens.light.primary).toBe('#cccccc');
    expect(res.body.validation).toBeDefined();
    expect(res.body.validation.ok).toBe(false);
    expect(Array.isArray(res.body.validation.issues)).toBe(true);
    expect(res.body.validation.issues.length).toBeGreaterThan(0);
  });
});