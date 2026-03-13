import { NextRequest, NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client } from "@/lib/s3-client";
import { S3Credentials } from "@/types/s3";

type S3RequestBody = {
  credentials: S3Credentials;
  action: string;
  params: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const { credentials, action, params } = (await request.json()) as S3RequestBody;

    if (!credentials) {
      return NextResponse.json({ error: "缺少凭证信息" }, { status: 400 });
    }

    const client = createS3Client(credentials);

    switch (action) {
      case "listBuckets": {
        const response = await client.send(new ListBucketsCommand({}));
        return NextResponse.json({ buckets: response.Buckets || [] });
      }

      case "listObjects": {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: String(params.bucket || ""),
            Prefix: String(params.prefix || ""),
            Delimiter: "/",
          }),
        );

        return NextResponse.json({
          contents: response.Contents || [],
          commonPrefixes: response.CommonPrefixes || [],
        });
      }

      case "getDownloadUrl": {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: String(params.bucket || ""),
            Key: String(params.key || ""),
          }),
          { expiresIn: 3600 },
        );

        return NextResponse.json({ url });
      }

      case "deleteObject": {
        await client.send(
          new DeleteObjectCommand({
            Bucket: String(params.bucket || ""),
            Key: String(params.key || ""),
          }),
        );

        return NextResponse.json({ success: true });
      }

      case "uploadFile": {
        await client.send(
          new PutObjectCommand({
            Bucket: String(params.bucket || ""),
            Key: String(params.key || ""),
            Body: Buffer.from(String(params.body || ""), "base64"),
            ContentType: String(params.contentType || "application/octet-stream"),
          }),
        );

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "无效的操作" }, { status: 400 });
    }
  } catch (error) {
    console.error("S3 route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "操作失败" },
      { status: 500 },
    );
  }
}
