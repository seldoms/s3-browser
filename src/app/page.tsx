"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { callS3Api } from "@/lib/api";
import { S3Credentials } from "@/types/s3";

const EMPTY_CREDENTIALS: S3Credentials = {
  accessKeyId: "",
  secretAccessKey: "",
  endpoint: "",
  region: "",
};

const CARD_STYLE = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: "18px",
  boxShadow: "0 32px 80px rgba(15,23,42,0.16)",
  padding: "36px",
  width: "100%",
  maxWidth: "560px",
};

const FIELD_LABEL_STYLE = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 600,
  color: "#0f172a",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "14px",
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
};

function detectRegion(endpoint: string, currentRegion: string) {
  const patterns = [
    /obs\.([a-z0-9-]+)\.myhuaweicloud\.com/i,
    /s3\.([a-z0-9-]+)\.amazonaws\.com/i,
    /s3-([a-z0-9-]+)\.amazonaws\.com/i,
    /([a-z0-9-]+)\.s3\./i,
  ];

  for (const pattern of patterns) {
    const match = endpoint.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return currentRegion;
}

export default function Home() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<S3Credentials>(EMPTY_CREDENTIALS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedCredentials = localStorage.getItem("s3_creds");
    if (!savedCredentials) {
      return;
    }

    try {
      setCredentials(JSON.parse(savedCredentials));
    } catch (parseError) {
      console.error("Failed to parse saved credentials:", parseError);
    }
  }, []);

  const updateCredentials = (key: keyof S3Credentials, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const handleEndpointChange = (value: string) => {
    setCredentials((prev) => ({
      ...prev,
      endpoint: value,
      region: detectRegion(value, prev.region),
    }));
  };

  const handleConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    localStorage.setItem("s3_creds", JSON.stringify(credentials));

    try {
      await callS3Api("listBuckets", credentials);
      router.push("/explorer");
    } catch (connectError: unknown) {
      const message = connectError instanceof Error ? connectError.message : "未知错误";
      setError(`连接失败：${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCredentials(EMPTY_CREDENTIALS);
    setError("");
    localStorage.removeItem("s3_creds");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.28), transparent 34%), linear-gradient(135deg, #eff6ff 0%, #e0f2fe 46%, #dcfce7 100%)",
      }}
    >
      <section style={CARD_STYLE}>
        <div style={{ marginBottom: "26px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "#dbeafe",
              color: "#1d4ed8",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "14px",
            }}
          >
            macOS S3 Client
          </div>
          <h1 style={{ fontSize: "30px", lineHeight: 1.1, color: "#0f172a", marginBottom: "10px" }}>
            连接你的 S3 / OBS 存储
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#475569" }}>
            这个版本聚焦在浏览、复制直链、复制下载命令、生成 OBS 文件夹下载脚本，以及自动分片并发上传。
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "18px",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleConnect} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label htmlFor="endpoint" style={FIELD_LABEL_STYLE}>
              Endpoint
            </label>
            <input
              id="endpoint"
              type="text"
              required
              value={credentials.endpoint}
              onChange={(event) => handleEndpointChange(event.target.value)}
              placeholder="https://obs.cn-north-4.myhuaweicloud.com"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label htmlFor="region" style={FIELD_LABEL_STYLE}>
              Region
            </label>
            <input
              id="region"
              type="text"
              required
              value={credentials.region}
              onChange={(event) => updateCredentials("region", event.target.value)}
              placeholder="cn-north-4"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label htmlFor="access-key" style={FIELD_LABEL_STYLE}>
              Access Key ID
            </label>
            <input
              id="access-key"
              type="text"
              required
              value={credentials.accessKeyId}
              onChange={(event) => updateCredentials("accessKeyId", event.target.value)}
              placeholder="输入 Access Key ID"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label htmlFor="secret-key" style={FIELD_LABEL_STYLE}>
              Secret Access Key
            </label>
            <input
              id="secret-key"
              type="password"
              required
              value={credentials.secretAccessKey}
              onChange={(event) => updateCredentials("secretAccessKey", event.target.value)}
              placeholder="输入 Secret Access Key"
              style={INPUT_STYLE}
            />
          </div>

          <div
            style={{
              borderRadius: "12px",
              padding: "14px 16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#475569",
              fontSize: "13px",
              lineHeight: 1.7,
            }}
          >
            推荐示例：
            <br />
            华为云 OBS：`https://obs.cn-north-4.myhuaweicloud.com`
            <br />
            AWS S3：`https://s3.amazonaws.com`
            <br />
            MinIO：`http://127.0.0.1:9000`
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                border: "none",
                borderRadius: "12px",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                padding: "13px 16px",
              }}
            >
              {loading ? "连接中..." : "连接并进入"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: 600,
                padding: "13px 16px",
              }}
            >
              清空
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
