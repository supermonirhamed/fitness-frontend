import * as React from 'react';
import type { BreadcrumbItem } from '../navigation/Breadcrumb';
import type { MenuItem } from '../navigation/Menu';
/**
 * Breadcrumb, title, status tag, one primary action, secondary actions in a "more" menu.
 * @startingPoint section="Patterns" subtitle="Page header with breadcrumb, status and actions" viewport="900x160"
 */
export interface PageHeaderProps { breadcrumb?: BreadcrumbItem[]; title: React.ReactNode; status?: React.ReactNode; meta?: React.ReactNode; primaryAction?: React.ReactNode; actions?: React.ReactNode; moreItems?: MenuItem[]; style?: React.CSSProperties }
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
