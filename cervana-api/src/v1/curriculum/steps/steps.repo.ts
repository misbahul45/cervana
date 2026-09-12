import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateStepDto, CreateStepType, UpdateStepDto } from './steps.dto';
import { Step } from '@prisma/client';

@Injectable()
export class StepsRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Step>(
        key: K,
        value: Step[K],
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


            return await this.prisma.step.findFirst({
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

            // Searching
            if (q.q) {
                where.OR = [
                    { title: { contains: q.q, mode: 'insensitive' } },
                    { description: { contains: q.q, mode: 'insensitive' } },
                ];
            }

            // Sorting
            let orderBy: any = undefined;
            if (q.sort) {
                const [field, direction = 'asc'] = q.sort.split(':');
                orderBy = { [field]: direction };
            }

            // Include Relations
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

            // Additional filtering except reserved keywords
            for (const key in q) {
                if (!['q', 'page', 'limit', 'sort', 'include', 'type'].includes(key)) {
                    where[key] = q[key];
                }
            }

            const [data, total] = await Promise.all([
                this.prisma.step.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include: {
                        ...include,
                        theme: true,
                        _count: {
                            select: {
                                userSteps: true,
                                resources: true,
                            },
                        },
                    },
                }),
                this.prisma.step.count({ where }),
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


    async create(values:CreateStepType){
        return errorHandler(async()=>{
            const data=validation(CreateStepDto, values)
            return this.prisma.step.create({data})
        })
    }

    async update(id:string, values:any){
        return errorHandler(async()=>{
            const data=validation(UpdateStepDto, values)
            return this.prisma.step.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.step.delete({
                where:{id}
            })
        })
    }
}
