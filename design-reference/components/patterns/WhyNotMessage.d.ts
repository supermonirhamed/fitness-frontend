import * as React from 'react';
/** Explains a blocked action in plain words, with an optional override for permitted staff. e.g. "Session is full — waitlist is off." */
export interface WhyNotMessageProps { reason: React.ReactNode; detail?: React.ReactNode; severity?: 'warn' | 'danger' | 'info'; canOverride?: boolean; overrideLabel?: string; onOverride?: () => void; secondaryAction?: React.ReactNode }
export declare function WhyNotMessage(props: WhyNotMessageProps): JSX.Element;
