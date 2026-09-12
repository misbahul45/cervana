import { errorHandler } from '@/common/lib/utils';
import { Injectable } from '@nestjs/common';
import { CreateChatMessageDtoType, UpdateChatMessageDtoType } from './chat-messages.dto';
import { AppError } from '@/common/lib/error';
import { ChatMessagesRepo } from './chat-messages.repo';

@Injectable()
export class ChatMessagesService {
  constructor(
    private readonly chatMesagesRepo:ChatMessagesRepo
  ){}
  create(values:CreateChatMessageDtoType) {
    return errorHandler(async()=>{
      const newMessage=await this.chatMesagesRepo.create(values)

      return {
        message:"Successfully create new message",
        data:newMessage
      }
    })
  }

  update(id: string, values: UpdateChatMessageDtoType) {
    return errorHandler(async()=>{
      const isExist=await this.chatMesagesRepo.findOne(id)

      if(!isExist){
        throw new AppError('Message not found', 404)
      }

      const data=await this.chatMesagesRepo.update(id, values)

      return{
        message:'Successfully update Message',
        data:data
      }
    })
  }

  remove(id: string) {
    return errorHandler(async()=>{
      const isExist=await this.chatMesagesRepo.findOne(id)

      if(!isExist){
        throw new AppError('Message not found', 404)
      }

      await this.chatMesagesRepo.delete(id)

      return{
        message:'Successfully delete Message',
        data:null
      }
    })
  }
}
