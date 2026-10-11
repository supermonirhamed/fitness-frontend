import * as React from 'react';
/**
 * List table with sorting, selection, row actions, pagination, sticky header, loading skeletons and empty state.
 * @startingPoint section="Data" subtitle="Clients / bookings list table" viewport="900x420"
 */
export interface DataTableColumn<T = any> { field: string; header: React.ReactNode; sortable?: boolean; width?: number | string; align?: 'start' | 'center' | 'end'; body?: (row: T) => React.ReactNode; skeletonWidth?: number | string }
export interface DataTablePagination { page: number; rows: number; total: number; onPage?: (page: number) => void; label?: string }
export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[]; rows: T[]; dataKey?: string;
  selectable?: boolean; selection?: any[]; onSelectionChange?: (ids: any[]) => void;
  rowActions?: (row: T) => React.ReactNode; onRowClick?: (row: T) => void;
  sortField?: string; sortOrder?: 1 | -1; onSort?: (field: string, order: 1 | -1) => void;
  loading?: boolean; loadingRows?: number; emptyState?: React.ReactNode; pagination?: DataTablePagination;
  compact?: boolean; /** enables sticky-header scroll */ maxHeight?: number | string; style?: React.CSSProperties;
}
export declare function DataTable<T = any>(props: DataTableProps<T>): JSX.Element;
