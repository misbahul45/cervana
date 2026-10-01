import { errorHandler, validation } from '@/common/lib/utils';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { CreateUserDto, CreateUserDtoType, UpdateUserDto, UpdateUserDtoType } from './users.dto';
import { StreakActivity, User } from '@prisma/client';

@Injectable()
export class UsersRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findOne<K extends keyof User>(
        key: K,
        value: User[K],
        q: Query = {}
    ) {
        return errorHandler(async () => {
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

            const user = await this.prisma.user.findFirst({
                where: { [key]: value },
                    include,
            });
            return user;
        });
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
                    { email: { contains: q.q, mode: 'insensitive' } },
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
                this.prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.user.count({ where }),
            ]);


            return {
                data:data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        });
    }

    async create(values:CreateUserDtoType){
        return errorHandler(async()=>{
            const data=validation(CreateUserDto, values);

            data.image={
                url: data.image?.url ?? `https://api.dicebear.com/9.x/pixel-art/svg?seed=${Math.random().toString(36).substring(2, 10)}`,      
            }
   
            return await this.prisma.user.create({
                    data: {
                        ...data,
                        leaderboards:{
                            create:{
                                score: 0,
                                scope: 'GLOBAL',
                            }
                        },
                        dailyActivities:{
                            create:{
                                date:new Date(),
                                activityType:StreakActivity.REGISTER,
                                metadata: {
                                    title: 'Pendaftaran Akun Baru',
                                    description: 'User berhasil mendaftar dan membuat akun baru di platform.',
                                    type: 'REGISTER',
                                },
                            }
                        },
                        streakHistories:{
                            create:{
                                date:new Date(),
                                activityType:StreakActivity.DAILY_LOGIN,
                                streakCount:1
                            }
                        },
                        notifications:{
                            create: {
                                title: "Selamat Datang!",
                                body: "Akun kamu telah berhasil dibuat. Ayo mulai belajar sekarang!",
                                type: "SYSTEM",
                            }
                        }
                    },
                    include: {
                        leaderboards: true,
                    },
            });
        })
    }

  async update(args: { id?: string; values: UpdateUserDtoType }) {
    return errorHandler(async () => {
      const { id, values } = args;

      const data = validation(UpdateUserDto, values);

      return await this.prisma.user.update({
        where: id ? { id } : { email: values.email },
        data,
      });
    });
  }

  async delete(id:string){
    return errorHandler(async()=>{
        await this.prisma.user.delete({
            where:{id}
        })
    })
  }
}
