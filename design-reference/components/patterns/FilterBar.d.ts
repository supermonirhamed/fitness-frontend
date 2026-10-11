import * as React from 'react';
/** Search + 3–5 quick filters + "More filters" drawer trigger + active filter chips. */
export interface FilterBarProps { search?: string; onSearch?: (v: string) => void; searchPlaceholder?: string; /** quick filter controls (Select/MultiSelect/SelectButton) */ filters?: React.ReactNode; onMoreFilters?: () => void; moreCount?: number; moreLabel?: string; chips?: { label: React.ReactNode; onRemove?: () => void }[]; onClearAll?: () => void; clearLabel?: string; end?: React.ReactNode }
export declare function FilterBar(props: FilterBarProps): JSX.Element;
