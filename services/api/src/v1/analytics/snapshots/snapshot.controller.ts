import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { SnapshotService } from './snapshot.service';

@Controller('analytics/snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotService) {}

  @Post('run')
  @Roles(Role.ADMIN)
  async run() {
    return this.snapshots.runAll();
  }
}