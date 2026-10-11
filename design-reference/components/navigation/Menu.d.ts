import * as React from 'react';
/** Menu / TieredMenu panel — "More" actions, user menu. Items with `items` open a submenu (TieredMenu). */
export interface MenuItem { label?: string; icon?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; hint?: string; shortcut?: string; separator?: boolean; group?: string; items?: MenuItem[] }
export interface MenuProps { items: MenuItem[]; style?: React.CSSProperties }
export declare function Menu(props: MenuProps): JSX.Element;
