import { S3Credentials } from "../types/s3";
import { invoke } from "@tauri-apps/api/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callS3Api(action: string, credentials: S3Credentials, params: any = {}): Promise<any> {
    return invoke("s3_request", {
        request: {
            credentials,
            action,
            params: params || {},
        },
    });
}
