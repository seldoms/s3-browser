import { S3Credentials } from "../types/s3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callS3Api(action: string, credentials: S3Credentials, params: any = {}): Promise<any> {
    if (typeof window !== 'undefined' && window.electronAPI) {
        try {
            const result = await window.electronAPI.s3Request({
                credentials,
                action,
                params: params || {}
            });
            if (result.error) {
                throw new Error(result.error);
            }
            return result;
        } catch (err: unknown) {
            throw new Error((err as Error).message || "Electron IPC Error");
        }
    }

    const res = await fetch("/api/s3", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            credentials,
            action,
            params: params || {}
        }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}
