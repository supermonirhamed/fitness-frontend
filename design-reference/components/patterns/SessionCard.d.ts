import * as React from 'react';
/**
 * Calendar / Today session card. Status drives the treatment: Draft dashed border, Cancelled muted + strikethrough, Full red border, Completed faded.
 * @startingPoint section="Patterns" subtitle="Session card — full, compact and mini variants" viewport="700x260"
 */
export interface SessionCardProps { service: string; /** service colour, e.g. "var(--svc-3)" */ color?: string; time: string; end?: string; coach?: string; facility?: string; booked?: number; capacity?: number; waitlist?: number; status?: 'draft' | 'published' | 'full' | 'cancelled' | 'completed'; variant?: 'full' | 'compact' | 'mini'; selected?: boolean; lang?: 'en' | 'ar'; onClick?: () => void; style?: React.CSSProperties }
export declare function SessionCard(props: SessionCardProps): JSX.Element;
