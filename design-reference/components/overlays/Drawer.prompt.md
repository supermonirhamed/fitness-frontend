Side panel for quick create/edit. Opens on the END side: right in LTR, left in RTL. Sticky footer for Cancel / Save.

```jsx
<Drawer visible={open} onHide={close} header="New client" footer={<Button label="Save" />}>…</Drawer>
```

