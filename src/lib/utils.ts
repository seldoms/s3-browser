export const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return "-";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const shellEscape = (value: string) => {
    return `'${value.replace(/'/g, `'\\''`)}'`;
};

export const getFileNameFromKey = (key: string) => {
    return key.split("/").filter(Boolean).pop() || "download";
};

export const buildCurlDownloadCommand = (fileName: string, url: string) => {
    return `curl -L --fail --show-error --output ${shellEscape(fileName)} ${shellEscape(url)}`;
};

export const OBSUTIL_INSTALL_COMMAND = [
    'ARCH="$(uname -m)"',
    'if [ "$ARCH" = "arm64" ]; then',
    '  echo "提示：当前华为 obsutil 官方 mac 包以 amd64 为主，Apple Silicon 可能需要 Rosetta。"',
    "fi",
    "curl -L -O https://obs-community-intl.obs.ap-southeast-1.myhuaweicloud.com/obsutil/current/obsutil_darwin_amd64.tar.gz",
    "tar -xzvf obsutil_darwin_amd64.tar.gz",
    'cd obsutil_darwin_amd64_* || cd obsutil_mac64_*',
    "chmod 755 obsutil",
    "sudo mv obsutil /usr/local/bin/obsutil",
    "obsutil version",
].join("\n");

interface BuildObsutilSetupCommandOptions {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    bucket?: string;
}

interface BuildObsutilConfigFileOptions {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    concurrency?: number;
}

interface BuildObsutilFolderDownloadCommandOptions {
    bucket: string;
    prefix: string;
    obsConfigPath?: string;
    concurrency?: number;
    localDir?: string;
}

export const getSuggestedLocalFolder = (prefix: string, bucket: string) => {
    const folderName = prefix.split("/").filter(Boolean).pop() || bucket;
    return `/请修改为本地路径/当前文件夹名-${folderName}/`;
};

export const buildObsutilFolderDownloadCommand = ({
    bucket,
    prefix,
    obsConfigPath,
    localDir,
    concurrency = 8,
}: BuildObsutilFolderDownloadCommandOptions) => {
    const normalizedPrefix = prefix ? (prefix.endsWith("/") ? prefix : `${prefix}/`) : "";
    const destination = localDir || getSuggestedLocalFolder(prefix, bucket);
    const configArg = obsConfigPath ? ` -config=${shellEscape(obsConfigPath)}` : "";
    const source = `obs://${bucket}/${normalizedPrefix}`;

    return `obsutil cp ${shellEscape(source)} ${shellEscape(destination)} -f -r -j=${concurrency}${configArg}`;
};

export const buildObsutilSetupCommand = ({
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
}: BuildObsutilSetupCommandOptions) => {
    const commands = [
        OBSUTIL_INSTALL_COMMAND,
        `obsutil config -i=${shellEscape(accessKeyId)} -k=${shellEscape(secretAccessKey)} -e=${shellEscape(endpoint)}`,
        "obsutil ls -s",
    ];

    if (bucket) {
        commands.push(`obsutil ls ${shellEscape(`obs://${bucket}`)} -s`);
    }

    return commands.join("\n");
};

export const buildObsutilConfigFile = ({
    accessKeyId,
    secretAccessKey,
    endpoint,
    concurrency = 8,
}: BuildObsutilConfigFileOptions) => {
    return [
        `endpoint=${endpoint}`,
        `ak=${accessKeyId}`,
        `sk=${secretAccessKey}`,
        `defaultJobs=${concurrency}`,
        `defaultParallels=${concurrency}`,
        "showProgressBar=true",
        "showStartTime=true",
    ].join("\n");
};

export const isHuaweiObsEndpoint = (endpoint: string) => {
    return endpoint.toLowerCase().includes("myhuaweicloud.com");
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
};
