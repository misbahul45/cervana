import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/common/config/prisma/prisma.service";
import { Query } from "@/common/interfaces";
import { cleanCreateData, errorHandler, validation } from "@/common/lib/utils";
import {
  CreateUserStepDto,
  CreateUserStepType,
  UpdateUserStepDto,
  UpdateUserStepType,
} from "./user-steps.dto";
import { ChatRole, Prisma, UserStep } from "@prisma/client";
import { LeaderboardsRepo } from "@/v1/gamify/leaderboards/leaderboards.repo";


  type UserStepWithChat = Prisma.UserStepGetPayload<{
  include: {
    chat: {
      include: {
        messages: true
      }
    }
  }
}>;

@Injectable()
export class UserStepsRepo {
  constructor(private readonly prisma: PrismaService, private readonly leaderboardRepo:LeaderboardsRepo) {}

  async findAll(q: Query) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      for (const key in q) {
        if (!['q', 'page', 'limit', 'sort', 'include'].includes(key)) {
          where[key] = q[key];
        }
      }

      let include: any = undefined;
      if (q.include) {
        const includes = Array.isArray(q.include) ? q.include : q.include.split(",");
        include = includes.reduce((acc, field) => {
          acc[field] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      let orderBy: any = undefined;
      if (q.sort) {
        const [field, direction = "asc"] = q.sort.split(":");
        orderBy = { [field]: direction };
      }

      const data = await this.prisma.userStep.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      });

      const total = await this.prisma.userStep.count({ where });

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

  async findOne<K extends keyof UserStep>(
    key: K,
    value: UserStep[K],
    q: Query = {}
  ) {
    return errorHandler(async () => {
      let include: Record<string, boolean> | undefined;

      if (q.include) {
        const includes = Array.isArray(q.include)
          ? q.include
          : q.include.split(",");
        include = includes.reduce((acc, curr) => {
          acc[curr] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      const res= await this.prisma.userStep.findFirst({
        where: { [key]: value },
        include,
      });

      console.log(res)
      return res;
    });
  }

async create(
  values: CreateUserStepType
): Promise<UserStepWithChat | UserStepWithChat[]> {
  return errorHandler(async () => {
    const validated = validation(CreateUserStepDto, values);
    const data = JSON.parse(JSON.stringify(validated));

    const includeBlock = {
      chat: {
        include: {
          messages: true
        }
      }
    };

    if (!Array.isArray(data)) {
      return await this.prisma.userStep.create({
        data: {
          ...data,
          chat: {
            create: {
              title: data.title || '',
              messages: {
                create: {
                  text: "analyzing requirements",
                  role: ChatRole.ASSISTANT
                }
              }
            }
          }
        },
        include: includeBlock
      });
    }

    const results: UserStepWithChat[] = [];

    for (const item of data) {
      const created = await this.prisma.userStep.create({
        data: {
          ...item,
          chat: {
            create: {
              title: item.title || '',
              messages: {
                create: {
                  text: "analyzing requirements",
                  role: ChatRole.ASSISTANT
                }
              }
            }
          }
        },
        include: includeBlock
      });

      results.push(created);
    }

    return results;
  });
}


async complete(id: string) {
  return errorHandler(async () => {
    const res = await this.prisma.userStep.update({
      where: { id },
      data: { isDone: true }
    })

    await this.prisma.userStep.updateMany({
      where: {
        order: res.order + 1,
        stepTemplateId: res.stepTemplateId,
        userId: res.userId
      },
      data: { isUnlocked:true }
    })

    const step = await this.prisma.step.findUnique({
      where: { id: res.stepTemplateId! },
      include: {
        lesson: {
          include: {
            subTopic: {
              include: { topic: true }
            }
          }
        }
      }
    })

    const topicId = step?.lesson?.subTopic?.topic?.id ?? undefined
    const subTopicId = step?.lesson?.subTopic?.id ?? undefined

    const pointValue = 10
    // synthetic ids
    const globalKey = `g-${res.userId}`
    const topicKey = `t-${res.userId}-${topicId ?? 'none'}`
    const subTopicKey = `st-${res.userId}-${subTopicId ?? 'none'}`

    // 1. GLOBAL
    await this.prisma.leaderboardScore.upsert({
      where: { id: globalKey },
      create: {
        id: globalKey,
        userId: res.userId,
        scope: 'GLOBAL',
        categoryId: null,
        topicId: null,
        subTopicId: null,
        score: pointValue
      },
      update: { score: { increment: pointValue } }
    })

    // 2. TOPIC
    await this.prisma.leaderboardScore.upsert({
      where: { id: topicKey },
      create: {
        id: topicKey,
        userId: res.userId,
        scope: 'TOPIC',
        categoryId: null,
        topicId: topicId ?? null,
        subTopicId: null,
        score: pointValue
      },
      update: { score: { increment: pointValue } }
    })

    // 3. SUBTOPIC
    await this.prisma.leaderboardScore.upsert({
      where: { id: subTopicKey },
      create: {
        id: subTopicKey,
        userId: res.userId,
        scope: 'SUBTOPIC',
        categoryId: null,
        topicId: null,
        subTopicId: subTopicId ?? null,
        score: pointValue
      },
      update: { score: { increment: pointValue } }
    })

    return res
  })
}



async update(id: string, values: UpdateUserStepType) {
  return errorHandler(async () => {
    const data = validation(UpdateUserStepDto, values);

    const sanitize = {
      ...data,
      updatedAt: data.updatedAt ?? new Date(),
    };

    return await this.prisma.userStep.update({
      where: { id },
      data: sanitize,
    });
  });
}


  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.userStep.delete({
        where: { id },
      });
    });
  }
}
