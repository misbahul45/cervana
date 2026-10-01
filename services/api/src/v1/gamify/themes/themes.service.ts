import { Injectable } from '@nestjs/common';
import {
  CreateThemeIconType,
  CreateThemeType,
  UpdateThemeType,
} from './themes.dto';
import { errorHandler } from '@/common/lib/utils';
import { Query } from '@/common/interfaces';
import { AppError } from '@/common/lib/error';
import { ThemesRepo } from './themes.repo';
import { nextState, canDelete, type ThemeStateKey } from './theme-state';
import { normalizeThemeImage } from './theme-normalize';

export interface Actor {
  id: string;
  role: string;
}

@Injectable()
export class ThemesService {
  constructor(private readonly themesRepo: ThemesRepo) {}

  create(values: CreateThemeType, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can create themes', 403);
      }
      const created = await this.themesRepo.create(values);
      return { message: 'Successfully created theme', data: created };
    });
  }

  createIcon(values: CreateThemeIconType, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can create theme icons', 403);
      }
      const created = await this.themesRepo.createIcon(values);
      return { message: 'Successfully created new theme icon', data: created };
    });
  }

  findAll(q: Query, actor: Actor) {
    return errorHandler(async () => {
      const publicOnly = actor.role !== 'ADMIN';
      const result = await this.themesRepo.findAll(q, { publicOnly });
      return {
        message: 'Successfully retrieved themes',
        data: {
          data: result.data,
          pagination: {
            page: result.meta.page,
            limit: result.meta.limit,
            total: result.meta.total,
            totalPages: result.meta.totalPages,
          },
        },
      };
    });
  }

  findAllIcons(themeId: string, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        await this.assertVisibleTheme(themeId);
      }
      const icons = await this.themesRepo.findAllIcons(themeId);
      return {
        message: 'Successfully retrieved icons',
        data: { data: icons },
      };
    });
  }

  findOne(id: string, q: Query, actor: Actor) {
    return errorHandler(async () => {
      const theme = await this.themesRepo.findOne('id', id, q);
      if (!theme?.id) {
        throw new AppError('Theme not found', 404);
      }
      if (actor.role !== 'ADMIN' && (theme.status !== 'PUBLISHED' || theme.scope !== 'GLOBAL')) {
        throw new AppError('Theme not found', 404);
      }
      return { message: 'Successfully retrieved theme', data: theme };
    });
  }

  update(id: string, values: UpdateThemeType, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can update themes', 403);
      }
      if ((values as Record<string, unknown>).status) {
        throw new AppError('Use the lifecycle endpoints to change status', 400);
      }
      const updated = await this.themesRepo.update(id, values);
      if (!updated?.id) {
        throw new AppError('Theme not found', 404);
      }
      return { message: 'Successfully updated theme', data: updated };
    });
  }

  async transition(id: string, next: ThemeStateKey, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can change theme state', 403);
      }
      const current = await this.themesRepo.findOne('id', id, {});
      if (!current) {
        throw new AppError('Theme not found', 404);
      }
      const allowed = nextState({
        current: current.status as ThemeStateKey,
        next,
        hasReferencingCurriculum: false,
      });
      const updated = await this.themesRepo.transition(id, allowed);
      return { message: `Theme transitioned to ${allowed}`, data: updated };
    });
  }

  async setDefault(id: string, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can set the default theme', 403);
      }
      const theme = await this.themesRepo.findOne('id', id, {});
      if (!theme) {
        throw new AppError('Theme not found', 404);
      }
      if (theme.status !== 'PUBLISHED' || theme.scope !== 'GLOBAL') {
        throw new AppError('Only PUBLISHED + GLOBAL themes can be the default', 409);
      }
      const updated = await this.themesRepo.setDefault(id);
      return { message: 'Default theme updated', data: updated };
    });
  }

  findDefault() {
    return errorHandler(async () => {
      const theme = await this.themesRepo.findDefault();
      if (!theme) {
        throw new AppError('No default theme available', 404);
      }
      return { message: 'Default theme', data: theme };
    });
  }

  remove(id: string, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can delete themes', 403);
      }
      const current = await this.themesRepo.findOne('id', id, {});
      if (!current) {
        throw new AppError('Theme not found', 404);
      }
      const hasReferences = await this.themesRepo.hasCurriculumReferences(id);
      if (!canDelete(current.status as ThemeStateKey, hasReferences)) {
        throw new AppError('Theme can only be deleted when DRAFT and unreferenced', 409);
      }
      const deleted = await this.themesRepo.delete(id);
      return { message: 'Theme deleted', data: deleted };
    });
  }

  removeIcon(id: string, actor: Actor) {
    return errorHandler(async () => {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Only ADMIN can delete theme icons', 403);
      }
      const deleted = await this.themesRepo.deleteIcon(id);
      if (!deleted?.id) {
        throw new AppError('Theme icon not found', 404);
      }
      return { message: 'Theme icon deleted', data: null };
    });
  }

  buildNormalizedTheme(theme: {
    slug: string | null;
    title: string;
    description: string | null;
    primary: string;
    secondary: string;
    tertiary: string | null;
    quaternary: string | null;
    mood: string[];
    tokens: unknown;
    atmosphere: unknown;
    variants: unknown;
    isDefault: boolean;
    version: number;
    status: string;
    scope: string;
    bg_image?: unknown;
    planet_image?: unknown;
  }) {
    return {
      slug: theme.slug,
      title: theme.title,
      description: theme.description ?? undefined,
      primary: theme.primary,
      secondary: theme.secondary,
      tertiary: theme.tertiary ?? undefined,
      quaternary: theme.quaternary ?? undefined,
      mood: theme.mood,
      tokens: theme.tokens,
      atmosphere: theme.atmosphere,
      variants: theme.variants,
      isDefault: theme.isDefault,
      version: theme.version,
      status: theme.status,
      scope: theme.scope,
      bgImage: normalizeThemeImage(theme.bg_image as never) ?? undefined,
      planetImage: normalizeThemeImage(theme.planet_image as never) ?? undefined,
    };
  }

  private async assertVisibleTheme(id: string) {
    const theme = await this.themesRepo.findOne('id', id, {});
    if (!theme || theme.status !== 'PUBLISHED' || theme.scope !== 'GLOBAL') {
      throw new AppError('Theme not found', 404);
    }
  }
}
