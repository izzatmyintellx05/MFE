import React, { useState } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Dimensions based on size
  const heightClass = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-12' : 'h-9';

  return (
    <div className={`flex flex-col items-start ${className}`}>
      {!imageError ? (
        <img
          src="/doka-mfe-logo.png"
          alt="Doka & MFE - A company of Doka"
          onError={() => setImageError(true)}
          className={`${heightClass} object-contain transition-transform`}
        />
      ) : (
        /* Crisp High-Res Vector Fallback matching the Doka & MFE dual-insignia */
        <div className="flex items-center gap-1.5">
          {/* Doka Yellow Box */}
          <div className="flex flex-col items-center justify-center bg-[#FFDA00] text-[#002F6C] font-black px-2 py-1 rounded-sm shadow-sm border border-[#E6C400]">
            <span className="text-[11px] leading-none tracking-tighter uppercase italic">
              doka
            </span>
          </div>

          {/* MFE Deep Cobalt Blue Box */}
          <div className="flex flex-col items-center justify-center bg-[#004B87] text-white font-extrabold px-2.5 py-1 rounded-sm shadow-sm border border-[#003B6B]">
            <span className="text-[11px] leading-none tracking-tight">MFE</span>
          </div>
        </div>
      )}

      {showSubtitle && (
        <span className="text-[9px] font-semibold text-[#004B87] tracking-tight mt-0.5 select-none font-sans">
          A company of Doka
        </span>
      )}
    </div>
  );
};