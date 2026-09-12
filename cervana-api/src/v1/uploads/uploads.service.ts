import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as path from 'path';
import * as fs from 'fs';
import { AppError, AppErrorCode } from '@/common/lib/error';

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ data: { url: string; fileId: string } | null; message: string }> {
    if (!file) throw new BadRequestException('No file provided');

    const fileSizeMB = file.size / (1024 * 1024);
    const ext = path.extname(file.originalname).toLowerCase();

    let folder = '';
    let resourceType: 'auto' | 'raw' | 'image' = 'auto';

    if (ext.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/)) {
      folder = 'images';
      resourceType = 'image';
      if (fileSizeMB > 4)
        throw new BadRequestException('Image exceeds 4 MB limit');
    } else if (ext === '.pdf') {
      folder = 'pdf';
      resourceType = 'raw'; // 👈 paksa Cloudinary anggap sebagai file
      if (fileSizeMB > 256)
        throw new BadRequestException('PDF exceeds 256 MB limit');
    } else {
      throw new BadRequestException('Unsupported file type');
    }

    const tempPath = file.path || file.filename;
    const publicId = `${userId}-${path.parse(file.originalname).name}`;

    try {
      const res: UploadApiResponse =
        fileSizeMB > 10
          ? ((await cloudinary.uploader.upload_large(tempPath, {
              folder,
              public_id: publicId,
              chunk_size: 5 * 1024 * 1024,
              resource_type: resourceType,
            })) as UploadApiResponse)
          : ((await cloudinary.uploader.upload(tempPath, {
              folder,
              public_id: publicId,
              resource_type: resourceType,
            })) as UploadApiResponse);

      return {
        data: {
          fileId: res.public_id,
          url: res.secure_url,
        },
        message: 'Successfully uploaded',
      };
    } catch (err: any) {
      throw new AppError(err.message, 400, AppErrorCode.INTERNAL_SERVER_ERROR);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  async deleteFile(fileId: string) {
    return await cloudinary.uploader.destroy(fileId);
  }
}
