List table with sorting, selection, row actions, pagination, sticky header, loading skeletons and empty state.

```jsx
<DataTable selectable selection={sel} onSelectionChange={setSel} rows={rows}
  columns={[{field:'name',header:'Client',sortable:true,body:r=><PersonChip name={r.name} secondary={r.mid}/>},{field:'status',header:'Status',body:r=><StatusTag status={r.status}/>}]}
  pagination={{page:1,rows:25,total:312}} />
```

Notable props:
- `selectable`: boolean
- `loading`: boolean
- `compact`: boolean
