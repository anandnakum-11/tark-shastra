const API_BASE = 'http://localhost:5000';

function safeParseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch (error) {
    localStorage.removeItem('sakshyaai_user');
    return null;
  }
}

let authToken = localStorage.getItem('sakshyaai_token');
let currentUser = safeParseJson(localStorage.getItem('sakshyaai_user'));
let currentView = 'dashboard';
let currentTheme = localStorage.getItem('sakshyaai_theme') || 'light';
let departmentsCache = [];
let evidenceCaptureFile = null;
let evidenceCapturedAt = null;
let evidencePreviewUrl = null;
let evidenceGpsCaptured = false;
let authResetInFlight = false;

const VIEW_ACCESS = {
  citizen: ['dashboard', 'grievances'],
  field_officer: ['dashboard', 'grievances', 'evidence'],
  department_officer: ['dashboard', 'grievances', 'verification'],
  collector: ['dashboard', 'grievances', 'verification', 'evidence', 'departments'],
};

const DEFAULT_VIEW_BY_ROLE = {
  citizen: 'grievances',
  field_officer: 'evidence',
  department_officer: 'verification',
  collector: 'dashboard',
};

const STATUS_META = {
  open: { label: 'Open', className: 'status-open' },
  in_progress: { label: 'In Progress', className: 'status-in_progress' },
  resolved: { label: 'Resolved', className: 'status-resolved' },
  verification_pending: { label: 'Pending Verification', className: 'status-verification_pending' },
  verified: { label: 'Verified', className: 'status-verified' },
  reopened: { label: 'Reopened', className: 'status-reopened' },
};

const ROLE_LABELS = {
  citizen: 'Citizen',
  field_officer: 'Field Officer',
  department_officer: 'Department Officer',
  collector: 'Collector',
};

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && authToken) {
      clearAuthSession(false);
      if (!authResetInFlight) {
        authResetInFlight = true;
        showToast('Your session expired. Please sign in again.', 'warning');
        showLoginScreen();
        setTimeout(() => {
          authResetInFlight = false;
        }, 300);
      }
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: `Network error: ${error.message}` } };
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.getElementById('toast-container').appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function fillCreds(username, password) {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'User';
}

function getAllowedViews() {
  return VIEW_ACCESS[currentUser?.role] || ['dashboard'];
}

function getDefaultView() {
  return DEFAULT_VIEW_BY_ROLE[currentUser?.role] || 'dashboard';
}

function canAccessView(view) {
  return getAllowedViews().includes(view);
}

function applyRoleVisibility() {
  const allowedViews = new Set(getAllowedViews());

  document.querySelectorAll('.nav-link').forEach((link) => {
    const isAllowed = allowedViews.has(link.dataset.view);
    link.style.display = isAllowed ? 'inline-flex' : 'none';
  });

  const newGrievanceButton = document.getElementById('new-grievance-btn');
  if (newGrievanceButton) {
    newGrievanceButton.style.display = currentUser?.role === 'citizen' ? 'inline-flex' : 'none';
  }
}

function formatStatus(status) {
  return STATUS_META[status] || { label: status || 'Unknown', className: '' };
}

function categoryLabel(category) {
  return String(category || 'other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDepartmentName(value) {
  return value || 'Unassigned';
}

function scoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--danger)';
}

function toggleAuthForm(event) {
  event?.preventDefault();
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showingLogin = loginForm.style.display !== 'none';

  loginForm.style.display = showingLogin ? 'none' : 'grid';
  registerForm.style.display = showingLogin ? 'grid' : 'none';
  document.getElementById('auth-form-title').textContent = showingLogin ? 'Create Account' : 'Sign In';
  document.getElementById('auth-form-subtitle').textContent = showingLogin
    ? 'Create a new account and start tracking grievances.'
    : 'Enter your credentials to access the portal.';
  document.getElementById('toggle-text').innerHTML = showingLogin
    ? 'Already have an account? <a href="#" onclick="toggleAuthForm(event)">Sign in here</a>'
    : 'Don\'t have an account? <a href="#" onclick="toggleAuthForm(event)">Sign up here</a>';
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const button = document.getElementById('login-btn');
  const error = document.getElementById('login-error');

  button.disabled = true;
  button.textContent = 'Signing In...';

  const { ok, data } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (!ok) {
    error.textContent = data.error || 'Login failed.';
    error.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Sign In';
    return;
  }

  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem('sakshyaai_token', authToken);
  localStorage.setItem('sakshyaai_user', JSON.stringify(currentUser));
  error.style.display = 'none';
  button.disabled = false;
  button.textContent = 'Sign In';
  showToast(`Welcome back, ${currentUser.name}.`, 'success');
  initApp();
}

async function handleRegister(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('register-name').value.trim(),
    username: document.getElementById('register-email').value.trim(),
    phone: document.getElementById('register-phone').value.trim(),
    role: document.getElementById('register-role').value,
    department: document.getElementById('register-department').value.trim(),
    password: document.getElementById('register-password').value,
  };

  const button = document.getElementById('register-btn');
  const error = document.getElementById('register-error');

  button.disabled = true;
  button.textContent = 'Creating Account...';

  const { ok, data } = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!ok) {
    error.textContent = data.error || 'Registration failed.';
    error.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Create Account';
    return;
  }

  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem('sakshyaai_token', authToken);
  localStorage.setItem('sakshyaai_user', JSON.stringify(currentUser));
  error.style.display = 'none';
  button.disabled = false;
  button.textContent = 'Create Account';
  showToast('Account created successfully.', 'success');
  initApp();
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  localStorage.setItem('sakshyaai_theme', currentTheme);

  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  if (icon) icon.textContent = currentTheme === 'dark' ? 'Moon' : 'Sun';
  if (label) label.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
}

function showLoginScreen() {
  document.querySelectorAll('.view').forEach((view) => {
    view.style.display = 'none';
  });
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('user-mini').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
}

function clearAuthSession(showToastMessage = false) {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('sakshyaai_token');
  localStorage.removeItem('sakshyaai_user');
  if (showToastMessage) {
    showToast('Logged out successfully.', 'info');
  }
}

function logout() {
  clearAuthSession(true);
  showLoginScreen();
}

async function initApp() {
  if (!authToken || !currentUser) {
    showLoginScreen();
    return;
  }

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('user-mini').style.display = 'flex';
  document.getElementById('btn-logout').style.display = 'inline-flex';
  document.getElementById('user-avatar-mini').textContent = currentUser.name?.charAt(0)?.toUpperCase() || 'U';
  document.getElementById('user-name-mini').textContent = currentUser.name || 'User';
  document.getElementById('user-role-mini').textContent = roleLabel(currentUser.role);

  applyRoleVisibility();
  await ensureDepartmentsLoaded();
  currentView = canAccessView(currentView) ? currentView : getDefaultView();
  switchView(currentView);
}

function switchView(view) {
  if (!authToken) {
    showLoginScreen();
    return;
  }

  if (!canAccessView(view)) {
    view = getDefaultView();
  }

  currentView = view;
  document.querySelectorAll('.view').forEach((section) => {
    section.style.display = 'none';
  });

  const target = document.getElementById(`${view}-view`);
  if (target) {
    target.style.display = 'block';
  }

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === view);
  });

  if (view === 'dashboard') loadDashboard();
  if (view === 'grievances') loadGrievances();
  if (view === 'verification') loadVerificationView();
  if (view === 'evidence') loadEvidenceView();
  if (view === 'departments') loadDepartments();
}

async function ensureDepartmentsLoaded() {
  if (departmentsCache.length) return departmentsCache;

  const { ok, data } = await api('/api/departments');
  const select = document.getElementById('create-department');

  if (ok && Array.isArray(data.departments)) {
    departmentsCache = data.departments;
    if (select) {
      select.innerHTML = departmentsCache
        .map((department) => `<option value="${department.name}">${department.name}</option>`)
        .join('');
    }
  } else if (select) {
    select.innerHTML = '<option value="">No departments available</option>';
  }

  return departmentsCache;
}

async function loadDashboard() {
  if (currentUser?.role !== 'collector') {
    await loadBasicStats();
    renderDepartmentScoreRows([]);
    return;
  }

  const { ok, data } = await api('/api/collector/dashboard');

  if (ok && data.overview) {
    document.getElementById('stat-total').textContent = data.overview.totalGrievances;
    document.getElementById('stat-open').textContent = data.overview.open;
    document.getElementById('stat-pending').textContent = data.overview.pendingVerification;
    document.getElementById('stat-closed').textContent = data.overview.closed;
    document.getElementById('stat-reopened').textContent = data.overview.reopened;
    renderDepartmentScoreRows(data.departments || []);
    return;
  }

  await loadBasicStats();
  renderDepartmentScoreRows([]);
}

function renderDepartmentScoreRows(rows) {
  const tbody = document.getElementById('dept-scores-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">Department data is not available for this role yet.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((item) => {
    const color = scoreColor(Number(item.score || 0));
    return `
      <tr>
        <td>
          <strong>${item.department.name}</strong><br>
          <span class="inline-hint">${item.department.code || 'No code'}</span>
        </td>
        <td>${item.department.district || '-'}</td>
        <td>
          <div class="score-wrap">
            <strong style="color:${color};">${Number(item.score || 0)}%</strong>
            <div class="score-track">
              <div class="score-fill" style="width:${Number(item.score || 0)}%; background:${color};"></div>
            </div>
          </div>
        </td>
        <td>${item.totalGrievances || 0}</td>
        <td>${item.successfulVerifications || 0}</td>
        <td>${item.failedVerifications || 0}</td>
        <td>${item.pendingVerification || 0}</td>
        <td>${item.reopened || 0}</td>
      </tr>
    `;
  }).join('');
}

async function loadBasicStats() {
  const { ok, data } = await api('/api/grievances?limit=200');
  if (!ok || !Array.isArray(data.grievances)) {
    return;
  }

  const grievances = data.grievances;
  document.getElementById('stat-total').textContent = grievances.length;
  document.getElementById('stat-open').textContent = grievances.filter((item) => item.status === 'open').length;
  document.getElementById('stat-pending').textContent = grievances.filter((item) => item.status === 'verification_pending').length;
  document.getElementById('stat-closed').textContent = grievances.filter((item) => item.status === 'verified').length;
  document.getElementById('stat-reopened').textContent = grievances.filter((item) => item.status === 'reopened').length;
}

function refreshDashboard() {
  showToast('Refreshing dashboard data...', 'info');
  loadDashboard();
}

async function loadGrievances() {
  const status = document.getElementById('filter-status').value;
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const { ok, data } = await api(`/api/grievances${query}`);
  const tbody = document.getElementById('grievances-body');

  if (!ok || !Array.isArray(data.grievances)) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Unable to load grievances.</td></tr>';
    return;
  }

  if (!data.grievances.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No grievances found for the selected filter.</td></tr>';
    return;
  }

  tbody.innerHTML = data.grievances.map((grievance) => {
    const statusInfo = formatStatus(grievance.status);
    const canResolve = ['department_officer', 'collector'].includes(currentUser?.role) && grievance.status === 'open';
    return `
      <tr>
        <td><strong>${grievance.swagatId}</strong></td>
        <td>${grievance.title}</td>
        <td>${categoryLabel(grievance.category)}</td>
        <td>${grievance.address || '-'}</td>
        <td><span class="status-badge ${statusInfo.className}">${statusInfo.label}</span></td>
        <td>${formatDepartmentName(grievance.department)}</td>
        <td>
          ${canResolve ? `<button class="secondary-button" onclick="resolveGrievance('${grievance.id}')">Resolve</button>` : ''}
          <button class="secondary-button" onclick="viewGrievanceDetail('${grievance.id}')">View</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function resolveGrievance(id) {
  const { ok, data } = await api(`/api/grievances/${id}/resolve`, { method: 'POST' });
  if (!ok) {
    showToast(data.error || 'Unable to mark grievance for verification.', 'error');
    return;
  }

  showToast('Grievance moved to verification workflow. A field officer must upload evidence before the citizen IVR call starts.', 'success');
  loadGrievances();
  if (currentView === 'verification') loadVerificationView();
  if (currentView === 'evidence') loadEvidenceView();
}

async function viewGrievanceDetail(id) {
  const { ok, data } = await api(`/api/grievances/${id}`);
  if (!ok) {
    showToast(data.error || 'Unable to load grievance details.', 'error');
    return;
  }

  const grievance = data.grievance;
  const verification = data.verificationLog;
  const statusInfo = formatStatus(grievance.status);
  const verificationText = verification
    ? `
      <div class="detail-line"><strong>Verification status:</strong> ${verification.status || 'pending'}</div>
      <div class="detail-line"><strong>IVR result:</strong> ${verification.ivrResult || 'pending'}</div>
      <div class="detail-line"><strong>Reason:</strong> ${verification.reason || 'Awaiting evaluation'}</div>
    `
    : '<div class="detail-line">No verification log exists yet.</div>';

  document.getElementById('modal-title').textContent = grievance.swagatId;
  document.getElementById('modal-body').innerHTML = `
    <div class="detail-title">${grievance.title}</div>
    <div class="detail-line"><strong>Status:</strong> <span class="status-badge ${statusInfo.className}">${statusInfo.label}</span></div>
    <div class="detail-line"><strong>Category:</strong> ${categoryLabel(grievance.category)}</div>
    <div class="detail-line"><strong>Department:</strong> ${formatDepartmentName(grievance.department)}</div>
    <div class="detail-line"><strong>Citizen:</strong> ${grievance.citizen?.name || '-'}</div>
    <div class="detail-line"><strong>Phone:</strong> ${grievance.citizen?.phone || '-'}</div>
    <div class="detail-line"><strong>Address:</strong> ${grievance.address || '-'}</div>
    <div class="detail-line"><strong>Coordinates:</strong> ${grievance.locationLat}, ${grievance.locationLng}</div>
    <div class="detail-line"><strong>Assigned Officer:</strong> ${grievance.assignedOfficer?.name || 'Not assigned yet'}</div>
    <div class="detail-line"><strong>Description:</strong> ${grievance.description}</div>
    <hr>
    ${verificationText}
  `;
  document.getElementById('modal-overlay').style.display = 'grid';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

async function showCreateGrievanceModal() {
  if (currentUser?.role !== 'citizen') {
    showToast('Only citizens can create grievances from this workspace.', 'warning');
    return;
  }

  const departments = await ensureDepartmentsLoaded();
  document.getElementById('create-grievance-error').style.display = 'none';
  if (!departments.length) {
    document.getElementById('create-grievance-error').textContent = 'Department list is unavailable right now. Refresh and try again.';
    document.getElementById('create-grievance-error').style.display = 'block';
  }
  document.getElementById('create-grievance-overlay').style.display = 'grid';
}

function closeCreateGrievanceModal() {
  document.getElementById('create-grievance-overlay').style.display = 'none';
}

async function handleCreateGrievance(event) {
  event.preventDefault();

  if (currentUser?.role !== 'citizen') {
    showToast('Only citizens can submit new grievances.', 'warning');
    return;
  }

  const button = document.getElementById('create-grievance-btn');
  const error = document.getElementById('create-grievance-error');

  const payload = {
    title: document.getElementById('create-title').value.trim(),
    description: document.getElementById('create-description').value.trim(),
    category: document.getElementById('create-category').value,
    priority: document.getElementById('create-priority').value,
    address: document.getElementById('create-address').value.trim(),
    latitude: document.getElementById('create-latitude').value,
    longitude: document.getElementById('create-longitude').value,
    department: document.getElementById('create-department').value,
  };

  button.disabled = true;
  button.textContent = 'Submitting...';

  const { ok, data } = await api('/api/grievances', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!ok) {
    error.textContent = data.error || 'Unable to create grievance.';
    error.style.display = 'block';
    button.disabled = false;
    button.textContent = 'Submit Grievance';
    return;
  }

  closeCreateGrievanceModal();
  event.target.reset();
  button.disabled = false;
  button.textContent = 'Submit Grievance';
  showToast('Grievance created successfully.', 'success');
  loadGrievances();
  loadDashboard();
}

async function loadVerificationView() {
  const [pendingResponse, openResponse] = await Promise.all([
    api('/api/grievances?status=verification_pending&limit=100'),
    api('/api/grievances?status=open&limit=100'),
  ]);

  const select = document.getElementById('verify-grievance-select');
  select.innerHTML = '<option value="">Select a grievance</option>';

  const items = [
    ...(pendingResponse.data.grievances || []),
    ...(openResponse.data.grievances || []),
  ];

  items.forEach((grievance) => {
    const option = document.createElement('option');
    option.value = grievance.id;
    option.textContent = `[${formatStatus(grievance.status).label}] ${grievance.swagatId} - ${grievance.title}`;
    select.appendChild(option);
  });

  select.onchange = async () => {
    const grievanceId = select.value;
    const box = document.getElementById('verify-detail-box');
    if (!grievanceId) {
      box.style.display = 'none';
      return;
    }

    const { ok, data } = await api(`/api/grievances/${grievanceId}`);
    if (!ok) {
      showToast(data.error || 'Unable to load grievance.', 'error');
      return;
    }

    const grievance = data.grievance;
    box.style.display = 'block';
    box.innerHTML = `
      <div class="detail-title">${grievance.title}</div>
      <div class="detail-line"><strong>Status:</strong> ${formatStatus(grievance.status).label}</div>
      <div class="detail-line"><strong>Department:</strong> ${formatDepartmentName(grievance.department)}</div>
      <div class="detail-line"><strong>Citizen phone:</strong> ${grievance.citizen?.phone || '-'}</div>
      <div class="detail-line"><strong>Coordinates:</strong> ${grievance.locationLat}, ${grievance.locationLng}</div>
      <div class="detail-line"><strong>Assigned Officer:</strong> ${grievance.assignedOfficer?.name || 'Pending automatic assignment'}</div>
      ${grievance.status === 'open' && ['department_officer', 'collector'].includes(currentUser?.role)
        ? `<div class="detail-line"><button class="primary-button" onclick="resolveAndReload('${grievance.id}')">Mark as Resolved</button></div>`
        : ''}
    `;
  };

  ['ivr-result', 'eval-result'].forEach((id) => {
    const element = document.getElementById(id);
    element.style.display = 'none';
    element.className = 'result-card';
    element.innerHTML = '';
  });
}

async function resolveAndReload(id) {
  await resolveGrievance(id);
  loadVerificationView();
}

async function simulateIvr(digit) {
  const grievanceId = document.getElementById('verify-grievance-select').value;
  if (!grievanceId) {
    showToast('Select a grievance first.', 'warning');
    return;
  }

  const { ok, data } = await api(`/api/grievances/${grievanceId}/simulate-ivr`, {
    method: 'POST',
    body: JSON.stringify({ digit }),
  });

  const panel = document.getElementById('ivr-result');
  panel.style.display = 'block';

  if (!ok) {
    panel.className = 'result-card error';
    panel.textContent = data.error || 'Unable to simulate IVR.';
    return;
  }

  const ivrResult = data.verificationLog?.ivrResult || 'pending';
  const isPositive = ivrResult === 'resolved';
  panel.className = `result-card ${isPositive ? 'success' : 'warning'}`;
  panel.innerHTML = `<strong>IVR result:</strong> ${ivrResult}`;
  showToast(`Citizen response recorded as ${ivrResult}.`, isPositive ? 'success' : 'warning');
}

async function loadEvidenceView() {
  if (!authToken) {
    showLoginScreen();
    return;
  }

  const response = await api('/api/grievances?status=verification_pending&limit=100');
  const select = document.getElementById('evidence-grievance-select');
  const detail = document.getElementById('evidence-grievance-detail');
  select.innerHTML = '<option value="">Select a grievance</option>';

  (response.data.grievances || []).forEach((grievance) => {
    const option = document.createElement('option');
    option.value = grievance.id;
    option.textContent = `${grievance.swagatId} - ${grievance.title}`;
    select.appendChild(option);
  });

  select.onchange = async () => {
    const grievanceId = select.value;
    if (!grievanceId) {
      detail.style.display = 'none';
      document.getElementById('evidence-history-box').style.display = 'none';
      return;
    }

    const { ok, data } = await api(`/api/grievances/${grievanceId}`);
    if (!ok) {
      showToast(data.error || 'Unable to load grievance details.', 'error');
      return;
    }

    const grievance = data.grievance;
    detail.style.display = 'block';
    detail.innerHTML = `
      <div class="detail-title">${grievance.title}</div>
      <div class="detail-line"><strong>Department:</strong> ${formatDepartmentName(grievance.department)}</div>
      <div class="detail-line"><strong>Resolved At:</strong> ${grievance.resolvedAt ? new Date(grievance.resolvedAt).toLocaleString() : 'Not resolved yet'}</div>
      <div class="detail-line"><strong>Complaint Coordinates:</strong> ${grievance.locationLat}, ${grievance.locationLng}</div>
      <div class="detail-line"><strong>Assigned Officer:</strong> ${grievance.assignedOfficer?.name || 'Pending automatic assignment'}</div>
    `;

    document.getElementById('evidence-lat').value = '';
    document.getElementById('evidence-lon').value = '';
    document.getElementById('evidence-location-meta').textContent = 'GPS not captured yet.';
    evidenceGpsCaptured = false;
    document.getElementById('evidence-result').style.display = 'none';
    await loadEvidenceHistory(grievanceId);
  };
}

async function loadEvidenceHistory(grievanceId) {
  const history = await api(`/api/evidence/${grievanceId}`);
  const box = document.getElementById('evidence-history-box');
  if (!history.ok || !Array.isArray(history.data.evidence) || !history.data.evidence.length) {
    box.style.display = 'block';
    box.innerHTML = '<div class="detail-title">Evidence history</div><div class="detail-line">No evidence uploaded yet.</div>';
    return;
  }

  renderEvidenceHistory(history.data.evidence[0]);
}

function renderEvidenceHistory(evidence) {
  const box = document.getElementById('evidence-history-box');
  box.style.display = 'block';
  box.innerHTML = `
    <div class="detail-title">Latest evidence result</div>
    <div class="detail-line"><strong>Status:</strong> ${evidence.verificationStatus || 'unknown'}</div>
    <div class="detail-line"><strong>Reason:</strong> ${evidence.verificationReason || '-'}</div>
    <div class="detail-line"><strong>Distance:</strong> ${evidence.gpsDistanceM || 0}m</div>
    <div class="detail-line"><strong>Hash:</strong> ${evidence.imageHash || '-'}</div>
    <div class="detail-line"><strong>Captured At:</strong> ${evidence.capturedAt ? new Date(evidence.capturedAt).toLocaleString() : '-'}</div>
  `;
}

function captureEvidenceLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported in this browser.', 'error');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      document.getElementById('evidence-lat').value = latitude.toFixed(6);
      document.getElementById('evidence-lon').value = longitude.toFixed(6);
      document.getElementById('evidence-location-meta').textContent = `Live GPS captured at ${new Date().toLocaleTimeString()}: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      evidenceGpsCaptured = true;
      showToast('Live GPS captured.', 'success');
    },
    (error) => {
      showToast(`Unable to capture GPS: ${error.message}`, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function prefillEvidenceLocation() {
  const grievanceId = document.getElementById('evidence-grievance-select').value;
  if (!grievanceId) {
    showToast('Select a grievance first.', 'warning');
    return;
  }

  const { ok, data } = await api(`/api/grievances/${grievanceId}`);
  if (!ok) {
    showToast(data.error || 'Unable to load grievance coordinates.', 'error');
    return;
  }

  document.getElementById('evidence-lat').value = Number(data.grievance.locationLat).toFixed(6);
  document.getElementById('evidence-lon').value = Number(data.grievance.locationLng).toFixed(6);
  document.getElementById('evidence-location-meta').textContent = 'Complaint coordinates filled for testing.';
  evidenceGpsCaptured = false;
}

async function submitEvidence() {
  const grievanceId = document.getElementById('evidence-grievance-select').value;
  if (!grievanceId) {
    showToast('Select a grievance first.', 'warning');
    return;
  }

  if (!evidenceCaptureFile) {
    showToast('Capture a fresh photo first.', 'warning');
    return;
  }

  if (!evidenceGpsCaptured) {
    showToast('Capture live GPS on site before uploading evidence.', 'warning');
    return;
  }

  const latitude = parseFloat(document.getElementById('evidence-lat').value);
  const longitude = parseFloat(document.getElementById('evidence-lon').value);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    showToast('Capture valid GPS coordinates first.', 'warning');
    return;
  }

  if (!evidenceCapturedAt) {
    evidenceCapturedAt = new Date().toISOString();
  }

  const formData = new FormData();
  formData.append('grievanceId', grievanceId);
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));
  formData.append('timestamp', evidenceCapturedAt);
  formData.append('photo', evidenceCaptureFile);

  const button = document.getElementById('evidence-upload-btn');
  button.disabled = true;
  button.textContent = 'Uploading...';

  const { ok, status, data } = await api('/api/evidence/upload', {
    method: 'POST',
    body: formData,
  });

  button.disabled = false;
  button.textContent = 'Upload Evidence';

  const panel = document.getElementById('evidence-result');
  panel.style.display = 'block';

  if (!ok && status !== 422) {
    panel.className = 'result-card error';
    panel.innerHTML = `<strong>Upload Failed</strong><br>${data.error || 'Unable to upload evidence.'}`;
    showToast('Evidence upload failed.', 'error');
    return;
  }

  const statusLabel = data.verificationStatus === 'suspicious'
    ? 'Suspicious Evidence'
    : data.isValid
      ? 'Valid Evidence'
      : 'Invalid Evidence';
  const panelTone = data.verificationStatus === 'suspicious'
    ? 'warning'
    : data.isValid
      ? 'success'
      : 'error';

  panel.className = `result-card ${panelTone}`;
  panel.innerHTML = `
    <strong>${statusLabel}</strong><br>
    ${data.verificationReason}<br>
    GPS distance: ${data.distance}m<br>
    Hash: ${data.imageHash}
  `;
  if (data.ivrCall?.phone) {
    panel.innerHTML += `<br>Citizen IVR call started for ${data.ivrCall.phone}`;
  }
  if (data.evidence) {
    renderEvidenceHistory(data.evidence);
  }

  if (data.isValid) {
    showToast(data.ivrCall?.phone ? 'Evidence passed validation and the citizen IVR call has been started.' : 'Evidence passed photo and GPS validation.', 'success');
  } else if (data.verificationStatus === 'suspicious') {
    showToast(data.ivrCall?.phone ? 'Evidence uploaded, GPS looks suspicious, and the citizen IVR call has been started.' : 'Evidence uploaded, but the GPS location looks suspicious.', 'warning');
  } else {
    showToast(data.ivrCall?.phone ? 'Evidence uploaded, photo validation failed, and the citizen IVR call has been started.' : 'Evidence uploaded, but the photo validation failed.', 'error');
  }
}

async function runEvaluation() {
  const grievanceId = document.getElementById('verify-grievance-select').value;
  if (!grievanceId) {
    showToast('Select a grievance first.', 'warning');
    return;
  }

  const { ok, data } = await api(`/api/grievances/${grievanceId}/evaluate`, { method: 'POST' });
  const panel = document.getElementById('eval-result');
  panel.style.display = 'block';

  if (!ok) {
    panel.className = 'result-card error';
    panel.textContent = data.error || 'Unable to evaluate verification.';
    return;
  }

  const isVerified = data.result?.finalStatus === 'verified';
  panel.className = `result-card ${isVerified ? 'success' : 'error'}`;
  panel.innerHTML = `
    <strong>Final status:</strong> ${formatStatus(data.result?.finalStatus).label}<br>
    ${data.result?.reason || ''}
  `;
  showToast(`Verification completed with status ${formatStatus(data.result?.finalStatus).label}.`, isVerified ? 'success' : 'warning');
  loadGrievances();
  loadDashboard();
}

async function loadDepartments() {
  const grid = document.getElementById('dept-cards-grid');
  grid.innerHTML = '<div class="loading-cell">Loading departments...</div>';

  const dashboard = currentUser?.role === 'collector'
    ? await api('/api/collector/dashboard')
    : { ok: false, data: {} };

  if (dashboard.ok && Array.isArray(dashboard.data.departments) && dashboard.data.departments.length) {
    renderDepartmentCards(dashboard.data.departments);
    return;
  }

  const list = await api('/api/departments');
  if (!list.ok || !Array.isArray(list.data.departments)) {
    grid.innerHTML = '<div class="loading-cell">Unable to load departments.</div>';
    return;
  }

  renderDepartmentCards(list.data.departments.map((department) => ({
    department,
    score: 0,
    totalGrievances: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    pendingVerification: 0,
    reopened: 0,
    open: 0,
    closed: 0,
  })));
}

function renderDepartmentCards(items) {
  const grid = document.getElementById('dept-cards-grid');
  grid.innerHTML = items.map((item) => {
    const department = item.department || item;
    const color = scoreColor(Number(item.score || 0));
    return `
      <article class="dept-card">
        <div class="dept-card-header">
          <div>
            <h3>${department.name}</h3>
            <div class="inline-hint">${department.code || 'No code'} • ${department.district || 'District unavailable'}</div>
          </div>
          <div class="dept-score" style="color:${color};">${Number(item.score || 0)}%</div>
        </div>
        <div class="score-track">
          <div class="score-fill" style="width:${Number(item.score || 0)}%; background:${color};"></div>
        </div>
        <div class="dept-kpis">
          <div class="dept-kpi"><strong>${item.totalGrievances || 0}</strong><span>Total</span></div>
          <div class="dept-kpi"><strong>${item.successfulVerifications || 0}</strong><span>Verified</span></div>
          <div class="dept-kpi"><strong>${item.failedVerifications || 0}</strong><span>Failed</span></div>
          <div class="dept-kpi"><strong>${item.pendingVerification || 0}</strong><span>Pending</span></div>
        </div>
      </article>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(currentTheme);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      switchView(link.dataset.view);
    });
  });

  document.getElementById('modal-overlay').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });

  document.getElementById('create-grievance-overlay').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeCreateGrievanceModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeCreateGrievanceModal();
    }
  });

  document.getElementById('evidence-photo').addEventListener('change', (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    evidenceCaptureFile = file;
    evidenceCapturedAt = new Date().toISOString();

    if (evidencePreviewUrl) {
      URL.revokeObjectURL(evidencePreviewUrl);
    }

    evidencePreviewUrl = URL.createObjectURL(file);
    const preview = document.getElementById('evidence-photo-preview');
    preview.src = evidencePreviewUrl;
    preview.style.display = 'block';
    document.getElementById('evidence-photo-label').textContent = 'Fresh photo captured';
    document.getElementById('evidence-photo-meta').textContent = `${file.name} • ${(file.size / 1024).toFixed(1)} KB • captured at ${new Date(evidenceCapturedAt).toLocaleString()}`;
  });

  const health = await api('/api/health');
  if (health.ok && health.data.mockMode) {
    document.getElementById('mock-badge').style.display = 'inline-flex';
  }
  if (!health.ok) {
    showToast('Backend is not reachable on port 5000.', 'error');
  }

  if (authToken && currentUser) {
    initApp();
  } else {
    showLoginScreen();
  }
});

Object.assign(window, {
  toggleAuthForm,
  handleLogin,
  handleRegister,
  fillCreds,
  logout,
  refreshDashboard,
  loadGrievances,
  resolveGrievance,
  viewGrievanceDetail,
  closeModal,
  showCreateGrievanceModal,
  closeCreateGrievanceModal,
  handleCreateGrievance,
  simulateIvr,
  resolveAndReload,
  captureEvidenceLocation,
  prefillEvidenceLocation,
  submitEvidence,
  runEvaluation,
});
