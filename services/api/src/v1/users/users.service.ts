import { Injectable } from '@nestjs/common';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { Query as QueryInterface } from '@/common/interfaces';
import * as bcrypt from 'bcrypt';
import { UsersRepo } from './users.repo';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { ChangeRoleDtoType, CreateUserDtoType, SetActivationDtoType, UpdateProfileDtoType } from './users.dto';

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepo: UsersRepo,
        private readonly prisma: PrismaService,
        private readonly policy: PolicyService,
        private readonly audit: AuditService,
    ){}

    async create(values: CreateUserDtoType) {
        return errorHandler(async () => {
            const isExist = await this.usersRepo.findOne('email', values.email);

            if (isExist?.email) {
                throw new AppError('User already exist', 400);
            }

            if(values.password){
                values.password = await bcrypt.hash(values.password, 10);

            }
            const { password, ...res } = await this.usersRepo.create({
                ... values,
                emailVerified:new Date()
            });

            return {
                message: 'Successfully created user',
                data: res
            };
        });
    }

    async update(actor: Actor, id: string, values: UpdateProfileDtoType) {
        this.policy.assertSelfOrAdmin(actor, id);
        return errorHandler(async () => {
            const isExist = await this.usersRepo.findOne('id', id);

            if (!isExist?.id) {
                throw new AppError('User not found', 404);
            }

            await this.usersRepo.update({
                id,
                values: { ...values }
            });

            return {
                message: 'Successfully updated user',
                data: null
            };
        });
    }

    async changeRole(actor: Actor, id: string, values: ChangeRoleDtoType, traceId?: string) {
        this.policy.assertAdmin(actor);
        if (actor.id === id) {
            throw new AppError('Administrators cannot change their own role', 403);
        }
        return errorHandler(async () => {
            const result = await this.prisma.$transaction(async (tx) => {
                const before = await tx.user.findUnique({ where: { id }, select: { id: true, role: true } });
                if (!before) {
                    throw new AppError('User not found', 404);
                }
                if (before.role === values.role) {
                    return { id, role: before.role, changed: false };
                }
                const updated = await tx.user.update({
                    where: { id },
                    data: { role: values.role },
                    select: { id: true, role: true },
                });
                await this.audit.record(
                    {
                        actorId: actor.id,
                        actorRole: actor.role,
                        action: 'USER_ROLE_CHANGED',
                        entityType: 'User',
                        entityId: id,
                        before: { role: before.role },
                        after: { role: updated.role },
                        reason: values.reason,
                        traceId,
                    },
                    tx,
                );
                return { ...updated, changed: true };
            });
            return { message: 'Successfully changed user role', data: result };
        });
    }

    async setActivation(actor: Actor, id: string, values: SetActivationDtoType, traceId?: string) {
        this.policy.assertAdmin(actor);
        if (actor.id === id) {
            throw new AppError('Administrators cannot deactivate themselves', 403);
        }
        return errorHandler(async () => {
            const result = await this.prisma.$transaction(async (tx) => {
                const before = await tx.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
                if (!before) {
                    throw new AppError('User not found', 404);
                }
                if (before.isActive === values.isActive) {
                    return { id, isActive: before.isActive, changed: false };
                }
                const updated = await tx.user.update({
                    where: { id },
                    data: { isActive: values.isActive },
                    select: { id: true, isActive: true },
                });
                await this.audit.record(
                    {
                        actorId: actor.id,
                        actorRole: actor.role,
                        action: values.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
                        entityType: 'User',
                        entityId: id,
                        before: { isActive: before.isActive },
                        after: { isActive: updated.isActive },
                        reason: values.reason,
                        traceId,
                    },
                    tx,
                );
                return { ...updated, changed: true };
            });
            return { message: 'Successfully updated account activation', data: result };
        });
    }

    async remove(id: string) {
        return errorHandler(async () => {
            const isExist = await this.usersRepo.findOne('id', id);

            if (!isExist?.id) {
                throw new AppError('User not found', 404);
            }

            await this.usersRepo.delete(id);

            return {
                message: 'Successfully deleted user',
                data: null
            };
        });
    }

    async findOne(id: string, q: Pick<QueryInterface, 'include'>) {
        return errorHandler(async () => {
            const user = await this.usersRepo.findOne('id', id, q);

            if (!user?.id) {
                throw new AppError('User not found', 404);
            }

            const { password, ...res }=user
            return {
                message: 'Successfully retrieved user',
                data: res
            };
        });
    }

    async findAll(q: QueryInterface) {
        return errorHandler(async () => {
            const result = await this.usersRepo.findAll(q);

            const sanitizedUser=result.data.map((user)=>{
                const { password, ...res }=user
                return res
            })
            return {
                message: 'Successfully retrieved users',
                data:{
                    data:sanitizedUser,
                    pagination: {
                        page: result.meta.page,
                        limit: result.meta.limit,
                        total: result.meta.total,
                        totalPages: result.meta.totalPages
                    }
                }
            };
        });
    }
}