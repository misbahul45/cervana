import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('jwt-rotation (Phase 0)', () => {
  function makeService(activeSecret: string, oldSecret: string) {
    const config = new ConfigService({
      JWT_ACCESS_SECRET: activeSecret,
      JWT_REFRESH_SECRET: 'refresh-secret',
    });
    const jwt = new JwtService({
      secret: activeSecret,
      signOptions: { expiresIn: '15m' },
    });
    return { jwt, config, oldSecret };
  }

  it('verifies a freshly-signed access token under the active secret', async () => {
    const { jwt } = makeService('new-secret-a', 'old-secret-a');

    const token = await jwt.signAsync({ sub: 'u-1', type: 'access' });
    const payload = await jwt.verifyAsync(token, {
      secret: 'new-secret-a',
    });

    expect(payload.sub).toBe('u-1');
    expect(payload.type).toBe('access');
  });

  it('rejects a token signed with a previous secret after rotation', async () => {
    const oldJwt = new JwtService({
      secret: 'old-secret-a',
      signOptions: { expiresIn: '15m' },
    });
    const tokenSignedWithOldSecret = await oldJwt.signAsync({
      sub: 'u-1',
      type: 'access',
    });

    const newJwt = new JwtService({
      secret: 'new-secret-a',
      signOptions: { expiresIn: '15m' },
    });

    await expect(
      newJwt.verifyAsync(tokenSignedWithOldSecret, { secret: 'new-secret-a' }),
    ).rejects.toThrow();
  });

  it('verifies a refresh token via the dedicated refresh secret', async () => {
    const accessJwt = new JwtService({
      secret: 'shared-secret',
      signOptions: { expiresIn: '15m' },
    });
    const refreshJwt = new JwtService({
      secret: 'refresh-only-secret',
      signOptions: { expiresIn: '7d' },
    });

    const refreshToken = await refreshJwt.signAsync({
      sub: 'u-1',
      type: 'refresh',
    });

    await expect(accessJwt.verifyAsync(refreshToken)).rejects.toThrow();
    const payload = await refreshJwt.verifyAsync(refreshToken);
    expect(payload.sub).toBe('u-1');
  });
});