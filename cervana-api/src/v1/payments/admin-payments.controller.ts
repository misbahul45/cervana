import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { AuditService } from '@/common/authz/audit.service';
import { GetUser, Roles } from '../auth/auth.decorator';
import { PaymentService } from './payment.service';
import { ManualPaymentService } from './providers/manual/manual-payment.service';
import {
  ApproveManualPaymentDto,
  ApproveManualPaymentDtoType,
  ManualQueueQueryDto,
  ManualQueueQueryDtoType,
  RejectManualPaymentDto,
  RejectManualPaymentDtoType,
} from './providers/manual/manual-payment.dto';

@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentService,
    private readonly manual: ManualPaymentService,
    private readonly audit: AuditService,
  ) {}

  @Roles(Role.ADMIN)
  @Get('manual/submissions')
  queue(@Query(new ZodPipe(ManualQueueQueryDto)) query: ManualQueueQueryDtoType, @GetUser() user: AuthUser) {
    return this.manual.queue(user, query);
  }

  @Roles(Role.ADMIN)
  @Get('manual/submissions/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.manual.findOne(user, id);
  }

  @Roles(Role.ADMIN)
  @Post('manual/submissions/:id/start-review')
  startReview(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.manual.startReview(user, id, traceId);
  }

  @Roles(Role.ADMIN)
  @Post('manual/submissions/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ApproveManualPaymentDto)) dto: ApproveManualPaymentDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.manual.approve(user, id, dto.reason, traceId);
  }

  @Roles(Role.ADMIN)
  @Post('manual/submissions/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(RejectManualPaymentDto)) dto: RejectManualPaymentDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.manual.reject(user, id, dto, traceId);
  }

  @Roles(Role.ADMIN)
  @Post('intents/:intentId/reconcile')
  async reconcile(
    @Param('intentId', ParseUUIDPipe) intentId: string,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    const report = await this.payments.reconcile(intentId, {
      actor: { kind: 'ADMIN', id: user.id, role: user.role },
      traceId,
    });
    return { message: report.consistent ? 'Payment is consistent' : 'Payment has discrepancies', data: report };
  }

  @Roles(Role.ADMIN)
  @Post('expire-due')
  async expireDue(@GetUser() user: AuthUser, @TraceId() traceId: string) {
    const expired = await this.payments.expireDue();
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_EXPIRE_SWEEP',
      entityType: 'PaymentIntent',
      entityId: 'expire-due',
      after: { expired },
      traceId,
    });
    return { message: 'Expired payment sweep completed', data: { expired } };
  }
}
