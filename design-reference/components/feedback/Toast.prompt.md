Transient confirmation after an action (e.g. booking confirmed). Position the stack bottom-end.

```jsx
<Toast summary="Booking confirmed" detail="Sara · Yoga Flow 18:00" actions={<Button size="sm" variant="text" label="View booking" />} />
```

Notable props:
- `severity`: 'success' | 'info' | 'warn' | 'danger'
