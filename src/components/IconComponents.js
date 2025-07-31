// Icon Components for centralized SVG management
import React from 'react';

// TON Coin Icon - Official logo with customizable colors
export const TonIcon = ({ 
  size = 16, 
  className = '', 
  bgColor = '#0098EA', // Official TON blue
  iconColor = '#FFFFFF' // White for the inner design
}) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 56 56" 
    className={`ton-icon ${className}`}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    {/* Blue circular background */}
    <path 
      fill={bgColor} 
      d="M28,56c15.5,0,28-12.5,28-28S43.5,0,28,0S0,12.5,0,28S12.5,56,28,56z"
    />
    {/* White TON symbol */}
    <path 
      fill={iconColor} 
      d="M37.6,15.6H18.4c-3.5,0-5.7,3.8-4,6.9l11.8,20.5c0.8,1.3,2.7,1.3,3.5,0l11.8-20.5
        C43.3,19.4,41.1,15.6,37.6,15.6L37.6,15.6z M26.3,36.8l-2.6-5l-6.2-11.1c-0.4-0.7,0.1-1.6,1-1.6h7.8L26.3,36.8L26.3,36.8z
        M38.5,20.7l-6.2,11.1l-2.6,5V19.1h7.8C38.4,19.1,38.9,20,38.5,20.7z"
    />
  </svg>
);

// Slot Machine Icon
export const SlotMachineIcon = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    className={`slot-machine-icon ${className}`}
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
    <rect x="7" y="6" width="10" height="8" rx="1" ry="1"/>
    <circle cx="9" cy="10" r="1"/>
    <circle cx="12" cy="10" r="1"/>
    <circle cx="15" cy="10" r="1"/>
    <rect x="10" y="16" width="4" height="2" rx="1" ry="1"/>
    <path d="M20 8h2"/>
    <path d="M20 12h2"/>
  </svg>
);

// Crown Icon - Enhanced
export const CrownIcon = ({ size = 20, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={`crown-icon ${className}`}
  >
    <path d="M12 2L15 9L22 7L19 14H5L2 7L9 9L12 2Z"/>
    <rect x="3" y="14" width="18" height="2" rx="1"/>
    <circle cx="12" cy="6" r="1"/>
    <circle cx="8" cy="8" r="1"/>
    <circle cx="16" cy="8" r="1"/>
  </svg>
);

// Diamond Icon for premium features
export const DiamondIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={`diamond-icon ${className}`}
  >
    <path d="M6 3h12l4 6-10 12L2 9l4-6z"/>
    <path d="M6 3l6 9 6-9"/>
    <path d="M2 9h20"/>
  </svg>
);

// Fire Icon for hot streaks
export const FireIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={`fire-icon ${className}`}
  >
    <path d="M12 2C8 6 8 12 12 12C16 12 16 6 12 2Z"/>
    <path d="M8 14C8 18 10 22 12 22S16 18 16 14C16 10 14 8 12 8S8 10 8 14Z"/>
  </svg>
);

// Lightning Icon for fast transactions
export const LightningIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={`lightning-icon ${className}`}
  >
    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
  </svg>
);

// Star Icon for ratings/favorites
export const StarIcon = ({ size = 16, className = '', filled = false }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor" 
    strokeWidth="2"
    className={`star-icon ${className}`}
  >
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
  </svg>
);

// Target Icon for predetermined winners
export const TargetIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    className={`target-icon ${className}`}
  >
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

// Trophy Icon - Enhanced
export const TrophyIcon = ({ size = 24, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    className={`trophy-icon ${className}`}
  >
    <path d="M7 8h10v8a3 3 0 01-3 3h-4a3 3 0 01-3-3V8z"/>
    <path d="M17 8h2a2 2 0 012 2v2a2 2 0 01-2 2h-2"/>
    <path d="M7 8H5a2 2 0 00-2 2v2a2 2 0 002 2h2"/>
    <rect x="8" y="19" width="8" height="2" rx="1"/>
    <rect x="10" y="21" width="4" height="2" rx="1"/>
  </svg>
);

// Trending Up Icon for winning streaks
export const TrendingUpIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    className={`trending-up-icon ${className}`}
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

// Shield Icon for security/verified
export const ShieldIcon = ({ size = 16, className = '' }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    className={`shield-icon ${className}`}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9,12 11,14 15,10"/>
  </svg>
); 