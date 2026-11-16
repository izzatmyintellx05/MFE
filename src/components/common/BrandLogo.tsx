import React, { useState } from 'react';

/**
 * Doka & MFE brand lockup.
 *
 * Follows the MFE brand guide safe zone: the logo keeps a clear space of
 * ½X on every side, where X is the height of the MFE icon (the framed
 * building mark). In the rectangle artwork the icon is 59px tall in a
 * 111px tall image, so X = 0.53 × logo height. The clear space is built
 * into this component as padding, so nothing placed next to it (borders,
 * buttons, the subtitle) can sit inside the safe zone.
 */

const LOGO_SRC = '/brand/doka-mfe-logo.png';
const LOGO_ASPECT = 694 / 111; // width / height of the rectangle artwork
const ICON_HEIGHT_RATIO = 59 / 111; // X / logo height
const MFE_BLUE = '#144884';

const SIZES = {
  sm: 24,
  md: 32,
  lg: 48,
} as const;

interface BrandLogoProps {
  size?: keyof typeof SIZES;
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const height = SIZES[size];
  const width = Math.round(height * LOGO_ASPECT);
  const clearSpace = Math.ceil((height * ICON_HEIGHT_RATIO) / 2); // ½X
  const subtitleSize = Math.max(9, Math.round(height * 0.3));

  return (
    <div
      className={`inline-flex flex-col flex-shrink-0 ${className}`}
      style={{ padding: clearSpace }}
    >
      {!imageError ? (
        <img
          src={LOGO_SRC}
          alt="Doka and MFE"
          width={width}
          height={height}
          onError={() => setImageError(true)}
          style={{ width, height }}
          className="block max-w-none select-none"
          draggable={false}
        />
      ) : (
        <div className="flex items-stretch" style={{ height, width, gap: Math.round(height * 0.36) }}>
          <div className="flex-[370] flex items-center justify-center bg-[#FFDD00] text-[#144884] font-black italic">
            <span style={{ fontSize: height * 0.45 }} className="leading-none tracking-tighter">doka</span>
          </div>
          <div className="flex-[285] flex items-center justify-center bg-[#144884] text-[#E3E0D9] font-extrabold">
            <span style={{ fontSize: height * 0.45 }} className="leading-none tracking-tight">MFE</span>
          </div>
        </div>
      )}

      {showSubtitle && (
        <span
          className="self-end font-semibold leading-none tracking-tight select-none font-sans whitespace-nowrap"
          style={{ marginTop: clearSpace, fontSize: subtitleSize, color: MFE_BLUE }}
        >
          A company of Doka
        </span>
      )}
    </div>
  );
};
