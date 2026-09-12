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
    OrdersModule
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
