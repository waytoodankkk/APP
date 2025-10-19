
import React, { useEffect } from 'react';
// FIX: Import VEO-related types from their correct location.
import { Model, AspectRatio, Resolution } from '../modules/veo/types';
import { ArrowPathIcon, PlayIcon } from './IconComponents';

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  model: Model;
  setModel: (model: Model) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  resolution: Resolution;
  setResolution: (resolution: Resolution) => void;
  numberOfOutputs: number;
  setNumberOfOutputs: (num: number) => void;
  apiKey: string;
}

const PromptInput: React.FC<PromptInputProps> = ({
  onSubmit,
  isGenerating,
  prompt,
  setPrompt,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  numberOfOutputs,
  setNumberOfOutputs,
  apiKey,
}) => {

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onSubmit(prompt.trim());
    }
  };

  const isFastModel = model === 'veo-3.1-fast-generate-preview';
  
  useEffect(() => {
    // 1080p is only available for fast model
    if (!isFastModel && resolution === '1080p') {
        setResolution('720p');
    }
  }, [model, resolution, setResolution, isFastModel]);

  const isDisabled = isGenerating || !apiKey;
  const placeholderText = !apiKey ? "Please set your API Key in the header to begin..." : "Enter your video prompt here...";

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholderText}
          className="w-full h-24 md:h-auto bg-gray-800 border border-gray-700 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none disabled:bg-gray-700/50 disabled:cursor-not-allowed"
          disabled={isDisabled}
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-blue text-white font-bold rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          disabled={isDisabled || !prompt.trim()}
        >
          {isGenerating ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin"/>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <PlayIcon className="w-5 h-5"/>
              <span>Generate</span>
            </>
          )}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        {/* Model Selection */}
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Model:</label>
          <select disabled={isDisabled} value={model} onChange={e => setModel(e.target.value as Model)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="veo-3.1-fast-generate-preview">Veo Fast</option>
            <option value="veo-3.1-generate-preview">Veo Quality</option>
          </select>
        </div>
        {/* Aspect Ratio Selection */}
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Aspect Ratio:</label>
          <select disabled={isDisabled} value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
          </select>
        </div>
        {/* Resolution Selection */}
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-400">Resolution:</label>
          <select disabled={isDisabled} value={resolution} onChange={e => setResolution(e.target.value as Resolution)} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
            <option value="720p">720p</option>
            {isFastModel && <option value="1080p">1080p</option>}
          </select>
        </div>
        {/* Number of Outputs */}
        <div className="flex items-center gap-2">
            <label className="font-medium text-gray-400">Outputs:</label>
            <select disabled={isDisabled} value={numberOfOutputs} onChange={e => setNumberOfOutputs(Number(e.target.value))} className="bg-gray-800 border-gray-700 border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:opacity-50">
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
            </select>
        </div>
      </div>
    </form>
  );
};

export default PromptInput;