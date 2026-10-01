import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/config/prisma/prisma.service';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import { CreateUserTopicDto, CreateUserTopicType, UpdateUserTopicDto, UpdateUserTopicType } from './userTopics.dto';
import { LeaderboardScope, UserTopic } from '@prisma/client';
import { LeaderboardsRepo } from '@/v1/gamify/leaderboards/leaderboards.repo';
@Injectable()
export class UserTopicsRepo {
    constructor(
        private readonly prisma:PrismaService,
        private readonly LeaderboardsRepo:LeaderboardsRepo
    ){}

    async findOne<K extends keyof UserTopic>(
        key: K,
        value: UserTopic[K],
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

            return await this.prisma.userTopic.findFirst({
                where: { [key]:value },
                include,
            });
        })
    }

    async findAll(userId:string, q: Query) {
        return errorHandler(async()=>{
            const page = Number(q.page) || 1;
            const limit = Number(q.limit) || 10;
            const skip = (page - 1) * limit;

            const where: any = {
                userId
            };
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
                this.prisma.userTopic.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy,
                    include,
                }),
                this.prisma.userTopic.count({ where }),
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

    async create(values:CreateUserTopicType){
        return errorHandler(async()=>{
            const data=validation(CreateUserTopicDto, values)

            if(Array.isArray(data)){
                const res:any= await this.prisma.userTopic.createMany({
                    data,
                    skipDuplicates: true,
                })

                for(const r of res){
                    await this.LeaderboardsRepo.create({
                        userId:r.userId,
                        topicId:r.topicId,
                        score:0,
                        scope:LeaderboardScope.TOPIC
                    })
                }

                return res
            }
            const res= await this.prisma.userTopic.create({
                data,
            })
            await this.LeaderboardsRepo.create({
                userId:data.userId,
                topicId:res.topicId,
                score:0,
                scope:LeaderboardScope.TOPIC
            })
            
            return res;
        })
    }

    async update(id:string,values:UpdateUserTopicType){
        return errorHandler(async()=>{
            const data=validation(UpdateUserTopicDto, values)

            return await this.prisma.userTopic.update({
                where:{id},
                data
            })
        })
    }

    async delete(id:string){
        return errorHandler(async()=>{
            return await this.prisma.userTopic.delete({
                where:{ 
                    id 
                }
            })
        })
    }
}
