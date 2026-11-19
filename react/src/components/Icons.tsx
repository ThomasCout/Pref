import type { ReactNode } from 'react';
const Svg = ({ d, w = 18, sw = 1.8, fill }: { d: ReactNode; w?: number; sw?: number; fill?: string }) => (
  <svg aria-hidden="true" width={w} height={w} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const IcSort = () => <Svg d={<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />} />;
export const IcSearch = () => <Svg w={20} d={<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>} />;
export const IcCheck = ({ w = 14 }: { w?: number }) => <Svg w={w} sw={2.4} d={<path d="m5 12.5 4.5 4.5L19 7" />} />;
export const IcBack = () => <Svg d={<path d="m15 6-6 6 6 6" />} />;
export const IcCircle = () => <Svg w={22} d={<circle cx="12" cy="12" r="7" />} />;
export const IcUsers = () => <Svg d={<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.1" /></>} />;
export const IcPlus = () => <Svg w={26} sw={2.2} d={<path d="M12 5v14M5 12h14" />} />;
export const IcEdit = () => <Svg w={24} sw={2.1} d={<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />} />;
export const IcCam = () => <Svg w={26} sw={2} d={<><path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.4" /></>} />;
export const IcGal = () => <Svg w={24} sw={2} d={<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" /></>} />;
export const IcFlip = () => <Svg w={24} sw={2} d={<path d="M20 12a8 8 0 0 0-14-5.3L4 9M4 4v5h5M4 12a8 8 0 0 0 14 5.3L20 15M20 20v-5h-5" />} />;
export const IcX = ({ w = 20 }: { w?: number }) => <Svg w={w} sw={2.4} d={<path d="M6 6l12 12M18 6L6 18" />} />;
export const IcPause = () => <Svg w={22} sw={2.6} d={<path d="M8 5v14M16 5v14" />} />;
export const IcPlay = ({ w = 22 }: { w?: number }) => <Svg w={w} d={<path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.5-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" />} />;
export const IcAlbum = () => <Svg w={24} d={<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></>} />;
export const IcChevron = () => <Svg w={20} d={<path d="m9 6 6 6-6 6" />} />;
export const NAV_ICONS: Record<string, ReactNode> = {
  registre: <Svg w={22} d={<path d="M4 6h16M4 12h16M4 18h10" />} />,
  carte: <Svg w={22} d={<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />} />,
  dossier: <Svg w={22} d={<><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6.5 16c.5-1.5 4.5-1.5 5 0M14 10h4M14 14h4" /></>} />,
  reglages: <Svg w={22} d={<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>} />
};
