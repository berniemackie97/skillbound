import { createHash } from 'crypto';
import { Readable } from 'stream';
import { promisify } from 'util';
import { gzip as gzipCallback, gunzip as gunzipCallback } from 'zlib';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  and,
  characterSnapshots,
  eq,
  snapshotArchives,
  type CharacterSnapshot,
  type NewCharacterSnapshot,
  type SnapshotArchive,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

import type { RetentionTier } from './snapshot-retention';

export type SnapshotArchiveReason = 'promotion' | 'expiration' | 'manual';

type SnapshotArchiveConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  prefix: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
};

type SnapshotArchivePayload = {
  version: number;
  archivedAt: string;
  profileId: string;
  sourceTier: RetentionTier;
  targetTier?: RetentionTier;
  reason: SnapshotArchiveReason;
  bucketKey: string;
  capturedFrom: string;
  capturedTo: string;
  snapshotCount: number;
  snapshots: CharacterSnapshot[];
};

export type SnapshotArchivePolicy = {
  enabled: boolean;
  allowDelete: boolean;
  reason: string;
  config?: SnapshotArchiveConfig;
};

export type SnapshotArchiveResult =
  | {
      status: 'archived' | 'exists';
      archiveId: string;
      storageKey: string;
      sizeBytes: number;
      checksum: string;
      snapshotCount: number;
    }
  | {
      status: 'disabled' | 'skipped';
      snapshotCount: number;
      reason: string;
    }
  | {
      status: 'failed';
      snapshotCount: number;
      error: string;
    };

export type SnapshotArchiveRestoreResult = {
  archiveId: string;
  snapshotCount: number;
  inserted: number;
  skipped: number;
  dryRun: boolean;
};

let cachedClient: S3Client | null = null;
let cachedClientKey: string | null = null;
const gzip = promisify(gzipCallback);
const gunzip = promisify(gunzipCallback);

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '');
}

function sanitizeBucketKey(bucketKey: string): string {
  return bucketKey.replace(/[:]/g, '-');
}

function buildStorageKey(params: {
  prefix: string;
  profileId: string;
  sourceTier: RetentionTier;
  targetTier?: RetentionTier;
  reason: SnapshotArchiveReason;
  bucketKey: string;
}): string {
  const prefix = normalizePrefix(params.prefix);
  const safeBucketKey = sanitizeBucketKey(params.bucketKey);
  const tierSegment = params.targetTier
    ? `${params.sourceTier}-to-${params.targetTier}`
    : params.sourceTier;
  return `${prefix}/${params.profileId}/${params.reason}/${tierSegment}/${safeBucketKey}.json.gz`;
}

function getSnapshotArchiveConfig(): SnapshotArchiveConfig | null {
  if (process.env['SNAPSHOT_ARCHIVE_ENABLED']?.toLowerCase() === 'false') {
    return null;
  }

  const bucket = process.env['SNAPSHOT_ARCHIVE_BUCKET']?.trim();
  const accessKeyId = process.env['SNAPSHOT_ARCHIVE_ACCESS_KEY_ID']?.trim();
  const secretAccessKey =
    process.env['SNAPSHOT_ARCHIVE_SECRET_ACCESS_KEY']?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const region = process.env['SNAPSHOT_ARCHIVE_REGION']?.trim() || 'auto';
  const endpoint = process.env['SNAPSHOT_ARCHIVE_ENDPOINT']?.trim();
  const prefix =
    process.env['SNAPSHOT_ARCHIVE_PREFIX']?.trim() || 'snapshot-archives';
  const publicBaseUrl = process.env['SNAPSHOT_ARCHIVE_PUBLIC_BASE_URL']?.trim();
  const forcePathStyle =
    process.env['SNAPSHOT_ARCHIVE_FORCE_PATH_STYLE']?.toLowerCase() ===
      'true' || Boolean(endpoint);

  const config: SnapshotArchiveConfig = {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    prefix,
    forcePathStyle,
  };

  if (endpoint) {
    config.endpoint = endpoint;
  }

  if (publicBaseUrl) {
    config.publicBaseUrl = publicBaseUrl;
  }

  return config;
}

export function getSnapshotArchivePolicy(): SnapshotArchivePolicy {
  const config = getSnapshotArchiveConfig();
  if (!config) {
    return {
      enabled: false,
      allowDelete: false,
      reason: 'Snapshot archiving is not configured.',
    };
  }

  const allowDelete =
    process.env['SNAPSHOT_ARCHIVE_ALLOW_DELETE']?.toLowerCase() === 'true';

  return {
    enabled: true,
    allowDelete,
    reason: allowDelete
      ? 'Archiving enabled (deletions allowed).'
      : 'Archiving enabled (deletions disabled).',
    config,
  };
}

function getSnapshotArchiveClient(config: SnapshotArchiveConfig): S3Client {
  const key = [
    config.region,
    config.endpoint ?? '',
    config.accessKeyId,
    config.secretAccessKey,
    config.forcePathStyle ? '1' : '0',
  ].join('|');

  if (!cachedClient || cachedClientKey !== key) {
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    cachedClient = new S3Client(clientConfig);
    cachedClientKey = key;
  }

  return cachedClient;
}

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function resolveCapturedRange(snapshots: CharacterSnapshot[]): {
  capturedFrom: Date;
  capturedTo: Date;
} {
  const ordered = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );

  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  if (!first || !last) {
    const now = new Date();
    return { capturedFrom: now, capturedTo: now };
  }

  return { capturedFrom: first.capturedAt, capturedTo: last.capturedAt };
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (typeof (body as Blob)?.arrayBuffer === 'function') {
    const arrayBuffer = await (body as Blob).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error('Unsupported archive body type');
}

function hydrateSnapshot(raw: CharacterSnapshot): NewCharacterSnapshot {
  return {
    ...raw,
    capturedAt: new Date(raw.capturedAt),
    createdAt: raw.createdAt
      ? new Date(raw.createdAt)
      : new Date(raw.capturedAt),
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
  };
}

export async function archiveSnapshotsBatch(params: {
  profileId: string;
  sourceTier: RetentionTier;
  targetTier?: RetentionTier;
  reason: SnapshotArchiveReason;
  bucketKey: string;
  snapshots: CharacterSnapshot[];
}): Promise<SnapshotArchiveResult> {
  const { snapshots } = params;

  if (snapshots.length === 0) {
    return {
      status: 'skipped',
      snapshotCount: 0,
      reason: 'No snapshots to archive.',
    };
  }

  const policy = getSnapshotArchivePolicy();
  if (!policy.enabled || !policy.config) {
    return {
      status: 'disabled',
      snapshotCount: snapshots.length,
      reason: policy.reason,
    };
  }

  const db = getDbClient();
  const existing = await db
    .select()
    .from(snapshotArchives)
    .where(
      and(
        eq(snapshotArchives.profileId, params.profileId),
        eq(snapshotArchives.sourceTier, params.sourceTier),
        eq(snapshotArchives.reason, params.reason),
        eq(snapshotArchives.bucketKey, params.bucketKey)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const archive = existing[0];
    if (!archive) {
      return {
        status: 'failed',
        snapshotCount: snapshots.length,
        error: 'Snapshot archive lookup returned empty result.',
      };
    }
    return {
      status: 'exists',
      archiveId: archive.id,
      storageKey: archive.storageKey,
      sizeBytes: archive.sizeBytes,
      checksum: archive.checksum,
      snapshotCount: archive.snapshotCount,
    };
  }

  const { capturedFrom, capturedTo } = resolveCapturedRange(snapshots);
  const payload: SnapshotArchivePayload = {
    version: 1,
    archivedAt: new Date().toISOString(),
    profileId: params.profileId,
    sourceTier: params.sourceTier,
    reason: params.reason,
    bucketKey: params.bucketKey,
    capturedFrom: capturedFrom.toISOString(),
    capturedTo: capturedTo.toISOString(),
    snapshotCount: snapshots.length,
    snapshots,
  };

  if (params.targetTier) {
    payload.targetTier = params.targetTier;
  }

  try {
    const json = JSON.stringify(payload);
    const compressed = await gzip(Buffer.from(json), { level: 9 });
    const checksum = computeChecksum(compressed);
    const sizeBytes = compressed.byteLength;
    const storageKey = buildStorageKey({
      prefix: policy.config.prefix,
      profileId: params.profileId,
      sourceTier: params.sourceTier,
      reason: params.reason,
      bucketKey: params.bucketKey,
      ...(params.targetTier ? { targetTier: params.targetTier } : {}),
    });

    const client = getSnapshotArchiveClient(policy.config);
    await client.send(
      new PutObjectCommand({
        Bucket: policy.config.bucket,
        Key: storageKey,
        Body: compressed,
        ContentType: 'application/json',
        ContentEncoding: 'gzip',
        Metadata: {
          'archive-version': String(payload.version),
          'snapshot-count': String(payload.snapshotCount),
          'profile-id': payload.profileId,
          'bucket-key': payload.bucketKey,
          reason: payload.reason,
        },
      })
    );

    const inserted = await db
      .insert(snapshotArchives)
      .values({
        profileId: params.profileId,
        sourceTier: params.sourceTier,
        targetTier: params.targetTier ?? null,
        reason: params.reason,
        bucketKey: params.bucketKey,
        capturedFrom,
        capturedTo,
        snapshotCount: snapshots.length,
        storageProvider: 's3',
        storageBucket: policy.config.bucket,
        storageKey,
        storageRegion: policy.config.region,
        storageEndpoint: policy.config.endpoint ?? null,
        checksum,
        sizeBytes,
        compressed: true,
        archiveVersion: payload.version,
      })
      .onConflictDoNothing()
      .returning();

    const archiveRow =
      inserted[0] ??
      (
        await db
          .select()
          .from(snapshotArchives)
          .where(
            and(
              eq(snapshotArchives.profileId, params.profileId),
              eq(snapshotArchives.sourceTier, params.sourceTier),
              eq(snapshotArchives.reason, params.reason),
              eq(snapshotArchives.bucketKey, params.bucketKey)
            )
          )
          .limit(1)
      )[0];

    if (!archiveRow) {
      throw new Error('Failed to persist snapshot archive metadata.');
    }

    return {
      status: inserted.length > 0 ? 'archived' : 'exists',
      archiveId: archiveRow.id,
      storageKey,
      sizeBytes,
      checksum,
      snapshotCount: snapshots.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error }, 'Failed to archive snapshots');
    return {
      status: 'failed',
      snapshotCount: snapshots.length,
      error: message,
    };
  }
}

export async function getSnapshotArchiveDownloadUrl(
  archive: SnapshotArchive,
  expiresInSeconds = 900
): Promise<string | null> {
  const policy = getSnapshotArchivePolicy();
  if (!policy.enabled || !policy.config) {
    return null;
  }

  if (policy.config.publicBaseUrl) {
    const base = policy.config.publicBaseUrl.replace(/\/+$/g, '');
    return `${base}/${archive.storageKey}`;
  }

  const client = getSnapshotArchiveClient(policy.config);
  const command = new GetObjectCommand({
    Bucket: archive.storageBucket,
    Key: archive.storageKey,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function restoreSnapshotArchive(
  archiveId: string,
  options: { dryRun?: boolean } = {}
): Promise<SnapshotArchiveRestoreResult> {
  const db = getDbClient();
  const [archive] = await db
    .select()
    .from(snapshotArchives)
    .where(eq(snapshotArchives.id, archiveId))
    .limit(1);

  if (!archive) {
    throw new Error('Snapshot archive not found.');
  }

  const policy = getSnapshotArchivePolicy();
  if (!policy.enabled || !policy.config) {
    throw new Error('Snapshot archive storage is not configured.');
  }

  const client = getSnapshotArchiveClient(policy.config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: archive.storageBucket,
      Key: archive.storageKey,
    })
  );

  const body = await streamToBuffer(response.Body);
  const raw = archive.compressed ? await gunzip(body) : body;
  const parsed = JSON.parse(raw.toString()) as SnapshotArchivePayload;

  if (parsed.version !== 1) {
    throw new Error(`Unsupported archive version: ${parsed.version}`);
  }

  if (parsed.profileId !== archive.profileId) {
    logger.warn(
      {
        archiveId: archive.id,
        payloadProfileId: parsed.profileId,
        archiveProfileId: archive.profileId,
      },
      'Archive profile mismatch during restore'
    );
  }

  const snapshots = parsed.snapshots.map((snapshot) =>
    hydrateSnapshot(snapshot)
  );
  const dryRun = options.dryRun ?? false;
  let inserted = 0;

  if (!dryRun) {
    const chunkSize = 500;
    for (let index = 0; index < snapshots.length; index += chunkSize) {
      const chunk = snapshots.slice(index, index + chunkSize);
      const insertedRows = await db
        .insert(characterSnapshots)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: characterSnapshots.id });
      inserted += insertedRows.length;
    }
  } else {
    inserted = snapshots.length;
  }

  return {
    archiveId: archive.id,
    snapshotCount: snapshots.length,
    inserted,
    skipped: snapshots.length - inserted,
    dryRun,
  };
}
