import { ScopeToUser } from '@/common/authz/access';
import { RequireOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UserStepsService } from './user-steps.service';
import { Query as QueryInterface } from '@/common/interfaces';
import { CreateUserStepType, UpdateUserStepType } from './user-steps.dto';

@Controller('user-steps')
export class UserStepsController {
  constructor(private readonly userStepsService: UserStepsService) {}

  @Post()
  @ScopeToUser()
  create(@Body() createUserStepDto: CreateUserStepType) {
    return this.userStepsService.create(createUserStepDto);
  }

  @Get()
  @ScopeToUser()
  findAll(@Query() q: QueryInterface) {
    return this.userStepsService.findAll({ ...q });
  }

  @Get(':id')
  @RequireOwnership('user-step')
  findOne(@Param('id') id: string, @Query() q: QueryInterface) {
    return this.userStepsService.findOne(id, q);
  }

  @Patch(':id')
  @RequireOwnership('user-step')
  update(@Param('id') id: string, @Body() updateUserStepDto: UpdateUserStepType) {
    return this.userStepsService.update(id, updateUserStepDto);
  }

  @Post('/complete/:id')
  @RequireOwnership('user-step')
  complete(
    @Param('id') id:string
  ){
    return this.userStepsService.complete(id)
  }

  @Delete(':id')
  @RequireOwnership('user-step')
  remove(@Param('id') id: string) {
    return this.userStepsService.remove(id);
  }
}
