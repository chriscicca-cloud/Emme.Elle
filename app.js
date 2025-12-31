// 🔗 BACKEND
const BACKEND_BASE = "https://emme-elle.onrender.com";
const backendUrl = `${BACKEND_BASE}/api/preventivo`;
const askUrl = `${BACKEND_BASE}/api/ask`;

// --- STATO ---
let righe = [];

const el = (id) => document.getElementById(id);

const formatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

// 🔐 PASSWORD BACKEND (salvata nel browser)
function getPassword() {
  let pwd = localStorage.getItem("ciccahelper_pwd");
  if (!pwd) {
    pwd = prompt("EmmeElle2026!");
    if (!pwd) return null;
    localStorage.setItem("ciccahelper_pwd", pwd);
  }
  return pwd;
}

// --------------------
// UTILS
// --------------------
function parseNumero(val) {
  if (!val) return 0;
  const cleaned = String(val)
    .replace(/[^\d,.\-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// --------------------
// INIT
// --------------------
window.addEventListener("DOMContentLoaded", () => {
  console.log("JS caricato ✅");

  const salvato = localStorage.getItem("ciccahelper_preventivo");
  if (salvato) {
    try {
      const data = JSON.parse(salvato);
      righe = data.righe || [];
      el("cliente").value = data.cliente || "";
      el("data").value = data.data || "";
      el("note").value = data.note || "";
      renderTable();
    } catch {}
  }

  el("btn-add-row")?.addEventListener("click", aggiungiRigaDaForm);
  el("btn-nuovo")?.addEventListener("click", nuovoPreventivo);
  el("btn-pdf")?.addEventListener("click", esportaPDF);
  el("btn-ai")?.addEventListener("click", generaConAI);

  // Chiedi a AI
  el("btn-ask-ai")?.addEventListener("click", chiediAI);
  el("btn-clear-ai")?.addEventListener("click", () => {
    el("ai-domanda").value = "";
    el("ai-risposta").style.display = "none";
    el("ai-risposta").textContent = "";
  });
});

// --------------------
// AGGIUNGI RIGA
// --------------------
function aggiungiRigaDaForm() {
  const riga = {
    codice: el("codice").value.trim(),
    descrizione: el("descrizione").value.trim(),
    quantita: parseFloat(el("quantita").value) || 0,
    prezzoListino: parseFloat(el("prezzo_listino").value) || 0,
    sconto: parseFloat(el("sconto").value) || 0,
    iva: parseFloat(el("iva").value) || 22,
  };

  if (!riga.descrizione || riga.quantita <= 0) {
    alert("Inserisci almeno descrizione e quantità.");
    return;
  }

  righe.push(riga);

  ["codice","descrizione","quantita","prezzo_listino","sconto"].forEach(id => el(id).value = "");
  el("iva").value = "22";

  renderTable();
  salva();
}

// --------------------
// RENDER TABELLA
// --------------------
function renderTable() {
  const tbody = document.querySelector("#righe-table tbody");
  tbody.innerHTML = "";

  let imponibile = 0;
  let ivaTot = 0;

  righe.forEach((r, i) => {
    const netto = r.prezzoListino * (1 - r.sconto / 100);
    const totale = netto * r.quantita;
    const ivaRiga = totale * (r.iva / 100);

    imponibile += totale;
    ivaTot += ivaRiga;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.codice}</td>
      <td>${r.descrizione}</td>
      <td>${r.quantita.toFixed(2)}</td>
      <td>${r.prezzoListino.toFixed(2)}</td>
      <td>${r.sconto.toFixed(2)}</td>
      <td>${netto.toFixed(2)}</td>
      <td>${totale.toFixed(2)}</td>
      <td>${r.iva.toFixed(2)}</td>
      <td><button onclick="eliminaRiga(${i})">X</button></td>
    `;
    tbody.appendChild(tr);
  });

  el("imponibile-tot").textContent = formatter.format(imponibile);
  el("iva-tot").textContent = formatter.format(ivaTot);
  el("totale-preventivo").textContent = formatter.format(imponibile + ivaTot);
}

// --------------------
function eliminaRiga(i) {
  righe.splice(i, 1);
  renderTable();
  salva();
}

function nuovoPreventivo() {
  if (!confirm("Svuotare il preventivo?")) return;
  righe = [];
  el("cliente").value = "";
  el("data").value = "";
  el("note").value = "";
  renderTable();
  salva();
}

function salva() {
  localStorage.setItem("ciccahelper_preventivo", JSON.stringify({
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe
  }));
}

// --------------------
// PDF
// --------------------
function esportaPDF() {
  if (!righe.length) return alert("Nessuna riga.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  doc.text("Preventivo", 10, y); y += 8;
  doc.text(`Cliente: ${el("cliente").value}`, 10, y); y += 6;

  righe.forEach((r, i) => {
    const netto = r.prezzoListino * (1 - r.sconto / 100);
    const tot = netto * r.quantita;
    doc.text(`${i+1}) ${r.descrizione} - ${tot.toFixed(2)} €`, 10, y);
    y += 6;
  });

  doc.save("preventivo.pdf");
}

// --------------------
// GENERA CON AI
// --------------------
async function generaConAI() {
  if (!righe.length) return alert("Aggiungi almeno una riga.");

  const pwd = getPassword();
  if (!pwd) return;

  const payload = {
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe
  };

  const res = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-password": pwd
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  // Se password sbagliata o server risponde con errore
  if (!res.ok || data.error) {
    alert(data.error || "Errore chiamata AI");
    return;
  }

  const testo = data.contenuto || "";

  el("risultatoAI").style.display = "block";
  el("risultatoAI").textContent = testo;

  // aggiorna righe dai prezzi AI (markdown)
  const rows = testo.split("\n").filter(l => l.startsWith("|") && !l.includes("---")).slice(1);

  const nuove = [];
  rows.forEach(l => {
    const c = l.split("|").map(x => x.trim()).filter(Boolean);
    if (c.length < 7) return;
    nuove.push({
      codice: c[0],
      descrizione: c[1],
      quantita: parseNumero(c[2]),
      prezzoListino: parseNumero(c[3]),
      sconto: 0,
      iva: parseNumero(c[6]) || 22
    });
  });

  if (nuove.length) {
    righe = nuove;
    renderTable();
    salva();
  }
}

// --------------------
// CHIEDI A AI
// --------------------
async function chiediAI() {
  const domanda = el("ai-domanda").value.trim();
  if (!domanda) return alert("Scrivi una domanda.");

  const pwd = getPassword();
  if (!pwd) return;

  const payload = {
    domanda,
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe
  };

  const res = await fetch(askUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-password": pwd
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    alert(data.error || "Errore richiesta AI");
    return;
  }

  el("ai-risposta").style.display = "block";
  el("ai-risposta").textContent = data.contenuto || "(nessuna risposta)";
}