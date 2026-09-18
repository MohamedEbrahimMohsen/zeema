One-line: a catalog row — used anywhere a list of component types is browsed or searched.

```jsx
<ComponentRow name="SQS" slug="sqs" provider="aws" kind="queue" icon="assets/icons/components/aws/sqs.svg" />
<ComponentRow name="Cron job" slug="cron-job" kind="worker" icon="assets/icons/kinds/worker.svg" iconKind="kind" last />
```

Icon first, always at `--icon`, so a column of rows scans as a column of marks. Components with a vendor get a full-colour brand icon; generic ones fall back to the masked kind glyph. Provider tag is omitted entirely (not blanked) when the component is provider-agnostic.
