import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { errorHandler, validation } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { CreateChatMessageDto, CreateChatMessageDtoType, UpdateChatMessageDto, UpdateChatMessageDtoType } from './chat-messages.dto';

@Injectable()
export class ChatMessagesRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}
    async findAll(chatId: string, q?: Query) {
        return errorHandler(async () => {
            const page = Number(q?.page) || 1;
            const limit = Number(q?.limit) || 10;
            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                this.prisma.chatMessage.findMany({
                    where: {
                        chatId,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                    skip,
                    take: limit, 
                }),
                this.prisma.chatMessage.count({                     where: {
                        chatId,
                    }
                }),
            ]);

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };       
        });
    }


    async findOne(id:string){
        return errorHandler(async()=>{
            return await this.prisma.chatMessage.findUnique({
                where:{id}
            })
        })
    }


    async create(values:CreateChatMessageDtoType){
        return errorHandler(async()=>{
            const data=validation(CreateChatMessageDto, values)
            return await this.prisma.chatMessage.create({data})
        })
    }

    async update(id:string, values:UpdateChatMessageDtoType){
        return errorHandler(async()=>{
            const data=validation(UpdateChatMessageDto, values)
            return await this.prisma.chatMessage.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.chatMessage.delete({
                where:{id}
            })
        })
    }
}
