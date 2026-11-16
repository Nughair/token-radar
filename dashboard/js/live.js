// The masthead figures, the model panel (the formula, its four factors and the calibration
// table behind every multiple) and the already-trading table the multiples are drawn from.
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
    box.appendChild(stat(String(s.not_ranked), 'wrappers & exchanges, not ranked'));
    box.appendChild(stat(String(s.calibration_size), 'trading launches calibrate it'));
  }

  function factorCard(title, body) {
    return A.el('div', { class: 'factor' }, A.el('h3', null, title), A.el('p', null, body));
  }

  function renderModel() {
    var s = DATA.stats;
    var c = DATA.constants;
    var host = document.getElementById('model-body');
    host.appendChild(A.el('p', { class: 'formula' },
      'Implied value = TVL × ', A.el('b', null, 'category multiple'), ' × ', A.el('b', null, 'momentum'),
      ' × ', A.el('b', null, 'track record'), ' × ', A.el('b', null, 'breadth')));

    var factors = A.el('div', { class: 'factors' });
    factors.appendChild(factorCard('Category multiple — what the market pays for $1 of TVL',
      'The median market-cap-to-TVL ratio of the protocols in the same category whose token already trades, ' +
      'winsorised to [' + c.ratio_floor + ', ' + c.ratio_cap + '] and shrunk toward the market median (' +
      DATA.stats.global_median_ratio.toFixed(3) + '×) by sample size. Categories whose value mostly belongs ' +
      'to depositors get low multiples; categories the market pays up for get higher ones. Either way the ' +
      'number is the market\u2019s own verdict, not this board\u2019s opinion.'));
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

    host.appendChild(A.el('h3', null, 'The calibration table — every multiple, with its evidence'));
    var table = A.el('table', null);
    var head = A.el('tr', null,
      A.el('th', null, 'Category'), A.el('th', { class: 'num' }, 'Trading launches sampled'),
      A.el('th', { class: 'num' }, 'Median MCap / TVL'), A.el('th', { class: 'num' }, 'Multiple used'));
    table.appendChild(A.el('thead', null, head));
    var tbody = A.el('tbody', null);
    DATA.multiples.forEach(function (row) {
      if (row.sample_size === 0) return;
      var tr = A.el('tr', null,
        A.el('td', null, row.category),
        A.el('td', { class: 'num' }, String(row.sample_size)),
        A.el('td', { class: 'num' }, A.fmtMultiple(row.median_ratio)),
        A.el('td', { class: 'num' }, A.fmtMultiple(row.multiple)));
      tr.style.cursor = 'default';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    host.appendChild(table);

    var notes = A.el('ul', { class: 'model-notes' });
    [
      ['Pre-token only. ', 'The ranked board never contains a protocol whose token trades. Those are the calibration set above — shown at the market\u2019s own value, never at a model\u2019s.'],
      ['The watchlist is the floor. ', 'All ' + s.watchlist_size + ' watchlist protocols are ranked, and so is every other standalone pre-token protocol in the snapshot, down to $5M of TVL: ' + s.early_rows + ' early finds below the $50M line.'],
      ['Wrappers are not launches. ', s.not_ranked + ' pre-token records are exchanges, versioned pools, or wrapped, staked and bridged products of tokens that already trade. They are counted here and excluded from the ranking, at every size — the same screen the watchlist itself uses.'],
      ['Thin evidence is shrunk. ', 'A category with few trading launches is priced mostly by the market median; the sample size behind every multiple is printed in the table, so a reader can discount a thin one themselves.'],
      ['No names are special-cased. ', 'One function scores every row from the snapshot\u2019s figures. Re-run the program on the same snapshot and every figure on this page comes back byte for byte.'],
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
