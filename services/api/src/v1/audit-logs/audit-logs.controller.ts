import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { Roles } from '../auth/auth.decorator';
import { AuditLogQueryDto, AuditLogQueryType } from './audit-logs.dto';
import { AuditLogsService } from './audit-logs.service';

@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly logs: AuditLogsService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query(new ZodPipe(AuditLogQueryDto)) query: AuditLogQueryType) {
    return this.logs.list(query);
  }

  @Roles(Role.ADMIN)
  @Get('actions')
  actions() {
    return this.logs.actions();
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.logs.findOne(id);
  }
}
