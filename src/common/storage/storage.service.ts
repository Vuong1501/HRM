
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;

    this.s3 = new S3Client({
      endpoint: this.configService.get<string>('MINIO_ENDPOINT'),
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY')!,
        secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY')!,
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = file.originalname.split('.').pop();
    const fileKey = `${folder}/${uniqueName}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    this.logger.log(`Uploaded: ${fileKey}`);
    return fileKey;
  }

  async getFileStream(fileKey: string): Promise<Readable> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      }),
    );

    return response.Body as Readable;
  }

  async deleteFile(fileKey: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      }),
    );

    this.logger.log(`Deleted: ${fileKey}`);
  }
}