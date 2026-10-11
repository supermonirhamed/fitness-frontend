Single-choice dropdown. Disabled options carry a `sub` line explaining why (e.g. "Busy 18:00–19:00").

```jsx
<Select value={fac} onChange={setFac} options={[{label:'Studio A',value:'a',meta:'20'},{label:'Court 2',value:'c',disabled:true,sub:'Busy 18:00–19:00'}]} />
```

Notable props:
- `invalid`: boolean
