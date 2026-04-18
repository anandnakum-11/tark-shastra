/* ================================================================
   SakshyaAI – Frontend Application Logic
   ================================================================ */

const API_BASE = 'http://localhost:3000';
let authToken = localStorage.getItem('sakshyaai_token');
let currentUser = JSON.parse(localStorage.getItem('sakshyaai_user') || 'null');
let currentView = 'dashboard';

// ── API Helper ──────────────────────────────────
async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 0, ok: false, data: { error: `Network error: ${err.message}` } };
  }
}

// ── Toast Notifications ─────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Auth ─────────────────────────────────────────
function fillCreds(username, password) {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  btn.textContent = 'Signing in...';
  btn.disabled = true;

  const { ok, data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (ok) {
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('sakshyaai_token', authToken);
    localStorage.setItem('sakshyaai_user', JSON.stringify(currentUser));
    errorEl.style.display = 'none';
    showToast(`Welcome, ${currentUser.name}!`, 'success');
    initApp();
  } else {
    errorEl.textContent = data.error || 'Login failed';
    errorEl.style.display = 'block';
  }

  btn.textContent = 'Sign In';
  btn.disabled = false;
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('sakshyaai_token');
  localStorage.removeItem('sakshyaai_user');
  showLoginScreen();
  showToast('Logged out', 'info');
}

function showLoginScreen() {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('user-info').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
}

// ── Navigation ──────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    if (view) switchView(view);
  });
});

function switchView(view) {
  if (!authToken) return showLoginScreen();
  currentView = view;

  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const viewEl = document.getElementById(`${view}-view`);
  if (viewEl) viewEl.style.display = 'block';

  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const navLink = document.querySelector(`[data-view="${view}"]`);
  if (navLink) navLink.classList.add('active');

  // Load data for the view
  switch (view) {
    case 'dashboard': loadDashboard(); break;
    case 'grievances': loadGrievances(); break;
    case 'verification': loadVerificationView(); break;
    case 'departments': loadDepartments(); break;
  }
}

// ── App Init ────────────────────────────────────
function initApp() {
  if (!authToken || !currentUser) return showLoginScreen();

  // Show user info
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('user-info').style.display = 'flex';
  document.getElementById('btn-logout').style.display = 'flex';
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-role').textContent = currentUser.role;
  document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

  // Show appropriate default view based on role
  switchView('dashboard');
}

// ── Dashboard ───────────────────────────────────
async function loadDashboard() {
  // Try collector dashboard first
  const { ok, data } = await api('/api/collector/dashboard');

  if (ok && data.overview) {
    document.getElementById('stat-total').textContent = data.overview.totalGrievances;
    document.getElementById('stat-open').textContent = data.overview.open;
    document.getElementById('stat-pending').textContent = data.overview.pendingVerification;
    document.getElementById('stat-closed').textContent = data.overview.closed;
    document.getElementById('stat-reopened').textContent = data.overview.reopened;

    // Render department scores
    const tbody = document.getElementById('dept-scores-body');
    if (data.departments && data.departments.length > 0) {
      tbody.innerHTML = data.departments.map(d => {
        const scoreColor = d.score >= 80 ? 'var(--accent-success)' : d.score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
        return `<tr>
          <td><strong>${d.department.name}</strong><br><small style="color:var(--text-muted)">${d.department.code}</small></td>
          <td>${d.department.district || '—'}</td>
          <td>
            <div class="score-bar-container">
              <span class="score-value" style="color:${scoreColor}">${d.score}%</span>
              <div class="score-bar">
                <div class="score-bar-fill" style="width:${d.score}%;background:${scoreColor}"></div>
              </div>
            </div>
          </td>
          <td>${d.totalGrievances}</td>
          <td style="color:var(--accent-success)">${d.successfulVerifications}</td>
          <td style="color:var(--accent-danger)">${d.failedVerifications}</td>
          <td style="color:var(--accent-warning)">${d.pendingVerification}</td>
          <td style="color:var(--accent-danger)">${d.reopened}</td>
        </tr>`;
      }).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No department data yet. Run seed first.</td></tr>';
    }
  } else {
    // Fallback: load basic stats from grievances
    await loadBasicStats();
  }
}

async function loadBasicStats() {
  const { ok, data } = await api('/api/grievances?limit=1000');
  if (ok && data.grievances) {
    document.getElementById('stat-total').textContent = data.total || data.grievances.length;
    document.getElementById('stat-open').textContent = data.grievances.filter(g => g.status === 'OPEN').length;
    document.getElementById('stat-pending').textContent = data.grievances.filter(g => g.status === 'PENDING_VERIFICATION').length;
    document.getElementById('stat-closed').textContent = data.grievances.filter(g => g.status === 'CLOSED').length;
    document.getElementById('stat-reopened').textContent = data.grievances.filter(g => g.status === 'REOPENED').length;
  }
}

function refreshDashboard() {
  showToast('Refreshing dashboard...', 'info');
  loadDashboard();
}

// ── Grievances ──────────────────────────────────
async function loadGrievances() {
  const status = document.getElementById('filter-status').value;
  const query = status ? `?status=${status}` : '';

  const { ok, data } = await api(`/api/grievances${query}`);
  const tbody = document.getElementById('grievances-body');

  if (ok && data.grievances) {
    if (data.grievances.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No grievances found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.grievances.map(g => `
      <tr>
        <td><code>${g.swagatId || '—'}</code></td>
        <td><strong>${g.title}</strong></td>
        <td>${g.category}</td>
        <td>${g.address}</td>
        <td><span class="status-badge status-${g.status}">${g.status.replace('_', ' ')}</span></td>
        <td>${g.department?.name || '—'}</td>
        <td>
          ${g.status === 'OPEN' && currentUser?.role === 'DEPARTMENT' ?
            `<button class="btn btn-sm btn-primary" onclick="resolveGrievance('${g._id}')">Resolve</button>` : ''}
          ${g.status === 'PENDING_VERIFICATION' ?
            `<button class="btn btn-sm btn-outline" onclick="viewGrievanceDetail('${g._id}')">View</button>` : ''}
          ${g.status === 'REOPENED' ?
            `<button class="btn btn-sm btn-danger" onclick="viewGrievanceDetail('${g._id}')">Details</button>` : ''}
          ${!['OPEN', 'PENDING_VERIFICATION', 'REOPENED'].includes(g.status) ?
            `<button class="btn btn-sm btn-outline" onclick="viewGrievanceDetail('${g._id}')">View</button>` : ''}
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Failed to load grievances.</td></tr>';
  }
}

async function resolveGrievance(id) {
  showToast('Marking grievance as resolved...', 'info');
  const { ok, data } = await api(`/api/grievances/${id}/resolve`, { method: 'POST' });
  if (ok) {
    showToast('✅ Grievance moved to PENDING_VERIFICATION. IVR triggered!', 'success');
    loadGrievances();
  } else {
    showToast(`❌ ${data.error}`, 'error');
  }
}

async function viewGrievanceDetail(id) {
  const { ok, data } = await api(`/api/grievances/${id}`);
  if (!ok) return showToast('Failed to load grievance', 'error');

  const g = data.grievance;
  const v = data.verificationLog;

  document.getElementById('modal-title').textContent = `Grievance: ${g.swagatId || g._id}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem;">
      <div>
        <strong style="font-size:1.05rem;">${g.title}</strong>
        <p style="color:var(--text-secondary);margin-top:0.3rem;font-size:0.85rem;">${g.description}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
        <div><small style="color:var(--text-muted)">Status</small><br><span class="status-badge status-${g.status}">${g.status}</span></div>
        <div><small style="color:var(--text-muted)">Category</small><br>${g.category}</div>
        <div><small style="color:var(--text-muted)">Address</small><br>${g.address}</div>
        <div><small style="color:var(--text-muted)">Phone</small><br>${g.complainantPhone}</div>
        <div><small style="color:var(--text-muted)">Department</small><br>${g.department?.name || '—'}</div>
        <div><small style="color:var(--text-muted)">GPS</small><br>${g.location?.coordinates?.join(', ') || '—'}</div>
      </div>
      ${v ? `
      <div style="border-top:1px solid var(--border-color);padding-top:1rem;">
        <strong>Verification Log</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">
          <div><small style="color:var(--text-muted)">Citizen Response</small><br><span class="status-badge status-${v.citizenResponse === 'CONFIRMED' ? 'CLOSED' : v.citizenResponse === 'DISPUTED' ? 'REOPENED' : 'PENDING_VERIFICATION'}">${v.citizenResponse}</span></div>
          <div><small style="color:var(--text-muted)">Final Status</small><br>${v.finalStatus}</div>
          <div style="grid-column:span 2"><small style="color:var(--text-muted)">Decision Reason</small><br>${v.decisionReason || '—'}</div>
        </div>
      </div>
      ` : ''}
    </div>
  `;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function showCreateGrievanceModal() {
  showToast('Create grievance via API: POST /api/grievances', 'info');
}

// ── Verification Workflow ───────────────────────
async function loadVerificationView() {
  const { ok, data } = await api('/api/grievances?status=PENDING_VERIFICATION&limit=100');
  const select = document.getElementById('verify-grievance-select');

  select.innerHTML = '<option value="">Select a grievance...</option>';
  if (ok && data.grievances) {
    // Also include OPEN ones for resolve testing
    const { data: openData } = await api('/api/grievances?status=OPEN&limit=100');
    const all = [...data.grievances, ...(openData?.grievances || [])];

    all.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g._id;
      opt.textContent = `[${g.status}] ${g.swagatId || ''} — ${g.title}`;
      select.appendChild(opt);
    });
  }

  select.onchange = async () => {
    const id = select.value;
    if (!id) {
      document.getElementById('verify-detail-box').style.display = 'none';
      return;
    }
    const { ok, data } = await api(`/api/grievances/${id}`);
    if (ok) {
      const g = data.grievance;
      document.getElementById('verify-detail-box').style.display = 'block';
      document.getElementById('verify-detail-box').innerHTML = `
        <strong>${g.title}</strong> <span class="status-badge status-${g.status}">${g.status}</span>
        <br><small style="color:var(--text-muted)">${g.address} | Phone: ${g.complainantPhone} | GPS: ${g.location.coordinates.join(', ')}</small>
        ${g.status === 'OPEN' ? `<br><br><button class="btn btn-primary btn-sm" onclick="resolveAndReload('${g._id}')">Mark as Resolved (triggers verification)</button>` : ''}
      `;

      // Pre-fill evidence GPS
      if (g.location?.coordinates) {
        document.getElementById('evidence-lon').value = g.location.coordinates[0];
        document.getElementById('evidence-lat').value = g.location.coordinates[1];
      }
    }
  };

  // Reset results
  ['ivr-result', 'evidence-result', 'eval-result'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

async function resolveAndReload(id) {
  const { ok, data } = await api(`/api/grievances/${id}/resolve`, { method: 'POST' });
  if (ok) {
    showToast('✅ Verification triggered!', 'success');
    loadVerificationView();
  } else {
    showToast(`❌ ${data.error}`, 'error');
  }
}

async function simulateIvr(digit) {
  const id = document.getElementById('verify-grievance-select').value;
  if (!id) return showToast('Select a grievance first', 'warning');

  const { ok, data } = await api(`/api/grievances/${id}/simulate-ivr`, {
    method: 'POST',
    body: JSON.stringify({ digit }),
  });

  const resultEl = document.getElementById('ivr-result');
  resultEl.style.display = 'block';

  if (ok) {
    const response = data.verificationLog?.citizenResponse;
    const isConfirm = response === 'CONFIRMED';
    resultEl.className = `ivr-result ${isConfirm ? 'result-success' : 'result-warning'}`;
    resultEl.innerHTML = `<strong>📞 IVR Response: ${response}</strong><br>
      ${isConfirm ? 'Citizen confirmed resolution.' : 'Citizen disputed. Grievance will auto-reopen unless evidence overrides.'}
      <br><small>Call SID: ${data.verificationLog?.ivrCallSid} | Time: ${new Date(data.verificationLog?.ivrTimestamp).toLocaleString()}</small>`;
    showToast(`IVR: ${response}`, isConfirm ? 'success' : 'warning');
  } else {
    resultEl.className = 'ivr-result result-error';
    resultEl.textContent = `Error: ${data.error}`;
  }
}

async function submitEvidence() {
  const id = document.getElementById('verify-grievance-select').value;
  if (!id) return showToast('Select a grievance first', 'warning');

  const lat = parseFloat(document.getElementById('evidence-lat').value);
  const lon = parseFloat(document.getElementById('evidence-lon').value);

  if (isNaN(lat) || isNaN(lon)) return showToast('Enter valid GPS coordinates', 'warning');

  // Step 1: Get presigned URL (mock)
  showToast('Generating upload URL...', 'info');
  const { ok: urlOk, data: urlData } = await api(`/api/evidence/upload-url?grievanceId=${id}&fileName=evidence_photo.jpg&fileType=image/jpeg`);

  if (!urlOk) return showToast(`Upload URL error: ${urlData.error}`, 'error');

  // Step 2: Confirm evidence with GPS
  const { ok, data } = await api('/api/evidence/confirm', {
    method: 'POST',
    body: JSON.stringify({
      grievanceId: id,
      imageKey: urlData.key || `evidence/${id}/mock_photo.jpg`,
      latitude: lat,
      longitude: lon,
    }),
  });

  const resultEl = document.getElementById('evidence-result');
  resultEl.style.display = 'block';

  if (ok) {
    const gpsOk = data.gpsValid;
    resultEl.className = `evidence-result ${gpsOk ? 'result-success' : 'result-warning'}`;
    resultEl.innerHTML = `<strong>📸 Evidence Uploaded</strong><br>
      GPS Distance: <strong>${data.distance}m</strong> (threshold: ${data.threshold}m)
      <br>GPS Valid: <strong style="color:${gpsOk ? 'var(--accent-success)' : 'var(--accent-danger)'}">${gpsOk ? '✅ YES' : '❌ NO'}</strong>
      <br><small>Image key: ${data.evidence?.imageKey}</small>`;
    showToast(`Evidence uploaded. GPS: ${gpsOk ? 'valid' : 'invalid (too far)'}`, gpsOk ? 'success' : 'warning');
  } else {
    resultEl.className = 'evidence-result result-error';
    resultEl.textContent = `Error: ${data.error}`;
  }
}

async function runEvaluation() {
  const id = document.getElementById('verify-grievance-select').value;
  if (!id) return showToast('Select a grievance first', 'warning');

  showToast('Running verification engine...', 'info');
  const { ok, data } = await api(`/api/grievances/${id}/evaluate`, { method: 'POST' });

  const resultEl = document.getElementById('eval-result');
  resultEl.style.display = 'block';

  if (ok) {
    const closed = data.result?.finalStatus === 'CLOSED';
    resultEl.className = `eval-result ${closed ? 'result-success' : 'result-error'}`;
    resultEl.innerHTML = `<strong>⚡ Verification Result: ${data.result?.finalStatus}</strong><br>
      <em>${data.result?.reason}</em>`;
    showToast(`Verification: ${data.result?.finalStatus}`, closed ? 'success' : 'error');
  } else {
    resultEl.className = 'eval-result result-error';
    resultEl.textContent = `Error: ${data.error}`;
  }
}

// ── Departments View ────────────────────────────
async function loadDepartments() {
  const grid = document.getElementById('dept-cards-grid');
  grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Loading department scores...</p>';

  // Use the collector dashboard which has all dept scores in one call
  const { ok, data } = await api('/api/collector/dashboard');

  // Fallback: fetch departments list and their individual scores
  if (!ok || !data.departments) {
    const { ok: dOk, data: dData } = await api('/api/departments');
    if (!dOk || !dData.departments) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Could not load department data. Ensure you are logged in as Collector.</p>';
      return;
    }
    // Build cards with zero scores as fallback
    grid.innerHTML = dData.departments.map(dept => buildDeptCard({
      department: dept,
      score: 100,
      totalGrievances: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      pendingVerification: 0,
      reopened: 0,
    })).join('');
    return;
  }

  // Sort worst score first for quick action
  const sorted = [...data.departments].sort((a, b) => a.score - b.score);
  grid.innerHTML = sorted.map(d => buildDeptCard(d)).join('');
}

function buildDeptCard(d) {
  const score = d.score ?? 100;
  const scoreColor = score >= 80 ? 'var(--accent-success)' : score >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';
  const dept = d.department || d;
  return `
    <div class="dept-card">
      <div class="dept-card-header">
        <div>
          <h4>${dept.name}</h4>
          <small style="color:var(--text-muted)">${dept.code || '—'} • ${dept.district || '—'}</small>
        </div>
        <div class="dept-score-big" style="color:${scoreColor}">${score}%</div>
      </div>
      <div class="score-bar" style="max-width:100%;height:6px;margin-top:0.5rem;">
        <div class="score-bar-fill" style="width:${score}%;background:${scoreColor}"></div>
      </div>
      <div class="dept-stats">
        <div class="dept-stat">
          <div class="dept-stat-value">${d.totalGrievances ?? 0}</div>
          <div class="dept-stat-label">Total</div>
        </div>
        <div class="dept-stat">
          <div class="dept-stat-value" style="color:var(--accent-success)">${d.successfulVerifications ?? 0}</div>
          <div class="dept-stat-label">Verified</div>
        </div>
        <div class="dept-stat">
          <div class="dept-stat-value" style="color:var(--accent-danger)">${d.failedVerifications ?? 0}</div>
          <div class="dept-stat-label">Failed</div>
        </div>
        <div class="dept-stat">
          <div class="dept-stat-value" style="color:var(--accent-warning)">${d.pendingVerification ?? 0}</div>
          <div class="dept-stat-label">Pending</div>
        </div>
      </div>
      <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
        <span class="status-badge status-REOPENED">${d.reopened ?? 0} Reopened</span>
        <span class="status-badge status-OPEN">${d.open ?? 0} Open</span>
        <span class="status-badge status-CLOSED">${d.closed ?? 0} Closed</span>
      </div>
    </div>
  `;
}

// ── API Tester ──────────────────────────────────
function setEndpoint(method, url, body = '') {
  document.getElementById('api-method').value = method;
  document.getElementById('api-url').value = url;
  document.getElementById('api-body').value = body;
}

async function sendApiRequest() {
  const method = document.getElementById('api-method').value;
  const urlPath = document.getElementById('api-url').value;
  const body = document.getElementById('api-body').value;
  const responseEl = document.getElementById('api-response');
  const statusEl = document.getElementById('api-status');

  responseEl.textContent = 'Loading...';
  statusEl.textContent = '';
  statusEl.className = 'api-status';

  const options = { method };
  if (body && method !== 'GET') {
    try {
      options.body = body;
    } catch (e) {
      options.body = body;
    }
  }

  const { status, data } = await api(urlPath, options);

  statusEl.textContent = `${status}`;
  statusEl.className = `api-status s${status}`;
  responseEl.textContent = JSON.stringify(data, null, 2);
}

// ── Boot ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (authToken && currentUser) {
    initApp();
  } else {
    showLoginScreen();
  }

  // Check backend health
  api('/api/health').then(({ ok, data }) => {
    if (ok) {
      if (data.mockMode) {
        document.getElementById('mock-badge').style.display = 'inline-block';
      }
    } else {
      showToast('⚠️ Backend not reachable. Start with: cd backend && npm run dev', 'error');
    }
  });
});

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Keyboard shortcut: ESC to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
