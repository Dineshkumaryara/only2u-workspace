'use client';

import Link from 'next/link';
import { Ghost, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-100 bg-background flex flex-col items-center justify-center px-4 animate-in fade-in duration-500 overflow-hidden">
      <div className="relative w-full max-w-lg flex flex-col items-center">
        
        <div className="p-10 flex flex-col items-center max-w-lg w-full text-center relative z-10 ">
          <div className="w-24 h-24 bg-card-bg border border-card-border rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-in-out"></div>
            <Ghost className="w-12 h-12 text-primary relative z-10" />
          </div>
          
          <h1 className="text-6xl font-extrabold text-foreground mb-2 tracking-tight">
            404
          </h1>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Page Not Found
          </h2>
          <p className="text-foreground/60 mb-8 max-w-sm">
            The page you are looking for seems to have vanished into the digital void. Let's get you back on track.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Link 
              href="/" 
              className="flex-1 flex items-center justify-center py-3 px-6 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25 group"
            >
              <Home className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Go Home
            </Link>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') window.history.back();
              }}
              className="flex-1 flex items-center justify-center py-3 px-6 rounded-xl bg-card-bg text-foreground border border-card-border font-semibold hover:bg-input-bg transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
