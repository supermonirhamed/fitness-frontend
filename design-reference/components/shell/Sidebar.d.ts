import * as React from 'react';
/**
 * Start-side navigation (right in Arabic, left in English), collapsible, items filtered by permission.
 * @startingPoint section="App shell" subtitle="Permission-aware collapsible sidebar" viewport="700x520"
 */
export interface NavItem { key: string; icon: string; en: string; ar: string }
export interface SidebarProps { active?: string; onNavigate?: (key: string) => void; items?: NavItem[]; /** keys the user may see */ allowed?: string[]; lang?: 'en' | 'ar'; collapsed?: boolean; onToggle?: () => void; orgName?: string; orgLogo?: string; counts?: Record<string, number>; style?: React.CSSProperties }
export declare function Sidebar(props: SidebarProps): JSX.Element;
