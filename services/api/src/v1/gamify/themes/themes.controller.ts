import { AuthenticatedOnly } from '@/common/authz/access';
import { Public, Roles } from '@/v1/auth/auth.decorator';
import { Role } from '@prisma/client';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { z } from 'zod';
import { ThemesService } from './themes.service';
import {
  CreateThemeIconType,
  CreateThemeType,
  UpdateThemeType,
} from './themes.dto';
import { Query as QueryInterface } from '@/common/interfaces';
import type { ThemeStateKey } from './theme-state';
import { ThemeProposerService, type Mood } from './theme-proposer.service';
import { validateForPublish } from './theme-validator';

interface AuthenticatedRequest {
  user: { id: string; role: Role };
}

@Controller('themes')
export class ThemesController {
  constructor(
    private readonly themeService: ThemesService,
    private readonly themeProposer: ThemeProposerService,
  ) {}

  @Get('default')
  @Public()
  async findDefault() {
    return this.themeService.findDefault();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createThemeDto: CreateThemeType, @Req() req: AuthenticatedRequest) {
    return this.themeService.create(createThemeDto, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post('icons')
  @Roles(Role.ADMIN)
  createIcon(
    @Body() createThemeIconDto: CreateThemeIconType,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.themeService.createIcon(createThemeIconDto, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Get()
  @AuthenticatedOnly()
  findAll(@Query() query: QueryInterface, @Req() req: AuthenticatedRequest) {
    return this.themeService.findAll(query, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Get(':id/icons')
  @AuthenticatedOnly()
  findAllIcons(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.themeService.findAllIcons(id, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Get(':id')
  @AuthenticatedOnly()
  findOne(
    @Param('id') id: string,
    @Query() query: QueryInterface,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.themeService.findOne(id, query, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateThemeDto: UpdateThemeType,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.themeService.update(id, updateThemeDto, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post(':id/submit-review')
  @Roles(Role.ADMIN)
  submitReview(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.transition(id, 'REVIEW' as ThemeStateKey, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN)
  publish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.transition(id, 'PUBLISHED' as ThemeStateKey, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post(':id/suspend')
  @Roles(Role.ADMIN)
  suspend(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.transition(id, 'SUSPENDED' as ThemeStateKey, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post(':id/archive')
  @Roles(Role.ADMIN)
  archive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.transition(id, 'ARCHIVED' as ThemeStateKey, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post(':id/set-default')
  @Roles(Role.ADMIN)
  setDefault(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.setDefault(id, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.themeService.remove(id, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Delete('icons/:id')
  @Roles(Role.ADMIN)
  removeIcon(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.themeService.removeIcon(id, {
      id: req.user.id,
      role: req.user.role,
    });
  }

  @Post('propose')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  async propose(@Body() body: unknown) {
    const parsed = z
      .object({
        name: z.string().min(1).max(120),
        level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
        keywords: z.array(z.string().min(1).max(60)).max(20).optional(),
        mood: z
          .array(
            z.enum([
              'calm',
              'energetic',
              'analytical',
              'welcoming',
              'playful',
              'serious',
              'mysterious',
              'natural',
            ]),
          )
          .max(4)
          .optional(),
        intensity: z.number().min(0).max(1).optional(),
      })
      .safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_input',
        issues: parsed.error.issues,
      });
    }
    const proposal = this.themeProposer.propose({
      name: parsed.data.name,
      level: parsed.data.level,
      keywords: parsed.data.keywords,
      mood: parsed.data.mood as Mood[] | undefined,
      intensity: parsed.data.intensity,
    });
    const issues = validateForPublish({
      tokens: proposal.tokens,
      atmosphere: proposal.atmosphere,
    });
    const validation = { ok: issues.length === 0, issues };
    if (!validation.ok) {
      throw new BadRequestException({ proposal, validation });
    }
    return { proposal, validation };
  }
}
