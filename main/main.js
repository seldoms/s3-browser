/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const {
  DeleteObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { DownloadManager, UploadManager } = require("./transfer-manager");

let mainWindow;
const downloadManager = new DownloadManager();
const uploadManager = new UploadManager();

function createS3Client(credentials) {
  let endpoint = credentials.endpoint.trim();

  if (endpoint && !endpoint.match(/^https?:\/\//i)) {
    endpoint = `https://${endpoint}`;
  }

  endpoint = endpoint.replace(/\/$/, "");

  try {
    new URL(endpoint);
  } catch {
    throw new Error(`无效的 Endpoint 地址: ${endpoint}`);
  }

  return new S3Client({
    region: credentials.region || "us-east-1",
    endpoint,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function emitTransferProgress(progress) {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("transfer-progress", progress);
}

async function handleS3Request(_event, payload) {
  try {
    const { credentials, action, params } = payload;
    if (!credentials) {
      throw new Error("缺少凭证信息");
    }

    const client = createS3Client(credentials);

    switch (action) {
      case "listBuckets": {
        const response = await client.send(new ListBucketsCommand({}));
        return { buckets: response.Buckets || [] };
      }

      case "listObjects": {
        const { bucket, prefix } = params;
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix || "",
            Delimiter: "/",
          }),
        );

        return {
          contents: response.Contents || [],
          commonPrefixes: response.CommonPrefixes || [],
        };
      }

      case "getDownloadUrl": {
        const { bucket, key } = params;
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
          { expiresIn: 3600 },
        );

        return { url };
      }

      case "startDownload": {
        const { bucket, key, fileName } = params;
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
          title: "保存文件",
          defaultPath: fileName,
        });

        if (!filePath) {
          return { cancelled: true };
        }

        const transferId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        downloadManager
          .startDownload(transferId, client, bucket, key, filePath, emitTransferProgress)
          .catch((error) => {
            emitTransferProgress({
              transferId,
              status: "failed",
              progress: 0,
              speed: 0,
              error: error.message,
            });
          });

        return { transferId, filePath };
      }

      case "startUpload": {
        const { bucket, prefix } = params;
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: "选择上传文件",
          properties: ["openFile", "multiSelections"],
        });

        if (!filePaths || filePaths.length === 0) {
          return { cancelled: true };
        }

        const transfers = [];

        for (const filePath of filePaths) {
          const fileName = path.basename(filePath);
          const key = prefix ? `${prefix}${fileName}` : fileName;
          const transferId = `ul-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          transfers.push({ transferId, fileName });

          uploadManager
            .startUpload(transferId, client, bucket, key, filePath, emitTransferProgress)
            .catch((error) => {
              emitTransferProgress({
                transferId,
                status: "failed",
                progress: 0,
                speed: 0,
                error: error.message,
              });
            });
        }

        return { transfers };
      }

      case "deleteObject": {
        const { bucket, key } = params;
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        return { success: true };
      }

      case "uploadFile": {
        const { bucket, key, body, contentType } = params;
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(body, "base64"),
            ContentType: contentType,
          }),
        );
        return { success: true };
      }

      default:
        throw new Error("无效的操作");
    }
  } catch (error) {
    console.error("S3 IPC error:", error);
    return {
      error: error instanceof Error ? error.message : "操作失败",
    };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#0f172a",
    title: "S3 Browser",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, "..", "out", "index.html");
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
      return;
    }
  }

  mainWindow.loadURL("http://localhost:3001");
}

app.whenReady().then(() => {
  ipcMain.handle("s3-request", handleS3Request);
  ipcMain.handle("select-obs-config", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择 OBS 配置文件",
      properties: ["openFile", "showHiddenFiles"],
      filters: [
        { name: "Config Files", extensions: ["ini", "conf", "cfg"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    return {
      cancelled: false,
      filePath: result.filePaths[0],
    };
  });
  ipcMain.handle("export-obs-config", async (_event, payload) => {
    const { fileName, content } = payload || {};
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "导出 OBS 配置文件",
      defaultPath: fileName || "obsutil-config.ini",
      filters: [
        { name: "Config Files", extensions: ["ini", "conf", "cfg"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    fs.writeFileSync(result.filePath, content, "utf8");

    return {
      cancelled: false,
      filePath: result.filePath,
    };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
