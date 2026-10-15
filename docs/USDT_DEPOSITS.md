# USDT TRC20 deposits

## Matching strategy: unique amount

1. Player chooses a deposit amount (2 decimal places, e.g. `50.00`).
2. The server allocates a unique `crypto_expected_amount` with 6 decimal places by adding a random micro-offset (e.g. `50.000137`).
3. The player must send **exactly** that amount of USDT on TRON (TRC20) to the configured wallet.
4. Cron job `poll-usdt-deposits` (every 5 minutes) queries TronGrid for incoming TRC20 transfers, matches on exact amount, waits for `USDT_MIN_CONFIRMATIONS` (default 20), then credits Cash.
5. Credits are idempotent via unique `deposits.crypto_tx_id` and `usdt_credit_logs.tx_id`. Every credit is logged for admin review at `/admin/finance/usdt-credits`.

## Env vars

| Variable | Purpose |
| --- | --- |
| `USDT_TRC20_WALLET` | Global receiving wallet (per-country override in admin) |
| `TRONGRID_API_KEY` | TronGrid API key |
| `TRONGRID_BASE_URL` | Optional, default `https://api.trongrid.io` |
| `USDT_TRC20_CONTRACT` | Optional, default mainnet USDT |
| `USDT_MIN_CONFIRMATIONS` | Optional, default `20` |
| `LICENCE_NUMBER` | Required before any real-money deposits/withdrawals site-wide |
| `LICENSED_ENTITY` | Shown in footer/Terms when licence is set |
| `CRON_SECRET` | Authorizes `/api/cron/*` |

Do **not** set `LICENCE_NUMBER` until the Curaçao licence is verified.
