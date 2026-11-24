# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/imkofty/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/imkofty/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar: protocols that record no token, ranked by implied launch value. Model radar-2 — implied = TVL × 0.205 × growth × maturity, where 0.205 is the median mcap/TVL of the 128 live protocols in the same snapshot. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22, standard library only, no network. Reads the sealed snapshot, writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Running it twice writes byte-identical output.

## Model

- **Multiple 0.205**: median mcap/TVL of the 128 live protocols in the snapshot that report a market cap (15 with mcap 0 excluded). Calibrated from the snapshot itself.
- **Growth**: 1 + clamp(change_7d, −60, +120)/100 × 0.5 — a directional prior, not a fitted result.
- **Maturity**: 0.6 + min(age_days, 1095)/1095 × 0.4 (age unknown: 365 days) — also a prior.
- **A size damp was tested and removed**: in a blind holdout it made the median prediction error worse in both splits, the size effect reverses inside Dexs and Lending, and the ranking with it is identical to the ranking without it (Spearman 1.000). The shipped model is linear in TVL.
- **Implied value is a circulating-style estimate, not FDV**: the snapshot carries circulating market cap only.

## Board

40 watchlist protocols + 143 strictly rankable pre-token protocols below the $50M floor = 183 rows. Twenty pre-token protocols above the floor that pass the strict test are not ranked (the snapshot carries no parentProtocol field, so a wrapped or staked product cannot be ruled out) and are listed in the dashboard as tracked-but-not-ranked. The 24 largest live-token protocols are shown apart, at the market's own value.

---

<sub>Entered on [make.fun](https://make.fun/?ref=46vj21k9&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
