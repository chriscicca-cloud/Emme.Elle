let righe = [];
const backendUrl = "https://emme-elle.onrender.com/api/preventivo";

const el = (id) => document.getElementById(id);

const formatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

// --- INIT ---
window.addEventListener("DOMContentLoaded", () => {
  // Prova a caricare un preventivo salvato
  const salvato = localStorage.getItem("ciccahelper_preventivo");
  if (salvato) {
    const data = JSON.parse(salvato);
    righe = data.righe || [];
    el("cliente").value = data.cliente || "";
    el("data").value = data.data || "";
    el("note").value = data.note || "";
    renderTable();
  }

  el("btn-add-row").addEventListener("click", aggiungiRigaDaForm);
  el("btn-nuovo").addEventListener("click", nuovoPreventivo);
  el("btn-pdf").addEventListener("click", esportaPDF);
});

// --- FUNZIONI PRINCIPALI ---

function aggiungiRigaDaForm() {
  const codice = el("codice").value.trim();
  const descrizione = el("descrizione").value.trim();
  const quantita = parseFloat(el("quantita").value.replace(",", ".")) || 0;
  const prezzoListino =
    parseFloat(el("prezzo_listino").value.replace(",", ".")) || 0;
  const sconto = parseFloat(el("sconto").value.replace(",", ".")) || 0;
  const iva = parseFloat(el("iva").value.replace(",", ".")) || 22;

  if (!descrizione || quantita <= 0 || prezzoListino < 0) {
    alert("Compila almeno descrizione, quantità (>0) e prezzo di listino.");
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

  // Pulisci form riga
  el("codice").value = "";
  el("descrizione").value = "";
  el("quantita").value = "";
  el("prezzo_listino").value = "";
  el("sconto").value = "";
  el("iva").value = "22";

  renderTable();
  salvaSuLocalStorage();
}

function renderTable() {
  const tbody = document.querySelector("#righe-table tbody");
  tbody.innerHTML = "";

  let imponibileTot = 0;
  let ivaTot = 0;

  righe.forEach((r, index) => {
    const prezzoNettoUnit = r.prezzoListino * (1 - r.sconto / 100);
    const totaleRigaImponibile = prezzoNettoUnit * r.quantita;
    const ivaRiga = totaleRigaImponibile * (r.iva / 100);

    imponibileTot += totaleRigaImponibile;
    ivaTot += ivaRiga;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(r.codice || "")}</td>
      <td>${escapeHtml(r.descrizione || "")}</td>
      <td>${r.quantita.toFixed(2)}</td>
      <td>${r.prezzoListino.toFixed(2)}</td>
      <td>${r.sconto.toFixed(2)}</td>
      <td>${prezzoNettoUnit.toFixed(2)}</td>
      <td>${totaleRigaImponibile.toFixed(2)}</td>
      <td>${r.iva.toFixed(2)}</td>
      <td><button class="btn-small btn-delete" data-index="${index}">X</button></td>
    `;

    tbody.appendChild(tr);
  });

  const totalePreventivo = imponibileTot + ivaTot;

  el("imponibile-tot").textContent = formatter.format(imponibileTot);
  el("iva-tot").textContent = formatter.format(ivaTot);
  el("totale-preventivo").textContent = formatter.format(totalePreventivo);

  // Gestione pulsanti elimina
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      righe.splice(idx, 1);
      renderTable();
      salvaSuLocalStorage();
    });
  });
}

function nuovoPreventivo() {
  if (!confirm("Sicuro di voler svuotare il preventivo attuale?")) return;
  righe = [];
  el("cliente").value = "";
  el("data").value = "";
  el("note").value = "";
  renderTable();
  salvaSuLocalStorage();
}

function salvaSuLocalStorage() {
  const payload = {
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe,
  };
  localStorage.setItem("ciccahelper_preventivo", JSON.stringify(payload));
}

function esportaPDF() {
  if (righe.length === 0) {
    alert("Aggiungi almeno una riga prima di esportare il PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const cliente = el("cliente").value || "N/D";
  const data = el("data").value || "";
  const note = el("note").value || "";

  let y = 10;

  doc.setFontSize(14);
  doc.text("Preventivo materiali edili", 10, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`Cliente: ${cliente}`, 10, y);
  y += 6;
  if (data) {
    doc.text(`Data: ${data}`, 10, y);
    y += 6;
  }
  if (note) {
    const noteLines = doc.splitTextToSize(`Note: ${note}`, 180);
    doc.text(noteLines, 10, y);
    y += noteLines.length * 5 + 2;
  }

  y += 4;

  // Intestazioni tabella nel PDF
  doc.setFontSize(9);
  const headers = [
    "#",
    "Codice",
    "Descrizione",
    "Q.tà",
    "Listino",
    "Sconto",
    "Netto",
    "Tot. riga",
    "IVA",
  ];
  const colX = [10, 20, 45, 110, 125, 145, 160, 180, 200];

  // riduco un po' a 8 colonne effettive usando descrizione larga e accorciando
  // (per semplicità mantengo le posizioni base)
  // Stampo header
  headers.forEach((h, i) => {
    if (colX[i] > 190) return; // limite margine
    doc.text(h, colX[i], y);
  });
  y += 5;
  doc.setLineWidth(0.1);
  doc.line(10, y, 200, y);
  y += 4;

  let imponibileTot = 0;
  let ivaTot = 0;

  righe.forEach((r, index) => {
    const prezzoNettoUnit = r.prezzoListino * (1 - r.sconto / 100);
    const totaleRigaImponibile = prezzoNettoUnit * r.quantita;
    const ivaRiga = totaleRigaImponibile * (r.iva / 100);

    imponibileTot += totaleRigaImponibile;
    ivaTot += ivaRiga;

    if (y > 270) {
      doc.addPage();
      y = 10;
    }

    const descLines = doc.splitTextToSize(r.descrizione || "", 60);

    doc.text(String(index + 1), colX[0], y);
    doc.text(r.codice || "", colX[1], y);
    doc.text(descLines, colX[2], y);

    doc.text(r.quantita.toFixed(2), colX[3], y, { align: "right" });
    doc.text(r.prezzoListino.toFixed(2), colX[4], y, { align: "right" });
    doc.text(r.sconto.toFixed(2), colX[5], y, { align: "right" });
    doc.text(prezzoNettoUnit.toFixed(2), colX[6], y, { align: "right" });
    doc.text(totaleRigaImponibile.toFixed(2), colX[7], y, { align: "right" });
    // IVA qui non la ripeto se lo spazio è stretto, altrimenti:
    // doc.text(r.iva.toFixed(2), colX[8], y, { align: "right" });

    y += descLines.length * 4 + 2;
  });

  const totalePreventivo = imponibileTot + ivaTot;

  y += 4;
  if (y > 270) {
    doc.addPage();
    y = 10;
  }

  doc.setLineWidth(0.2);
  doc.line(120, y, 200, y);
  y += 6;

  doc.setFontSize(10);
  doc.text(
    `Imponibile: ${imponibileTot.toFixed(2)} €`,
    120,
    y
  );
  y += 6;
  doc.text(`IVA totale: ${ivaTot.toFixed(2)} €`, 120, y);
  y += 6;
  doc.text(
    `Totale preventivo: ${totalePreventivo.toFixed(2)} €`,
    120,
    y
  );

  doc.save(`preventivo_${cliente || "cliente"}.pdf`);
}

// --- UTILITY ---
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
document.getElementById("btn-ai").addEventListener("click", generaConAI);

async function generaConAI() {
  const payload = {
    cliente: el("cliente").value,
    data: el("data").value,
    note: el("note").value,
    righe: righe
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
      return;
    }

    // Mostra la tabella generata dall’AI
    console.log("Risposta AI:", data.contenuto);

    // Puoi scriverla in una <div> o convertirla in PDF
    alert("Preventivo AI generato! Controlla la console per vedere il contenuto.");

  } catch (e) {
    console.error(e);
    alert("Errore di connessione al backend.");
  }
}
