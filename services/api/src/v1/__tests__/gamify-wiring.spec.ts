import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '@/common/authz/audit.service';
import { PolicyService } from '@/common/authz/policy.service';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { AssessmentGamifyModule } from '@/v1/gamify/assessment-gamify.module';
import { AssessmentGamifyService } from '@/v1/gamify/assessment-gamify.service';
import { QuizAttemptsModule } from '@/v1/quiz/quiz-attempts/quiz-attempts.module';
import { QuizAttemptsService } from '@/v1/quiz/quiz-attempts/quiz-attempts.service';

@Global()
@Module({
  providers: [
    { provide: AuditService, useValue: { record: async () => undefined } },
    { provide: PolicyService, useValue: {} },
  ],
  exports: [AuditService, PolicyService],
})
class AuditStubModule {}

const prismaStub = {
  onModuleInit: async () => undefined,
  onModuleDestroy: async () => undefined,
  $connect: async () => undefined,
  $disconnect: async () => undefined,
};

describe('gamification wiring', () => {
  it('resolves the assessment orchestrator with every collaborator', async () => {
    const module = await Test.createTestingModule({ imports: [AuditStubModule, AssessmentGamifyModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    expect(module.get(AssessmentGamifyService)).toBeInstanceOf(AssessmentGamifyService);
    await module.close();
  });

  it('declares the orchestrator as a dependency of the quiz attempts service and imports its module', () => {
    const constructorTypes: unknown[] = Reflect.getMetadata('design:paramtypes', QuizAttemptsService);
    const imports: unknown[] = Reflect.getMetadata('imports', QuizAttemptsModule);

    expect(constructorTypes).toContain(AssessmentGamifyService);
    expect(imports).toContain(AssessmentGamifyModule);
  });
});
