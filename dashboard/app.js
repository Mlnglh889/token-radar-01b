// Offline Token Radar dashboard: all values come from the generated data.js file.
(function () {
  'use strict';

  var data = window.RADAR;
  var mount = document.getElementById('app');
  if (!data || !mount) return;
  var state = { query: '', category: 'all', sort: 'value', direction: -1, selected: null };
  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function node(tag, attrs) {
    var element = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined) return;
      if (key === 'text') element.textContent = value;
      else if (key === 'class') element.className = value;
      else if (key.indexOf('on') === 0) element.addEventListener(key.slice(2), value);
      else element.setAttribute(key, value);
    });
    children.forEach(function (child) {
      if (child === null || child === undefined) return;
      if (Array.isArray(child)) child.forEach(function (item) { if (item) element.appendChild(item); });
      else if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else element.appendChild(child);
    });
    return element;
  }
  function usd(value) {
    if (value === null || value === undefined || !isFinite(value)) return 'n/a';
    if (Math.abs(value) >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (Math.abs(value) >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (Math.abs(value) >= 1e3) return '$' + Math.round(value / 1e3) + 'K';
    return money.format(value);
  }
  function percent(value) { return value === null || value === undefined ? 'n/a' : (value > 0 ? '+' : '') + value.toFixed(2) + '%'; }
  function age(value) { return value === null || value === undefined ? 'unknown' : value >= 365 ? (value / 365).toFixed(1) + 'y' : Math.max(0, Math.round(value)) + 'd'; }
  function category(row) { return row.category || 'Other'; }
  function chains(row) { return row.chains && row.chains.length ? row.chains.slice(0, 2).join(', ') : 'unnamed chain'; }

  function filteredRows() {
    var query = state.query.trim().toLowerCase();
    return data.rows.filter(function (row) {
      if (state.category !== 'all' && category(row) !== state.category) return false;
      if (!query) return true;
      return [row.name, row.slug, category(row), chains(row)].join(' ').toLowerCase().indexOf(query) >= 0;
    });
  }
  function sortedRows() {
    var rows = filteredRows().slice();
    rows.sort(function (left, right) {
      var a, b;
      if (state.sort === 'name') { a = left.name.toLowerCase(); b = right.name.toLowerCase(); }
      else if (state.sort === 'tvl') { a = left.tvl_usd; b = right.tvl_usd; }
      else if (state.sort === 'growth') { a = left.change_7d === null ? -Infinity : left.change_7d; b = right.change_7d === null ? -Infinity : right.change_7d; }
      else if (state.sort === 'age') { a = left.age_days === null ? Infinity : left.age_days; b = right.age_days === null ? Infinity : right.age_days; }
      else { a = left.implied_value_usd; b = right.implied_value_usd; }
      if (a < b) return -state.direction;
      if (a > b) return state.direction;
      return left.slug.localeCompare(right.slug);
    });
    return rows;
  }
  function sortButton(key, label) {
    return node('button', { type: 'button', text: label + (state.sort === key ? (state.direction < 0 ? ' ↓' : ' ↑') : ''), onclick: function () { if (state.sort === key) state.direction *= -1; else { state.sort = key; state.direction = -1; } render(); } });
  }
  function header() {
    return node('header', { class: 'top' },
      node('div', { class: 'brand' }, node('span', { class: 'mark', 'aria-hidden': 'true' }), node('span', { class: 'brand-name', text: 'Token Radar' })),
      node('div', { class: 'top-meta' }, node('span', { text: 'Snapshot ' + data.as_of }), node('span', { text: 'Offline / deterministic' }), node('span', { text: data.model.version }))
    );
  }
  function intro() {
    return node('section', { class: 'lede' },
      node('div', null, node('h1', { text: 'Pre-token signals, ranked without a promise' }), node('p', { text: 'A reproducible board from ' + data.source + '. The watchlist is the floor; the early radar adds lower-TVL protocols that still pass the same no-token screen.' })),
      node('div', { class: 'facts' },
        node('div', { class: 'fact' }, node('span', { text: 'Watchlist covered' }), node('b', { text: data.watchlist_size + ' / ' + data.watchlist_size })),
        node('div', { class: 'fact' }, node('span', { text: 'Rows scored' }), node('b', { text: String(data.board_size) })),
        node('div', { class: 'fact' }, node('span', { text: 'Below floor' }), node('b', { text: String(data.early_size) })),
        node('div', { class: 'fact' }, node('span', { text: 'Set aside as live' }), node('b', { text: String(data.live_size) }))
      )
    );
  }
  function controls() {
    var search = node('input', { type: 'search', id: 'search', value: state.query, placeholder: 'Search protocol, category or chain', 'aria-label': 'Search protocols', oninput: function (event) { state.query = event.target.value; render(); } });
    var categories = Array.from(new Set(data.rows.map(category))).sort();
    var select = node('select', { id: 'category', 'aria-label': 'Filter by category', onchange: function (event) { state.category = event.target.value; render(); } }, node('option', { value: 'all', text: 'All categories' }), categories.map(function (value) { return node('option', { value: value, text: value, selected: value === state.category ? 'selected' : null }); }));
    return node('div', { class: 'controls' },
      node('div', { class: 'field' }, node('label', { for: 'search', text: 'Search' }), search),
      node('div', { class: 'field' }, node('label', { for: 'category', text: 'Category' }), select),
      node('span', { class: 'count', text: sortedRows().length + ' of ' + data.board_size + ' rows shown' })
    );
  }
  function table() {
    var rows = sortedRows();
    if (!rows.length) return node('section', { class: 'panel empty' }, node('h2', { text: 'No rows match' }), node('p', { class: 'muted', text: 'Clear the search or choose all categories.' }), node('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.query = ''; state.category = 'all'; render(); } }));
    var max = rows[0].implied_value_usd || 1;
    var body = node('tbody');
    rows.forEach(function (row) {
      var growthClass = row.change_7d === null ? '' : row.change_7d >= 0 ? 'pos' : 'neg';
      body.appendChild(node('tr', { tabindex: '0', 'data-selected': state.selected === row.slug ? 'true' : 'false', onclick: function () { openDetail(row.slug); }, onkeydown: function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(row.slug); } } },
        node('td', { class: 'num', text: String(row.rank) }),
        node('td', null, node('div', { class: 'name' }, node('b', { text: row.name }), node('span', { class: 'sub', text: category(row) + ' on ' + chains(row) }))),
        node('td', { class: 'num', text: usd(row.tvl_usd) }),
        node('td', { class: 'num ' + growthClass, text: percent(row.change_7d) }),
        node('td', { class: 'num', text: age(row.age_days) }),
        node('td', null, node('div', { class: 'implied' }, node('div', { class: 'bar', 'aria-hidden': 'true' }, node('i', { style: 'width:' + Math.max(3, Math.round(row.implied_value_usd / max * 100)) + '%' })), node('span', { class: 'num', text: usd(row.implied_value_usd) }))),
        node('td', null, node('span', { class: 'status', text: 'no token' }))
      ));
    });
    return node('section', { class: 'panel table-wrap' }, node('table', null,
      node('caption', { class: 'sub', text: 'Select a row for its score components and concrete, risk-aware farm steps.' }),
      node('thead', null, node('tr', null, node('th', null, sortButton('value', 'Rank')), node('th', null, sortButton('name', 'Protocol')), node('th', null, sortButton('tvl', 'TVL')), node('th', null, sortButton('growth', '7d')), node('th', null, sortButton('age', 'Age')), node('th', null, sortButton('value', 'Implied value')), node('th', { text: 'Status' }))),
      body
    ));
  }
  function modelNote() {
    var m = data.model;
    return node('section', { class: 'panel model' },
      node('h2', { text: 'How the ranking works' }),
      node('p', { class: 'muted', text: 'One deterministic score is applied to every row; there are no name-specific overrides.' }),
      node('div', { class: 'formula', text: 'score = TVL 48% + clamped 7d growth 22% + age 18% + category 6% + chain breadth 6%' }),
      node('p', { class: 'muted', text: 'No token data means only that this snapshot has no market-cap, Gecko ID, or symbol record. It is not evidence that a token or airdrop will happen. Implied value is a model estimate, not a price.' })
    );
  }
  function openDetail(slug) {
    var row = data.rows.find(function (item) { return item.slug === slug; });
    if (!row) return;
    state.selected = slug;
    var dialog = document.getElementById('detail');
    dialog.textContent = '';
    dialog.appendChild(node('div', { class: 'detail-head' }, node('div', null, node('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' / ' + data.board_size }), node('h2', { id: 'detail-title', text: row.name }), node('p', { class: 'sub', text: category(row) + ' on ' + chains(row) })), node('button', { class: 'close', type: 'button', text: 'Close', 'aria-label': 'Close details', onclick: function () { dialog.close(); } })));
    var parts = row.model;
    dialog.appendChild(node('section', { class: 'detail-section' }, node('h3', { text: 'Implied value' }), node('div', { class: 'equation' },
      node('div', null, node('span', { text: 'TVL' }), node('b', { class: 'num', text: usd(row.tvl_usd) })),
      node('div', null, node('span', { text: '7d growth' }), node('b', { class: 'num', text: percent(row.change_7d) })),
      node('div', null, node('span', { text: 'Age' }), node('b', { class: 'num', text: age(row.age_days) })),
      node('div', null, node('span', { text: 'TVL / growth / age' }), node('b', { class: 'num', text: parts.tvl_component + ' / ' + parts.growth_component + ' / ' + parts.age_component })),
      node('div', null, node('span', { text: 'Category / chains' }), node('b', { class: 'num', text: parts.category_component + ' / ' + parts.chain_component })),
      node('div', null, node('span', { text: 'Model result' }), node('b', { class: 'num', text: usd(row.implied_value_usd) }))
    ), node('p', { class: 'muted', text: 'This is a reproducible estimate, not a claim of future token value.' })));
    dialog.appendChild(node('section', { class: 'detail-section' }, node('h3', { text: 'Concrete farm steps' }), node('ol', { class: 'steps' }, row.farm_steps.map(function (step) { return node('li', { text: step }); }))));
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function render() {
    mount.textContent = '';
    var shell = node('div', { class: 'shell' }, header(), intro(), node('p', { class: 'caveat', role: 'note', text: 'Caveat: this is offline snapshot analysis. “No token” is a data-screen result, not confirmation of an upcoming token or airdrop. Never pay to claim; verify every action on official domains.' }), controls(), table(), modelNote(), node('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' }));
    mount.appendChild(shell);
    var dialog = document.getElementById('detail');
    dialog.addEventListener('close', function () { state.selected = null; });
    if (state.selected) openDetail(state.selected);
  }
  render();
}());
