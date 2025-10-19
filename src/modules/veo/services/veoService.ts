
import { GoogleGenAI } from "@google/genai";
import { VideoJob, VideoJobStatus } from '../../../types';
import { LogLevel } from "../../../types";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const generateVideo = async (
    apiKey: string,
    job: VideoJob,
    addLog: (message: string, level?: LogLevel) => void,
    updateJob: (jobId: string, updates: Partial<VideoJob>) => void
): Promise<void> => {
    const logPrefix = `[VEO-${job.id.substring(0,8)}]`;
    try {
        if (!apiKey) {
            throw new Error("API Key not provided. Please set it in the Settings page.");
        }
        const ai = new GoogleGenAI({ apiKey });
        
        addLog(`${logPrefix} Starting video generation for prompt: "${job.prompt}"`);
        updateJob(job.id, { status: VideoJobStatus.GENERATING, progressMessage: 'Initializing video generation...' });

        const videoPromises = Array.from({ length: job.numberOfOutputs }).map(async (_, index) => {
            const outputPrefix = `${logPrefix} [Output ${index + 1}/${job.numberOfOutputs}]`;
            updateJob(job.id, { progressMessage: `Starting generation for output ${index + 1}/${job.numberOfOutputs}...` });
            
            const payload = {
                model: job.model,
                prompt: job.prompt,
                image: job.sourceImage ? { imageBytes: '<base64_image_data>', mimeType: 'image/jpeg' } : undefined,
                config: { numberOfVideos: 1, resolution: job.resolution, aspectRatio: job.aspectRatio, }
            };
            addLog(`${outputPrefix} API Call: ai.models.generateVideos\nPayload:\n${JSON.stringify(payload, null, 2)}`);

            let operation = await ai.models.generateVideos({
                model: job.model,
                prompt: job.prompt,
                image: job.sourceImage ? { imageBytes: job.sourceImage, mimeType: 'image/jpeg' } : undefined,
                config: { numberOfVideos: 1, resolution: job.resolution, aspectRatio: job.aspectRatio, }
            });

            addLog(`${outputPrefix} Operation started. Polling...\nOperation Details:\n${JSON.stringify(operation, null, 2)}`);
            updateJob(job.id, { progressMessage: `Generating output ${index + 1}/${job.numberOfOutputs}...` });

            while (!operation.done) {
                await delay(10000);
                operation = await ai.operations.getVideosOperation({ operation: operation });
                const progressPercent = (operation.metadata?.progressPercentage as number) || 0;
                updateJob(job.id, { progressMessage: `Generating output ${index + 1}/${job.numberOfOutputs}... (${progressPercent.toFixed(0)}%)` });
            }
            
            addLog(`${outputPrefix} Polling complete. Operation result:\n${JSON.stringify(operation, null, 2)}`);

            if (operation.error) throw new Error(`API Error: ${JSON.stringify(operation.error)}`);

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error("No download link was returned from the API.");
            
            addLog(`${outputPrefix} Output generated. Downloading from URI...`);
            updateJob(job.id, { progressMessage: `Downloading video for output ${index + 1}/${job.numberOfOutputs}...` });

            const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
            if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            const videoBlob = await videoResponse.blob();
            return URL.createObjectURL(videoBlob);
        });

        const videoUrls = await Promise.all(videoPromises);

        updateJob(job.id, { status: VideoJobStatus.COMPLETED, progressMessage: 'Completed', videoUrls: videoUrls, });
        addLog(`${logPrefix} Job completed successfully.`, LogLevel.SUCCESS);

    } catch (error: any) {
        let errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        let errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
        updateJob(job.id, { status: VideoJobStatus.FAILED, progressMessage: 'Failed', error: errorMessage });
        addLog(`${logPrefix} Job failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
    }
};

export const downloadAllVideos = async (
    jobs: VideoJob[],
    addLog: (message: string, level?: LogLevel) => void,
    addToast: (message: string, level: 'success' | 'error' | 'info') => void
): Promise<void> => {
    const completedJobs = jobs.filter(job => job.status === VideoJobStatus.COMPLETED && job.videoUrls && job.videoUrls.length > 0);
    if (completedJobs.length === 0) {
        addToast("No completed videos to download.", 'info');
        return;
    }

    const totalVideos = completedJobs.reduce((acc, job) => acc + (job.videoUrls?.length || 0), 0);
    addLog(`Starting download of ${totalVideos} videos...`);
    addToast(`Downloading ${totalVideos} videos...`, 'info');


    for (const job of completedJobs) {
        if (job.videoUrls) {
            for (const [index, url] of job.videoUrls.entries()) {
                try {
                    const a = document.createElement('a');
                    a.href = url;
                    const safePrompt = job.prompt.replace(/[^a-z0-9]/gi, '_').slice(0, 30);
                    a.download = `veo_${safePrompt}_${job.id.substring(0,4)}_${index + 1}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    await delay(500);
                } catch(error) {
                    const message = `Failed to download video for job ${job.id}`;
                    addLog(message + `: ${error}`, LogLevel.ERROR);
                    addToast(message, 'error');
                }
            }
        }
    }
    addLog("All video downloads initiated.", LogLevel.SUCCESS);
};