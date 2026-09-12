// zod.validation.ts

import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

export class ZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema, private fieldName?: string) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new ZodError(result.error.issues);
    }

    return result.data;
  }
}
