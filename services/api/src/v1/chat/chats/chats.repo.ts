import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateChatDto, CreateChatDtoType } from './chats.dto';
import { Chat } from '@prisma/client';

@Injectable()
export class ChatsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Chat>(
        key: K,
        value: Chat[K],
        q: Query = {}
    ) {
        return errorHandler(async()=>{
            let include: Record<string, boolean> | undefined;

            if (q.include) {
                const includes = Array.isArray(q.include)
                    ? q.include
                    : q.include.split(',');

                include = includes.reduce((acc, curr) => {
                    acc[curr] = true;
                    return acc;
                }, {} as Record<string, boolean>);
            }

            return await this.prisma.chat.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async create(values:CreateChatDtoType){
        return errorHandler(async()=>{
            const data=validation(CreateChatDto, values)
            return await this.prisma.chat.create({
              data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.chat.delete({
                where:{id}
            })
        })
    }
}
