/** Subtotal / VAT x% / Total block — booking payment, receipts. */
export interface VatSummaryProps { subtotal: number; vatRate?: number; currency?: string; locale?: 'en' | 'ar'; /** subtotal already includes VAT */ inclusive?: boolean; labels?: { sub: string; vat: string; total: string } }
export declare function VatSummary(props: VatSummaryProps): JSX.Element;
