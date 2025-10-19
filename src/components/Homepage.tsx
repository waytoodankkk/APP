import React from 'react';
import { AppModule } from '../types';
import { FilmIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon } from './IconComponents';

interface HomepageProps {
  onSelectModule: (module: AppModule) => void;
}

const ModuleCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <div
    onClick={onClick}
    className="bg-gray-800 p-8 rounded-lg border-2 border-gray-700 hover:border-brand-blue hover:bg-gray-800/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1 flex flex-col items-center text-center group"
  >
    <div className="text-gray-500 group-hover:text-brand-blue transition-colors mb-4">{icon}</div>
    <h2 className="text-2xl font-bold mb-2 text-white">{title}</h2>
    <p className="text-gray-400">{description}</p>
  </div>
);

const Homepage: React.FC<HomepageProps> = ({ onSelectModule }) => {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-white mb-4">Welcome to the Gemini Creative Suite</h1>
          <p className="text-xl text-gray-400">Your integrated workspace for AI-powered video, image, and text creation.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ModuleCard
            title="VEO Flow Automator"
            description="Generate stunning videos with Google Veo. Manage projects, batch prompts, and bring your ideas to life in motion."
            
            onClick={() => onSelectModule('veo')}
          />
          <ModuleCard
            title="Gemini 2.5 Playground"
            description="Brainstorm, write, and create with Gemini 2.5 Pro. Generate high-quality images and edit them with natural language."
            onClick={() => onSelectModule('gemini')}
          />
        </div>
        <div className="mt-8 flex justify-center">
            <div
                onClick={() => onSelectModule('settings')}
                className="w-full max-w-sm bg-gray-800 p-6 rounded-lg border-2 border-gray-700 hover:border-gray-500 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1 flex flex-col items-center text-center group"
            >
                <div className="text-gray-500 group-hover:text-gray-300 transition-colors mb-3">

                </div>
                <h2 className="text-xl font-bold mb-1 text-white">Settings</h2>
                <p className="text-gray-400 text-sm">Manage your API key and application data.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
