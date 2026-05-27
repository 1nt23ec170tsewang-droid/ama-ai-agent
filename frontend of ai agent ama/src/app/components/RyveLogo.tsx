import React from 'react';

const RyveLogo = ({ size = 40, variant = "dark" }: { size?: number; variant?: "dark" | "light" }) => {
  const bg = variant === "light" ? "#f0f0ea" : "#0d0d14";
  const coreFill = variant === "light" ? "#f0f0ea" : "#0d0d14";
  return (
    <svg width={size} height={size} viewBox="0 0 72 72"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="72" rx="16" fill={bg}
        stroke="#FF6B00" strokeWidth="1.5"/>
      <polygon points="36,6 60,19 60,45 36,58 12,45 12,19"
        fill="none" stroke="#FF6B00" strokeWidth="2"/>
      <circle cx="36" cy="32" r="9" fill="#FF6B00"/>
      <circle cx="36" cy="32" r="3.8" fill={coreFill}/>
      <circle cx="36" cy="6" r="3" fill="#FF6B00"/>
      <circle cx="60" cy="19" r="3" fill="#FF6B00"/>
      <circle cx="60" cy="45" r="3" fill="#FF6B00"/>
      <circle cx="36" cy="58" r="3" fill="#FF6B00"/>
      <circle cx="12" cy="45" r="3" fill="#FF6B00"/>
      <circle cx="12" cy="19" r="3" fill="#FF6B00"/>
      <line x1="36" y1="9" x2="36" y2="23"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
      <line x1="57" y1="21" x2="45" y2="27"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
      <line x1="57" y1="43" x2="45" y2="37"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
      <line x1="36" y1="55" x2="36" y2="41"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
      <line x1="15" y1="43" x2="27" y2="37"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
      <line x1="15" y1="21" x2="27" y2="27"
        stroke="#FF6B00" strokeWidth="1.2" opacity="0.7"/>
    </svg>
  );
};
export default RyveLogo;
