/** Single image upload with preview — organization logo (rounded square) or client photo (circle). Supports drag & drop. */
export interface FileUploadProps { variant?: 'logo' | 'photo'; previewUrl?: string; onSelect?: (file: File) => void; onRemove?: () => void; label?: string; hint?: string; accept?: string; disabled?: boolean }
export declare function FileUpload(props: FileUploadProps): JSX.Element;
