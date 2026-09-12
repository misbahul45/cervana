import { Injectable } from '@nestjs/common';
import { errorHandler } from '@/common/lib/utils';
import { AppError } from '@/common/lib/error';
import { Query as QueryInterface } from '@/common/interfaces';
import * as bcrypt from 'bcrypt';
import { UsersRepo } from './users.repo';
import { CreateUserDtoType, UpdateUserDtoType } from './users.dto';

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepo: UsersRepo
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

    async update(id: string, values: UpdateUserDtoType) {
        return errorHandler(async () => {
            const isExist = await this.usersRepo.findOne('id', id);
            
            if (!isExist?.id) {
                throw new AppError('User not found', 404);
            }
            
            await this.usersRepo.update({
                id,
                values: {
                    ...values
                }
            });

            return {
                message: 'Successfully updated user',
                data: null
            };
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