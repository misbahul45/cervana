import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { SubtopicsService } from './subtopics.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { ApiTags } from '@nestjs/swagger';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseSubTopicSchema, SubTopicDetailSchema, SubTopicsListSchema } from '@/common/docs/subTopic.doc';
import { CreateSubTopicDto, UpdateSubTopicDto } from './subtopics.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { Public } from '@/v1/auth/auth.decorator';


@ApiTags('SubTopics')
@Controller('subtopics')
export class SubtopicsController {
  constructor(private readonly subtopicsService: SubtopicsService) {}

  @Public()
  @Get('')
  @ApiCrudDocs.findAll(SubTopicsListSchema, "SubTopic", true)
  findAllSubTopics(
      @Query() query: QueryInterface
    ){
      return this.subtopicsService.findAll(query)
    }

  @Post()
  @ApiCrudDocs.create(BaseSubTopicSchema,CreateSubTopicDto,'SubTopic')
  create(@Body(
    new ZodPipe(CreateSubTopicDto)
  ) createSubtopicDto: any) {
    return this.subtopicsService.create(createSubtopicDto);
  }

  @Get(':id/lessons')
  @ApiCrudDocs.findAll(SubTopicsListSchema, 'Lesson', true)
  findAllLesson(
    @Param('id') id: string,
    @Query() query: QueryInterface
  ){
    return this.subtopicsService.findAllLessons(id, query)
  }

  @Get(':id/navigation')
  async findOneWithNext(
    @Param('id') id: string,
    @Query('userId') userId?: string
  ) {
    return await this.subtopicsService.findNavigation(id, userId);
  }



  @Get(':id')
  @ApiCrudDocs.findOne(SubTopicDetailSchema, 'SubTopic')
  findOne(
    @Param('id') id: string,
    @Query() query: Pick<QueryInterface, 'include'>
  ) {
    return this.subtopicsService.findOne(id, query);
  }

  @Patch(':id')
  @ApiCrudDocs.update(UpdateSubTopicDto,'SubTopic')
  update(@Param('id') id: string, @Body() updateSubtopicDto: any) {
    return this.subtopicsService.update(id, updateSubtopicDto);
  }

  @Delete(':id')
  @ApiCrudDocs.delete('SubTopic')
  remove(@Param('id') id: string) {
    return this.subtopicsService.remove(id);
  }
}
