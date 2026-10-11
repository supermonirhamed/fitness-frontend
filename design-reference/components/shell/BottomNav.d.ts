import * as React from 'react';
/** Mobile bottom navigation for Reception / Coach: Today, Calendar, Check-in, Clients, More. */
export interface BottomNavItem { key: string; icon: string; en: string; ar: string }
export interface BottomNavProps { active?: string; onNavigate?: (key: string) => void; items?: BottomNavItem[]; lang?: 'en' | 'ar'; style?: React.CSSProperties }
export declare function BottomNav(props: BottomNavProps): JSX.Element;
