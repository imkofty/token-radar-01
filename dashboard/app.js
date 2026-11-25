// Token Radar dashboard: renders window.RADAR (written by main.ts) with no
// network. Board: sortable, filterable, searchable; a row opens the detail
// view with the model's factor breakdown and the farm plan. Live tokens and
// the tracked-but-not-ranked lists are rendered apart from the board.
//
// The model, as the page states it:
//   implied = TVL x 0.205 x growthMult x maturityMult
// 0.205 is the median mcap/TVL of the 128 live protocols in the snapshot
// that report a market cap. Growth and maturity are directional priors, not
// fitted results. A size damp was tested in a blind holdout and removed:
// it made the median error worse in both splits and left the ranking
// unchanged, so the shipped model is linear in TVL. Implied value is a
// circulating-style estimate, not FDV.
(function () {
  var R = window.RADAR;
  if (!R) { document.getElementById('counts').textContent = 'No data loaded.'; return; }

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(v) {
    if (v === null || v === undefined) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(2) + '%';
    return '<span class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">' + s + '</span>';
  }
  function ageText(a) { return a === null || a === undefined ? 'unknown' : a + 'd'; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  $('counts').textContent =
    R.board_size + ' protocols ranked · ' + R.watchlist_size + ' on the watchlist · ' +
    R.early_size + ' found below the floor · ' + R.live_size + ' live tokens shown apart · snapshot ' + R.as_of;

  var watchlist = new Set();
  // The board marks watchlist rows from the explicit slug list in the data.
  if (R.watchlist_slugs) R.watchlist_slugs.forEach(function (s) { watchlist.add(s); });

  // ---- facts strip (rendered from the data, above the board) ----
  (function () {
    var covered = 0;
    R.rows.forEach(function (r) { if (watchlist.has(r.slug)) covered++; });
    $('facts').innerHTML =
      '<div class="fact"><strong>' + covered + ' / ' + R.watchlist_size + '</strong><span>watchlist covered</span></div>' +
      '<div class="fact"><strong>' + R.board_size + '</strong><span>rows ranked</span></div>' +
      '<div class="fact"><strong>' + R.early_size + '</strong><span>early, below the $50M floor</span></div>' +
      '<div class="fact"><strong>' + R.live_size + '</strong><span>live tokens set aside</span></div>';
  })();

  // ---- board ----
  var cats = [];
  R.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  cats.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('cat').appendChild(o);
  });

  var selected = null;
  // Sort state: the dropdown and the clickable column headers share it.
  // dir 1 = ascending by key, -1 = descending; rank ascending puts #1 first.
  var sortKey = 'rank';
  var sortDir = 1;
  var sortDefaults = { rank: 1, tvl: -1, change: -1, age: -1, implied: -1 };
  var maxImplied = R.rows.length ? R.rows[0].implied_value_usd : 1; // rows arrive rank-sorted
  function updateSortUI() {
    document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
      var arrow = th.querySelector('.arrow');
      if (!arrow) return;
      arrow.textContent = th.getAttribute('data-sort') === sortKey ? (sortDir === 1 ? '▲' : '▼') : '';
    });
    $('sort').value = sortKey === 'implied' ? 'rank' : sortKey;
  }

  function visibleRows() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('cat').value;
    var wOnly = $('watch-only').checked;
    var rows = R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (wOnly && !watchlist.has(r.slug)) return false;
      return true;
    });
    rows.sort(function (a, b) {
      var av, bv;
      if (sortKey === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (sortKey === 'change') { av = a.change_7d || 0; bv = b.change_7d || 0; }
      else if (sortKey === 'age') { av = a.age_days || 0; bv = b.age_days || 0; }
      else if (sortKey === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      return (av - bv) * sortDir;
    });
    return rows;
  }

  function renderBoard() {
    var rows = visibleRows();
    var tb = document.querySelector('#board tbody');
    tb.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (selected === r.slug) tr.className = 'selected';
      if (watchlist.has(r.slug)) tr.className += ' watch';
      // Chains: first two only, the rest counted — the detail view lists all.
      var chains = r.chains || [];
      var chainsHtml = chains.length <= 2
        ? esc(chains.join(', ') || '—')
        : esc(chains.slice(0, 2).join(', ')) + ' <span class="meta">+' + (chains.length - 2) + ' more</span>';
      // Implied-value bar: length ∝ value against the rank-1 row.
      var barPct = Math.max(2, Math.round(r.implied_value_usd / maxImplied * 100));
      tr.innerHTML =
        '<td>' + r.rank + '</td>' +
        '<td><strong>' + esc(r.name) + '</strong><br><span class="meta">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chainsHtml + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><strong>' + money(r.implied_value_usd) + '</strong><span class="bar"><i style="width:' + barPct + '%"></i></span></td>';
      tr.addEventListener('click', function () { showDetail(r.slug); });
      tb.appendChild(tr);
    });
    $('board-meta').textContent = rows.length + ' of ' + R.rows.length + ' rows shown.';
  }

  // ---- detail ----
  function showDetail(slug) {
    var r = null;
    R.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    selected = slug;
    renderBoard();
    var base = Math.round(r.tvl_usd * R.model.base_multiple);
    var afterGrowth = Math.round(base * r.growth_multiplier);
    var body = $('detail-body');
    body.innerHTML =
      '<h3>' + esc(r.name) + ' <span class="tag">rank #' + r.rank + '</span>' +
      (watchlist.has(r.slug) ? '<span class="tag">watchlist</span>' : '') + '</h3>' +
      '<p>Category: ' + esc(r.category || '—') + ' · Chains: ' + esc((r.chains || []).join(', ') || '—') +
      ' · TVL ' + money(r.tvl_usd) + ' · 7-day change ' + pct(r.change_7d) +
      ' · Listed ' + (r.listed_at || 'unknown') + ' (' + ageText(r.age_days) + ')</p>' +
      '<h3>How the implied value is built</h3>' +
      '<table class="factors"><tbody>' +
      '<tr><td>TVL &times; 0.205 (median mcap/TVL of 128 live protocols)</td><td class="num">' + money(base) + '</td></tr>' +
      '<tr><td>&times; growth ' + r.growth_multiplier.toFixed(4) + ' (7d ' + (r.change_7d === null ? 'not reported' : r.change_7d.toFixed(2) + '%') + ')</td><td class="num">' + money(afterGrowth) + '</td></tr>' +
      '<tr><td>&times; maturity ' + r.maturity_multiplier.toFixed(4) + ' (age ' + ageText(r.age_days) + ')</td><td class="num">' + money(r.implied_value_usd) + '</td></tr>' +
      '<tr class="total"><td>Implied launch value</td><td class="num">' + money(r.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="meta">Circulating-style estimate, not FDV: the 0.205 multiple is calibrated on circulating market cap.</p>' +
      '<h3>Farm plan — six steps</h3>' +
      '<ol class="farm">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="meta">No step promises a points program or an airdrop: the snapshot carries none.</p>';
    $('detail').hidden = false;
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- live ----
  (function () {
    var tb = document.querySelector('#live tbody');
    R.live.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + esc(p.name) + '</strong><br><span class="meta">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td>' +
        '<td class="num"><strong>' + money(p.mcap_usd || 0) + '</strong></td>' +
        '<td class="num">' + pct(p.change_7d) + '</td>';
      tb.appendChild(tr);
    });
  })();

  // ---- tracked, not ranked ----
  (function () {
    var nr = $('not-ranked');
    R.not_ranked_strict.forEach(function (p) {
      var li = document.createElement('li');
      li.innerHTML = '<strong>' + esc(p.name) + '</strong> (' + esc(p.slug) + ') — ' + money(p.tvl_usd) +
        ' <span class="reason">· above the $50M floor, strict test passed, parent protocol unverifiable</span>';
      nr.appendChild(li);
    });
    $('filtered-count').textContent = R.filtered_out.length;
    var f = $('filtered');
    R.filtered_out.forEach(function (p) {
      var li = document.createElement('li');
      li.innerHTML = '<strong>' + esc(p.name) + '</strong> (' + esc(p.slug) + ') — ' + money(p.tvl_usd) +
        ' <span class="reason">· ' + esc(p.reason) + '</span>';
      f.appendChild(li);
    });
  })();

  // Clickable column headers: same key again toggles direction, a new key takes its default.
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.querySelector('button').addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = sortDefaults[key]; }
      updateSortUI();
      renderBoard();
    });
  });
  // The dropdown sets the key (direction resets to that key's default).
  $('sort').addEventListener('change', function () {
    sortKey = $('sort').value;
    sortDir = sortDefaults[sortKey];
    updateSortUI();
  });
  ['q', 'cat', 'sort', 'watch-only'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });
  updateSortUI();
  renderBoard();
  // Open the top row's detail by default so the detail view is visible on load.
  if (R.rows.length) showDetail(R.rows[0].slug);
})();
