# API contracts

| File | Owner | What |
|------|-------|------|
| `openapi.json` | Camilo | Backend gateway: bank, approvals, policy, audit, agent events, quant pass-through. Generated with `python -m app.main ../contracts/openapi.json` from `backend/` |
| `vicente-rodriguez/api/openapi.json` | Vicente | Request/response bodies of `/quant/*` (served unchanged through the gateway) |

If you change a contract, regenerate it and tell the group (team rule).
