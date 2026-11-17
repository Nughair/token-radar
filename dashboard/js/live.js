// The masthead figures, the model panel (the fitted curve, the blind backtest that prices
// it, its factors, the netting rules, the offset table and the audit of everything the
// board set aside) and the already-trading table the curve is fitted to.
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

  function renderModel() {
    var s = DATA.stats;
    var c = DATA.constants;
    var fit = DATA.fit;
    var bt = DATA.backtest;
    var host = document.getElementById('model-body');
    host.appendChild(A.el('p', { class: 'formula' },
      'Implied value = ', A.el('b', null, '$' + fit.base_usd + ' × TVL^' + fit.slope.toFixed(2)),
      ' (the fitted size curve) × ', A.el('b', null, 'category offset'), ' × ', A.el('b', null, 'momentum'),
      ' × ', A.el('b', null, 'track record'), ' × ', A.el('b', null, 'breadth')));

    // The blind test, first: it is the evidence the whole board stands on.
    host.appendChild(A.el('h3', null, 'The blind test — this function, priced against launches that already happened'));
    host.appendChild(A.el('p', { class: 'section-note' },
      'The test refits the curve and the offsets ' + bt.n + ' times, each time leaving one traded protocol out, ' +
      'then prices the left-out protocol with the full function — curve, its category\u2019s offset, its own momentum, ' +
      'track record and breadth — and compares the price with the market cap it actually trades at. Nothing in the ' +
      'test was tuned after it ran: these are the errors the function earned, and the band printed around every ' +
      'row of the board is its median error.'));
    var tiles = A.el('div', { class: 'stats' });
    tiles.appendChild(stat('×' + bt.median_multiple.toFixed(2), 'median error, the board\u2019s band'));
    tiles.appendChild(stat(String(bt.n), 'launches tested, one at a time'));
    tiles.appendChild(stat(bt.within_2x_pct + '%', 'priced within ×2 of the market'));
    tiles.appendChild(stat('×' + bt.p25_multiple.toFixed(2) + ' – ×' + bt.p75_multiple.toFixed(2), 'the middle half of errors'));
    host.appendChild(tiles);

    var factors = A.el('div', { class: 'factors' });
    factors.appendChild(factorCard('Size curve — what the traded launches trace',
      'An ordinary least-squares line through log market cap against log TVL over the ' + fit.comps + ' protocols ' +
      'whose token already trades, each ratio first winsorised to [' + c.ratio_floor + ', ' + c.ratio_cap + '] so one ' +
      'protocol pricing an off-chain business cannot bend the line. The slope is ' + fit.slope.toFixed(2) + ', not 1: ' +
      'worth grows slower than TVL, which is what the launches themselves say.'));
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
      'launch\u2019s value at the band\u2019s low end — a stated assumption, not a reading of any protocol\u2019s plans — ' +
      'and charges the plan those costs plus the Treasury-bill yield the deployed capital would have earned while ' +
      'it sat in the protocol (' + (c.tbill_rate * 100).toFixed(0) + '% a year over the plan\u2019s own hold). ' +
      'FARM: the take covers the whole cost at least ' + c.farm_margin + ' times over. THIN: the net is positive but ' +
      'thinner than that. SKIP: the take does not cover the costs. Across the board: ' +
      s.verdicts.FARM + ' FARM, ' + s.verdicts.THIN + ' THIN, ' + s.verdicts.SKIP + ' SKIP.'));

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
      'deployment, not a product of a traded token). The ' + s.not_ranked + ' set aside, by reason:'));
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
      ['The band is earned, not chosen. ', 'Half of the traded launches in the blind test landed within ×' + bt.median_multiple.toFixed(2) + ' of the price this function gave them. A row\u2019s band is that error, applied to the row — wide, because pricing a launch from TVL is genuinely uncertain, and printed because hiding it would be worse.'],
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
