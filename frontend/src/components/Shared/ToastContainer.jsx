import React from 'react';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md cursor-pointer transition-all animate-fade-in
            ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : ''}
            ${toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : ''}
            ${toast.type === 'info' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : ''}
          `}
          onClick={() => onDismiss(toast.id)}
        >
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertTriangle size={18} />}
          {toast.type === 'info' && <RefreshCw size={18} />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
