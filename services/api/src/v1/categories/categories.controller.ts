import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, CreateCategoryType, UpdateCategoryDto, UpdateCategoryType } from './categories.dto';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../auth/auth.decorator';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseCategorySchema, CategoriesListSchema, CategoryDetailSchema } from '@/common/docs/category.doc';
import { Query as QueryInterface } from '@/common/interfaces';
import { TopicDetailSchema } from '@/common/docs/topic.doc';
import { Role } from '@prisma/client';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Roles(Role.ADMIN, Role.TEACHER)
    @ApiCrudDocs.create(BaseCategorySchema, CreateCategoryDto, 'Category')
    @Post('/')
    create(@Body(new ZodPipe(CreateCategoryDto)) createCategoryDto: CreateCategoryType) {
        return this.categoriesService.create(createCategoryDto);
    }

    @Public()
    @Get('/')
    @ApiCrudDocs.findAll(CategoriesListSchema, 'Category', true)
    findAll(@Query() query: QueryInterface) {
        return this.categoriesService.findAll(query);
    }

    @Public()
    @Get('/:id')
    @ApiCrudDocs.findOne(CategoryDetailSchema, 'Category')
    findOne(
        @Param('id') id: string,
        @Query() query: Pick<QueryInterface, 'include'>
    ) {
        return this.categoriesService.findOne(id, query);
    }

    @Roles(Role.ADMIN, Role.TEACHER)
    @Patch(':id')
    @ApiCrudDocs.update(UpdateCategoryDto, 'Category')
    update(@Param('id') id: string, @Body(new ZodPipe(UpdateCategoryDto)) updateCategoryDto: UpdateCategoryType) {
        return this.categoriesService.update(id, updateCategoryDto);
    }

    @Roles(Role.ADMIN)
    @Delete(':id')
    @ApiCrudDocs.delete('Category')
    remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }


    @Roles(Role.TEACHER)
    @Post(':categoryId/topics/topicId')
    addTopicToCategorory(
        @Param('categoryId') categoryId:string,
        @Param('topicId') topicId:string
    ){
        return this.categoriesService.addTopicToCategory(categoryId, topicId)
    }


    @Roles(Role.TEACHER)
    @Delete(':categoryId/topics/topicId')
    removeTopicToCategorory(
        @Param('categoryId') categoryId:string,
        @Param('topicId') topicId:string
    ){
        return this.categoriesService.removeTopicAndCategory(categoryId, topicId)
    }
}
