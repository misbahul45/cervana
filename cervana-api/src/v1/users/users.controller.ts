import { AuthenticatedOnly } from '@/common/authz/access';
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
import { GetUser, Roles } from '../auth/auth.decorator';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { PolicyService } from '@/common/authz/policy.service';
import { TraceId } from '@/common/authz/trace-id.decorator';
import {
  ChangeRoleDto,
  ChangeRoleDtoType,
  CreateUserDto,
  CreateUserDtoType,
  SetActivationDto,
  SetActivationDtoType,
  UpdateProfileDto,
  UpdateProfileDtoType,
} from './users.dto';
import { Role } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly policy: PolicyService,
  ) {}

  @Roles(Role.ADMIN)
  @Post('/')
  @ApiCrudDocs.create(BaseUserSchema, CreateUserDto, 'User')
  async createUser(
    @Body(new ZodPipe(CreateUserDto)) dto: CreateUserDtoType,
  ) {
    return this.usersService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Get('/')
  @ApiCrudDocs.findAll(UsersListSchema, 'User', true)
  async getUsers(@Query() query: QueryInterface) {
    return this.usersService.findAll(query);
  }

  @Get('/:id')
  @ApiCrudDocs.findOne(UserDetailSchema, 'User')
  @AuthenticatedOnly()
  async getUser(
    @Param('id') id: string,
    @Query() query: Pick<QueryInterface, 'include'>,
    @GetUser() actor: AuthUser,
  ) {
    this.policy.assertSelfOrAdmin(actor, id);
    return this.usersService.findOne(id, query);
  }

  @Patch('/:id')
  @ApiCrudDocs.update(UpdateProfileDto, 'User')
  @AuthenticatedOnly()
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateProfileDto)) dto: UpdateProfileDtoType,
    @GetUser() actor: AuthUser,
  ) {
    return this.usersService.update(actor, id, dto);
  }

  @Roles(Role.ADMIN)
  @Post('/:id/role')
  async changeRole(
    @Param('id') id: string,
    @Body(new ZodPipe(ChangeRoleDto)) dto: ChangeRoleDtoType,
    @GetUser() actor: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.usersService.changeRole(actor, id, dto, traceId);
  }

  @Roles(Role.ADMIN)
  @Post('/:id/activation')
  async setActivation(
    @Param('id') id: string,
    @Body(new ZodPipe(SetActivationDto)) dto: SetActivationDtoType,
    @GetUser() actor: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.usersService.setActivation(actor, id, dto, traceId);
  }

  @Roles(Role.ADMIN)
  @Delete('/:id')
  @ApiCrudDocs.delete('User')
  async deleteUser(
    @Param('id') id: string,
  ) { 
    return this.usersService.remove(id);
  }
}