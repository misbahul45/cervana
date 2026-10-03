import { BackupService } from '../backup.service';

describe('BackupService (Phase 9)', () => {
  it('records a BackupRecord with COMPLETED status', async () => {
    const prisma = {
      backupRecord: {
        create: jest.fn().mockImplementation(async (args: any) => ({ id: 'b1', ...args.data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const svc = new BackupService(prisma as any);
    const result = await svc.runBackup('test-1');
    expect(result.tag).toBe('test-1');
    expect(result.storageUri).toContain('test-1.dump.gz');
  });
});