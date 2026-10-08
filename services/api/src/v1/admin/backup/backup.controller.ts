import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/v1/auth/guards/jwt.guard';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { BackupService } from './backup.service';

function serializeBigInt(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

@Controller('admin/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  @Roles(Role.ADMIN)
  async list() {
    return serializeBigInt(await this.backups.listLatest());
  }

  @Post('run')
  @Roles(Role.ADMIN)
  async run(
    @Body()
    body: {
      tag: string;
      sizeBytes?: number;
      checksum?: string;
      storageUri?: string;
    },
  ) {
    const precomputed =
      body.sizeBytes !== undefined && body.checksum && body.storageUri
        ? { sizeBytes: body.sizeBytes, checksum: body.checksum, storageUri: body.storageUri }
        : undefined;
    return serializeBigInt(await this.backups.runBackup(body.tag, undefined, precomputed));
  }

  @Post('restore')
  @Roles(Role.ADMIN)
  async restore(@Body() body: { tag: string }) {
    return serializeBigInt(await this.backups.markRestored(body.tag));
  }
}