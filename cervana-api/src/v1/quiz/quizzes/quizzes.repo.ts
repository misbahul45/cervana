import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateQuizDto, CreateQuizType, UpdateQuizDto, UpdateQuizType } from './Quizzes.dto';
import { Quiz } from '@prisma/client';

@Injectable()
export class QuizzesRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Quiz>(
        key: K,
        value: Quiz[K],
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

            return await this.prisma.quiz.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAll(q: Query) {
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {};
            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
                    where[key] = q[key];
                }
            }

            if (q.q) {
                where.OR = [
                    { title: { contains: q.q, mode: 'insensitive' } },
                ];
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
                this.prisma.quiz.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.quiz.count({ where }),
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

    async create(values:CreateQuizType){
        return errorHandler(async()=>{
            const data=validation(CreateQuizDto, values)
            if(Array.isArray(data)){
                return await this.prisma.quiz.createMany({
                    data,
                    skipDuplicates: true,
                })
            }
            return await this.prisma.quiz.create({data})
        })
    }

    async update(id:string, values:UpdateQuizType){
        return errorHandler(async()=>{
            const data=validation(UpdateQuizDto, values)

            return await this.prisma.quiz.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.quiz.delete({
                where:{id}
            })
        })
    }
}
