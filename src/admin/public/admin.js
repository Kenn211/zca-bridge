const $ = (id) => document.getElementById(id);
const show = (id, on) => { const e = $(id); if (e) e.classList.toggle("hidden", !on); };
const msg = (id, text, ok) => {
  const e = $(id);
  if (!e) return;
  e.textContent = text;
  e.className = "message " + (ok ? "ok" : "err");
};
const state = {
  accounts: [],
  recentLogIssues: [],
  settingsLoaded: false,
  webhooksLoaded: false,
  activeTab: "accounts",
};
let lastLogs = [];
const LOGS_PAGE = 10;
let logsShown = LOGS_PAGE;
let drawerToken = 0;

function setBusy(buttonSelector, busy) {
  const btn = document.querySelector(buttonSelector);
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle("is-busy", busy);
}

function setTab(name) {
  state.activeTab = name;
  for (const tab of ["accounts", "logs", "settings"]) {
    const panel = $("tab_" + tab);
    const button = $("tab_" + tab + "_btn");
    if (panel) panel.classList.toggle("active", tab === name);
    if (button) button.classList.toggle("active", tab === name);
  }
  if (name === "logs") loadLogs();
  if (name === "settings") {
    loadSettings();
    loadWebhooks();
  }
}

window.setTab = setTab;

async function api(path, opts = {}) {
  // Only declare a JSON body when one is actually sent. A body-less request (e.g. DELETE)
  // with Content-Type: application/json makes Fastify reject it with 400 (empty JSON body).
  const headers = { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) };
  const res = await fetch(path, { ...opts, headers });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

async function boot() {
  const { body } = await api("/admin/api/auth-status");
  if (body && body.needsSetup) { show("setupView", true); return; }
  if (body && body.authed) { showDash(); return; }
  show("loginView", true);
}

async function doSetup() {
  const username = $("su_user").value.trim();
  const password = $("su_pass").value;
  const { status, body } = await api("/admin/api/setup", { method: "POST", body: JSON.stringify({ username, password }) });
  if (status === 200) { show("setupView", false); showDash(); }
  else msg("setupMsg", (body && body.error) === "weak" ? "Mật khẩu cần ≥ 8 ký tự." : "Không tạo được admin.", false);
}

async function doLogin() {
  const username = $("li_user").value.trim();
  const password = $("li_pass").value;
  const { status, body } = await api("/admin/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
  if (status === 200) { show("loginView", false); showDash(); }
  else msg("loginMsg", (body && body.error) || "Đăng nhập thất bại.", false);
}

async function logout() {
  await api("/admin/api/logout", { method: "POST" });
  location.reload();
}

function showDash() {
  show("dash", true);
  show("logoutBtn", true);
  show("sessionState", true);
  setTab("accounts");
  loadAccounts();
  loadLogs({ quiet: true });
}

async function loadWebhooks() {
  const { status, body } = await api("/admin/api/webhooks");
  if (status !== 200 || !body) return;
  $("wh_chatwoot").value = body.chatwoot || "";
  $("wh_oa").value = body.oa || "";
  state.webhooksLoaded = true;
}

async function copyWebhook(id) {
  const el = $(id);
  try { await navigator.clipboard.writeText(el.value); msg("whMsg", "Đã copy.", true); }
  catch { el.select(); msg("whMsg", "Nhấn Ctrl/Cmd+C để copy.", false); }
}

async function loadSettings() {
  const { body } = await api("/admin/api/settings");
  if (!body) return;
  for (const key of ["chatwoot_base_url", "chatwoot_account_id", "zalo_oa_app_id", "zalo_oa_oauth_redirect"]) {
    $("cfg_" + key).value = typeof body[key] === "string" ? body[key] : "";
  }
  for (const key of ["chatwoot_api_access_token", "zalo_oa_app_secret", "zalo_oa_secret_key"]) {
    const set = body[key] && body[key].set;
    $("cfg_" + key).placeholder = set ? "•••••• (đang đặt — để trống nếu giữ nguyên)" : "(chưa đặt)";
  }
  state.settingsLoaded = true;
}

async function saveSettings() {
  const payload = {};
  for (const key of ["chatwoot_base_url", "chatwoot_account_id", "chatwoot_api_access_token", "zalo_oa_app_id", "zalo_oa_app_secret", "zalo_oa_secret_key", "zalo_oa_oauth_redirect"]) {
    payload[key] = $("cfg_" + key).value;
  }
  const { status } = await api("/admin/api/settings", { method: "POST", body: JSON.stringify(payload) });
  if (status !== 200) { msg("cfgMsg", "Lưu thất bại.", false); return; }
  msg("cfgMsg", "Đã lưu. Đang khởi động lại...", true);
  pollHealth();
}

function toggleExistingInbox() {
  $("existingInboxFields").classList.toggle("hidden", !$("useExistingInbox").checked);
}

function openDrawer(title, bodyHtml, actionsHtml = "") {
  drawerToken += 1;
  $("drawer").innerHTML = `<div class="drawer-header">
    <div><h3>${escapeHtml(title)}</h3></div>
    <button class="button button-secondary" type="button" onclick="closeDrawer()">Đóng</button>
  </div>${bodyHtml}${actionsHtml ? `<div class="drawer-actions">${actionsHtml}</div>` : ""}`;
  show("drawerBackdrop", true);
  show("drawer", true);
  return drawerToken;
}

function closeDrawer() {
  drawerToken += 1;
  $("drawer").innerHTML = "";
  show("drawerBackdrop", false);
  show("drawer", false);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("drawer").classList.contains("hidden")) {
    closeDrawer();
  }
});

function isActiveDrawer(token) {
  return token === drawerToken;
}

function isQrImageDataUrl(value) {
  return typeof value === "string" && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function openAddAccountPanel() {
  openDrawer("Thêm tài khoản", `
    <label for="newType">Loại tài khoản</label>
    <select id="newType">
      <option value="personal">Cá nhân (QR)</option>
      <option value="oa">Official Account</option>
    </select>
    <label for="newLabel">Nhãn</label>
    <input id="newLabel" placeholder="Ví dụ: Sales OA" />
    <label class="check-row">
      <input id="useExistingInbox" type="checkbox" onchange="toggleExistingInbox()" />
      <span>Nâng cao: dùng inbox có sẵn</span>
    </label>
    <div id="existingInboxFields" class="hidden">
      <label for="newInboxIdent">Inbox identifier</label>
      <input id="newInboxIdent" placeholder="identifier từ Chatwoot" />
      <label for="newInboxId">Inbox ID</label>
      <input id="newInboxId" placeholder="Số nguyên dương" />
    </div>
    <div id="addMsg" class="message"></div>
  `, `<button class="button button-secondary" type="button" onclick="closeDrawer()">Hủy</button>
      <button id="saveNewAccountBtn" class="button button-primary" type="button" onclick="createAccount()">Thêm</button>`);
}

window.closeDrawer = closeDrawer;
window.openAddAccountPanel = openAddAccountPanel;

function parseOptionalPositiveInt(value) {
  if (value === "") return null;
  if (!/^[1-9]\d*$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

async function pollHealth() {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { const r = await fetch("/healthz", { cache: "no-store" }); if (r.ok) { location.reload(); return; } } catch { /* down */ }
  }
  msg("cfgMsg", "Bridge chưa sống lại — kiểm tra container.", false);
}

async function loadAccounts() {
  const box = $("accounts");
  box.innerHTML = '<div class="empty-state">Đang tải tài khoản...</div>';
  const { status, body } = await api("/admin/api/accounts");
  if (status !== 200 || !Array.isArray(body)) {
    box.innerHTML = '<div class="empty-state error">Không tải được tài khoản.</div>';
    renderAccountSummary([]);
    return;
  }
  state.accounts = body;
  renderAccountSummary(body);
  renderAccounts(body);
  renderAccountOptions(body);
}

const STATUS_BADGE = {
  connected: { label: "● Đã kết nối", cls: "ok" },
  pending_qr: { label: "Chờ đăng nhập", cls: "warn" },
  expired: { label: "Hết hạn", cls: "off" },
  logged_out: { label: "Đã đăng xuất", cls: "off" },
};

function statusBadge(status) {
  const b = STATUS_BADGE[status] || { label: status, cls: "off" };
  return `<span class="badge ${b.cls}">${escapeHtml(b.label)}</span>`;
}

function renderAccountSummary(accounts) {
  const connected = accounts.filter((a) => a.status === "connected").length;
  const needsAction = accounts.filter((a) => a.status !== "connected").length;
  const missingInboxIds = accounts.filter((a) => a.chatwootInboxIdentifier && !a.chatwootInboxId).length;
  const issueLogs = state.recentLogIssues.filter((l) => Number(l.level) >= 40);
  const recentIssues = issueLogs.length;
  $("accountSummary").innerHTML = [
    summaryCard("Tổng tài khoản", accounts.length),
    summaryCard("Đã kết nối", connected),
    summaryCard("Cần xử lý", needsAction),
    summaryCard("Cảnh báo/lỗi", recentIssues),
  ].join("");
  const inboxNotice = missingInboxIds > 0
    ? [`<div class="notice">${missingInboxIds} tài khoản có inbox identifier nhưng thiếu Inbox ID. Outbound routing cần Inbox ID.</div>`]
    : [];
  const logNotices = issueLogs.slice(0, 3).map((l) => `<div class="notice">${escapeHtml(logLevelMeta(l.level).t)} · ${escapeHtml(l.event || "event")} · ${escapeHtml(l.msg || "")}</div>`);
  $("recentIssues").innerHTML = inboxNotice.concat(logNotices).join("");
}

function summaryCard(label, value) {
  return `<div class="summary-card"><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderAccounts(accounts) {
  const box = $("accounts");
  if (accounts.length === 0) {
    box.innerHTML = '<div class="empty-state">Chưa có tài khoản nào. Bấm "Thêm tài khoản" để bắt đầu.</div>';
    return;
  }
  const rows = accounts.map((a) => accountRow(a)).join("");
  box.innerHTML = `<table class="account-table">
    <thead><tr><th>Tài khoản</th><th>Trạng thái</th><th>Inbox</th><th>OA</th><th>Thao tác</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function accountRow(a) {
  const type = a.type === "oa" ? "OA" : "Cá nhân";
  const missingId = a.chatwootInboxIdentifier && !a.chatwootInboxId;
  const inbox = [
    `<div>${escapeHtml(a.chatwootInboxIdentifier || "—")}</div>`,
    `<div class="${missingId ? "text-danger" : "muted"}">ID: ${escapeHtml(a.chatwootInboxId ?? "—")}</div>`,
  ].join("");
  const oa = a.zaloOaId ? escapeHtml(a.zaloOaId) : "—";
  return `<tr>
    <td><strong>#${escapeHtml(a.id)} ${escapeHtml(a.label)}</strong><div class="muted">${type}</div></td>
    <td>${statusBadge(a.status)}</td>
    <td>${inbox}</td>
    <td>${oa}</td>
    <td><div class="row-actions">${accountActions(a)}</div></td>
  </tr>`;
}

function accountActions(a) {
  const id = safeAccountId(a.id);
  if (!id) return '<button class="button button-secondary" type="button" disabled>ID không hợp lệ</button>';
  const edit = `<button class="button button-secondary" type="button" onclick="openEditAccountPanel(${id})">Sửa</button>`;
  const del = `<button class="button button-danger" type="button" onclick="openDeletePanel(${id})">Xóa</button>`;
  if (a.type === "oa") {
    return `<a href="/admin/oa/connect?accountId=${id}"><button class="button button-primary" type="button">Kết nối OA</button></a>` +
      `<button class="button button-secondary" type="button" onclick="openInfoCardPanel(${id})">Xin thông tin</button>` +
      edit + del;
  }
  return `<button class="button button-primary" type="button" onclick="openQrPanel(${id})">Quét QR</button>` + edit + del;
}

function renderAccountOptions(accounts) {
  const sel = $("logAccount");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Mọi tài khoản</option>' +
    accounts.map((a) => `<option value="${escapeHtml(a.id)}">#${escapeHtml(a.id)} ${escapeHtml(a.label)}</option>`).join("");
  sel.value = cur;
}

function safeAccountId(id) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? String(n) : "";
}

function findAccount(id) {
  return state.accounts.find((a) => Number(a.id) === Number(id));
}

function openEditAccountPanel(id) {
  const a = findAccount(id);
  if (!a) { msg("accountMsg", "Không tìm thấy tài khoản.", false); return; }
  openDrawer(`Sửa #${a.id}`, `
    <label for="e_label">Nhãn</label>
    <input id="e_label" value="${escapeHtml(a.label)}" />
    <label for="e_ident">Inbox identifier</label>
    <input id="e_ident" value="${escapeHtml(a.chatwootInboxIdentifier || "")}" />
    <label for="e_iid">Inbox ID</label>
    <input id="e_iid" value="${a.chatwootInboxId == null ? "" : escapeHtml(String(a.chatwootInboxId))}" />
    <p class="muted">Đổi inbox chỉ ảnh hưởng tin mới. Nếu có identifier thì Inbox ID là bắt buộc.</p>
    <div id="e_msg" class="message"></div>
  `, `<button class="button button-secondary" type="button" onclick="closeDrawer()">Hủy</button>
      <button id="saveAccountBtn" class="button button-primary" type="button" onclick="saveAccount(${a.id})">Lưu</button>`);
}

async function openQrPanel(id) {
  const token = openDrawer("Quét QR", `<div id="qrPanel" class="empty-state">Đang lấy QR...</div>`);
  const { status, body } = await api(`/admin/api/accounts/${id}/login`, { method: "POST" });
  const panel = $("qrPanel");
  if (!isActiveDrawer(token) || !panel) return;
  if (status === 200 && body && isQrImageDataUrl(body.qrImageBase64)) {
    const img = document.createElement("img");
    img.alt = "QR đăng nhập Zalo";
    img.className = "qr-image";
    img.src = body.qrImageBase64;
    panel.replaceChildren(img);
  } else {
    panel.innerHTML = '<div class="empty-state error">Không lấy được QR.</div>';
  }
}

function openDeletePanel(id) {
  const a = findAccount(id);
  if (!a) { msg("accountMsg", "Không tìm thấy tài khoản.", false); return; }
  openDrawer("Xóa tài khoản", `
    <p>Bạn chắc chắn muốn xóa <strong>${escapeHtml(a.label)}</strong>?</p>
    <p class="muted">Hành động này xóa tài khoản khỏi bridge và gỡ session liên quan.</p>
    <div id="delMsg" class="message"></div>
  `, `<button class="button button-secondary" type="button" onclick="closeDrawer()">Hủy</button>
      <button id="confirmDeleteBtn" class="button button-danger" type="button" onclick="confirmDelete(${a.id})">Xóa</button>`);
}

async function openInfoCardPanel(id) {
  const token = openDrawer("Cấu hình xin thông tin", `<div id="infoCardPanel" class="empty-state">Đang tải...</div>`);
  const { status, body } = await api(`/admin/api/accounts/${id}/info-card`);
  const panel = $("infoCardPanel");
  if (!isActiveDrawer(token) || !panel) return;
  const c = status === 200 && body ? body : { enabled: false, title: "", subtitle: "", imageUrl: "" };
  panel.innerHTML = `
    <label class="check-row"><input type="checkbox" id="ic_en" ${c.enabled ? "checked" : ""} /><span>Bật gửi tự động</span></label>
    <label for="ic_title">Tiêu đề</label><input id="ic_title" maxlength="100" value="${escapeHtml(c.title)}" />
    <label for="ic_sub">Mô tả</label><input id="ic_sub" maxlength="500" value="${escapeHtml(c.subtitle)}" />
    <label for="ic_img">URL ảnh</label><input id="ic_img" value="${escapeHtml(c.imageUrl)}" placeholder="https://..." />
    <div id="ic_msg" class="message"></div>
    <div class="drawer-actions"><button class="button button-secondary" type="button" onclick="closeDrawer()">Đóng</button><button id="saveInfoCardBtn" class="button button-primary" type="button" onclick="saveInfoCard(${id})">Lưu</button></div>
  `;
}

window.openEditAccountPanel = openEditAccountPanel;
window.openQrPanel = openQrPanel;
window.openDeletePanel = openDeletePanel;
window.openInfoCardPanel = openInfoCardPanel;

window.saveAccount = async (id) => {
  const token = drawerToken;
  const payload = {};
  const label = $("e_label").value.trim();
  const ident = $("e_ident").value.trim();
  const iid = $("e_iid").value.trim();
  if (label) payload.label = label;
  if (ident) payload.chatwootInboxIdentifier = ident;
  if (ident && iid === "") {
    const m = $("e_msg");
    m.textContent = "Inbox ID phải là số nguyên dương.";
    m.className = "message err";
    return;
  }
  const parsedIid = parseOptionalPositiveInt(iid);
  if (parsedIid === undefined) { const m = $("e_msg"); m.textContent = "Inbox ID phải là số nguyên dương."; m.className = "message err"; return; }
  if (parsedIid !== null) payload.chatwootInboxId = parsedIid;
  setBusy("#saveAccountBtn", true);
  let result;
  try {
    result = await api(`/admin/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } catch {
    const m = $("e_msg");
    if (isActiveDrawer(token) && m) {
      setBusy("#saveAccountBtn", false);
      m.textContent = "Lưu thất bại.";
      m.className = "message err";
    }
    return;
  }
  const { status, body } = result;
  if (status === 200) {
    if (isActiveDrawer(token)) closeDrawer();
    msg("accountMsg", "Đã lưu tài khoản.", true);
    loadAccounts();
  }
  else {
    const m = $("e_msg");
    if (!isActiveDrawer(token) || !m) return;
    setBusy("#saveAccountBtn", false);
    const errMap = {
      invalid_chatwoot_inbox_id: "Inbox ID phải là số nguyên dương.",
      chatwoot_inbox_id_required: "Inbox ID phải là số nguyên dương.",
    };
    m.textContent = (status === 400 && body && errMap[body.error]) || (status === 400 ? "Inbox identifier không hợp lệ." : "Lưu thất bại.");
    m.className = "message err";
  }
};

window.saveInfoCard = async (id) => {
  const token = drawerToken;
  const payload = {
    enabled: $("ic_en").checked,
    title: $("ic_title").value.trim(),
    subtitle: $("ic_sub").value.trim(),
    imageUrl: $("ic_img").value.trim(),
  };
  setBusy("#saveInfoCardBtn", true);
  let result;
  try {
    result = await api(`/admin/api/accounts/${id}/info-card`, { method: "PUT", body: JSON.stringify(payload) });
  } catch {
    const m = $("ic_msg");
    if (isActiveDrawer(token) && m) {
      setBusy("#saveInfoCardBtn", false);
      m.textContent = "Lưu thất bại.";
      m.className = "message err";
    }
    return;
  }
  const { status, body } = result;
  const m = $("ic_msg");
  if (!isActiveDrawer(token) || !m) return;
  if (status === 200) {
    closeDrawer();
    msg("accountMsg", "Đã lưu cấu hình xin thông tin.", true);
  }
  else {
    setBusy("#saveInfoCardBtn", false);
    const errMap = { image_required_when_enabled: "Bật thì phải có URL ảnh.", image_url_invalid: "URL ảnh phải bắt đầu http(s)://", title_too_long: "Tiêu đề quá dài.", subtitle_too_long: "Mô tả quá dài." };
    m.textContent = (body && errMap[body.error]) || "Lưu thất bại.";
    m.className = "message err";
  }
};

async function createAccount() {
  const token = drawerToken;
  const type = $("newType").value;
  const label = $("newLabel").value.trim();
  const useExisting = $("useExistingInbox").checked;
  const chatwootInboxIdentifier = $("newInboxIdent").value.trim();
  const iid = $("newInboxId").value.trim();
  if (!label) { msg("addMsg", "Cần nhãn.", false); return; }
  const payload = { label, inboxMode: useExisting ? "existing" : "auto" };
  if (useExisting) {
    if (!chatwootInboxIdentifier) { msg("addMsg", "Cần inbox identifier khi dùng inbox có sẵn.", false); return; }
    if (!iid) { msg("addMsg", "Cần Inbox ID khi dùng inbox có sẵn.", false); return; }
    payload.chatwootInboxIdentifier = chatwootInboxIdentifier;
    const parsedIid = parseOptionalPositiveInt(iid);
    if (parsedIid === undefined) { msg("addMsg", "Inbox ID phải là số nguyên dương.", false); return; }
    if (parsedIid !== null) payload.chatwootInboxId = parsedIid;
  }
  const endpoint = type === "oa" ? "/admin/api/accounts/oa" : "/admin/api/accounts";
  setBusy("#saveNewAccountBtn", true);
  let result;
  try {
    result = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
  } catch {
    if (isActiveDrawer(token) && $("addMsg")) {
      setBusy("#saveNewAccountBtn", false);
      msg("addMsg", "Thêm thất bại.", false);
    }
    return;
  }
  const { status, body } = result;
  if (status === 200) {
    if (isActiveDrawer(token)) closeDrawer();
    msg("accountMsg", useExisting ? "Đã thêm tài khoản." : "Đã tạo inbox Chatwoot và thêm tài khoản.", true);
    loadAccounts();
  } else {
    const errMap = {
      chatwoot_config_missing: "Thiếu cấu hình Chatwoot URL / Account ID / token.",
      chatwoot_auth_failed: "Chatwoot token sai hoặc không đủ quyền admin.",
      chatwoot_inbox_create_failed: "Không tạo được inbox Chatwoot.",
      chatwoot_inbox_invalid_response: "Chatwoot trả về inbox thiếu id hoặc identifier.",
      chatwoot_agents_list_failed: "Không lấy được danh sách agents từ Chatwoot.",
      chatwoot_no_assignable_users: "Chatwoot account chưa có agent để gán vào inbox.",
      chatwoot_inbox_members_failed: "Không gán được agents vào inbox Chatwoot.",
      chatwoot_inbox_identifier_required: "Cần inbox identifier khi dùng inbox có sẵn.",
      chatwoot_inbox_id_required: "Cần Inbox ID khi dùng inbox có sẵn.",
      invalid_inbox_mode: "Chế độ inbox không hợp lệ.",
      invalid_chatwoot_inbox_id: "Inbox ID Chatwoot không hợp lệ.",
    };
    if (isActiveDrawer(token) && $("addMsg")) {
      setBusy("#saveNewAccountBtn", false);
      msg("addMsg", (body && errMap[body.error]) || "Thêm thất bại.", false);
    }
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const LOG_LEVEL = { 30: { t: "info", c: "info" }, 40: { t: "warn", c: "warn" }, 50: { t: "error", c: "err" } };

function logLevelMeta(level) {
  return LOG_LEVEL[level] || { t: String(level), c: "off" };
}

async function loadLogs(opts = {}) {
  const level = opts.quiet ? "" : ($("logLevel") ? $("logLevel").value : "");
  const accountId = opts.quiet ? "" : ($("logAccount") ? $("logAccount").value : "");
  const qs = new URLSearchParams({ limit: opts.quiet ? "20" : "300" });
  if (level && !opts.quiet) qs.set("level", level);
  if (accountId && !opts.quiet) qs.set("accountId", accountId);
  const { status, body } = await api("/admin/api/logs?" + qs.toString());
  if (status !== 200 || !Array.isArray(body)) {
    if (!opts.quiet) msg("logsMsg", "Không tải được logs.", false);
    return;
  }
  if (opts.quiet) {
    state.recentLogIssues = body;
    renderAccountSummary(state.accounts);
    return;
  }
  lastLogs = body;
  logsShown = LOGS_PAGE;
  renderAccountSummary(state.accounts);
  if (!opts.quiet) {
    msg("logsMsg", `${body.length} dòng.`, true);
    renderLogs();
  }
}

window.showMoreLogs = () => { logsShown += LOGS_PAGE; renderLogs(); };

function renderLogs() {
  const box = $("logsBox");
  if (lastLogs.length === 0) { box.innerHTML = '<p class="mut">Chưa có log nào.</p>'; return; }
  const rows = lastLogs.slice(0, logsShown);
  const remaining = lastLogs.length - rows.length;
  const head = "<tr><th>Thời gian</th><th>Mức</th><th>Account</th><th>Event</th><th>Message</th></tr>";
  const body = rows.map((r) => {
    const m = logLevelMeta(r.level);
    const rowCls = r.level >= 50 ? "lvl-err" : r.level >= 40 ? "lvl-warn" : "";
    const ctx = r.context && Object.keys(r.context).length
      ? `<details><summary>Context</summary><pre class="logctx">${escapeHtml(JSON.stringify(r.context, null, 2))}</pre></details>`
      : "";
    return `<tr class="${rowCls}">` +
      `<td>${escapeHtml(new Date(r.ts).toLocaleString())}</td>` +
      `<td><span class="badge ${m.c}">${escapeHtml(m.t)}</span></td>` +
      `<td>${escapeHtml(r.accountId ?? "—")}</td>` +
      `<td>${escapeHtml(r.event || "—")}</td>` +
      `<td>${escapeHtml(r.msg || "")}${ctx}</td></tr>`;
  }).join("");
  const more = remaining > 0
    ? `<div class="row" style="margin-top:8px"><button class="button button-secondary" type="button" onclick="showMoreLogs()">Tải thêm (còn ${remaining})</button></div>`
    : "";
  box.innerHTML = `<table class="logs-table"><thead>${head}</thead><tbody>${body}</tbody></table>${more}`;
}

function logsAsText() {
  return lastLogs.map((r) => {
    const m = logLevelMeta(r.level);
    const ctx = r.context && Object.keys(r.context).length ? " " + JSON.stringify(r.context) : "";
    return `${new Date(r.ts).toISOString()} [${m.t}] acct=${r.accountId ?? "-"} ${r.event || "-"}: ${r.msg || ""}${ctx}`;
  }).join("\n");
}

async function copyLogs() {
  try { await navigator.clipboard.writeText(logsAsText()); msg("logsMsg", "Đã copy.", true); }
  catch { msg("logsMsg", "Trình duyệt chặn copy — dùng Export.", false); }
}

function exportLogs() {
  const blob = new Blob([JSON.stringify(lastLogs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zca-logs.json";
  a.click();
  URL.revokeObjectURL(url);
}

window.confirmDelete = async (id) => {
  const token = drawerToken;
  setBusy("#confirmDeleteBtn", true);
  let result;
  try {
    result = await api(`/admin/api/accounts/${id}`, { method: "DELETE" });
  } catch {
    const m = $("delMsg");
    if (isActiveDrawer(token) && m) {
      setBusy("#confirmDeleteBtn", false);
      m.textContent = "Xóa thất bại.";
      m.className = "message err";
    }
    return;
  }
  const { status } = result;
  if (status === 200) {
    if (isActiveDrawer(token)) closeDrawer();
    msg("accountMsg", "Đã xóa tài khoản.", true);
    loadAccounts();
    return;
  }
  const m = $("delMsg");
  if (!isActiveDrawer(token) || !m) return;
  setBusy("#confirmDeleteBtn", false);
  m.textContent = status === 404 ? "Không tìm thấy tài khoản." : "Xóa thất bại.";
  m.className = "message err";
};

boot();
