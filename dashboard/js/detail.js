// The detail drawer: one protocol's record, the workings behind its implied value — every
// factor named, sized and drawn — and its farm plan, step by step.
(function () {
  'use strict';

  var A = window.RadarApp;
  var DATA = window.RADAR;
  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });

  function fig(label, value) {
    return A.el('div', { class: 'fig' }, A.el('span', null, label), A.el('b', null, value));
  }

  // A factor's bar: the factor drawn against the strongest value the model allows for it.
  function bar(value, max) {
    var pct = Math.max(3, Math.min(100, (value / max) * 100));
    var wrap = A.el('div', { class: 'bar' });
    var fill = A.el('i', null);
    fill.style.width = pct + '%';
    wrap.appendChild(fill);
    return wrap;
  }

  function workingLine(label, factorText, factorValue, max) {
    return A.el('div', null,
      A.el('div', { class: 'line' }, A.el('span', null, label), A.el('b', null, factorText)),
      bar(factorValue, max));
  }

  function open(slug) {
    var row = bySlug[slug];
    if (!row) return;
    var m = row.model;
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    drawer.textContent = '';

    var badge = row.on_watchlist
      ? A.el('span', { class: 'badge badge-watch' }, 'On the house watchlist')
      : A.el('span', { class: 'badge badge-early' }, 'Early find, below the $50M floor');
    var close = A.el('button', { class: 'close', type: 'button', 'aria-label': 'Close detail' }, '×');
    close.addEventListener('click', shut);
    drawer.appendChild(close);
    drawer.appendChild(A.el('h2', null, row.name));
    drawer.appendChild(A.el('p', { class: 'sub' },
      (row.category || 'Uncategorised') + ' · rank #' + row.rank + ' of ' + DATA.rows.length + ' · '));
    drawer.lastChild.appendChild(badge);

    var figs = A.el('div', { class: 'figs' },
      fig('Implied value', A.fmtUsd(row.implied_value_usd)),
      fig('TVL (snapshot)', A.fmtUsd(row.tvl_usd)),
      fig('7d TVL change', A.fmtPct(row.change_7d)),
      fig('Tracked, no token', A.fmtAge(row.age_days)));
    drawer.appendChild(figs);

    drawer.appendChild(A.el('h3', null, 'Why this value'));
    var workings = A.el('div', { class: 'workings' });
    workings.appendChild(A.el('div', { class: 'line' },
      A.el('span', null, 'TVL'), A.el('b', null, A.fmtUsd(row.tvl_usd))));
    workings.appendChild(workingLine(
      'Category multiple — ' + (row.category || 'Uncategorised') + ', from ' + m.category_sample + ' trading launch' + (m.category_sample === 1 ? '' : 'es'),
      A.fmtMultiple(m.category_multiple), m.category_multiple, 1.5));
    workings.appendChild(workingLine(
      'Momentum — TVL ' + A.fmtPct(row.change_7d) + ' over 7 days',
      A.fmtFactor(m.momentum_factor), m.momentum_factor, 1.27));
    workings.appendChild(workingLine(
      'Track record — ' + A.fmtAge(row.age_days) + ' with no token recorded',
      A.fmtFactor(m.track_factor), m.track_factor, 1));
    workings.appendChild(workingLine(
      'Breadth — live on ' + m.chain_count + ' chain' + (m.chain_count === 1 ? '' : 's'),
      A.fmtFactor(m.breadth_factor), m.breadth_factor, 1.2));
    workings.appendChild(A.el('div', { class: 'line total' },
      A.el('span', null, 'Implied value of a launch'), A.el('b', null, A.fmtUsd(row.implied_value_usd))));
    drawer.appendChild(workings);

    drawer.appendChild(A.el('h3', null, 'Chains'));
    var chips = A.el('div', { class: 'chips' });
    row.chains.forEach(function (c) { chips.appendChild(A.el('span', { class: 'chip' }, c)); });
    if (row.chains.length === 0) chips.appendChild(A.el('span', { class: 'chip' }, 'Chain not recorded'));
    drawer.appendChild(chips);

    drawer.appendChild(A.el('h3', null, 'The farm plan'));
    var plan = A.el('ol', { class: 'plan' });
    row.farm_steps.forEach(function (s) { plan.appendChild(A.el('li', null, s)); });
    drawer.appendChild(plan);

    drawer.appendChild(A.el('p', { class: 'honest' },
      'DefiLlama records no token for ' + row.name + ' as of ' + DATA.as_of + '. That is a record, not proof: ' +
      'a protocol can issue or record a token at any time, and this board never predicts that it will. ' +
      'The implied value is what a launch would be worth if the protocol\u2019s record stayed as it is.'));
    drawer.hidden = false;
    scrim.hidden = false;
  }

  // hide() only touches the DOM, so the hash router can call it without fighting the URL;
  // shut() is the user-facing close, which also drops the #detail link that opened the drawer.
  function hide() {
    document.getElementById('drawer').hidden = true;
    document.getElementById('scrim').hidden = true;
  }

  function shut() {
    hide();
    if (location.hash.indexOf('detail=') !== -1) history.pushState(null, '', location.pathname + location.search);
  }

  function init() {
    document.getElementById('scrim').addEventListener('click', shut);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
  }

  A.detail = { open: open, shut: shut, hide: hide, init: init };
})();
