Appears above a DataTable when rows are selected (Add tag, Cancel, Mark attended, Export). Pass contrast/secondary Buttons.

```jsx
<BulkActionBar count={sel.length} onClear={()=>setSel([])} actions={<Button size="sm" severity="contrast" label="Add tag" />} />
```

