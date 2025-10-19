import React, { useRef, useEffect } from 'react';
import { LogEntry, LogLevel } from '../types';
import { InfoIcon, CheckCircleIcon, XCircleIcon } from './IconComponents';
import { useAppContext } from '../contexts/AppContext';

const LogViewer: React.FC = () => {
    const { logs } = useAppContext();
    const endOfLogsRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const getLogStyle = (level: LogLevel) => {
        switch(level) {
            case LogLevel.ERROR:
                return 'text-red-400';
            case LogLevel.WARN:
                return 'text-yellow-400';
            case LogLevel.SUCCESS:
                return 'text-green-400';
            case LogLevel.INFO:
            default:
                return 'text-gray-400';
        }
    };
    
    const getLogIcon = (level: LogLevel) => {
        switch(level) {
            case LogLevel.ERROR:
                return <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />;
            case LogLevel.SUCCESS:
                return <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />;
            case LogLevel.INFO:
            default:
                return <InfoIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />;
        }
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg font-mono text-xs h-full overflow-y-auto">
            {logs.length === 0 && <div className="text-gray-500 text-center py-10">No logs yet. Start a generation task to see logs here.</div>}
            {logs.map(log => (
                <div key={log.id} className={`flex items-start gap-3 mb-1 ${getLogStyle(log.level)}`}>
                    <span>{getLogIcon(log.level)}</span>
                    <span className="text-gray-500 whitespace-nowrap">{log.timestamp}</span>
                    <p className="flex-grow whitespace-pre-wrap break-words">{log.message}</p>
                </div>
            ))}
            <div ref={endOfLogsRef} />
        </div>
    );
};

export default LogViewer;
