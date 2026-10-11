import { AppErrorCode } from '@/common/lib/error';
import { ClassEnrollmentsService } from '../class-enrollments.service';

const CLASS_ID = 'd88652ad-c4d7-4f38-b119-b6e09b3c0760';
const INSTRUCTOR = 'f43bfce7-b141-4351-9723-989d972c35f0';
const LEARNER = '62c22ca0-277f-4036-bf6c-624ee93808b3';

const buildService = () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    classProduct: {
      findUnique: jest.fn().mockResolvedValue({
        id: CLASS_ID,
        tenantId: 'tenant-1',
        instructorId: INSTRUCTOR,
        accessType: 'FREE',
        status: 'PUBLISHED',
        capacity: 20,
      }),
    },
    tenant: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    classEnrollment: {
      findUnique: jest.fn().mockResolvedValue({ id: 'enrollment-1', status: 'ACTIVE' }),
    },
  };
  const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
  const audit = { record: jest.fn() };
  const bus = { publish: jest.fn() };
  const service = new ClassEnrollmentsService(prisma as never, audit as never, bus as never);
  return { service, tx, audit };
};

describe('ClassEnrollmentsService.enrollFree for the class creator', () => {
  it('refuses the instructor of the class before touching enrollments', async () => {
    const { service, tx, audit } = buildService();

    const failure = await service
      .enrollFree({ id: INSTRUCTOR, role: 'TEACHER' } as never, CLASS_ID, 'trace-1')
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ statusCode: 403, code: AppErrorCode.FORBIDDEN });
    expect(tx.classEnrollment.findUnique).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('still lets another learner reach the enrollment step', async () => {
    const { service, tx } = buildService();

    const result = await service.enrollFree({ id: LEARNER, role: 'STUDENT' } as never, CLASS_ID, 'trace-2');

    expect(tx.classEnrollment.findUnique).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ created: false });
  });
});
