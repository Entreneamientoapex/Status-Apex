import React from "react";

interface ApexMonogramProps {
  className?: string;
  size?: number | string;
}

export const ApexMonogram: React.FC<ApexMonogramProps> = ({
  className = "w-6 h-6 sm:w-7 sm:h-7",
  size,
}) => {
  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
      aria-label="Apex Monograma"
    >
      <defs>
        {/* Main Brand Color Diagonal Gradient */}
        <linearGradient
          id="apexBrandGradient"
          x1="12%"
          y1="8%"
          x2="88%"
          y2="92%"
        >
          <stop offset="0%" stopColor="#F96D00" />
          <stop offset="28%" stopColor="#F59E0B" />
          <stop offset="56%" stopColor="#48BB78" />
          <stop offset="80%" stopColor="#00B8D9" />
          <stop offset="100%" stopColor="#00C7F7" />
        </linearGradient>

        {/* Subtle Warm Core Radial Fill matching original monogram asset */}
        <radialGradient
          id="apexWarmCore"
          cx="48%"
          cy="42%"
          r="48%"
          fx="48%"
          fy="42%"
        >
          <stop offset="0%" stopColor="#FB8C00" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Circular Monogram with Transparent Surroundings */}
      <circle cx="500" cy="500" r="496" fill="url(#apexBrandGradient)" />
      <circle cx="500" cy="500" r="496" fill="url(#apexWarmCore)" />

      {/* Official White 'a' Monogram Glyph */}
      <path
        d="M 570 710 C 430 710 252 615 252 460 C 252 305 378 196 525 196 C 655 196 738 290 738 435 L 738 720"
        stroke="#FFFFFF"
        strokeWidth="114"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
