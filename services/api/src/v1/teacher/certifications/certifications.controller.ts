import { RequireOwnership, RequireParentOwnership } from '@/v1/common/guards/ownership.decorator';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CertificationsService } from './certifications.service';
import { Query as CertificationQuery } from '@/common/interfaces';

@Controller('certifications')
export class CertificationsController {
  constructor(private readonly certificationsService: CertificationsService) {}

  @Post()
  @RequireParentOwnership('teacher-application', 'teacherApplicationId')
  create(@Body() createCertificationDto: any) {
    return this.certificationsService.create(createCertificationDto);
  }

  @Get()
  @RequireParentOwnership('teacher-application', 'teacherApplicationId', 'query')
  findAll(
    @Query() q:CertificationQuery
  ) {
    return this.certificationsService.findAll(q);
  }

  @Get(':id')
  @RequireOwnership('teacher-certification')
  findOne(@Param('id') id: string) {
    return this.certificationsService.findOne(id);
  }

  @Patch(':id')
  @RequireOwnership('teacher-certification')
  update(@Param('id') id: string, @Body() updateCertificationDto: any) {
    return this.certificationsService.update(id, updateCertificationDto);
  }

  @Delete(':id')
  @RequireOwnership('teacher-certification')
  remove(@Param('id') id: string) {
    return this.certificationsService.remove(id);
  }
}
