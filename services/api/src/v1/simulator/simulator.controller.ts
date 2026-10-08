import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { GetUser, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { SimulatorService } from './simulator.service';

@Controller('simulator')
@UseGuards(JwtAuthGuard)
export class SimulatorController {
  constructor(private readonly simulator: SimulatorService) {}

  @Get('scenarios')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  listScenarios() {
    return this.simulator.listScenarios();
  }

  @Post('companies')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  create(
    @GetUser('id') userId: string,
    @Body() body: { scenarioSlug: string; days?: number },
  ) {
    return this.simulator.createCompany({
      ownerId: userId,
      tenantId: 'default',
      scenarioSlug: body.scenarioSlug,
      days: body.days,
    });
  }

  @Get('companies/:id')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async get(@Param('id') id: string) {
    return this.simulator.getCompany(id, 'default');
  }

  @Get('companies/:id/journal-entries')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async listEntries(@Param('id') id: string) {
    return this.simulator.listEntries(id, 'default');
  }

  @Post('companies/:id/journal-entries')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async addEntry(
    @Param('id') id: string,
    @Body() body: { date: string; debitAccount: string; creditAccount: string; amount: number; memo?: string },
  ) {
    return this.simulator.addEntry(id, 'default', body);
  }

  @Post('companies/:id/close-period')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async closePeriod(
    @Param('id') id: string,
    @Body() body: { period: string },
  ) {
    return this.simulator.closePeriod(id, 'default', body.period);
  }

  @Post('companies/:id/statements')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  async statements(
    @Param('id') id: string,
    @Body() body: { period: string },
  ) {
    return this.simulator.generateStatements(id, 'default', body.period);
  }
}