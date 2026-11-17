// Launch Radar's formatting helpers: money, percentages, ages and ratios, rendered the same
// way in the board, the detail drawer and the calibration panel.
(function () {
  'use strict';

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function pctClass(n) {
    if (n === null || n === undefined || n === 0) return 'flat';
    return n > 0 ? 'pos' : 'neg';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 730) return (days / 365).toFixed(1) + ' yrs';
    if (days >= 60) return Math.round(days / 30.4) + ' mo';
    return days + ' days';
  }

  function fmtMultiple(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return n.toFixed(3) + '×';
  }

  // Exact dollars with thousands separators, for the netting's figures.
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  }

  // A plan's net, signed: what the netting leaves after costs and forgone yield.
  function fmtSigned(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n < 0 ? '-' : '+') + fmtUsd(Math.abs(n));
  }

  function fmtFactor(n) {
    return n.toFixed(2) + '×';
  }

  // A small element builder: el('td', { class: 'num' }, 'text', childNode, ...)
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (key === 'class') node.className = attrs[key];
        else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), attrs[key]);
        else node.setAttribute(key, attrs[key]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    }
    return node;
  }

  window.RadarApp = {
    fmtUsd: fmtUsd,
    fmtPct: fmtPct,
    pctClass: pctClass,
    fmtAge: fmtAge,
    fmtMultiple: fmtMultiple,
    fmtFactor: fmtFactor,
    fmtMoney: fmtMoney,
    fmtSigned: fmtSigned,
    el: el,
  };
})();
