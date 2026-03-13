import { S3Credentials } from "./s3";

declare global {
    interface Window {
        electronAPI?: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            s3Request: (data: { credentials: S3Credentials; action: string; params: any }) => Promise<any>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onTransferProgress: (callback: (progress: any) => void) => void;
            selectObsConfig: () => Promise<{ cancelled: boolean; filePath?: string }>;
            exportObsConfig: (data: { fileName: string; content: string }) => Promise<{ cancelled: boolean; filePath?: string }>;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        addTransfer?: (transfer: any) => void;
    }
}
