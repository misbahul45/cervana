import z from "zod";
import { extendApi } from "@anatine/zod-openapi";

const imageObjectSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  url: z.string().url().optional(),
});

export const imageSchema = z.union([
  imageObjectSchema,
  z.string().url()
]);

export const baseThemeIconSchema = z.object({
  themeId: z.string().uuid("Theme ID must be valid UUID"),
  imageIcon: imageSchema.optional(),
  name: z.string().min(1, "Name is required"),
});

export const CreateThemeIconDto = extendApi(
  z.union([baseThemeIconSchema, z.array(baseThemeIconSchema)]),
  {
    title: "CreateThemeIconDto",
    example: [
      {
        themeId: "uuid-theme-1234",
        imageIcon: { fileId: "icon123", url: "https://example.com/icon1.png" },
        name: "Rocket Icon",
      },
      {
        themeId: "uuid-theme-5678",
        imageIcon: "https://example.com/icon2.png",
        name: "Planet Icon",
      },
    ],
  }
);

export type CreateThemeIconType = z.infer<typeof CreateThemeIconDto>;

export const baseThemeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  primary: z.string().min(1, "Primary color is required"),
  secondary: z.string().min(1, "Secondary color is required"),
  tertiary: z.string().optional(),
  quaternary: z.string().optional(),
  bg_image: imageSchema.optional(),
  planet_image: imageSchema.optional(),
});

export const CreateThemeDto = extendApi(
  z.union([baseThemeSchema, z.array(baseThemeSchema)]),
  {
    title: "CreateThemeDto",
    example: [
      {
        title: "Space Adventure",
        description: "Theme with cosmic vibes",
        primary: "#ff0000",
        secondary: "#00ff00",
        tertiary: "#0000ff",
        bg_image: { fileId: "bg123", url: "https://example.com/bg1.png" },
        planet_image: "https://example.com/planet1.png",
      },
      {
        title: "Ocean Breeze",
        description: "Blue-green relaxing theme",
        primary: "#1e90ff",
        secondary: "#20b2aa",
        bg_image: "https://example.com/bg2.png",
        planet_image: { fileId: "planet456", url: "https://example.com/planet2.png" },
      },
    ],
  }
);

export type CreateThemeType = z.infer<typeof CreateThemeDto>;

export const UpdateThemeDto = extendApi(
  baseThemeSchema.partial(),
  {
    title: "UpdateThemeDto",
    example: {
      title: "Updated Theme Title",
      primary: "#123456",
      bg_image: { fileId: "newBg789", url: "https://example.com/newbg.png" },
    },
  }
);

export type UpdateThemeType = z.infer<typeof UpdateThemeDto>;

export function toPrismaJson<T extends { imageIcon?: any; bg_image?: any; planet_image?: any }>(data: T) {
  return {
    ...data,
    imageIcon: data.imageIcon ? JSON.stringify(data.imageIcon) : null,
    bg_image: data.bg_image ? JSON.stringify(data.bg_image) : null,
    planet_image: data.planet_image ? JSON.stringify(data.planet_image) : null,
  };
}
