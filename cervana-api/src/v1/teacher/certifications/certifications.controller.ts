import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { Query as CertificationQuery } from '@/common/interfaces';

@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  @Post()
  create(@Body() createCertificationDto: any) {
    return this.certificationsService.create(createCertificationDto);
  }

  @Get()
  findAll(
    @Query() q:CertificationQuery
  ) {
    return this.certificationsService.findAll(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.certificationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCertificationDto: any) {
    return this.certificationsService.update(id, updateCertificationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.certificationsService.remove(id);
  }
}
