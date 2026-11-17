// The masthead figures, the model panel (the fitted curve, the two blind tests that price
// it, the chart of the evidence, its factors, the netting rules, the refinements the tests
// rejected, the offset table and the audit of everything the board set aside) and the
// already-trading table the curve is fitted to.
(function () {
  'use strict';

  var A = window.RadarApp;
  var DATA = window.RADAR;

  function stat(value, label, cls) {
    return A.el('div', { class: 'stat' + (cls ? ' ' + cls : '') },
      A.el('b', null, value), A.el('span', null, label));
  }

  function renderStats() {
    var s = DATA.stats;
    document.getElementById('provenance').textContent =
      'Snapshot: ' + DATA.source + ' · as of ' + DATA.as_of + ' · model ' + DATA.model_version + ', run on the snapshot\u2019s own figures only';
    var box = document.getElementById('stats');
    box.appendChild(stat(String(s.protocols), 'protocols scanned'));
    box.appendChild(stat(String(s.pre_token), 'record no token'));
    box.appendChild(stat(String(s.board_rows), 'ranked on the board', 'hot'));
    box.appendChild(stat(s.watchlist_rows + ' / ' + s.watchlist_size, 'watchlist covered', 'watch'));
    box.appendChild(stat(String(s.not_ranked), 'set aside, each with a reason'));
    box.appendChild(stat(String(s.calibration_size), 'trading launches calibrate it'));
  }

  function factorCard(title, body) {
    return A.el('div', { class: 'factor' }, A.el('h3', null, title), A.el('p', null, body));
  }

  // The evidence as one picture: every traded launch at the cap it trades at, the fitted
  // curve through them with its global band, and every board row at its implied value.
  // Drawn from the same data the model fitted — nothing here is placed by hand.
  function scatterSvg() {
    var W = 720, H = 352, L = 66, R = 14, T = 10, B = 32;
    var fit = DATA.fit;
    var xs = [], ys = [];
    DATA.comps.forEach(function (c) { xs.push(Math.log10(c.tvl_usd)); ys.push(Math.log10(c.mcap_usd)); });
    DATA.rows.forEach(function (r) { xs.push(Math.log10(r.tvl_usd)); ys.push(Math.log10(r.implied_value_usd)); });
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    function px(x) { return L + ((x - x0) / (x1 - x0)) * (W - L - R); }
    function py(y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); }
    function lineY(x) { return fit.intercept + fit.slope * x; }
    var bandDex = Math.log10(DATA.band.global_multiple);
    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Traded launches, the fitted size curve, and the board\u2019s implied values">'];
    for (var gx = x0; gx <= x1; gx++) {
      out.push('<line x1="' + px(gx) + '" y1="' + T + '" x2="' + px(gx) + '" y2="' + (H - B) + '" stroke="#17233a" stroke-width="1"/>');
      out.push('<text x="' + px(gx) + '" y="' + (H - B + 20) + '" fill="#5d6f8a" font-size="11" text-anchor="middle">' + A.fmtUsd(Math.pow(10, gx)) + '</text>');
    }
    for (var gy = y0; gy <= y1; gy++) {
      out.push('<line x1="' + L + '" y1="' + py(gy) + '" x2="' + (W - R) + '" y2="' + py(gy) + '" stroke="#17233a" stroke-width="1"/>');
      out.push('<text x="' + (L - 8) + '" y="' + (py(gy) + 4) + '" fill="#5d6f8a" font-size="11" text-anchor="end">' + A.fmtUsd(Math.pow(10, gy)) + '</text>');
    }
    out.push('<path d="M' + px(x0) + ' ' + py(lineY(x0) + bandDex) + ' L' + px(x1) + ' ' + py(lineY(x1) + bandDex) +
      ' L' + px(x1) + ' ' + py(lineY(x1) - bandDex) + ' L' + px(x0) + ' ' + py(lineY(x0) - bandDex) + ' Z" fill="rgba(240,182,76,0.08)"/>');
    out.push('<line x1="' + px(x0) + '" y1="' + py(lineY(x0)) + '" x2="' + px(x1) + '" y2="' + py(lineY(x1)) + '" stroke="#f0b64c" stroke-width="2"/>');
    DATA.comps.forEach(function (c) {
      out.push('<circle cx="' + px(Math.log10(c.tvl_usd)).toFixed(1) + '" cy="' + py(Math.log10(c.mcap_usd)).toFixed(1) + '" r="3" fill="#2dd4bf" fill-opacity="0.75"/>');
    });
    DATA.rows.forEach(function (r) {
      out.push('<circle cx="' + px(Math.log10(r.tvl_usd)).toFixed(1) + '" cy="' + py(Math.log10(r.implied_value_usd)).toFixed(1) + '" r="2.6" fill="none" stroke="#f0b64c" stroke-opacity="0.85"/>');
    });
    out.push('</svg>');
    return out.join('');
  }

  function renderModel() {
    var s = DATA.stats;
    var c = DATA.constants;
    var fit = DATA.fit;
    var bt = DATA.backtest;
    var wf = DATA.walkforward;
    var band = DATA.band;
    var host = document.getElementById('model-body');
    host.appendChild(A.el('p', { class: 'formula' },
      'Implied value = ', A.el('b', null, '$' + fit.base_usd + ' × TVL^' + fit.slope.toFixed(2)),
      ' (the fitted size curve, a median fit) × ', A.el('b', null, 'category offset'), ' × ', A.el('b', null, 'momentum'),
      ' × ', A.el('b', null, 'track record'), ' × ', A.el('b', null, 'breadth')));

    // The blind tests, first: they are the evidence the whole board stands on.
    host.appendChild(A.el('h3', null, 'The blind tests — this function, priced against launches that already happened'));
    host.appendChild(A.el('p', { class: 'section-note' },
      'Two tests, run two different ways, neither tuned after it ran. Leave-one-out: the fit is repeated ' + bt.n +
      ' times, each time leaving one traded protocol out, then the left-out protocol is priced with the full function — ' +
      'curve, its category\u2019s offset, its own momentum, track record and breadth — and compared with the market cap ' +
      'it actually trades at. Walk-forward: the fit is made only on the launches DefiLlama tracked before a cutoff, ' +
      'then priced against the launches that came after — the model tested the way it is used, on a future it had not seen. ' +
      wf.undated + ' of the ' + bt.n + ' traded launches carry no tracking date, so they can sit only the first test.'));
    var tiles = A.el('div', { class: 'stats' });
    tiles.appendChild(stat('×' + bt.median_multiple.toFixed(2), 'leave-one-out median error'));
    tiles.appendChild(stat('×' + wf.median_multiple.toFixed(2), 'walk-forward median error'));
    tiles.appendChild(stat(bt.within_2x_pct + '%', 'priced within ×2, leave-one-out'));
    tiles.appendChild(stat(wf.within_2x_pct + '%', 'priced within ×2, walk-forward'));
    host.appendChild(tiles);
    var wtable = A.el('table', { class: 'wf-table' });
    wtable.appendChild(A.el('thead', null, A.el('tr', null,
      A.el('th', null, 'Walk-forward cutoff'), A.el('th', { class: 'num' }, 'Fitted on'),
      A.el('th', { class: 'num' }, 'Priced'), A.el('th', { class: 'num' }, 'Median error'),
      A.el('th', { class: 'num' }, 'Middle half'), A.el('th', { class: 'num' }, 'Within ×2'))));
    var wbody = A.el('tbody', null);
    wf.cutoffs.forEach(function (row) {
      var tr = A.el('tr', null,
        A.el('td', null, 'Launches tracked before ' + row.cutoff),
        A.el('td', { class: 'num' }, String(row.trained)),
        A.el('td', { class: 'num' }, String(row.tested)),
        A.el('td', { class: 'num' }, '×' + row.median_multiple.toFixed(2)),
        A.el('td', { class: 'num' }, '×' + row.p25_multiple.toFixed(2) + ' – ×' + row.p75_multiple.toFixed(2)),
        A.el('td', { class: 'num' }, row.within_2x_pct + '%'));
      tr.style.cursor = 'default';
      wbody.appendChild(tr);
    });
    wtable.appendChild(wbody);
    host.appendChild(wtable);
    host.appendChild(A.el('p', { class: 'section-note' },
      'The band around each row is read locally from the leave-one-out runs: the median error of the ' + band.neighbours +
      ' traded launches nearest the row\u2019s own size, shrunk toward the test\u2019s global median (×' + band.global_multiple.toFixed(2) +
      ', prior weight ' + band.shrink + '). Across the board the bands run ×' + band.min_multiple.toFixed(2) + ' to ×' + band.max_multiple.toFixed(2) +
      '. Read back against the test itself — each launch banded by the others — bands drawn this way held the launch they priced ' +
      band.coverage_pct + '% of the time, the half a median band should hold.'));

    host.appendChild(A.el('h3', null, 'The evidence — every traded launch, and where the board\u2019s claims sit'));
    var chart = A.el('div', { class: 'chart-wrap' });
    chart.innerHTML = scatterSvg();
    host.appendChild(chart);
    host.appendChild(A.el('p', { class: 'chart-legend' },
      'Teal dots: the ' + DATA.comps.length + ' traded launches, at the market cap they trade at. Amber rings: this board\u2019s ' +
      s.board_rows + ' rows, at their implied values. The amber line is the fitted curve; the shaded span is its global band, ' +
      '÷/× ' + band.global_multiple.toFixed(2) + '. Both axes are log scales; the chart is drawn by this page from the same figures the model fitted.'));

    var factors = A.el('div', { class: 'factors' });
    factors.appendChild(factorCard('Size curve — what the traded launches trace',
      'A line through log market cap against log TVL over the ' + fit.comps + ' protocols whose token already trades, ' +
      'fitted to the median launch — half above it, half below — with each ratio first clamped to [' + c.ratio_floor + ', ' +
      c.ratio_cap + '] so a data error cannot dominate. A mean fit is pulled toward the few launches that priced an ' +
      'off-chain business; the median answers what the typical launch of a size was worth. The slope is ' + fit.slope.toFixed(2) +
      ', not 1: worth grows slower than TVL, which is what the launches themselves say.'));
    factors.appendChild(factorCard('Category offset — what a category adds',
      'Each category\u2019s mean distance from the curve, shrunk toward the curve itself by sample size (prior weight ' +
      c.offset_shrink + '), so a category with one traded launch borrows almost all of the curve and one with fifteen ' +
      'mostly speaks for itself. The offsets are printed in the table below, with the sample behind each.'));
    factors.appendChild(factorCard('Momentum — is the TVL arriving or leaving?',
      'The protocol\u2019s 7-day TVL change, clamped to ±' + c.momentum_clamp_pct + '% and taken at ' +
      c.momentum_weight + ' weight: a factor of 0.73 to 1.27. A protocol shrinking into its launch is ' +
      'marked down; one growing into it is marked up. Unreported change counts as flat.'));
    factors.appendChild(factorCard('Track record — how long with no token?',
      'Days DefiLlama has tracked the protocol, against a 3-year yardstick: ' + c.track_floor + ' to ' +
      (c.track_floor + c.track_range).toFixed(2) + '. The longer a protocol has run without a token, the more ' +
      'its eventual launch is the event the record points to — and the more aged activity a farmer can show.'));
    factors.appendChild(factorCard('Breadth — how many chains deep?',
      '+' + Math.round(c.breadth_per_chain * 100) + '% for each chain beyond the first, up to ' +
      c.breadth_max_extra + ' extra chains (1.00 to 1.20). A launch usually reaches every chain a ' +
      'protocol serves, so breadth widens the claim — and the farm.'));
    host.appendChild(factors);

    host.appendChild(A.el('h3', null, 'How every plan is netted'));
    host.appendChild(A.el('p', { class: 'section-note' },
      'Each plan\u2019s cash costs are the gas its own steps name, summed at the midpoint of each chain\u2019s range. ' +
      'The netting assumes a qualifying wallet\u2019s expected take is ' + (c.wallet_share * 100).toFixed(2) + '% of the ' +
      'launch\u2019s value at the row\u2019s own band low end — a stated assumption, not a reading of any protocol\u2019s plans — ' +
      'and charges the plan those costs plus the Treasury-bill yield the deployed capital would have earned while ' +
      'it sat in the protocol (' + (c.tbill_rate * 100).toFixed(0) + '% a year over the plan\u2019s own hold). ' +
      'FARM: the take covers the whole cost at least ' + c.farm_margin + ' times over. THIN: the net is positive but ' +
      'thinner than that. SKIP: the take does not cover the costs. Across the board: ' +
      s.verdicts.FARM + ' FARM, ' + s.verdicts.THIN + ' THIN, ' + s.verdicts.SKIP + ' SKIP.'));

    host.appendChild(A.el('h3', null, 'Tested and rejected — what the model does not do, and why'));
    host.appendChild(A.el('p', { class: 'section-note' },
      'A refinement earns its place only if both blind tests prefer it. These two were offered the same tests and turned down:'));
    var rlist = A.el('ul', { class: 'model-notes' });
    DATA.rejected.forEach(function (t) {
      var line = t.label + ' — ' + t.detail + '. Leave-one-out: ×' + t.loo_multiple.toFixed(2) +
        ' (the model: ×' + bt.median_multiple.toFixed(2) + ')';
      if (t.wf_multiple !== null) {
        line += '; walk-forward: ×' + t.wf_multiple.toFixed(2) + ' (the model: ×' + wf.median_multiple.toFixed(2) + ')';
      }
      line += '. Left out.';
      rlist.appendChild(A.el('li', null, line));
    });
    host.appendChild(rlist);

    host.appendChild(A.el('h3', null, 'The category offsets — with the evidence behind each'));
    var table = A.el('table', null);
    var head = A.el('tr', null,
      A.el('th', null, 'Category'), A.el('th', { class: 'num' }, 'Traded launches sampled'),
      A.el('th', { class: 'num' }, 'Offset from the curve'));
    table.appendChild(A.el('thead', null, head));
    var tbody = A.el('tbody', null);
    DATA.offsets.forEach(function (row) {
      var tr = A.el('tr', null,
        A.el('td', null, row.category),
        A.el('td', { class: 'num' }, String(row.sample_size)),
        A.el('td', { class: 'num' }, A.fmtMultiple(row.offset_multiple)));
      tr.style.cursor = 'default';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);

    host.appendChild(A.el('h3', null, 'The audit — every pre-token protocol accounted for'));
    host.appendChild(A.el('p', { class: 'section-note' },
      'Of the ' + s.pre_token + ' protocols that record no token, ' + s.board_rows + ' are ranked: the ' +
      s.watchlist_size + ' watchlist protocols, every other standalone protocol the screen passes, and ' +
      s.rescued + ' versioned deployments the re-audit rescued (a name ending in a version marker, ranked ' +
      'flagged when no un-versioned protocol of the same name is ranked — it is that protocol\u2019s current ' +
      'deployment, not a product of a traded token). The set-aside list was re-read line by line for this version: ' +
      'every one of the ' + s.not_ranked + ' is an exchange\u2019s custody page, a wrapped or staked product of a token ' +
      'that already trades, or a bridge of one, and none was restored. The ' + s.not_ranked + ' set aside, by reason:'));
    var reasonList = A.el('ul', { class: 'model-notes' });
    DATA.audit_reasons.forEach(function (r) {
      reasonList.appendChild(A.el('li', null, A.el('b', null, r.count + ' — '), r.reason));
    });
    host.appendChild(reasonList);
    var details = A.el('details', { class: 'audit' });
    details.appendChild(A.el('summary', null, 'Every set-aside protocol, named'));
    var atable = A.el('table', null);
    var ahead = A.el('tr', null,
      A.el('th', null, 'Protocol'), A.el('th', { class: 'num' }, 'TVL'), A.el('th', null, 'Why it is not ranked'));
    atable.appendChild(A.el('thead', null, ahead));
    var abody = A.el('tbody', null);
    DATA.set_aside.forEach(function (row) {
      var tr = A.el('tr', null,
        A.el('td', { class: 'name' }, row.name),
        A.el('td', { class: 'num' }, A.fmtUsd(row.tvl_usd)),
        A.el('td', null, row.reason));
      tr.style.cursor = 'default';
      abody.appendChild(tr);
    });
    atable.appendChild(abody);
    details.appendChild(atable);
    host.appendChild(details);

    var notes = A.el('ul', { class: 'model-notes' });
    [
      ['Pre-token only. ', 'The ranked board never contains a protocol whose token trades. Those are the calibration set below — shown at the market\u2019s own value, never at a model\u2019s.'],
      ['The watchlist is the floor. ', 'All ' + s.watchlist_size + ' watchlist protocols are ranked; the board\u2019s other ' + s.early_rows + ' rows are early finds the same screen passes below the $50M line.'],
      ['Two tests, not one. ', 'Leave-one-out can flatter a pattern the present happens to hold; the walk-forward test is the check on that — it is the test that vetoed the home-chain offsets above. A number is only printed here if a blind test earned it.'],
      ['The band is local, and earned. ', 'A row\u2019s band is the blind test\u2019s error among launches of the row\u2019s own size, not a round number chosen for the page — wide, because pricing a launch from TVL is genuinely uncertain, and printed because hiding it would be worse.'],
      ['Thin evidence is shrunk. ', 'A category with few traded launches is priced mostly by the curve; the sample size behind every offset is printed in the table, so a reader can discount a thin one themselves.'],
      ['No names are special-cased. ', 'One function prices every row from the snapshot\u2019s figures, and the same function computes the board and this page — re-run the program and every figure comes back byte for byte.'],
    ].forEach(function (pair) {
      notes.appendChild(A.el('li', null, A.el('b', null, pair[0]), pair[1]));
    });
    host.appendChild(notes);
  }

  function renderLive() {
    var body = document.getElementById('live-body');
    DATA.live.forEach(function (row) {
      body.appendChild(A.el('tr', null,
        A.el('td', { class: 'name' }, row.name, A.el('small', null, row.slug)),
        A.el('td', null, row.symbol || '—'),
        A.el('td', null, row.category || 'Uncategorised'),
        A.el('td', { class: 'num' }, A.fmtUsd(row.tvl_usd)),
        A.el('td', { class: 'num' }, A.fmtUsd(row.mcap_usd)),
        A.el('td', { class: 'num' }, row.ratio === null ? 'n/a' : row.ratio.toFixed(3) + '×'),
        A.el('td', { class: 'num ' + A.pctClass(row.change_7d) }, A.fmtPct(row.change_7d))));
    });
  }

  A.panels = { renderStats: renderStats, renderModel: renderModel, renderLive: renderLive };
})();
