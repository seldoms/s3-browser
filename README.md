# S3 Browser - 使用指南

## 快速开始

### 启动桌面应用（推荐）

```bash
cd /Users/seldoms/sobey/ai/s3
npm run electron:dev
```

这将打开一个独立的桌面窗口，无需浏览器。

### 启动 Web 版本

```bash
cd /Users/seldoms/sobey/ai/s3
npm run dev
```

然后访问 `http://localhost:3001`

---

## 连接到您的 S3 服务

在登录页面输入以下信息：

### 华为云 OBS 示例
- **Endpoint**: `https://obs.cn-north-4.myhuaweicloud.com`
- **Region**: `cn-north-4`
- **Access Key**: 您的访问密钥 ID
- **Secret Key**: 您的私有访问密钥

### AWS S3 示例
- **Endpoint**: `https://s3.amazonaws.com`
- **Region**: `us-east-1`（或您的区域）
- **Access Key**: 您的 AWS Access Key
- **Secret Key**: 您的 AWS Secret Key

### MinIO 示例
- **Endpoint**: `http://localhost:9000`（或您的 MinIO 地址）
- **Region**: `us-east-1`
- **Access Key**: MinIO 用户名
- **Secret Key**: MinIO 密码

---

## 主要功能

### 📦 浏览存储桶
- 左侧边栏显示所有存储桶
- 点击任意存储桶查看内容

### 📁 文件管理
- **面包屑导航**：点击路径快速跳转
- **视图切换**：列表视图 ⇄ 网格视图
- **文件夹导航**：双击文件夹进入
- **返回上级**：点击左上角返回按钮

### 📥 下载文件
- 列表视图：悬停文件，点击下载图标
- 网格视图：悬停卡片，点击下载按钮

---

## 后续打包为独立应用

如果您想生成 `.app` 或 `.dmg` 安装包：

```bash
npm run electron:build
```

打包后的应用将位于 `dist/` 目录。

---

**项目位置**: `/Users/seldoms/sobey/ai/s3`  
**技术栈**: Electron + Next.js + React + AWS SDK  
**状态**: ✅ 已完成并运行中
