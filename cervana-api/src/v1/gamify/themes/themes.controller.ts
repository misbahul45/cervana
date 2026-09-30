import { AuthenticatedOnly } from '@/common/authz/access';
import { Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { CreateThemeIconType, CreateThemeType, UpdateThemeType } from './themes.dto';
import { Query as QueryInterface } from '@/common/interfaces';


@Controller('themes')
export class ThemesController {
  constructor(private readonly themeService: ThemesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createThemeDto: CreateThemeType) {
    return this.themeService.create(createThemeDto);
  }
  @Post('icons')
  @Roles(Role.ADMIN)
  createIcon(@Body() createThemeIconDto: CreateThemeIconType) {
    return this.themeService.createIcon(createThemeIconDto);
  }

  @Get()
  @AuthenticatedOnly()
  findAll(
    @Query() query: QueryInterface
  ) {
    return this.themeService.findAll(query);
  }

  @Get(':id/icons')
  @AuthenticatedOnly()
  findAllIcons(
    @Param('id') id:string
  ){
    return this.themeService.findAllIcons(id);
  }

  @Get(':id')
  @AuthenticatedOnly()
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface
  ) {
    return this.themeService.findOne(id, query);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeType) {
    return this.themeService.update(id, updateThemeDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.themeService.remove(id);
  }
  @Delete('icons/:id')
  @Roles(Role.ADMIN)
  removeIcons(@Param('id') id: string) {
    return this.themeService.removeIcon(id);
  }
}
