
import React, { useEffect, useRef, useState } from 'react';
import { VideoModel, VideoAspectRatio, VideoResolution, LogLevel } from '../../../types';
import { ArrowPathIcon, PlayIcon, PaperClipIcon, XCircleIcon, SparklesIcon } from '../../../components/IconComponents';
import { blobToBase64 } from '../../../utils/fileUtils';
import { refinePrompt } from '../../gemini/services/geminiPlaygroundService';


interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  model: VideoModel;
  setModel: (model: VideoModel) => void;
  aspectRatio: VideoAspectRatio;
  setAspectRatio: (aspectRatio: VideoAspectRatio) => void;
  resolution: VideoResolution;
  setResolution: (resolution: VideoResolution) => void;
  numberOfOutputs: number;
  setNumberOfOutputs: (num: number) => void;
  sourceImage: string | null;
  setSourceImage: (image: string | null) => void;
  apiKey: string;
  addLog: (message: string, level?: LogLevel) => void;
  addToast: (message: string, level: 'success' | 'error' | 'info') => void;
}

const PromptInput: React.FC<PromptInputProps> = ({
  onSubmit, isGenerating, prompt, setPrompt, model, setModel,
  aspectRatio, setAspectRatio, resolution, setResolution,
  numberOfOutputs, setNumberOfOutputs, sourceImage, setSourceImage, apiKey,
  addLog, addToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRefining, setIsRefining] = useState(false);
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) { onSubmit(prompt.trim()); }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await blobToBase64(file);
      setSourceImage(base64);
    }
  };
  
  const handleRefinePrompt = async () => {
    if (!prompt.trim() || !apiKey) return;
    setIsRefining(true);
    const refined = await refinePrompt(apiKey, prompt, 'video', addLog);
    if (refined) {
        setPrompt(refined);
        addToast("Prompt refined successfully!", 'success');
    } else {
        addToast("Failed to refine prompt.", 'error');
    }
    setIsRefining(false);
  };
  
  const isFastModel = model === 'veo-3.1-fast-generate-preview';
  useEffect(() => {
    if (!isFastModel && resolution === '1080p') { setResolution('720p'); }
  }, [model, resolution, setResolution, isFastModel]);

  const isDisabled = isGenerating || !apiKey || isRefining;
  const placeholderText = !apiKey ? "Please set your API Key in Settings to begin..." : "Enter your video prompt here...";

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {sourceImage && (
        <div className="relative w-32 h-20 bg-gray-700 rounded-md p-1">
          <img src={`data:image/jpeg;base64,${sourceImage}`} alt="Source preview" className="w-full h-full object-cover rounded-sm" />
          <button onClick={() => setSourceImage(null)} className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-gray-400 hover:text-white">
            <XCircleIcon className="w-6 h-6"/>
          </button>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholderText} className="w-full h-24 md:h-auto bg-gray-800 border border-gray-700 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none disabled:bg-gray-700/50 pr-24" disabled={isDisabled} />
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button type="button" onClick={handleRefinePrompt} title="Refine prompt with AI" className="p-1.5 text-gray-400 hover:text-brand-purple bg-gray-700/50 hover:bg-gray-600 rounded-md disabled:cursor-not-allowed disabled:text-gray-600" disabled={isDisabled || !prompt.trim()}>
              {isRefining ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach source image" className="p-1.5 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600 rounded-md" disabled={isDisabled}>
              <PaperClipIcon className="w-5 h-5"/>
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>
        <button type="submit" className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-blue text-white font-bold rounded-md hover:bg-blue-600 disabled:bg-gray-600" disabled={isDisabled || !prompt.trim()}>
          {isGenerating ? (<> <ArrowPathIcon className="w-5 h-5 animate-spin"/> <span>Generating...</span> </>) : (<> <PlayIcon className="w-5 h-5"/> <span>Generate</span> </>)}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Model:</label>
          <select disabled={isDisabled} value={model} onChange={e => setModel(e.target.value as VideoModel)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="veo-3.1-fast-generate-preview">Veo Fast</option>
            <option value="veo-3.1-generate-preview">Veo Quality</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Aspect Ratio:</label>
          <select disabled={isDisabled} value={aspectRatio} onChange={e => setAspectRatio(e.target.value as VideoAspectRatio)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Resolution:</label>
          <select disabled={isDisabled} value={resolution} onChange={e => setResolution(e.target.value as VideoResolution)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="720p">720p</option>
            {isFastModel && <option value="1080p">1080p</option>}
          </select>
        </div>
        <div className="flex items-center gap-2">
            <label className="font-medium text-gray-400">Outputs:</label>
            <select disabled={isDisabled} value={numberOfOutputs} onChange={e => setNumberOfOutputs(Number(e.target.value))} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
                {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
        </div>
      </div>
    </form>
  );
};
export default PromptInput;
