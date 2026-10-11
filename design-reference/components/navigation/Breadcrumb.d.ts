/** Location trail at the top of page headers. Chevron separators flip in RTL. */
export interface BreadcrumbItem { label?: string; href?: string; icon?: string; onClick?: () => void }
export interface BreadcrumbProps { items: BreadcrumbItem[]; home?: BreadcrumbItem }
export declare function Breadcrumb(props: BreadcrumbProps): JSX.Element;
