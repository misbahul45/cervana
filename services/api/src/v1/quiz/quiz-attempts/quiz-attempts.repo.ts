import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateQuizAttemptDto, CreateQuizAttemptType, UpdateQuizAttemptDto, UpdateQuizAttemptType } from './quizAttempets.dto';
import { QuizAttempt } from '@prisma/client';

@Injectable()
export class QuizAttemptsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof QuizAttempt>(
        key: K,
        value: QuizAttempt[K],
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

            return await this.prisma.quizAttempt.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAll(quizId:string, q: Query) {
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = { quizId };
            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
                    where[key] = q[key];
                }
            }

            let orderBy: any = undefined;
            if (q.sort) {
                const [field, direction = 'asc'] = q.sort.split(':');
                    orderBy = { [field]: direction };
            }

            let include: any = undefined;
            if (q.include) {
                const includes = Array.isArray(q.include)
                    ? q.include
                    : q.include.split(',');
                include = includes.reduce((acc, field) => {
                    acc[field] = true;
                    return acc;
                }, {} as Record<string, boolean>);
            }

            const [data, total] = await Promise.all([
                this.prisma.quizAttempt.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.quizAttempt.count({ where }),
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

    async create(values: CreateQuizAttemptType | CreateQuizAttemptType[]) {
        return errorHandler(async () => {
            const data = validation(CreateQuizAttemptDto, values)
            if (Array.isArray(data)) {
                return await this.prisma.quizAttempt.createMany({ data })
            }
            return await this.prisma.quizAttempt.create({ data })
        })
    }


    async update(id:string, values:UpdateQuizAttemptType){
        return errorHandler(async()=>{
            const data=validation(UpdateQuizAttemptDto, values)

            return await this.prisma.quizAttempt.update({
                where:{
                    id
                },
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.quizAttempt.delete({
                where:{id}
            })
        })
    }
}
