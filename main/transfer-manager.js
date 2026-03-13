const fs = require("fs");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} = require("@aws-sdk/client-s3");

const PART_SIZE = 8 * 1024 * 1024;
const PART_CONCURRENCY = 4;

function calculateSpeed(processedBytes, startedAt) {
  const seconds = Math.max((Date.now() - startedAt) / 1000, 0.2);
  return Math.round((processedBytes / 1024 / 1024 / seconds) * 100) / 100;
}

function calculateProgress(processedBytes, totalBytes) {
  if (!totalBytes) {
    return 0;
  }

  return Math.min(100, Math.round((processedBytes / totalBytes) * 10000) / 100);
}

function toNodeReadable(body) {
  if (!body) {
    throw new Error("响应体为空");
  }

  if (typeof body.pipe === "function") {
    return body;
  }

  if (typeof body.transformToWebStream === "function") {
    return Readable.fromWeb(body.transformToWebStream());
  }

  throw new Error("不支持的响应体类型");
}

function emitDownloadProgress(transferId, downloadedBytes, totalBytes, startedAt, onProgress) {
  onProgress({
    transferId,
    status: "downloading",
    progress: calculateProgress(downloadedBytes, totalBytes),
    speed: calculateSpeed(downloadedBytes, startedAt),
    downloadedBytes,
    totalBytes,
  });
}

function emitUploadProgress(transferId, uploadedBytes, totalBytes, startedAt, onProgress) {
  onProgress({
    transferId,
    status: "uploading",
    progress: calculateProgress(uploadedBytes, totalBytes),
    speed: calculateSpeed(uploadedBytes, startedAt),
    uploadedBytes,
    totalBytes,
  });
}

function buildParts(fileSize) {
  const parts = [];
  let partNumber = 1;
  let start = 0;

  while (start < fileSize) {
    const size = Math.min(PART_SIZE, fileSize - start);
    parts.push({
      partNumber,
      start,
      end: start + size - 1,
      size,
    });
    start += size;
    partNumber += 1;
  }

  return parts;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let cursor = 0;

  async function consume() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

class DownloadManager {
  async startDownload(transferId, s3Client, bucket, key, filePath, onProgress) {
    const startedAt = Date.now();
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const totalBytes = Number(response.ContentLength || 0);
    const body = toNodeReadable(response.Body);
    const writer = fs.createWriteStream(filePath);
    let downloadedBytes = 0;

    body.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      emitDownloadProgress(transferId, downloadedBytes, totalBytes, startedAt, onProgress);
    });

    await pipeline(body, writer);

    onProgress({
      transferId,
      status: "completed",
      progress: 100,
      speed: 0,
      downloadedBytes: totalBytes || downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
    });

    return { success: true };
  }
}

class UploadManager {
  async startUpload(transferId, s3Client, bucket, key, filePath, onProgress) {
    const { size: fileSize } = await fs.promises.stat(filePath);

    if (fileSize <= PART_SIZE) {
      return this.uploadSingleFile(transferId, s3Client, bucket, key, filePath, fileSize, onProgress);
    }

    return this.uploadMultipartFile(transferId, s3Client, bucket, key, filePath, fileSize, onProgress);
  }

  async uploadSingleFile(transferId, s3Client, bucket, key, filePath, fileSize, onProgress) {
    const startedAt = Date.now();
    let uploadedBytes = 0;
    const body = fs.createReadStream(filePath);

    body.on("data", (chunk) => {
      uploadedBytes += chunk.length;
      emitUploadProgress(transferId, uploadedBytes, fileSize, startedAt, onProgress);
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: fileSize,
      }),
    );

    onProgress({
      transferId,
      status: "completed",
      progress: 100,
      speed: 0,
      uploadedBytes: fileSize,
      totalBytes: fileSize,
    });

    return { success: true };
  }

  async uploadMultipartFile(transferId, s3Client, bucket, key, filePath, fileSize, onProgress) {
    const startedAt = Date.now();
    let uploadedBytes = 0;
    const { UploadId } = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!UploadId) {
      throw new Error("创建分片上传任务失败");
    }

    try {
      const completedParts = await runWithConcurrency(buildParts(fileSize), PART_CONCURRENCY, async (part) => {
        const body = fs.createReadStream(filePath, {
          start: part.start,
          end: part.end,
        });

        const result = await s3Client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId,
            PartNumber: part.partNumber,
            Body: body,
            ContentLength: part.size,
          }),
        );

        uploadedBytes += part.size;
        emitUploadProgress(transferId, uploadedBytes, fileSize, startedAt, onProgress);

        return {
          PartNumber: part.partNumber,
          ETag: result.ETag,
        };
      });

      await s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId,
          MultipartUpload: {
            Parts: completedParts.sort((left, right) => left.PartNumber - right.PartNumber),
          },
        }),
      );

      onProgress({
        transferId,
        status: "completed",
        progress: 100,
        speed: 0,
        uploadedBytes: fileSize,
        totalBytes: fileSize,
      });

      return { success: true };
    } catch (error) {
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId,
        }),
      );

      throw error;
    }
  }
}

module.exports = {
  DownloadManager,
  UploadManager,
};
