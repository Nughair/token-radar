# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Nughair/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Nughair/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar — a token launch radar over a sealed DefiLlama snapshot of 758 protocols. It ranks 208 pre-token protocols by an implied launch value derived only from the snapshot's own figures: a log-log size curve fitted to the 128 protocols whose token already trades (each ratio winsorised first), a per-category offset shrunk by sample size, then adjustments for 7-day momentum, track record and chain breadth. The model is blind-tested leave-one-out against those same traded launches — median error ×3.92 — and that earned error is printed as a band around every row. Every farm plan is netted (expected take at the band's low end, minus the plan's own gas costs, minus the Treasury-bill yield forgone on its capital) into a net dollar figure and a FARM / THIN / SKIP verdict. All 40 watchlist protocols are covered, and every protocol the board does not rank is listed with its reason. The dashboard is sortable and filterable (verdict included), with a per-protocol detail view that shows the model's workings factor by factor, the band, and the netting.

## Run it

```sh
node main.ts
# reads /input/snapshot.json (or the kit's local input), writes board.json, data.js, the dashboard, screenshots and dossier.json to /output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=lucky-comet-18&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
