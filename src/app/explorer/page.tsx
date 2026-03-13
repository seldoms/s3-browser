"use client";

import { ChangeEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { callS3Api } from "@/lib/api";
import { FileTable } from "@/components/FileTable";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  ExplorerFileItem,
  ExplorerFolderItem,
  ExplorerItem,
  S3Bucket,
  S3Credentials,
  S3Folder,
  S3Object,
} from "@/types/s3";
import {
  OBSUTIL_INSTALL_COMMAND,
  arrayBufferToBase64,
  buildCurlDownloadCommand,
  buildObsutilConfigFile,
  buildObsutilFolderDownloadCommand,
  buildObsutilSetupCommand,
  formatSize,
  getFileNameFromKey,
  isHuaweiObsEndpoint,
} from "@/lib/utils";

type SortConfig = {
  key: "name" | "size" | "type" | "lastModified";
  direction: "asc" | "desc";
};

type ContextMenuState = {
  x: number;
  y: number;
  item: ExplorerItem;
} | null;

const OBS_CONFIG_PATH_KEY = "obs_config_path";

const TOOLBAR_BUTTON_STYLE = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 12px",
  height: "30px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: "12px",
  fontWeight: 600,
};

const DANGER_BUTTON_STYLE = {
  ...TOOLBAR_BUTTON_STYLE,
  color: "var(--error)",
};

const PANEL_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
};

const TOOLBAR_GRID_STYLE = {
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
};

const statusBadgeStyle = (active: boolean) => ({
  display: "flex",
  alignItems: "center",
  minHeight: "30px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: active ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
  color: active ? "var(--foreground)" : "var(--muted-foreground)",
  fontSize: "12px",
  fontWeight: 500,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
});

function sortItems(items: ExplorerItem[], sortConfig: SortConfig) {
  return [...items].sort((left, right) => {
    let comparison = 0;

    switch (sortConfig.key) {
      case "name":
        comparison = left.name.localeCompare(right.name);
        break;
      case "size":
        comparison = left.size - right.size;
        break;
      case "type":
        comparison = left.type.localeCompare(right.type);
        break;
      case "lastModified":
        comparison = left.lastModified - right.lastModified;
        break;
    }

    return sortConfig.direction === "asc" ? comparison : -comparison;
  });
}

function mapExplorerItems(objects: S3Object[], folders: S3Folder[]) {
  const folderItems: ExplorerFolderItem[] = folders.map((folder) => ({
    ...folder,
    name: folder.Prefix.split("/").filter(Boolean).pop() || folder.Prefix,
    size: -1,
    type: "folder",
    lastModified: 0,
    key: folder.Prefix,
  }));

  const fileItems: ExplorerFileItem[] = objects.map((object) => ({
    ...object,
    name: getFileNameFromKey(object.Key),
    size: object.Size,
    type: "file",
    lastModified: new Date(object.LastModified).getTime(),
    key: object.Key,
  }));

  return [...folderItems, ...fileItems];
}

function isExplorerFileItem(item: ExplorerItem): item is ExplorerFileItem {
  return item.type === "file";
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function ExplorerPage() {
  return (
    <ToastProvider>
      <ExplorerView />
    </ToastProvider>
  );
}

function ExplorerView() {
  const router = useRouter();
  const { addToast } = useToast();
  const [credentials, setCredentials] = useState<S3Credentials | null>(null);
  const [obsConfigPath, setObsConfigPath] = useState("");
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [currentBucket, setCurrentBucket] = useState("");
  const [path, setPath] = useState("");
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  useEffect(() => {
    const savedCredentials = localStorage.getItem("s3_creds");
    if (!savedCredentials) {
      router.push("/");
      return;
    }

    try {
      setCredentials(JSON.parse(savedCredentials));
      setObsConfigPath(localStorage.getItem(OBS_CONFIG_PATH_KEY) || "");
    } catch (parseError) {
      console.error("Failed to load explorer credentials:", parseError);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, []);

  const fetchBuckets = useCallback(async () => {
    if (!credentials) {
      return;
    }

    setLoading(true);
    try {
      const result = await callS3Api("listBuckets", credentials);
      setBuckets(result.buckets || []);
    } catch (error) {
      console.error("Failed to fetch buckets:", error);
      addToast("获取存储桶列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, credentials]);

  useEffect(() => {
    if (!credentials) {
      return;
    }

    void fetchBuckets();
  }, [credentials, fetchBuckets]);

  const fetchObjects = useCallback(async (bucket: string, prefix: string) => {
    if (!credentials) {
      return;
    }

    setLoading(true);
    try {
      const result = await callS3Api("listObjects", credentials, { bucket, prefix });
      setObjects(result.contents || []);
      setFolders(result.commonPrefixes || []);
      setSelectedKeys(new Set());
    } catch (error) {
      console.error("Failed to fetch objects:", error);
      addToast("读取目录失败", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, credentials]);

  useEffect(() => {
    if (!credentials || !currentBucket) {
      return;
    }

    void fetchObjects(currentBucket, path);
  }, [credentials, currentBucket, path, fetchObjects]);

  function handleSort(key: SortConfig["key"]) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  function handleBucketSelect(bucketName: string) {
    setCurrentBucket(bucketName);
    setPath("");
    setSelectedKeys(new Set());
  }

  function handleBack() {
    if (path) {
      const segments = path.split("/").filter(Boolean);
      segments.pop();
      setPath(segments.length > 0 ? `${segments.join("/")}/` : "");
      return;
    }

    setCurrentBucket("");
    setSelectedKeys(new Set());
  }

  function handleFolderOpen(prefix: string) {
    setPath(prefix);
    setSelectedKeys(new Set());
  }

  function handleToggleSelect(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.clear();
        next.add(key);
      }
      return next;
    });
  }

  async function configureObsConfig() {
    if (!window.electronAPI?.selectObsConfig) {
      addToast("当前仅桌面版支持选择 OBS 配置文件", "warning");
      return;
    }

    try {
      const result = await window.electronAPI.selectObsConfig();
      if (result.cancelled || !result.filePath) {
        return;
      }

      localStorage.setItem(OBS_CONFIG_PATH_KEY, result.filePath);
      setObsConfigPath(result.filePath);
      addToast("OBS 配置文件已保存", "success");
    } catch (error) {
      console.error("Failed to pick OBS config:", error);
      addToast("选择 OBS 配置文件失败", "error");
    }
  }

  async function copyObsInstallCommand() {
    try {
      await navigator.clipboard.writeText(OBSUTIL_INSTALL_COMMAND);
      addToast("OBS 客户端安装命令已复制", "success");
    } catch (error) {
      console.error("Failed to copy obs install command:", error);
      addToast("复制 OBS 安装命令失败", "error");
    }
  }

  async function copyObsSetupCommand() {
    if (!credentials) {
      return;
    }

    try {
      const command = buildObsutilSetupCommand({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        endpoint: credentials.endpoint,
        bucket: currentBucket || undefined,
      });
      await navigator.clipboard.writeText(command);
      addToast("OBS 安装配置命令已复制", "success");
    } catch (error) {
      console.error("Failed to copy obs setup command:", error);
      addToast("复制 OBS 安装配置命令失败", "error");
    }
  }

  async function exportObsConfig() {
    if (!credentials) {
      return;
    }

    const bucketSuffix = currentBucket ? `-${currentBucket}` : "";
    const fileName = `obsutil-config${bucketSuffix}.ini`;
    const configContent = buildObsutilConfigFile({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      endpoint: credentials.endpoint,
    });

    if (!window.electronAPI?.exportObsConfig) {
      downloadTextFile(fileName, configContent);
      addToast("OBS 配置文件已下载到浏览器默认位置", "success");
      return;
    }

    try {
      addToast("正在打开 OBS 配置文件保存窗口", "success");
      const result = await window.electronAPI.exportObsConfig({
        fileName,
        content: configContent,
      });

      if (result.cancelled || !result.filePath) {
        return;
      }

      localStorage.setItem(OBS_CONFIG_PATH_KEY, result.filePath);
      setObsConfigPath(result.filePath);
      addToast("OBS 配置文件已导出", "success");
    } catch (error) {
      console.error("Failed to export obs config:", error);
      downloadTextFile(fileName, configContent);
      addToast("保存窗口异常，已改为直接下载 OBS 配置文件", "warning");
    }
  }

  function clearObsConfig() {
    localStorage.removeItem(OBS_CONFIG_PATH_KEY);
    setObsConfigPath("");
    addToast("已清除 OBS 配置文件记录", "success");
  }

  async function startDownload(key: string) {
    if (!credentials) {
      return;
    }

    try {
      if (window.electronAPI) {
        const result = await callS3Api("startDownload", credentials, {
          bucket: currentBucket,
          key,
          fileName: getFileNameFromKey(key),
        });

        if (result.transferId && window.addTransfer) {
          window.addTransfer({
            transferId: result.transferId,
            type: "download",
            fileName: getFileNameFromKey(key),
            status: "downloading",
            progress: 0,
            speed: 0,
            totalBytes: 0,
            bucket: currentBucket,
            key,
          });
        }
        return;
      }

      const { url } = await callS3Api("getDownloadUrl", credentials, { bucket: currentBucket, key });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to download file:", error);
      addToast("下载文件失败", "error");
    }
  }

  async function handleUpload() {
    if (!credentials || !currentBucket) {
      return;
    }

    try {
      if (window.electronAPI) {
        const result = await callS3Api("startUpload", credentials, {
          bucket: currentBucket,
          prefix: path,
        });

        if (result.transfers && window.addTransfer) {
          result.transfers.forEach((transfer: { transferId: string; fileName: string }) => {
            window.addTransfer?.({
              transferId: transfer.transferId,
              type: "upload",
              fileName: transfer.fileName,
              status: "uploading",
              progress: 0,
              speed: 0,
              totalBytes: 0,
              bucket: currentBucket,
              key: `${path}${transfer.fileName}`,
            });
          });
        }

        return;
      }

      document.getElementById("web-upload-input")?.click();
    } catch (error) {
      console.error("Failed to start upload:", error);
      addToast("启动上传失败", "error");
    }
  }

  async function handleWebUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || !credentials || !currentBucket) {
      return;
    }

    try {
      for (const file of Array.from(files)) {
        const body = await file.arrayBuffer();
        await callS3Api("uploadFile", credentials, {
          bucket: currentBucket,
          key: `${path}${file.name}`,
          body: arrayBufferToBase64(body),
          contentType: file.type || "application/octet-stream",
        });
      }

      addToast("上传完成", "success");
      await fetchObjects(currentBucket, path);
    } catch (error) {
      console.error("Failed to upload in web mode:", error);
      addToast("上传失败", "error");
    } finally {
      event.target.value = "";
    }
  }

  async function copyDirectLink(key: string) {
    if (!credentials) {
      return;
    }

    try {
      const { url } = await callS3Api("getDownloadUrl", credentials, { bucket: currentBucket, key });
      await navigator.clipboard.writeText(url);
      addToast("文件直链已复制", "success");
    } catch (error) {
      console.error("Failed to copy direct link:", error);
      addToast("复制直链失败", "error");
    }
  }

  async function copyDownloadCommand(key: string) {
    if (!credentials) {
      return;
    }

    try {
      const { url } = await callS3Api("getDownloadUrl", credentials, { bucket: currentBucket, key });
      const command = buildCurlDownloadCommand(getFileNameFromKey(key), url);
      await navigator.clipboard.writeText(command);
      addToast("下载命令已复制", "success");
    } catch (error) {
      console.error("Failed to copy download command:", error);
      addToast("复制下载命令失败", "error");
    }
  }

  async function copyFolderDownloadCommand(prefix: string) {
    try {
      const command = buildObsutilFolderDownloadCommand({
        bucket: currentBucket,
        prefix,
        obsConfigPath,
      });
      await navigator.clipboard.writeText(command);
      addToast("OBS 文件夹下载命令已复制", "success");
    } catch (error) {
      console.error("Failed to copy folder download command:", error);
      addToast("复制文件夹下载命令失败", "error");
    }
  }

  async function deleteFile(key: string) {
    if (!credentials) {
      return;
    }

    const confirmed = confirm(`确定删除 ${getFileNameFromKey(key)} 吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await callS3Api("deleteObject", credentials, { bucket: currentBucket, key });
      addToast("文件已删除", "success");
      await fetchObjects(currentBucket, path);
    } catch (error) {
      console.error("Failed to delete file:", error);
      addToast("删除文件失败", "error");
    }
  }

  function handleContextMenu(event: MouseEvent, item: ExplorerItem) {
    event.preventDefault();
    if (item.type === "file") {
      setSelectedKeys(new Set([item.key]));
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
    });
  }

  const explorerItems = sortItems(mapExplorerItems(objects, folders), sortConfig);
  const selectedFileKey = selectedKeys.size === 1 ? Array.from(selectedKeys)[0] : "";
  const selectedFile = explorerItems.find(
    (item): item is ExplorerFileItem => isExplorerFileItem(item) && item.key === selectedFileKey,
  ) || null;
  const obsConfigName = obsConfigPath.split("/").filter(Boolean).pop() || "未选择（可选）";
  const isObsEndpoint = credentials ? isHuaweiObsEndpoint(credentials.endpoint) : false;
  const contextFileItem =
    contextMenu?.item && isExplorerFileItem(contextMenu.item) ? contextMenu.item : null;
  const contextFolderItem =
    contextMenu?.item && contextMenu.item.type === "folder" ? contextMenu.item : null;

  if (!credentials) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "16px",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 26%), var(--background)",
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        style={{
          display: "grid",
          gap: "14px",
          height: "calc(100vh - 32px)",
          gridTemplateRows: "auto minmax(0, 1fr)",
        }}
      >
        <header
          style={{
            ...PANEL_STYLE,
            padding: "12px",
            display: "grid",
            gap: "8px",
            position: "sticky",
            top: "16px",
            zIndex: 20,
            alignSelf: "start",
          }}
        >
          <div style={TOOLBAR_GRID_STYLE}>
            <button
              type="button"
              onClick={handleBack}
              disabled={!currentBucket && !path}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: !currentBucket && !path ? 0.45 : 1 }}
            >
              返回
            </button>
            <button
              type="button"
              onClick={() => (currentBucket ? fetchObjects(currentBucket, path) : fetchBuckets())}
              style={TOOLBAR_BUTTON_STYLE}
            >
              刷新
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!currentBucket}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: currentBucket ? 1 : 0.45 }}
            >
              上传
            </button>
            <button
              type="button"
              onClick={() => selectedFile && startDownload(selectedFile.Key)}
              disabled={!selectedFile}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: selectedFile ? 1 : 0.45 }}
            >
              下载文件
            </button>
            <button
              type="button"
              onClick={() => selectedFile && copyDirectLink(selectedFile.Key)}
              disabled={!selectedFile}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: selectedFile ? 1 : 0.45 }}
            >
              复制直链
            </button>
            <button
              type="button"
              onClick={() => selectedFile && copyDownloadCommand(selectedFile.Key)}
              disabled={!selectedFile}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: selectedFile ? 1 : 0.45 }}
            >
              复制下载命令
            </button>
            <button
              type="button"
              onClick={() => selectedFile && deleteFile(selectedFile.Key)}
              disabled={!selectedFile}
              style={{ ...DANGER_BUTTON_STYLE, opacity: selectedFile ? 1 : 0.45 }}
            >
              删除
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            }}
          >
            <button type="button" onClick={copyObsSetupCommand} style={TOOLBAR_BUTTON_STYLE}>
              复制 OBS 安装配置命令
            </button>
            <button type="button" onClick={copyObsInstallCommand} style={TOOLBAR_BUTTON_STYLE}>
              仅复制安装命令
            </button>
            <button type="button" onClick={configureObsConfig} style={TOOLBAR_BUTTON_STYLE}>
              选择 OBS 配置文件
            </button>
            <button type="button" onClick={exportObsConfig} style={TOOLBAR_BUTTON_STYLE}>
              导出 OBS 配置文件
            </button>
            <button
              type="button"
              onClick={clearObsConfig}
              disabled={!obsConfigPath}
              style={{ ...TOOLBAR_BUTTON_STYLE, opacity: obsConfigPath ? 1 : 0.45 }}
            >
              清空 OBS 配置
            </button>
            <div style={statusBadgeStyle(Boolean(obsConfigPath))}>OBS 配置文件：{obsConfigName}</div>
            <div style={statusBadgeStyle(isObsEndpoint)}>
              接口：{isObsEndpoint ? "华为 OBS" : "按 OBS 兼容方式处理"}
            </div>
          </div>

          <input
            id="web-upload-input"
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleWebUpload}
          />
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: "14px", minHeight: 0 }}>
          <aside
            style={{
              ...PANEL_STYLE,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "10px",
              }}
            >
              存储桶
            </div>
            <div style={{ overflow: "auto", display: "grid", gap: "6px" }}>
              {buckets.map((bucket) => (
                <button
                  key={bucket.Name}
                  type="button"
                  onClick={() => handleBucketSelect(bucket.Name)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: currentBucket === bucket.Name ? "1px solid var(--primary)" : "1px solid transparent",
                    background: currentBucket === bucket.Name ? "rgba(59,130,246,0.14)" : "transparent",
                    color: currentBucket === bucket.Name ? "var(--foreground)" : "var(--muted-foreground)",
                    textAlign: "left",
                    fontSize: "13px",
                    fontWeight: currentBucket === bucket.Name ? 700 : 500,
                  }}
                >
                  {bucket.Name}
                </button>
              ))}
              {!loading && buckets.length === 0 && (
                <div
                  style={{
                    padding: "18px 8px",
                    color: "var(--muted-foreground)",
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  当前账户下没有读取到存储桶。
                </div>
              )}
            </div>
          </aside>

          <section
            style={{
              ...PANEL_STYLE,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--muted-foreground)", fontSize: "12px" }}>路径</span>
              <span
                role="button"
                onClick={() => {
                  setCurrentBucket("");
                  setPath("");
                  setSelectedKeys(new Set());
                }}
                style={{ cursor: "pointer", fontWeight: !currentBucket ? 700 : 500 }}
              >
                根目录
              </span>
              {currentBucket && (
                <>
                  <span>/</span>
                  <span
                    role="button"
                    onClick={() => setPath("")}
                    style={{ cursor: "pointer", fontWeight: !path ? 700 : 500 }}
                  >
                    {currentBucket}
                  </span>
                </>
              )}
              {path
                .split("/")
                .filter(Boolean)
                .map((segment, index, allSegments) => {
                  const nextPath = `${allSegments.slice(0, index + 1).join("/")}/`;
                  return (
                    <span key={nextPath}>
                      <span> / </span>
                      <span
                        role="button"
                        onClick={() => setPath(nextPath)}
                        style={{ cursor: "pointer", fontWeight: index === allSegments.length - 1 ? 700 : 500 }}
                      >
                        {segment}
                      </span>
                    </span>
                  );
                })}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {!currentBucket ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted-foreground)",
                    fontSize: "14px",
                  }}
                >
                  从左侧选择一个存储桶开始浏览。
                </div>
              ) : (
                <FileTable
                  items={explorerItems}
                  loading={loading}
                  selected={selectedKeys}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  onToggleSelect={handleToggleSelect}
                  onFolderClick={handleFolderOpen}
                  onFileActivate={(item) => startDownload(item.Key)}
                  onContextMenu={handleContextMenu}
                />
              )}
            </div>

            <footer
              style={{
                padding: "10px 14px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                color: "var(--muted-foreground)",
                fontSize: "11px",
                flexWrap: "wrap",
              }}
            >
              <span>文件夹 {folders.length}</span>
              <span>文件 {objects.length}</span>
              {selectedFile && <span>当前选中 {selectedFile.name}</span>}
              {selectedFile && <span>大小 {formatSize(selectedFile.Size)}</span>}
            </footer>
          </section>
        </div>
      </div>

      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: "180px",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            background: "var(--card)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
            padding: "6px",
            zIndex: 3000,
          }}
        >
          {contextFileItem && (
            <>
              <ContextMenuAction
                label="下载文件"
                onClick={() => {
                  void startDownload(contextFileItem.Key);
                  setContextMenu(null);
                }}
              />
              <ContextMenuAction
                label="复制文件直链"
                onClick={() => {
                  void copyDirectLink(contextFileItem.Key);
                  setContextMenu(null);
                }}
              />
              <ContextMenuAction
                label="复制下载命令"
                onClick={() => {
                  void copyDownloadCommand(contextFileItem.Key);
                  setContextMenu(null);
                }}
              />
              <ContextMenuAction
                label="删除文件"
                danger
                onClick={() => {
                  void deleteFile(contextFileItem.Key);
                  setContextMenu(null);
                }}
              />
            </>
          )}
          {contextFolderItem && (
            <>
              <ContextMenuAction
                label="进入文件夹"
                onClick={() => {
                  handleFolderOpen(contextFolderItem.Prefix);
                  setContextMenu(null);
                }}
              />
              <ContextMenuAction
                label="复制文件夹下载命令"
                onClick={() => {
                  void copyFolderDownloadCommand(contextFolderItem.Prefix);
                  setContextMenu(null);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ContextMenuAction({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        border: "none",
        background: "transparent",
        color: danger ? "var(--error)" : "var(--foreground)",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: "8px",
        fontSize: "12px",
      }}
    >
      {label}
    </button>
  );
}
