import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  X,
  Check,
  Copy,
  Maximize2,
  ScanEye,
  AlertCircle,
  ArrowUpRight,
  Layers,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Monitor,
  Smartphone,
  RefreshCw,
} from 'lucide-react';

// Reads the backend URL securely from .env (local) or Render Environment Variables (production)
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const getImageMetadata = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewUrl: url,
      });
    };
    img.onerror = () => {
      resolve({ width: null, height: null, previewUrl: url });
    };
    img.src = url;
  });

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [apiError, setApiError] = useState(null);

  const [screenshots, setScreenshots] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportTarget, setViewportTarget] = useState('desktop');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [auditResult, setAuditResult] = useState(null);
  const [checkedFixes, setCheckedFixes] = useState({});
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const fileInputRef = useRef(null);

  // Check backend health silently on load or manual retry
  const checkEngineHealth = useCallback(async () => {
    if (!API_BASE_URL) {
      setApiStatus('offline');
      return;
    }

    setApiStatus('checking');
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      setApiStatus(res.ok ? 'connected' : 'offline');
    } catch {
      setApiStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkEngineHealth();
  }, [checkEngineHealth]);

  const processFiles = async (fileList) => {
    const validImages = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) return;

    const enriched = await Promise.all(
      validImages.map(async (file) => {
        const meta = await getImageMetadata(file);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: formatBytes(file.size),
          width: meta.width,
          height: meta.height,
          previewUrl: meta.previewUrl,
        };
      })
    );

    setScreenshots((prev) => [...prev, ...enriched]);
    setAuditResult(null);
    setCheckedFixes({});
    setApiError(null);
  };

  const handleFileChange = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const removeScreenshot = (id) => {
    setScreenshots((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearAll = () => {
    screenshots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setScreenshots([]);
    setAuditResult(null);
    setCheckedFixes({});
    setApiError(null);
  };

  const handleRunAudit = async () => {
    if (screenshots.length === 0) return;

    if (!API_BASE_URL) {
      setApiError('Inference endpoint is not configured in the deployment environment.');
      return;
    }

    setIsAnalyzing(true);
    setAuditResult(null);
    setCheckedFixes({});
    setApiError(null);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 1800);

    try {
      const formData = new FormData();
      screenshots.forEach((shot) => {
        formData.append('files', shot.file);
      });
      formData.append('viewport', viewportTarget);

      const response = await fetch(`${API_BASE_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Verification service returned status ${response.status}.`);
      }

      const data = await response.json();
      setAuditResult(data);
      setApiStatus('connected');
    } catch {
      setApiStatus('offline');
      setApiError(
        'The GPU inference service is currently offline or unreachable. Please try again once the backend server is active.'
      );
    } finally {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
    }
  };

  const toggleFix = (idx) => {
    setCheckedFixes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopyMarkdown = () => {
    if (!auditResult) return;
    const md = [
      `# UI Design Audit Report — ${auditResult.score}/10 (${auditResult.status})`,
      `> ${auditResult.verdict}`,
      `\n## Design Flaws`,
      ...(auditResult.flaws || []).map(
        (f) => `- **[${f.severity}] ${f.category}** (${f.screen}): ${f.detail}`
      ),
      `\n## Recommended Fixes`,
      ...(auditResult.suggestions || []).map(
        (s, i) => `${i + 1}. **${s.title}** — ${s.fix}`
      ),
    ].join('\n');

    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const isPass = auditResult?.score >= 7;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = auditResult
    ? circumference - (auditResult.score / 10) * circumference
    : circumference;

  const loadingMessages = [
    'Uploading viewport captures to GPU inference node...',
    'Slicing screenshots into 28×28 Qwen2-VL vision patches...',
    'Evaluating WCAG contrast, alignment & cross-page tokens...',
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 antialiased selection:bg-zinc-100 selection:text-zinc-950">
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#09090B]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-xs tracking-tighter">
              UI
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                Sightline Studio
              </span>
              <span className="text-zinc-600 hidden sm:inline">/</span>
              <span className="text-xs text-zinc-400 hidden sm:inline">
                Qwen2-VL-2B Verifier
              </span>
            </div>
          </div>

          {/* Clean Production Engine Status Badge (No exposed URL) */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 h-8 rounded-md bg-zinc-900 border border-white/[0.08] text-[11px] font-mono text-zinc-300"
              title="Vision-Language Inference Engine Status"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'connected'
                  ? 'bg-emerald-400'
                  : apiStatus === 'checking'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
                  }`}
              />
              <span>
                {apiStatus === 'connected'
                  ? 'Inference Online'
                  : apiStatus === 'checking'
                    ? 'Connecting...'
                    : 'Inference Offline'}
              </span>
            </div>

            {apiStatus === 'offline' && (
              <button
                type="button"
                onClick={checkEngineHealth}
                className="p-2 h-8 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Retry backend connection"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Split Workbench */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT RAIL: Capture & Queue */}
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-xl bg-zinc-900/40 border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-zinc-100">Viewport Captures</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Upload 2+ pages to audit cross-screen visual consistency
                </p>
              </div>

              <div className="flex items-center p-0.5 rounded-lg bg-zinc-950 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setViewportTarget('desktop')}
                  className={`p-1.5 rounded-md transition-colors ${viewportTarget === 'desktop'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  title="Desktop Viewport Audit"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportTarget('mobile')}
                  className={`p-1.5 rounded-md transition-colors ${viewportTarget === 'mobile'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  title="Mobile Viewport Audit"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
              className={`relative rounded-lg border transition-all cursor-pointer py-9 px-6 flex flex-col items-center justify-center text-center ${isDragging
                ? 'border-zinc-300 bg-zinc-800/40'
                : 'border-dashed border-zinc-700/80 hover:border-zinc-500 bg-zinc-950/70'
                }`}
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-300 mb-3">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-zinc-200">
                Drop website screenshots here, or{' '}
                <span className="underline underline-offset-4 text-white">browse files</span>
              </p>
              <p className="text-[11px] font-mono text-zinc-500 mt-1.5">
                PNG · JPG · WEBP · Auto-scaled to 1120px max edge
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Queued Screenshots List */}
            {screenshots.length > 0 && (
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>QUEUED SCREENS ({screenshots.length})</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {screenshots.map((shot, idx) => (
                    <div
                      key={shot.id}
                      className="group flex items-center gap-3 p-2 rounded-lg bg-zinc-950/90 border border-white/[0.06] hover:border-white/[0.14] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setLightboxImage(shot)}
                        className="relative w-16 h-11 rounded overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/[0.06]"
                        title="Inspect full screenshot"
                      >
                        <img
                          src={shot.previewUrl}
                          alt={shot.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </div>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-500">
                            0{idx + 1}
                          </span>
                          <p className="text-xs font-medium text-zinc-200 truncate">
                            {shot.name}
                          </p>
                        </div>
                        <p className="text-[11px] font-mono text-zinc-500 mt-0.5 tabular-nums">
                          {shot.width && shot.height
                            ? `${shot.width}×${shot.height}px`
                            : 'Image'}{' '}
                          · {shot.size}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeScreenshot(shot.id)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                        title="Remove screen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {apiError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 leading-relaxed">
                {apiError}
              </div>
            )}

            <button
              type="button"
              onClick={handleRunAudit}
              disabled={screenshots.length === 0 || isAnalyzing}
              className="mt-5 w-full h-10 px-4 rounded-lg text-xs font-semibold tracking-tight flex items-center justify-center gap-2 bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border disabled:border-white/[0.06] transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  Running GPU Inference...
                </>
              ) : (
                <>
                  <ScanEye className="w-4 h-4" />
                  Run Design Verification ({screenshots.length})
                </>
              )}
            </button>
          </div>

          <div className="px-1 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>PASS THRESHOLD: ≥ 7.0 / 10</span>
            <span>QWEN2-VL VISION ENGINE</span>
          </div>
        </section>

        {/* RIGHT CANVAS: Audit Diagnostic Output */}
        <section className="lg:col-span-7">
          {!auditResult && !isAnalyzing && (
            <div className="rounded-xl border border-white/[0.08] bg-zinc-900/20 p-10 min-h-[460px] flex flex-col items-center justify-center text-center">
              <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-zinc-200">
                Awaiting Viewport Captures
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1.5 leading-relaxed">
                Upload website screenshots on the left and run a live vision-language design audit powered by Qwen2-VL.
              </p>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg text-left">
                {[
                  { title: 'Contrast', desc: 'WCAG AA legibility' },
                  { title: 'Alignment', desc: 'Axis & grid rails' },
                  { title: 'Spacing', desc: '8pt vertical rhythm' },
                  { title: 'Consistency', desc: 'Cross-page tokens' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="p-3 rounded-lg bg-zinc-950/80 border border-white/[0.06]"
                  >
                    <p className="text-xs font-medium text-zinc-300">{item.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="rounded-xl border border-white/[0.08] bg-zinc-900/30 p-10 min-h-[460px] flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-100 rounded-full animate-spin mb-5" />
              <p className="text-sm font-medium text-zinc-200">
                Auditing {screenshots.length} Viewport Capture{screenshots.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs font-mono text-zinc-400 mt-2">
                {loadingMessages[analysisStep]}
              </p>
            </div>
          )}

          {auditResult && (
            <div className="space-y-5">
              <div className="rounded-xl bg-zinc-900/50 border border-white/[0.08] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          fill="transparent"
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth="5"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r={radius}
                          fill="transparent"
                          stroke={isPass ? '#10B981' : '#F43F5E'}
                          strokeWidth="5"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold tracking-tight tabular-nums text-zinc-100">
                          {auditResult.score.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">/ 10</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5">
                        {isPass ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            FAIL · BELOW 7.0
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-zinc-500 uppercase">
                          {viewportTarget} audit
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed mt-2.5 max-w-xl">
                        {auditResult.verdict}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyMarkdown}
                    className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-white/[0.08] transition-colors flex-shrink-0 cursor-pointer"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Export MD
                      </>
                    )}
                  </button>
                </div>

                {auditResult.metrics && auditResult.metrics.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {auditResult.metrics.map((m) => (
                      <div key={m.label}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-zinc-400">{m.label}</span>
                          <span className="font-mono text-zinc-200 tabular-nums">
                            {Number(m.score).toFixed(1)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.score >= 7 ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                            style={{ width: `${(m.score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnostic Flaws Breakdown */}
              <div className="rounded-xl bg-zinc-900/40 border border-white/[0.08] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-medium text-zinc-100">
                      Detected Design Flaws ({(auditResult.flaws || []).length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    ORDERED BY IMPACT
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(auditResult.flaws || []).map((flaw, idx) => {
                    const severityStyle =
                      flaw.severity === 'Critical'
                        ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        : flaw.severity === 'Major'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-zinc-300 bg-zinc-800 border-zinc-700';

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-lg bg-zinc-950/90 border border-white/[0.06] flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${severityStyle}`}
                            >
                              {flaw.severity}
                            </span>
                            <span className="text-xs font-semibold text-zinc-200">
                              {flaw.category}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[180px]">
                            {flaw.screen}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {flaw.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable Remediation Checklist */}
              <div className="rounded-xl bg-zinc-900/40 border border-white/[0.08] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-zinc-300" />
                    <h3 className="text-sm font-medium text-zinc-100">
                      Actionable Remediation Plan
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {Object.values(checkedFixes).filter(Boolean).length}/
                    {(auditResult.suggestions || []).length} RESOLVED
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(auditResult.suggestions || []).map((item, idx) => {
                    const isDone = !!checkedFixes[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleFix(idx)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer flex items-start gap-3.5 ${isDone
                          ? 'bg-zinc-950/40 border-white/[0.04] opacity-60'
                          : 'bg-zinc-950/90 border-white/[0.06] hover:border-white/[0.14]'
                          }`}
                      >
                        <button
                          type="button"
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${isDone
                            ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                            : 'border-zinc-600 bg-zinc-900'
                            }`}
                        >
                          {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>

                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-xs font-medium ${isDone ? 'line-through text-zinc-500' : 'text-zinc-200'
                                }`}
                            >
                              {item.title}
                            </p>
                            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            {item.fix}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Full-Screen Screenshot Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-6 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full rounded-xl bg-zinc-950 border border-white/[0.12] overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-200">
                  {lightboxImage.name}
                </span>
                {lightboxImage.width && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {lightboxImage.width} × {lightboxImage.height}px · {lightboxImage.size}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-[#050506] p-4 flex justify-center">
              <img
                src={lightboxImage.previewUrl}
                alt={lightboxImage.name}
                className="max-w-full h-auto rounded border border-white/[0.06]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}