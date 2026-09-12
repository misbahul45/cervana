import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateSubTopicDto, CreateSubTopicType, UpdateSubTopicDto, UpdateSubTopicType } from './subtopics.dto';
import { SubTopic } from '@prisma/client';

@Injectable()
export class SubTopicsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof SubTopic>(
        key: K,
        value: SubTopic[K],
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

            return await this.prisma.subTopic.findFirst({
                where: { [key]:value },
                include:{
                    ...include,
                    theme:true,
                },
            });
        })
    }

    async findAll(q: Query) {
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (q.q) {
                where.OR = [
                    { title: { contains: q.q, mode: 'insensitive' } },
                    { description:{ contains: q.q, mode: 'insensitive' } },
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

            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include', 'type'].includes(key)) {
                    where[key] = q[key];
                }
            }

            const [data, total] = await Promise.all([
                this.prisma.subTopic.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include:{
                        ...include,
                        theme:true,
                        _count: { select: { lessons: true } },
                    },
                }),
                this.prisma.subTopic.count({ where }),
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

    async findOneWithNavigation(id: string, userId?: string) {
        return errorHandler(async () => {
            // Ambil current subTopic
            const current = await this.prisma.subTopic.findFirst({
            where: { id },
            include: {
                theme: true,
                lessons: { orderBy: { sortOrder: 'asc' } },
            },
            });

            if (!current) return null;

            // Ambil next subTopic
            const next = await this.prisma.subTopic.findFirst({
            where: {
                topicId: current.topicId,
                sortOrder: { gt: current.sortOrder },
            },
            orderBy: { sortOrder: 'asc' },
            include: {
                theme: true,
                lessons: { orderBy: { sortOrder: 'asc' } },
            },
            });

            // Ambil prev subTopic
            const previous = await this.prisma.subTopic.findFirst({
            where: {
                topicId: current.topicId,
                sortOrder: { lt: current.sortOrder },
            },
            orderBy: { sortOrder: 'desc' },
            include: {
                theme: true,
                lessons: { orderBy: { sortOrder: 'asc' } },
            },
            });

            // Cek apakah next unlocked
            let nextUnlocked = true;
            if (userId && next) {
            const prevProgress = await this.prisma.subTopicProgress.findFirst({
                where: {
                userId,
                subTopicId: current.id,
                completed: true,
                },
            });
            nextUnlocked = !!prevProgress;
            }

            // Cek apakah previous sudah completed
            let prevCompleted = true;
            if (userId && previous) {
            const prevProgress = await this.prisma.subTopicProgress.findFirst({
                where: {
                userId,
                subTopicId: previous.id,
                completed: true,
                },
            });
            prevCompleted = !!prevProgress;
            }

            return {
            current,
            previous: previous ? { ...previous, completed: prevCompleted } : null,
            next: next ? { ...next, unlocked: nextUnlocked } : null,
            };
        });
    }

    async findAllByTopicId(topicId:string, q:Query){
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {
                topicId
            };

            if (q.q) {
                where.OR = [
                    { title: { contains: q.q, mode: 'insensitive' } },
                    { description:{ contains: q.q, mode: 'insensitive' } },
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
                this.prisma.subTopic.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.subTopic.count({ where }),
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

    async create(values:CreateSubTopicType){
        return errorHandler(async()=>{
            const data=validation(CreateSubTopicDto, values)
            return await this.prisma.subTopic.create({data})
        })
    }

    async update(id:string, values:UpdateSubTopicType){
        return errorHandler(async()=>{
            const data=validation(UpdateSubTopicDto, values)
            return await this.prisma.subTopic.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.subTopic.delete({
                where:{id}
            })
        })
    }
}
