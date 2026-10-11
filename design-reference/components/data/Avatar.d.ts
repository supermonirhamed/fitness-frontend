import * as React from 'react';
/** Person photo or initials (deterministic tint from name). Works with Arabic names — first letters of first/last word. */
export interface AvatarProps { name?: string; image?: string; icon?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number; shape?: 'circle' | 'square'; /** status dot severity */ badge?: 'success' | 'warn' | 'danger' | 'info'; style?: React.CSSProperties }
export declare function Avatar(props: AvatarProps): JSX.Element;
