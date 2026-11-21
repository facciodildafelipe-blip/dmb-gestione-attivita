'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const superjson = require('superjson');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== DATABASE IN MEMORIA (JSON) =====
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data.json');

let db = {
  dipendenti: [],
  categorie: [],
  attivita: [],
  assegnazioni: [],
  competenze: [],
  tracciamento: [],
};

// Carica dati dal file JSON
function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      db.dipendenti = parsed.dipendenti || [];
      db.categorie = parsed.categorie || [];
      db.attivita = parsed.attivita || [];
      db.assegnazioni = parsed.assegnazioni || [];
      db.competenze = parsed.competenze || [];
      db.tracciamento = parsed.tracciamento || [];
      console.log(`[DB] Caricati: ${db.dipendenti.length} dipendenti, ${db.categorie.length} categorie, ${db.attivita.length} attivita, ${db.assegnazioni.length} assegnazioni`);
    } else {
      console.log('[DB] data.json non trovato, uso dati vuoti');
      seedData();
    }
  } catch (e) {
    console.error('[DB] Errore caricamento dati:', e.message);
    // FAIL CLOSED: never replace an unreadable archive with sample records.
    throw new Error('Archivio dati non leggibile: avvio bloccato per evitare sovrascritture');
  }
}

// Persist to a temporary file, fsync it, then atomically rename.
// Errors propagate to the caller: never report success after a failed write.
function saveData() {
  const tempPath = DATA_PATH + '.tmp-' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tempPath, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(db, null, 2));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tempPath, DATA_PATH);
  } catch (e) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(tempPath); } catch (_) { /* cleanup only */ }
    console.error('[DB] Errore salvataggio dati:', e.message);
    throw e;
  }
}

// Seed dati iniziali se il file non esiste
function seedData() {
  db.dipendenti = [
    { id: 1, nome: 'Felipe', mansione: 'Supervisore', puntoVendita: 'Tutti', isCaporeparto: true, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 2, nome: 'Pasquale', mansione: 'Capo Reparto', puntoVendita: 'Nuoro', isCaporeparto: true, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 3, nome: 'Riccardo', mansione: 'Macellaio', puntoVendita: 'Nuoro', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 4, nome: 'Davide', mansione: 'Macellaio', puntoVendita: 'Nuoro', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 5, nome: 'Carmelo', mansione: 'Macellaio', puntoVendita: 'Nuoro', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 6, nome: 'Alessio', mansione: 'Operatore', puntoVendita: 'Nuoro', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 7, nome: 'Edoardo Schirru', mansione: 'Capo Reparto', puntoVendita: 'Poetto', isCaporeparto: true, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 8, nome: 'Francesco', mansione: 'Macellaio', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 9, nome: 'Caterina', mansione: 'Operatore', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 10, nome: 'Elisa', mansione: 'Operatore', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 11, nome: 'Andrea', mansione: 'Macellaio', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 12, nome: 'Massimo', mansione: 'Macellaio', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 13, nome: 'Giovanni', mansione: 'Operatore', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 14, nome: 'Simonetta', mansione: 'Operatore', puntoVendita: 'Poetto', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 15, nome: 'Omar Loi', mansione: 'Macellaio', puntoVendita: 'STC Carni', isCaporeparto: false, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  db.categorie = [
    { id: 9, nome: 'Area tecnica', colore: '#EF4444', createdAt: new Date().toISOString() },
    { id: 10, nome: 'Banco', colore: '#3B82F6', createdAt: new Date().toISOString() },
    { id: 11, nome: 'Confezionamento', colore: '#F59E0B', createdAt: new Date().toISOString() },
    { id: 12, nome: 'Manager', colore: '#06B6D4', createdAt: new Date().toISOString() },
    { id: 13, nome: 'PHS', colore: '#22C55E', createdAt: new Date().toISOString() },
    { id: 14, nome: 'Polleria', colore: '#A855F7', createdAt: new Date().toISOString() },
    { id: 15, nome: 'Preparati', colore: '#EC4899', createdAt: new Date().toISOString() },
  ];
  saveData();
}

// ID auto-increment helper
function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1;
}

// Helper per convertire date
function toDateStr(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.substring(0, 10);
  if (d instanceof Date) return d.toISOString().substring(0, 10);
  return String(d).substring(0, 10);
}

loadData();

// ===== tRPC SETUP =====
const t = initTRPC.context().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;

// ===== APP ROUTER =====
const appRouter = router({
  // Dipendenti
  dipendenti: router({
    getAll: publicProcedure.query(() => {
      return [...db.dipendenti].sort((a, b) => {
        if (a.puntoVendita !== b.puntoVendita) return a.puntoVendita.localeCompare(b.puntoVendita);
        return a.nome.localeCompare(b.nome);
      });
    }),
    getByPuntoVendita: publicProcedure
      .input(z.object({ puntoVendita: z.string() }))
      .query(({ input }) => {
        return db.dipendenti
          .filter(d => d.puntoVendita === input.puntoVendita || d.puntoVendita === 'Tutti')
          .sort((a, b) => a.nome.localeCompare(b.nome));
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        return db.dipendenti.find(d => d.id === input.id) || null;
      }),
    getDipendenteByUserId: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => {
        return db.dipendenti.find(d => d.userId === input.userId) || null;
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.object({
        nome: z.string().optional(),
        mansione: z.string().optional(),
        puntoVendita: z.string().optional(),
        isCaporeparto: z.boolean().optional(),
      })}))
      .mutation(({ input }) => {
        const idx = db.dipendenti.findIndex(d => d.id === input.id);
        if (idx === -1) return { success: false };
        db.dipendenti[idx] = { ...db.dipendenti[idx], ...input.data, updatedAt: new Date().toISOString() };
        saveData();
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        db.competenze = db.competenze.filter(c => c.dipendenteId !== input.id);
        db.dipendenti = db.dipendenti.filter(d => d.id !== input.id);
        saveData();
        return { success: true };
      }),
  }),

  // Categorie
  categorie: router({
    getAll: publicProcedure.query(() => {
      return [...db.categorie].sort((a, b) => a.nome.localeCompare(b.nome));
    }),
  }),

  // Attività
  attivita: router({
    getAll: publicProcedure.query(() => {
      return db.attivita.map(a => {
        const cat = db.categorie.find(c => c.id === a.categoriaId);
        return { ...a, categoriaNome: cat?.nome || '', categoriaColore: cat?.colore || '' };
      }).sort((a, b) => {
        if (a.categoriaNome !== b.categoriaNome) return a.categoriaNome.localeCompare(b.categoriaNome);
        return a.nome.localeCompare(b.nome);
      });
    }),
    getByCategoria: publicProcedure
      .input(z.object({ categoriaId: z.number() }))
      .query(({ input }) => {
        return db.attivita
          .filter(a => a.categoriaId === input.categoriaId)
          .map(a => {
            const cat = db.categorie.find(c => c.id === a.categoriaId);
            return { ...a, categoriaNome: cat?.nome || '', categoriaColore: cat?.colore || '' };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome));
      }),
  }),

  // Competenze
  competenze: router({
    getByDipendente: publicProcedure
      .input(z.object({ dipendenteId: z.number() }))
      .query(({ input }) => {
        return db.competenze.filter(c => c.dipendenteId === input.dipendenteId);
      }),
    canDoAttivita: publicProcedure
      .input(z.object({ dipendenteId: z.number(), attivitaId: z.number() }))
      .query(({ input }) => {
        return db.competenze.some(c => c.dipendenteId === input.dipendenteId && c.attivitaId === input.attivitaId);
      }),
  }),

  // Assegnazioni
  assegnazioni: router({
    create: publicProcedure
      .input(z.object({
        attivitaId: z.number(),
        dipendenteId: z.number(),
        data: z.date(),
        orarioInizio: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const id = nextId(db.assegnazioni);
        const ass = {
          id,
          attivitaId: input.attivitaId,
          dipendenteId: input.dipendenteId,
          data: toDateStr(input.data),
          orarioInizio: input.orarioInizio || null,
          stato: 'da_fare',
          note: input.note || null,
          tempoEffettivoMin: null,
          timerStart: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.assegnazioni.push(ass);
        saveData();
        return { success: true, id };
      }),
    getByData: publicProcedure
      .input(z.object({ data: z.date() }))
      .query(({ input }) => {
        const dateStr = toDateStr(input.data);
        return db.assegnazioni
          .filter(ass => ass.data === dateStr)
          .map(ass => {
            const a = db.attivita.find(x => x.id === ass.attivitaId) || {};
            const cat = db.categorie.find(c => c.id === a.categoriaId) || {};
            const d = db.dipendenti.find(x => x.id === ass.dipendenteId) || {};
            return {
              ...ass,
              attivitaNome: a.nome || '',
              turno: a.turno || '',
              tempoMedioMin: a.tempoMedioMin || 0,
              orario: a.orario || null,
              categoriaNome: cat.nome || '',
              categoriaColore: cat.colore || '',
              dipendenteNome: d.nome || '',
              dipendenteMansione: d.mansione || '',
            };
          })
          .sort((a, b) => (a.turno || '').localeCompare(b.turno || '') || (a.attivitaNome || '').localeCompare(b.attivitaNome || ''));
      }),
    getMyAssignments: publicProcedure
      .input(z.object({ data: z.date(), dipendenteId: z.number().optional() }))
      .query(({ input }) => {
        if (!input.dipendenteId) return [];
        const dateStr = toDateStr(input.data);
        return db.assegnazioni
          .filter(ass => ass.data === dateStr && ass.dipendenteId === input.dipendenteId)
          .map(ass => {
            const a = db.attivita.find(x => x.id === ass.attivitaId) || {};
            const cat = db.categorie.find(c => c.id === a.categoriaId) || {};
            const d = db.dipendenti.find(x => x.id === ass.dipendenteId) || {};
            return {
              ...ass,
              attivitaNome: a.nome || '',
              turno: a.turno || '',
              tempoMedioMin: a.tempoMedioMin || 0,
              orario: a.orario || null,
              noteTempo: a.noteTempo || null,
              categoriaNome: cat.nome || '',
              categoriaColore: cat.colore || '',
              dipendenteNome: d.nome || '',
              dipendenteMansione: d.mansione || '',
            };
          })
          .sort((a, b) => (a.turno || '').localeCompare(b.turno || '') || (a.attivitaNome || '').localeCompare(b.attivitaNome || ''));
      }),
    updateStato: publicProcedure
      .input(z.object({
        assegnazioneId: z.number(),
        stato: z.enum(['da_fare', 'in_corso', 'completata', 'in_ritardo']),
      }))
      .mutation(({ input }) => {
        const idx = db.assegnazioni.findIndex(a => a.id === input.assegnazioneId);
        if (idx === -1) return { success: false };
        db.assegnazioni[idx] = { ...db.assegnazioni[idx], stato: input.stato, updatedAt: new Date().toISOString() };
        saveData();
        return { success: true };
      }),
  }),

  // Tracciamento tempi
  tracciamento: router({
    startTimer: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        const idx = db.assegnazioni.findIndex(a => a.id === input.assegnazioneId);
        if (idx === -1) return { success: false };
        db.assegnazioni[idx] = { ...db.assegnazioni[idx], stato: 'in_corso', timerStart: new Date().toISOString(), updatedAt: new Date().toISOString() };
        saveData();
        return { success: true };
      }),
    pauseTimer: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        const idx = db.assegnazioni.findIndex(a => a.id === input.assegnazioneId);
        if (idx !== -1 && db.assegnazioni[idx].timerStart) {
          const startMs = new Date(db.assegnazioni[idx].timerStart).getTime();
          const elapsedMin = Math.round((Date.now() - startMs) / 60000);
          const prev = db.assegnazioni[idx].tempoEffettivoMin || 0;
          db.assegnazioni[idx] = { ...db.assegnazioni[idx], stato: 'da_fare', timerStart: null, tempoEffettivoMin: prev + elapsedMin, updatedAt: new Date().toISOString() };
          saveData();
        }
        return { success: true };
      }),
    completeAttivita: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        const idx = db.assegnazioni.findIndex(a => a.id === input.assegnazioneId);
        if (idx !== -1) {
          let totalMin = db.assegnazioni[idx].tempoEffettivoMin || 0;
          if (db.assegnazioni[idx].timerStart) {
            const startMs = new Date(db.assegnazioni[idx].timerStart).getTime();
            totalMin += Math.round((Date.now() - startMs) / 60000);
          }
          db.assegnazioni[idx] = { ...db.assegnazioni[idx], stato: 'completata', timerStart: null, tempoEffettivoMin: totalMin, updatedAt: new Date().toISOString() };
          saveData();
        }
        return { success: true };
      }),
    getByAssegnazione: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .query(({ input }) => {
        return db.tracciamento.filter(t => t.assegnazioneId === input.assegnazioneId);
      }),
  }),

  // Statistiche
  statistiche: router({
    caporeparto: publicProcedure
      .input(z.object({ data: z.date() }))
      .query(({ input }) => {
        const dateStr = toDateStr(input.data);
        const giornaliere = db.assegnazioni.filter(a => a.data === dateStr);
        return {
          totale: giornaliere.length,
          completate: giornaliere.filter(a => a.stato === 'completata').length,
          inCorso: giornaliere.filter(a => a.stato === 'in_corso').length,
          inRitardo: giornaliere.filter(a => a.stato === 'in_ritardo').length,
          daFare: giornaliere.filter(a => a.stato === 'da_fare').length,
        };
      }),
    dipendente: publicProcedure
      .input(z.object({ data: z.date(), dipendenteId: z.number().optional() }))
      .query(({ input }) => {
        if (!input.dipendenteId) return null;
        const dateStr = toDateStr(input.data);
        const mine = db.assegnazioni.filter(a => a.data === dateStr && a.dipendenteId === input.dipendenteId);
        return {
          totale: mine.length,
          completate: mine.filter(a => a.stato === 'completata').length,
          inCorso: mine.filter(a => a.stato === 'in_corso').length,
          inRitardo: mine.filter(a => a.stato === 'in_ritardo').length,
          daFare: mine.filter(a => a.stato === 'da_fare').length,
        };
      }),
  }),

  // Admin router
  admin: router({
    dipendenti: router({
      create: publicProcedure
        .input(z.object({ nome: z.string(), mansione: z.string(), puntoVendita: z.string(), isCaporeparto: z.boolean().default(false) }))
        .mutation(({ input }) => {
          const id = nextId(db.dipendenti);
          db.dipendenti.push({ id, ...input, userId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          saveData();
          return { success: true, id };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), nome: z.string().optional(), mansione: z.string().optional(), puntoVendita: z.string().optional(), isCaporeparto: z.boolean().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const idx = db.dipendenti.findIndex(d => d.id === id);
          if (idx === -1) return { success: false };
          db.dipendenti[idx] = { ...db.dipendenti[idx], ...data, updatedAt: new Date().toISOString() };
          saveData();
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          db.competenze = db.competenze.filter(c => c.dipendenteId !== input.id);
          db.dipendenti = db.dipendenti.filter(d => d.id !== input.id);
          saveData();
          return { success: true };
        }),
    }),
    categorie: router({
      create: publicProcedure
        .input(z.object({ nome: z.string(), colore: z.string() }))
        .mutation(({ input }) => {
          const id = nextId(db.categorie);
          db.categorie.push({ id, ...input, createdAt: new Date().toISOString() });
          saveData();
          return { success: true, id };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), nome: z.string().optional(), colore: z.string().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const idx = db.categorie.findIndex(c => c.id === id);
          if (idx === -1) return { success: false };
          db.categorie[idx] = { ...db.categorie[idx], ...data };
          saveData();
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          db.attivita = db.attivita.filter(a => a.categoriaId !== input.id);
          db.categorie = db.categorie.filter(c => c.id !== input.id);
          saveData();
          return { success: true };
        }),
    }),
    attivita: router({
      create: publicProcedure
        .input(z.object({ categoriaId: z.number(), nome: z.string(), descrizione: z.string().optional(), periodo: z.string(), orario: z.string().optional(), turno: z.enum(['mattino','pomeriggio','sera','']).default(''), tempoMedioMin: z.number().default(0), noteTempo: z.string().optional() }))
        .mutation(({ input }) => {
          const id = nextId(db.attivita);
          db.attivita.push({ id, ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          saveData();
          return { success: true, id };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), categoriaId: z.number().optional(), nome: z.string().optional(), descrizione: z.string().optional(), periodo: z.string().optional(), orario: z.string().optional(), turno: z.enum(['mattino','pomeriggio','sera','']).optional(), tempoMedioMin: z.number().optional(), noteTempo: z.string().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const idx = db.attivita.findIndex(a => a.id === id);
          if (idx === -1) return { success: false };
          db.attivita[idx] = { ...db.attivita[idx], ...data, updatedAt: new Date().toISOString() };
          saveData();
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          db.competenze = db.competenze.filter(c => c.attivitaId !== input.id);
          db.attivita = db.attivita.filter(a => a.id !== input.id);
          saveData();
          return { success: true };
        }),
    }),
    competenze: router({
      create: publicProcedure
        .input(z.object({ dipendenteId: z.number(), attivitaId: z.number() }))
        .mutation(({ input }) => {
          const id = nextId(db.competenze);
          db.competenze.push({ id, ...input, createdAt: new Date().toISOString() });
          saveData();
          return { success: true, id };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          db.competenze = db.competenze.filter(c => c.id !== input.id);
          saveData();
          return { success: true };
        }),
      getAll: publicProcedure.query(() => {
        return db.competenze.map(comp => {
          const d = db.dipendenti.find(x => x.id === comp.dipendenteId);
          const a = db.attivita.find(x => x.id === comp.attivitaId);
          return { ...comp, dipendenteNome: d?.nome || '', attivitaNome: a?.nome || '' };
        });
      }),
    }),
  }),
});

// ===== EXPRESS MIDDLEWARE =====
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, dipendenti: db.dipendenti.length }));

// SECURITY HOLD: this prototype has public procedures without role authorization.
// Keep API disabled until verified authentication, authorization and tenant isolation
// are implemented and tested. Do not bypass this gate for production data.
app.use('/api/trpc', (_req, res) => res.status(503).json({ error: 'API temporaneamente disabilitata: autorizzazioni non verificate' }));

app.use('/api/trpc', createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}),
}));

// Serve frontend statico
const STATIC_DIR = path.join(__dirname, 'public');
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(STATIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not found');
      }
    }
  });
}

app.listen(PORT, () => {
  console.log(`DMB app running on port ${PORT}`);
});
