# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Nughair/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Nughair/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar — a token launch radar over a sealed DefiLlama snapshot of 758 protocols. It ranks 198 pre-token protocols by an implied launch value derived only from the snapshot's own figures (TVL × a per-category market-cap/TVL multiple calibrated on the snapshot's tokenized protocols, adjusted for 7-day momentum, track record and chain breadth), covers all 40 watchlist protocols, and gives every row a concrete farm plan with costs and timeframes. The dashboard is sortable and filterable, with a per-protocol detail view that shows the model's workings factor by factor.

## Run it

```sh
node main.ts
# reads /input/snapshot.json (or the kit's local input), writes board.json, data.js, the dashboard, screenshots and dossier.json to /output
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=lucky-comet-18&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
