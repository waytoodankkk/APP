import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { CheckCircleIcon, XCircleIcon, InfoIcon } from './IconComponents';

const ToastContainer: React.FC = () => {
  const { toasts } = useAppContext();

  const getIcon = (level: 'success' | 'error' | 'info') => {
    switch (level) {
      case 'success':
        return <CheckCircleIcon className="w-6 h-6 text-green-400" />;
      case 'error':
        return <XCircleIcon className="w-6 h-6 text-red-400" />;
      case 'info':
        return <InfoIcon className="w-6 h-6 text-blue-400" />;
    }
  };
  
  const getBorderColor = (level: 'success' | 'error' | 'info') => {
    switch (level) {
      case 'success': return 'border-green-500';
      case 'error': return 'border-red-500';
      case 'info': return 'border-blue-500';
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-4 w-full max-w-sm p-4 bg-gray-800 border-l-4 ${getBorderColor(toast.level)} rounded-lg shadow-lg animate-fade-in-up`}
          role="alert"
        >
          <div>{getIcon(toast.level)}</div>
          <div className="text-sm font-normal text-gray-300">{toast.message}</div>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
