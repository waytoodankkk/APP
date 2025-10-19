import React, { useState, useEffect } from 'react';
import { VideoJob, VideoJobStatus } from '../../../types';
import { XCircleIcon, ArrowPathIcon, DocumentDuplicateIcon, DownloadIcon } from '../../../components/IconComponents';

interface VideoGridProps {
  jobs: VideoJob[];
  onRetry: (job: VideoJob) => void;
  onClone: (job: VideoJob) => void;
}

const VideoPreviewModal: React.FC<{ job: VideoJob; onClose: () => void }> = ({ job, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-900 rounded-lg max-w-4xl w-full p-4 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white bg-gray-800/50 rounded-full">
                    <XCircleIcon className="w-8 h-8"/>
                </button>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        {job.videoUrls && job.videoUrls.length > 0 && (
                            <video src={job.videoUrls[0]} controls autoPlay className="w-full h-auto rounded-md" />
                        )}
                    </div>
                    <div className="md:w-1/3 space-y-3">
                        <h3 className="text-lg font-bold">Details</h3>
                        <p className="text-sm text-gray-300 bg-gray-800 p-2 rounded-md max-h-40 overflow-y-auto">{job.prompt}</p>
                        <div className="text-xs text-gray-400 space-y-1">
                            <p>Model: {job.model}</p>
                            <p>Resolution: {job.resolution} | {job.aspectRatio}</p>
                        </div>
                         {job.videoUrls && (
                            <a href={job.videoUrls[0]} download={`veo_${job.id.substring(0,8)}.mp4`} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-md hover:bg-blue-600">
                                <DownloadIcon className="w-5 h-5"/> Download Video
                            </a>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const JobCard: React.FC<{ job: VideoJob; onRetry: (job: VideoJob) => void; onClone: (job: VideoJob) => void; onPreview: (job: VideoJob) => void; }> = ({ job, onRetry, onClone, onPreview }) => {
  const getBorderColor = () => {
    switch (job.status) {
      case VideoJobStatus.COMPLETED: return 'border-green-500';
      case VideoJobStatus.FAILED: return 'border-red-500';
      case VideoJobStatus.GENERATING: return 'border-brand-blue animate-pulse';
      case VideoJobStatus.QUEUED: return 'border-yellow-500';
      case VideoJobStatus.PENDING: return 'border-gray-600';
      default: return 'border-gray-700';
    }
  };

  const isComplete = job.status === VideoJobStatus.COMPLETED && job.videoUrls && job.videoUrls.length > 0;

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden border-2 ${getBorderColor()} flex flex-col group`}>
      <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
        {isComplete ? (
           <div className="h-full w-full relative" onClick={() => onPreview(job)}>
             <video src={job.videoUrls[0]} muted loop className="w-full h-full object-cover"></video>
             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <p className="text-white font-bold">Click to Preview</p>
             </div>
           </div>
        ) : (
            <div className="text-center p-4">
                {job.status === VideoJobStatus.GENERATING && <ArrowPathIcon className="w-12 h-12 text-brand-blue animate-spin mx-auto mb-2" />}
                {job.status === VideoJobStatus.FAILED && <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-2" />}
                {(job.status === VideoJobStatus.PENDING || job.status === VideoJobStatus.QUEUED) && <div className="text-gray-500 mx-auto mb-2 font-bold text-lg">{job.status}...</div>}
                <p className="text-sm text-gray-400">{job.progressMessage}</p>
            </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          <p className="text-gray-300 mb-2 h-12 overflow-y-auto text-sm">{job.prompt}</p>
          {job.status === VideoJobStatus.FAILED && job.error && (
            <p className="text-red-400 text-xs mt-1 bg-red-900/50 p-2 rounded-md">{job.error}</p>
          )}
        </div>
        <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
            <div>
              <span>{job.aspectRatio} | {job.resolution}</span>
              <span className="ml-2">({job.numberOfOutputs})</span>
            </div>
            <div className="flex items-center gap-2">
                <button title="Clone Settings" onClick={() => onClone(job)} className="p-1.5 hover:bg-gray-700 rounded-md"><DocumentDuplicateIcon className="w-4 h-4 text-gray-400 hover:text-white" /></button>
                {job.status === VideoJobStatus.FAILED && <button title="Retry Job" onClick={() => onRetry(job)} className="p-1.5 hover:bg-gray-700 rounded-md"><ArrowPathIcon className="w-4 h-4 text-gray-400 hover:text-white" /></button>}
            </div>
        </div>
      </div>
    </div>
  );
};

const SkeletonCard: React.FC = () => (
    <div className="bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 flex flex-col animate-pulse">
        <div className="aspect-video bg-gray-700"></div>
        <div className="p-4">
            <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="flex justify-between items-center">
                <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/4"></div>
            </div>
        </div>
    </div>
);

const VideoGrid: React.FC<VideoGridProps> = ({ jobs, onRetry, onClone }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [previewJob, setPreviewJob] = useState<VideoJob | null>(null);
    
    useEffect(() => {
        // Simulate loading from local storage
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-gray-500 h-96 border-2 border-dashed border-gray-700 rounded-lg">
                <p className="text-lg">No videos generated yet.</p>
                <p>Use the prompt bar below to start creating!</p>
            </div>
        );
    }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {jobs.map(job => ( <JobCard key={job.id} job={job} onRetry={onRetry} onClone={onClone} onPreview={setPreviewJob} /> ))}
      </div>
      {previewJob && <VideoPreviewModal job={previewJob} onClose={() => setPreviewJob(null)} />}
    </>
  );
};
export default VideoGrid;
