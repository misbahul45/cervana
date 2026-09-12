import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ApplicationsModule } from './applications/applications.module';
import { CertificationsModule } from './certifications/certifications.module';
import { ExperiencesModule } from './experiences/experiences.module';

@Module({
  imports: [
    ApplicationsModule,
    CertificationsModule,
    ExperiencesModule,
    RouterModule.register([
      {
        path: 'teacher',
        children: [
          { path: '', module: ApplicationsModule },
          { path: '', module: CertificationsModule },
          { path: '', module: ExperiencesModule },
        ],
      },
    ]),
  ],
  exports: [
    ApplicationsModule,
    CertificationsModule,
    ExperiencesModule,
  ],
})
export class TeacherModule {}
