import { Injectable } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateThemeDto, CreateThemeIconDto, CreateThemeIconType, CreateThemeType, UpdateThemeDto, UpdateThemeType } from '@/v1/gamify/themes/themes.dto';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Prisma, Theme } from '@prisma/client';

@Injectable()
export class ThemesRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof Theme>(
        key: K,
        value: Theme[K],
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

            return await this.prisma.theme.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAllIcons(themeId:string){
        return errorHandler(async()=>{
            return await this.prisma.themeIcon.findMany({
                where:{
                    themeId
                }
            })
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
                this.prisma.theme.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.theme.count({ where }),
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

    async create(values:CreateThemeType){
        return errorHandler(async()=>{
            const data=validation(CreateThemeDto, values)

            if(Array.isArray(data)){
                return await this.prisma.theme.createMany({data})
            }

            return await this.prisma.theme.create({data})   
        })
    }

    async createIcon(values: CreateThemeIconType) {
        return errorHandler(async () => {
            const data = validation(CreateThemeIconDto, values);

            const formatForPrisma = (item: { themeId: string; name: string; imageIcon?: any }) => ({
            themeId: item.themeId,
            name: item.name,
            imageIcon: item.imageIcon
                ? (typeof item.imageIcon === "string" ? item.imageIcon : item.imageIcon)
                : Prisma.JsonNull
            });

            if (Array.isArray(data)) {
            const prismaData: Prisma.ThemeIconCreateManyInput[] = data.map(formatForPrisma);
            return await this.prisma.themeIcon.createMany({ data: prismaData });
            }

            const prismaDataSingle: Prisma.ThemeIconCreateInput = {
            theme: { connect: { id: data.themeId } },
            name: data.name,
            imageIcon: data.imageIcon
                ? (typeof data.imageIcon === "string" ? data.imageIcon : data.imageIcon)
                : Prisma.JsonNull
            };

            return await this.prisma.themeIcon.create({ data: prismaDataSingle });
        });
    }


    async update(id:string, values:UpdateThemeType){
        return errorHandler(async()=>{
            const data=validation(UpdateThemeDto, values)

            return await this.prisma.theme.update({
                where: { id },
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.theme.delete({
                where: { id }
            })
        })
    }

    async deleteIcon(id:string){
        return errorHandler(async()=>{
            return await this.prisma.themeIcon.delete({
                where: { id }
            })
        })        
    }
}
