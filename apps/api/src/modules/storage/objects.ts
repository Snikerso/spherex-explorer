import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { settings } from '../../config.js';

export interface ObjectStore {
  get(key: string, limit: number, signal?: AbortSignal): Promise<Buffer | null>;
  put(key: string, bytes: Buffer, signal?: AbortSignal): Promise<void>;
  list(prefix: string): AsyncIterable<{ key: string; modified: Date }>;
  remove(key: string): Promise<void>;
}
const missing = (error: unknown) =>
  ['NoSuchKey', 'NotFound'].includes((error as Error).name) ||
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404;
export class SpacesStore implements ObjectStore {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly prefix: string,
  ) {
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: `https://${region}.digitaloceanspaces.com`,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 3,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: { connectionTimeout: 5000, requestTimeout: 60000 },
    });
  }
  async get(key: string, limit: number, signal?: AbortSignal) {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }),
        { abortSignal: signal },
      );
      if (!result.Body) return null;
      const chunks: Buffer[] = [];
      let size = 0;
      try {
        if ((result.ContentLength ?? 0) > limit)
          throw new Error('Stored object exceeds size limit.');
        for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
          size += chunk.length;
          if (size > limit) throw new Error('Stored object exceeds size limit.');
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        (result.Body as { destroy?: () => void }).destroy?.();
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }
  async put(key: string, bytes: Buffer, signal?: AbortSignal) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }),
        { abortSignal: signal },
      );
      return;
    } catch (error) {
      if (!missing(error)) throw error;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.prefix + key,
        Body: bytes,
        ContentLength: bytes.length,
        ContentType: key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.json')
            ? 'application/json'
            : 'application/octet-stream',
        ACL: 'private',
      }),
      { abortSignal: signal },
    );
  }
  async *list(prefix: string) {
    let token: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix + prefix,
          ContinuationToken: token,
        }),
      );
      for (const item of result.Contents ?? [])
        if (item.Key && item.LastModified)
          yield { key: item.Key.slice(this.prefix.length), modified: item.LastModified };
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
      if (result.IsTruncated && !token) throw new Error('Spaces listing is incomplete.');
    } while (token);
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }),
    );
  }
}
let singleton: ObjectStore | undefined;
export function objectStore(): ObjectStore | undefined {
  if (!settings.SPACES_BUCKET) return;
  return (singleton ??= new SpacesStore(
    settings.SPACES_BUCKET,
    settings.SPACES_REGION!,
    settings.SPACES_ACCESS_KEY_ID!,
    settings.SPACES_SECRET_ACCESS_KEY!,
    settings.SPACES_PREFIX,
  ));
}
