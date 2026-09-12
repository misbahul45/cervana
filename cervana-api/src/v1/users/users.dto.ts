import { extendApi } from "@anatine/zod-openapi";
import { AuthProvider, Role } from "@prisma/client";
import z from "zod";



export const imageSchema = z.object({
  url: z
    .string()
    .url().describe("URL of the image"),
  fileId: z.string().optional().describe("Optional file identifier for the image"),
});


const baseUserSchema = z.object({
  name: z.string().min(1, "Name is required").describe("Full name of the user"),
  email: z.string().email("Invalid email address").describe("Valid email address"),
  image: imageSchema.optional().describe("Profile image information"),
  provider: z.nativeEnum(AuthProvider).optional().describe("Auth provider"),
  password: z.string().min(8).optional().describe("Password (min 8 characters)"),
  role: z.nativeEnum(Role).optional().describe("User role"),
  emailVerified: z.date().optional(),
});

export const CreateUserDto = extendApi(
  baseUserSchema
    .extend({
      provider: z.nativeEnum(AuthProvider).default(AuthProvider.JWT),
    })
    .refine(
      (data) => {
        if (data.provider === AuthProvider.JWT) return !!data.password;
        return true;
      },
      {
        message: "Password is required when provider is JWT",
        path: ["password"],
      }
    ),
  {
    title: "CreateUserDto",
    example: {
      name: "Alice Smith",
      email: "alice@example.com",
      image: {
        url:'https://api.dicebear.com/9.x/pixel-art/svg?seed=alice',
        fileId: "avatar-alice",
      },
      provider: "JWT",
      password: "strongpassword123",
      role: "USER",
    },
  }
);

export type CreateUserDtoType = z.infer<typeof CreateUserDto>;

export const UpdateUserDto = extendApi(baseUserSchema.partial(), {
  title: "UpdateUserDto",
  example: {
    name: "Alice Updated",
    email: "alice.updated@example.com",
    image: {
      url:'https://api.dicebear.com/9.x/pixel-art/svg?seed=alice-up',
      fileId: "avatar-alice-updated",
    },
    password: "newhashedpassword",
    role: "ADMIN",
  },
});

export type UpdateUserDtoType = z.infer<typeof UpdateUserDto>;
