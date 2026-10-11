import { PATH_METADATA } from '@nestjs/common/constants';
import { CreatorProfileController } from './creator-profile.controller';

describe('CreatorProfileController', () => {
  it('leaves the teacher/creators prefix to the RouterModule, so the profile is served at /teacher/creators/:id and not at a doubled path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CreatorProfileController)).toBe('/');
  });
});
