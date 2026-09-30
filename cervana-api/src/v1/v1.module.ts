import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { MaterialModule } from './material/material.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { ApplicationsModule } from './teacher/applications/applications.module';
import { ExperiencesModule } from './teacher/experiences/experiences.module';
import { CertificationsModule } from './teacher/certifications/certifications.module';
import { TeacherModule } from './teacher/teacher.module';
import { curriculumModule } from './curriculum/curriculum.module';
import { GamifyModule } from './gamify/gamify.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmittersModule } from './emitters/emitters.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { LearnerModelModule } from './learner-model/learner-model.module';
import { InternalModule } from './internal/internal.module';
import { TenantsModule } from './tenants/tenants.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { PaymentsModule } from './payments/payments.module';
import { CommerceModule } from './commerce/commerce.module';
import { LedgerModule } from './ledger/ledger.module';
import { ArticlesModule } from './articles/articles.module';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports:[
    AuthModule, 
    UsersModule, 
    curriculumModule, 
    ChatModule, 
    MaterialModule, 
    UploadsModule, 
    ApplicationsModule, 
    TeacherModule, 
    ExperiencesModule, 
    CertificationsModule,
    GamifyModule,
    NotificationsModule,
    EmittersModule,
    CategoriesModule,
    OrdersModule,
    LearnerModelModule,
    InternalModule,
    TenantsModule,
    EntitlementsModule,
    EventsModule,
    PaymentsModule,
    LedgerModule,
    ArticlesModule,
    CommerceModule
  ],
  exports:[
    AuthModule, 
    UsersModule, 
    curriculumModule, 
    ChatModule, 
    MaterialModule, 
    UploadsModule, 
    ApplicationsModule, 
    TeacherModule, 
    ExperiencesModule, 
    CertificationsModule,
    GamifyModule,
    NotificationsModule,
    EmittersModule,
    CategoriesModule
  ]
})
export class V1Module {}
