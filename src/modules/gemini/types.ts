export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: string;
}

export enum ImageJobStatus {
    PENDING = 'PENDING',
    GENERATING = 'GENERATING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export interface ImageJob {
    id: string;
    prompt: string;
    status: ImageJobStatus;
    imageUrl?: string;
    error?: string;
    timestamp: string;
}
