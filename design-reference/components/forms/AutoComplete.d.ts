import * as React from 'react';
/** Typeahead search with avatar rows — client search (name, phone, email, member ID), service picker. */
export interface AutoCompleteSuggestion { id?: string; label: string; sub?: string; image?: string; avatar?: boolean; alerts?: { icon: string; label: string; severity?: 'warn' | 'danger' | 'info' }[]; [k: string]: any }
export interface AutoCompleteProps {
  value?: string; onChange?: (value: string) => void; suggestions?: AutoCompleteSuggestion[]; onSelect?: (s: AutoCompleteSuggestion) => void;
  placeholder?: string; icon?: string; emptyMessage?: string; /** e.g. a "+ New client" text Button */ footer?: React.ReactNode;
  invalid?: boolean; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; id?: string; style?: React.CSSProperties;
}
export declare function AutoComplete(props: AutoCompleteProps): JSX.Element;
