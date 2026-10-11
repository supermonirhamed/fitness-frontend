Numeric input for currency, percentage (VAT) and minutes (duration). Always Western digits, LTR.

```jsx
<InputNumber mode="currency" currency="SAR" value={150} />
<InputNumber mode="minutes" value={60} showButtons step={15} />
```

Notable props:
- `mode`: 'decimal' | 'currency' | 'percent' | 'minutes'
- `invalid`: boolean
