'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { initTRPC } = require('@trpc/server');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');
const superjson = require('superjson');
const { z } = require('zod');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== DATABASE SETUP =====
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'dmb.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Crea tabelle
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS dipendenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    mansione TEXT NOT NULL,
    puntoVendita TEXT NOT NULL,
    isCaporeparto INTEGER DEFAULT 0,
    userId TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    colore TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS attivita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoriaId INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descrizione TEXT,
    periodo TEXT NOT NULL,
    orario TEXT,
    turno TEXT DEFAULT '',
    tempoMedioMin INTEGER DEFAULT 0,
    noteTempo TEXT,
    who TEXT,
    what TEXT,
    whenText TEXT,
    whereText TEXT,
    why TEXT,
    how TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS competenze (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dipendenteId INTEGER NOT NULL,
    attivitaId INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS assegnazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attivitaId INTEGER NOT NULL,
    dipendenteId INTEGER NOT NULL,
    data TEXT NOT NULL,
    orarioInizio TEXT,
    stato TEXT DEFAULT 'da_fare',
    note TEXT,
    tempoEffettivoMin INTEGER,
    timerStart TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tracciamento_tempi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assegnazioneId INTEGER NOT NULL,
    dipendenteId INTEGER NOT NULL,
    inizioTempo TEXT,
    fineTempo TEXT,
    tempoEffettivoMin INTEGER,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Seed dati iniziali
const dipCount = sqlite.prepare('SELECT COUNT(*) as c FROM dipendenti').get();
if (dipCount.c === 0) {
  console.log('[DB] Inserimento dati iniziali...');
  const insertDip = sqlite.prepare('INSERT INTO dipendenti (id, nome, mansione, puntoVendita, isCaporeparto) VALUES (?, ?, ?, ?, ?)');
  [
    [1, 'Felipe', 'Supervisore', 'Tutti', 1],
    [2, 'Pasquale', 'Capo Reparto', 'Nuoro', 1],
    [3, 'Riccardo', 'Macellaio', 'Nuoro', 0],
    [4, 'Davide', 'Macellaio', 'Nuoro', 0],
    [5, 'Carmelo', 'Macellaio', 'Nuoro', 0],
    [6, 'Alessio', 'Operatore', 'Nuoro', 0],
    [7, 'Edoardo Schirru', 'Capo Reparto', 'Poetto', 1],
    [8, 'Francesco', 'Macellaio', 'Poetto', 0],
    [9, 'Caterina', 'Operatore', 'Poetto', 0],
    [10, 'Elisa', 'Operatore', 'Poetto', 0],
    [11, 'Andrea', 'Macellaio', 'Poetto', 0],
    [12, 'Massimo', 'Macellaio', 'Poetto', 0],
    [13, 'Giovanni', 'Operatore', 'Poetto', 0],
    [14, 'Simonetta', 'Operatore', 'Poetto', 0],
    [15, 'Omar Loi', 'Macellaio', 'STC Carni', 0],
  ].forEach(d => insertDip.run(...d));

  const insertCat = sqlite.prepare('INSERT INTO categorie (id, nome, colore) VALUES (?, ?, ?)');
  [
    [9, 'Area tecnica', '#EF4444'],
    [10, 'Banco', '#3B82F6'],
    [11, 'Confezionamento', '#F59E0B'],
    [12, 'Manager', '#06B6D4'],
    [13, 'PHS', '#22C55E'],
    [14, 'Polleria', '#A855F7'],
    [15, 'Preparati', '#EC4899'],
  ].forEach(c => insertCat.run(...c));

  const insertAtt = sqlite.prepare(`INSERT INTO attivita (id, categoriaId, nome, periodo, orario, turno, tempoMedioMin, noteTempo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  [
    [1, 13, 'Compilare scheda temperature', 'tutti giorni', null, 'mattino', 3, '3'],
    [2, 11, 'Controllo scadenze confezionato precotti', 'tutti giorni', null, 'mattino', 10, '10'],
    [3, 13, 'Pulizia vetri', 'tutti giorni', null, 'mattino', 2, '2'],
    [4, 10, 'Allestimento banco servito', 'tutti giorni', null, 'mattino', 90, '90'],
    [5, 11, 'Controllo prodotti preincartati', 'tutti giorni', null, 'mattino', 10, '10'],
    [6, 14, 'Scarico merce/stoccaggio pollame', 'lun', null, 'mattino', 10, '10'],
    [7, 14, 'Scarico merce/stoccaggio pollame', 'mer', null, 'mattino', 10, '10'],
    [8, 14, 'Scarico merce/stoccaggio pollame', 'ven', null, 'mattino', 10, '10'],
    [9, 9, 'Scarico merce carni rosse, maiale, pecora', 'lun', null, 'sera', 15, '15'],
    [10, 9, 'Scarico merce carni rosse, maiale, pecora', 'gio', null, 'sera', 15, '15'],
    [11, 9, 'Scarico merce carni rosse, maiale, pecora', 'sab', null, 'mattino', 15, '15'],
    [12, 12, 'Ordini carni rosse', 'lun', 'entro 9:30', 'mattino', 20, '20'],
    [13, 12, 'Ordini carni rosse', 'mer', 'entro 9:30', 'mattino', 20, '20'],
    [14, 12, 'Ordini carni rosse', 'ven', 'entro 9:30', 'mattino', 20, '20'],
    [15, 12, 'Ordini carni pollame', 'lun', 'entro 9:30', 'mattino', 20, '20'],
    [16, 12, 'Ordini carni pollame', 'mer', 'entro 9:30', 'mattino', 20, '20'],
    [17, 12, 'Ordini carni pollame', 'ven', 'entro 9:30', 'mattino', 20, '20'],
    [18, 12, 'Ordine etichette', 'lun', null, 'mattino', 10, '10'],
    [19, 12, 'Ordine materiale di consumo', 'mer', null, '', 10, '10'],
    [20, 12, 'Ordine materiale di consumo', 'gio', null, 'mattino', 10, '10'],
    [21, 14, 'Lavorazione bustoni', 'tutti giorni', null, 'mattino', 60, '60'],
    [22, 11, 'Confezionamento pollame per banco take away', 'tutti giorni', null, 'mattino', 60, '60'],
    [23, 11, 'Confezionamento pollame per scorta', 'tutti giorni', null, 'mattino', 60, '60'],
    [24, 11, 'Allestimento vasca take away di preparati', 'tutti giorni', null, 'mattino', 30, '30'],
    [25, 11, 'Produzione e Allestimento vasca take away carne bovina', 'tutti giorni', null, 'mattino', 30, '30'],
    [26, 11, 'Produzione e Allestimento vasca take away carne suina', 'tutti giorni', null, 'mattino', 30, '30'],
    [27, 15, 'Preparazione carne macinata', 'tutti giorni', null, 'mattino', 20, '20'],
    [28, 13, 'Pulizie piani di lavoro e pavimenti', 'tutti giorni', null, 'pomeriggio', 10, '10'],
    [29, 13, 'Pulizie piani di lavoro e pavimenti', 'tutti giorni', null, 'mattino', 10, '10'],
    [30, 13, 'Pulizie pavimenti celle', 'tutti giorni', null, 'mattino', 20, '20'],
    [31, 13, 'Pulizie pavimenti celle', 'tutti giorni', null, 'pomeriggio', 20, '20'],
    [32, 9, 'Disosso anteriore bovino', 'tutti giorni', null, '', 50, '50'],
    [33, 9, 'Disosso posteriore bovino', 'tutti giorni', null, '', 40, '40'],
    [34, 9, 'Disosso pancia equino', 'tutti giorni', null, '', 20, '20'],
    [35, 9, 'Disosso posteriore equino', 'tutti giorni', null, '', 10, '10'],
    [36, 9, 'Disosso mezzena suino', 'tutti giorni', null, '', 1, '(1mezz)10'],
    [37, 9, 'Disosso posteriore vitello', 'tutti giorni', null, '', 10, '10'],
    [38, 15, 'Preparazione impasto e insaccatura salsicce', 'tutti giorni', null, '', 30, '(30kg aprox)80'],
    [39, 15, 'Preparazione impasto', 'tutti giorni', null, '', 30, '(30kg aprox)30'],
    [40, 15, 'Sviluppo impasto (hamburger, polpette, polpettone)', 'tutti giorni', null, '', 60, '60'],
    [41, 15, 'Preparazione preparati banco servito', 'tutti giorni', null, 'sera', 60, '60'],
    [42, 13, 'Ritiro carni dal banco', 'tutti giorni', null, 'sera', 30, '30'],
    [43, 11, 'Allineamento e ripristino banco take away', 'tutti giorni', null, 'pomeriggio', 15, '15'],
    [44, 10, 'Allineamento e ripristino banco servito', 'tutti giorni', null, 'pomeriggio', 20, '20'],
    [45, 13, 'Pulizia profonda della cella', 'lun', null, 'pomeriggio', 30, '30'],
    [46, 13, 'Lavaggio piatti banco', 'tutti giorni', null, 'sera', 10, '10'],
    [47, 13, 'Pulizia banco servito', 'tutti giorni', null, 'sera', 10, '10'],
    [48, 10, 'Servizio banconiere', 'tutti giorni', null, 'mattino', 0, null],
    [49, 10, 'Servizio banconiere', 'tutti giorni', null, 'pomeriggio', 0, null],
    [50, 10, 'Servizio banconiere', 'tutti giorni', null, 'sera', 0, null],
    [51, 11, 'Controllo tenuta take away', 'tutti giorni', null, 'sera', 10, '10'],
  ].forEach(a => insertAtt.run(...a));

  console.log('[DB] Dati iniziali inseriti con successo');
}

// ===== tRPC SETUP =====
const t = initTRPC.context().create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;

// Helper per convertire date
function toDateStr(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.substring(0, 10);
  if (d instanceof Date) return d.toISOString().substring(0, 10);
  return String(d).substring(0, 10);
}

// ===== APP ROUTER =====
const appRouter = router({
  // Dipendenti
  dipendenti: router({
    getAll: publicProcedure.query(() => {
      return sqlite.prepare('SELECT * FROM dipendenti ORDER BY puntoVendita, nome').all()
        .map(d => ({ ...d, isCaporeparto: d.isCaporeparto === 1 }));
    }),
    getByPuntoVendita: publicProcedure
      .input(z.object({ puntoVendita: z.string() }))
      .query(({ input }) => {
        const rows = sqlite.prepare(
          'SELECT * FROM dipendenti WHERE puntoVendita = ? OR puntoVendita = ? ORDER BY nome'
        ).all(input.puntoVendita, 'Tutti');
        return rows.map(d => ({ ...d, isCaporeparto: d.isCaporeparto === 1 }));
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const row = sqlite.prepare('SELECT * FROM dipendenti WHERE id = ?').get(input.id);
        if (!row) return null;
        return { ...row, isCaporeparto: row.isCaporeparto === 1 };
      }),
    getDipendenteByUserId: publicProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => {
        const row = sqlite.prepare('SELECT * FROM dipendenti WHERE userId = ?').get(input.userId);
        if (!row) return null;
        return { ...row, isCaporeparto: row.isCaporeparto === 1 };
      }),
    update: publicProcedure
      .input(z.object({ id: z.number(), data: z.object({
        nome: z.string().optional(),
        mansione: z.string().optional(),
        puntoVendita: z.string().optional(),
        isCaporeparto: z.boolean().optional(),
      })}))
      .mutation(({ input }) => {
        const { id, data } = input;
        const fields = [];
        const params = [];
        if (data.nome !== undefined) { fields.push('nome=?'); params.push(data.nome); }
        if (data.mansione !== undefined) { fields.push('mansione=?'); params.push(data.mansione); }
        if (data.puntoVendita !== undefined) { fields.push('puntoVendita=?'); params.push(data.puntoVendita); }
        if (data.isCaporeparto !== undefined) { fields.push('isCaporeparto=?'); params.push(data.isCaporeparto ? 1 : 0); }
        if (fields.length === 0) return { success: true };
        fields.push("updatedAt=datetime('now')");
        params.push(id);
        sqlite.prepare(`UPDATE dipendenti SET ${fields.join(',')} WHERE id=?`).run(...params);
        return { success: true };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        sqlite.prepare('DELETE FROM competenze WHERE dipendenteId = ?').run(input.id);
        sqlite.prepare('DELETE FROM dipendenti WHERE id = ?').run(input.id);
        return { success: true };
      }),
  }),

  // Categorie
  categorie: router({
    getAll: publicProcedure.query(() => {
      return sqlite.prepare('SELECT * FROM categorie ORDER BY nome').all();
    }),
  }),

  // Attività
  attivita: router({
    getAll: publicProcedure.query(() => {
      return sqlite.prepare(`
        SELECT a.*, c.nome as categoriaNome, c.colore as categoriaColore
        FROM attivita a JOIN categorie c ON a.categoriaId = c.id
        ORDER BY c.nome, a.nome
      `).all();
    }),
    getByCategoria: publicProcedure
      .input(z.object({ categoriaId: z.number() }))
      .query(({ input }) => {
        return sqlite.prepare(`
          SELECT a.*, c.nome as categoriaNome, c.colore as categoriaColore
          FROM attivita a JOIN categorie c ON a.categoriaId = c.id
          WHERE a.categoriaId = ?
          ORDER BY a.nome
        `).all(input.categoriaId);
      }),
  }),

  // Competenze
  competenze: router({
    getByDipendente: publicProcedure
      .input(z.object({ dipendenteId: z.number() }))
      .query(({ input }) => {
        return sqlite.prepare('SELECT * FROM competenze WHERE dipendenteId = ?').all(input.dipendenteId);
      }),
    canDoAttivita: publicProcedure
      .input(z.object({ dipendenteId: z.number(), attivitaId: z.number() }))
      .query(({ input }) => {
        const row = sqlite.prepare(
          'SELECT id FROM competenze WHERE dipendenteId = ? AND attivitaId = ?'
        ).get(input.dipendenteId, input.attivitaId);
        return !!row;
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
        const result = sqlite.prepare(
          'INSERT INTO assegnazioni (attivitaId, dipendenteId, data, orarioInizio, stato, note) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(input.attivitaId, input.dipendenteId, toDateStr(input.data), input.orarioInizio || null, 'da_fare', input.note || null);
        return { success: true, id: result.lastInsertRowid };
      }),
    getByData: publicProcedure
      .input(z.object({ data: z.date() }))
      .query(({ input }) => {
        return sqlite.prepare(`
          SELECT ass.*, a.nome as attivitaNome, a.turno, a.tempoMedioMin, a.orario,
            c.nome as categoriaNome, c.colore as categoriaColore,
            d.nome as dipendenteNome, d.mansione as dipendenteMansione
          FROM assegnazioni ass
          JOIN attivita a ON ass.attivitaId = a.id
          JOIN categorie c ON a.categoriaId = c.id
          JOIN dipendenti d ON ass.dipendenteId = d.id
          WHERE date(ass.data) = date(?)
          ORDER BY a.turno, a.nome
        `).all(toDateStr(input.data));
      }),
    getMyAssignments: publicProcedure
      .input(z.object({ data: z.date(), dipendenteId: z.number().optional() }))
      .query(({ input }) => {
        if (!input.dipendenteId) return [];
        return sqlite.prepare(`
          SELECT ass.*, a.nome as attivitaNome, a.turno, a.tempoMedioMin, a.orario, a.noteTempo,
            c.nome as categoriaNome, c.colore as categoriaColore,
            d.nome as dipendenteNome, d.mansione as dipendenteMansione
          FROM assegnazioni ass
          JOIN attivita a ON ass.attivitaId = a.id
          JOIN categorie c ON a.categoriaId = c.id
          JOIN dipendenti d ON ass.dipendenteId = d.id
          WHERE date(ass.data) = date(?) AND ass.dipendenteId = ?
          ORDER BY a.turno, a.nome
        `).all(toDateStr(input.data), input.dipendenteId);
      }),
    updateStato: publicProcedure
      .input(z.object({
        assegnazioneId: z.number(),
        stato: z.enum(['da_fare', 'in_corso', 'completata', 'in_ritardo']),
      }))
      .mutation(({ input }) => {
        sqlite.prepare("UPDATE assegnazioni SET stato=?, updatedAt=datetime('now') WHERE id=?")
          .run(input.stato, input.assegnazioneId);
        return { success: true };
      }),
  }),

  // Tracciamento tempi
  tracciamento: router({
    startTimer: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        sqlite.prepare("UPDATE assegnazioni SET stato='in_corso', timerStart=datetime('now'), updatedAt=datetime('now') WHERE id=?")
          .run(input.assegnazioneId);
        return { success: true };
      }),
    pauseTimer: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        const ass = sqlite.prepare('SELECT timerStart FROM assegnazioni WHERE id=?').get(input.assegnazioneId);
        if (ass && ass.timerStart) {
          const startMs = new Date(ass.timerStart).getTime();
          const elapsedMin = Math.round((Date.now() - startMs) / 60000);
          sqlite.prepare("UPDATE assegnazioni SET stato='da_fare', timerStart=NULL, tempoEffettivoMin=COALESCE(tempoEffettivoMin,0)+?, updatedAt=datetime('now') WHERE id=?")
            .run(elapsedMin, input.assegnazioneId);
        }
        return { success: true };
      }),
    completeAttivita: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .mutation(({ input }) => {
        const ass = sqlite.prepare('SELECT timerStart, tempoEffettivoMin FROM assegnazioni WHERE id=?').get(input.assegnazioneId);
        let totalMin = ass ? (ass.tempoEffettivoMin || 0) : 0;
        if (ass && ass.timerStart) {
          const startMs = new Date(ass.timerStart).getTime();
          totalMin += Math.round((Date.now() - startMs) / 60000);
        }
        sqlite.prepare("UPDATE assegnazioni SET stato='completata', timerStart=NULL, tempoEffettivoMin=?, updatedAt=datetime('now') WHERE id=?")
          .run(totalMin, input.assegnazioneId);
        return { success: true };
      }),
    getByAssegnazione: publicProcedure
      .input(z.object({ assegnazioneId: z.number() }))
      .query(({ input }) => {
        return sqlite.prepare('SELECT * FROM tracciamento_tempi WHERE assegnazioneId = ?').all(input.assegnazioneId);
      }),
  }),

  // Statistiche
  statistiche: router({
    caporeparto: publicProcedure
      .input(z.object({ data: z.date() }))
      .query(({ input }) => {
        const dateStr = toDateStr(input.data);
        const totale = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?)").get(dateStr).c;
        const completate = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND stato='completata'").get(dateStr).c;
        const inCorso = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND stato='in_corso'").get(dateStr).c;
        const inRitardo = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND stato='in_ritardo'").get(dateStr).c;
        const daFare = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND stato='da_fare'").get(dateStr).c;
        return { totale, completate, inCorso, inRitardo, daFare };
      }),
    dipendente: publicProcedure
      .input(z.object({ data: z.date(), dipendenteId: z.number().optional() }))
      .query(({ input }) => {
        if (!input.dipendenteId) return null;
        const dateStr = toDateStr(input.data);
        const totale = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND dipendenteId=?").get(dateStr, input.dipendenteId).c;
        const completate = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND dipendenteId=? AND stato='completata'").get(dateStr, input.dipendenteId).c;
        const inCorso = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND dipendenteId=? AND stato='in_corso'").get(dateStr, input.dipendenteId).c;
        const inRitardo = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND dipendenteId=? AND stato='in_ritardo'").get(dateStr, input.dipendenteId).c;
        const daFare = sqlite.prepare("SELECT COUNT(*) as c FROM assegnazioni WHERE date(data)=date(?) AND dipendenteId=? AND stato='da_fare'").get(dateStr, input.dipendenteId).c;
        return { totale, completate, inCorso, inRitardo, daFare };
      }),
  }),

  // Admin router
  admin: router({
    dipendenti: router({
      create: publicProcedure
        .input(z.object({ nome: z.string(), mansione: z.string(), puntoVendita: z.string(), isCaporeparto: z.boolean().default(false) }))
        .mutation(({ input }) => {
          const result = sqlite.prepare('INSERT INTO dipendenti (nome, mansione, puntoVendita, isCaporeparto) VALUES (?, ?, ?, ?)').run(input.nome, input.mansione, input.puntoVendita, input.isCaporeparto ? 1 : 0);
          return { success: true, id: result.lastInsertRowid };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), nome: z.string().optional(), mansione: z.string().optional(), puntoVendita: z.string().optional(), isCaporeparto: z.boolean().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const fields = []; const params = [];
          if (data.nome !== undefined) { fields.push('nome=?'); params.push(data.nome); }
          if (data.mansione !== undefined) { fields.push('mansione=?'); params.push(data.mansione); }
          if (data.puntoVendita !== undefined) { fields.push('puntoVendita=?'); params.push(data.puntoVendita); }
          if (data.isCaporeparto !== undefined) { fields.push('isCaporeparto=?'); params.push(data.isCaporeparto ? 1 : 0); }
          if (fields.length === 0) return { success: true };
          fields.push("updatedAt=datetime('now')"); params.push(id);
          sqlite.prepare(`UPDATE dipendenti SET ${fields.join(',')} WHERE id=?`).run(...params);
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          sqlite.prepare('DELETE FROM competenze WHERE dipendenteId = ?').run(input.id);
          sqlite.prepare('DELETE FROM dipendenti WHERE id = ?').run(input.id);
          return { success: true };
        }),
    }),
    categorie: router({
      create: publicProcedure
        .input(z.object({ nome: z.string(), colore: z.string() }))
        .mutation(({ input }) => {
          const result = sqlite.prepare('INSERT INTO categorie (nome, colore) VALUES (?, ?)').run(input.nome, input.colore);
          return { success: true, id: result.lastInsertRowid };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), nome: z.string().optional(), colore: z.string().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const fields = []; const params = [];
          if (data.nome !== undefined) { fields.push('nome=?'); params.push(data.nome); }
          if (data.colore !== undefined) { fields.push('colore=?'); params.push(data.colore); }
          if (fields.length === 0) return { success: true };
          params.push(id);
          sqlite.prepare(`UPDATE categorie SET ${fields.join(',')} WHERE id=?`).run(...params);
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          sqlite.prepare('DELETE FROM attivita WHERE categoriaId = ?').run(input.id);
          sqlite.prepare('DELETE FROM categorie WHERE id = ?').run(input.id);
          return { success: true };
        }),
    }),
    attivita: router({
      create: publicProcedure
        .input(z.object({ categoriaId: z.number(), nome: z.string(), descrizione: z.string().optional(), periodo: z.string(), orario: z.string().optional(), turno: z.enum(['mattino','pomeriggio','sera','']).default(''), tempoMedioMin: z.number().default(0), noteTempo: z.string().optional() }))
        .mutation(({ input }) => {
          const result = sqlite.prepare('INSERT INTO attivita (categoriaId, nome, descrizione, periodo, orario, turno, tempoMedioMin, noteTempo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(input.categoriaId, input.nome, input.descrizione || null, input.periodo, input.orario || null, input.turno || '', input.tempoMedioMin || 0, input.noteTempo || null);
          return { success: true, id: result.lastInsertRowid };
        }),
      update: publicProcedure
        .input(z.object({ id: z.number(), categoriaId: z.number().optional(), nome: z.string().optional(), descrizione: z.string().optional(), periodo: z.string().optional(), orario: z.string().optional(), turno: z.enum(['mattino','pomeriggio','sera','']).optional(), tempoMedioMin: z.number().optional(), noteTempo: z.string().optional() }))
        .mutation(({ input }) => {
          const { id, ...data } = input;
          const fields = []; const params = [];
          Object.entries(data).forEach(([k, v]) => { if (v !== undefined) { fields.push(`${k}=?`); params.push(v); } });
          if (fields.length === 0) return { success: true };
          fields.push("updatedAt=datetime('now')"); params.push(id);
          sqlite.prepare(`UPDATE attivita SET ${fields.join(',')} WHERE id=?`).run(...params);
          return { success: true };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          sqlite.prepare('DELETE FROM competenze WHERE attivitaId = ?').run(input.id);
          sqlite.prepare('DELETE FROM attivita WHERE id = ?').run(input.id);
          return { success: true };
        }),
    }),
    competenze: router({
      create: publicProcedure
        .input(z.object({ dipendenteId: z.number(), attivitaId: z.number() }))
        .mutation(({ input }) => {
          const result = sqlite.prepare('INSERT INTO competenze (dipendenteId, attivitaId) VALUES (?, ?)').run(input.dipendenteId, input.attivitaId);
          return { success: true, id: result.lastInsertRowid };
        }),
      delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => {
          sqlite.prepare('DELETE FROM competenze WHERE id = ?').run(input.id);
          return { success: true };
        }),
      getAll: publicProcedure.query(() => {
        return sqlite.prepare(`
          SELECT comp.id, comp.dipendenteId, d.nome as dipendenteNome,
            comp.attivitaId, a.nome as attivitaNome
          FROM competenze comp
          LEFT JOIN dipendenti d ON comp.dipendenteId = d.id
          LEFT JOIN attivita a ON comp.attivitaId = a.id
        `).all();
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

app.get('/api/health', (req, res) => res.json({ ok: true }));

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
  console.log(`[DMB] Server avviato sulla porta ${PORT}`);
  console.log(`[DMB] Database: ${DB_PATH}`);
  console.log(`[DMB] Frontend: ${STATIC_DIR}`);
});
