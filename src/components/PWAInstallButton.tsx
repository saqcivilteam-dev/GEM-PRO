import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, MonitorDown, X, Smartphone, Check } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'compact' | 'prominent';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already installed and running as standalone app, hide the button
  if (isInstalled && !justInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 3000);
    }
  };

  if (justInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 text-xs font-semibold">
        <Check className="w-3.5 h-3.5" />
        <span>Installed Locally!</span>
      </div>
    );
  }

  // Chromium / Desktop / Android flow
  if (isInstallable) {
    if (variant === 'prominent') {
      return (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-950/60 transition-all cursor-pointer active:scale-95 ${className}`}
        >
          <MonitorDown className="w-4 h-4" />
          <span>Install Local Desktop App</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-sky-950/70 hover:bg-sky-900 border border-sky-700/60 text-sky-200 hover:text-white transition-colors cursor-pointer shadow-xs ${className}`}
        title="Install GEM PRO as a local standalone desktop application (works offline)"
      >
        <MonitorDown className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer ${className}`}
          title="Install on iPhone / iPad home screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Add to Home</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-300">
                <p>To use this application offline like a native app on your iOS device:</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-200 font-medium">
                  <li>
                    Tap the <strong className="text-sky-300">Share</strong> button (box with upward arrow) in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-emerald-300">Add to Home Screen</strong>.
                  </li>
                  <li>Tap <strong className="text-sky-300">Add</strong> in the top right corner.</li>
                </ol>
                <p className="text-[11px] text-slate-400">
                  The app icon will appear on your home screen and open in full-screen standalone mode.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
