
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../contexts/AppContext';
import { VideoJob, VideoJobStatus, VideoModel, VideoAspectRatio, VideoResolution, LogLevel } from '../../types';
import { generateVideo, downloadAllVideos } from './services/veoService';
import VideoGrid from './components/VideoGrid';
import PromptInput from './components/PromptInput';
import LogViewer from '../../components/LogViewer';
import { DownloadIcon } from '../../components/IconComponents';

const MAX_CONCURRENT_JOBS = 2;

const VeoAutomator: React.FC = () => {
  const { 
    apiKey, addLog, addToast,
    activeProject, updateActiveProject, imageForVeo, setImageForVeo
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'gallery' | 'logs'>('gallery');
  const promptInputContainerRef = useRef<HTMLDivElement>(null);
  const [promptInputHeight, setPromptInputHeight] = useState(0);

  const jobs = activeProject?.veoJobs || [];

  const [prompt, setPrompt] = useState('A cinematic shot of a raccoon astronaut, diligently working on a computer in a spaceship, with Earth visible through the window.');
  const [model, setModel] = useState<VideoModel>('veo-3.1-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [numberOfOutputs, setNumberOfOutputs] = useState(1);
  const [sourceImage, setSourceImage] = useState<string | null>(null);

  useEffect(() => {
    if (imageForVeo) {
      setSourceImage(imageForVeo);
      addToast("Image sent from Gemini Playground.", 'info');
      setImageForVeo(null); // Consume the image
    }
  }, [imageForVeo, addToast, setImageForVeo]);

  const updateJob = useCallback((jobId: string, updates: Partial<VideoJob>) => {
    updateActiveProject(prevProject => ({
      veoJobs: (prevProject.veoJobs || []).map(job =>
        job.id === jobId ? { ...job, ...updates } : job
      ),
    }));
  }, [updateActiveProject]);

  // Job Queue Processing Effect
  useEffect(() => {
    if (!apiKey || !activeProject) return;

    const activeJobs = activeProject.veoJobs.filter(j => j.status === VideoJobStatus.GENERATING);
    const queuedJobs = activeProject.veoJobs.filter(j => j.status === VideoJobStatus.QUEUED);

    if (activeJobs.length < MAX_CONCURRENT_JOBS && queuedJobs.length > 0) {
        const jobToStart = queuedJobs[0];
        updateJob(jobToStart.id, { status: VideoJobStatus.GENERATING });
        generateVideo(apiKey, jobToStart, addLog, updateJob);
    }
  }, [apiKey, activeProject, addLog, updateJob]);

  const handleSubmitPrompt = async (submittedPrompt: string) => {
    if (!activeProject) {
        addToast("No active project.", 'error');
        return;
    }
    if (!apiKey) {
        addToast("Please set your API Key in Settings first.", 'error');
        return;
    }
    const newJob: VideoJob = {
      id: uuidv4(), prompt: submittedPrompt, status: VideoJobStatus.QUEUED, progressMessage: 'Queued...',
      model, aspectRatio, resolution, numberOfOutputs, sourceImage
    };
    updateActiveProject(prev => ({ veoJobs: [newJob, ...(prev.veoJobs || [])] }));
    addLog(`[VEO-${newJob.id.substring(0,8)}] New job queued.`);
    setSourceImage(null); // Clear image after submitting
  };

  const handleRetryJob = (job: VideoJob) => {
    const newJob: VideoJob = { ...job, id: uuidv4(), status: VideoJobStatus.QUEUED, progressMessage: 'Queued...', error: undefined, videoUrls: [] };
    updateActiveProject(prev => ({ veoJobs: [newJob, ...(prev.veoJobs || [])] }));
    addLog(`[VEO-${newJob.id.substring(0,8)}] Retrying job.`);
  };

  const handleCloneJob = (job: VideoJob) => {
    setPrompt(job.prompt);
    setModel(job.model);
    setAspectRatio(job.aspectRatio);
    setResolution(job.resolution);
    setNumberOfOutputs(job.numberOfOutputs);
    setSourceImage(job.sourceImage || null);
    addToast("Job settings cloned to prompt bar.", 'info');
  };

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) { setPromptInputHeight(entry.contentRect.height); }
    });
    if (promptInputContainerRef.current) { observer.observe(promptInputContainerRef.current); }
    return () => { observer.disconnect(); };
  }, []);

  const isGenerating = jobs.some(j => j.status === VideoJobStatus.GENERATING || j.status === VideoJobStatus.QUEUED);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <header className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">VEO Flow Automator</h1>
            <span className="text-sm text-gray-400 hidden md:inline">Project: {activeProject?.name || 'None'}</span>
          </div>
        </div>
        <button onClick={() => downloadAllVideos(jobs, addLog, addToast)} disabled={jobs.filter(j => j.status === VideoJobStatus.COMPLETED).length === 0} className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-md hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed">
            <DownloadIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">Download All</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8" style={{ paddingBottom: `${promptInputHeight + 16}px` }}>
          <div className="max-w-7xl mx-auto w-full">
              <div className="mb-4 flex border-b border-gray-700">
                  <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'gallery' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>Gallery</button>
                  <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'logs' ? 'border-b-2 border-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}>Logs</button>
              </div>
              {activeTab === 'gallery' && <VideoGrid jobs={jobs} onRetry={handleRetryJob} onClone={handleCloneJob} />}
              {activeTab === 'logs' && <div className="h-[70vh]"><LogViewer /></div>}
          </div>
      </div>
      
      <div ref={promptInputContainerRef} className="absolute bottom-0 left-0 right-0 z-10 md:relative">
           <div className="p-4 md:p-6 bg-gray-800/80 border-t border-gray-700 backdrop-blur-sm">
               <div className="max-w-7xl mx-auto">
                  <PromptInput 
                    onSubmit={handleSubmitPrompt} 
                    isGenerating={isGenerating} 
                    prompt={prompt} setPrompt={setPrompt} 
                    model={model} setModel={setModel} 
                    aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} 
                    resolution={resolution} setResolution={setResolution} 
                    numberOfOutputs={numberOfOutputs} setNumberOfOutputs={setNumberOfOutputs} 
                    sourceImage={sourceImage} setSourceImage={setSourceImage}
                    apiKey={apiKey}
                    addLog={addLog}
                    addToast={addToast} />
               </div>
          </div>
      </div>
    </div>
  );
};

export default VeoAutomator;
