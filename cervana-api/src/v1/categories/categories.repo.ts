import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/config/prisma/prisma.service';
import { errorHandler, slugify, validation } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { CreateCategoryDto, CreateCategoryType, UpdateCategoryDto, UpdateCategoryType } from './categories.dto';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async create(values: CreateCategoryType) {
        return errorHandler(async () => {
            const data = validation(CreateCategoryDto, values);

            if (Array.isArray(data)) {
                return await this.prisma.category.createMany({
                    data: data.map((datum) => ({
                        ...datum,
                    })),
                    skipDuplicates: true,
                });
            }

            return await this.prisma.category.create({
                data: {
                ...data,
                },
            });
        });
    }


    async update(id: string, values: UpdateCategoryType){
        return errorHandler(async()=>{
    
            const data = validation(UpdateCategoryDto, values);
    
            return await this.prisma.category.update({
                where:{id},
                data,
            });
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            await this.prisma.category.delete({
                where:{id}
            })
        })
    }

    async findOne<K extends keyof Category>(
        key: K,
        value: Category[K],
        q:Query = {}
    ){
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

            return await this.prisma.category.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAll(q: Query) {
        return errorHandler(async () => {
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (q.q) {
                where.OR = [
                    { name: { contains: q.q, mode: 'insensitive' } },
                    { slug: { contains: q.q, mode: 'insensitive' } },
                    { description: { contains: q.q, mode: 'insensitive' } },
                ];
            }

            let orderBy: any = undefined;
            if (q.sort) {
                const [field, direction = 'asc'] = q.sort.split(':');
                orderBy = { [field]: direction };
            }

                let include: any = undefined;
            if (q.include) {
                const includes = Array.isArray(q.include) ? q.include : q.include.split(',');
                include = includes.reduce((acc, field) => {
                    if (field.includes(':')) {
                    const [name, take] = field.split(':');
                    acc[name] = { take: Number(take) || 10 };
                    } else {
                    acc[field] = true;
                    }
                    return acc;
                }, {} as Record<string, any>);
            }

            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include', 'type'].includes(key)) {
                    where[key] = q[key];
                }
            }

            if (q.type === 'populer') {
                orderBy = {
                    topics: { _count: 'desc' },
                };
            }

            const [data, total] = await Promise.all([
            this.prisma.category.findMany({
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
        });
    }


    async addTopicToCategory(categoryId:string, topicId:string){
        return errorHandler(async()=>{
            return await this.prisma.category.update({
                where: { id: categoryId },
                    data: {
                        topics: {
                            connect: { id: topicId }, 
                        },
                    },
                });
        })
    }

    async removeTopicAndCategory(categoryId:string, topicId:string){
        return errorHandler(async()=>{
            return await this.prisma.category.update({
                where:{ id:categoryId },
                data:{
                    topics:{
                        disconnect:{ id:topicId }
                    }
                }
            })
        })
   }

}
