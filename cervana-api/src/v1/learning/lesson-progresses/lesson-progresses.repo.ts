import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateLessonProgressDto, CreateLessonProgressType, UpdateLessonProgressDto, UpdateLessonProgressType } from './lesson-progresses.dto';
import { LessonProgress } from '@prisma/client';

@Injectable()
export class LessonProgressesRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof LessonProgress>(
        key: K,
        value: LessonProgress[K],
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

            return await this.prisma.lessonProgress.findFirst({
                where: { [key]:value },
                include,
            });        
        })
    }

    async findAllByUserId(userId:string,q: Query) {
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = { userId };

            if (q.q) {
                where.OR = [
                    { lesson: { title: { contains: q.q, mode: 'insensitive' } } }
                ];
            }
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
                this.prisma.lessonProgress.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.lessonProgress.count({ where }),
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

    async create(values:CreateLessonProgressType){
        return errorHandler(async()=>{
            const data=validation(CreateLessonProgressDto, values)
            if(Array.isArray(data)){
                return await this.prisma.lessonProgress.createMany({ data })
            }
            
            return await this.prisma.lessonProgress.create({
                data
            })
        })
    }

    async update(id:string,values:UpdateLessonProgressType){
        return errorHandler(async()=>{
            const data=validation(UpdateLessonProgressDto, values)

            return await this.prisma.lessonProgress.update({
                where:{
                    id
                },
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.lessonProgress.delete({
                where:{id}
            })
        })
    }
}
