/* CrashMonitor portal — vanilla JS single-page app (hash routing). */

'use strict';

const API = ''; // same origin as the Flask app
const KEY_STORAGE = 'cm_admin_key';

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
let charts = [];

/* ---------------- helpers ---------------- */

function esc(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function compact(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function timeAgo(iso) {
  if (!iso) return '-';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': localStorage.getItem(KEY_STORAGE) || '',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    localStorage.removeItem(KEY_STORAGE);
    location.hash = '#/login';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function destroyCharts() {
  charts.forEach((c) => c.destroy());
  charts = [];
}

/* ---------------- chart builders (specs per dataviz method) ---------------- */

function baseTicks() {
  return { color: cssVar('--muted'), font: { size: 11 }, precision: 0 };
}

function baseTooltip() {
  return {
    backgroundColor: cssVar('--surface'),
    titleColor: cssVar('--ink'),
    bodyColor: cssVar('--ink-2'),
    borderColor: cssVar('--baseline'),
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    usePointStyle: true,
    boxWidth: 7,
    boxHeight: 7,
  };
}

/** Stacked daily columns: non-fatal (blue) below, fatal (red) on top. */
function timeseriesChart(canvas, days) {
  const surface = cssVar('--surface');
  const labels = days.map((d) => d.date.slice(5)); // MM-DD
  const fatal = days.map((d) => d.fatal);
  const nonFatal = days.map((d) => d.count - d.fatal);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Non-fatal',
          data: nonFatal,
          backgroundColor: cssVar('--series-1'),
          borderColor: surface,
          borderWidth: 1,
          maxBarThickness: 24,
        },
        {
          label: 'Fatal',
          data: fatal,
          backgroundColor: cssVar('--series-fatal'),
          borderColor: surface,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { color: cssVar('--baseline') },
          ticks: { ...baseTicks(), maxTicksLimit: 10, maxRotation: 0 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: cssVar('--grid'), lineWidth: 1 },
          border: { display: false },
          ticks: baseTicks(),
        },
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 7,
            boxHeight: 7,
            color: cssVar('--ink-2'),
            font: { size: 12 },
          },
        },
        tooltip: baseTooltip(),
      },
    },
  });
  charts.push(chart);
  return chart;
}

/** Single-series area line for one issue's activity. No legend (title names it). */
function areaChart(canvas, days) {
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: days.map((d) => d.date.slice(5)),
      datasets: [{
        label: 'Events',
        data: days.map((d) => d.count),
        borderColor: cssVar('--series-1'),
        backgroundColor: cssVar('--series-1-wash'),
        fill: true,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: cssVar('--series-1'),
        pointHoverBorderColor: cssVar('--surface'),
        pointHoverBorderWidth: 2,
        pointHitRadius: 14,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { display: false },
          border: { color: cssVar('--baseline') },
          ticks: { ...baseTicks(), maxTicksLimit: 10, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { color: cssVar('--grid'), lineWidth: 1 },
          border: { display: false },
          ticks: baseTicks(),
        },
      },
      plugins: { legend: { display: false }, tooltip: baseTooltip() },
    },
  });
  charts.push(chart);
  return chart;
}

/** Horizontal bars, one series → one hue; value labeled at each bar tip. */
function breakdownChart(canvas, buckets) {
  canvas.parentElement.style.height = Math.max(170, buckets.length * 34 + 46) + 'px';

  const tipLabels = {
    id: 'tipLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = cssVar('--ink-2');
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        ctx.fillText(compact(chart.data.datasets[0].data[i]), bar.x + 6, bar.y);
      });
      ctx.restore();
    },
  };

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: buckets.map((b) => b.key),
      datasets: [{
        label: 'Events',
        data: buckets.map((b) => b.count),
        backgroundColor: cssVar('--series-1'),
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 20,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 36 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: cssVar('--grid'), lineWidth: 1 },
          border: { display: false },
          ticks: { ...baseTicks(), maxTicksLimit: 6 },
        },
        y: {
          grid: { display: false },
          border: { color: cssVar('--baseline') },
          ticks: { ...baseTicks(), autoSkip: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(),
          callbacks: {
            label: (item) => ` ${item.formattedValue} events · ${buckets[item.dataIndex].users} users`,
          },
        },
      },
    },
    plugins: [tipLabels],
  });
  charts.push(chart);
  return chart;
}

/* ---------------- views ---------------- */

function loginView() {
  topbar.hidden = true;
  destroyCharts();
  view.innerHTML = `
    <div class="login-wrap">
      <form class="card login-card" id="login-form">
        <h1><span class="brand-dot"></span> CrashMonitor</h1>
        <p>Enter the admin key to open the portal.</p>
        <p class="login-error" id="login-error" hidden>Invalid admin key.</p>
        <input type="password" id="login-key" placeholder="Admin key" autocomplete="current-password" autofocus>
        <button class="primary" type="submit">Sign in</button>
      </form>
    </div>`;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('login-key').value.trim();
    if (!key) return;
    localStorage.setItem(KEY_STORAGE, key);
    try {
      await api('GET', '/api/v1/apps');
      location.hash = '#/apps';
    } catch {
      localStorage.removeItem(KEY_STORAGE);
      document.getElementById('login-error').hidden = false;
    }
  });
}

async function appsView() {
  topbar.hidden = false;
  destroyCharts();
  view.innerHTML = `<div class="container"><div class="loading">Loading apps…</div></div>`;

  const apps = await api('GET', '/api/v1/apps');

  view.innerHTML = `
    <div class="container">
      <div class="page-head">
        <div><h1>Applications</h1><span class="sub">${apps.length} registered</span></div>
        <button class="primary" id="btn-new-app">＋ New app</button>
      </div>
      <div class="apps-grid" id="apps-grid"></div>
      ${apps.length === 0 ? '<div class="empty">No apps yet — register your first application.</div>' : ''}
    </div>`;

  const grid = document.getElementById('apps-grid');
  apps.forEach((app) => {
    const card = document.createElement('div');
    card.className = 'card app-card';
    card.innerHTML = `
      <h2 style="font-size:15px;color:var(--ink)">${esc(app.name)}</h2>
      <div class="pkg">${esc(app.package_name)}</div>
      <div class="counts">
        <span><b>${compact(app.issue_count)}</b> issues</span>
        <span><b>${compact(app.event_count)}</b> events</span>
      </div>
      <div class="actions">
        <button class="primary open-btn">Open dashboard</button>
        <button class="danger del-btn">Delete</button>
      </div>`;
    card.querySelector('.open-btn').onclick = () => (location.hash = `#/app/${app._id}`);
    card.querySelector('.del-btn').onclick = async () => {
      if (!confirm(`Delete "${app.name}" and ALL of its crash data? This cannot be undone.`)) return;
      await api('DELETE', `/api/v1/apps/${app._id}`);
      toast('App deleted');
      appsView();
    };
    grid.appendChild(card);
  });

  document.getElementById('btn-new-app').onclick = () => newAppModal();
}

function newAppModal() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <form class="card modal" id="new-app-form">
      <h2>Register a new app</h2>
      <div class="field"><label>Display name</label><input type="text" id="na-name" placeholder="My App" required></div>
      <div class="field"><label>Package name</label><input type="text" id="na-pkg" placeholder="com.example.myapp" required></div>
      <div id="na-result"></div>
      <div class="row">
        <button type="button" class="ghost" id="na-cancel">Close</button>
        <button type="submit" class="primary" id="na-submit">Create</button>
      </div>
    </form>`;
  document.body.appendChild(back);
  back.querySelector('#na-cancel').onclick = () => { back.remove(); appsView(); };

  back.querySelector('#new-app-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const app = await api('POST', '/api/v1/apps', {
        name: back.querySelector('#na-name').value.trim(),
        package_name: back.querySelector('#na-pkg').value.trim(),
      });
      back.querySelector('#na-result').innerHTML = `
        <div class="key-reveal">API key: ${esc(app.api_key)}</div>
        <p style="color:var(--muted);font-size:12px;margin:0">
          Copy this key into <code>CrashMonitorConfig.Builder(…)</code>.
          It is shown only here (it can be regenerated later).</p>`;
      back.querySelector('#na-submit').disabled = true;
    } catch (err) {
      back.querySelector('#na-result').innerHTML =
        `<p class="login-error">${esc(err.message)}</p>`;
    }
  });
}

/* state kept across dashboard re-renders */
const dash = { range: 30, dim: 'app_version', status: '', sort: 'last_seen', page: 1 };

async function dashboardView(appId) {
  topbar.hidden = false;
  destroyCharts();
  view.innerHTML = `<div class="container"><div class="loading">Loading dashboard…</div></div>`;

  const [app, overview] = await Promise.all([
    api('GET', `/api/v1/apps/${appId}`),
    api('GET', `/api/v1/apps/${appId}/stats/overview`),
  ]);

  view.innerHTML = `
    <div class="container">
      <a class="crumb" href="#/apps">← All apps</a>
      <div class="page-head">
        <div><h1>${esc(app.name)}</h1><span class="sub">${esc(app.package_name)}</span></div>
        <button id="btn-refresh">Refresh</button>
      </div>

      <div class="kpi-row">
        <div class="card tile"><div class="label">Total events</div><div class="value">${compact(overview.total_events)}</div><div class="hint">${compact(overview.fatal_events)} fatal</div></div>
        <div class="card tile"><div class="label">Open issues</div><div class="value">${compact(overview.open_issues)}</div><div class="hint">of ${compact(overview.total_issues)} total</div></div>
        <div class="card tile"><div class="label">Affected users</div><div class="value">${compact(overview.affected_users)}</div><div class="hint">distinct installs</div></div>
        <div class="card tile"><div class="label">Last 24 h</div><div class="value">${compact(overview.events_24h)}</div><div class="hint">${compact(overview.events_7d)} in 7 days</div></div>
      </div>

      <div class="filter-row">
        <label>Range</label>
        <select id="f-range">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <label>Break down by</label>
        <select id="f-dim">
          <option value="app_version">App version</option>
          <option value="os_version">OS version</option>
          <option value="device_model">Device model</option>
        </select>
      </div>

      <div class="charts-row">
        <div class="card">
          <h2>Crashes per day</h2>
          <p class="card-sub">Fatal vs non-fatal events received</p>
          <div class="chart-box" style="height:240px"><canvas id="ch-time"></canvas></div>
        </div>
        <div class="card">
          <h2 id="bd-title">Events by app version</h2>
          <p class="card-sub">Events and affected users per bucket</p>
          <div class="chart-box"><canvas id="ch-breakdown"></canvas></div>
        </div>
      </div>

      <div class="card section-gap">
        <div class="page-head" style="margin-bottom:8px">
          <h2 style="font-size:13px">Issues</h2>
          <div class="filter-row" style="margin:0">
            <select id="f-status">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
        </div>
        <div id="issues-table"></div>
      </div>
    </div>`;

  document.getElementById('f-range').value = String(dash.range);
  document.getElementById('f-dim').value = dash.dim;
  document.getElementById('f-status').value = dash.status;
  document.getElementById('btn-refresh').onclick = () => dashboardView(appId);

  async function renderCharts() {
    destroyCharts();
    const [series, breakdown] = await Promise.all([
      api('GET', `/api/v1/apps/${appId}/stats/timeseries?days=${dash.range}`),
      api('GET', `/api/v1/apps/${appId}/stats/breakdown?by=${dash.dim}&days=${dash.range}`),
    ]);
    document.getElementById('bd-title').textContent =
      'Events by ' + { app_version: 'app version', os_version: 'OS version', device_model: 'device model' }[dash.dim];
    timeseriesChart(document.getElementById('ch-time'), series.days);
    if (breakdown.buckets.length) {
      breakdownChart(document.getElementById('ch-breakdown'), breakdown.buckets);
    } else {
      document.getElementById('ch-breakdown').parentElement.innerHTML = '<div class="empty">No data in range</div>';
    }
  }

  async function renderIssues() {
    const params = new URLSearchParams({ sort: dash.sort, page: dash.page, limit: 15 });
    if (dash.status) params.set('status', dash.status);
    const data = await api('GET', `/api/v1/apps/${appId}/issues?${params}`);
    const wrap = document.getElementById('issues-table');

    if (!data.issues.length) {
      wrap.innerHTML = '<div class="empty">No issues match — either your app is healthy or the SDK is not integrated yet.</div>';
      return;
    }

    const arrow = (field) => (dash.sort === field ? ' ↓' : '');
    wrap.innerHTML = `
      <table>
        <thead><tr>
          <th>Issue</th>
          <th>Type</th>
          <th class="num sortable" data-sort="event_count">Events${arrow('event_count')}</th>
          <th class="num sortable" data-sort="user_count">Users${arrow('user_count')}</th>
          <th>Status</th>
          <th class="sortable" data-sort="last_seen">Last seen${arrow('last_seen')}</th>
        </tr></thead>
        <tbody>
          ${data.issues.map((issue) => `
            <tr class="rowlink" data-id="${issue._id}">
              <td>
                <div class="issue-title">${esc(issue.exception_type.split('.').pop())} @ ${esc(issue.location)}</div>
                <div class="issue-msg">${esc(issue.sample_message || '—')}</div>
              </td>
              <td>${issue.is_fatal
                ? '<span class="chip fatal"><span class="dot"></span>crash</span>'
                : '<span class="chip nonfatal"><span class="dot"></span>handled</span>'}</td>
              <td class="num">${compact(issue.event_count)}</td>
              <td class="num">${compact(issue.user_count)}</td>
              <td><span class="chip ${issue.status}"><span class="dot"></span>${issue.status}</span></td>
              <td title="${esc(fmtDate(issue.last_seen))}">${timeAgo(issue.last_seen)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="pager">
        <span>${data.total} issues</span>
        <button id="pg-prev" ${dash.page <= 1 ? 'disabled' : ''}>‹</button>
        <span>page ${data.page}</span>
        <button id="pg-next" ${data.page * data.limit >= data.total ? 'disabled' : ''}>›</button>
      </div>`;

    wrap.querySelectorAll('tr.rowlink').forEach((row) => {
      row.onclick = () => (location.hash = `#/issue/${row.dataset.id}`);
    });
    wrap.querySelectorAll('th.sortable').forEach((th) => {
      th.onclick = () => { dash.sort = th.dataset.sort; dash.page = 1; renderIssues(); };
    });
    const prev = document.getElementById('pg-prev');
    const next = document.getElementById('pg-next');
    if (prev) prev.onclick = () => { dash.page--; renderIssues(); };
    if (next) next.onclick = () => { dash.page++; renderIssues(); };
  }

  document.getElementById('f-range').onchange = (e) => { dash.range = Number(e.target.value); renderCharts(); };
  document.getElementById('f-dim').onchange = (e) => { dash.dim = e.target.value; renderCharts(); };
  document.getElementById('f-status').onchange = (e) => { dash.status = e.target.value; dash.page = 1; renderIssues(); };

  await Promise.all([renderCharts(), renderIssues()]);
}

async function issueView(issueId) {
  topbar.hidden = false;
  destroyCharts();
  view.innerHTML = `<div class="container"><div class="loading">Loading issue…</div></div>`;

  const issue = await api('GET', `/api/v1/issues/${issueId}`);
  const appId = issue.app_id;

  view.innerHTML = `
    <div class="container">
      <a class="crumb" href="#/app/${appId}">← Back to dashboard</a>
      <div class="card">
        <div class="page-head" style="margin-bottom:4px">
          <div>
            <h1 style="font-size:17px">${esc(issue.exception_type)} <span style="color:var(--muted)">@</span> ${esc(issue.location)}</h1>
            <span class="sub">${esc(issue.sample_message || 'no message')}</span>
          </div>
          <div>
            ${issue.is_fatal
              ? '<span class="chip fatal"><span class="dot"></span>crash</span>'
              : '<span class="chip nonfatal"><span class="dot"></span>handled</span>'}
            <span class="chip ${issue.status}"><span class="dot"></span>${issue.status}</span>
          </div>
        </div>
        <div class="meta-row">
          <span><b>${compact(issue.event_count)}</b> events</span>
          <span><b>${compact(issue.user_count)}</b> users</span>
          <span>first seen <b>${esc(fmtDate(issue.first_seen))}</b></span>
          <span>last seen <b>${esc(fmtDate(issue.last_seen))}</b></span>
        </div>
        <div class="actions-row section-gap">
          ${issue.status !== 'resolved' ? '<button id="act-resolve" class="primary">Mark resolved</button>' : ''}
          ${issue.status !== 'open' ? '<button id="act-reopen">Reopen</button>' : ''}
          ${issue.status !== 'ignored' ? '<button id="act-ignore">Ignore</button>' : ''}
          <button id="act-delete" class="danger">Delete issue</button>
        </div>
      </div>

      <div class="charts-row section-gap">
        <div class="card">
          <h2>Occurrences per day (30 d)</h2>
          <div class="chart-box" style="height:200px"><canvas id="ch-issue-time"></canvas></div>
        </div>
        <div class="card">
          <h2>By app version</h2>
          <div class="chart-box"><canvas id="ch-issue-bd"></canvas></div>
        </div>
      </div>

      <div class="card section-gap">
        <h2>Stack trace <span style="color:var(--muted);font-weight:400">(latest occurrence)</span></h2>
        <pre class="trace" id="trace"></pre>
      </div>

      <div class="card section-gap">
        <h2>Occurrences</h2>
        <div id="events-table"><div class="loading">Loading…</div></div>
      </div>
    </div>`;

  document.getElementById('trace').textContent =
    (issue.last_event && issue.last_event.raw_stack_trace) || 'no stack trace captured';

  async function setStatus(status) {
    await api('PATCH', `/api/v1/issues/${issueId}`, { status });
    toast(`Issue ${status}`);
    issueView(issueId);
  }
  const resolveBtn = document.getElementById('act-resolve');
  const reopenBtn = document.getElementById('act-reopen');
  const ignoreBtn = document.getElementById('act-ignore');
  if (resolveBtn) resolveBtn.onclick = () => setStatus('resolved');
  if (reopenBtn) reopenBtn.onclick = () => setStatus('open');
  if (ignoreBtn) ignoreBtn.onclick = () => setStatus('ignored');
  document.getElementById('act-delete').onclick = async () => {
    if (!confirm('Delete this issue and all its events?')) return;
    await api('DELETE', `/api/v1/issues/${issueId}`);
    toast('Issue deleted');
    location.hash = `#/app/${appId}`;
  };

  const [series, breakdown] = await Promise.all([
    api('GET', `/api/v1/apps/${appId}/stats/timeseries?days=30&issue_id=${issueId}`),
    api('GET', `/api/v1/apps/${appId}/stats/breakdown?by=app_version&issue_id=${issueId}`),
  ]);
  areaChart(document.getElementById('ch-issue-time'), series.days);
  if (breakdown.buckets.length) {
    breakdownChart(document.getElementById('ch-issue-bd'), breakdown.buckets);
  } else {
    document.getElementById('ch-issue-bd').parentElement.innerHTML = '<div class="empty">No data</div>';
  }

  let page = 1;
  async function renderEvents() {
    const data = await api('GET', `/api/v1/issues/${issueId}/events?page=${page}&limit=10`);
    document.getElementById('events-table').innerHTML = `
      <table>
        <thead><tr>
          <th>When</th><th>App version</th><th>Device</th><th>OS</th><th>Thread</th><th>User (install)</th>
        </tr></thead>
        <tbody>
          ${data.events.map((e) => `
            <tr>
              <td title="${esc(fmtDate(e.timestamp))}">${timeAgo(e.timestamp)}</td>
              <td class="num">${esc(e.app_version || '-')}</td>
              <td>${esc([e.device_manufacturer, e.device_model].filter(Boolean).join(' ') || '-')}</td>
              <td class="num">${esc(e.os_version || '-')}</td>
              <td>${esc(e.thread || '-')}</td>
              <td style="font-family:ui-monospace,monospace;font-size:11.5px">${esc((e.install_id || '').slice(0, 8))}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="pager">
        <span>${data.total} occurrences</span>
        <button id="ev-prev" ${page <= 1 ? 'disabled' : ''}>‹</button>
        <span>page ${data.page}</span>
        <button id="ev-next" ${page * data.limit >= data.total ? 'disabled' : ''}>›</button>
      </div>`;
    const prev = document.getElementById('ev-prev');
    const next = document.getElementById('ev-next');
    if (prev) prev.onclick = () => { page--; renderEvents(); };
    if (next) next.onclick = () => { page++; renderEvents(); };
  }
  await renderEvents();
}

/* ---------------- router ---------------- */

async function router() {
  const hash = location.hash || '#/apps';
  const hasKey = Boolean(localStorage.getItem(KEY_STORAGE));

  try {
    if (hash === '#/login' || !hasKey) return loginView();
    if (hash === '#/apps') return await appsView();
    let match = hash.match(/^#\/app\/([\w-]+)$/);
    if (match) return await dashboardView(match[1]);
    match = hash.match(/^#\/issue\/([\w-]+)$/);
    if (match) return await issueView(match[1]);
    location.hash = '#/apps';
  } catch (err) {
    if (err.message !== 'unauthorized') {
      view.innerHTML = `<div class="container"><div class="card"><p class="login-error">Error: ${esc(err.message)}</p>
        <a href="#/apps">← Back to apps</a></div></div>`;
    }
  }
}

document.getElementById('nav-apps').onclick = () => (location.hash = '#/apps');
document.getElementById('nav-logout').onclick = () => {
  localStorage.removeItem(KEY_STORAGE);
  location.hash = '#/login';
};

window.addEventListener('hashchange', router);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', router);
router();
