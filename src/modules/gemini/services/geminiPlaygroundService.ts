import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { ImageJob, ImageJobStatus, ChatMessage, ImageAspectRatio } from '../../../types';
import { LogLevel } from "../../../types";

const styleKeywords: { [key: string]: string } = {
    'Photography': 'professional photograph, DSLR, 8k, sharp focus, high quality, photorealistic',
    'Photorealistic': 'photorealistic render, ultra-detailed, hyperrealistic, 8k, sharp focus',
    'Cinematic': 'cinematic film still, dramatic lighting, shallow depth of field, film grain',
    'Anime': 'anime style, cel shaded, vibrant colors, detailed line art, by Studio Ghibli',
    'Fantasy Art': 'fantasy art, epic, detailed painting, concept art, by Greg Rutkowski',
    'Digital Art': 'digital painting, detailed, vibrant, trending on ArtStation',
    '3D Model': '3d model, octane render, blender, detailed, trending on cgsociety',
    'Analog Film': 'analog film photo, 35mm, film grain, vintage look, color graded',
    'Neon Punk': 'neon punk aesthetic, cyberpunk, vibrant neon lights, futuristic city, dystopian',
    'Isometric': 'isometric style, 3d, detailed, vibrant colors, clean edges',
    'Pixel Art': 'pixel art, 16-bit, detailed, vibrant color palette',
    'Vaporwave': 'vaporwave aesthetic, retro, neon colors, 80s, glitch art',
    'Steampunk': 'steampunk, gears, brass, victorian era, detailed, intricate design',
    'Watercolor': 'watercolor painting, soft edges, vibrant colors, paper texture',
    'Comic Book': 'comic book style, bold outlines, halftone dots, vibrant colors, by Marvel comics',
    'Abstract': 'abstract art, non-representational, shapes, colors, forms, textures',
    'Minimalist': 'minimalist style, clean lines, simple shapes, limited color palette',
};

export async function* generateChatResponseStream(
    apiKey: string,
    history: ChatMessage[],
    newMessage: string,
    systemInstruction: string,
    addLog: (message: string, level?: LogLevel) => void
): AsyncGenerator<string> {
    const logPrefix = `[Chat]`;
    try {
        if(!apiKey) throw new Error("API Key not provided");
        const ai = new GoogleGenAI({ apiKey });
        
        const chatConfig = {
            model: 'gemini-2.5-pro',
            history: history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }],
            })),
            config: {
                systemInstruction,
            }
        };
        addLog(`${logPrefix} Starting new chat stream.\nConfig:\n${JSON.stringify({ model: chatConfig.model, systemInstruction: chatConfig.config.systemInstruction, historyLength: chatConfig.history.length }, null, 2)}`);

        const chat: Chat = ai.chats.create(chatConfig);

        addLog(`${logPrefix} User message: "${newMessage}"`);
        const responseStream = await chat.sendMessageStream({ message: newMessage });
        
        let fullResponseText = '';
        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
                fullResponseText += text;
                yield text;
            }
        }
        addLog(`${logPrefix} Stream finished.\nFull Model Response:\n${fullResponseText}`);

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during chat.";
        const errorDetails = error.stack || JSON.stringify(error);
        addLog(`${logPrefix} Error: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
        yield `Sorry, I encountered an error: ${errorMessage}`;
    }
}

export const generateImage = async (
    apiKey: string,
    job: ImageJob,
    addLog: (message: string, level?: LogLevel) => void,
    updateJob: (jobId: string, updates: Partial<ImageJob>) => void,
): Promise<void> => {
    const logPrefix = `[Imagen-${job.id.substring(0, 8)}]`;
    try {
        if(!apiKey) throw new Error("API Key not provided");
        const ai = new GoogleGenAI({ apiKey });
        
        let finalPrompt = job.prompt;
        if (job.stylization && job.stylization !== 'None' && styleKeywords[job.stylization]) {
            finalPrompt += `, ${styleKeywords[job.stylization]}`;
        } else if (job.stylization && job.stylization !== 'None') {
            finalPrompt += `, in the style of ${job.stylization}`; // Fallback
        }

        if (job.imageStrength) {
            finalPrompt += `, high detail, masterpiece, aesthetic, artistic influence ${job.imageStrength}%`;
        }
        if (job.quality === 'HD') {
            finalPrompt += `, 4k, HD, high resolution, detailed`;
        }
        if (job.negativePrompt) {
            finalPrompt += `. Negative prompt: ${job.negativePrompt}`;
        }
        
        const config: any = {
            numberOfImages: job.numberOfImages || 1,
            outputMimeType: 'image/png',
            aspectRatio: job.aspectRatio,
        };

        const payload = {
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: config,
        };
        addLog(`${logPrefix} API Call: ai.models.generateImages\nPayload:\n${JSON.stringify(payload, null, 2)}`);
        updateJob(job.id, { status: ImageJobStatus.GENERATING });

        const response = await ai.models.generateImages(payload);

        addLog(`${logPrefix} API Response Received:\n${JSON.stringify({ ...response, generatedImages: `[${response.generatedImages?.length || 0} image(s)]`}, null, 2)}`);

        if (response.generatedImages && response.generatedImages.length > 0) {
            const imageUrls = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
            updateJob(job.id, { status: ImageJobStatus.COMPLETED, imageUrls });
            addLog(`${logPrefix} Image generation completed successfully with ${imageUrls.length} image(s).`, LogLevel.SUCCESS);
        } else {
            throw new Error("No image was generated by the API.");
        }

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during image generation.";
        const errorDetails = error.stack || JSON.stringify(error);
        updateJob(job.id, { status: ImageJobStatus.FAILED, error: errorMessage });
        addLog(`${logPrefix} Image generation failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
    }
};

interface EditImageOptions {
    prompt: string;
    aspectRatio: ImageAspectRatio;
    quality: 'Standard' | 'HD';
    stylization?: string;
    negativePrompt?: string;
}

export const editImage = async (
    apiKey: string,
    imageBase64: string,
    options: EditImageOptions,
    addLog: (message: string, level?: LogLevel) => void,
): Promise<string | null> => {
    const logPrefix = `[ImageEdit]`;
     try {
        if(!apiKey) throw new Error("API Key not provided");
        const ai = new GoogleGenAI({ apiKey });

        let finalPrompt = `${options.prompt}. The final image should have a ${options.aspectRatio} aspect ratio.`;
        if (options.stylization && options.stylization !== 'None' && styleKeywords[options.stylization]) {
            finalPrompt += `, ${styleKeywords[options.stylization]}`;
        } else if (options.stylization && options.stylization !== 'None') {
            finalPrompt += ` Edit it in a ${options.stylization.toLowerCase()} style.`;
        }
        if (options.quality === 'HD') {
            finalPrompt += ', generate in HD quality, high resolution, 4k.';
        }
        if (options.negativePrompt) {
            finalPrompt += ` Negative prompt: ${options.negativePrompt}`;
        }
        
        const payload = {
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: '<base64_image_data>', mimeType: 'image/png' } },
                    { text: finalPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        };
        addLog(`${logPrefix} API Call: ai.models.generateContent\nPayload:\n${JSON.stringify(payload, null, 2)}`);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType: 'image/png' } },
                    { text: finalPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const responseLog = {
            ...response,
            candidates: response.candidates?.map(c => ({
                ...c,
                content: {
                    ...c.content,
                    parts: c.content?.parts.map(p => p.inlineData ? {...p, inlineData: { ...p.inlineData, data: `<base64_image_data>`}} : p)
                }
            }))
        };
        addLog(`${logPrefix} API Response Received:\n${JSON.stringify(responseLog, null, 2)}`);
        
        const candidate = response.candidates?.[0];

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    addLog(`${logPrefix} Edit completed successfully.`, LogLevel.SUCCESS);
                    return part.inlineData.data;
                }
            }
        }

        let failureReason = "No edited image data found in response.";
        if (!candidate) {
            failureReason = "API response contained no candidates.";
            if (response.promptFeedback) {
                failureReason += ` Prompt feedback: ${JSON.stringify(response.promptFeedback)}`;
            }
        } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            failureReason = `Generation finished with reason: '${candidate.finishReason}'.`;
            if (candidate.finishMessage) {
                failureReason += ` Message: ${candidate.finishMessage}`;
            }
        }
        
        throw new Error(failureReason);

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during image editing.";
        const errorDetails = error.stack || JSON.stringify(error);
        addLog(`${logPrefix} Failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
        return null;
    }
}

interface CompositeImageOptions {
    prompt: string;
    aspectRatio: ImageAspectRatio;
    quality: 'Standard' | 'HD';
    stylization?: string;
    negativePrompt?: string;
    imageStrength?: number;
}

export const compositeImages = async (
    apiKey: string,
    imagesBase64: string[],
    options: CompositeImageOptions,
    addLog: (message: string, level?: LogLevel) => void,
): Promise<string | null> => {
    const logPrefix = `[ImageCompositor]`;
    try {
        if (!apiKey) throw new Error("API Key not provided");
        if (imagesBase64.length === 0) throw new Error("No images provided for composition.");

        const ai = new GoogleGenAI({ apiKey });
        
        let finalPrompt = `${options.prompt}\n\nPlease generate the final image with a ${options.aspectRatio} aspect ratio.`;
        if (options.stylization && options.stylization !== 'None' && styleKeywords[options.stylization]) {
            finalPrompt += `, ${styleKeywords[options.stylization]}`;
        } else if (options.stylization && options.stylization !== 'None') {
            finalPrompt += ` The style should be ${options.stylization.toLowerCase()}.`;
        }
        if (options.imageStrength) {
             finalPrompt += ` The creative strength of the prompt is ${options.imageStrength}%.`;
        }
        if (options.quality === 'HD') {
            finalPrompt += ', the final image should be HD quality, high resolution, 4k.';
        }
        if (options.negativePrompt) {
            finalPrompt += ` Negative prompt: ${options.negativePrompt}.`;
        }
        
        const imageParts = imagesBase64.map(b64 => ({
            inlineData: { data: b64, mimeType: 'image/png' }
        }));

        const textPart = { text: finalPrompt };

        const payload = {
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    ...imagesBase64.map((_, i) => ({ inlineData: { data: `<base64_image_${i+1}>`, mimeType: 'image/png' }})),
                    textPart
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        };
        addLog(`${logPrefix} API Call: ai.models.generateContent\nPayload:\n${JSON.stringify(payload, null, 2)}`);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [...imageParts, textPart],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const responseLog = {
            ...response,
            candidates: response.candidates?.map(c => ({
                ...c,
                content: {
                    ...c.content,
                    parts: c.content?.parts.map(p => p.inlineData ? {...p, inlineData: { ...p.inlineData, data: `<base64_image_data>`}} : p)
                }
            }))
        };
        addLog(`${logPrefix} API Response Received:\n${JSON.stringify(responseLog, null, 2)}`);

        const candidate = response.candidates?.[0];

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    addLog(`${logPrefix} Composition completed successfully.`, LogLevel.SUCCESS);
                    return part.inlineData.data;
                }
            }
        }
        
        let failureReason = "No composited image data found in response.";
        if (!candidate) {
            failureReason = "API response contained no candidates.";
            if (response.promptFeedback) {
                failureReason += ` Prompt feedback: ${JSON.stringify(response.promptFeedback)}`;
            }
        } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            failureReason = `Generation finished with reason: '${candidate.finishReason}'.`;
            if (candidate.finishMessage) {
                failureReason += ` Message: ${candidate.finishMessage}`;
            }
        }

        throw new Error(failureReason);

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during image composition.";
        const errorDetails = error.stack || JSON.stringify(error);
        addLog(`${logPrefix} Failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
        return null;
    }
}

export const upscaleImage = async (
    apiKey: string,
    imageBase64: string,
    addLog: (message: string, level?: LogLevel) => void,
): Promise<string | null> => {
    const logPrefix = `[ImageUpscale]`;
    try {
        if(!apiKey) throw new Error("API Key not provided");
        const ai = new GoogleGenAI({ apiKey });

        const finalPrompt = "Upscale this image to a higher resolution. Enhance details, sharpness, and overall quality to make it 4k or ultra HD. Do not change the content or composition of the image.";
        
        const payload = {
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: '<base64_image_data>', mimeType: 'image/png' } },
                    { text: finalPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        };
        addLog(`${logPrefix} API Call: ai.models.generateContent\nPayload:\n${JSON.stringify(payload, null, 2)}`);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: imageBase64, mimeType: 'image/png' } },
                    { text: finalPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const responseLog = {
            ...response,
            candidates: response.candidates?.map(c => ({
                ...c,
                content: {
                    ...c.content,
                    parts: c.content?.parts.map(p => p.inlineData ? {...p, inlineData: { ...p.inlineData, data: `<base64_image_data>`}} : p)
                }
            }))
        };
        addLog(`${logPrefix} API Response Received:\n${JSON.stringify(responseLog, null, 2)}`);
        
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    addLog(`${logPrefix} Upscale completed successfully.`, LogLevel.SUCCESS);
                    return part.inlineData.data;
                }
            }
        }

        let failureReason = "No upscaled image data found in response.";
        if (!candidate) {
            failureReason = "API response contained no candidates.";
        } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            failureReason = `Generation finished with reason: '${candidate.finishReason}'.`;
        }
        throw new Error(failureReason);

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during image upscale.";
        const errorDetails = error.stack || JSON.stringify(error);
        addLog(`${logPrefix} Failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
        return null;
    }
};

export const refinePrompt = async (
    apiKey: string,
    prompt: string,
    context: 'video' | 'image' | 'chat',
    addLog: (message: string, level?: LogLevel) => void,
): Promise<string | null> => {
    const logPrefix = `[PromptRefiner-${context}]`;
    try {
        if (!apiKey) throw new Error("API Key not provided");
        const ai = new GoogleGenAI({ apiKey });

        let systemInstruction = '';
        switch (context) {
            case 'video':
                systemInstruction = "You are a prompt engineering expert specializing in text-to-video generation. Refine the following user prompt to be more descriptive, vivid, and cinematic. Focus on adding details about action, scenery, camera angles, and lighting. Return ONLY the refined prompt, without any explanations, preamble, or quotation marks.";
                break;
            case 'image':
                systemInstruction = "You are a prompt engineering expert specializing in text-to-image generation. Refine the following user prompt to be more detailed, descriptive, and visually rich. Focus on adding specifics about subject, composition, style, and lighting. Return ONLY the refined prompt, without any explanations, preamble, or quotation marks.";
                break;
            case 'chat':
                systemInstruction = "You are a helpful assistant. Rephrase the following user query to be clearer, more concise, and more effective for a large language model. Return ONLY the refined query, without any explanations or preamble.";
                break;
        }

        const payload = {
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { systemInstruction },
        };
        addLog(`${logPrefix} API Call: ai.models.generateContent\nPayload:\n${JSON.stringify(payload, null, 2)}`);

        const response = await ai.models.generateContent(payload);
        const refinedText = response.text.trim().replace(/^"|"$/g, ''); // Trim and remove quotes

        if (!refinedText) {
            throw new Error("API returned an empty response for prompt refinement.");
        }

        addLog(`${logPrefix} Refined prompt received: "${refinedText}"`, LogLevel.SUCCESS);
        return refinedText;

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during prompt refinement.";
        const errorDetails = error.stack || JSON.stringify(error);
        addLog(`${logPrefix} Failed: ${errorMessage}\nDetails:\n${errorDetails}`, LogLevel.ERROR);
        return null;
    }
};