import { Injectable } from '@nestjs/common';
import { Query } from '@/common/interfaces';
import { errorHandler, validation } from '@/common/lib/utils';
import {
  CreateThemeDto,
  CreateThemeIconDto,
  CreateThemeIconType,
  CreateThemeType,
  UpdateThemeDto,
  UpdateThemeType,
} from '@/v1/gamify/themes/themes.dto';
import { PrismaService } from '@/common/config/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { normalizeThemeImage } from './theme-normalize';

const PUBLIC_FILTER = {
  status: 'PUBLISHED',
  scope: 'GLOBAL',
} as const;

const FILTERABLE_KEYS = new Set(['status', 'scope', 'q']);
const INCLUDEABLE_KEYS = new Set(['icons']);
const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'title', 'version']);

@Injectable()
export class ThemesRepo {
  constructor(private readonly prisma: PrismaService) {}

  async findOne<K extends keyof Prisma.ThemeWhereInput>(
    key: K,
    value: Prisma.ThemeWhereInput[K],
    q: Query = {},
  ) {
    return errorHandler(async () => {
      const include = this.buildInclude(q.include);
      return await this.prisma.theme.findFirst({ where: { [key]: value }, include });
    });
  }

  async findAllIcons(themeId: string) {
    return errorHandler(async () => {
      return await this.prisma.themeIcon.findMany({ where: { themeId } });
    });
  }

  async findAll(q: Query, options: { publicOnly: boolean }) {
    return errorHandler(async () => {
      const page = Number(q.page) || 1;
      const limit = Number(q.limit) || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.ThemeWhereInput = {};
      for (const key of Object.keys(q)) {
        if (FILTERABLE_KEYS.has(key)) {
          (where as Record<string, unknown>)[key] = (q as Record<string, unknown>)[key];
        }
      }

      if (options.publicOnly) {
        where.status = PUBLIC_FILTER.status;
        where.scope = PUBLIC_FILTER.scope;
      }

      if (q.q) {
        where.OR = [
          { title: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
        ];
      }

      const orderBy = this.buildOrderBy(q.sort);

      const include = this.buildInclude(q.include);

      const [data, total] = await Promise.all([
        this.prisma.theme.findMany({ where, skip, take: limit, orderBy, include }),
        this.prisma.theme.count({ where }),
      ]);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  async create(values: CreateThemeType) {
    return errorHandler(async () => {
      const data = validation(CreateThemeDto, values);
      if (Array.isArray(data)) {
        const payload: Prisma.ThemeCreateManyInput[] = data.map((item) =>
          this.normalizeCreateInput(item) as Prisma.ThemeCreateManyInput,
        );
        return await this.prisma.theme.createMany({ data: payload });
      }
      const payload = this.normalizeCreateInput(data) as Prisma.ThemeCreateInput;
      return await this.prisma.theme.create({ data: payload });
    });
  }

  async createIcon(values: CreateThemeIconType) {
    return errorHandler(async () => {
      const data = validation(CreateThemeIconDto, values);
      const format = (
        item: {
          themeId: string;
          name: string;
          imageIcon?: string | { fileId?: string; url?: string };
        },
      ): Prisma.ThemeIconCreateManyInput => ({
        themeId: item.themeId,
        name: item.name,
        imageIcon: normalizeThemeImage(item.imageIcon ?? undefined) ?? Prisma.JsonNull,
      });

      if (Array.isArray(data)) {
        return await this.prisma.themeIcon.createMany({ data: data.map(format) });
      }
      const single: Prisma.ThemeIconCreateInput = {
        theme: { connect: { id: data.themeId } },
        name: data.name,
        imageIcon: normalizeThemeImage(data.imageIcon ?? undefined) ?? Prisma.JsonNull,
      };
      return await this.prisma.themeIcon.create({ data: single });
    });
  }

  async update(id: string, values: UpdateThemeType) {
    return errorHandler(async () => {
      const data = validation(UpdateThemeDto, values);
      const normalized: Record<string, unknown> = { ...data };
      for (const key of ['bg_image', 'planet_image'] as const) {
        if (key in normalized) {
          normalized[key] = normalizeThemeImage(normalized[key] as never) ?? Prisma.JsonNull;
        }
      }
      return await this.prisma.theme.update({ where: { id }, data: normalized as Prisma.ThemeUpdateInput });
    });
  }

  async transition(id: string, nextStatus: string) {
    return errorHandler(async () => {
      return await this.prisma.theme.update({
        where: { id },
        data: {
          status: nextStatus as Prisma.ThemeUpdateInput['status'],
          version: { increment: 1 },
        },
      });
    });
  }

  async setDefault(id: string) {
    return errorHandler(async () => {
      return await this.prisma.$transaction(async (tx) => {
        await tx.theme.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
        return await tx.theme.update({
          where: { id },
          data: { isDefault: true, version: { increment: 1 } },
        });
      });
    });
  }

  async findDefault() {
    return errorHandler(async () => {
      return await this.prisma.theme.findFirst({
        where: { isDefault: true, status: 'PUBLISHED', scope: 'GLOBAL' },
        include: { icons: true },
      });
    });
  }

  async hasCurriculumReferences(id: string) {
    return errorHandler(async () => {
      const [subTopics, lessons, steps, topics] = await Promise.all([
        this.prisma.subTopic.count({ where: { themeId: id } }),
        this.prisma.lesson.count({ where: { themeId: id } }),
        this.prisma.step.count({ where: { themeId: id } }),
        this.prisma.topic.count({ where: { themeId: id } }),
      ]);
      return subTopics + lessons + steps + topics > 0;
    });
  }

  async delete(id: string) {
    return errorHandler(async () => {
      return await this.prisma.theme.delete({ where: { id } });
    });
  }

  async deleteIcon(id: string) {
    return errorHandler(async () => {
      return await this.prisma.themeIcon.delete({ where: { id } });
    });
  }

  private buildInclude(rawInclude: unknown): Prisma.ThemeInclude | undefined {
    if (!rawInclude) return undefined;
    const parts = Array.isArray(rawInclude)
      ? rawInclude
      : String(rawInclude).split(',');
    const include: Record<string, boolean> = {};
    for (const part of parts) {
      const key = part.trim();
      if (INCLUDEABLE_KEYS.has(key)) include[key] = true;
    }
    return Object.keys(include).length > 0 ? (include as Prisma.ThemeInclude) : undefined;
  }

  private buildOrderBy(sort: unknown): Prisma.ThemeOrderByWithRelationInput | undefined {
    if (!sort || typeof sort !== 'string') return undefined;
    const [field, direction = 'asc'] = sort.split(':');
    if (!SORTABLE_FIELDS.has(field)) return undefined;
    return { [field]: direction } as Prisma.ThemeOrderByWithRelationInput;
  }

  private normalizeCreateInput(input: Record<string, unknown>) {
    const out: Record<string, unknown> = {
      ...input,
      status: 'DRAFT',
      scope: 'GLOBAL',
      isDefault: false,
    };
    for (const key of ['bg_image', 'planet_image'] as const) {
      if (key in out) {
        out[key] = normalizeThemeImage(out[key] as never) ?? Prisma.JsonNull;
      }
    }
    return out;
  }
}
