export type AppModule = 'homepage' | 'veo' | 'gemini' | 'settings';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    SUCCESS = 'SUCCESS',
}

export interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    level: LogLevel;
}

export interface Toast {
    id: string;
    message: string;
    level: 'success' | 'error' | 'info';
}

// VEO Types
export enum VideoJobStatus {
    QUEUED = 'QUEUED',
    PENDING = 'PENDING',
    GENERATING = 'GENERATING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export type VideoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
export type VideoAspectRatio = '16:9' | '9:16';
export type VideoResolution = '720p' | '1080p';

export interface VideoJob {
    id: string;
    prompt: string;
    status: VideoJobStatus;
    progressMessage: string;
    videoUrls?: string[];
    error?: string;
    model: VideoModel;
    aspectRatio: VideoAspectRatio;
    resolution: VideoResolution;
    numberOfOutputs: number;
    sourceImage?: string | null;
}


// Gemini Playground Types
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

export type ImageAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface ImageJob {
    id: string;
    prompt: string;
    status: ImageJobStatus;
    imageUrls?: string[];
    error?: string;
    timestamp: string;
    aspectRatio: ImageAspectRatio;
    negativePrompt?: string;
    imageStrength?: number;
    stylization?: string;
    quality?: 'Standard' | 'HD';
    numberOfImages?: number;
}

// Project Management
export interface Project {
    id: string;
    name: string;
    veoJobs: VideoJob[];
    geminiJobs: ImageJob[];
    geminiChat: ChatMessage[];
}