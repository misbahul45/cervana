import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@/common/config/prisma/prisma.service';

export interface BackupRunResult {
  tag: string;
  sizeBytes: number;
  checksum: string;
  storageUri: string;
}

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly runner?: {
      run: (tag: string) => Promise<{ sizeBytes: number; checksum: string; storageUri: string }>;
    },
  ) {}

  async startBackup(tag: string) {
    return this.prisma.backupRecord.create({
      data: {
        tag,
        sizeBytes: BigInt(0),
        checksum: '',
        storageUri: `file:///backups/${tag}.dump.gz`,
        status: 'PENDING' as any,
      },
    });
  }

  async runBackup(
    tag: string,
    storageBase: string = '/backups',
    precomputed?: { sizeBytes: number; checksum: string; storageUri: string },
  ): Promise<BackupRunResult> {
    const record = await this.startBackup(tag);
    const result =
      this.runner
        ? await this.runner.run(tag)
        : precomputed
        ? precomputed
        : { sizeBytes: 0, checksum: '', storageUri: `${storageBase}/${tag}.dump.gz` };
    await this.prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        sizeBytes: BigInt(result.sizeBytes),
        checksum: result.checksum,
        storageUri: result.storageUri,
        status: 'COMPLETED' as any,
        completedAt: new Date(),
      },
    });
    return {
      tag,
      sizeBytes: result.sizeBytes,
      checksum: result.checksum,
      storageUri: result.storageUri,
    };
  }

  async listLatest(limit = 50) {
    return this.prisma.backupRecord.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async markRestored(tag: string) {
    const record = await this.prisma.backupRecord.findUnique({ where: { tag } });
    if (!record) throw new Error('backup_not_found');
    return this.prisma.backupRecord.update({
      where: { id: record.id },
      data: { status: 'RESTORED' as any, restoredAt: new Date() },
    });
  }
}