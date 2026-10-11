import * as React from 'react';
/** Date, time and range picker. Week starts Saturday by default (Gulf); chevrons flip in RTL; always Western digits. mode="time" is a 24h HH:mm text input with a 30-min dropdown (locale-independent, LTR). */
export interface DatePickerProps {
  mode?: 'date' | 'time' | 'range' | 'datetime';
  /** ISO date "2026-10-07", time "18:00", or [start, end] for range */
  value?: string | [string | null, string | null] | null;
  onChange?: (value: any) => void; placeholder?: string; locale?: string;
  invalid?: boolean; disabled?: boolean; /** Render the calendar panel inline (no input) */ inline?: boolean; id?: string; style?: React.CSSProperties;
}
export declare function DatePicker(props: DatePickerProps): JSX.Element;
export interface CalendarProps { mode?: 'date' | 'range' | 'datetime'; value?: any; onChange?: (value: any) => void; month?: string; locale?: string; /** 0=Sun … 6=Sat */ weekStart?: number; times?: string[] }
export declare function Calendar(props: CalendarProps): JSX.Element;
