import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { generateSchema } from '@anatine/zod-openapi';
import { ApiParamOption, ApiQueryOption, ApiOperationOptions } from '@/common/interfaces/swagger.interface';
import z, { ZodSchema } from 'zod';
import { createPaginatedSchema } from '../docs/paginate.doc';

export const ApiDocs = (options: ApiOperationOptions) => {
  const decorators = [
    ApiOperation({
      summary: options.summary,
      description: options.description || options.summary,
    }),
  ];

  if (!options.isPublic) {
    decorators.push(ApiBearerAuth());
  }


  if (options.body) {
    const bodySchema = generateSchema(options.body);
    decorators.push(ApiBody({
      schema: bodySchema,
    }));
  }

  // Tambahkan params jika ada
  if (options.params) {
    options.params.forEach((param: ApiParamOption) => {
      const paramConfig: any = {
        name: param.name,
        description: param.description,
        example: param.example,
      };

      if (param.schema) {
        const schema = generateSchema(param.schema);
        paramConfig.schema = schema;
      }

      decorators.push(ApiParam(paramConfig));
    });
  }

  if (options.queries) {
    options.queries.forEach((query: ApiQueryOption) => {
      const queryConfig: any = {
        name: query.name,
        description: query.description,
        required: query.required || false,
        example: query.example,
      };

      if (query.schema) {
        const schema = generateSchema(query.schema);
        queryConfig.schema = schema;
      }

      decorators.push(ApiQuery(queryConfig));
    });
  }

  if (options.dataSchema) {
    const responseSchema = generateSchema(options.dataSchema);
    decorators.push(ApiResponse({
      status: 200,
      description: 'Success',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: responseSchema,
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 200 }
            }
          }
        }
      }
    }));
  } else {
    decorators.push(ApiResponse({
      status: 200,
      description: 'Success',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 200 }
            }
          }
        }
      }
    }));
  }

  // Tambahkan error responses
  decorators.push(ApiResponse({
    status: 400,
    description: 'Bad Request - Validation Error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Validation failed' },
        error: { type: 'object' },
        data: { type: 'object', nullable: true },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            timestamp: { type: 'string' },
            statusCode: { type: 'number', example: 400 }
          }
        }
      }
    }
  }));

  decorators.push(ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'object' },
        data: { type: 'object', nullable: true },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            timestamp: { type: 'string' },
            statusCode: { type: 'number', example: 401 }
          }
        }
      }
    }
  }));

  decorators.push(ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'object' },
        data: { type: 'object', nullable: true },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            timestamp: { type: 'string' },
            statusCode: { type: 'number', example: 500 }
          }
        }
      }
    }
  }));

  return applyDecorators(...decorators);
};

// Helper function untuk response dengan data null
const createNullDataResponse = (message: string, description: string) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: message },
          data: { type: 'object', nullable: true, example: null },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 200 }
            }
          }
        }
      }
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Validation Error',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          error: { type: 'object' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 400 }
            }
          }
        }
      }
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing token',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Unauthorized' },
          error: { type: 'object' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 401 }
            }
          }
        }
      }
    }),
    ApiResponse({
      status: 404,
      description: 'Not Found',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Resource not found' },
          error: { type: 'object' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 404 }
            }
          }
        }
      }
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Internal server error' },
          error: { type: 'object' },
          data: { type: 'object', nullable: true },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 500 }
            }
          }
        }
      }
    })
  );
};

export const ApiAuthDocs = (options: Omit<ApiOperationOptions, 'isPublic' | 'tags'>) => {
  return ApiDocs({ 
    ...options, 
    isPublic: true,
    tags: ['Auth']
  });
};

export const ApiProtectedDocs = (options: ApiOperationOptions) => {
  return ApiDocs({ ...options, isPublic: false });
};


export const ApiCrudDocs = {
  create: (dataSchema: ZodSchema, bodySchema: ZodSchema, itemName = 'Item') => ApiDocs({
    summary: `Create ${itemName}`,
    description: `Create a new ${itemName.toLowerCase()}`,
    dataSchema,
    body: bodySchema,
  }),
  
  findAll: (dataSchema: ZodSchema, itemName = 'Item', withPagination = true) => {
    const queries = withPagination ? [
      { name: 'page', description: 'Page number', required: false, schema: z.coerce.number().int().positive() },
      { name: 'limit', description: 'Items per page', required: false, schema: z.coerce.number().int().positive() },
      { name: 'q', description: 'Search term', required: false, schema: z.string() },
      { name: 'sort', description: 'Sort field and order (e.g., "name:asc", "createdAt:desc")', required: false, schema: z.string() },
      { name: 'include', description: 'Relations to include (comma-separated or multiple params)', required: false, schema: z.union([z.string(), z.array(z.string())]) },
    ] : [
      { name: 'q', description: 'Search term', required: false, schema: z.string() },
      { name: 'sort', description: 'Sort field and order (e.g., "name:asc", "createdAt:desc")', required: false, schema: z.string() },
      { name: 'include', description: 'Relations to include (comma-separated or multiple params)', required: false, schema: z.union([z.string(), z.array(z.string())]) },
    ];

    return ApiDocs({
      summary: `Get all ${itemName}s`,
      description: `Retrieve all ${itemName.toLowerCase()}s${withPagination ? ' with pagination and filtering' : ' with filtering'}`,
      dataSchema,
      queries,
    });
  },
  
  findOne: (dataSchema: ZodSchema, itemName = 'Item') => ApiDocs({
    summary: `Get ${itemName} by ID`,
    description: `Retrieve a specific ${itemName.toLowerCase()} by ID with optional relations`,
    dataSchema,
    params: [{ 
      name: 'id', 
      description: `${itemName} ID`,
      schema: z.string().uuid()
    }],
    queries: [
      { name: 'include', description: 'Relations to include (comma-separated or multiple params)', required: false, schema: z.union([z.string(), z.array(z.string())]) },
    ],
  }),
  
  update: (bodySchema: ZodSchema, itemName = 'Item') => {
    return applyDecorators(
      ApiOperation({
        summary: `Update ${itemName}`,
        description: `Update a specific ${itemName.toLowerCase()}`,
      }),
      ApiBearerAuth(),
      ApiBody({
        schema: generateSchema(bodySchema),
      }),
      ApiParam({
        name: 'id',
        description: `${itemName} ID`,
        schema: generateSchema(z.string().uuid())
      }),
      createNullDataResponse(
        `${itemName} updated successfully`,
        `${itemName} updated successfully`
      )
    );
  },
  
  delete: (itemName = 'Item') => {
    return applyDecorators(
      ApiOperation({
        summary: `Delete ${itemName}`,
        description: `Delete a specific ${itemName.toLowerCase()}`,
      }),
      ApiBearerAuth(),
      ApiParam({
        name: 'id',
        description: `${itemName} ID`,
        schema: generateSchema(z.string().uuid())
      }),
      createNullDataResponse(
        `${itemName} deleted successfully`,
        `${itemName} deleted successfully`
      )
    );
  },
};


export const ApiPaginatedResponse = (itemschema: ZodSchema, itemName?: string) => {
  const paginatedSchema = createPaginatedSchema(itemschema, itemName);
  const swaggerSchema = generateSchema(paginatedSchema);
  
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Success with pagination',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Data retrieved successfully' },
          data: swaggerSchema,
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string' },
              statusCode: { type: 'number', example: 200 }
            }
          }
        }
      }
    })
  );
};