/** The one place status → colour is decided. Always use this for entity statuses so colours stay consistent. */
export type Status = 'draft' | 'published' | 'active' | 'full' | 'waitlist' | 'cancelled' | 'completed' | 'expired' | 'late-cancel' | 'no-show' | 'checked-in' | 'inactive' | 'blocked' | 'confirmed' | 'lead' | 'provisioning' | 'suspended' | 'unpaid' | 'paid' | 'partially-paid' | 'voided' | 'complimentary' | 'present' | 'late' | 'absent' | 'excused' | 'archived';
export interface StatusTagProps { status: Status; lang?: 'en' | 'ar'; /** override text */ label?: string; size?: 'sm' | 'md' }
export declare function StatusTag(props: StatusTagProps): JSX.Element;
