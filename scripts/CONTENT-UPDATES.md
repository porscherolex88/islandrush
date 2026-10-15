# Content updates (FAQ and Help)

FAQ and Help centre articles are **database content**, edited in Admin:

- `/admin/manage/faqs`
- `/admin/manage/helpArticles`

They are **not** hardcoded in the Next.js page routes. Pages only read published rows.

## Compliance pack (Oct 2026)

Approved FAQ answers and the replacement island/checkpoints Help guide live in:

- `scripts/content/compliance-faq-help.json`

### Apply to a database (staging or production)

This does **not** run on Vercel deploy. Run it only when you intend to update that environment's DB:

```bash
# From the repo root, with that environment's DATABASE_URL in .env.local
npm run db:seed:compliance-content
```

Re-apply after editing the JSON:

```bash
npm run db:seed:compliance-content -- --force
```

### What the script does

1. Replaces all FAQ rows with the approved set.
2. Upserts Help articles (including `islands-checkpoints-and-puzzles`).
3. Archives the outdated `mystery-map-guide` article.
4. Updates the `about` content page copy.
5. Records `compliance_content_v1` in `app_config` so it is idempotent.

### Manual admin import

You can also paste rows from the JSON into Admin > FAQ / Help Articles without running the script. Archive or delete `Exploring the Mystery Map` (`mystery-map-guide`) when you do.

### Fresh local seeds

`npm run db:seed` already inserts the same Compliance FAQ/Help copy for new databases.
