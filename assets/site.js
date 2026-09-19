/* EBHC shared script: loads data/seasons.json, year filter, renderers, nav, lite YouTube embeds. */
(function () {
  'use strict';
  var ROOT = (document.body.getAttribute('data-root') || '');
  var DATA_VERSION = document.body.getAttribute('data-version') || String(Date.now()).slice(0, 8);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';

  /* ---------- data ---------- */
  var cache = null;
  function load() {
    if (cache) return cache;
    cache = fetch(ROOT + 'data/seasons.json?v=' + DATA_VERSION, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('data ' + r.status); return r.json(); }).then(function (j) {
      j.seasons = (j.seasons || []).slice().sort(function (a, b) { return b.year - a.year; });
      return j;
    });
    return cache;
  }
  function yearFromUrl() { var m = location.search.match(/[?&]year=(\d{4}|all)/); return m ? m[1] : null; }
  function setYearUrl(y) { try { var u = new URL(location.href); u.searchParams.set('year', y); history.replaceState(null, '', u); } catch (e) {} }
  function pick(seasons, y) { for (var i = 0; i < seasons.length; i++) if (String(seasons[i].year) === String(y)) return seasons[i]; return seasons[0]; }

  function buildYearFilter(sel, seasons, current, allowAll) {
    if (!sel) return;
    sel.innerHTML = '';
    if (allowAll) { var o = document.createElement('option'); o.value = 'all'; o.textContent = 'All years'; sel.appendChild(o); }
    seasons.forEach(function (s) { var o = document.createElement('option'); o.value = s.year; o.textContent = s.year; sel.appendChild(o); });
    sel.value = String(current);
  }

  /* ---------- renderers ---------- */
  function poolTag(pool) { if (!pool) return ''; var cls = /b/i.test(pool.replace(/pool/i, '')) ? 'tag-b' : 'tag-c'; return ' <span class="tag ' + cls + '">' + esc(pool) + '</span>'; }

  function renderStandings(season, compact) {
    if (!season || !season.divisions || !season.divisions.length) return '<div class="empty">Standings for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    return season.divisions.map(function (d) {
      var rows = d.standings.map(function (r) {
        var full = compact ? '' : '<td>' + esc(r.t) + '</td>';
        var extra = compact ? '' : '<td>' + esc(r.pct) + '</td>';
        var tail = compact ? '' : '<td>' + esc(r.pim) + '</td><td>' + esc(r.streak) + '</td>';
        return '<tr><td><span class="rk">' + esc(r.rk) + '</span></td><td class="l team">' + esc(r.team) + poolTag(r.pool) + '</td><td>' + esc(r.gp) + '</td><td>' + esc(r.w) + '</td><td>' + esc(r.l) + '</td>' + full + '<td>' + esc(r.pts) + '</td>' + extra + '<td>' + esc(r.gf) + '</td><td>' + esc(r.ga) + '</td><td>' + esc(r.diff) + '</td>' + tail + '</tr>';
      }).join('');
      var head = compact
        ? '<tr><th>Rk</th><th class="l">Team</th><th>GP</th><th>W</th><th>L</th><th>Pts</th><th>GF</th><th>GA</th><th>Diff</th></tr>'
        : '<tr><th>Rk</th><th class="l">Team</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>W%</th><th>GF</th><th>GA</th><th>Diff</th><th>PIM</th><th>Streak</th></tr>';
      var pools = {};
      d.standings.forEach(function (r) { if (r.pool) pools[r.pool] = 1; });
      var legend = Object.keys(pools).length ? '<div class="legend">' + Object.keys(pools).map(function (p) { return '<span>' + poolTag(p).replace('margin-left', '') + ' playoffs</span>'; }).join('') + '</div>' : '';
      return '<div class="card"><div class="card-head"><h3>' + esc(season.year) + ' &bull; ' + esc(d.name) + '</h3><span>' + esc(d.note || '') + ' &bull; Source: HockeyShift</span></div><div class="wrap"><table style="min-width:' + (compact ? '560' : '760') + 'px"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' + legend + '</div>';
    }).join('');
  }

  function gameHtml(g) {
    var awayW = g.as > g.hs, homeW = g.hs > g.as;
    var head = '<div class="g-head"><span class="g-num">G' + esc(g.n) + '</span>' + (g.round ? '<span class="round">' + esc(g.round) + '</span>' : '') + '<span class="g-time">' + esc(g.time) + (g.rink ? ' &bull; ' + esc(g.rink) : '') + '</span></div>';
    var rows = '<div class="g-row' + (awayW ? ' w' : '') + '"><span>' + esc(g.away) + '</span><b>' + esc(g.as) + '</b></div><div class="g-row' + (homeW ? ' w' : '') + '"><span>' + esc(g.home) + '</span><b>' + esc(g.hs) + '</b></div>';
    var foot = g.video ? '<div class="g-foot"><a href="https://www.youtube.com/watch?v=' + esc(g.video) + '" target="_blank" rel="noopener">' + PLAY + 'Watch replay</a></div>' : '';
    return '<div class="game' + (g.type === 'PO' ? ' po' : '') + '">' + head + rows + foot + '</div>';
  }

  function renderScores(season) {
    if (!season || !season.games || !season.games.length) return '<div class="empty">Scores for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    var days = [], byDay = {};
    season.games.forEach(function (g) { if (!byDay[g.day]) { byDay[g.day] = []; days.push(g.day); } byDay[g.day].push(g); });
    return days.map(function (d) {
      var gs = byDay[d]; var po = gs.some(function (g) { return g.type === 'PO'; }); var rr = gs.some(function (g) { return g.type !== 'PO'; });
      var kind = po && rr ? 'Round robin + playoffs' : po ? 'Playoffs' : 'Round robin';
      return '<div class="day"><h3>' + esc(d) + ' <small>' + kind + '</small></h3><div class="games">' + gs.map(gameHtml).join('') + '</div></div>';
    }).join('');
  }

  function renderChampions(season, opts) {
    opts = opts || {};
    if (!season || !season.playoffs || !season.playoffs.length) return '<div class="empty">Champions for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    return '<div class="champ-grid">' + season.playoffs.map(function (p) {
      var fg = (season.games || []).filter(function (g) { return g.n === p.finalGame; })[0];
      var watch = fg && fg.video ? '<a class="btn btn-primary btn-sm" href="https://www.youtube.com/watch?v=' + esc(fg.video) + '" target="_blank" rel="noopener">Watch the Final</a>' : '';
      var more = opts.moreLink ? '<a class="btn btn-outline btn-sm" href="' + ROOT + 'standings/?year=' + esc(season.year) + '">Standings &amp; Scores</a>' : '';
      return '<article class="champ"><div class="champ-pool">' + TROPHY + esc(p.title) + ' Champions &bull; ' + esc(season.year) + '</div><h3 class="champ-name">' + esc(p.champion) + '</h3>' +
        (p.runnerUp ? '<p>Final: <strong>' + esc(p.champion) + '</strong> ' + esc(p.finalScore || '') + ' ' + esc(p.runnerUp) + '</p>' : '') +
        (p.mvp ? '<div class="champ-mvp">Finals MVP: <b>' + esc(p.mvp.name) + '</b></div>' : '') +
        (watch || more ? '<div class="champ-links">' + watch + more + '</div>' : '') + '</article>';
    }).join('') + '</div>';
  }

  function renderMvps(seasons) {
    var html = seasons.map(function (s) {
      var list = (s.playoffs || []).filter(function (p) { return p.mvp; });
      if (!list.length) return '';
      return '<div class="mvp-year"><h3>' + esc(s.year) + ' <small>' + esc(s.dates || '') + '</small></h3><div class="mvp-grid">' + list.map(function (p) {
        return '<div class="mvp"><div class="mvp-badge"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div><div class="mvp-pool">' + esc(p.title) + ' Finals MVP</div><div class="mvp-name">' + esc(p.mvp.name) + '</div><div class="mvp-team">' + esc(p.mvp.team || p.champion) + ' &bull; ' + esc(p.title) + ' Champions</div></div></div>';
      }).join('') + '</div></div>';
    }).join('');
    return html || '<div class="empty">No Finals MVPs posted yet.</div>';
  }

  function renderLeaders(season) {
    if (!season || !season.leaders || !season.leaders.rows || !season.leaders.rows.length) return '<div class="empty">Scoring leaders for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    var rows = season.leaders.rows.map(function (r) { return '<tr><td><span class="rk">' + esc(r.rk) + '</span></td><td class="l team">' + esc(r.name) + '</td><td>' + esc(r.num) + '</td><td class="l">' + esc(r.team) + '</td><td>' + esc(r.gp) + '</td><td>' + esc(r.g) + '</td><td>' + esc(r.a) + '</td><td><strong>' + esc(r.pts) + '</strong></td></tr>'; }).join('');
    return '<div class="card"><div class="card-head"><h3>' + esc(season.year) + ' Points Leaders</h3><span>' + esc(season.leaders.note || '') + '</span></div><div class="wrap"><table style="min-width:600px"><thead><tr><th>Rk</th><th class="l">Player</th><th>#</th><th class="l">Team</th><th>GP</th><th>G</th><th>A</th><th>Pts</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  var LINK_DEFS = [
    { key: 'leaders', title: 'Player Leaders', desc: 'Goals, assists and points by player', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    { key: 'standings', title: 'Official Standings', desc: 'Live table on HockeyShift', icon: '<path d="M4 6h16M4 12h10M4 18h6"/>' },
    { key: 'scores', title: 'Scores', desc: 'Every game result and box score', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>' },
    { key: 'schedule', title: 'Schedule', desc: 'Game times and rinks', icon: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>' },
    { key: 'players', title: 'Players', desc: 'Rosters and player pages', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { key: 'teams', title: 'Teams', desc: 'Team stats and records', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    { key: 'replays', title: 'Game Replays', desc: 'Full games on YouTube', icon: '<polygon points="5 3 19 12 5 21 5 3"/>' }
  ];
  function renderStatLinks(season) {
    if (!season || !season.links) return '<div class="empty">Stats links for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    return '<div class="link-grid">' + LINK_DEFS.filter(function (d) { return season.links[d.key]; }).map(function (d) {
      return '<a class="link-card" href="' + esc(season.links[d.key]) + '" target="_blank" rel="noopener"><div class="icon"><svg viewBox="0 0 24 24">' + d.icon + '</svg></div><div><h3>' + d.title + '</h3><p>' + d.desc + '</p></div><span class="arrow">&rarr;</span></a>';
    }).join('') + '</div>';
  }

  function renderFinalsReplays(season) {
    if (!season) return '';
    var finals = (season.playoffs || []).map(function (p) { return (season.games || []).filter(function (g) { return g.n === p.finalGame && g.video; })[0]; }).filter(Boolean);
    if (!finals.length) return '<div class="empty">Finals replays for ' + esc(season.year) + ' are coming soon.</div>';
    return '<div class="replay-grid">' + finals.map(function (g) {
      var winFirst = g.hs > g.as ? [g.home, g.hs, g.away, g.as] : [g.away, g.as, g.home, g.hs];
      return '<div class="yt" data-id="' + esc(g.video) + '" role="button" tabindex="0" aria-label="Play: ' + esc(g.round || 'Final') + ', ' + esc(g.away) + ' vs ' + esc(g.home) + '">' +
        '<div class="yt-thumb"><img src="https://i.ytimg.com/vi/' + esc(g.video) + '/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"><div class="yt-play"><b></b></div></div>' +
        '<div class="yt-caption"><h3>' + esc(g.round || 'Final') + '</h3><span class="score">' + esc(winFirst[0]) + ' ' + esc(winFirst[1]) + ' – ' + esc(winFirst[3]) + ' ' + esc(winFirst[2]) + '</span><span class="meta">Game ' + esc(g.n) + ' &bull; ' + esc(g.day) + ' &bull; ' + esc(season.year) + '</span></div></div>';
    }).join('') + '</div>';
  }

  function renderChampionsTable(season) {
    if (!season || !season.playoffs || !season.playoffs.length) return '<div class="empty">Champions for ' + esc(season && season.year) + ' have not been posted yet.</div>';
    var rows = season.playoffs.map(function (p) {
      var fg = (season.games || []).filter(function (g) { return g.n === p.finalGame; })[0];
      var final = p.runnerUp ? esc(p.finalScore || '') + ' vs ' + esc(p.runnerUp) : '';
      var replay = fg && fg.video ? '<a href="https://www.youtube.com/watch?v=' + esc(fg.video) + '" target="_blank" rel="noopener">Watch</a>' : '';
      return '<tr><td class="l pool" data-label="Pool">' + esc(p.title) + '</td><td class="l team" data-label="Champion">' + esc(p.champion) + '</td><td class="l" data-label="Final">' + final + '</td><td class="l mvp-cell" data-label="Finals MVP">' + (p.mvp ? esc(p.mvp.name) : '') + '</td><td data-label="Replay">' + replay + '</td></tr>';
    }).join('');
    return '<div class="card"><div class="wrap"><table class="champs" style="min-width:560px"><thead><tr><th class="l">Pool</th><th class="l">Champion</th><th class="l">Final</th><th class="l">Finals MVP</th><th>Replay</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  function renderCarousel(season) {
    var photos = (season && season.photos) || [];
    if (!photos.length) return '';
    var slides = photos.map(function (ph, i) {
      return '<figure class="slide" data-i="' + i + '"><img src="' + ROOT + esc(ph.src) + '" alt="' + esc(ph.alt || '') + '" loading="' + (i ? 'lazy' : 'eager') + '"><figcaption>' + esc(ph.caption || '') + '</figcaption></figure>';
    }).join('');
    var dots = photos.map(function (_, i) { return '<button type="button" class="dot" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '"' + (i ? '' : ' aria-current="true"') + '></button>'; }).join('');
    return '<div class="carousel" data-count="' + photos.length + '"><div class="track" tabindex="0" aria-label="Champion photos">' + slides + '</div>' +
      (photos.length > 1 ? '<button type="button" class="c-btn prev" aria-label="Previous photo">&#8249;</button><button type="button" class="c-btn next" aria-label="Next photo">&#8250;</button><div class="dots">' + dots + '</div>' : '') + '</div>' +
      '';
  }
  function wireCarousels(scope) {
    (scope || document).querySelectorAll('.carousel').forEach(function (c) {
      if (c.__wired) return; c.__wired = true;
      var track = c.querySelector('.track'), slides = c.querySelectorAll('.slide'), dots = c.querySelectorAll('.dot'), n = slides.length, cur = 0, timer;
      function go(i, smooth) { cur = (i + n) % n; track.scrollTo({ left: slides[cur].offsetLeft - track.offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' }); }
      function sync() { var x = track.scrollLeft, best = 0, bd = 1e9; slides.forEach(function (sl, i) { var d = Math.abs(sl.offsetLeft - track.offsetLeft - x); if (d < bd) { bd = d; best = i; } }); cur = best; dots.forEach(function (d, i) { if (i === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); }); }
      var pb = c.querySelector('.prev'), nb = c.querySelector('.next');
      if (pb) pb.addEventListener('click', function () { go(cur - 1); restart(); });
      if (nb) nb.addEventListener('click', function () { go(cur + 1); restart(); });
      dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.getAttribute('data-i')); restart(); }); });
      track.addEventListener('scroll', function () { clearTimeout(track.__t); track.__t = setTimeout(sync, 80); }, { passive: true });
      track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { go(cur + 1); restart(); } if (e.key === 'ArrowLeft') { go(cur - 1); restart(); } });
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function restart() { clearInterval(timer); if (n > 1 && !reduce) timer = setInterval(function () { if (!c.matches(':hover')) go(cur + 1); }, 6000); }
      restart();
    });
  }

  /* ---------- lite YouTube ---------- */
  function wireYouTube(scope) {
    (scope || document).querySelectorAll('.yt').forEach(function (box) {
      if (box.__wired) return; box.__wired = true;
      function play() {
        if (box.classList.contains('playing')) return;
        var f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + box.getAttribute('data-id') + '?autoplay=1&rel=0';
        f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        f.title = box.getAttribute('aria-label') || 'Video'; f.setAttribute('allowfullscreen', '');
        (box.querySelector('.yt-thumb') || box).appendChild(f); box.classList.add('playing');
      }
      box.addEventListener('click', play);
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    });
  }

  /* ---------- nav ---------- */
  function wireNav() {
    var nav = document.querySelector('nav.top'), toggle = document.querySelector('.nav-toggle'), links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () { var open = links.classList.toggle('open'); toggle.setAttribute('aria-expanded', open); });
      links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }); });
    }
    if (nav && !nav.classList.contains('always-solid')) {
      var upd = function () { nav.classList.toggle('solid', window.pageYOffset > 40); };
      upd(); window.addEventListener('scroll', upd, { passive: true });
    }
    var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- page controllers ---------- */
  function yearPage(config) {
    // config: { allowAll, render(seasons, season, yearValue) }
    var sel = document.getElementById('yearSelect');
    load().then(function (data) {
      var seasons = data.seasons;
      var y = yearFromUrl();
      if (!y || (y !== 'all' && !seasons.some(function (s) { return String(s.year) === y; }))) y = config.defaultAll ? 'all' : (seasons[0] ? String(seasons[0].year) : 'all');
      buildYearFilter(sel, seasons, y, config.allowAll);
      function go(val) { var season = val === 'all' ? null : pick(seasons, val); config.render(seasons, season, val); setYearUrl(val); wireYouTube(); wireCarousels(); }
      if (sel) sel.addEventListener('change', function () { go(sel.value); });
      go(y);
    }).catch(function (err) {
      document.querySelectorAll('[data-slot]').forEach(function (el) { el.innerHTML = '<div class="empty">Could not load results right now. <a href="https://www.youtube.com/@ebhctournament" target="_blank" rel="noopener">Watch replays on YouTube</a> or try again shortly.</div>'; });
      if (window.console) console.error(err);
    });
  }
  function slot(name) { return document.querySelector('[data-slot="' + name + '"]'); }
  function set(name, html) { var el = slot(name); if (el) el.innerHTML = html; }
  function setText(name, text) { var el = slot(name); if (el) el.textContent = text; }

  window.EBHC = {
    load: load, wireYouTube: wireYouTube, wireCarousels: wireCarousels,
    standings: function () { yearPage({ allowAll: false, render: function (seasons, s) { setText('year', ''); setText('meta', (s.dates || s.year) + (s.venue ? ' • ' + s.venue : '')); setText('format', s.format || ''); set('standings', renderStandings(s, false)); set('scores', renderScores(s)); set('champions', renderChampionsTable(s)); var a = slot('official'); if (a && s.links && s.links.standings) { a.href = s.links.standings; a.hidden = false; } else if (a) a.hidden = true; } }); },
    mvps: function () { yearPage({ allowAll: true, defaultAll: true, render: function (seasons, s, val) { var list = val === 'all' ? seasons : [s]; setText('year', val === 'all' ? 'All years' : String(s.year)); set('mvps', renderMvps(list)); var w = slot('champions-wrap'); if (w) w.hidden = (val === 'all'); set('champions', val === 'all' ? '' : renderChampions(s, { moreLink: true })); } }); },
    stats: function () { yearPage({ allowAll: false, render: function (seasons, s) { setText('year', ''); setText('meta', (s.dates || s.year) + (s.venue ? ' • ' + s.venue : '')); set('links', renderStatLinks(s)); set('leaders', renderLeaders(s)); } }); },
    home: function () { return load().then(function (data) { var s = data.seasons[0]; if (!s) return; setText('year', s.year); setText('format', s.format || ''); set('champions', renderChampions(s, { moreLink: true })); set('replays', renderFinalsReplays(s)); set('gallery', renderCarousel(s)); var gw = slot('gallery-wrap'); if (gw) gw.hidden = !(s.photos && s.photos.length); var ab = slot('album-btn'); if (ab) ab.outerHTML = s.album ? '<a class="btn btn-outline" href="' + esc(s.album) + '" target="_blank" rel="noopener">' + esc(s.year) + ' Photo Album</a>' : ''; wireYouTube(); wireCarousels(); }).catch(function () { set('champions', '<div class="empty" style="border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.6)">Results are on the <a href="standings/">Standings page</a>.</div>'); }); }
  };
  wireNav();
})();
