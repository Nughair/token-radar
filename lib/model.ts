// Launch Radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board ranks protocols that record no token yet by what a launch would be worth if the
// protocol's record stayed as it is. Every number comes from the snapshot's own figures:
//
//   implied = TVL x category multiple x momentum x track record x breadth
//
// The category multiple is the heart of it. Protocols whose token already trades are the
// calibration set: for each category, the radar takes the median market-cap-to-TVL ratio of
// that category's trading protocols, winsorised to [0.01, 3] so one protocol whose token prices
// an off-chain business cannot bend a whole category, and shrinks it toward the market-wide
// median (0.214 on this snapshot) by sample size, so a category with one observation is mostly
// the market and a category with fifteen is mostly itself. The multiple is then held inside
// [0.02, 1.5]: no category's launch is priced above one and a half times the value locked in it.
//
//   momentum     7-day TVL change, clamped to +/-30%, at 0.9 weight: 0.73 .. 1.27
//   track record days DefiLlama has tracked the protocol with no token, against a 3-year
//                yardstick: 0.85 .. 1.00 (a long, tokenless record is the radar's whole signal)
//   breadth      chains beyond the first, +4% each, capped at five extra chains: 1.00 .. 1.20
//
// The ranked board is pre-token only. Protocols that already trade are never ranked by the
// model: they are shown apart at their market's own value, and their ratios are the evidence
// the multiples stand on. The board covers the snapshot's whole watchlist, then every other
// standalone pre-token protocol in the snapshot: the watchlist's own hygiene (no exchanges, no
// versioned pools, no wrapped, staked or bridged product of a token that already trades) is
// applied at every size, so a wrapped bitcoin or an exchange's own page is tracked in the
// counts, never ranked as a launch.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated on the dashboard's model panel so a reader can re-derive a row. */
export interface ModelConstants {
  ratio_floor: number;
  ratio_cap: number;
  shrink_prior: number;
  multiple_floor: number;
  multiple_cap: number;
  momentum_clamp_pct: number;
  momentum_weight: number;
  track_floor: number;
  track_range: number;
  track_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  ratio_floor: 0.01,
  ratio_cap: 3,
  shrink_prior: 4,
  multiple_floor: 0.02,
  multiple_cap: 1.5,
  momentum_clamp_pct: 30,
  momentum_weight: 0.9,
  track_floor: 0.85,
  track_range: 0.15,
  track_days: 1095,
  breadth_per_chain: 0.04,
  breadth_max_extra: 5,
};

/** The model's version label: the dashboard names it beside the formula. */
export const MODEL_VERSION = 'launch-radar-2';

/** How many already-trading protocols the dashboard's calibration panel lists, by market cap. */
export const LIVE_ROWS = 40;

/** One category's calibration: how many trading protocols, their median ratio, the multiple used. */
export interface CategoryMultiple {
  category: string;
  sample_size: number;
  median_ratio: number | null;
  multiple: number;
}

/** The factor-by-factor account of one protocol's implied value. */
export interface ValueBreakdown {
  category_multiple: number;
  category_sample: number;
  momentum_factor: number;
  momentum_pct: number | null;
  track_factor: number;
  age_days: number | null;
  breadth_factor: number;
  chain_count: number;
}

/** One row of board.json: the ranked board's row, with its farm plan and its value's workings. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: ValueBreakdown;
  farm_steps: string[];
}

/** A protocol whose token already trades: shown at the market's own value, never model-ranked. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  symbol: string | null;
  ratio: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders: the board, the calibration set and the model that ran. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  constants: ModelConstants;
  stats: {
    protocols: number;
    pre_token: number;
    board_rows: number;
    watchlist_size: number;
    watchlist_rows: number;
    early_rows: number;
    not_ranked: number;
    live_rows: number;
    calibration_size: number;
    global_median_ratio: number;
  };
  multiples: CategoryMultiple[];
  rows: BoardRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const UNCATEGORISED = 'Uncategorised';

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Whether a protocol records no token: no market cap, no CoinGecko id, no symbol. */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whole days from the day DefiLlama began tracking a protocol to the snapshot's day; null if unknown. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The calibration set: protocols whose token trades and whose record carries both a market cap
 * and a TVL, each reduced to its winsorised market-cap-to-TVL ratio.
 */
function calibrationRatios(snapshot: Snapshot, model: ModelConstants): Map<string, number[]> {
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (recordsNoToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = clamp(p.mcap_usd / p.tvl_usd, model.ratio_floor, model.ratio_cap);
    const key = p.category ?? UNCATEGORISED;
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [ratio]);
    else list.push(ratio);
  }
  return byCategory;
}

/** Every category's multiple, derived from the calibration set and shrunk toward the market median. */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { table: CategoryMultiple[]; globalMedian: number; calibrationSize: number } {
  const byCategory = calibrationRatios(snapshot, model);
  const all = [...byCategory.values()].flat();
  const globalMedian = all.length > 0 ? median(all) : 0;
  const table: CategoryMultiple[] = [];
  const categories = new Set<string>([...byCategory.keys(), ...snapshot.protocols.map((p) => p.category ?? UNCATEGORISED)]);
  for (const category of categories) {
    const sample = byCategory.get(category) ?? [];
    const med = sample.length > 0 ? median(sample) : null;
    const multiple = med === null
      ? globalMedian
      : clamp((sample.length * med + model.shrink_prior * globalMedian) / (sample.length + model.shrink_prior), model.multiple_floor, model.multiple_cap);
    table.push({ category, sample_size: sample.length, median_ratio: med === null ? null : round4(med), multiple: round4(multiple) });
  }
  table.sort((a, b) => b.sample_size - a.sample_size || (a.category < b.category ? -1 : 1));
  return { table, globalMedian, calibrationSize: all.length };
}

/** The multiple one protocol's category carries, from a table built by categoryMultiples. */
function multipleFor(table: CategoryMultiple[], category: string | null): CategoryMultiple {
  const key = category ?? UNCATEGORISED;
  return table.find((row) => row.category === key) ?? { category: key, sample_size: 0, median_ratio: null, multiple: 0 };
}

/** One protocol's implied value and the factors that produced it. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  table: CategoryMultiple[],
  fallbackAgeDays: number,
  model: ModelConstants = MODEL,
): { implied: number; breakdown: ValueBreakdown } {
  const age = ageDays(asOf, p.listed_at);
  const multiple = multipleFor(table, p.category);
  const pct = p.change_7d === null ? 0 : clamp(p.change_7d, -model.momentum_clamp_pct, model.momentum_clamp_pct);
  const momentum = 1 + (pct / 100) * model.momentum_weight;
  const ageForTrack = age ?? fallbackAgeDays;
  const track = model.track_floor + (clamp(ageForTrack, 0, model.track_days) / model.track_days) * model.track_range;
  const breadth = 1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple.multiple * momentum * track * breadth));
  return {
    implied,
    breakdown: {
      category_multiple: multiple.multiple,
      category_sample: multiple.sample_size,
      momentum_factor: round4(momentum),
      momentum_pct: p.change_7d,
      track_factor: round4(track),
      age_days: age,
      breadth_factor: round4(breadth),
      chain_count: p.chains.length,
    },
  };
}

/** Categories that are a product of another asset, or an exchange itself: tracked, never ranked. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/**
 * Whether a pre-token protocol stands alone as a launch candidate: the watchlist's own screen,
 * applied at every size. A wrapped, staked or bridged product of a token that already trades is
 * not a token that does not exist yet, whatever its TVL.
 */
export function isStandalone(p: SnapshotProtocol): boolean {
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name) || WRAPPED_WORD.test(p.name)) return false;
  return !EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x));
}

/** The board: the whole watchlist, then every other standalone pre-token protocol, ranked by value. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; multiples: CategoryMultiple[]; globalMedian: number; calibrationSize: number; notRanked: number } {
  const { table, globalMedian, calibrationSize } = categoryMultiples(snapshot, model);
  const ages = snapshot.protocols.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const fallbackAge = ages.length > 0 ? Math.round(median(ages)) : 365;
  const watchlist = new Set(snapshot.watchlist);
  const chosen: SnapshotProtocol[] = [];
  let notRanked = 0;
  for (const p of snapshot.protocols) {
    if (!recordsNoToken(p)) continue;
    if (watchlist.has(p.slug) || isStandalone(p)) chosen.push(p);
    else notRanked += 1;
  }
  const scored = chosen.map((p) => ({ p, ...impliedValue(p, snapshot.as_of, table, fallbackAge, model) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    on_watchlist: watchlist.has(s.p.slug),
    age_days: s.breakdown.age_days,
    implied_value_usd: s.implied,
    model: s.breakdown,
    farm_steps: farmPlan(s.p, s.breakdown.age_days),
  }));
  return { board, multiples: table, globalMedian, calibrationSize, notRanked };
}

/** The already-trading set for the dashboard: the largest tokens by the market's own value. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !recordsNoToken(p) && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd ?? 0,
      symbol: p.symbol,
      ratio: p.tvl_usd > 0 ? round4(p.mcap_usd! / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** Everything the entry hands in: the board for board.json and the dashboard's dataset. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, multiples, globalMedian, calibrationSize, notRanked } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    constants: model,
    stats: {
      protocols: snapshot.protocols.length,
      pre_token: snapshot.protocols.filter(recordsNoToken).length,
      board_rows: board.length,
      watchlist_size: snapshot.watchlist.length,
      watchlist_rows: board.filter((r) => r.on_watchlist).length,
      early_rows: board.filter((r) => !r.on_watchlist).length,
      not_ranked: notRanked,
      live_rows: live.length,
      calibration_size: calibrationSize,
      global_median_ratio: round4(globalMedian),
    },
    multiples,
    rows: board,
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------------------
// Farm plans. Each plan is generated from the protocol's own record: its
// category's core action, its first two chains and what they cost to use, a
// capital tier from its TVL, and a holding window from its age. Every step
// states its cost and its time; no step is a slogan.
// ---------------------------------------------------------------------------

/** Indicative cost of using a chain, as a farmer meets it: gas for a handful of transactions. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return '$10-30 of mainnet gas';
  if (c === 'solana') return 'about $0.05 of fees';
  if (c === 'bsc') return 'about $0.30 of gas';
  if (c === 'avalanche') return 'about $0.50 of gas';
  if (c === 'polygon') return 'about $0.10 of gas';
  if (['arbitrum', 'base', 'optimism', 'zksync era', 'linea', 'scroll', 'mantle', 'blast', 'mode', 'taiko', 'starknet', 'manta', 'bob', 'berachain'].includes(c)) return 'about $0.50 of gas';
  return 'about $1-5 of gas';
}

/** How much capital one qualifying position takes, from the protocol's own size. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 500;
  if (tvl >= 250_000_000) return 250;
  if (tvl >= 50_000_000) return 150;
  if (tvl >= 10_000_000) return 75;
  return 40;
}

/** How long a position should age, from the protocol's track record: newer records, longer proof. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  if (age < 730) return 35;
  return 30;
}

/** The category's core qualifying action, in words a farmer can follow. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('dex')) return `Trade and provide liquidity on ${n}: swap about $${capital * 4} of volume across its main pairs on ${chain}, then deposit $${capital} into its busiest pool and leave the LP position open.`;
  if (c.includes('lending') || c.includes('uncollateralized')) return `Lend on ${n}: supply $${capital} of USDC or ETH as collateral on ${chain}, borrow roughly 40% of it back, and keep both legs open so the wallet builds supply and borrow history.`;
  if (c.includes('cdp')) return `Open a vault on ${n}: lock $${capital} of ETH or a liquid staking token as collateral on ${chain}, mint about 40% of its value as the protocol's stablecoin, and hold the vault and the debt open.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('interest rate')) return `Trade on ${n}: deposit $${capital} of margin on ${chain}, open and close small hedged positions each week until traded volume passes $${capital * 20}, and keep margin parked between sessions.`;
  if (c.includes('risk curator') || c.includes('curator')) return `Allocate through a ${n}-curated vault: deposit $${capital} of USDC into a vault it risk-manages on ${chain} and keep the shares while the curator rebalances underneath you.`;
  if (c.includes('capital allocator') || c.includes('allocator')) return `Deposit into a ${n} allocator vault on ${chain}: place $${capital} and hold the vault shares; the allocator routes the capital across lending and trading venues, so the deposit itself is the qualifying activity.`;
  if (c.includes('yield aggregator')) return `Deposit into ${n}'s auto-compounding vault on ${chain}: put in $${capital} and leave the shares untouched, so the position compounds and ages across weekly snapshots.`;
  if (c.includes('yield')) return `Deposit into ${n}'s flagship yield vault on ${chain}: put in $${capital} of the vault's base asset and leave the shares untouched so the position ages across weekly snapshots.`;
  if (c.includes('rwa')) return `Buy ${n}'s tokenised real-world asset on ${chain}: acquire about $${capital} through its mint or an authorised market and hold it in the farming wallet for the full window.`;
  if (c.includes('basis')) return `Fund ${n}'s basis book: deposit $${capital} of stablecoins on ${chain}; the strategy holds hedged spot and perpetual legs, so leave the deposit untouched while it earns the spread.`;
  if (c.includes('staking pool') || c.includes('restak')) return `Stake through ${n}: stake about $${capital} of the chain's staking asset on ${chain} and keep the staking receipt in the wallet for the whole window.`;
  if (c.includes('chain')) return `Use the chain ${n} operates: bridge about $${capital} to ${chain}, then pay for real activity there every week - swaps, a lending deposit, a name or mint - so the wallet builds native history.`;
  if (c.includes('liquidity manager')) return `Seed a ${n}-managed liquidity range: deposit $${capital} into its managed vault on ${chain} and let the manager rebalance; review the position weekly but do not withdraw.`;
  if (c.includes('leveraged farm')) return `Open a small leveraged farm on ${n}: post $${capital} as equity on ${chain} at the lowest leverage offered, keep the position open, and check its health factor every week.`;
  if (c.includes('prediction')) return `Trade markets on ${n}: fund $${capital} on ${chain}, take positions in at least five different markets, and hold some to settlement so the account shows resolved-market history.`;
  if (c.includes('insurance')) return `Take a position with ${n} on ${chain}: deposit $${capital} into its cover pool, or buy cover for a position you already hold, and keep the cover active for the season.`;
  if (c.includes('payment')) return `Route payments through ${n}: load $${capital} on ${chain} and make several real payments or transfers through it, spread across different weeks.`;
  if (c.includes('index')) return `Buy a ${n} index token on ${chain}: purchase about $${capital} and hold it; the index's own rebalances then accrue activity to the wallet automatically.`;
  if (c.includes('privacy')) return `Use ${n}'s shielded pool on ${chain}: deposit about $${capital}, make one shielded transfer to a second wallet you control, and keep a balance in the pool.`;
  if (c.includes('options')) return `Deposit into a ${n} options vault on ${chain}: put in $${capital} and leave it through at least four weekly option epochs without withdrawing.`;
  if (c.includes('bridge')) return `Bridge through ${n}: move about $${capital} to ${chain} using it, then use the bridged funds in one app on the far side so the trip is not a round trip.`;
  if (c.includes('stablecoin') || c.includes('stable')) return `Mint or hold ${n}'s stable asset: mint or deposit about $${capital} on ${chain} and hold the stablecoin in the wallet, or supply it to a lending market the protocol supports.`;
  if (c.includes('card')) return `Use the ${n} card account: fund about $${capital} on ${chain} and make card or account transactions in at least three separate weeks.`;
  if (c.includes('otc')) return `Trade on ${n}'s OTC desk: register, then post or take one small trade of about $${capital} on ${chain} and settle it in full.`;
  if (c.includes('btc')) return `Deposit a BTC position into ${n}: wrap or bridge about $${capital} of BTC exposure onto ${chain} and keep it supplied for the full holding window.`;
  if (c.includes('governance')) return `Take part through ${n}: deposit about $${capital} on ${chain} and vote or delegate in at least one governance round while the position is open.`;
  if (c.includes('cedefi') || c.includes('farm')) return `Deposit with ${n}: place $${capital} into its main earning product on ${chain} and keep the balance in place for the full holding window.`;
  return `Use ${n}'s core product on ${chain}: deposit about $${capital} through its main app flow - the action its homepage leads with - and keep the resulting position open.`;
}

/**
 * One protocol's farm plan: five to six steps, each an action with its cost and its time,
 * parameterised by the protocol's own chains, category, size and age.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): string[] {
  const chain = p.chains[0] ?? 'Ethereum';
  const second = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const ageText = age === null ? 'an unrecorded start date' : age >= 730 ? `${(age / 365).toFixed(1)} years` : `${age} days`;
  const steps: string[] = [
    `Set up a wallet used only for ${p.name} and fund it on ${chain}: bridge about $${capital + 50} of USDC or ETH there (${gasFor(chain)} for the bridge and first transactions) so every later action is attributable to this one wallet. Cost: ${gasFor(chain)} plus the capital moved. Time: 20 minutes, once.`,
    `${coreAction(p, capital, chain)} Cost: $${capital} of capital plus ${gasFor(chain)}. Time: 15 minutes to set up.`,
  ];
  if (second !== null) {
    steps.push(`Repeat a smaller position on ${second}: move about a quarter of the capital (${gasFor(second)}) and mirror the core action in ${p.name}'s deployment there, so the wallet shows the multi-chain usage these launches usually reward. Cost: about $${Math.round(capital / 4)} plus ${gasFor(second)}. Time: 15 minutes, once.`);
  } else {
    steps.push(`Deepen the position on ${chain} a week later: add a second deposit of about a quarter of the first (${gasFor(chain)}) instead of one lump sum, so the account shows repeat usage across time rather than a single visit. Cost: about $${Math.round(capital / 4)} plus ${gasFor(chain)}. Time: 10 minutes, once.`);
  }
  steps.push(`Stay active every week: make one small qualifying action - a top-up, a swap, a borrow adjustment or a vote - in each week of the window, because one-off wallets are the first thing snapshot filters remove. Cost: ${gasFor(chain)} a week. Time: 10 minutes a week.`);
  steps.push(`Hold for at least ${hold} days without withdrawing below half the position: aged balances are the signal that survives sybil filters, and ${p.name} has run ${ageText} with no token recorded, so aged activity is what a launch would reward. Cost: the $${capital} stays in the protocol and carries its smart-contract risk. Time: ${hold} days.`);
  steps.push(`Watch for the launch itself: check ${p.name}'s official site, blog and governance forum once a month for a points programme, snapshot or token announcement, and claim only through links the protocol publishes itself. Cost: nothing; never pay a third party to unlock an allocation. Time: 15 minutes a month.`);
  return steps;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string' || o.source.length === 0) throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, values, farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set<string>();
  for (const r of board) {
    if (slugs.has(r.slug)) return `slug ${r.slug} appears twice`;
    slugs.add(r.slug);
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} trimmed characters`;
    }
  }
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not a protocol in the snapshot`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `rank ${i + 1} outranks rank ${i} on implied value`;
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) return 'every row shares one implied value: a board that ranks nothing by value is not a ranking';
  return null;
}

/** The dashboard's data as one script: window.RADAR, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
