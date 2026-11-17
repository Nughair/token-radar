// The ranked board: a sortable, filterable table of every pre-token protocol the radar ranks.
// State lives here; detail.js opens a row, main.js routes the URL hash into setState.
(function () {
  'use strict';

  var A = window.RadarApp;
  var DATA = window.RADAR;
  var state = { q: '', status: 'all', category: 'all', chain: 'all', verdict: 'all', sort: 'rank', dir: 1 };
  var onSelect = function () {};

  var VERDICT_ORDER = { FARM: 0, THIN: 1, SKIP: 2 };

  function matches(row) {
    if (state.status === 'watchlist' && !row.on_watchlist) return false;
    if (state.status === 'early' && row.on_watchlist) return false;
    if (state.category !== 'all' && (row.category || 'Uncategorised') !== state.category) return false;
    if (state.chain !== 'all' && row.chains.indexOf(state.chain) === -1) return false;
    if (state.verdict !== 'all' && row.plan.verdict !== state.verdict) return false;
    if (state.q) {
      var hay = (row.name + ' ' + row.slug + ' ' + (row.category || '')).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  var SORTERS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    age: function (r) { return r.age_days === null ? -1 : r.age_days; },
    implied: function (r) { return r.implied_value_usd; },
    net: function (r) { return r.plan.net_usd; },
    verdict: function (r) { return VERDICT_ORDER[r.plan.verdict]; },
  };

  function visibleRows() {
    var rows = DATA.rows.filter(matches);
    var key = SORTERS[state.sort] || SORTERS.rank;
    rows.sort(function (a, b) {
      var x = key(a), y = key(b);
      if (x < y) return -state.dir;
      if (x > y) return state.dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function rowNode(row) {
    var badge = row.on_watchlist
      ? A.el('span', { class: 'badge badge-watch' }, 'Watchlist')
      : A.el('span', { class: 'badge badge-early' }, 'Early find');
    var nameCell = A.el('td', { class: 'name' }, row.name, A.el('small', null, row.category || 'Uncategorised'));
    if (row.flags && row.flags.length > 0) {
      nameCell.appendChild(A.el('small', { class: 'flag-note' }, row.flags.join(' · ')));
    }
    var impliedCell = A.el('td', { class: 'num implied' }, A.fmtUsd(row.implied_value_usd),
      A.el('small', { class: 'band' }, 'band ' + A.fmtUsd(row.band_low_usd) + ' – ' + A.fmtUsd(row.band_high_usd)));
    var tr = A.el('tr', { onclick: function () { onSelect(row.slug); } },
      A.el('td', { class: 'rank num' }, String(row.rank)),
      nameCell,
      A.el('td', null, badge),
      A.el('td', { class: 'num' }, A.fmtUsd(row.tvl_usd)),
      A.el('td', { class: 'num ' + A.pctClass(row.change_7d) }, A.fmtPct(row.change_7d)),
      A.el('td', { class: 'num' }, A.fmtAge(row.age_days)),
      A.el('td', { class: 'num' }, String(row.chains.length)),
      impliedCell,
      A.el('td', { class: 'num ' + (row.plan.net_usd >= 0 ? 'pos' : 'neg') }, A.fmtSigned(row.plan.net_usd)),
      A.el('td', null, A.el('span', { class: 'verdict verdict-' + row.plan.verdict.toLowerCase() }, row.plan.verdict)));
    return tr;
  }

  function render() {
    var rows = visibleRows();
    var body = document.getElementById('board-body');
    body.textContent = '';
    rows.forEach(function (row) { body.appendChild(rowNode(row)); });
    document.getElementById('count').textContent =
      'Showing ' + rows.length + ' of ' + DATA.rows.length + ' ranked protocols';
    document.querySelectorAll('#board-table th.sortable').forEach(function (th) {
      var label = th.getAttribute('data-label') || th.textContent;
      th.setAttribute('data-label', label);
      th.textContent = label;
      if (th.getAttribute('data-sort') === state.sort) {
        th.appendChild(A.el('span', { class: 'arrow' }, state.dir === 1 ? ' ▲' : ' ▼'));
      }
    });
  }

  function fillSelect(id, values, allLabel) {
    var select = document.getElementById(id);
    select.textContent = '';
    select.appendChild(A.el('option', { value: 'all' }, allLabel));
    values.forEach(function (v) { select.appendChild(A.el('option', { value: v }, v)); });
  }

  function init(selectHandler) {
    onSelect = selectHandler;
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains; }))).sort();
    fillSelect('category', categories, 'All categories');
    fillSelect('chain', chains, 'All chains');
    fillSelect('verdict', ['FARM', 'THIN', 'SKIP'], 'All verdicts');
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
    document.getElementById('category').addEventListener('change', function (e) { state.category = e.target.value; render(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
    document.getElementById('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; render(); });
    document.querySelectorAll('.segmented button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.status = btn.getAttribute('data-status');
        document.querySelectorAll('.segmented button').forEach(function (b) { b.classList.toggle('on', b === btn); });
        render();
      });
    });
    document.querySelectorAll('#board-table th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = key === 'name' || key === 'verdict' ? 1 : -1; if (key === 'rank') state.dir = 1; }
        render();
      });
    });
    render();
  }

  // Apply a partial state from the URL hash (used for deep links and the screenshots).
  function setState(patch) {
    for (var k in patch) state[k] = patch[k];
    document.querySelectorAll('.segmented button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-status') === state.status);
    });
    var cat = document.getElementById('category');
    if (cat) cat.value = state.category;
    var ch = document.getElementById('chain');
    if (ch) ch.value = state.chain;
    var vd = document.getElementById('verdict');
    if (vd) vd.value = state.verdict;
    render();
  }

  A.board = { init: init, setState: setState };
})();
