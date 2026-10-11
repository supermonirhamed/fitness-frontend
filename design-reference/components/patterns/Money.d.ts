import * as React from 'react';
/** Amount with currency per org settings, Western digits in both languages. */
export interface MoneyProps { amount: number; currency?: string; locale?: 'en' | 'ar'; strike?: boolean; strong?: boolean; style?: React.CSSProperties }
export declare function Money(props: MoneyProps): JSX.Element;
export declare function formatMoney(amount: number, currency?: string, locale?: 'en' | 'ar'): string;
