const API = window.PPG_ADMIN_API || "";

async function login(){
  const pw = document.getElementById("pw").value;
  const r = await fetch(API + "/login", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password:pw})
  });
  const d = await r.json();
  if(d.token){
    localStorage.setItem("ppg_admin_token", d.token);
    alert("เข้าสู่ระบบแล้ว");
  }else alert("รหัสผิด");
}

async function saveFAQ(){
  const token = localStorage.getItem("ppg_admin_token");
  const data = document.getElementById("faq").value;
  const r = await fetch(API + "/faq", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+token
    },
    body:data
  });
  alert("บันทึกแล้ว");
}