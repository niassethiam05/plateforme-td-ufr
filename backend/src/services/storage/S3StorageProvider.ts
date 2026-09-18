import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { StorageProvider, UploadResult } from "./StorageProvider";

/**
 * Implementation S3-compatible du StorageProvider.
 * En developpement, cible une instance MinIO (docker-compose).
 * En production, il suffit de changer les variables d'environnement
 * (endpoint, credentials, bucket) pour pointer vers un vrai bucket S3.
 */
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = env.storage.bucket;
    this.client = new S3Client({
      endpoint: env.storage.endpoint,
      region: env.storage.region,
      forcePathStyle: env.storage.forcePathStyle,
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey,
      },
    });
  }

  async upload(params: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      })
    );

    return {
      key: params.key,
      size: params.buffer.length,
      contentType: params.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = 300,
    downloadFileName?: string
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(downloadFileName
        ? { ResponseContentDisposition: `attachment; filename="${downloadFileName}"` }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

export const storageProvider = new S3StorageProvider();
