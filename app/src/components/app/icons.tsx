/**
 * TESTERPOOL — inline icon set. No icon package: eight glyphs is not a dependency.
 * All icons are 24x24, 1.7 stroke, currentColor.
 */
import * as React from 'react';

type P = { size?: number; className?: string };

function S({ size = 18, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: P) => (
  <S {...p}><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></S>
);
export const IconTests = (p: P) => (
  <S {...p}><path d="M9 3h6v4l4.5 9.5A3 3 0 0 1 16.8 21H7.2a3 3 0 0 1-2.7-4.5L9 7V3Z" /><path d="M7.5 14h9" /></S>
);
export const IconPods = (p: P) => (
  <S {...p}><circle cx="12" cy="12" r="3" /><circle cx="12" cy="4" r="1.8" /><circle cx="12" cy="20" r="1.8" /><circle cx="4" cy="12" r="1.8" /><circle cx="20" cy="12" r="1.8" /></S>
);
export const IconFeedback = (p: P) => (
  <S {...p}><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /><path d="M9 11h6M9 14h4" /></S>
);
export const IconCredits = (p: P) => (
  <S {...p}><path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z" /><path d="M12 8v8M9.5 10h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4" /></S>
);
export const IconTrophy = (p: P) => (
  <S {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3" /><path d="M10 13v3h4v-3M8 20h8" /></S>
);
export const IconShield = (p: P) => (
  <S {...p}><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z" /><path d="M9.5 12l1.8 1.8L15 10" /></S>
);
export const IconUpload = (p: P) => (
  <S {...p}><path d="M12 16V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" /></S>
);
export const IconCheck = (p: P) => (
  <S {...p}><path d="m5 12.5 4.5 4.5L19 7" /></S>
);
export const IconCopy = (p: P) => (
  <S {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" /></S>
);
export const IconExternal = (p: P) => (
  <S {...p}><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 14v4.5A2.5 2.5 0 0 1 15.5 21h-9A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7H11" /></S>
);
export const IconAlert = (p: P) => (
  <S {...p}><path d="M12 4.5 21 19H3l9-14.5Z" /><path d="M12 10v4M12 16.5v.5" /></S>
);
export const IconPlus = (p: P) => (
  <S {...p}><path d="M12 5v14M5 12h14" /></S>
);
export const IconArrow = (p: P) => (
  <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>
);
export const IconMenu = (p: P) => (
  <S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>
);
export const IconInbox = (p: P) => (
  <S {...p}><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M5.5 5h13l1.5 8v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4l1.5-8Z" /></S>
);
export const IconUser = (p: P) => (
  <S {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></S>
);
