import * as React from 'react';
/**
 * "12 / 15" with a bar — available (green), ≥80% (amber), Full (red), Full + waitlist "+3", Cancelled (grey). US-03.15.
 * @startingPoint section="Patterns" subtitle="Capacity states for sessions" viewport="700x200"
 */
export interface CapacityIndicatorProps { booked: number; capacity: number; waitlist?: number; cancelled?: boolean; size?: 'sm' | 'md'; showBar?: boolean; lang?: 'en' | 'ar'; style?: React.CSSProperties }
export declare function CapacityIndicator(props: CapacityIndicatorProps): JSX.Element;
