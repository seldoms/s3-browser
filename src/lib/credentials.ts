import { S3Credentials } from "@/types/s3";

export function normalizeS3Credentials(creds: S3Credentials): S3Credentials {
  let endpoint = creds.endpoint.trim();

  if (endpoint && !/^https?:\/\//i.test(endpoint)) {
    endpoint = `https://${endpoint}`;
  }

  endpoint = endpoint.replace(/\/+$/, "");

  try {
    new URL(endpoint);
  } catch {
    throw new Error(`无效的 Endpoint 地址: ${endpoint}`);
  }

  return {
    accessKeyId: creds.accessKeyId?.trim() || "",
    secretAccessKey: creds.secretAccessKey?.trim() || "",
    endpoint,
    region: creds.region?.trim() || "us-east-1",
    bucketName: creds.bucketName?.trim() || "",
  };
}
