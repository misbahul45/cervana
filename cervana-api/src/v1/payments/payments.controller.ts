import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { PolicyService } from '@/common/authz/policy.service';
import { GetUser } from '../auth/auth.decorator';
import { RequireOwnership } from '../common/guards/ownership.decorator';
import { PaymentService } from './payment.service';
import { ManualPaymentService } from './providers/manual/manual-payment.service';
import { SubmitManualPaymentDto, SubmitManualPaymentDtoType } from './providers/manual/manual-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentService,
    private readonly manual: ManualPaymentService,
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
  ) {}

  @Get('methods')
  @AuthenticatedOnly()
  methods() {
    return { message: 'Successfully retrieved payment methods', data: this.payments.listMethods() };
  }

  @Get('intents/:intentId')
  @RequireOwnership('payment-intent', { param: 'intentId' })
  async findIntent(@Param('intentId', ParseUUIDPipe) intentId: string, @GetUser() user: AuthUser) {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: { order: { select: { userId: true } } },
    });
    if (!intent || (intent.order.userId !== user.id && !this.policy.isAdmin(user))) {
      throw new AppError('Payment not found', 404, AppErrorCode.NOT_FOUND);
    }
    const { order: _order, ...payload } = intent;
    return {
      message: 'Successfully retrieved payment',
      data: { ...payload, presentation: this.payments.present(intent) },
    };
  }

  @Get('manual/intents/:intentId/submissions')
  @RequireOwnership('payment-intent', { param: 'intentId' })
  listSubmissions(@Param('intentId', ParseUUIDPipe) intentId: string, @GetUser() user: AuthUser) {
    return this.manual.listForIntent(user, intentId);
  }

  @Post('manual/intents/:intentId/submissions')
  @RequireOwnership('payment-intent', { param: 'intentId' })
  submit(
    @Param('intentId', ParseUUIDPipe) intentId: string,
    @Body(new ZodPipe(SubmitManualPaymentDto)) dto: SubmitManualPaymentDtoType,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.manual.submit(user, intentId, dto, traceId);
  }
}
