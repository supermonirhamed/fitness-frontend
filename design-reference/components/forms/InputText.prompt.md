Single-line text input. Use `icon="pi-search"` for search fields; `dir="ltr"` for phone/email inside RTL forms.

```jsx
<InputText icon="pi-search" placeholder="Name, mobile, member ID" value={q} onChange={setQ} />
```

Notable props:
- `invalid`: boolean
- `inputMode`: React.HTMLAttributes<HTMLInputElement>['inputMode']
