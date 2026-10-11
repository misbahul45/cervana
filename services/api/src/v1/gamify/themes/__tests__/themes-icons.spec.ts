import { ThemesService } from '../themes.service';

const THEME_A = '11111111-1111-4111-8111-111111111111';
const THEME_B = '22222222-2222-4222-8222-222222222222';
const ADMIN = { id: 'admin', role: 'ADMIN' };

const build = (stored: Record<string, string[]> = {}) => {
  const repo = {
    findAllIcons: jest.fn(async (themeId: string) => (stored[themeId] ?? []).map((name) => ({ id: `${themeId}-${name}`, themeId, name }))),
    createIcon: jest.fn(async (values: unknown) => values),
  };
  return { service: new ThemesService(repo as never), repo };
};

describe('ThemesService.createIcon uniqueness', () => {
  it('creates an icon with a new name and delegates to the repo', async () => {
    const { service, repo } = build({ [THEME_A]: ['streak'] });

    await service.createIcon({ themeId: THEME_A, name: 'xp', imageIcon: 'https://cdn.example.com/xp.png' }, ADMIN);

    expect(repo.createIcon).toHaveBeenCalledTimes(1);
  });

  it('rejects a name the theme already has, ignoring case and surrounding spaces', async () => {
    const { service, repo } = build({ [THEME_A]: ['streak'] });

    await expect(service.createIcon({ themeId: THEME_A, name: ' Streak ', imageIcon: 'https://cdn.example.com/s.png' }, ADMIN)).rejects.toMatchObject({ statusCode: 409 });

    expect(repo.createIcon).not.toHaveBeenCalled();
  });

  it('rejects the same name twice inside one batch', async () => {
    const { service, repo } = build();

    await expect(
      service.createIcon(
        [
          { themeId: THEME_A, name: 'star', imageIcon: 'https://cdn.example.com/a.png' },
          { themeId: THEME_A, name: 'STAR', imageIcon: 'https://cdn.example.com/b.png' },
        ],
        ADMIN,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(repo.createIcon).not.toHaveBeenCalled();
  });

  it('allows the same name on two different themes', async () => {
    const { service, repo } = build({ [THEME_A]: ['star'] });

    await service.createIcon({ themeId: THEME_B, name: 'star', imageIcon: 'https://cdn.example.com/b.png' }, ADMIN);

    expect(repo.createIcon).toHaveBeenCalledTimes(1);
  });

  it('keeps the admin only rule', async () => {
    const { service } = build();

    await expect(service.createIcon({ themeId: THEME_A, name: 'xp', imageIcon: 'https://cdn.example.com/xp.png' }, { id: 'u', role: 'STUDENT' })).rejects.toMatchObject({ statusCode: 403 });
  });
});
