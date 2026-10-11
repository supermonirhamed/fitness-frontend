PrimeVue-style Button. One primary per page; danger for destructive confirms.

```jsx
<Button label="New booking" icon="pi-plus" />
<Button label="Cancel session" severity="danger" />
<Button icon="pi-bell" variant="text" severity="secondary" badge={3} ariaLabel="Alerts" />
```

Notable props:
- `iconPos`: 'start' | 'end'
- `severity`: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast'
- `variant`: 'solid' | 'outlined' | 'text'
- `size`: 'sm' | 'md' | 'lg'
- `rounded`: boolean
