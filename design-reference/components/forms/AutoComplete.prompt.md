Typeahead search with avatar rows — client search (name, phone, email, member ID), service picker.

```jsx
<AutoComplete value={q} onChange={setQ} suggestions={clients} onSelect={pick} footer={<Button size="sm" variant="text" label="New client" />} />
```

Notable props:
- `invalid`: boolean
