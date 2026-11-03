'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Wifi, Monitor, Clock, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DisplayTestPage() {
  const [latency, setLatency] = React.useState<number | null>(null);
  const [sseConnected, setSseConnected] = React.useState<boolean>(false);
  const [resolution, setResolution] = React.useState<string>('');
  const [aspectRatio, setAspectRatio] = React.useState<string>('');
  const [orientation, setOrientation] = React.useState<string>('');
  const [wakeLockSupported, setWakeLockSupported] = React.useState<boolean>(false);
  const [healthInfo, setHealthInfo] = React.useState<any>(null);

  React.useEffect(() => {
    // Screen stats
    const updateDimensions = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setResolution(`${w} x ${h} px`);
      setOrientation(w >= h ? 'Landscape (Horizontal)' : 'Portrait (Vertical)');
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(w, h);
      setAspectRatio(`${Math.round(w / divisor)}:${Math.round(h / divisor)}`);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Wake Lock check
    setWakeLockSupported('wakeLock' in navigator);

    // SSE test
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
    } catch (e) {
      setSseConnected(false);
    }

    // Ping test
    const pingServer = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/health');
        const t1 = performance.now();
        setLatency(Math.round(t1 - t0));
        if (res.ok) {
          const data = await res.json();
          setHealthInfo(data);
        }
      } catch (e) {
        setLatency(-1);
      }
    };
    pingServer();

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (es) es.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-corporate-navy text-white p-6 sm:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-300">
              Media Player Diagnostics
            </span>
            <h1 className="text-3xl font-black text-white mt-1">
              Display Screen Diagnostic &amp; Test Utility
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Verify screen resolution, websocket/SSE latency, and server connectivity.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/20">
              Back to Admin
            </Button>
          </Link>
        </div>

        {/* Diagnostic Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Server Connection</span>
              <Wifi className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {latency !== null && latency >= 0 ? `${latency} ms` : 'Disconnected'}
            </div>
            <p className="text-xs text-teal-300 mt-1 font-mono">Target: 192.168.50.143</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Realtime SSE Push</span>
              <Cpu className="w-4 h-4 text-teal-300" />
            </div>
            <div className="flex items-center gap-2 text-2xl font-black text-white">
              <span
                className={`w-3 h-3 rounded-full ${
                  sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{sseConnected ? 'Connected' : 'Offline'}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Subscribed to event stream</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Display Resolution</span>
              <Monitor className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-2xl font-black font-mono text-white">{resolution}</div>
            <p className="text-xs text-slate-400 mt-1">
              {orientation} • Ratio {aspectRatio}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Wake Lock API</span>
              <Clock className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-xl font-bold text-white">
              {wakeLockSupported ? (
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" /> Supported
                </span>
              ) : (
                <span className="text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-5 h-5" /> Fallback Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Keeps tablet screen permanently awake</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Server Time (Dubai)</span>
              <Clock className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {healthInfo?.currentTimeDubai || 'Loading...'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Asia/Dubai (UTC+4)</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-5 rounded-sm">
            <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
              <span>Server Node Uptime</span>
              <Cpu className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {healthInfo?.uptime ? `${Math.round(healthInfo.uptime)} seconds` : '0 s'}
            </div>
            <p className="text-xs text-slate-400 mt-1">Local Windows Server Process</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
            Test Dedicated Display URLs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Link
              href="/display/11111111-1111-1111-1111-111111111111"
              target="_blank"
              className="p-3 bg-white/5 hover:bg-white/10 rounded-sm border border-white/10 flex items-center justify-between"
            >
              <span className="font-bold">Meeting Room 1 Display</span>
              <span className="font-mono text-teal-300">/display/room-1</span>
            </Link>
            <Link
              href="/display/lobby"
              target="_blank"
              className="p-3 bg-white/5 hover:bg-white/10 rounded-sm border border-white/10 flex items-center justify-between"
            >
              <span className="font-bold">Reception Lobby Board</span>
              <span className="font-mono text-teal-300">/display/lobby</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
