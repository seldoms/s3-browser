"use client";

import { useEffect, useState } from "react";

export interface Transfer {
  transferId: string;
  type: "download" | "upload";
  fileName: string;
  status: "downloading" | "uploading" | "completed" | "failed";
  progress: number;
  speed: number;
  downloadedBytes?: number;
  uploadedBytes?: number;
  totalBytes: number;
  error?: string;
  bucket?: string;
  key?: string;
}

type TransferProgress = Partial<Transfer> & {
  transferId: string;
  status: Transfer["status"];
};

function statusLabel(transfer: Transfer) {
  if (transfer.status === "completed") {
    return "已完成";
  }

  if (transfer.status === "failed") {
    return transfer.error || "失败";
  }

  return transfer.type === "download" ? "下载中" : "上传中";
}

export default function TransferManager() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    window.electronAPI.onTransferProgress((progress: TransferProgress) => {
      setTransfers((previous) => {
        const exists = previous.some((item) => item.transferId === progress.transferId);
        if (!exists) {
          return [
            ...previous,
            {
              ...progress,
              type: progress.transferId.startsWith("dl-") ? "download" : "upload",
              fileName: progress.fileName || "未命名任务",
              status: progress.status,
              progress: progress.progress ?? 0,
              speed: progress.speed ?? 0,
              totalBytes: progress.totalBytes ?? 0,
            },
          ];
        }

        return previous.map((item) =>
          item.transferId === progress.transferId ? { ...item, ...progress } : item,
        );
      });

      setVisible(true);
    });
  }, []);

  useEffect(() => {
    window.addTransfer = (transfer: Transfer) => {
      setTransfers((previous) => [transfer, ...previous]);
      setVisible(true);
    };
  }, []);

  const activeCount = transfers.filter(
    (item) => item.status === "downloading" || item.status === "uploading",
  ).length;

  const clearFinished = () => {
    setTransfers((previous) => previous.filter((item) => item.status !== "completed" && item.status !== "failed"));
  };

  if (!visible || transfers.length === 0) {
    return null;
  }

  return (
    <aside
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        width: "360px",
        maxHeight: "420px",
        overflow: "hidden",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        background: "rgba(24,24,27,0.96)",
        color: "#ffffff",
        boxShadow: "0 24px 48px rgba(0,0,0,0.28)",
        zIndex: 5000,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700 }}>传输列表</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
            活动任务 {activeCount}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={clearFinished}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "999px",
              background: "transparent",
              color: "rgba(255,255,255,0.8)",
              padding: "4px 10px",
              fontSize: "11px",
            }}
          >
            清理完成项
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            style={{
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.8)",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </header>

      <div style={{ maxHeight: "352px", overflowY: "auto", padding: "10px", display: "grid", gap: "8px" }}>
        {transfers.map((transfer) => (
          <div
            key={transfer.transferId}
            style={{
              borderRadius: "12px",
              padding: "12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {transfer.fileName}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.62)", marginTop: "3px" }}>
                  {transfer.type === "download" ? "下载" : "上传"} · {statusLabel(transfer)}
                </div>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.72)" }}>
                {transfer.progress.toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${transfer.progress}%`,
                  borderRadius: "999px",
                  background:
                    transfer.status === "failed"
                      ? "#ef4444"
                      : transfer.status === "completed"
                        ? "#22c55e"
                        : "#60a5fa",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
              <span>{transfer.speed.toFixed(2)} MB/s</span>
              <span>{(transfer.totalBytes / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
