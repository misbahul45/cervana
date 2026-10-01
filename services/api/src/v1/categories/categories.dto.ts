import { z } from 'zod'
import { extendApi } from '@anatine/zod-openapi'

const baseCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').describe('Category name'),
  parentId: z.string().uuid().optional().nullable().describe('Parent category ID'),
})

export const CreateCategoryDto = extendApi(
  z.union([
    baseCategorySchema,
    z.array(baseCategorySchema).min(1, 'At least one category is required'),
  ]),
  {
    title: 'CreateCategoryDto',
    example: [
      {
        name: 'Technology',
        description: 'All about tech and gadgets',
        parentId: null,
      },
      {
        name: 'Artificial Intelligence',
        description: 'AI subcategory',
        parentId: 'uuid-of-technology-category',
      },
    ],
  },
)
export type CreateCategoryType = z.infer<typeof CreateCategoryDto>

export const UpdateCategoryDto = extendApi(
  baseCategorySchema.partial(),
  {
    title: 'UpdateCategoryDto',
    example: {
      name: 'Updated Category Name',
      description: 'Updated description',
      parentId: 'uuid-of-parent-category',
    },
  },
)
export type UpdateCategoryType = z.infer<typeof UpdateCategoryDto>
