const backendUrl = "https://emme-elle.onrender.com/api/preventivo";

// --- STATO ---
let righe = [];

const el = (id) => document.getElementById(id);

const formatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

// --- INIT ---
window.addEventListener("DOMContentLoaded", () => {
  console.log("JS caricato ✅");

  // Prova a caricare un preventivo salvato
  const salvato = localStorage.getItem("ciccahelper_preventivo");
  if (salvato) {
    try {
      const data = JSON.parse(salvato);
      righe = data.righe || [];
      el("cliente").value = data.cliente || "";
      el("data").value = data.data || "";
      el("note").value = data.note || "";
      renderTable();
    } catch (e) {
      console.error("Errore nel parse del preventivo salvato:", e);
    }
  }

  // Bottoni base
  el("btn-add-row").addEventListener("click", aggiungiRigaDaForm);
  el("btn-nuovo").addEventListener("click", nuovoPreventivo);
  el("btn-pdf").addEventListener("click", esportaPDF);

  // Bottone AI (se esiste)
  const btnAI = document.getElementById("btn-ai");
  if (btnAI) {
    btnAI.addEventListener("click", generaConAI);
  }
});

// --------------------
// AGGIUNGI RIGA
// --------------------
function aggiungiRigaDaForm() {
  const codice = el("codice").value.trim();
  const descrizione = el("descrizione").value.trim();
  const quantita = parseFloat(el("quantita").value) || 0;
  const prezzoListino = parseFloat(el("prezzo_listino").value) || 0;
  const sconto = parseFloat(el("sconto").value) || 0;
  const iva = parseFloat(el("iva").value) || 22;

  if (!descrizione || quantita <= 0) {
    alert("Inserisci almeno descrizione e quantità (>0).");
    return;
  }

  righe.push({
    codice,
    descrizione,
    quantita,
    prezzoListino,
    sconto,
    iva,
  });

  // pulisco i campi riga
  el("codice").value = "";
  el("descrizione").value = "";
  el("quantita").value = "";
  el("prezzo_listino").value = "";
  el("sconto").value = "";
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

  let imponibileTot = 0;
  let ivaTot = 0;

  righe.forEach((r, index) => {
    const netto = r.prezzoListino * (1 - r.sconto / 100);
    const totale = netto * r.quantita;
    const ivaRiga = totale * (r.iva / 100);

    imponibileTot += totale;
    ivaTot += ivaRiga;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${r.codice || ""}</td>
      <td>${r.descrizione}</td>
      <td>${r.quantita.toFixed(2)}</td>
      <td>${r.prezzoListino.toFixed(2)}</td>
      <td>${r.sconto.toFixed(2)}</td>
      <td>${netto.toFixed(2)}</td>
      <td>${totale.toFixed(2)}</td>
      <td>${r.iva.toFixed(2)}</td>
      <td><button class="btn-small btn-delete" onclick="eliminaRiga(${index})">X</button></td>
    `;

    tbody.appendChild(tr);
  });

  el("imponibile-tot").textContent = formatter.format(imponibileTot);
  el("iva-tot").textContent = formatter.format(ivaTot);
  el("totale-preventivo").textContent = formatter.format(imponibileTot + ivaTot);
}

// --------------------
// ELIMINA RIGA
// --------------------
function eliminaRiga(i) {
  righe.splice(i, 1);
  renderTable();
  salva();
}

// --------------------
// NUOVO PREVENTIVO
// --------------------
function nuovoPreventivo() {
  if (!confirm("Sicuro di voler svuotare tutto?")) return;
  righe = [];
  el("cliente").value = "";
  el("data").value = "";
  el("note").value = "";
  renderTable();
  salva();
}

// --------------------
// SALVATAGGIO LOCALE
// --------------------
function salva() {
  const payload = {
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe,
  };
  localStorage.setItem("ciccahelper_preventivo", JSON.stringify(payload));
}

// --------------------
// PDF
// --------------------
function esportaPDF() {
  if (righe.length === 0) {
    alert("Aggiungi almeno una riga.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  let y = 10;

  doc.setFontSize(16);
  doc.text("Preventivo materiali edili", 10, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Cliente: ${el("cliente").value}`, 10, y);
  y += 5;
  doc.text(`Data: ${el("data").value}`, 10, y);
  y += 5;

  if (el("note").value.trim() !== "") {
    const noteLines = doc.splitTextToSize(`Note: ${el("note").value}`, 180);
    doc.text(noteLines, 10, y);
    y += noteLines.length * 4 + 5;
  }

  doc.setFontSize(9);
  doc.text("Righe preventivo:", 10, y);
  y += 5;

  righe.forEach((r, i) => {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }

    const netto = r.prezzoListino * (1 - r.sconto / 100);
    const totale = netto * r.quantita;

    const line = `${i + 1}) ${r.codice} - ${r.descrizione} | Q.tà: ${
      r.quantita
    } | Netto: ${netto.toFixed(2)} € | Totale: ${totale.toFixed(2)} €`;
    const lines = doc.splitTextToSize(line, 180);
    doc.text(lines, 10, y);
    y += lines.length * 4 + 2;
  });

  const imponibile = righe.reduce(
    (sum, r) => sum + r.prezzoListino * (1 - r.sconto / 100) * r.quantita,
    0
  );
  const ivaTot = righe.reduce(
    (sum, r) =>
      sum +
      r.prezzoListino * (1 - r.sconto / 100) * r.quantita * (r.iva / 100),
    0
  );

  const totalePrev = imponibile + ivaTot;

  y += 5;
  doc.setFontSize(11);
  doc.text(`Imponibile: ${imponibile.toFixed(2)} €`, 10, y);
  y += 6;
  doc.text(`IVA totale: ${ivaTot.toFixed(2)} €`, 10, y);
  y += 6;
  doc.text(`Totale preventivo: ${totalePrev.toFixed(2)} €`, 10, y);

  doc.save("preventivo.pdf");
}

// --------------------
// AI: CHIAMATA BACKEND
// --------------------
async function generaConAI() {
  if (!backendUrl || backendUrl.includes("NOME.onrender.com")) {
    alert("Devi impostare il backendUrl in app.js con il tuo URL Render.");
    return;
  }

  if (righe.length === 0) {
    alert("Aggiungi almeno una riga al preventivo prima di usare l'AI.");
    return;
  }

  const payload = {
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe: righe,
  };

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.error) {
      alert("Errore AI: " + data.error);
      console.error("Dettagli errore:", data);
      return;
    }

    const box = document.getElementById("risultatoAI");
    box.style.display = "block";
    box.textContent = data.contenuto;
  } catch (err) {
    console.error(err);
    alert("Errore di connessione al backend.");
  }
}
