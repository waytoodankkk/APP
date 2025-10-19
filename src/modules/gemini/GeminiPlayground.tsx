import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../contexts/AppContext';
import { ImageJob, ImageJobStatus, ChatMessage, ImageAspectRatio, LogLevel, Project } from '../../types';
import { generateChatResponseStream, generateImage, editImage, compositeImages, refinePrompt, upscaleImage } from './services/geminiPlaygroundService';
import { SparklesIcon, UserCircleIcon, PaperAirplaneIcon, ArrowPathIcon, PhotoIcon, PencilIcon, LayersIcon, ArrowUpTrayIcon, DownloadIcon, XCircleIcon, DocumentDuplicateIcon, PlusIcon, Cog6ToothIcon, ArrowsPointingOutIcon, TrashIcon } from '../../components/IconComponents';
import LogViewer from '../../components/LogViewer';
import ReactMarkdown from 'react-markdown';
import { blobToBase64 } from '../../utils/fileUtils';

// Props Interfaces for sub-panels
interface ChatPanelProps {
    apiKey: string;
    chatHistory: ChatMessage[];
    activeProject: Project | undefined;
    updateActiveProject: (updater: (prevProject: Project) => Partial<Project>) => void;
    addToast: (message: string, level: 'success' | 'error' | 'info') => void;
    addLog: (message: string, level?: LogLevel) => void;
}

interface ImageGenerationPanelProps {
    apiKey: string;
    imageJobs: ImageJob[];
    activeProject: Project | undefined;
    updateActiveProject: (updater: (prevProject: Project) => Partial<Project>) => void;
    addToast: (message: string, level: 'success' | 'error' | 'info') => void;
    addLog: (message: string, level?: LogLevel) => void;
    onSendToEditor: (b64: string, prompt: string) => void;
    onSendToVeo: (b64: string) => void;
    onSendToCompositor: (b64: string) => void;
    onViewFullscreen: (url: string) => void;
    onDeleteJob: (jobId: string) => void;
}

interface ImageEditingPanelProps {
    apiKey: string;
    addToast: (message: string, level: 'success' | 'error' | 'info') => void;
    addLog: (message: string, level?: LogLevel) => void;
    sourceB64: string | null;
    setSourceB64: (b64: string | null) => void;
    editPrompt: string;
    setEditPrompt: (prompt: string) => void;
    editedB64: string | null;
    setEditedB64: (b64: string | null) => void;
    aspectRatio: ImageAspectRatio;
    setAspectRatio: (ratio: ImageAspectRatio) => void;
    onSendToCompositor: (b64: string) => void;
    onSendToVeo: (b64: string) => void;
    onViewFullscreen: (url: string) => void;
}

interface ImageCompositorPanelProps {
    apiKey: string;
    addToast: (message: string, level: 'success' | 'error' | 'info') => void;
    addLog: (message: string, level?: LogLevel) => void;
    sourceImages: (string | null)[];
    setSourceImages: (images: (string | null)[]) => void;
    compositePrompt: string;
    setCompositePrompt: (prompt: string) => void;
    compositedB64: string | null;
    setCompositedB64: (b64: string | null) => void;
    aspectRatio: ImageAspectRatio;
    setAspectRatio: (ratio: ImageAspectRatio) => void;
    onSendToEditor: (b64: string) => void;
    onSendToVeo: (b64: string) => void;
    onViewFullscreen: (url: string) => void;
}

const STYLIZATION_OPTIONS = [
    'Photography',
    'Photorealistic', 'Cinematic', 'Anime', 'Fantasy Art', 'Digital Art',
    '3D Model', 'Analog Film', 'Neon Punk', 'Isometric', 'Pixel Art',
    'Vaporwave', 'Steampunk', 'Watercolor', 'Comic Book', 'Abstract',
    'Minimalist', 'None'
];

const ChatPanel: React.FC<ChatPanelProps> = ({ apiKey, chatHistory, activeProject, updateActiveProject, addToast, addLog }) => {
    const [prompt, setPrompt] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const endOfMessagesRef = useRef<null | HTMLDivElement>(null);

    const handleRefinePrompt = async () => {
        if (!prompt.trim() || !apiKey) return;
        setIsRefining(true);
        const refined = await refinePrompt(apiKey, prompt, 'chat', addLog);
        if (refined) {
            setPrompt(refined);
            addToast("Prompt refined!", 'success');
        } else {
            addToast("Failed to refine prompt.", 'error');
        }
        setIsRefining(false);
    };

    const handleSendMessage = useCallback(async () => {
        if (!prompt.trim() || isStreaming || !activeProject || !apiKey || isRefining) {
            if(!apiKey) addToast("Please set your API Key in Settings.", 'error');
            return;
        }

        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            text: prompt,
            timestamp: new Date().toISOString(),
        };
        
        updateActiveProject(p => ({ geminiChat: [...(p.geminiChat || []), userMessage] }));
        setPrompt('');
        setIsStreaming(true);

        let fullResponse = '';
        const modelMessageId = uuidv4();

        try {
            const stream = generateChatResponseStream(apiKey, chatHistory, userMessage.text, "You are a creative assistant.", addLog);
            for await (const chunk of stream) {
                fullResponse += chunk;
                
                updateActiveProject(p => {
                    const existing = p.geminiChat.find(m => m.id === modelMessageId);
                    if(existing) {
                        return { geminiChat: p.geminiChat.map(m => m.id === modelMessageId ? {...m, text: fullResponse} : m) };
                    } else {
                        const newModelMessage: ChatMessage = { id: modelMessageId, role: 'model', text: fullResponse, timestamp: new Date().toISOString() };
                        return { geminiChat: [...p.geminiChat, newModelMessage] };
                    }
                });
            }
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
        } finally {
            setIsStreaming(false);
            if(fullResponse) addLog(`Model: ${fullResponse.substring(0, 100)}...`);
        }
    }, [prompt, isStreaming, isRefining, apiKey, chatHistory, addLog, activeProject, updateActiveProject, addToast]);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isStreaming]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map(msg => (
                    <div key={msg.id} className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         {msg.role === 'model' && <div className="p-2 bg-gray-700 rounded-full flex-shrink-0"><SparklesIcon className="w-5 h-5 text-brand-blue" /></div>}
                         <div className={`max-w-xl p-3 rounded-lg prose prose-sm prose-invert max-w-none ${msg.role === 'user' ? 'bg-brand-blue text-white' : 'bg-gray-700'}`}>
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                         </div>
                         {msg.role === 'user' && <div className="p-2 bg-gray-700 rounded-full flex-shrink-0"><UserCircleIcon className="w-5 h-5 text-gray-400" /></div>}
                    </div>
                ))}
                {isStreaming && chatHistory[chatHistory.length - 1]?.role !== 'model' && (
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-700 rounded-full"><SparklesIcon className="w-5 h-5 text-brand-blue" /></div>
                        <div className="max-w-xl p-3 rounded-lg bg-gray-700">
                            <div className="animate-pulse">Thinking...</div>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>
            <div className="p-4 border-t border-gray-700 bg-gray-900">
                <div className="flex items-center gap-3">
                    <div className="relative w-full">
                        <textarea 
                            value={prompt} 
                            onChange={e => setPrompt(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                            placeholder={apiKey ? "Type your message to Gemini..." : "Set your API Key in Settings to begin."}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 pr-12 resize-none focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-gray-700/50"
                            rows={1}
                            disabled={!apiKey || isStreaming || isRefining}
                        />
                         <button onClick={handleRefinePrompt} title="Refine prompt" disabled={!apiKey || isStreaming || isRefining || !prompt.trim()} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-purple rounded-md disabled:text-gray-600">
                            {isRefining ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                    <button onClick={handleSendMessage} disabled={!apiKey || isStreaming || isRefining || !prompt.trim()} className="p-3 bg-brand-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed">
                        {isStreaming ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

const ImageGenerationPanel: React.FC<ImageGenerationPanelProps> = ({ apiKey, imageJobs, activeProject, updateActiveProject, addToast, addLog, onSendToEditor, onSendToVeo, onSendToCompositor, onViewFullscreen, onDeleteJob }) => {
    const { globalImageOptions, setGlobalImageOptions } = useAppContext();
    const [imagePrompt, setImagePrompt] = useState('A photorealistic image of a futuristic city skyline at dusk, with flying vehicles and neon signs.');
    const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('16:9');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    
    const handleRefinePrompt = async () => {
        if (!imagePrompt.trim() || !apiKey) return;
        setIsRefining(true);
        const refined = await refinePrompt(apiKey, imagePrompt, 'image', addLog);
        if (refined) {
            setImagePrompt(refined);
            addToast("Prompt refined successfully!", 'success');
        } else {
            addToast("Failed to refine prompt.", 'error');
        }
        setIsRefining(false);
    };

    const handleGenerateImage = useCallback(async () => {
        if (!imagePrompt.trim() || !activeProject || !apiKey || isRefining) {
            if(!apiKey) addToast("Please set your API Key in Settings.", 'error');
            return
        };

        const newJob: ImageJob = {
            id: uuidv4(),
            prompt: imagePrompt,
            status: ImageJobStatus.PENDING,
            timestamp: new Date().toISOString(),
            aspectRatio: aspectRatio,
            ...globalImageOptions
        };
        
        updateActiveProject(p => ({ geminiJobs: [newJob, ...(p.geminiJobs || [])] }));
        
        await generateImage(apiKey, newJob, addLog, (jobId, updates) => {
             updateActiveProject(p => ({
                geminiJobs: p.geminiJobs.map(j => j.id === jobId ? {...j, ...updates} : j)
             }));
        });
    }, [apiKey, imagePrompt, aspectRatio, globalImageOptions, activeProject, updateActiveProject, addLog, addToast, isRefining]);
    
    const isGenerating = imageJobs.some(j => j.status === ImageJobStatus.GENERATING || j.status === ImageJobStatus.PENDING);
    const isDisabled = isGenerating || !apiKey || isRefining;
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4">
                 <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4">
                    {imageJobs.map(job => (
                        job.imageUrls && job.imageUrls.map((imageUrl, index) => (
                           <div 
                                key={`${job.id}-${index}`} 
                                className="bg-gray-800 rounded-md overflow-hidden relative group border-2 border-transparent mb-4 break-inside-avoid"
                                style={{ aspectRatio: job.aspectRatio.replace(':', '/') }}
                            >
                                <img src={imageUrl} alt={job.prompt} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-xs text-white flex flex-col justify-between">
                                    <div>
                                        <div className="flex gap-1 mb-2">
                                            <button onClick={() => onSendToEditor(imageUrl.split(',')[1], job.prompt)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md" title="Edit Image"><PencilIcon className="w-4 h-4" /></button>
                                            <button onClick={() => onSendToVeo(imageUrl.split(',')[1])} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md" title="Send to VEO Automator"><ArrowUpTrayIcon className="w-4 h-4" /></button>
                                            <button onClick={() => onSendToCompositor(imageUrl.split(',')[1])} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md" title="Send to Image Compositor"><LayersIcon className="w-4 h-4" /></button>
                                            <button onClick={() => onViewFullscreen(imageUrl)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md" title="View Fullscreen"><ArrowsPointingOutIcon className="w-4 h-4" /></button>
                                            <button onClick={() => onDeleteJob(job.id)} className="p-1.5 bg-red-500/50 hover:bg-red-500/80 rounded-md" title="Delete Job"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                        <p className="max-h-20 overflow-y-auto">{job.prompt}</p>
                                    </div>
                                    <div className="mt-1 pt-1 border-t border-white/20">
                                        {job.stylization && <p>Style: {job.stylization}</p>}
                                    </div>
                                </div>
                           </div>
                        ))
                    ))}
                    {imageJobs.filter(j => j.status !== ImageJobStatus.COMPLETED).map(job => (
                         <div 
                            key={job.id} 
                            className="bg-gray-800 rounded-md overflow-hidden relative group border-2 border-transparent mb-4 break-inside-avoid flex items-center justify-center"
                            style={{ aspectRatio: job.aspectRatio.replace(':', '/') }}
                        >
                             {(job.status === ImageJobStatus.GENERATING || job.status === ImageJobStatus.PENDING) && <ArrowPathIcon className="w-8 h-8 animate-spin text-brand-blue"/>}
                             {job.status === ImageJobStatus.FAILED && <div className="p-2 text-center text-red-400 text-xs">{job.error}</div>}
                         </div>
                    ))}
                </div>
            </div>
            <div className="p-4 border-t border-gray-700 bg-gray-900 space-y-3">
                 <div className="flex flex-col sm:flex-row items-center gap-3">
                     <div className="relative flex-grow w-full">
                        <input type="text" value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} className="w-full bg-gray-800 border border-gray-600 p-2 pr-12 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-gray-700/50" placeholder={apiKey ? "Image prompt..." : "Set your API Key in Settings to begin."} disabled={isDisabled} />
                        <button onClick={handleRefinePrompt} title="Refine prompt" disabled={isDisabled || !imagePrompt.trim()} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-purple rounded-md disabled:text-gray-600">
                           {isRefining ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                        </button>
                     </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)} className="bg-gray-800 border-gray-600 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50" disabled={isDisabled}>
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                        </select>
                        <button onClick={handleGenerateImage} disabled={isDisabled || !imagePrompt.trim()} className="p-2 px-4 bg-brand-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 flex-grow sm:flex-grow-0 justify-center flex items-center gap-2">
                            {isGenerating ? <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Generating...</> : <><PhotoIcon className="w-5 h-5"/> Generate</>}
                        </button>
                     </div>
                </div>
                <div>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2">
                        Advanced Options
                    </button>
                    {showAdvanced && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-800/50 rounded-md animate-fade-in-up">
                            <div className="col-span-2 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Negative Prompt</label>
                                <input type="text" value={globalImageOptions.negativePrompt} onChange={e => setGlobalImageOptions(prev => ({...prev, negativePrompt: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Stylization</label>
                                 <select value={globalImageOptions.stylization} onChange={e => setGlobalImageOptions(prev => ({...prev, stylization: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    {STYLIZATION_OPTIONS.map(style => <option key={style}>{style}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                                 <select value={globalImageOptions.quality} onChange={e => setGlobalImageOptions(prev => ({...prev, quality: e.target.value as 'Standard' | 'HD'}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    <option>Standard</option>
                                    <option>HD</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Number of Images</label>
                                <select value={globalImageOptions.numberOfImages} onChange={e => setGlobalImageOptions(prev => ({...prev, numberOfImages: Number(e.target.value)}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    <option>1</option><option>2</option><option>3</option><option>4</option>
                                </select>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Image Strength: {globalImageOptions.imageStrength}%</label>
                                <input type="range" min="10" max="100" value={globalImageOptions.imageStrength} onChange={e => setGlobalImageOptions(prev => ({...prev, imageStrength: Number(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" disabled={isDisabled}/>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const ImageEditingPanel: React.FC<ImageEditingPanelProps> = ({ apiKey, addToast, addLog, sourceB64, setSourceB64, editPrompt, setEditPrompt, editedB64, setEditedB64, aspectRatio, setAspectRatio, onSendToCompositor, onSendToVeo, onViewFullscreen }) => {
    const { globalImageOptions, setGlobalImageOptions } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [isUpscaling, setIsUpscaling] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    const handleRefinePrompt = async () => {
        if (!editPrompt.trim() || !apiKey) return;
        setIsRefining(true);
        const refined = await refinePrompt(apiKey, editPrompt, 'image', addLog);
        if (refined) {
            setEditPrompt(refined);
            addToast("Prompt refined successfully!", 'success');
        } else {
            addToast("Failed to refine prompt.", 'error');
        }
        setIsRefining(false);
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const b64 = await blobToBase64(file);
            setSourceB64(b64);
            setEditedB64(null);
        }
    };
    
    const handleEdit = async () => {
        if (!sourceB64 || !editPrompt.trim() || !apiKey) {
             if(!apiKey) addToast("Please set your API Key in Settings.", 'error');
            return;
        }
        setIsEditing(true);
        setEditedB64(null);

        const result = await editImage(apiKey, sourceB64, {
            prompt: editPrompt,
            aspectRatio,
            quality: globalImageOptions.quality,
            stylization: globalImageOptions.stylization,
            negativePrompt: globalImageOptions.negativePrompt
        }, addLog);

        if(result) {
            setEditedB64(result);
        } else {
            addToast("Image editing failed.", 'error');
        }
        setIsEditing(false);
    };

    const handleUpscale = async () => {
        if (!editedB64 || !apiKey) return;
        setIsUpscaling(true);
        addLog("[ImageUpscale] Starting upscale process...");
        const result = await upscaleImage(apiKey, editedB64, addLog);
        if (result) {
            setEditedB64(result);
            addToast("Image upscaled successfully!", 'success');
        } else {
            addToast("Image upscale failed.", 'error');
        }
        setIsUpscaling(false);
    };

    const downloadImage = (b64: string, name: string) => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${b64}`;
        link.download = name;
        link.click();
    }
    
    const handleContinueEditing = () => {
        if (editedB64) {
            setSourceB64(editedB64);
            setEditedB64(null);
            setEditPrompt('');
            addToast("Image moved to source for further editing.", 'info');
        }
    };

    const isDisabled = !apiKey || isEditing || !sourceB64 || isRefining || isUpscaling;

    return (
        <div className="flex flex-col h-full p-4 gap-4">
             <div className="grid grid-rows-2 gap-4 flex-1 overflow-hidden">
                <div className="flex flex-col gap-2 items-center justify-center bg-gray-800 rounded-md p-4 h-full overflow-hidden">
                    {!sourceB64 ? (
                        <div className="text-center">
                            <PhotoIcon className="w-12 h-12 text-gray-600 mx-auto mb-2"/>
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-600">Upload Source Image</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*"/>
                        </div>
                    ) : (
                       <div className="w-full h-full relative group flex items-center justify-center">
                         <img src={`data:image/png;base64,${sourceB64}`} className="max-w-full max-h-full object-contain rounded-md"/>
                         <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onViewFullscreen(`data:image/png;base64,${sourceB64}`)} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="View Fullscreen"><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                            <button onClick={() => { setSourceB64(null); setEditedB64(null); }} className="p-2 bg-black/50 rounded-md text-white hover:bg-red-500/80" title="Remove Image"><XCircleIcon className="w-5 h-5"/></button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="Change Image"><DocumentDuplicateIcon className="w-5 h-5"/></button>
                            <button onClick={() => downloadImage(sourceB64, 'source_image.png')} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="Download Source"><DownloadIcon className="w-5 h-5"/></button>
                         </div>
                       </div>
                    )}
                </div>
                <div className="flex flex-col gap-2 items-center justify-center bg-gray-800 rounded-md p-4 h-full overflow-hidden">
                    {isEditing && <div className="flex flex-col items-center justify-center text-center"><ArrowPathIcon className="w-12 h-12 animate-spin text-brand-blue"/><p className="mt-2 text-gray-400">Editing...</p></div>}
                    {isUpscaling && <div className="flex flex-col items-center justify-center text-center"><ArrowPathIcon className="w-12 h-12 animate-spin text-brand-purple"/><p className="mt-2 text-gray-400">Upscaling...</p></div>}
                    {!isEditing && !isUpscaling && editedB64 && (
                        <div className="w-full h-full relative group flex items-center justify-center">
                            <img src={`data:image/png;base64,${editedB64}`} className="max-w-full max-h-full object-contain rounded-md"/>
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onViewFullscreen(`data:image/png;base64,${editedB64}`)} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="View Fullscreen"><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                                <button onClick={handleUpscale} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="Upscale Image">
                                    {isUpscaling ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArrowsPointingOutIcon className="w-5 h-5"/>}
                                </button>
                                <button onClick={handleContinueEditing} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="Continue Editing (use as new source)"><ArrowPathIcon className="w-5 h-5"/></button>
                                <button onClick={() => onSendToCompositor(editedB64)} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="Send to Compositor"><LayersIcon className="w-5 h-5"/></button>
                                <button onClick={() => onSendToVeo(editedB64)} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="Send to VEO"><ArrowUpTrayIcon className="w-5 h-5"/></button>
                                <button onClick={() => downloadImage(editedB64, 'edited_image.png')} disabled={isUpscaling} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80 disabled:opacity-50" title="Download Edited Image"><DownloadIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                    )}
                    {!isEditing && !isUpscaling && !editedB64 && <div className="text-gray-500">Edited image will appear here</div>}
                </div>
             </div>
             <div className="space-y-3">
                 <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-grow w-full">
                        <input type="text" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full bg-gray-800 border border-gray-600 p-2 pr-12 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-gray-700/50" placeholder={apiKey ? "Describe your edits..." : "Set API Key first..."} disabled={isDisabled} />
                        <button onClick={handleRefinePrompt} title="Refine prompt" disabled={isDisabled || !editPrompt.trim()} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-purple rounded-md disabled:text-gray-600">
                           {isRefining ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)} className="bg-gray-800 border-gray-600 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50" disabled={isDisabled}>
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                        </select>
                        <button onClick={handleEdit} disabled={isDisabled || !editPrompt.trim()} className="p-2 px-4 bg-brand-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 flex items-center gap-2">
                            {isEditing ? <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Editing...</> : <><PencilIcon className="w-5 h-5"/> Edit</>}
                        </button>
                     </div>
                 </div>
                 <div>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2">
                        Advanced Options
                    </button>
                    {showAdvanced && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-md animate-fade-in-up">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Negative Prompt</label>
                                <input type="text" value={globalImageOptions.negativePrompt} onChange={e => setGlobalImageOptions(prev => ({...prev, negativePrompt: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Stylization</label>
                                 <select value={globalImageOptions.stylization} onChange={e => setGlobalImageOptions(prev => ({...prev, stylization: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    {STYLIZATION_OPTIONS.map(style => <option key={style}>{style}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                                 <select value={globalImageOptions.quality} onChange={e => setGlobalImageOptions(prev => ({...prev, quality: e.target.value as 'Standard' | 'HD'}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    <option>Standard</option>
                                    <option>HD</option>
                                </select>
                            </div>
                        </div>
                    )}
                 </div>
             </div>
        </div>
    )
}

const ImageCompositorPanel: React.FC<ImageCompositorPanelProps> = ({ apiKey, addToast, addLog, sourceImages, setSourceImages, compositePrompt, setCompositePrompt, compositedB64, setCompositedB64, aspectRatio, setAspectRatio, onSendToEditor, onSendToVeo, onViewFullscreen }) => {
    const { globalImageOptions, setGlobalImageOptions } = useAppContext();
    const [isCompositing, setIsCompositing] = useState(false);
    const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isRefining, setIsRefining] = useState(false);

    const handleRefinePrompt = async () => {
        if (!compositePrompt.trim() || !apiKey) return;
        setIsRefining(true);
        const refined = await refinePrompt(apiKey, compositePrompt, 'image', addLog);
        if (refined) {
            setCompositePrompt(refined);
            addToast("Prompt refined successfully!", 'success');
        } else {
            addToast("Failed to refine prompt.", 'error');
        }
        setIsRefining(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            const b64 = await blobToBase64(file);
            const newImages = [...sourceImages];
            newImages[index] = b64;
            setSourceImages(newImages);
        }
    };
    
    const handleComposite = async () => {
        const validImages = sourceImages.filter(img => img !== null) as string[];
        if (validImages.length < 2 || !compositePrompt.trim() || !apiKey) {
            if(!apiKey) addToast("Please set your API Key.", 'error');
            else addToast("Please provide at least two images and a prompt.", 'error');
            return;
        }
        setIsCompositing(true);
        setCompositedB64(null);
        
        const result = await compositeImages(apiKey, validImages, {
            prompt: compositePrompt,
            aspectRatio,
            quality: globalImageOptions.quality,
            stylization: globalImageOptions.stylization,
            negativePrompt: globalImageOptions.negativePrompt,
            imageStrength: globalImageOptions.imageStrength
        }, addLog);

        if (result) {
            setCompositedB64(result);
        } else {
            addToast("Image composition failed.", 'error');
        }
        setIsCompositing(false);
    };

    const isDisabled = !apiKey || isCompositing || isRefining;
    
    return (
         <div className="flex flex-col h-full p-4 gap-4">
             <div className="grid md:grid-cols-2 gap-4 flex-1 overflow-hidden">
                 <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-semibold text-center">Source Images (2-3 required)</h3>
                    <div className="flex flex-col gap-2 flex-1">
                        {sourceImages.map((img, index) => (
                            <div key={index} className="bg-gray-800 rounded-md flex items-center justify-center relative group flex-1">
                                {img ? (
                                    <>
                                        <img src={`data:image/png;base64,${img}`} className="w-full h-full object-contain rounded-md" />
                                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onViewFullscreen(`data:image/png;base64,${img}`)} className="p-1 bg-black/50 rounded-full text-white" title="View Fullscreen"><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                                            <button onClick={() => {
                                                const newImages = [...sourceImages];
                                                newImages[index] = null;
                                                setSourceImages(newImages);
                                            }} className="p-1 bg-black/50 rounded-full text-white" title="Remove"><XCircleIcon className="w-5 h-5"/></button>
                                        </div>
                                    </>
                                ) : (
                                    <button onClick={() => fileInputRefs[index].current?.click()} className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded-md">
                                        <PlusIcon className="w-8 h-8"/>
                                        <span>Image {index + 1}</span>
                                    </button>
                                )}
                                <input type="file" ref={fileInputRefs[index]} onChange={(e) => handleFileChange(e, index)} className="hidden" accept="image/*"/>
                            </div>
                        ))}
                    </div>
                 </div>
                 <div className="flex flex-col gap-2 items-center justify-center bg-gray-800 rounded-md p-4 overflow-hidden">
                    {isCompositing && <div className="flex flex-col items-center justify-center text-center"><ArrowPathIcon className="w-12 h-12 animate-spin text-brand-blue"/><p className="mt-2 text-gray-400">Generating...</p></div>}
                    {!isCompositing && compositedB64 && (
                        <div className="w-full h-full relative group">
                            <img src={`data:image/png;base64,${compositedB64}`} className="w-full h-full object-contain rounded-md"/>
                             <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onViewFullscreen(`data:image/png;base64,${compositedB64}`)} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="View Fullscreen"><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                                <button onClick={() => onSendToEditor(compositedB64)} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="Send to Editor"><PencilIcon className="w-5 h-5"/></button>
                                <button onClick={() => onSendToVeo(compositedB64)} className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="Send to VEO"><ArrowUpTrayIcon className="w-5 h-5"/></button>
                                <a href={`data:image/png;base64,${compositedB64}`} download="composited_image.png" className="p-2 bg-black/50 rounded-md text-white hover:bg-black/80" title="Download Image"><DownloadIcon className="w-5 h-5"/></a>
                            </div>
                        </div>
                    )}
                    {!isCompositing && !compositedB64 && <div className="text-gray-500 text-center">Combined image will appear here</div>}
                </div>
             </div>
             <div className="space-y-3">
                 <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-grow w-full">
                        <input type="text" value={compositePrompt} onChange={e => setCompositePrompt(e.target.value)} className="w-full bg-gray-800 border border-gray-600 p-2 pr-12 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-gray-700/50" placeholder={apiKey ? "Describe how to combine the images..." : "Set API Key first..."} disabled={isDisabled} />
                        <button onClick={handleRefinePrompt} title="Refine prompt" disabled={isDisabled || !compositePrompt.trim()} className="absolute top-1/2 right-2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-purple rounded-md disabled:text-gray-600">
                           {isRefining ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                        </button>
                    </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as ImageAspectRatio)} className="bg-gray-800 border-gray-600 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50" disabled={isDisabled}>
                            <option value="1:1">1:1</option>
                            <option value="16:9">16:9</option>
                            <option value="9:16">9:16</option>
                            <option value="4:3">4:3</option>
                            <option value="3:4">3:4</option>
                        </select>
                        <button onClick={handleComposite} disabled={isDisabled || sourceImages.filter(i=>i).length < 2 || !compositePrompt.trim()} className="p-2 px-4 bg-brand-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 flex items-center gap-2 flex-grow sm:flex-grow-0 justify-center">
                            {isCompositing ? <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Gen...</> : <><LayersIcon className="w-5 h-5"/> Generate</>}
                        </button>
                     </div>
                 </div>
                 <div>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2">
                        Advanced Options
                    </button>
                    {showAdvanced && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-md animate-fade-in-up">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Negative Prompt</label>
                                <input type="text" value={globalImageOptions.negativePrompt} onChange={e => setGlobalImageOptions(prev => ({...prev, negativePrompt: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Stylization</label>
                                 <select value={globalImageOptions.stylization} onChange={e => setGlobalImageOptions(prev => ({...prev, stylization: e.target.value}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    {STYLIZATION_OPTIONS.map(style => <option key={style}>{style}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Quality</label>
                                 <select value={globalImageOptions.quality} onChange={e => setGlobalImageOptions(prev => ({...prev, quality: e.target.value as 'Standard' | 'HD'}))} className="w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" disabled={isDisabled}>
                                    <option>Standard</option>
                                    <option>HD</option>
                                </select>
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Prompt Strength: {globalImageOptions.imageStrength}%</label>
                                <input type="range" min="10" max="100" value={globalImageOptions.imageStrength} onChange={e => setGlobalImageOptions(prev => ({...prev, imageStrength: Number(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" disabled={isDisabled}/>
                            </div>
                        </div>
                    )}
                 </div>
             </div>
        </div>
    )
}


const GeminiPlayground: React.FC = () => {
    const { apiKey, addLog, addToast, activeProject, updateActiveProject, setImageForVeo } = useAppContext();
    const [activeTab, setActiveTab] = useState<'chat' | 'imageGen' | 'imageEdit' | 'imageComposite' | 'logs'>('chat');
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
    
    // --- Lifted State for Seamless Workflow ---
    const [editingSourceB64, setEditingSourceB64] = useState<string | null>(null);
    const [editingPrompt, setEditingPrompt] = useState('');
    const [editingResultB64, setEditingResultB64] = useState<string | null>(null);
    const [editingAspectRatio, setEditingAspectRatio] = useState<ImageAspectRatio>('1:1');

    const [compositorSourceImages, setCompositorSourceImages] = useState<(string | null)[]>([null, null, null]);
    const [compositorPrompt, setCompositorPrompt] = useState('A photorealistic image of the character from image 1, in the environment from image 2, holding the object from image 3.');
    const [compositorResultB64, setCompositorResultB64] = useState<string | null>(null);
    const [compositorAspectRatio, setCompositorAspectRatio] = useState<ImageAspectRatio>('1:1');
    // --- End Lifted State ---

    const handleDeleteImageJob = (jobId: string) => {
        if (window.confirm("Are you sure you want to delete this image generation job? This will remove all images associated with it.")) {
            updateActiveProject(p => ({
                geminiJobs: p.geminiJobs.filter(j => j.id !== jobId)
            }));
            addToast("Image job deleted.", 'success');
        }
    };

    const handleSendToCompositor = useCallback((b64: string) => {
        const firstEmptyIndex = compositorSourceImages.findIndex(img => img === null);
        if (firstEmptyIndex !== -1) {
            const newImages = [...compositorSourceImages];
            newImages[firstEmptyIndex] = b64;
            setCompositorSourceImages(newImages);
            addToast("Image added to compositor.", 'info');
        } else {
            addToast("Compositor slots are full. Clear one to add a new image.", 'error');
        }
        setActiveTab('imageComposite');
    }, [compositorSourceImages, addToast]);
    
    const handleSendToEditor = useCallback((b64: string, prompt: string = '') => {
        setEditingSourceB64(b64);
        setEditingPrompt(prompt || `Make this image more vibrant and add a glowing effect.`);
        setEditingResultB64(null); // Clear previous result
        setActiveTab('imageEdit');
        addToast("Image sent to editor.", 'info');
    }, [addToast]);
    
    const handleSendToVeo = (b64: string) => {
        setImageForVeo(b64);
        addToast("Image sent to VEO Automator. Navigate to the VEO tab to use it.", 'info');
    };

    const chatHistory = activeProject?.geminiChat || [];
    const imageJobs = activeProject?.geminiJobs || [];

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <header className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
                 <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold">Gemini Playground</h1>
                        <span className="text-sm text-gray-400 hidden md:inline">Project: {activeProject?.name || 'None'}</span>
                    </div>
                 </div>
            </header>
            <div className="flex-1 overflow-hidden">
                 <div className="h-full flex flex-col">
                     <div className="border-b border-gray-700 overflow-x-auto">
                         <nav className="flex space-x-2 px-2">
                            <button onClick={() => setActiveTab('chat')} className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'chat' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}><SparklesIcon className="w-4 h-4 inline mr-1"/>Chat</button>
                            <button onClick={() => setActiveTab('imageGen')} className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'imageGen' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}><PhotoIcon className="w-4 h-4 inline mr-1"/>Image Generation</button>
                            <button onClick={() => setActiveTab('imageEdit')} className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'imageEdit' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}><PencilIcon className="w-4 h-4 inline mr-1"/>Image Editing</button>
                             <button onClick={() => setActiveTab('imageComposite')} className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'imageComposite' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}><LayersIcon className="w-4 h-4 inline mr-1"/>Image Compositor</button>
                            <button onClick={() => setActiveTab('logs')} className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${activeTab === 'logs' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>Logs</button>
                         </nav>
                     </div>
                     <div className="flex-1 overflow-y-auto bg-gray-900">
                        {activeTab === 'chat' && <ChatPanel {...{apiKey, chatHistory, activeProject, updateActiveProject, addToast, addLog}} />}
                        {activeTab === 'imageGen' && <ImageGenerationPanel {...{apiKey, imageJobs, activeProject, updateActiveProject, addToast, addLog, onSendToEditor: handleSendToEditor, onSendToVeo: handleSendToVeo, onSendToCompositor: handleSendToCompositor, onViewFullscreen: setFullscreenImageUrl, onDeleteJob: handleDeleteImageJob }} />}
                        {activeTab === 'imageEdit' && <ImageEditingPanel 
                            apiKey={apiKey} 
                            addToast={addToast} 
                            addLog={addLog}
                            sourceB64={editingSourceB64}
                            setSourceB64={setEditingSourceB64}
                            editPrompt={editingPrompt}
                            setEditPrompt={setEditingPrompt}
                            editedB64={editingResultB64}
                            setEditedB64={setEditingResultB64}
                            aspectRatio={editingAspectRatio}
                            setAspectRatio={setEditingAspectRatio}
                            onSendToCompositor={handleSendToCompositor}
                            onSendToVeo={handleSendToVeo}
                            onViewFullscreen={setFullscreenImageUrl}
                        />}
                        {activeTab === 'imageComposite' && <ImageCompositorPanel 
                            apiKey={apiKey}
                            addToast={addToast}
                            addLog={addLog}
                            sourceImages={compositorSourceImages}
                            setSourceImages={setCompositorSourceImages}
                            compositePrompt={compositorPrompt}
                            setCompositePrompt={setCompositorPrompt}
                            compositedB64={compositorResultB64}
                            setCompositedB64={setCompositorResultB64}
                            aspectRatio={compositorAspectRatio}
                            setAspectRatio={setCompositorAspectRatio}
                            onSendToEditor={handleSendToEditor}
                            onSendToVeo={handleSendToVeo}
                            onViewFullscreen={setFullscreenImageUrl}
                        />}
                        {activeTab === 'logs' && <div className="h-full"><LogViewer /></div>}
                     </div>
                 </div>
            </div>
            {fullscreenImageUrl && (
                <div 
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in-up"
                    onClick={() => setFullscreenImageUrl(null)}
                >
                    <button 
                        className="absolute top-4 right-4 p-2 text-white bg-black/50 rounded-full hover:bg-black"
                        onClick={() => setFullscreenImageUrl(null)}
                    >
                        <XCircleIcon className="w-8 h-8"/>
                    </button>
                    <img 
                        src={fullscreenImageUrl} 
                        alt="Fullscreen view" 
                        className="max-w-[95vw] max-h-[95vh] object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default GeminiPlayground;