import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '@/v1/auth/auth.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async snapshot() {
    return this.metrics.snapshot();
  }
}
