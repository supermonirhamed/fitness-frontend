Date, time and range picker. Week starts Saturday by default (Gulf); chevrons flip in RTL; always Western digits.

```jsx
<DatePicker value={date} onChange={setDate} />
<DatePicker mode="range" value={[from,to]} onChange={setRange} />
<DatePicker mode="time" value="18:00" />
```

Notable props:
- `mode`: 'date' | 'time' | 'range' | 'datetime'
- `invalid`: boolean
