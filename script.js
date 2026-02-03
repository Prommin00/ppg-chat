document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // CONFIG + ELEMENTS
  // =========================
  const input = document.getElementById("user-input");
  const box = document.getElementById("chat-box");
  const btn = document.getElementById("send-btn");

  const apiUrl =
    window.PPG_API_URL || "https://ppg-chat-api.2551prommin.workers.dev/";

  // ✅ ใส่รูปบอท (วาง image.png ไว้โฟลเดอร์เดียวกับ index.html)
  const BOT_AVATAR_URL = "image.png";

  // escape html (ปลอดภัย)
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));

  // =========================
  // USER KEY (ไม่ระบุตัวตน)
  // =========================
  function getUserKey() {
    let k = sessionStorage.getItem("ppg_user_key");
    if (!k) {
      k =
        "guest_" +
        (crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now() + "_" + Math.random().toString(16).slice(2));
      sessionStorage.setItem("ppg_user_key", k);
    }
    return k;
  }

  // =========================
  // SESSION HISTORY (รีเฟรชแล้วหาย / ปลอดภัยกว่า)
  // =========================
  function loadHistory() {
    try {
      const k = getUserKey();
      const raw = sessionStorage.getItem("ppg_history_" + k);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    const k = getUserKey();
    sessionStorage.setItem("ppg_history_" + k, JSON.stringify(items.slice(-200)));
  }

  let history = loadHistory();

  // =========================
  // RENDER CHAT
  // =========================
  function appendBubble(role, text) {
    const isUser = role === "user";

    // แถวข้อความ (avatar + bubble)
    const row = document.createElement("div");
    row.className = `msg-row ${isUser ? "user" : "bot"}`;

    // avatar เฉพาะฝั่ง bot
    if (!isUser) {
      const av = document.createElement("img");
      av.className = "avatar";
      av.src = BOT_AVATAR_URL;
      av.alt = "PPG";
      row.appendChild(av);
    }

    // bubble ข้อความ
    const bubble = document.createElement("div");
    bubble.className = `bubble ${isUser ? "user" : "bot"}`;
    bubble.innerHTML = esc(text).replace(/\n/g, "<br>");

    row.appendChild(bubble);
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  function renderHistory() {
    box.innerHTML = "";
    if (!history.length) {
      appendBubble("assistant", "สวัสดีครับ 👋 มีอะไรให้ PPG ช่วยไหมครับ?");
      return;
    }
    history.forEach((m) => appendBubble(m.role, m.content));
  }

  renderHistory();

  // =========================
  // TYPING (แบบไม่บี้)
  // =========================
  function showTyping(on) {
    let row = document.getElementById("typing-row");

    if (on) {
      if (!row) {
        row = document.createElement("div");
        row.id = "typing-row";
        row.className = "msg-row bot";

        const av = document.createElement("img");
        av.className = "avatar";
        av.src = BOT_AVATAR_URL;
        av.alt = "PPG";

        const bubble = document.createElement("div");
        bubble.className = "bubble bot typing";
        bubble.textContent = "กำลังตอบ...";

        row.appendChild(av);
        row.appendChild(bubble);
        box.appendChild(row);
      }
      box.scrollTop = box.scrollHeight;
    } else {
      if (row) row.remove();
    }
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage() {
    const msg = input.value.trim();
    if (!msg) return;

    appendBubble("user", msg);
    input.value = "";

    history.push({ role: "user", content: msg });
    saveHistory(history);

    showTyping(true);
    btn.disabled = true;

    // กันค้างนาน
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          userKey: getUserKey(),
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      showTyping(false);

      if (!res.ok) {
        const err = data?.error || data?.detail || "ระบบขัดข้อง";
        appendBubble("assistant", "ขออภัย: " + err);
        history.push({ role: "assistant", content: "ขออภัย: " + err });
        saveHistory(history);
        return;
      }

      const reply = data.reply || "ไม่สามารถตอบได้ในขณะนี้";
      appendBubble("assistant", reply);
      history.push({ role: "assistant", content: reply });
      saveHistory(history);
    } catch (e) {
      showTyping(false);
      const msgErr =
        e.name === "AbortError"
          ? "AI ตอบช้าเกินไป กรุณาลองใหม่"
          : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      appendBubble("assistant", msgErr);
      history.push({ role: "assistant", content: msgErr });
      saveHistory(history);
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      input.focus();
    }
  }

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // =========================
  // FAQ SUPPORT
  // =========================
  window.askFromFAQ = function (q) {
    input.value = q;
    input.focus();
  };

  // =========================
  // FAQ PANEL
  // =========================
  (function initFAQ() {
    const fab = document.getElementById("faqFab");
    const panel = document.getElementById("faqPanel");
    const closeBtn = document.getElementById("faqClose");
    const listEl = document.getElementById("faqList");
    const searchEl = document.getElementById("faqSearch");

    if (!fab || !panel || !closeBtn || !listEl) return;

    const FAQ = (window.PPG_FAQ || []).map((x) => ({
      q: x.q || "",
      a: x.a || "",
      tag: x.tag || "",
    }));

    function render(items) {
      listEl.innerHTML = "";
      if (!items.length) {
        listEl.innerHTML =
          `<div style="color:#666;font-size:13px;">ไม่พบคำถาม</div>`;
        return;
      }

      items.forEach((it) => {
        const wrap = document.createElement("div");
        wrap.className = "faq-item";
        wrap.innerHTML = `
          <button class="faq-q" type="button">
            <span>${esc(it.q)}</span>
            <span>▾</span>
          </button>
          <div class="faq-a">${esc(it.a).replace(/\n/g, "<br>")}</div>
        `;

        // คลิกครั้งเดียว = เปิด/ปิดคำตอบ
        wrap.querySelector(".faq-q").addEventListener("click", () => {
          wrap.classList.toggle("open");
        });

        // ดับเบิลคลิก = เอาคำถามไปใส่ช่องพิมพ์ (ไม่ส่งทันที)
        wrap.querySelector(".faq-q").addEventListener("dblclick", () => {
          window.askFromFAQ(it.q);
          panel.classList.remove("open");
        });

        listEl.appendChild(wrap);
      });
    }

    fab.addEventListener("click", () => panel.classList.add("open"));
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));

    // chips ถ้ามีใน HTML (optional)
    document.querySelectorAll(".faq-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.getAttribute("data-tag") || "";
        if (!tag) return render(FAQ);
        const filtered = FAQ.filter((x) => (x.q + x.a).includes(tag));
        render(filtered.length ? filtered : FAQ);
      });
    });

    if (searchEl) {
      searchEl.addEventListener("input", () => {
        const t = searchEl.value.trim().toLowerCase();
        const filtered = !t
          ? FAQ
          : FAQ.filter((x) => (x.q + x.a).toLowerCase().includes(t));
        render(filtered);
      });
    }

    render(FAQ);
  })();
});
