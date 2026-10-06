import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenButtonProps {
  /** The element shown full screen (e.g. the table card) */
  target: React.RefObject<HTMLElement | null>;
}

// Shows the target element full screen; Esc or the button again returns to the page
export const FullscreenButton: React.FC<FullscreenButtonProps> = ({ target }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === target.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [target]);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await target.current?.requestFullscreen();
    } catch {
      // full screen not allowed here (e.g. inside a frame): nothing to do
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
      title={isFullscreen ? 'Exit full screen (Esc)' : 'Show full screen'}
    >
      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-stone-500" /> : <Maximize2 className="w-3.5 h-3.5 text-stone-500" />}
      <span className="hidden xl:inline">{isFullscreen ? 'Exit' : 'Full screen'}</span>
    </button>
  );
};
