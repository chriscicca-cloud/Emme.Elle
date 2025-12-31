import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint di test
app.get("/", (req, res) => {
  res.send("CiccaHelper backend è vivo ✅");
});

// --------------------
// /api/preventivo (uguale al tuo, ma con piccole correzioni nomi campi)
// --------------------
app.post("/api/preventivo", async (req, res) => {
  try {
    const { cliente, data, note, righe } = req.body;

    const userMessage = `
Genera un preventivo usando i listini caricati.

Cliente: ${cliente}
Data: ${data}
Note: ${note}

Righe:
${(righe || [])
  .map((r, i) => {
    const codice = r.codice || "";
    const desc = r.descrizione || "";
    const qty = r.quantita ?? 0;
    const sconto = r.sconto ?? 0;

    // 👉 nel tuo frontend il campo è prezzoListino, nel tuo vecchio prompt era prezzo_listino
    const prezzoListino = r.prezzoListino ?? r.prezzo_listino ?? "";

    const iva = r.iva ?? 22;

    return `${i + 1}) Codice: ${codice}, Desc: ${desc}, Q.ty: ${qty}, Sconto: ${sconto}, Prezzo listino: ${prezzoListino}, IVA: ${iva}`;
  })
  .join("\n")}

Risultato richiesto:
1) Tabella in Markdown con: Codice, Descrizione, Q.tà, Prezzo netto, Sconto %, Totale riga, IVA %
2) Riepilogo finale: imponibile, IVA totale, totale preventivo.
`.trim();

    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: userMessage }],
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    if (run.status !== "completed") {
      return res
        .status(500)
        .json({ error: "Errore generazione preventivo", status: run.status });
    }

    const messages = await client.beta.threads.messages.list(thread.id, {
      order: "desc",
      limit: 1,
    });

    const msg = messages.data[0];
    const textPart = msg.content.find((c) => c.type === "text");
    const contenuto = textPart ? textPart.text.value : "Nessun contenuto";

    res.json({ contenuto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server", dettaglio: String(err) });
  }
});

// --------------------
// /api/ask (NUOVO) - per "Chiedi a AI"
// --------------------
app.post("/api/ask", async (req, res) => {
  try {
    const { domanda, cliente, data, note, righe } = req.body;

    const userMessage = `
Rispondi alla domanda in modo chiaro e pratico, considerando che sei un assistente per preventivi materiali edili.
Se utile, fai elenchi puntati e suggerisci alternative.

Domanda: ${domanda}

Contesto:
Cliente: ${cliente || ""}
Data: ${data || ""}
Note: ${note || ""}

Righe preventivo attuali:
${(righe || [])
  .map((r, i) => {
    const codice = r.codice || "";
    const desc = r.descrizione || "";
    const qty = r.quantita ?? 0;
    return `${i + 1}) ${codice} - ${desc} x ${qty}`;
  })
  .join("\n")}
`.trim();

    const thread = await client.beta.threads.create({
      messages: [{ role: "user", content: userMessage }],
    });

    const run = await client.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    if (run.status !== "completed") {
      return res
        .status(500)
        .json({ error: "Errore richiesta AI", status: run.status });
    }

    const messages = await client.beta.threads.messages.list(thread.id, {
      order: "desc",
      limit: 1,
    });

    const msg = messages.data[0];
    const textPart = msg.content.find((c) => c.type === "text");
    const contenuto = textPart ? textPart.text.value : "Nessun contenuto";

    res.json({ contenuto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore server", dettaglio: String(err) });
  }
});

// --------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Backend CiccaHelper in ascolto sulla porta ${port}`);
});