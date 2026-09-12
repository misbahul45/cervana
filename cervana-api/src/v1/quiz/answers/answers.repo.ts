import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { errorHandler, validation } from '@/common/lib/utils'
import { CreateAnswerDto, CreateAnswerType, UpdateAnswerDto, UpdateAnswerType } from './answers.dto';
import { Answer } from '@prisma/client';

@Injectable()
export class AnswersRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Answer>(
        key: K,
        value: Answer[K],
    ) {
        return errorHandler(async()=>{
            return await this.prisma.answer.findFirst({
                where: { [key]:value },
            });
        })
    }

    async findAll(attemptId:string) {
        return errorHandler(async()=>{
            return await this.prisma.answer.findMany({where:{
                attemptId
            }})
        })
    }

    async create(values: CreateAnswerType | CreateAnswerType[]) {
        return errorHandler(async () => {
            const data = validation(CreateAnswerDto, values);

            if (Array.isArray(data)) {
                return this.prisma.answer.createMany({
                    data,
                    skipDuplicates: true,
                });
            } else {
                return this.prisma.answer.create({
                    data,
                });
            }
        });
    }


    async update(id:string, values:UpdateAnswerType){
        return errorHandler(async()=>{
            const data=validation(UpdateAnswerDto, values)
            return await this.prisma.answer.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.answer.delete({
                where:{id}
            })
        })
    }
}
