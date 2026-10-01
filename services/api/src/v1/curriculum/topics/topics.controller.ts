import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { CreateTopicDto, CreateTopicType, UpdateTopicDto, UpdateTopicType } from './topics.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { Query as QueryInterface } from '@/common/interfaces';
import { ApiTags } from '@nestjs/swagger';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseTopicSchema, TopicDetailSchema, TopicsListSchema } from '@/common/docs/topic.doc';
import { Public, Roles } from '@/v1/auth/auth.decorator';
import { SubTopicsListSchema } from '@/common/docs/subTopic.doc';
import { Role } from '@prisma/client';

@ApiTags('Topics')
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
  ) {}

  @Roles(Role.TEACHER)
  @ApiCrudDocs.create(BaseTopicSchema, CreateTopicDto, 'Topic')
  @Post()
  create(@Body(new ZodPipe(CreateTopicDto)) createTopicDto: CreateTopicType) {
    return this.topicsService.create(createTopicDto);
  }

  @Public()
  @Get('/')
  @ApiCrudDocs.findAll(TopicsListSchema, "Topic", true)
  findAll(@Query() query: QueryInterface) {
    return this.topicsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  @ApiCrudDocs.findOne(TopicDetailSchema, 'Topic')
  findOne(
    @Param('slug') slug: string,
    @Query() query: Pick<QueryInterface, 'include'>
  ) {
    return this.topicsService.findOne(slug, query);
  }


  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiCrudDocs.update(UpdateTopicDto, 'Topic')
  update(@Param('id') id: string, @Body(new ZodPipe(UpdateTopicDto)) updateTopicDto: UpdateTopicType) {
    return this.topicsService.update(id, updateTopicDto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiCrudDocs.delete('Topic')
  remove(@Param('id') id: string) {
    return this.topicsService.remove(id);
  }
}
