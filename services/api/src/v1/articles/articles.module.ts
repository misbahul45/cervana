import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/config/prisma/prisma.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticleAuthoringService } from './article-authoring.service';
import { ArticleModerationService } from './article-moderation.service';
import { ArticlesController } from './articles.controller';
import { MarketplaceArticlesController } from './marketplace-articles.controller';
import { MarketplaceArticlesService } from './marketplace-articles.service';

@Module({
  imports: [PrismaModule, UploadsModule, TenantsModule, EntitlementsModule],
  controllers: [ArticlesController, MarketplaceArticlesController, AdminArticlesController],
  providers: [ArticleAuthoringService, ArticleModerationService, MarketplaceArticlesService],
})
export class ArticlesModule {}
