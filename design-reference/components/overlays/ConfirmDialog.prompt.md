Yes/no confirmation. Use severity="danger" for destructive actions; state the impact in `message`.

```jsx
<ConfirmDialog severity="danger" header="Cancel session?" message="15 bookings will be cancelled." acceptLabel="Cancel session" onAccept={…} onReject={…} />
```

