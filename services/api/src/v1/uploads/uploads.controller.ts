import { AuthenticatedOnly } from '@/common/authz/access';

import { Controller, Post, Delete, Param, UploadedFile, UseInterceptors, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { errorHandler } from '@/common/lib/utils';
import { AppError, AppErrorCode } from '@/common/lib/error';
import { GetUser } from '../auth/auth.decorator';
import { diskStorage } from 'multer';
import { User } from '@prisma/client';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './tmp',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  @AuthenticatedOnly()
  upload(@UploadedFile() file: Express.Multer.File, @GetUser() user: User) {
    return errorHandler(async () => {
      return await this.uploadsService.uploadFile(user.id, file);
    });
  }

  @Delete('')
  @AuthenticatedOnly()
  deleteFile(@Query('fileId') fileId: string, @GetUser() user: User) {
    return errorHandler(async () => {
      if (!this.uploadsService.ownsFile(user as any, fileId)) {
        throw new AppError('Access to this file is not permitted', 403, AppErrorCode.FORBIDDEN);
      }
      const result = await this.uploadsService.deleteFile(fileId);
      return { message: 'File deleted successfully', result };
    });
  }
}