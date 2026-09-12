
import { Controller, Post, Delete, Param, UploadedFile, UseInterceptors, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { errorHandler } from '@/common/lib/utils';
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
  upload(@UploadedFile() file: Express.Multer.File, @GetUser() user: User) {
    return errorHandler(async () => {
      return await this.uploadsService.uploadFile(user.id, file);
    });
  }

  @Delete('')
  deleteFile(@Query('fileId') fileId: string) {
    return errorHandler(async () => {
      const result = await this.uploadsService.deleteFile(fileId);
      return { message: 'File deleted successfully', result };
    });
  }
}