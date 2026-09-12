import { Injectable } from '@nestjs/common';
import { CreateCategoryType, UpdateCategoryType } from './categories.dto';
import { errorHandler, slugify } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { Query } from '@/common/interfaces';
import { CategoriesRepo } from './categories.repo';
import { TopicsRepo } from '../curriculum/topics/topics.repo';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepo:CategoriesRepo,
    private readonly topicsRepo:TopicsRepo,
  ){}
  create(values: CreateCategoryType) {
    return errorHandler(async () => {
      if (Array.isArray(values)) {
        const newCategories = await this.categoriesRepo.create(
          values.map(v => ({
            ...v,
          }))
        );
        return {
          message: 'Successfully created categories',
          data: newCategories,
        };
      }

      const isExist = await this.categoriesRepo.findOne('name', values.name);
      if (isExist?.id) {
        throw new AppError('Category already exist');
      }

      const newCategory = await this.categoriesRepo.create({
        ...values,
      });

      return {
        message: 'Successfully created category',
        data: newCategory,
      };
    });
  }


  removeTopicAndCategory(categoryId:string, topicId:string){
    
  }

  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.categoriesRepo.findAll(q)
      return{
        message:'Successfully retrieved categories',
        data:{
          data:result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages
          }
        }
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const category=await this.categoriesRepo.findOne('id', id, q)

      if(!category?.id){
        throw new AppError('Category not found', 404)
      }

      return {
        message:'Sucessfully retrieved category',
        data:category
      }
    })
  }

  update(id: string, values: UpdateCategoryType) {
    return errorHandler(async()=>{
      const isExist=await this.categoriesRepo.findOne('id', id)
      if(!isExist?.id){
        throw new AppError('Category not found', 404)
      }

      await this.categoriesRepo.update(id, values)

      return{
        message:'Successfully update category',
        data:null
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const isExist=await this.categoriesRepo.findOne('id', id)
      if(!isExist?.id){
        throw new AppError('Category not found', 404)
      }
      await this.categoriesRepo.delete(id)

      return{
        message:'Successfully delete category',
        data:null
      }
    })
  }


  addTopicToCategory(categoryId:string, topicId:string){
    return errorHandler(async()=>{
      const category=await this.categoriesRepo.findOne('id', categoryId)
      if(!category){
        throw new AppError('Category not found', 404, AppErrorCode.NOT_FOUND)
      }

      const topic=await this.topicsRepo.findOne('id', topicId)

      if(!topic){
        throw new AppError('Topic not found', 404, AppErrorCode.NOT_FOUND)
      }

      await this.categoriesRepo.addTopicToCategory(categoryId, topicId)

      return{
        message:'Successfully conected topic and category',
        data:null
      }
    })
  }

}
