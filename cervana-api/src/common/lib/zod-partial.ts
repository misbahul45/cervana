import z from 'zod';

const dropDefault = (field: z.ZodTypeAny): z.ZodTypeAny => {
  if (field instanceof z.ZodDefault) return dropDefault(field.removeDefault() as z.ZodTypeAny);
  if (field instanceof z.ZodOptional) return dropDefault(field.unwrap() as z.ZodTypeAny).optional();
  if (field instanceof z.ZodNullable) return dropDefault(field.unwrap() as z.ZodTypeAny).nullable();
  return field;
};

export const partialWithoutDefaults = <S extends z.ZodObject<any>>(schema: S): ReturnType<S['partial']> => {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    shape[key] = dropDefault(field as z.ZodTypeAny).optional();
  }
  return z.object(shape) as unknown as ReturnType<S['partial']>;
};
