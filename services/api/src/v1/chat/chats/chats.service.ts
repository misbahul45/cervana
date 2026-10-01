import { Injectable } from '@nestjs/common';
import { CreateChatDtoType } from './chats.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { ChatMessagesRepo } from '../chat-messages/chat-messages.repo';
import { ChatsRepo } from './chats.repo';

@Injectable()
export class ChatsService {
  constructor(
    private readonly chatsRepo:ChatsRepo,
    private readonly chatMessagesRepo:ChatMessagesRepo
  ){}
  create(values : CreateChatDtoType) {
    return errorHandler(async()=>{
      const newChat=await this.chatsRepo.create(values)

      return {
        message:'Successfully create chat',
        data:newChat
      }
    })
  }

  
  findAllMessages(id:string, q?:Query){
    return errorHandler(async()=>{
      const result=await this.chatMessagesRepo.findAll(id, q)
      return{
        message:'Successfully retrieved Steps',
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
      const chat=await this.chatsRepo.findOne('id', id,  q)

      if(!chat){
        throw new AppError('Chat not found', 404)
      }

      return {
        message:'Sucessfully retrieved chat',
        data:chat
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const chat=await this.chatsRepo.findOne('id', id)

      if(!chat){
        throw new AppError('Chat not found', 404)
      }

      await this.chatsRepo.delete(id)

      return{
        message:'Successfully delete chat',
        data:null
      }
    })
  }
}
