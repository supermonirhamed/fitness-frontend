import * as React from 'react';
/** Avatar + name + secondary line (member ID, role, "via {parent}"). */
export interface PersonChipProps { name: string; secondary?: React.ReactNode; image?: string; size?: 'sm' | 'md' | 'lg'; badge?: 'success' | 'warn' | 'danger' | 'info'; trailing?: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }
export declare function PersonChip(props: PersonChipProps): JSX.Element;
