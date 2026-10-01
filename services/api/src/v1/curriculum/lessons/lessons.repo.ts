import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateLessonDto, CreateLessonType, UpdateLessonDto, UpdateLessonType } from './lessons.dto';
import { Lesson } from '@prisma/client';

@Injectable()
export class LessonsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Lesson>(
        key: K,
        value: Lesson[K],
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

            return await this.prisma.lesson.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

   async findAllBySubTopic(subTopicId:string, q:Query){
    return errorHandler(async()=>{
        const page = Number(q.page) || 1;
        const limit = Number(q.limit) || 10;
        const skip = (page - 1) * limit;

        const where: any = {subTopicId};
        for (const key in q) {
            if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
                where[key] = q[key];
            }
        }

        if (q.q) {
            where.OR = [
                { title: { contains: q.q, mode: 'insensitive' } },
                { description:{ contains: q.q, mode: 'insensitive' } }
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
            this.prisma.lesson.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include,
            }),
            this.prisma.category.count({ where }),
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

    async create(values:CreateLessonType){
        return errorHandler(async()=>{
            const data=validation(CreateLessonDto, values)

            return await this.prisma.lesson.create({data})
        })
    }

    async update(id:string, values:UpdateLessonType){
        return errorHandler(async()=>{
            const data=validation(UpdateLessonDto, values)
            return this.prisma.lesson.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{

        })
    }
}
