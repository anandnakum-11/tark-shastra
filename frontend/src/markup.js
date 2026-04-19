export const appMarkup = String.raw`
  <div class="page-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
        </div>
        <div>
          <div class="brand-name">SakshyaAI</div>
          <div class="brand-subtitle">Trusted verification command center</div>
        </div>
      </div>

      <nav class="topbar-nav">
        <a href="#" class="nav-link active" data-view="dashboard">Dashboard</a>
        <a href="#" class="nav-link" data-view="grievances">Grievances</a>
        <a href="#" class="nav-link" data-view="verification">Verification</a>
        <a href="#" class="nav-link" data-view="evidence">Evidence</a>
        <a href="#" class="nav-link" data-view="departments">Departments</a>
      </nav>

      <div class="topbar-actions">
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme">
          <span id="theme-toggle-icon">Sun</span>
          <span id="theme-toggle-label">Light</span>
        </button>
        <div class="user-pill" id="user-mini" style="display:none;">
          <div class="user-pill-avatar" id="user-avatar-mini">U</div>
          <div>
            <div class="user-pill-name" id="user-name-mini">User</div>
            <div class="user-pill-role" id="user-role-mini">Role</div>
          </div>
        </div>
        <button class="logout-button" id="btn-logout" style="display:none;" onclick="logout()">Logout</button>
      </div>
    </header>

    <main class="main-shell">
      <section id="login-screen" class="view auth-stage">
        <div class="auth-layout">
          <div class="auth-story">
            <div class="auth-badge">Public trust through verifiable action</div>
            <h1>Make grievance resolution visible, accountable, and easy to verify.</h1>
            <p>
              SakshyaAI combines citizen confirmation, field evidence, and department scoring
              into one cleaner workflow for administrators and residents.
            </p>
            <div class="feature-grid">
              <article class="feature-card">
                <h3>Independent verification</h3>
                <p>Every resolution can be checked with IVR confirmation and location-based evidence.</p>
              </article>
              <article class="feature-card">
                <h3>Collector-grade oversight</h3>
                <p>See department performance, pending issues, and reopened cases in one place.</p>
              </article>
              <article class="feature-card">
                <h3>Faster citizen workflows</h3>
                <p>File complaints, track status, and understand exactly what changed after action is taken.</p>
              </article>
            </div>
          </div>

          <div class="auth-card">
            <div class="auth-card-glow"></div>
            <div class="auth-card-inner">
              <div class="auth-header">
                <div>
                  <h2 id="auth-form-title">Sign In</h2>
                  <p id="auth-form-subtitle">Enter your credentials to access the portal.</p>
                </div>
                <span class="mock-badge" id="mock-badge" style="display:none;">Mock Mode</span>
              </div>

              <form id="login-form" class="auth-form" onsubmit="handleLogin(event)">
                <label class="field">
                  <span>Username or Email</span>
                  <input type="text" id="login-username" placeholder="collector or citizen1" required>
                </label>
                <label class="field">
                  <span>Password</span>
                  <input type="password" id="login-password" placeholder="Enter password" required>
                </label>
                <button type="submit" class="primary-button" id="login-btn">Sign In</button>
                <div class="inline-error" id="login-error" style="display:none;"></div>
              </form>

              <form id="register-form" class="auth-form" onsubmit="handleRegister(event)" style="display:none;">
                <label class="field">
                  <span>Full Name</span>
                  <input type="text" id="register-name" placeholder="e.g. Asha Patel" required>
                </label>
                <label class="field">
                  <span>Email</span>
                  <input type="email" id="register-email" placeholder="e.g. citizen@example.com" required>
                </label>
                <label class="field">
                  <span>Phone</span>
                  <input type="tel" id="register-phone" placeholder="+91 9999999999">
                </label>
                <label class="field">
                  <span>Role</span>
                  <select id="register-role" required>
                    <option value="">Select a role</option>
                    <option value="citizen">Citizen</option>
                    <option value="field_officer">Field Officer</option>
                    <option value="department_officer">Department Officer</option>
                    <option value="collector">Collector</option>
                  </select>
                </label>
                <label class="field">
                  <span>Department</span>
                  <input type="text" id="register-department" placeholder="Optional department name">
                </label>
                <label class="field">
                  <span>Password</span>
                  <input type="password" id="register-password" placeholder="Minimum 6 characters" minlength="6" required>
                </label>
                <button type="submit" class="primary-button" id="register-btn">Create Account</button>
                <div class="inline-error" id="register-error" style="display:none;"></div>
              </form>

              <div class="auth-toggle">
                <span id="toggle-text">Don't have an account? <a href="#" onclick="toggleAuthForm(event)">Sign up here</a></span>
              </div>

              <div class="demo-block">
                <div class="demo-title">Demo Credentials</div>
                <div class="demo-chips">
                  <button class="demo-chip" type="button" onclick="fillCreds('collector','collector123')">Collector</button>
                  <button class="demo-chip" type="button" onclick="fillCreds('dept_rbd','dept123')">Department</button>
                  <button class="demo-chip" type="button" onclick="fillCreds('officer1','officer123')">Officer</button>
                  <button class="demo-chip" type="button" onclick="fillCreds('citizen1','citizen123')">Citizen</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard-view" class="view" style="display:none;">
        <div class="hero-panel">
          <div>
            <div class="eyebrow">Operational overview</div>
            <h2 class="page-title">District performance at a glance</h2>
            <p class="page-subtitle">Track live grievance volume, pending verification work, and reopening risk across departments.</p>
          </div>
          <div class="hero-actions">
            <button class="secondary-button" onclick="refreshDashboard()">Refresh data</button>
          </div>
        </div>

        <div class="stats-grid">
          <article class="metric-card metric-primary">
            <span>Total Grievances</span>
            <strong id="stat-total">-</strong>
            <p>All tracked cases in the current system.</p>
          </article>
          <article class="metric-card metric-info">
            <span>Open Cases</span>
            <strong id="stat-open">-</strong>
            <p>Cases still awaiting departmental completion.</p>
          </article>
          <article class="metric-card metric-warn">
            <span>Pending Verification</span>
            <strong id="stat-pending">-</strong>
            <p>Resolved claims waiting for citizen or evidence confirmation.</p>
          </article>
          <article class="metric-card metric-success">
            <span>Verified</span>
            <strong id="stat-closed">-</strong>
            <p>Cases that passed verification successfully.</p>
          </article>
          <article class="metric-card metric-danger">
            <span>Reopened</span>
            <strong id="stat-reopened">-</strong>
            <p>Cases where verification failed or citizens disputed resolution.</p>
          </article>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Department quality scores</h3>
              <p>Lower scores indicate teams that need attention first.</p>
            </div>
            <span class="live-pill">Live</span>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>District</th>
                  <th>Score</th>
                  <th>Total</th>
                  <th>Verified</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Reopened</th>
                </tr>
              </thead>
              <tbody id="dept-scores-body">
                <tr><td colspan="8" class="loading-cell">Loading dashboard...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="grievances-view" class="view" style="display:none;">
        <div class="section-header">
          <div>
            <div class="eyebrow">Case management</div>
            <h2 class="page-title">Grievances</h2>
            <p class="page-subtitle">Search, filter, and inspect complaint progress across the lifecycle.</p>
          </div>
          <div class="section-actions">
            <select id="filter-status" class="select-input" onchange="loadGrievances()">
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="verification_pending">Pending Verification</option>
              <option value="verified">Verified</option>
              <option value="reopened">Reopened</option>
            </select>
            <button class="primary-button" id="new-grievance-btn" onclick="showCreateGrievanceModal()">New Grievance</button>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="grievances-body">
                <tr><td colspan="7" class="loading-cell">Loading grievances...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="verification-view" class="view" style="display:none;">
        <div class="section-header">
          <div>
            <div class="eyebrow">Verification workflow</div>
            <h2 class="page-title">Evidence and citizen confirmation</h2>
            <p class="page-subtitle">Run the end-to-end resolution validation flow from one screen.</p>
          </div>
        </div>

        <div class="workflow-grid">
          <article class="workflow-card">
            <div class="step-pill">Step 1</div>
            <h3>Verification queue</h3>
            <p>Review open, reopened, and pending-verification grievances. Resolve starts the citizen IVR call.</p>
            <select id="verify-grievance-select" class="select-input full-width">
              <option value="">Select a grievance</option>
            </select>
            <div class="detail-box" id="verify-detail-box" style="display:none;"></div>
          </article>

          <article class="workflow-card">
            <div class="step-pill">Step 2</div>
            <h3>Automated IVR response</h3>
            <p>After Resolve, the backend places the IVR call automatically. The citizen hears a prompt to press 1 or 2, and that keypad response is saved for the department officer.</p>
            <div class="inline-upload" id="ivr-audio-admin" style="display:none;">
              <label class="field">
                <span>Collector IVR audio prompt</span>
                <input type="file" id="ivr-audio-file" accept="audio/mpeg,audio/mp3,audio/wav">
              </label>
              <button type="button" class="secondary-button" onclick="uploadIvrAudio()">Upload IVR Audio</button>
              <div class="inline-hint" id="ivr-audio-status">Upload a Gujarati MP3/WAV prompt once; future calls will play it automatically.</div>
            </div>
            <div class="result-card info" id="ivr-result" style="display:block;">
              Waiting for the citizen response from the real IVR call. Press 1 unlocks field verification; Press 2 reopens the grievance.
            </div>
          </article>

          <article class="workflow-card">
            <div class="step-pill">Step 3</div>
            <h3>Capture field evidence</h3>
            <p>After the citizen confirms with 1, Field Officers use the Evidence page to capture a live camera photo plus GPS.</p>
            <div class="result-card info" id="step3-result" style="display:block;">
              Waiting for IVR confirmation before Step 3 opens.
            </div>
          </article>

          <article class="workflow-card">
            <div class="step-pill">Step 4</div>
            <h3>System final decision</h3>
            <p>The backend automatically combines IVR, photo, and GPS evidence. No officer can bypass or manually approve the verification result.</p>
            <div class="result-card info" id="eval-result" style="display:block;">
              Verified only when IVR = 1, photo exists, and GPS is valid. Otherwise the grievance is reopened or remains pending evidence.
            </div>
          </article>
        </div>
      </section>

      <section id="evidence-view" class="view" style="display:none;">
        <div class="section-header">
          <div>
            <div class="eyebrow">Field capture</div>
            <h2 class="page-title">Photo Evidence + GPS Verification</h2>
            <p class="page-subtitle">Capture a fresh on-site image, attach live GPS, and validate the evidence before final verification.</p>
          </div>
        </div>

        <div class="workflow-grid">
          <article class="workflow-card">
            <div class="step-pill">Task Queue</div>
            <h3>Assigned or pending grievances</h3>
            <p>Choose a grievance that needs field evidence after being marked resolved.</p>
            <select id="evidence-grievance-select" class="select-input full-width">
              <option value="">Select a grievance</option>
            </select>
            <div class="detail-box" id="evidence-grievance-detail" style="display:none;"></div>
          </article>

          <article class="workflow-card">
            <div class="step-pill">Camera</div>
            <h3>Capture fresh photo</h3>
            <p>Use device camera only. Gallery-style reuse is discouraged by the UI and duplicate hashes are rejected by the backend.</p>
            <label class="camera-dropzone" for="evidence-photo">
              <input id="evidence-photo" type="file" accept="image/jpeg,image/png" capture="environment">
              <span id="evidence-photo-label">Tap to open camera</span>
            </label>
            <div class="capture-meta" id="evidence-photo-meta">No photo captured yet.</div>
            <img id="evidence-photo-preview" class="photo-preview" alt="Evidence preview" style="display:none;">
          </article>

          <article class="workflow-card">
            <div class="step-pill">GPS</div>
            <h3>Capture location</h3>
            <p>Collect live GPS from the browser at the moment of capture and compare it with the complaint coordinates. Evidence farther than 50 meters is flagged as suspicious.</p>
            <div class="split-actions">
              <button class="secondary-button" onclick="captureEvidenceLocation()">Capture GPS</button>
            </div>
            <div class="form-row">
              <label class="field">
                <span>Latitude</span>
                <input type="number" step="0.000001" id="evidence-lat" placeholder="23.022500">
              </label>
              <label class="field">
                <span>Longitude</span>
                <input type="number" step="0.000001" id="evidence-lon" placeholder="72.571400">
              </label>
            </div>
            <div class="capture-meta" id="evidence-location-meta">GPS not captured yet.</div>
          </article>

          <article class="workflow-card">
            <div class="step-pill">Validation</div>
            <h3>Upload and validate</h3>
            <p>The backend checks timestamp, duplicate hash, photo quality, image size, and GPS distance before accepting evidence.</p>
            <button class="primary-button" id="evidence-upload-btn" onclick="submitEvidence()">Upload Evidence</button>
            <div class="result-card" id="evidence-result" style="display:none;"></div>
            <div class="detail-box" id="evidence-history-box" style="display:none;"></div>
          </article>
        </div>
      </section>

      <section id="departments-view" class="view" style="display:none;">
        <div class="section-header">
          <div>
            <div class="eyebrow">Accountability snapshot</div>
            <h2 class="page-title">Departments</h2>
            <p class="page-subtitle">See performance, workload, and verification outcomes by department.</p>
          </div>
        </div>
        <div class="department-grid" id="dept-cards-grid"></div>
      </section>
    </main>
  </div>

  <div class="modal-overlay" id="modal-overlay" style="display:none;">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modal-title">Details</h3>
        <button class="modal-close" type="button" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  </div>

  <div class="modal-overlay" id="create-grievance-overlay" style="display:none;">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Create grievance</h3>
        <button class="modal-close" type="button" onclick="closeCreateGrievanceModal()">×</button>
      </div>
      <div class="modal-body">
        <form class="modal-form" onsubmit="handleCreateGrievance(event)">
          <label class="field">
            <span>Title</span>
            <input type="text" id="create-title" required>
          </label>
          <label class="field">
            <span>Description</span>
            <textarea id="create-description" rows="4" required></textarea>
          </label>
          <div class="form-row">
            <label class="field">
              <span>Category</span>
              <select id="create-category" required>
                <option value="road">Road</option>
                <option value="water">Water</option>
                <option value="sanitation">Sanitation</option>
                <option value="electricity">Electricity</option>
                <option value="drainage">Drainage</option>
                <option value="street_light">Street Light</option>
                <option value="garbage">Garbage</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label class="field">
              <span>Priority</span>
              <select id="create-priority" required>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          <label class="field">
            <span>Address</span>
            <input type="text" id="create-address" required>
          </label>
          <div class="form-row">
            <label class="field">
              <span>Latitude</span>
              <input type="number" step="0.0001" id="create-latitude" required>
            </label>
            <label class="field">
              <span>Longitude</span>
              <input type="number" step="0.0001" id="create-longitude" required>
            </label>
          </div>
          <label class="field">
            <span>Department</span>
            <select id="create-department" required></select>
          </label>
          <div class="modal-actions">
            <button type="button" class="secondary-button" onclick="closeCreateGrievanceModal()">Cancel</button>
            <button type="submit" class="primary-button" id="create-grievance-btn">Submit Grievance</button>
          </div>
          <div class="inline-error" id="create-grievance-error" style="display:none;"></div>
        </form>
      </div>
    </div>
  </div>

  <div class="toast-container" id="toast-container"></div>
`;
