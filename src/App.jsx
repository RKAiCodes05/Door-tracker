import React from 'react';

export default function App() {
  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-8 z-10">
        {/* Subtle Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium tracking-wide text-sky-400">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          SYSTEM INITIATING
        </div>

        {/* User-Requested Header */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
          Door Tracker Core System Loading...
        </h1>

        {/* Sleek Progress Indicator */}
        <div className="space-y-3">
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
            <div className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 rounded-full w-3/4 animate-[pulse_1.5s_infinite]" />
          </div>
          <div className="flex justify-between text-[11px] font-mono tracking-wider text-slate-500">
            <span>SECURE LINK: SUPABASE_ONLINE</span>
            <span>75% LOADED</span>
          </div>
        </div>
      </div>
    </main>
  );
}