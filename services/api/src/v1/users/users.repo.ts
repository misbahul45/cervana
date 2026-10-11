import { errorHandler, validation } from '@/common/lib/utils';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { CreateUserDto, CreateUserDtoType, UpdateUserDto, UpdateUserDtoType, UserListQueryType } from './users.dto';
import { MembershipStatus, Prisma, StreakActivity, User } from '@prisma/client';

const listSelect = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    provider: true,
    role: true,
    isActive: true,
    totalPoints: true,
    stars: true,
    currentStreak: true,
    createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepo {
    constructor(
        private readonly prisma:PrismaService
    ){}

    async findActiveMembershipRoles(userId: string) {
        return errorHandler(async () =>
            this.prisma.tenantMembership.findMany({
                where: { userId, status: MembershipStatus.ACTIVE },
                select: { role: true },
            }),
        );
    }

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


    async findAll(q: UserListQueryType) {
        return errorHandler(async () => {
            const where: Prisma.UserWhereInput = {
                ...(q.q && {
                    OR: [
                        { name: { contains: q.q, mode: 'insensitive' } },
                        { email: { contains: q.q, mode: 'insensitive' } },
                    ],
                }),
                ...(q.role && { role: q.role }),
                ...(q.isActive !== undefined && { isActive: q.isActive }),
            };
            const [field, direction] = q.sort.split(':') as [string, 'asc' | 'desc'];
            const [data, total] = await Promise.all([
                this.prisma.user.findMany({
                    where,
                    select: listSelect,
                    orderBy: [{ [field]: direction }, { id: 'asc' }],
                    skip: (q.page - 1) * q.limit,
                    take: q.limit,
                }),
                this.prisma.user.count({ where }),
            ]);
            return {
                data,
                meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
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
