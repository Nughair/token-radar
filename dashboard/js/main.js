// Launch Radar's boot: render the masthead, the board, the model panel and the calibration
// table from window.RADAR, then route the URL hash — #detail=<slug> opens a protocol,
// #status=early&category=Lending pre-sets the board's filters — so every view the page can
// show is also a link that can be shared, screenshotted and returned to.
(function () {
  'use strict';

  var A = window.RadarApp;
  if (!window.RADAR) return;

  A.panels.renderStats();
  A.board.init(function (slug) {
    history.replaceState(null, '', '#detail=' + encodeURIComponent(slug));
    A.detail.open(slug);
  });
  A.panels.renderModel();
  A.panels.renderLive();
  A.detail.init();

  function route() {
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    var patch = {};
    if (params.get('status')) patch.status = params.get('status');
    if (params.get('category')) patch.category = params.get('category');
    if (params.get('chain')) patch.chain = params.get('chain');
    if (params.get('verdict')) patch.verdict = params.get('verdict');
    if (Object.keys(patch).length > 0) A.board.setState(patch);
    var slug = params.get('detail');
    if (slug) A.detail.open(slug);
    else A.detail.hide();
    var anchor = params.get('view');
    if (anchor) {
      var target = document.getElementById(anchor === 'model' ? 'model-card' : anchor === 'live' ? 'live-card' : '');
      if (target) target.scrollIntoView();
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
