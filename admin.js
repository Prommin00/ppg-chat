// admin.js
(() => {
  // ✅ แก้ให้เป็น Worker ของคุณ
  const DEFAULT_API_BASE = "https://ppgadmin.2551prommin.workers.dev";

  const el = (id) => document.getElementById(id);

  const apiBaseEl = el("apiBase");
  const passwordEl = el("password");
  const loginBtn = el("loginBtn");
  const logoutBtn = el("logoutBtn");
  const testBtn = el("testBtn");
  const saveBtn = el("saveBtn");
  const clearBtn = el("clearBtn");
  const refreshBtn = el("refreshBtn");
  const msgBox = el("msgBox");
  const statusPill = el("statusPill");

  const editIdEl = el("editId");
  const qInput = el("qInput");
  const aInput = el("aInput");
  const tagInput = el("tagInput");

  const listEl = el("list");
  const searchEl = el("search");
  const countText = el("countText");

  const LS_TOKEN = "ppg_admin_token";
  const LS_API = "ppg_admin_api_base";

  let state = {
    token: "",
    apiBase: "",
    faq: [],
    filtered: [],
  };

  function showMsg(type, text) {
    msgBox.classList.remove("hide", "ok", "err");
    msgBox.classList.add(type === "ok" ? "ok" : "err");
    msgBox.textContent = text;
  }
  function hideMsg() {
    msgBox.classList.add("hide");
  }

  function getApiBase() {
    const v = String(apiBaseEl.value || "").trim();
    return v.replace(/\/+$/, "");
  }

  function setUiLoggedIn(on) {
    if (on) {
      statusPill.textContent = "เข้าสู่ระบบแล้ว";
      logoutBtn.classList.remove("hide");
      el("loginBox").classList.add("hide");
      saveBtn.disabled = false;
      refreshBtn.disabled = false;
    } else {
      statusPill.textContent = "ยังไม่เข้าสู่ระบบ";
      logoutBtn.classList.add("hide");
      el("loginBox").classList.remove("hide");
      saveBtn.disabled = true;
      refreshBtn.disabled = true;
    }
  }

  async function api(path, { method = "GET", body = null, auth = true } = {}) {
    const base = state.apiBase;
    const url = base + path;

    const headers = { "Content-Type": "application/json" };
    if (auth && state.token) headers["Authorization"] = "Bearer " + state.token;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));
  }

  function renderList(items) {
    listEl.innerHTML = "";

    if (!items.length) {
      listEl.innerHTML = `<div style="padding:14px;color:#6b7280;">ยังไม่มี FAQ</div>`;
      countText.textContent = "0 รายการ";
      return;
    }

    countText.textContent = `${items.length} รายการ`;

    for (const it of items) {
      const q = escapeHtml(it.q || "");
      const a = escapeHtml(it.a || "").replace(/\n/g, "<br>");
      const tag = String(it.tag || "").trim();

      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div>
          <div class="q">${q}</div>
          <div class="a">${a}</div>
          <div class="meta">
            ${tag ? `<span class="tag">${escapeHtml(tag)}</span>` : ""}
            <span class="small mono">${escapeHtml(it.id || "")}</span>
          </div>
        </div>
        <div class="itemBtns">
          <button class="btn ghost" data-act="edit">แก้ไข</button>
          <button class="btn danger" data-act="del">ลบ</button>
        </div>
      `;

      row.querySelector('[data-act="edit"]').addEventListener("click", () => {
        hideMsg();
        editIdEl.value = it.id || "";
        qInput.value = it.q || "";
        aInput.value = it.a || "";
        tagInput.value = it.tag || "";
        qInput.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      row.querySelector('[data-act="del"]').addEventListener("click", async () => {
        hideMsg();
        const ok = confirm("ลบรายการนี้แน่ใจไหม?");
        if (!ok) return;
        try {
          await api("/api/faq/delete", { method: "POST", body: { id: it.id } });
          await loadFaq();
          showMsg("ok", "ลบเรียบร้อย");
        } catch (e) {
          showMsg("err", "ลบไม่สำเร็จ: " + e.message);
        }
      });

      listEl.appendChild(row);
    }
  }

  function applyFilter() {
    const t = String(searchEl.value || "").trim().toLowerCase();
    if (!t) {
      state.filtered = state.faq.slice();
    } else {
      state.filtered = state.faq.filter((x) => {
        const hay = `${x.q || ""}\n${x.a || ""}\n${x.tag || ""}`.toLowerCase();
        return hay.includes(t);
      });
    }
    renderList(state.filtered);
  }

  async function loadFaq() {
    const data = await api("/api/faq", { method: "GET" });
    state.faq = Array.isArray(data.faq) ? data.faq : [];
    applyFilter();
  }

  async function doLogin() {
    hideMsg();

    const base = getApiBase();
    if (!base) return showMsg("err", "กรุณาใส่ Worker API Base URL");
    state.apiBase = base;
    localStorage.setItem(LS_API, base);

    const password = String(passwordEl.value || "");
    if (!password) return showMsg("err", "กรุณาใส่รหัสผ่านแอดมิน");

    loginBtn.disabled = true;
    try {
      const data = await api("/api/login", { method: "POST", body: { password }, auth: false });
      state.token = data.token || "";
      if (!state.token) throw new Error("Token ไม่ถูกต้อง");

      localStorage.setItem(LS_TOKEN, state.token);

      setUiLoggedIn(true);
      await loadFaq();
      showMsg("ok", "เข้าสู่ระบบสำเร็จ");
      passwordEl.value = "";
    } catch (e) {
      setUiLoggedIn(false);
      showMsg("err", "เข้าสู่ระบบไม่สำเร็จ: " + e.message);
    } finally {
      loginBtn.disabled = false;
    }
  }

  function doLogout() {
    state.token = "";
    localStorage.removeItem(LS_TOKEN);
    setUiLoggedIn(false);
    renderList([]);
    showMsg("ok", "ออกจากระบบแล้ว");
  }

  async function testConnection() {
    hideMsg();
    const base = getApiBase();
    if (!base) return showMsg("err", "กรุณาใส่ Worker API Base URL");
    try {
      const res = await fetch(base + "/api/health");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      showMsg("ok", "เชื่อมต่อได้ ✅ " + JSON.stringify(data));
    } catch (e) {
      showMsg("err", "เชื่อมต่อไม่ได้: " + e.message);
    }
  }

  async function saveFaq() {
    hideMsg();
    const id = String(editIdEl.value || "").trim();
    const q = String(qInput.value || "").trim();
    const a = String(aInput.value || "").trim();
    const tag = String(tagInput.value || "").trim();

    if (!q || !a) return showMsg("err", "กรอกคำถามและคำตอบให้ครบ");

    saveBtn.disabled = true;
    try {
      if (!id) {
        await api("/api/faq/add", { method: "POST", body: { q, a, tag } });
        showMsg("ok", "เพิ่ม FAQ เรียบร้อย");
      } else {
        await api("/api/faq/update", { method: "POST", body: { id, q, a, tag } });
        showMsg("ok", "แก้ไข FAQ เรียบร้อย");
      }
      clearForm();
      await loadFaq();
    } catch (e) {
      showMsg("err", "บันทึกไม่สำเร็จ: " + e.message);
    } finally {
      saveBtn.disabled = false;
    }
  }

  function clearForm() {
    editIdEl.value = "";
    qInput.value = "";
    aInput.value = "";
    tagInput.value = "";
  }

  function boot() {
    // init apiBase
    const savedBase = localStorage.getItem(LS_API) || DEFAULT_API_BASE;
    apiBaseEl.value = savedBase;
    state.apiBase = String(savedBase).replace(/\/+$/, "");

    // init token
    const token = localStorage.getItem(LS_TOKEN) || "";
    if (token) {
      state.token = token;
      setUiLoggedIn(true);
      loadFaq().catch(() => {
        // token อาจหมด/secret เปลี่ยน
        doLogout();
        showMsg("err", "Token ใช้งานไม่ได้ กรุณาเข้าสู่ระบบใหม่");
      });
    } else {
      setUiLoggedIn(false);
    }

    // events
    loginBtn.addEventListener("click", doLogin);
    logoutBtn.addEventListener("click", doLogout);
    testBtn.addEventListener("click", testConnection);
    refreshBtn.addEventListener("click", () => loadFaq().catch((e) => showMsg("err", e.message)));
    saveBtn.addEventListener("click", saveFaq);
    clearBtn.addEventListener("click", () => { hideMsg(); clearForm(); });

    searchEl.addEventListener("input", applyFilter);
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
