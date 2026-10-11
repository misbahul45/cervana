import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { buildQuestionQuery } from './question-query';
import { CreateQuestionDto, CreateQuestionType, UpdateQuestionDto, UpdateQuestionType } from './questions.dto';
import { Question } from '@prisma/client';

@Injectable()
export class QuestionsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Question>(
        key: K,
        value: Question[K],
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

            return await this.prisma.question.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAll(quizId:string, q: Query) {
        return errorHandler(async()=>{
            const { where, orderBy, include, page, limit, skip, take } = buildQuestionQuery(quizId, q);

            const [data, total] = await Promise.all([
                this.prisma.question.findMany({ where, skip, take, orderBy, include }),
                this.prisma.question.count({ where }),
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
        })
    }

    async create(values: CreateQuestionType | CreateQuestionType[]) {
        return errorHandler(async () => {
            const data = validation(CreateQuestionDto, values)

            if (Array.isArray(data)) {
                return await this.prisma.question.createMany({
                    data,
                    skipDuplicates: true,
                })
            }

            return await this.prisma.question.create({
                    data,
                })
            })
    }

    async update(id:string, values:UpdateQuestionType){
        return errorHandler(async()=>{
            const data=validation(UpdateQuestionDto, values)
            return await this.prisma.question.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.question.delete({
                where:{id}
            })
        })
    }
}
