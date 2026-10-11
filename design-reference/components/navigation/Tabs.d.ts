/** Tab list for detail pages. The last tab is always Activity / Timeline. */
export interface TabItem { label: string; value: string; icon?: string; count?: number; disabled?: boolean; /** Tooltip for disabled tabs, e.g. "Available in a later release" */ hint?: string }
export interface TabsProps { tabs: TabItem[]; value: string; onChange?: (value: string) => void }
export declare function Tabs(props: TabsProps): JSX.Element;
