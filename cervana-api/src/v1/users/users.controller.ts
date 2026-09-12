import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { ApiCrudDocs } from '@/common/lib/docs';
import { BaseUserSchema, UserDetailSchema, UsersListSchema } from '@/common/docs/users.doc';
import { ApiTags } from '@nestjs/swagger';
import { Query as QueryInterface } from '@/common/interfaces';
import { Roles } from '../auth/auth.decorator';
import { CreateUserDto, CreateUserDtoType, UpdateUserDto, UpdateUserDtoType } from './users.dto';
import { Role } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService
  ) {}

  @Roles(Role.ADMIN)
  @Post('/')
  @ApiCrudDocs.create(BaseUserSchema, CreateUserDto, 'User')
  async createUser(
    @Body(new ZodPipe(CreateUserDto)) dto: CreateUserDtoType,
  ) {
    return this.usersService.create(dto);
  }

  @Get('/')
  @ApiCrudDocs.findAll(UsersListSchema, 'User', true)
  async getUsers(@Query() query: QueryInterface) {
    return this.usersService.findAll(query);
  }

  @Get('/:id')
  @ApiCrudDocs.findOne(UserDetailSchema, 'User')
  async getUser(
    @Param('id') id: string,
    @Query() query: Pick<QueryInterface, 'include'>
  ) {
    return this.usersService.findOne(id, query);
  }

  @Patch('/:id')
  @ApiCrudDocs.update(UpdateUserDto, 'User')
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateUserDto)) dto: UpdateUserDtoType,
  ) {
    return this.usersService.update(id, dto);
  }

  @Delete('/:id')
  @ApiCrudDocs.delete('User')
  async deleteUser(
    @Param('id') id: string,
  ) { 
    return this.usersService.remove(id);
  }
}