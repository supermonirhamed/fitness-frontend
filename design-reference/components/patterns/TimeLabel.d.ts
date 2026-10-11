import * as React from 'react';
/** Time (or range) with optional zone badge, e.g. "18:00 AST". Show the zone whenever "All branches" is selected. Always LTR-isolated. */
export interface TimeLabelProps { time: string; end?: string; zone?: string; showZone?: boolean; date?: string; strong?: boolean; style?: React.CSSProperties }
export declare function TimeLabel(props: TimeLabelProps): JSX.Element;
