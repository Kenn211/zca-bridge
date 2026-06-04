const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);
const msg = (id, text, ok) => { const e = $(id); e.textContent = text; e.className = "msg " + (ok ? "ok" : "err"); };
let lastLogs = [];
const LOGS_PAGE = 10;
let logsShown = LOGS_PAGE;

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
  loadSettings();
  loadAccounts();
  loadWebhooks();
  loadLogs();
}

async function loadWebhooks() {
  const { status, body } = await api("/admin/api/webhooks");
  if (status !== 200 || !body) return;
  $("wh_chatwoot").value = body.chatwoot || "";
  $("wh_oa").value = body.oa || "";
}

async function copyWebhook(id) {
  const el = $(id);
  try { await navigator.clipboard.writeText(el.value); msg("whMsg", "Đã copy.", true); }
  catch { el.select(); msg("whMsg", "Nhấn Ctrl/Cmd+C để copy.", false); }
}

async function loadSettings() {
  const { body } = await api("/admin/api/settings");
  if (!body) return;
  for (const key of ["chatwoot_account_id", "zalo_oa_app_id", "zalo_oa_oauth_redirect"]) {
    $("cfg_" + key).value = typeof body[key] === "string" ? body[key] : "";
  }
  for (const key of ["chatwoot_api_access_token", "zalo_oa_app_secret", "zalo_oa_secret_key"]) {
    const set = body[key] && body[key].set;
    $("cfg_" + key).placeholder = set ? "•••••• (đang đặt — để trống nếu giữ nguyên)" : "(chưa đặt)";
  }
}

async function saveSettings() {
  const payload = {};
  for (const key of ["chatwoot_account_id", "chatwoot_api_access_token", "zalo_oa_app_id", "zalo_oa_app_secret", "zalo_oa_secret_key", "zalo_oa_oauth_redirect"]) {
    payload[key] = $("cfg_" + key).value;
  }
  const { status } = await api("/admin/api/settings", { method: "POST", body: JSON.stringify(payload) });
  if (status !== 200) { msg("cfgMsg", "Lưu thất bại.", false); return; }
  msg("cfgMsg", "Đã lưu. Đang khởi động lại…", true);
  pollHealth();
}

function toggleConfig() {
  const hidden = $("cfgBody").classList.toggle("hidden");
  $("cfgToggle").textContent = hidden ? "Hiện cấu hình" : "Ẩn cấu hình";
}

async function pollHealth() {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { const r = await fetch("/healthz", { cache: "no-store" }); if (r.ok) { location.reload(); return; } } catch { /* down */ }
  }
  msg("cfgMsg", "Bridge chưa sống lại — kiểm tra container.", false);
}

async function loadAccounts() {
  const { body } = await api("/admin/api/accounts");
  const box = $("accounts");
  box.innerHTML = "";
  if (!Array.isArray(body)) { box.textContent = "Không tải được."; return; }
  for (const a of body) box.appendChild(renderAccount(a));
  const sel = $("logAccount");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Mọi tài khoản</option>' +
      body.map((a) => `<option value="${a.id}">#${a.id} ${escapeHtml(a.label)}</option>`).join("");
    sel.value = cur;
  }
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

function renderAccount(a) {
  const el = document.createElement("div");
  el.className = "acct";
  const type = a.type === "oa" ? "OA" : "Cá nhân";
  el.innerHTML =
    `<div class="row"><b class="acct-name">#${a.id} ${escapeHtml(a.label)}</b> ${statusBadge(a.status)} <span class="mut">${type}</span></div>` +
    `<div class="mut">inbox: ${escapeHtml(a.chatwootInboxIdentifier)} · id: ${a.chatwootInboxId ?? "—"}${a.zaloOaId ? " · oa: " + escapeHtml(a.zaloOaId) : ""}</div>` +
    `<div class="row" style="margin-top:8px">` +
      `<button class="sec" onclick="editAccount(${a.id})">Sửa</button>` +
      (a.type === "oa"
        ? `<a href="/admin/oa/connect?accountId=${a.id}"><button>Kết nối OA</button></a>` +
          `<button class="sec" onclick="infoCard(${a.id})">Cấu hình xin thông tin</button>`
        : `<button onclick="login_(${a.id})">Đăng nhập / Quét QR</button>`) +
      `<button class="danger" onclick="askDelete(${a.id}, ${escapeHtml(JSON.stringify(a.label))})">Xóa</button>` +
    `</div><div id="edit_${a.id}"></div><div id="qr_${a.id}"></div><div id="infocard_${a.id}"></div><div id="del_${a.id}"></div>`;
  return el;
}

window.editAccount = (id) => {
  const box = document.getElementById("edit_" + id);
  box.innerHTML =
    `<div class="card" style="margin-top:8px">` +
    `<label>Nhãn</label><input id="e_label_${id}" />` +
    `<label>Inbox identifier</label><input id="e_ident_${id}" />` +
    `<label>Inbox ID (số, để trống = bỏ)</label><input id="e_iid_${id}" />` +
    `<p class="mut">Đổi inbox chỉ ảnh hưởng tin mới.</p>` +
    `<div class="row"><button onclick="saveAccount(${id})">Lưu</button><button class="sec" onclick="document.getElementById('edit_${id}').innerHTML=''">Hủy</button></div>` +
    `<div id="e_msg_${id}" class="msg"></div></div>`;
};

window.saveAccount = async (id) => {
  const payload = {};
  const label = document.getElementById("e_label_" + id).value.trim();
  const ident = document.getElementById("e_ident_" + id).value.trim();
  const iid = document.getElementById("e_iid_" + id).value.trim();
  if (label) payload.label = label;
  if (ident) payload.chatwootInboxIdentifier = ident;
  if (iid === "") payload.chatwootInboxId = null; else payload.chatwootInboxId = Number(iid);
  const { status } = await api(`/admin/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  const m = document.getElementById("e_msg_" + id);
  if (status === 200) { m.textContent = "Đã lưu."; m.className = "msg ok"; loadAccounts(); }
  else { m.textContent = status === 400 ? "Inbox identifier không hợp lệ." : "Lưu thất bại."; m.className = "msg err"; }
};

window.infoCard = async (id) => {
  const box = document.getElementById("infocard_" + id);
  if (box.innerHTML) { box.innerHTML = ""; return; }
  const { status, body } = await api(`/admin/api/accounts/${id}/info-card`);
  const c = status === 200 && body ? body : { enabled: false, title: "", subtitle: "", imageUrl: "" };
  box.innerHTML =
    `<div class="card" style="margin-top:8px">` +
    `<p class="mut">Card "yêu cầu thông tin" gửi tự động 1 lần cho khách OA mới. Bật + có ảnh mới chạy.</p>` +
    `<label><input type="checkbox" id="ic_en_${id}" ${c.enabled ? "checked" : ""} /> Bật gửi tự động</label>` +
    `<label>Tiêu đề (≤100)</label><input id="ic_title_${id}" maxlength="100" value="${escapeHtml(c.title)}" />` +
    `<label>Mô tả (≤500)</label><input id="ic_sub_${id}" maxlength="500" value="${escapeHtml(c.subtitle)}" />` +
    `<label>URL ảnh (https, .png/.jpg)</label><input id="ic_img_${id}" value="${escapeHtml(c.imageUrl)}" placeholder="https://..." />` +
    `<div class="row" style="margin-top:8px"><button onclick="saveInfoCard(${id})">Lưu</button>` +
    `<button class="sec" onclick="document.getElementById('infocard_${id}').innerHTML=''">Đóng</button></div>` +
    `<div id="ic_msg_${id}" class="msg"></div></div>`;
};

window.saveInfoCard = async (id) => {
  const payload = {
    enabled: document.getElementById("ic_en_" + id).checked,
    title: document.getElementById("ic_title_" + id).value.trim(),
    subtitle: document.getElementById("ic_sub_" + id).value.trim(),
    imageUrl: document.getElementById("ic_img_" + id).value.trim(),
  };
  const { status, body } = await api(`/admin/api/accounts/${id}/info-card`, { method: "PUT", body: JSON.stringify(payload) });
  const m = document.getElementById("ic_msg_" + id);
  if (status === 200) { m.textContent = "Đã lưu."; m.className = "msg ok"; }
  else {
    const errMap = { image_required_when_enabled: "Bật thì phải có URL ảnh.", image_url_invalid: "URL ảnh phải bắt đầu http(s)://", title_too_long: "Tiêu đề quá dài.", subtitle_too_long: "Mô tả quá dài." };
    m.textContent = (body && errMap[body.error]) || "Lưu thất bại.";
    m.className = "msg err";
  }
};

window.login_ = async (id) => {
  const { body } = await api(`/admin/api/accounts/${id}/login`, { method: "POST" });
  const box = document.getElementById("qr_" + id);
  if (body && body.qrImageBase64) box.innerHTML = `<div class="card" style="margin-top:8px"><img alt="QR" src="${body.qrImageBase64}" style="max-width:240px" /></div>`;
  else box.textContent = "Không lấy được QR.";
};

async function createAccount() {
  const type = $("newType").value;
  const label = $("newLabel").value.trim();
  const chatwootInboxIdentifier = $("newInboxIdent").value.trim();
  const iid = $("newInboxId").value.trim();
  if (!label || !chatwootInboxIdentifier) { msg("addMsg", "Cần nhãn và inbox identifier.", false); return; }
  const payload = { label, chatwootInboxIdentifier };
  if (iid) payload.chatwootInboxId = Number(iid);
  const endpoint = type === "oa" ? "/admin/api/accounts/oa" : "/admin/api/accounts";
  const { status } = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
  if (status === 200) { $("newLabel").value = ""; $("newInboxIdent").value = ""; $("newInboxId").value = ""; msg("addMsg", "Đã thêm.", true); loadAccounts(); }
  else msg("addMsg", "Thêm thất bại.", false);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const LOG_LEVEL = { 30: { t: "info", c: "info" }, 40: { t: "warn", c: "warn" }, 50: { t: "error", c: "err" } };

function logLevelMeta(level) {
  return LOG_LEVEL[level] || { t: String(level), c: "off" };
}

async function loadLogs() {
  const level = $("logLevel").value;
  const accountId = $("logAccount").value;
  const qs = new URLSearchParams({ limit: "300" });
  if (level) qs.set("level", level);
  if (accountId) qs.set("accountId", accountId);
  const { status, body } = await api("/admin/api/logs?" + qs.toString());
  if (status !== 200 || !Array.isArray(body)) { msg("logsMsg", "Không tải được logs.", false); return; }
  lastLogs = body;
  logsShown = LOGS_PAGE;
  msg("logsMsg", `${body.length} dòng.`, true);
  renderLogs();
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
      ? `<pre class="logctx">${escapeHtml(JSON.stringify(r.context, null, 2))}</pre>` : "";
    return `<tr class="${rowCls}">` +
      `<td>${escapeHtml(new Date(r.ts).toLocaleString())}</td>` +
      `<td><span class="badge ${m.c}">${m.t}</span></td>` +
      `<td>${r.accountId ?? "—"}</td>` +
      `<td>${escapeHtml(r.event || "—")}</td>` +
      `<td>${escapeHtml(r.msg || "")}${ctx}</td></tr>`;
  }).join("");
  const more = remaining > 0
    ? `<div class="row" style="margin-top:8px"><button class="sec" onclick="showMoreLogs()">Tải thêm (còn ${remaining})</button></div>`
    : "";
  box.innerHTML = `<table class="logs"><thead>${head}</thead><tbody>${body}</tbody></table>${more}`;
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

window.askDelete = (id, label) => {
  const box = document.getElementById("del_" + id);
  box.innerHTML =
    `<div class="card" style="margin-top:8px;border-color:#7a2230">` +
    `<p class="mut">Xóa vĩnh viễn tài khoản và dữ liệu bridge liên quan (không ảnh hưởng inbox Chatwoot). Gõ đúng nhãn <b>${escapeHtml(label)}</b> để xác nhận.</p>` +
    `<input id="del_in_${id}" placeholder="Nhập nhãn để xác nhận" oninput="checkDelete(${id}, ${escapeHtml(JSON.stringify(label))})" />` +
    `<div class="row" style="margin-top:8px">` +
      `<button id="del_btn_${id}" class="danger" disabled onclick="confirmDelete(${id})">Xác nhận xóa</button>` +
      `<button class="sec" onclick="document.getElementById('del_${id}').innerHTML=''">Hủy</button>` +
    `</div><div id="del_msg_${id}" class="msg"></div></div>`;
};

window.checkDelete = (id, label) => {
  const typed = document.getElementById("del_in_" + id).value;
  document.getElementById("del_btn_" + id).disabled = typed !== label;
};

window.confirmDelete = async (id) => {
  const { status } = await api(`/admin/api/accounts/${id}`, { method: "DELETE" });
  const m = document.getElementById("del_msg_" + id);
  if (status === 200) { loadAccounts(); }
  else { m.textContent = status === 404 ? "Không tìm thấy tài khoản." : "Xóa thất bại."; m.className = "msg err"; }
};

boot();
