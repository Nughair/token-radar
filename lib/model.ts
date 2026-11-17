// Launch Radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// The board ranks protocols that record no token yet by what a launch would be worth if the
// protocol's record stayed as it is. Every number comes from the snapshot's own figures, and
// one function prices every row: no name is ever special-cased.
//
//   implied = size curve(TVL) x category offset x momentum x track record x breadth
//
// The size curve is fitted, not asserted — and fitted to the median launch, not the mean.
// Protocols whose token already trades are the calibration set. The fit is a line through
// log10(market cap) against log10(TVL) chosen so that half the traded launches sit above it
// and half below (a least-absolute-deviations fit, found by iteratively reweighted least
// squares), with each comp's market-cap-to-TVL ratio first clamped to [0.005, 5] so a data
// error cannot dominate. A mean fit is pulled toward the few launches that priced an
// off-chain business; the median fit answers the question a board row actually asks — what
// did the typical launch of this size turn out to be worth? On this snapshot the line is
// value = 10^3.091 x TVL^0.518: worth grows slower than TVL, which is what the traded
// launches themselves say — a protocol ten times as large launches at about 3.3 times the
// value, not ten times.
//
// The category offset is what is left: each category's mean residual from the curve, shrunk
// toward zero by sample size (prior weight 4), so a category with one observation borrows
// almost all of the curve and a category with fifteen mostly speaks for itself. The offset is
// a multiple (10^offset): categories the market pays up for sit above 1, categories whose
// value mostly belongs to depositors sit below 1.
//
//   momentum     7-day TVL change, clamped to +/-30%, at 0.9 weight: 0.73 .. 1.27
//   track record days DefiLlama has tracked the protocol with no token, against a 3-year
//                yardstick: 0.85 .. 1.00 (a long, tokenless record is the radar's whole signal)
//   breadth      chains beyond the first, +4% each, capped at five extra chains: 1.00 .. 1.20
//
// The model is tested blind, two independent ways, and both tests are published.
//   Leave-one-out: the fit is repeated 128 times, each time leaving one traded protocol
//     out, and the left-out protocol is priced with the full function — curve, its
//     category's offset, its own momentum, track record and breadth — and compared with
//     the market cap it actually trades at.
//   Walk-forward: the fit is made only on launches DefiLlama tracked before a cutoff
//     (2024, then 2025) and priced against the launches that came after. A cutoff runs
//     only when at least 30 launches predate it; 33 of the 128 traded launches carry no
//     tracking date and can only sit the leave-one-out test.
// Two refinements were tested the same way and rejected, and their numbers are published
// with the tests: a home-chain offset (it improves leave-one-out and worsens walk-forward —
// which chains are hot is a fact about the present, not a law the past hands the future)
// and a two-segment size curve (worse under leave-one-out at every break tried).
//
// The band printed around every row is read locally. A row's band is the median blind-test
// error of the 32 traded launches nearest the row's own size, shrunk toward the test's
// global median error (prior weight 8): where launches of a row's size were priced tightly,
// the band is narrow; where they scattered, it is wide. Read back against the test itself,
// bands drawn this way held the launch they priced 52% of the time — the half a median
// band should hold.
//
// Every farm plan is netted. A plan's cash costs are the gas its steps name, summed; its
// capital is the position its steps open. The netting assumes a qualifying wallet's expected
// take is 0.02% of the launch's value at the row's own band low end — a stated assumption,
// printed with the plan — and charges the plan its cash costs plus the Treasury-bill yield
// the deployed capital would have earned while it sat in the protocol (4% a year, the hold
// the plan itself sets). Net above zero with the take covering the whole cost twice over is
// a FARM; net above zero but thinner is a THIN; a take that does not cover the costs is a
// SKIP.
//
// The ranked board is pre-token only. Protocols that already trade are never ranked by the
// model: they are shown apart at the market's own value, and they are the evidence the curve
// stands on. The board covers the snapshot's whole watchlist, then every other standalone
// pre-token protocol: the watchlist's own hygiene (no exchanges, no wrapped, staked or
// bridged product of a token that already trades) is applied at every size. The re-audit
// reads the set-aside list again: a versioned deployment (a name ending in V2, V3 and the
// like) is ranked, flagged, when no un-versioned protocol of the same name is ranked — it
// is that protocol's current deployment, not a product of a traded token — and where
// several deployments of one name exist, only the largest is ranked and the rest are named
// in the audit. Everything still set aside is published in the audit with its reason: all
// 342 pre-token protocols are accounted for, ranked or named. The set-aside list was
// re-read line by line for this version: every one of the 134 is an exchange's custody
// page, a wrapped or staked product of a token that already trades, or a bridge of one,
// and none was restored.

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
  offset_shrink: number;
  lad_floor_dex: number;
  lad_max_iterations: number;
  band_neighbours: number;
  band_shrink: number;
  momentum_clamp_pct: number;
  momentum_weight: number;
  track_floor: number;
  track_range: number;
  track_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  wallet_share: number;
  tbill_rate: number;
  farm_margin: number;
}

export const MODEL: ModelConstants = {
  ratio_floor: 0.005,
  ratio_cap: 5,
  offset_shrink: 4,
  lad_floor_dex: 0.02,
  lad_max_iterations: 100,
  band_neighbours: 32,
  band_shrink: 8,
  momentum_clamp_pct: 30,
  momentum_weight: 0.9,
  track_floor: 0.85,
  track_range: 0.15,
  track_days: 1095,
  breadth_per_chain: 0.04,
  breadth_max_extra: 5,
  wallet_share: 0.0002,
  tbill_rate: 0.04,
  farm_margin: 2,
};

/** The model's version label: the dashboard names it beside the formula. */
export const MODEL_VERSION = 'launch-radar-4';

/** How many already-trading protocols the dashboard's calibration panel lists, by market cap. */
export const LIVE_ROWS = 40;

/** The fitted size curve and the offsets it leaves behind, from the calibration set. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  base_usd: number;
  comps: number;
}

/** One category's offset from the curve: how many comps, the mean residual, the multiple used. */
export interface CategoryOffset {
  category: string;
  sample_size: number;
  offset_dex: number;
  offset_multiple: number;
}

/** The blind leave-one-out test of the whole pricing function, over the traded launches. */
export interface Backtest {
  n: number;
  median_multiple: number;
  p25_multiple: number;
  p75_multiple: number;
  within_2x_pct: number;
  median_dex: number;
}

/** One walk-forward cutoff: fitted on the launches before it, priced against those after. */
export interface WalkForwardCutoff {
  cutoff: string;
  trained: number;
  tested: number;
  median_multiple: number;
  p25_multiple: number;
  p75_multiple: number;
  within_2x_pct: number;
}

/** The walk-forward test: the same function, fitted on the past and priced against the future. */
export interface WalkForward {
  dated: number;
  undated: number;
  tested: number;
  median_multiple: number;
  within_2x_pct: number;
  cutoffs: WalkForwardCutoff[];
}

/** A refinement the same two tests were offered, and what they answered. */
export interface RejectedTest {
  label: string;
  detail: string;
  loo_multiple: number;
  wf_multiple: number | null;
}

/** How the per-row band is read from the blind test, and how it scored against the test itself. */
export interface BandInfo {
  global_multiple: number;
  neighbours: number;
  shrink: number;
  coverage_pct: number;
  min_multiple: number;
  max_multiple: number;
}

/** One traded launch of the calibration set, with the error the blind test earned on it. */
export interface CompRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  loo_multiple: number;
}

/** The factor-by-factor account of one protocol's implied value. */
export interface ValueBreakdown {
  curve_base_usd: number;
  category_offset_multiple: number;
  category_offset_dex: number;
  category_sample: number;
  momentum_factor: number;
  momentum_pct: number | null;
  track_factor: number;
  age_days: number | null;
  breadth_factor: number;
  chain_count: number;
}

/** One farm plan's economics: what it deploys, what it costs, what it nets, and the verdict. */
export interface PlanEconomics {
  capital_usd: number;
  deployed_usd: number;
  cash_cost_usd: number;
  hurdle_usd: number;
  expected_take_usd: number;
  net_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
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
  flags: string[];
  age_days: number | null;
  implied_value_usd: number;
  band_multiple: number;
  band_low_usd: number;
  band_high_usd: number;
  model: ValueBreakdown;
  plan: PlanEconomics;
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

/** One pre-token protocol the board set aside, with the reason the screen gives. */
export interface AuditRow {
  slug: string;
  name: string;
  tvl_usd: number;
  reason: string;
}

/** Everything the dashboard renders: the board, the calibration set and the model that ran. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  constants: ModelConstants;
  fit: SizeCurve;
  backtest: Backtest;
  walkforward: WalkForward;
  band: BandInfo;
  rejected: RejectedTest[];
  comps: CompRow[];
  stats: {
    protocols: number;
    pre_token: number;
    board_rows: number;
    watchlist_size: number;
    watchlist_rows: number;
    early_rows: number;
    not_ranked: number;
    rescued: number;
    live_rows: number;
    calibration_size: number;
    verdicts: { FARM: number; THIN: number; SKIP: number };
  };
  offsets: CategoryOffset[];
  audit_reasons: { reason: string; count: number }[];
  set_aside: AuditRow[];
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

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The q-quantile of a non-empty list, nearest-rank. */
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[at]!;
}

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

/** The three adjustment factors, shared by the board, the detail view and the backtest. */
function adjustments(p: SnapshotProtocol, age: number | null, fallbackAgeDays: number, model: ModelConstants): { momentum: number; track: number; breadth: number } {
  const pct = p.change_7d === null ? 0 : clamp(p.change_7d, -model.momentum_clamp_pct, model.momentum_clamp_pct);
  const momentum = 1 + (pct / 100) * model.momentum_weight;
  const ageForTrack = age ?? fallbackAgeDays;
  const track = model.track_floor + (clamp(ageForTrack, 0, model.track_days) / model.track_days) * model.track_range;
  const breadth = 1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra);
  return { momentum, track, breadth };
}

interface CompPoint { x: number; y: number; category: string; protocol: SnapshotProtocol }

/** The calibration set as regression points: log TVL against log clamped market cap. */
function compPoints(protocols: SnapshotProtocol[], model: ModelConstants): CompPoint[] {
  const points: CompPoint[] = [];
  for (const p of protocols) {
    if (recordsNoToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = clamp(p.mcap_usd / p.tvl_usd, model.ratio_floor, model.ratio_cap);
    points.push({ x: Math.log10(p.tvl_usd), y: Math.log10(ratio * p.tvl_usd), category: p.category ?? UNCATEGORISED, protocol: p });
  }
  return points;
}

/** Weighted least squares for the line y = a + b x. */
function weightedLine(points: CompPoint[], weights: number[]): { a: number; b: number } {
  let sw = 0, mx = 0, my = 0;
  for (let i = 0; i < points.length; i++) {
    const w = weights[i]!;
    sw += w;
    mx += w * points[i]!.x;
    my += w * points[i]!.y;
  }
  mx /= sw;
  my /= sw;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < points.length; i++) {
    const w = weights[i]!;
    sxy += w * (points[i]!.x - mx) * (points[i]!.y - my);
    sxx += w * (points[i]!.x - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/**
 * The median fit: least absolute deviations by iteratively reweighted least squares.
 * Each round weighs a point by the inverse of its distance from the line, floored so a
 * point on the line cannot take infinite weight; the iteration is deterministic and
 * stops when the line stops moving. The result is the line half the launches sit above
 * and half below — the typical launch, not the average one.
 */
function medianLine(points: CompPoint[], model: ModelConstants): { a: number; b: number } {
  let { a, b } = weightedLine(points, points.map(() => 1));
  for (let round = 0; round < model.lad_max_iterations; round++) {
    const weights = points.map((pt) => 1 / Math.max(Math.abs(pt.y - (a + b * pt.x)), model.lad_floor_dex));
    const next = weightedLine(points, weights);
    const moved = Math.max(Math.abs(next.a - a), Math.abs(next.b - b));
    a = next.a;
    b = next.b;
    if (moved < 1e-12) break;
  }
  return { a, b };
}

/** Shrunken mean residuals per key: the offset machinery, shared by categories and the chain test. */
function shrunkenOffsets<T>(entries: { key: T; resid: number }[], shrink: number): Map<T, { dex: number; sample: number }> {
  const sums = new Map<T, { sum: number; count: number }>();
  for (const e of entries) {
    const cell = sums.get(e.key) ?? { sum: 0, count: 0 };
    cell.sum += e.resid;
    cell.count += 1;
    sums.set(e.key, cell);
  }
  const out = new Map<T, { dex: number; sample: number }>();
  for (const [key, cell] of sums) out.set(key, { dex: cell.sum / (cell.count + shrink), sample: cell.count });
  return out;
}

/** A fitted pricing model: the curve, the category offsets, and any variant's extra term. */
interface FittedModel {
  curve: SizeCurve;
  offsets: Map<string, CategoryOffset>;
  /** log10 price before the adjustments, for a protocol of the given size and record. */
  baseLog: (p: SnapshotProtocol) => number;
}

type Variant = 'base' | 'chain' | number; // number: a two-segment break, as log10 TVL

const CHAIN_TEST_SHRINK = 8;
const HINGE_BREAKS_USD = [25_000_000, 50_000_000, 100_000_000, 200_000_000];

/** Weighted least squares over an arbitrary basis, by the normal equations (2 or 3 terms). */
function weightedBasis(points: CompPoint[], weights: number[], basis: (x: number) => number[]): number[] {
  const d = basis(0).length;
  const A: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const v: number[] = new Array<number>(d).fill(0);
  for (let i = 0; i < points.length; i++) {
    const bx = basis(points[i]!.x);
    const w = weights[i]!;
    for (let r = 0; r < d; r++) {
      v[r] += w * bx[r] * points[i]!.y;
      for (let c = 0; c < d; c++) A[r]![c] += w * bx[r]! * bx[c]!;
    }
  }
  // Gaussian elimination with partial pivoting.
  const M = A.map((row, i) => [...row, v[i]!]);
  for (let col = 0; col < d; col++) {
    let piv = col;
    for (let r = col + 1; r < d; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    const swap = M[col]!;
    M[col] = M[piv]!;
    M[piv] = swap;
    for (let r = 0; r < d; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / M[col]![col]!;
      for (let c = col; c <= d; c++) M[r]![c] -= f * M[col]![c]!;
    }
  }
  return M.map((row, i) => row[d]! / row[i]!);
}

/** The median fit of a two-segment curve: one line, a second slope above the break. */
function medianHinge(points: CompPoint[], breakX: number, model: ModelConstants): (x: number) => number {
  const basis = (x: number): number[] => [1, x, Math.max(0, x - breakX)];
  let sol = weightedBasis(points, points.map(() => 1), basis);
  const predict = (s: number[]) => (x: number): number => s[0]! + s[1]! * x + s[2]! * Math.max(0, x - breakX);
  for (let round = 0; round < model.lad_max_iterations; round++) {
    const weights = points.map((pt) => 1 / Math.max(Math.abs(pt.y - predict(sol)(pt.x)), model.lad_floor_dex));
    const next = weightedBasis(points, weights, basis);
    const moved = Math.max(...next.map((n, i) => Math.abs(n - sol[i]!)));
    sol = next;
    if (moved < 1e-12) break;
  }
  return predict(sol);
}

/** Fit the model (or a variant of it, for the tests) on a set of calibration protocols. */
function fitModel(protocols: SnapshotProtocol[], model: ModelConstants, variant: Variant): FittedModel {
  const points = compPoints(protocols, model);
  let curveLog: (x: number) => number;
  let intercept: number;
  let slope: number;
  if (typeof variant === 'number') {
    curveLog = medianHinge(points, variant, model);
    intercept = curveLog(0);
    slope = curveLog(1) - intercept;
  } else {
    const { a, b } = medianLine(points, model);
    intercept = a;
    slope = b;
    curveLog = (x) => a + b * x;
  }
  const catOffsets = shrunkenOffsets(
    points.map((pt) => ({ key: pt.category, resid: pt.y - curveLog(pt.x) })),
    model.offset_shrink,
  );
  const offsets = new Map<string, CategoryOffset>();
  for (const [category, cell] of catOffsets) {
    offsets.set(category, { category, sample_size: cell.sample, offset_dex: round4(cell.dex), offset_multiple: round4(10 ** cell.dex) });
  }
  let extraDex: (p: SnapshotProtocol) => number = () => 0;
  if (variant === 'chain') {
    const chainOffsets = shrunkenOffsets(
      points.map((pt) => ({
        key: pt.protocol.chains[0] ?? 'Unrecorded',
        resid: pt.y - curveLog(pt.x) - (catOffsets.get(pt.category)?.dex ?? 0),
      })),
      CHAIN_TEST_SHRINK,
    );
    extraDex = (p) => chainOffsets.get(p.chains[0] ?? 'Unrecorded')?.dex ?? 0;
  }
  return {
    curve: { intercept: round4(intercept), slope: round4(slope), base_usd: Math.round(10 ** intercept), comps: points.length },
    offsets,
    baseLog: (p) => curveLog(Math.log10(Math.max(1, p.tvl_usd))) + (offsets.get(p.category ?? UNCATEGORISED)?.offset_dex ?? 0) + extraDex(p),
  };
}

/** The full pricing function over a fitted model: curve, offset, then the three adjustments. */
function priceWith(
  fit: FittedModel,
  p: SnapshotProtocol,
  age: number | null,
  fallbackAgeDays: number,
  model: ModelConstants,
): { implied: number; base: number; adj: { momentum: number; track: number; breadth: number } } {
  const base = 10 ** fit.baseLog(p);
  const adj = adjustments(p, age, fallbackAgeDays, model);
  return { implied: Math.max(1, Math.round(base * adj.momentum * adj.track * adj.breadth)), base, adj };
}

/** The error multiple of a price against the cap a launch actually trades at. */
function errorMultiple(implied: number, actual: number): number {
  return Math.max(implied / actual, actual / implied);
}

function testStats(multiples: number[], dexes: number[]): Backtest {
  return {
    n: multiples.length,
    median_multiple: round2(median(multiples)),
    p25_multiple: round2(quantile(multiples, 0.25)),
    p75_multiple: round2(quantile(multiples, 0.75)),
    within_2x_pct: Math.round((multiples.filter((m) => m <= 2).length / multiples.length) * 100),
    median_dex: round3(median(dexes)),
  };
}

/** One traded launch's blind-test run: the price it was given with itself left out. */
interface LooRun { slug: string; x: number; multiple: number; blind_usd: number }

/** The leave-one-out test of a variant: refit without each traded protocol, price it, compare. */
function looTest(snapshot: Snapshot, fallbackAgeDays: number, model: ModelConstants, variant: Variant): { stats: Backtest; runs: LooRun[] } {
  const comps = compPoints(snapshot.protocols, model).map((pt) => pt.protocol);
  const multiples: number[] = [];
  const dexes: number[] = [];
  const runs: LooRun[] = [];
  for (let i = 0; i < comps.length; i++) {
    const held = comps[i]!;
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitModel(rest, model, variant);
    const age = ageDays(snapshot.as_of, held.listed_at);
    const { implied } = priceWith(fit, held, age, fallbackAgeDays, model);
    const actual = held.mcap_usd!;
    multiples.push(errorMultiple(implied, actual));
    dexes.push(Math.abs(Math.log10(implied / actual)));
    runs.push({ slug: held.slug, x: Math.log10(Math.max(1, held.tvl_usd)), multiple: errorMultiple(implied, actual), blind_usd: implied });
  }
  return { stats: testStats(multiples, dexes), runs };
}

/** The walk-forward cutoffs: a cutoff runs only when at least this many launches predate it. */
const WF_CUTOFFS = ['2024-01-01', '2025-01-01'];
const WF_MIN_TRAIN = 30;
const WF_MIN_TEST = 8;

/** The walk-forward test of a variant: fit on the launches before a cutoff, price those after. */
function walkForwardTest(snapshot: Snapshot, fallbackAgeDays: number, model: ModelConstants, variant: Variant): WalkForward {
  const comps = compPoints(snapshot.protocols, model).map((pt) => pt.protocol);
  const dated = comps.filter((p) => p.listed_at !== null);
  const cutoffs: WalkForwardCutoff[] = [];
  const all: number[] = [];
  for (const cutoff of WF_CUTOFFS) {
    const train = dated.filter((p) => p.listed_at! < cutoff);
    const test = dated.filter((p) => p.listed_at! >= cutoff);
    if (train.length < WF_MIN_TRAIN || test.length < WF_MIN_TEST) continue;
    const fit = fitModel(train, model, variant);
    const multiples: number[] = [];
    const dexes: number[] = [];
    for (const p of test) {
      const age = ageDays(snapshot.as_of, p.listed_at);
      const { implied } = priceWith(fit, p, age, fallbackAgeDays, model);
      multiples.push(errorMultiple(implied, p.mcap_usd!));
      dexes.push(Math.abs(Math.log10(implied / p.mcap_usd!)));
    }
    const stats = testStats(multiples, dexes);
    cutoffs.push({
      cutoff, trained: train.length, tested: test.length,
      median_multiple: stats.median_multiple, p25_multiple: stats.p25_multiple,
      p75_multiple: stats.p75_multiple, within_2x_pct: stats.within_2x_pct,
    });
    all.push(...multiples);
  }
  return {
    dated: dated.length,
    undated: comps.length - dated.length,
    tested: all.length,
    median_multiple: all.length > 0 ? round2(median(all)) : 0,
    within_2x_pct: all.length > 0 ? Math.round((all.filter((m) => m <= 2).length / all.length) * 100) : 0,
    cutoffs,
  };
}

/**
 * The band for a protocol of a given size: the median blind-test error of the nearest
 * traded launches, shrunk toward the test's global median. Read back against the test
 * itself (each launch banded by the others), bands drawn this way held their launch
 * about half the time — the share a median band should hold.
 */
function localBand(x: number, runs: LooRun[], globalMedian: number, model: ModelConstants, excludeSlug?: string): number {
  const near = runs
    .filter((r) => r.slug !== excludeSlug)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x) || (a.slug < b.slug ? -1 : 1))
    .slice(0, model.band_neighbours);
  const local = median(near.map((r) => r.multiple));
  const k = near.length;
  return Math.exp((k * Math.log(local) + model.band_shrink * Math.log(globalMedian)) / (k + model.band_shrink));
}

/** The two refinements the tests were offered and turned down, with the numbers that decided. */
function rejectedTests(snapshot: Snapshot, fallbackAgeDays: number, model: ModelConstants): RejectedTest[] {
  const chainLoo = looTest(snapshot, fallbackAgeDays, model, 'chain');
  const chainWf = walkForwardTest(snapshot, fallbackAgeDays, model, 'chain');
  let bestHinge: { usd: number; median: number } | null = null;
  for (const usd of HINGE_BREAKS_USD) {
    const hinge = looTest(snapshot, fallbackAgeDays, model, Math.log10(usd));
    if (bestHinge === null || hinge.stats.median_multiple < bestHinge.median) bestHinge = { usd, median: hinge.stats.median_multiple };
  }
  return [
    {
      label: 'Home-chain offsets',
      detail: `a shrunken offset for the chain a protocol first lists on (prior weight ${CHAIN_TEST_SHRINK}), fitted after the category offsets`,
      loo_multiple: chainLoo.stats.median_multiple,
      wf_multiple: chainWf.median_multiple,
    },
    {
      label: 'A two-segment size curve',
      detail: `a second slope above a break in TVL; the best of the four breaks tried ($25M, $50M, $100M, $200M) was $${(bestHinge!.usd / 1_000_000).toFixed(0)}M`,
      loo_multiple: round2(bestHinge!.median),
      wf_multiple: null,
    },
  ];
}

/** Categories that are a product of another asset, or an exchange itself: tracked, never ranked. */
const PRODUCT_CATEGORIES = new Map<string, string>([
  ['CEX', 'an exchange’s own page: its TVL is customer custody, not a protocol a launch would price'],
  ['Liquid Staking', 'a liquid staking product of an asset that already trades'],
  ['Liquid Restaking', 'a liquid restaking product of assets that already trade'],
  ['Restaked BTC', 'a restaked-BTC product of an asset that already trades'],
  ['Bridge', 'a bridged-asset or bridge product of a token that already trades'],
  ['Canonical Bridge', 'a chain’s canonical bridge: the launch, if any, is the chain’s'],
]);
/** DefiLlama's version-marker rule: a name ending in a release is a deployment of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** The screen's verdict on one pre-token protocol: ranked, rescued with a flag, or set aside with a reason. */
type Screen =
  | { kind: 'ranked' }
  | { kind: 'versioned' }
  | { kind: 'aside'; reason: string };

function screen(p: SnapshotProtocol): Screen {
  const reasons: string[] = [];
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) reasons.push(PRODUCT_CATEGORIES.get(p.category)!);
  if (WRAPPED_WORD.test(p.name)) reasons.push('its name carries a wrapped, staked or staking word: a product of an asset that already trades');
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) reasons.push('its name begins with an exchange’s name');
  if (reasons.length > 0) return { kind: 'aside', reason: reasons.join('; ') };
  if (VERSIONED.test(p.name)) return { kind: 'versioned' };
  return { kind: 'ranked' };
}

/** The board: the whole watchlist, every standalone pre-token protocol, and the rescued deployments. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): {
  board: BoardRow[]; curve: SizeCurve; offsets: CategoryOffset[]; test: Backtest;
  walkforward: WalkForward; band: BandInfo; rejected: RejectedTest[]; comps: CompRow[];
  setAside: AuditRow[]; auditReasons: { reason: string; count: number }[]; rescued: number;
} {
  const fit = fitModel(snapshot.protocols, model, 'base');
  const curve = fit.curve;
  const ages = snapshot.protocols.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const fallbackAge = ages.length > 0 ? Math.round(median(ages)) : 365;
  const loo = looTest(snapshot, fallbackAge, model, 'base');
  const test = loo.stats;
  const walkforward = walkForwardTest(snapshot, fallbackAge, model, 'base');
  const rejected = rejectedTests(snapshot, fallbackAge, model);
  const globalBand = test.median_multiple;
  // The band machinery read back against the test itself: each launch banded by the others.
  let covered = 0;
  for (const run of loo.runs) {
    const band = localBand(run.x, loo.runs, globalBand, model, run.slug);
    const held = snapshot.protocols.find((p) => p.slug === run.slug)!;
    if (run.blind_usd / band <= held.mcap_usd! && held.mcap_usd! <= run.blind_usd * band) covered += 1;
  }
  const bandCoverage = Math.round((covered / loo.runs.length) * 100);
  const compBySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const comps: CompRow[] = loo.runs
    .map((run) => {
      const p = compBySlug.get(run.slug)!;
      return { slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd ?? 0, loo_multiple: round2(run.multiple) };
    })
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const watchlist = new Set(snapshot.watchlist);

  const chosen: { p: SnapshotProtocol; flags: string[] }[] = [];
  const setAside: AuditRow[] = [];
  const versioned: SnapshotProtocol[] = [];
  for (const p of snapshot.protocols) {
    if (!recordsNoToken(p)) continue;
    if (watchlist.has(p.slug)) { chosen.push({ p, flags: [] }); continue; }
    const verdict = screen(p);
    if (verdict.kind === 'ranked') chosen.push({ p, flags: [] });
    else if (verdict.kind === 'versioned') versioned.push(p);
    else setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason: verdict.reason });
  }
  // The re-audit: a versioned deployment is ranked, flagged, when no un-versioned protocol
  // of the same name is ranked; of several deployments of one name, only the largest is.
  const rankedNames = new Set(chosen.map((c) => c.p.name.toLowerCase()));
  const byBase = new Map<string, SnapshotProtocol[]>();
  for (const p of versioned) {
    const base = p.name.replace(VERSIONED, '').trim().toLowerCase();
    const group = byBase.get(base) ?? [];
    group.push(p);
    byBase.set(base, group);
  }
  let rescued = 0;
  for (const [base, group] of byBase) {
    group.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
    if (rankedNames.has(base)) {
      for (const p of group) setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason: `a versioned deployment of ${base}, which the board ranks under its own name` });
      continue;
    }
    chosen.push({ p: group[0]!, flags: ['Versioned deployment'] });
    rescued += 1;
    for (const p of group.slice(1)) setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason: `a superseded deployment of ${base}: the board ranks its largest deployment only` });
  }
  setAside.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const reasonCounts = new Map<string, number>();
  for (const row of setAside) reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
  const auditReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : 1));

  const scored = chosen.map(({ p, flags }) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const { implied, base, adj } = priceWith(fit, p, age, fallbackAge, model);
    const offset = fit.offsets.get(p.category ?? UNCATEGORISED) ?? null;
    return { p, flags, age, implied, base, offset, adj };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const bandMultiples: number[] = [];
  const board = scored.map((s, i) => {
    const band = localBand(Math.log10(Math.max(1, s.p.tvl_usd)), loo.runs, globalBand, model);
    bandMultiples.push(band);
    const plan = farmPlan(s.p, s.age, s.implied, band, model);
    return {
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
      flags: s.flags,
      age_days: s.age,
      implied_value_usd: s.implied,
      band_multiple: round2(band),
      band_low_usd: Math.max(1, Math.round(s.implied / band)),
      band_high_usd: Math.round(s.implied * band),
      model: {
        curve_base_usd: Math.round(s.base),
        category_offset_multiple: s.offset?.offset_multiple ?? 1,
        category_offset_dex: s.offset?.offset_dex ?? 0,
        category_sample: s.offset?.sample_size ?? 0,
        momentum_factor: round4(s.adj.momentum),
        momentum_pct: s.p.change_7d,
        track_factor: round4(s.adj.track),
        age_days: s.age,
        breadth_factor: round4(s.adj.breadth),
        chain_count: s.p.chains.length,
      },
      plan: plan.economics,
      farm_steps: plan.steps,
    };
  });
  const band: BandInfo = {
    global_multiple: globalBand,
    neighbours: model.band_neighbours,
    shrink: model.band_shrink,
    coverage_pct: bandCoverage,
    min_multiple: round2(Math.min(...bandMultiples)),
    max_multiple: round2(Math.max(...bandMultiples)),
  };
  const offsetTable = [...fit.offsets.values()].sort((a, b) => b.sample_size - a.sample_size || (a.category < b.category ? -1 : 1));
  return { board, curve, offsets: offsetTable, test, walkforward, band, rejected, comps, setAside, auditReasons, rescued };
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
  const { board, curve, offsets, test, walkforward, band, rejected, comps, setAside, auditReasons, rescued } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const verdicts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const row of board) verdicts[row.plan.verdict] += 1;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    constants: model,
    fit: curve,
    backtest: test,
    walkforward,
    band,
    rejected,
    comps,
    stats: {
      protocols: snapshot.protocols.length,
      pre_token: snapshot.protocols.filter(recordsNoToken).length,
      board_rows: board.length,
      watchlist_size: snapshot.watchlist.length,
      watchlist_rows: board.filter((r) => r.on_watchlist).length,
      early_rows: board.filter((r) => !r.on_watchlist).length,
      not_ranked: setAside.length,
      rescued,
      live_rows: live.length,
      calibration_size: curve.comps,
      verdicts,
    },
    offsets,
    audit_reasons: auditReasons,
    set_aside: setAside,
    rows: board,
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------------------
// Farm plans. Each plan is generated from the protocol's own record: its
// category's core action, its first two chains and what they cost to use, a
// capital tier from its TVL, and a holding window from its age. Every step
// states its cost and its time; no step is a slogan. The plan is then netted:
// its steps' gas summed, its capital charged the yield it would have earned
// elsewhere, and its expected take read off the launch's value at the row's
// own band low end.
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

/** The same chain cost as one number: the midpoint the plan's netting sums. */
function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 20;
  if (c === 'solana') return 0.05;
  if (c === 'bsc') return 0.3;
  if (c === 'avalanche') return 0.5;
  if (c === 'polygon') return 0.1;
  if (['arbitrum', 'base', 'optimism', 'zksync era', 'linea', 'scroll', 'mantle', 'blast', 'mode', 'taiko', 'starknet', 'manta', 'bob', 'berachain'].includes(c)) return 0.5;
  return 3;
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

const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * One protocol's farm plan: six steps, each an action with its cost and its time,
 * parameterised by the protocol's own chains, category, size and age — and the plan's
 * economics, netted against the launch's value at the row's own band low end.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null, implied: number, band: number, model: ModelConstants = MODEL): { steps: string[]; economics: PlanEconomics } {
  const chain = p.chains[0] ?? 'Ethereum';
  const second = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
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

  // The netting: the plan's own figures, charged against the launch at the row's band low end.
  const g1 = gasUsd(chain);
  const g2 = second !== null ? gasUsd(second) : g1;
  const cash = 2 * g1 + g1 + g2 + g1 * weeks;
  const deployed = capital + Math.round(capital / 4);
  const hurdle = deployed * model.tbill_rate * (hold / 365);
  const bandLow = implied / band;
  const take = model.wallet_share * bandLow;
  const net = take - cash - hurdle;
  const verdict: PlanEconomics['verdict'] = take >= model.farm_margin * (cash + hurdle) ? 'FARM' : net > 0 ? 'THIN' : 'SKIP';
  const verdictText = verdict === 'FARM'
    ? 'the take covers the whole cost at least twice over at the low end, so the plan pays for itself even if the launch lands at the band’s pessimistic edge'
    : verdict === 'THIN'
      ? 'the take covers the costs at the low end but with little to spare, so this one is a judgement call, not a clear farm'
      : 'the take does not cover the plan’s costs even before risk, so the plan is not worth its gas at the low end';
  steps.push(
    `Read the netting before committing: at the band's low end (${money(bandLow)}) a qualifying wallet's expected take is ${money(take)} — the model's stated ${(model.wallet_share * 100).toFixed(2)}% share — against ${money(cash)} of plan costs and ${money(hurdle)} of yield forgone on the ${money(deployed)} deployed: net ${money(net)}, verdict ${verdict}, because ${verdictText}. Cost: nothing further. Time: 5 minutes, once.`,
  );
  const economics: PlanEconomics = {
    capital_usd: capital,
    deployed_usd: deployed,
    cash_cost_usd: round2(cash),
    hurdle_usd: round2(hurdle),
    expected_take_usd: Math.round(take),
    net_usd: Math.round(net),
    verdict,
  };
  return { steps, economics };
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
