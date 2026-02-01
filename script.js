document.addEventListener("DOMContentLoaded", () => {
  // -----------------------------
  // Config + Elements
  // -----------------------------
  const API_URL =
    window.PPG_API_URL || "https://ppg-chat-api.2551prommin.workers.dev/";

  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");

  if (!input || !box || !btn) {
    console.error("Missing required elements: #user-input, #chat-box, #send-btn");
    return;
  }

  // -----------------------------
  // UserKey + History (localStorage)
  // -----------------------------
  function getUserKey() {
    let k = localStorage.getItem("ppg_user_key");
    if (!k) {
      k =
        "guest_" +
        (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random());
      localStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

  function historyKey() {
    return "ppg_history_" + getUserKey();
  }

  function loadLocalHistory() {
    try {
      const raw = localStorage.getItem(historyKey());
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLocalHistory(items) {
    try {
      // เก็บแค่ 80 ข้อความล่าสุด (กันหน่วง)
      const capped = items.slice(-80);
      localStorage.setItem(historyKey(), JSON.stringify(capped));
    } catch {}
  }

  let history = loadLocalHistory();

  // -----------------------------
  // UI Helpers
  // -----------------------------
  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `bubble ${role === "user" ? "user" : "bot"}`;

    // ใช้ innerText เพื่อปลอดภัย + รองรับขึ้นบรรทัดใหม่
    div.innerText = String(text ?? "");
    box.appendChild(div);

    // เลื่อนลงล่างสุดเสมอ
    box.scrollTop = box.scrollHeight;
  }

  function showTyping(on) {
    let typing = document.getElementById("typing-bubble");
    if (on) {
      if (!typing) {
        typing = document.createElement("div");
        typing.id = "typing-bubble";
        typing.className = "bubble bot typing";
        typing.innerText = "กำลังพิมพ์...";
        box.appendChild(typing);
      }
      box.scrollTop = box.scrollHeight;
    } else {
      if (typing) typing.remove();
    }
  }

  // -----------------------------
  // Initial render
  // -----------------------------
  if (history.length === 0) {
    appendMessage("bot", "สวัสดีครับ มีอะไรให้ PPG ช่วยไหมครับ?");
  } else {
    history.forEach((h) => {
      // รองรับทั้ง role: "bot" และ role: "assistant"
      const r = h.role === "user" ? "user" : "bot";
      appendMessage(r, h.content);
    });
  }

  // -----------------------------
  // Send Message
  // -----------------------------
  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // แสดงข้อความของเรา
    appendMessage("user", text);
    history.push({ role: "user", content: text, ts: Date.now() });
    saveLocalHistory(history);

    // เคลียร์ช่องพิมพ์ + โฟกัส (มือถือบางรุ่นช่วยให้คีย์บอร์ดอยู่ต่อ)
    input.value = "";
    input.focus();

    showTyping(true);
    btn.disabled = true;

    // timeout กันค้าง
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ ส่ง userKey ไปด้วย (รองรับระบบแยก user / อนาคต)
        body: JSON.stringify({ message: text, userKey: getUserKey() }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      showTyping(false);

      if (!res.ok) {
        const errMsg =
          data?.error ||
          data?.detail?.error?.message ||
          `Server error (${res.status})`;
        appendMessage("bot", "ขออภัย: " + errMsg);
        history.push({ role: "bot", content: "ขออภัย: " + errMsg, ts: Date.now() });
        saveLocalHistory(history);
        return;
      }

      const reply = data?.reply ?? "ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้";
      appendMessage("bot", reply);
      history.push({ role: "bot", content: reply, ts: Date.now() });
      saveLocalHistory(history);
    } catch (err) {
      showTyping(false);
      const msg =
        err?.name === "AbortError"
          ? "AI ตอบช้าเกินไป กรุณาลองใหม่"
          : "เกิดข้อผิดพลาดในการเชื่อมต่อ";
      appendMessage("bot", msg);
      history.push({ role: "bot", content: msg, ts: Date.now() });
      saveLocalHistory(history);
      console.error(err);
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      box.scrollTop = box.scrollHeight;
      input.focus();
    }
  }

  // -----------------------------
  // Events
  // -----------------------------
  btn.addEventListener("click", sendMessage);

  // ✅ Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // -----------------------------
  // Optional: expose to FAQ click (ถ้าใช้)
  // -----------------------------
  window.askFromFAQ = function (question) {
    input.value = String(question || "");
    input.focus();
    // ถ้าอยากให้คลิกแล้วส่งทันที ให้เอาคอมเมนต์ออก
    // sendMessage();
  };
});
