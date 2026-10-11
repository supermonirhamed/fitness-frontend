import * as React from 'react';
/** Anchored floating panel — session quick-facts on the calendar, filter popovers. */
export interface PopoverProps { trigger: React.ReactNode; children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'; width?: number | string; style?: React.CSSProperties }
export declare function Popover(props: PopoverProps): JSX.Element;
