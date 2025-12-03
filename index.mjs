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

// Endpoint che userà la web app
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
  .map(
    (r, i) =>
      `${i + 1}) Codice: ${r.codice || ""}, Desc: ${r.descrizione || ""}, Q.ty: ${
        r.quantita || 0
      }, Sconto: ${r.sconto || 0}, Prezzo listino: ${r.prezzo_listino || ""}`
  )
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

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Backend CiccaHelper in ascolto sulla porta ${port}`);
});
