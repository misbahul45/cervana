import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Public } from '../auth/auth.decorator';
import { MarketplaceArticleQueryDto, MarketplaceArticleQueryDtoType } from './articles.dto';
import { MarketplaceArticlesService } from './marketplace-articles.service';

@Controller('marketplace/articles')
export class MarketplaceArticlesController {
  constructor(private readonly marketplace: MarketplaceArticlesService) {}

  @Public()
  @Get()
  list(@Query(new ZodPipe(MarketplaceArticleQueryDto)) query: MarketplaceArticleQueryDtoType) {
    return this.marketplace.list(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketplace.findOne(id);
  }

  @AuthenticatedOnly()
  @Get(':id/access')
  access(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.marketplace.access(user, id);
  }

  @AuthenticatedOnly()
  @Get(':id/content')
  content(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.marketplace.content(user, id);
  }
}
