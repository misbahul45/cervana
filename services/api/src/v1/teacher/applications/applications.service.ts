import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { Role, TeacherStatus } from '@prisma/client';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Actor, PolicyService } from '@/common/authz/policy.service';
import { AuditService } from '@/common/authz/audit.service';
import { TenantProvisioningService } from '@/v1/tenants/tenant-provisioning.service';
import { ApplicationsRepo } from './applications.repo';
import { ApplicationListQueryType, SubmitApplicationType, UpdateApplicationType } from './applications.dto';
import { CreatorEligibilityService } from '../eligibility/creator-eligibility.service';

interface ReviewOptions {
  actor: Actor;
  applicationId: string;
  target: 'APPROVED' | 'REJECTED';
  feedback?: string;
  traceId?: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepo: ApplicationsRepo,
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly provisioning: TenantProvisioningService,
    @Optional() private readonly eligibility?: CreatorEligibilityService,
  ) {}

  submit(actor: Actor, values: SubmitApplicationType) {
    return errorHandler(async () => {
      if (actor.role !== Role.STUDENT) {
        throw new AppError('Only learners can apply to become a teacher', 403, AppErrorCode.FORBIDDEN);
      }
      const existing = await this.applicationsRepo.findByUserId(actor.id);
      if (existing) {
        throw new AppError('Teacher application already exists', 409, AppErrorCode.UNIQUE_CONSTRAINT_FAILED);
      }
      const topicId = (values as { expertiseTopicId?: string }).expertiseTopicId;
      if (this.eligibility && topicId) {
        const { eligible } = await this.eligibility.check({ userId: actor.id, topicId });
        if (!eligible) {
          throw new BadRequestException('mastery_threshold_not_met');
        }
      }
      const created = await this.applicationsRepo.create(actor.id, values);
      return { message: 'Successfully created teacher application', data: created };
    });
  }

  findAll(actor: Actor, query: ApplicationListQueryType) {
    return errorHandler(async () => {
      const userId = this.policy.resolveUserScope(actor, query.userId);
      const result = await this.applicationsRepo.list({ ...query, userId });
      return {
        message: 'Successfully retrieved teacher applications',
        data: { data: result.data, pagination: result.meta },
      };
    });
  }

  findOne(actor: Actor, id: string) {
    return errorHandler(async () => {
      const application = await this.applicationsRepo.findById(id);
      if (!application || (application.userId !== actor.id && !this.policy.isAdmin(actor))) {
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND);
      }
      return { message: 'Successfully retrieved teacher application', data: application };
    });
  }

  update(actor: Actor, id: string, values: UpdateApplicationType) {
    return errorHandler(async () => {
      const application = await this.applicationsRepo.findById(id);
      if (!application || application.userId !== actor.id) {
        throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND);
      }
      if (application.status !== TeacherStatus.PENDING) {
        throw new AppError(
          'Only pending applications can be edited',
          409,
          AppErrorCode.INVALID_STATE_TRANSITION,
        );
      }
      await this.applicationsRepo.updateContent(id, values);
      return { message: 'Successfully updated teacher application', data: null };
    });
  }

  approve(actor: Actor, applicationId: string, feedback?: string, traceId?: string) {
    this.policy.assertAdmin(actor);
    return this.review({ actor, applicationId, target: 'APPROVED', feedback, traceId });
  }

  reject(actor: Actor, applicationId: string, feedback: string, traceId?: string) {
    this.policy.assertAdmin(actor);
    return this.review({ actor, applicationId, target: 'REJECTED', feedback, traceId });
  }

  private review(options: ReviewOptions) {
    return errorHandler(async () => {
      const { actor, applicationId, target } = options;
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TeacherApplication" WHERE id = ${applicationId} FOR UPDATE`;
        const application = await tx.teacherApplication.findUnique({ where: { id: applicationId } });
        if (!application) {
          throw new AppError('Teacher application not found', 404, AppErrorCode.NOT_FOUND);
        }
        if (application.userId === actor.id) {
          throw new AppError('Applications cannot be reviewed by their applicant', 403, AppErrorCode.FORBIDDEN);
        }
        if (application.status === target) {
          return { application, changed: false };
        }
        if (application.status !== TeacherStatus.PENDING) {
          throw new AppError(
            `Application cannot move from ${application.status} to ${target}`,
            409,
            AppErrorCode.INVALID_STATE_TRANSITION,
          );
        }

        const updated = await tx.teacherApplication.update({
          where: { id: applicationId },
          data: {
            status: target,
            reviewedBy: actor.id,
            reviewedAt: new Date(),
            feedback: options.feedback ?? null,
          },
        });

        await this.audit.record(
          {
            actorId: actor.id,
            actorRole: actor.role,
            action: target === 'APPROVED' ? 'TEACHER_APPLICATION_APPROVED' : 'TEACHER_APPLICATION_REJECTED',
            entityType: 'TeacherApplication',
            entityId: applicationId,
            before: { status: application.status },
            after: { status: updated.status },
            reason: options.feedback,
            traceId: options.traceId,
          },
          tx,
        );

        if (target === 'APPROVED') {
          const applicant = await tx.user.findUnique({
            where: { id: application.userId },
            select: { id: true, role: true },
          });
          if (applicant && applicant.role === Role.STUDENT) {
            await tx.user.update({ where: { id: applicant.id }, data: { role: Role.TEACHER } });
            await this.audit.record(
              {
                actorId: actor.id,
                actorRole: actor.role,
                action: 'USER_ROLE_CHANGED',
                entityType: 'User',
                entityId: applicant.id,
                before: { role: applicant.role },
                after: { role: Role.TEACHER },
                reason: `Teacher application ${applicationId} approved`,
                traceId: options.traceId,
              },
              tx,
            );
          }
          if (applicant && applicant.role !== Role.ADMIN) {
            const provisioned = await this.provisioning.provisionForOwner(tx, {
              id: applicant.id,
              displayName: application.fullName,
            });
            if (provisioned.created) {
              await this.audit.record(
                {
                  actorId: actor.id,
                  actorRole: actor.role,
                  tenantId: provisioned.tenantId,
                  action: 'TENANT_CREATED',
                  entityType: 'Tenant',
                  entityId: provisioned.tenantId,
                  after: { ownerId: applicant.id },
                  reason: `Teacher application ${applicationId} approved`,
                  traceId: options.traceId,
                },
                tx,
              );
            }
          }
        }

        return { application: updated, changed: true };
      });

      return {
        message: result.changed ? 'Teacher application reviewed' : 'Teacher application already in requested state',
        data: result.application,
      };
    });
  }
}
