import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { CreateThemeIconType, CreateThemeType, UpdateThemeType } from './themes.dto';
import { Query as QueryInterface } from '@/common/interfaces';


@Controller('themes')
export class ThemesController {
  constructor(private readonly themeService: ThemesService) {}

  @Post()
  create(@Body() createThemeDto: CreateThemeType) {
    return this.themeService.create(createThemeDto);
  }
  @Post('icons')
  createIcon(@Body() createThemeIconDto: CreateThemeIconType) {
    return this.themeService.createIcon(createThemeIconDto);
  }

  @Get()
  findAll(
    @Query() query: QueryInterface
  ) {
    return this.themeService.findAll(query);
  }

  @Get(':id/icons')
  findAllIcons(
    @Param('id') id:string
  ){
    return this.themeService.findAllIcons(id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface
  ) {
    return this.themeService.findOne(id, query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateThemeDto: UpdateThemeType) {
    return this.themeService.update(id, updateThemeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.themeService.remove(id);
  }
  @Delete('icons/:id')
  removeIcons(@Param('id') id: string) {
    return this.themeService.removeIcon(id);
  }
}
