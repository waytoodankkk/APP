export interface Profile {
    id: string;
    name: string;
}

export enum VideoJobStatus {
    PENDING = 'PENDING',
    GENERATING = 'GENERATING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export type Model = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview';
export type AspectRatio = '16:9' | '9:16';
export type Resolution = '720p' | '1080p';

export interface VideoJob {
    id: string;
    profileId: string;
    prompt: string;
    status: VideoJobStatus;
    progressMessage: string;
    videoUrls?: string[];
    error?: string;
    model: Model;
    aspectRatio: AspectRatio;
    resolution: Resolution;
    numberOfOutputs: number;
}
