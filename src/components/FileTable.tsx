import React from 'react';
import { ExplorerFileItem, SortedItem } from "@/types/s3";
import { formatSize } from "@/lib/utils";

interface FileTableProps {
    items: SortedItem[];
    loading: boolean;
    selected: Set<string>;
    sortConfig: {
        key: 'name' | 'size' | 'type' | 'lastModified';
        direction: 'asc' | 'desc';
    };
    onSort: (key: 'name' | 'size' | 'type' | 'lastModified') => void;
    onToggleSelect: (key: string) => void;
    onFolderClick: (prefix: string) => void;
    onFileActivate: (item: ExplorerFileItem) => void;
    onContextMenu: (e: React.MouseEvent, item: SortedItem) => void;
}

export const FileTable: React.FC<FileTableProps> = ({
    items,
    loading,
    selected,
    sortConfig,
    onSort,
    onToggleSelect,
    onFolderClick,
    onFileActivate,
    onContextMenu
}) => {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted-foreground)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: '40px' }}></th>
                    <th
                        onClick={() => onSort('name')}
                        style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}
                    >
                        名称 {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                        onClick={() => onSort('size')}
                        style={{ padding: '6px 12px', textAlign: 'right', fontWeight: '600', width: '100px', cursor: 'pointer', userSelect: 'none' }}
                    >
                        大小 {sortConfig.key === 'size' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                        onClick={() => onSort('type')}
                        style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600', width: '80px', cursor: 'pointer', userSelect: 'none' }}
                    >
                        类型 {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                        onClick={() => onSort('lastModified')}
                        style={{ padding: '6px 12px', textAlign: 'left', fontWeight: '600', width: '160px', cursor: 'pointer', userSelect: 'none' }}
                    >
                        修改时间 {sortConfig.key === 'lastModified' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                </tr>
            </thead>
            <tbody>
                {items.map((item) => (
                    <tr
                        key={item.key}
                        onClick={() => item.type === 'file' && onToggleSelect(item.key)}
                        onDoubleClick={() => {
                            if (item.type === 'folder') onFolderClick(item.key);
                            else onFileActivate(item);
                        }}
                        onContextMenu={(e) => onContextMenu(e, item)}
                        style={{
                            borderBottom: '1px solid var(--muted)',
                            cursor: 'pointer',
                            background: item.type === 'file' && selected.has(item.key) ? 'var(--selected-bg)' : 'var(--card)'
                        }}
                        onMouseEnter={(e) => {
                            if (!(item.type === 'file' && selected.has(item.key))) e.currentTarget.style.background = 'var(--muted)';
                        }}
                        onMouseLeave={(e) => {
                            if (!(item.type === 'file' && selected.has(item.key))) e.currentTarget.style.background = 'var(--card)';
                        }}
                    >
                        <td style={{ padding: '4px 12px' }}>
                            {item.type === 'file' && (
                                <input
                                    type="checkbox"
                                    checked={selected.has(item.key)}
                                    onChange={() => onToggleSelect(item.key)}
                                />
                            )}
                            {item.type === 'folder' && (
                                <input type="checkbox" disabled style={{ opacity: 0.3 }} />
                            )}
                        </td>
                        <td style={{ padding: '4px 12px' }}>
                            {item.type === 'folder' ? '📁' : '📄'} {item.name}
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right' }}>
                            {item.type === 'folder' ? '-' : formatSize(item.size)}
                        </td>
                        <td style={{ padding: '4px 12px' }}>
                            {item.type === 'folder' ? '文件夹' : '文件'}
                        </td>
                        <td style={{ padding: '4px 12px' }}>
                            {item.type === 'file' ? new Date(item.lastModified).toLocaleString('zh-CN') : '-'}
                        </td>
                    </tr>
                ))}
                {items.length === 0 && !loading && (
                    <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                            此文件夹为空
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
};
