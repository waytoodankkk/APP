
import React from 'react';
// FIX: Import VEO-related types from their correct location.
import { VideoJob, VideoJobStatus } from '../modules/veo/types';
import { XCircleIcon, ArrowPathIcon } from './IconComponents';

interface VideoGridProps {
  jobs: VideoJob[];
}

const JobCard: React.FC<{ job: VideoJob }> = ({ job }) => {
  const getBorderColor = () => {
    switch (job.status) {
      case VideoJobStatus.COMPLETED:
        return 'border-green-500';
      case VideoJobStatus.FAILED:
        return 'border-red-500';
      case VideoJobStatus.GENERATING:
        return 'border-brand-blue animate-pulse';
      case VideoJobStatus.PENDING:
        return 'border-gray-600';
      default:
        return 'border-gray-700';
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden border-2 ${getBorderColor()} flex flex-col`}>
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        {job.status === VideoJobStatus.COMPLETED && job.videoUrls && job.videoUrls.length > 0 ? (
           <div className={`grid ${job.videoUrls.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'} h-full w-full`}>
             {job.videoUrls.map((url, index) => (
                 <video key={index} src={url} controls className="w-full h-full object-cover"></video>
             ))}
           </div>
        ) : (
            <div className="text-center p-4">
                {job.status === VideoJobStatus.GENERATING && <ArrowPathIcon className="w-12 h-12 text-brand-blue animate-spin mx-auto mb-2" />}
                {job.status === VideoJobStatus.FAILED && <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-2" />}
                {job.status === VideoJobStatus.PENDING && <div className="w-12 h-12 text-gray-500 mx-auto mb-2">...</div>}
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
          <span>{job.aspectRatio} | {job.resolution}</span>
          <span>Outputs: {job.numberOfOutputs}</span>
        </div>
      </div>
    </div>
  );
};


const VideoGrid: React.FC<VideoGridProps> = ({ jobs }) => {
    if (jobs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-gray-500 h-96 border-2 border-dashed border-gray-700 rounded-lg">
                <p className="text-lg">No videos generated yet.</p>
                <p>Use the prompt bar below to start creating!</p>
            </div>
        );
    }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {jobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
};

export default VideoGrid;