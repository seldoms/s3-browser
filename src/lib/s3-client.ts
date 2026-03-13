import { S3Client } from "@aws-sdk/client-s3";
import { S3Credentials } from "../types/s3";

export function createS3Client(creds: S3Credentials) {
  // 验证和规范化 endpoint
  let endpoint = creds.endpoint.trim();

  // 如果没有协议,添加 https://
  if (endpoint && !endpoint.match(/^https?:\/\//i)) {
    endpoint = 'https://' + endpoint;
  }

  // 移除末尾的斜杠
  endpoint = endpoint.replace(/\/$/, '');

  // 验证 URL 格式
  try {
    new URL(endpoint);
  } catch (e) {
    throw new Error(`无效的 Endpoint 地址: ${endpoint}`);
  }

  return new S3Client({
    region: creds.region || "us-east-1",
    endpoint: endpoint,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    // 对于某些 S3 兼容存储,可能需要设置 forcePathStyle
    forcePathStyle: true,
  });
}
