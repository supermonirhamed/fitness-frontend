Segmented single/multi choice — view switch, payment source, payment method.

```jsx
<SelectButton value={view} onChange={setView} options={[{label:'Day',value:'day'},{label:'Week',value:'week'}]} />
```

Notable props:
- `multiple`: boolean
- `fullWidth`: boolean
