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
/*
 * The four tab glyphs take a `filled` prop. A tab bar needs the selected item
 * to be unmistakable at a glance and at arm's length; a stroke icon that only
 * changes colour is not, on a light ground. Filled is the selected state, and
 * the pill behind it does the rest.
 */
type TabP = P & { filled?: boolean };

function Solid({ size = 22, className, children }: TabP & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      className={className} aria-hidden focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconHome = ({ filled = false, ...p }: TabP) =>
  filled ? (
    <Solid {...p}>
      <path d="M11.03 2.6a1.5 1.5 0 0 1 1.94 0l7.5 6.36c.34.29.53.71.53 1.15V19.5a2 2 0 0 1-2 2h-4.25v-5a1.5 1.5 0 0 0-1.5-1.5h-2.5a1.5 1.5 0 0 0-1.5 1.5v5H5a2 2 0 0 1-2-2v-9.39c0-.44.19-.86.53-1.15l7.5-6.36Z" />
    </Solid>
  ) : (
    <S {...p}>
      <path d="M3.5 10.1 12 3l8.5 7.1V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8.9Z" />
      <path d="M9.5 21v-5.5h5V21" />
    </S>
  );

/** Packs: a cluster, not a crowd. Four dots read as "a small named group". */
export const IconPacks = ({ filled = false, ...p }: TabP) =>
  filled ? (
    <Solid {...p}>
      <circle cx="12" cy="6" r="2.6" /><circle cx="5.8" cy="10.6" r="2.3" />
      <circle cx="18.2" cy="10.6" r="2.3" /><circle cx="8.6" cy="17.4" r="2.5" />
      <circle cx="15.4" cy="17.4" r="2.5" />
    </Solid>
  ) : (
    <S {...p} >
      <circle cx="12" cy="6" r="2.4" /><circle cx="5.8" cy="10.6" r="2.1" />
      <circle cx="18.2" cy="10.6" r="2.1" /><circle cx="8.6" cy="17.4" r="2.3" />
      <circle cx="15.4" cy="17.4" r="2.3" />
    </S>
  );

export const IconUser = ({ filled = false, ...p }: TabP) =>
  filled ? (
    <Solid {...p}>
      <path d="M12 2.4A9.6 9.6 0 1 0 12 21.6 9.6 9.6 0 0 0 12 2.4Zm0 4.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm0 13.2a7.4 7.4 0 0 1-5.1-2.05c.5-1.9 2.6-3.15 5.1-3.15s4.6 1.25 5.1 3.15A7.4 7.4 0 0 1 12 19.8Z" />
    </Solid>
  ) : (
    <S {...p}><circle cx="12" cy="12" r="9.2" /><circle cx="12" cy="9.8" r="3.2" /><path d="M6.6 18.6c.7-2.2 2.8-3.5 5.4-3.5s4.7 1.3 5.4 3.5" /></S>
  );

export const IconDevice = ({ filled = false, ...p }: TabP) =>
  filled ? (
    <Solid {...p}>
      <path d="M7.5 1.8h9A2.7 2.7 0 0 1 19.2 4.5v15A2.7 2.7 0 0 1 16.5 22.2h-9A2.7 2.7 0 0 1 4.8 19.5v-15A2.7 2.7 0 0 1 7.5 1.8Zm2.6 16.4a.9.9 0 0 0 0 1.8h3.8a.9.9 0 0 0 0-1.8h-3.8Z" />
    </Solid>
  ) : (
    <S {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></S>
  );
export const IconMarket = (p: P) => (
  <S {...p}><path d="M4 9.5 5.5 5h13L20 9.5" /><path d="M4 9.5a2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0 2.6 2.6 0 0 0 4 0" /><path d="M5.5 11.5V19h13v-7.5" /><path d="M10 19v-4h4v4" /></S>
);
export const IconSearch = (p: P) => (
  <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></S>
);
export const IconBookmark = ({ filled = false, ...p }: P & { filled?: boolean }) => (
  <svg
    width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    className={p.className} aria-hidden focusable="false"
  >
    <path d="M6.5 4.5h11a1 1 0 0 1 1 1V20l-6.5-4-6.5 4V5.5a1 1 0 0 1 1-1Z" />
  </svg>
);

/* -------------------------------------------------------- platform marks */
/* Filled brand silhouettes rather than 1.7-stroke line art: at 16px a stroked
   Android head is mush, and these two are read as logos, not as icons. */

export const IconAndroid = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
    <path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.7-.4l-1.86 3.23a11.4 11.4 0 0 0-9.76 0L5.26 5.9a.4.4 0 1 0-.7.4L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52M7 15.25a1 1 0 1 1 1-1 1 1 0 0 1-1 1m10 0a1 1 0 1 1 1-1 1 1 0 0 1-1 1" />
  </svg>
);

export const IconApple = ({ size = 18, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);
