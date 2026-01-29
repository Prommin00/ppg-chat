// PPG Admin (Static) + Cloudflare Worker API
// ต้องตั้งค่า window.PPG_ADMIN_API ใน admin_config.js ให้ชี้ไปที่ Worker เช่น:
// window.PPG_ADMIN_API = "https://ppgadmin.2551prommin.workers.dev";

const API_BASE = (window.PPG_ADMIN_API || "").replace(/\/$/, "");
const TOKEN_KEY = "ppg_admin_token";

const $ = (id) => document.getElementById(id);

function setText(id, msg){ const el=$(id); if(el) el.textContent = msg || ""; }
function showEditor(on){
  $("editorCard").style.display = on ? "block" : "none";
}

async function safeReadJSON(res){
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return res.json().catch(() => ({}));
  }
  // ถ้าได้ HTML (เช่น 405 ของ GitHub Pages) อย่าพยายาม parse เป็น JSON
  const text = await res.text().catch(()=>"");
  return { _non_json: true, text };
}

async function api(path, opts = {}){
  if(!API_BASE) throw new Error("ยังไม่ได้ตั้งค่า PPG_ADMIN_API (admin_config.js)");
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const headers = { "Content-Type":"application/json", ...(opts.headers || {}) };
  if(token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const data = await safeReadJSON(res);
  return { res, data };
}

function isLoggedIn(){
  return !!localStorage.getItem(TOKEN_KEY);
}

async function doLogin(){
  setText("loginMsg","");
  setText("status","");
  const pw = ($("pw").value || "").trim();
  if(!pw) return setText("loginMsg","กรุณาใส่รหัสผ่าน");

  const { res, data } = await api("/api/login", {
    method:"POST",
    body: JSON.stringify({ password: pw })
  });

  if(!res.ok){
    const msg = data?.error || (data?._non_json ? "API ตอบกลับไม่ใช่ JSON (ตรวจ URL Worker)" : "ล็อกอินไม่สำเร็จ");
    return setText("loginMsg", msg);
  }
  if(!data.token) return setText("loginMsg","ล็อกอินไม่สำเร็จ (ไม่พบ token)");
  localStorage.setItem(TOKEN_KEY, data.token);
  showEditor(true);
  setText("loginMsg","เข้าสู่ระบบสำเร็จ ✅");
}

async function doLoad(){
  setText("status","กำลังโหลด...");
  const { res, data } = await api("/api/faq", { method:"GET" });
  if(!res.ok){
    const msg = data?.error || (data?._non_json ? "API ตอบกลับไม่ใช่ JSON (ตรวจ URL Worker)" : "โหลดไม่สำเร็จ");
    return setText("status", msg);
  }
  const faq = Array.isArray(data.faq) ? data.faq : [];
  $("jsonBox").value = JSON.stringify(faq, null, 2);
  setText("status", `โหลดแล้ว ${faq.length} รายการ`);
}

async function doSave(){
  setText("status","กำลังบันทึก...");
  let faq;
  try { faq = JSON.parse($("jsonBox").value || "[]"); }
  catch { return setText("status","JSON ไม่ถูกต้อง"); }

  const { res, data } = await api("/api/faq", {
    method:"POST",
    body: JSON.stringify({ faq })
  });

  if(!res.ok){
    const msg = data?.error || (data?._non_json ? "API ตอบกลับไม่ใช่ JSON (ตรวจ URL Worker)" : "บันทึกไม่สำเร็จ");
    return setText("status", msg);
  }
  setText("status", `บันทึกสำเร็จ ✅ (${data.count ?? faq.length} รายการ)`);
}

function doLogout(){
  localStorage.removeItem(TOKEN_KEY);
  showEditor(false);
  setText("status","ออกจากระบบแล้ว");
  setText("loginMsg","");
}

document.addEventListener("DOMContentLoaded", () => {
  // wire events
  $("loginBtn").addEventListener("click", () => doLogin().catch(e=>setText("loginMsg", e.message)));
  $("pw").addEventListener("keydown", (e)=>{ if(e.key==="Enter") $("loginBtn").click(); });

  $("loadBtn")?.addEventListener("click", () => doLoad().catch(e=>setText("status", e.message)));
  $("saveBtn")?.addEventListener("click", () => doSave().catch(e=>setText("status", e.message)));
  $("logoutBtn")?.addEventListener("click", doLogout);

  // init view
  showEditor(isLoggedIn());
  if(!API_BASE){
    setText("loginMsg","⚠️ ยังไม่ได้ตั้งค่า URL Worker ใน admin_config.js");
  }
});
