export interface S3Bucket {
    Name: string;
    CreationDate: string | Date;
}

export interface S3Object {
    Key: string;
    LastModified: string | Date;
    ETag: string;
    Size: number;
    StorageClass: string;
    Owner?: {
        DisplayName?: string;
        ID?: string;
    };
}

export interface S3Folder {
    Prefix: string;
}

// Response types for API calls
export interface ListBucketsResponse {
    buckets: S3Bucket[];
    owner: {
        DisplayName: string;
        ID: string;
    };
}

export interface ListObjectsResponse {
    contents: S3Object[];
    commonPrefixes: S3Folder[];
    isTruncated: boolean;
    nextContinuationToken?: string;
    maxKeys: number;
    name: string;
    prefix: string;
}

export interface S3Credentials {
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    region: string;
}

export interface ExplorerFileItem extends S3Object {
    name: string;
    size: number;
    type: 'file';
    lastModified: number;
    key: string;
}

export interface ExplorerFolderItem extends S3Folder {
    name: string;
    size: number;
    type: 'folder';
    lastModified: number;
    key: string;
}

export type ExplorerItem = ExplorerFileItem | ExplorerFolderItem;

export type SortedItem = ExplorerItem & {
    name: string;
    size: number;
    type: 'file' | 'folder';
    lastModified: number;
    key: string;
};
