import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ApplicationsModule } from './applications/applications.module';
import { CertificationsModule } from './certifications/certifications.module';
import { ExperiencesModule } from './experiences/experiences.module';
import { CreatorEligibilityModule } from './eligibility/creator-eligibility.module';
import { CreatorProfileModule } from './creator-profile/creator-profile.module';

@Module({
  imports: [
    ApplicationsModule,
    CertificationsModule,
    ExperiencesModule,
    CreatorEligibilityModule,
    CreatorProfileModule,
    RouterModule.register([
      {
        path: 'teacher',
        children: [
          { path: '', module: ApplicationsModule },
          { path: '', module: CertificationsModule },
          { path: '', module: ExperiencesModule },
          { path: 'eligibility', module: CreatorEligibilityModule },
          { path: 'creators', module: CreatorProfileModule },
        ],
      },
    ]),
  ],
  exports: [
    ApplicationsModule,
    CertificationsModule,
    ExperiencesModule,
    CreatorEligibilityModule,
    CreatorProfileModule,
  ],
})
export class TeacherModule {}
