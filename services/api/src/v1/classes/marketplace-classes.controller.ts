import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthenticatedOnly } from '@/common/authz/access';
import { TraceId } from '@/common/authz/trace-id.decorator';
import { ZodPipe } from '@/common/pipes/zod.pipe';
import { AuthUser } from '@/common/interfaces/auth.interface';
import { GetUser, Public } from '../auth/auth.decorator';
import { EnrollmentListQueryDto, EnrollmentListQueryDtoType, MarketplaceClassQueryDto, MarketplaceClassQueryDtoType } from './classes.dto';
import { ClassEnrollmentsService } from './class-enrollments.service';
import { MarketplaceClassesService } from './marketplace-classes.service';

@Controller('marketplace/classes')
export class MarketplaceClassesController {
  constructor(
    private readonly marketplace: MarketplaceClassesService,
    private readonly enrollments: ClassEnrollmentsService,
  ) {}

  @Public()
  @Get()
  list(@Query(new ZodPipe(MarketplaceClassQueryDto)) query: MarketplaceClassQueryDtoType) {
    return this.marketplace.list(query);
  }

  @AuthenticatedOnly()
  @Get('enrollments/mine')
  mine(@Query(new ZodPipe(EnrollmentListQueryDto)) query: EnrollmentListQueryDtoType, @GetUser() user: AuthUser) {
    return this.enrollments.listMine(user, query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketplace.findOne(id);
  }

  @AuthenticatedOnly()
  @Get(':id/access')
  access(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.marketplace.access(user, id);
  }

  @AuthenticatedOnly()
  @Get(':id/materials')
  materials(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser) {
    return this.marketplace.materials(user, id);
  }

  @AuthenticatedOnly()
  @Post(':id/enroll')
  enroll(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.enrollments.enrollFree(user, id, traceId);
  }

  @AuthenticatedOnly()
  @Post(':id/cancel-enrollment')
  cancel(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.enrollments.cancelFree(user, id, traceId);
  }

  @AuthenticatedOnly()
  @Post(':id/sessions/:sessionId/attend')
  attend(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @GetUser() user: AuthUser,
    @TraceId() traceId: string,
  ) {
    return this.enrollments.attend(user, id, sessionId, new Date(), traceId);
  }

  @AuthenticatedOnly()
  @Post(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthUser, @TraceId() traceId: string) {
    return this.enrollments.complete(user, id, new Date(), traceId);
  }
}
