import * as React from 'react';
import type { MenuItem } from '../navigation/Menu';
/** Top bar: branch switcher (with timezone), global search, language toggle, alerts bell with count, user menu. */
export interface Branch { id: string; name: string; tz?: string }
export interface AppHeaderProps { branches?: Branch[]; branch?: string; onBranchChange?: (id: string) => void; lang?: 'en' | 'ar'; onLangToggle?: () => void; alerts?: number; onAlerts?: () => void; user?: { name: string; role?: string; image?: string }; userMenu?: MenuItem[]; searchPlaceholder?: string; onSearch?: (q: string) => void; /** mobile hamburger */ onMenu?: () => void; showSearch?: boolean; style?: React.CSSProperties }
export declare function AppHeader(props: AppHeaderProps): JSX.Element;
export interface BranchSwitcherProps { branches: Branch[]; value?: string; onChange?: (id: string) => void; lang?: 'en' | 'ar' }
export declare function BranchSwitcher(props: BranchSwitcherProps): JSX.Element;
