import { File as FileIcon, FileJson, FileSpreadsheet, FileText, Presentation } from 'lucide-react';

export enum FileType {
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    DOCUMENT = 'document',
    POWERPOINT = 'powerpoint',
    EXCEL = 'excel',
    CSV = 'csv',
    OTHER = 'other',
    PDF = 'pdf',
    Artifact = 'artifact',
}

export const getFileIcon = (fileType: FileType, fileName?: string) => {
    return {
        icon: FileIcon,
        label: 'File',
    };
};

export const getFileType = (file: File): FileType => {
    const fileType = file.type;
    if (fileType.startsWith('image/')) {
        return FileType.IMAGE;
    }
    if (fileType.startsWith('video/')) {
        return FileType.VIDEO;
    }
    if (fileType.startsWith('application/pdf')) {
        return FileType.PDF;
    }
    if (
        fileType.startsWith('application/msword') ||
        fileType.startsWith(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
    ) {
        return FileType.DOCUMENT;
    }
    if (fileType.startsWith('application/vnd.ms-powerpoint')) {
        return FileType.POWERPOINT;
    }
    if (
        fileType.startsWith('application/vnd.ms-excel') ||
        fileType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ) {
        return FileType.EXCEL;
    }
    if (fileType.startsWith('text/csv')) {
        return FileType.CSV;
    }
    return FileType.OTHER;
};
