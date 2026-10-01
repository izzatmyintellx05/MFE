import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  setZoom: (val: number | ((prev: number) => number)) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  setZoom,
  min = 70,
  max = 140,
  step = 5,
}) => {
  const handleZoomIn = () => setZoom((prev) => Math.min(max, prev + step));
  const handleZoomOut = () => setZoom((prev) => Math.max(min, prev - step));
  const handleReset = () => setZoom(100);

  return (
    <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200 p-0.5 rounded-lg shadow-sm">
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={zoom <= min}
        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-white disabled:opacity-25 transition cursor-pointer"
        title="Zoom Out (-)"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <span
        onClick={handleReset}
        className="w-11 text-center font-mono text-[11px] font-bold tabular-nums text-slate-700 cursor-pointer hover:text-slate-950 transition select-none"
        title="Reset Zoom to 100%"
      >
        {zoom}%
      </span>

      <button
        type="button"
        onClick={handleZoomIn}
        disabled={zoom >= max}
        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-white disabled:opacity-25 transition cursor-pointer"
        title="Zoom In (+)"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handleReset}
        className="p-1 rounded text-slate-300 hover:text-slate-700 hover:bg-white transition cursor-pointer border-l border-slate-200 ml-0.5"
        title="Reset 100%"
      >
        <RotateCcw className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};