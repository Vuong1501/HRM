
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { extname } from 'path';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const leaveUploadOptions: MulterOptions = {
  storage: memoryStorage(),   // ← file nằm trong RAM, không lưu disk
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const isAllowed =
      ALLOWED_MIME_TYPES.includes(file.mimetype) &&
      ALLOWED_EXTENSIONS.includes(ext);

    if (!isAllowed) {
      return cb(
        new BadRequestException('Chỉ cho phép file PDF, PNG, JPG, JPEG'),
        false,
      );
    }
    cb(null, true);
  },
};