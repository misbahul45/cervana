import { Injectable } from '@nestjs/common';
import { CreateThemeIconType, CreateThemeType, UpdateThemeType } from './themes.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { ThemesRepo } from './themes.repo';

@Injectable()
export class ThemesService {
  constructor(
    private readonly themesRepo: ThemesRepo
  ){}

  create(values: CreateThemeType) {
    return errorHandler(async()=>{
      const newTheme=await this.themesRepo.create(values)
      return{
        message:'Successfully created theme',
        data:newTheme
      }
    })
  }

  createIcon(values: CreateThemeIconType) {
    return errorHandler(async()=>{
      const newThemeIcon=await this.themesRepo.createIcon({...values})

      return{
        message:'Successfully created new theme icon',
        data:newThemeIcon
      }
    })
  }


  findAll(q:Query) {
    return errorHandler(async()=>{
      const result=await this.themesRepo.findAll(q)
      return{
        message:'Successfully retrieved themes',
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

  findAllIcons(themeId:string){
    return errorHandler(async()=>{
      const icons=await this.themesRepo.findAllIcons(themeId)

      return {
        message:'Successfully retrieved icons',
        data:{
          data:icons
        }
      }
    })
  }

  findOne(id: string, q:Query) {
    return errorHandler(async()=>{
      const result=await this.themesRepo.findOne('id', id, q)
      if(!result?.id){
        throw new AppError('Theme not found', 404)
      }
      return{
        message:'Successfully retrieved theme',
        data:result
      }
    })
  }

  update(id: string, values: UpdateThemeType) {
      return errorHandler(async()=>{
        const updatedTheme=await this.themesRepo.update(id, values)
        if(!updatedTheme?.id){
          throw new AppError('Theme not found', 404)
        }
        return{
          message:'Successfully updated theme',
          data:updatedTheme
        }
      })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const deletedTheme=await this.themesRepo.delete(id)

      if(!deletedTheme?.id){
        throw new AppError('Theme not found', 404)
      }

      return{
        message:'Successfully deleted theme',
        data:null
      }
    })
  }

  removeIcon(id:string){
    return errorHandler(async()=>{
      const deletedThemeIcon=await this.themesRepo.deleteIcon(id)

      if(!deletedThemeIcon?.id){
        throw new AppError('Theme icon not found', 404)
      }

      return{
        message:'Successfully deleted theme icon',
        data:null
      }
    })
  }
}
