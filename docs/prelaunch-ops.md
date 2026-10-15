# Pre-launch ops

## Deposits (Maybank / CIMB)

Player deposits are controlled by the `deposits` feature flag.

- **Off (current default after this change):** deposit endpoints reject new claims with `Deposits are temporarily unavailable.`, and Wallet > Add money shows the same message. Withdrawals, free play, login, and signup are unchanged.
- **Toggle in admin:** Admin > System > Feature flags > `deposits` (requires `system.manage`). Turning it on restores manual bank-transfer deposits (Maybank / CIMB payment accounts and configured methods).
- **Seed / migrate:** new seeds insert `deposits` as disabled. Migration `0014_disable_deposits` turns the flag off on existing databases.

## Wipe test data before launch

All current player data is treated as test data. Use the wipe script on a **non-production** database only. Do **not** run it against production.

Dry-run (default; prints row counts, deletes nothing):

```bash
npm run db:wipe-test
# or
npm run db:wipe-test -- --dry-run
```

Execute (both are required):

```bash
ALLOW_TEST_DATA_WIPE=1 npm run db:wipe-test -- --confirm=WIPE_TEST_DATA
```

The script refuses when `VERCEL_ENV` / `NODE_ENV` / `LOOTBOX_ENV` / `APP_ENV` is `production`, when the database host looks like production, or when `ALLOW_TEST_DATA_WIPE` is unset for execute mode.

**Removed:** profiles, balances / ledger, deposits, withdrawals, conversions, inventory, game plays, rewards, support tickets, risk flags, notifications, audit logs, and Neon Auth users/sessions when present.

**Kept:** maps, boxes, items, pools, deposit levels, FAQs/help/content, `payment_accounts`, `app_config`, and `feature_flags`.

After a wipe, recreate staff via `npm run db:seed` or sign up and promote a `SUPER_ADMIN`.
