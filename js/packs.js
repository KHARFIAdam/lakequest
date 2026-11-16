/* LakeQuest — paquets personnels : des questions que tu importes toi-même depuis un fichier CSV.
   Elles sont enregistrées dans ce navigateur uniquement (jamais dans le dépôt ni sur le site publié),
   ce qui permet d'y mettre des questions d'un cours ou d'un livre que tu possèdes, pour ton usage privé.

   Colonnes attendues (la première ligne du CSV porte les noms) :
     test, question_no, type, domain, question, option_A … option_F, correct_answer (ex. "C" ou "B,D"),
     explanation, feedback_A … feedback_F (facultatif : le commentaire de chaque option).
   Chaque valeur de `test` devient un examen blanc personnel. Ses questions rejoignent la révision
   et les examens aléatoires après le premier passage, comme pour les examens A, B et C. */
(function () {
  const LQ = window.LQ;
  LQ.changes = LQ.changes || {}; LQ.actions = LQ.actions || {};
  const KEY = 'lakequest.packs.v1';
  const DOM = { 'data ingestion and transformation': ['1.1', 'ingest'], 'data store management': ['2.1', 's3'], 'data operations and support': ['3.1', 'automation'], 'data security and governance': ['4.1', 'authn'] };
  const L = ['A', 'B', 'C', 'D', 'E', 'F'];
  let store = {};   // id -> question

  /* Lecture CSV (guillemets, virgules et retours à la ligne dans les champs). */
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  function toQuestions(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return { qs: [], skipped: 0, error: 'Fichier vide.' };
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (n) => head.indexOf(n);
    if (col('question') < 0 || col('correct_answer') < 0 || col('option_a') < 0) return { qs: [], skipped: 0, error: 'Colonnes introuvables : il faut au moins question, option_A… et correct_answer.' };
    const get = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
    const qs = []; let skipped = 0;
    rows.slice(1).forEach((r, k) => {
      const o = [], fo = [], map = {};
      L.forEach((l) => { const v = get(r, 'option_' + l.toLowerCase()); if (v) { map[l] = o.length; o.push(v); fo.push(get(r, 'feedback_' + l.toLowerCase())); } });
      const a = get(r, 'correct_answer').toUpperCase().split(/[^A-F]+/).filter(Boolean).map((l) => map[l]).filter((i) => i !== undefined);
      const stem = get(r, 'question');
      if (!stem || o.length < 2 || !a.length) { skipped++; return; }
      const test = (get(r, 'test') || '1').replace(/[^\w]/g, '') || '1';
      const d = DOM[get(r, 'domain').toLowerCase()] || DOM['data ingestion and transformation'];
      const q = { id: 'p' + test + '-' + (get(r, 'question_no') || k + 1), x: 'P' + test, ts: d[0], t: d[1], q: stem, o: o, a: a, e: get(r, 'explanation') || 'Pas d’explication dans le fichier.', r: [], perso: 1 };
      if (a.length > 1) q.k = 'mr';
      if (fo.some(Boolean)) q.fo = fo;
      qs.push(q);
    });
    return { qs: qs, skipped: skipped };
  }

  function persist() {
    try { window.localStorage.setItem(KEY, JSON.stringify(Object.values(store))); return true; } catch (e) { return false; }
  }

  LQ.packs = {
    /* Appelé au démarrage, avant l'indexation : ajoute les questions importées à la banque. */
    load() {
      let list = [];
      try { list = JSON.parse(window.localStorage.getItem(KEY) || '[]') || []; } catch (e) { list = []; }
      store = {};
      list.forEach((q) => { if (q && q.id && q.q && q.o && q.a) store[q.id] = q; });
      LQ.questions = (LQ.questions || []).filter((q) => !q.perso).concat(Object.values(store));
    },
    forms() {
      const m = {};
      Object.values(store).forEach((q) => { m[q.x] = (m[q.x] || 0) + 1; });
      return Object.keys(m).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((f) => ({ f: f, n: m[f], label: 'Test ' + f.slice(1) }));
    },
    count() { return Object.keys(store).length; },
    add(text) {
      const res = toQuestions(text);
      if (res.error) return res;
      let added = 0;
      res.qs.forEach((q) => { if (!store[q.id]) added++; store[q.id] = q; });
      res.added = added;
      res.saved = persist();
      if (!res.saved) { res.error = 'Le navigateur a refusé l’enregistrement (stockage plein ou désactivé). Importe moins de questions à la fois.'; }
      LQ.packs.load(); LQ.initData();
      return res;
    },
    clear() {
      store = {};
      try { window.localStorage.removeItem(KEY); } catch (e) { /* rien à faire */ }
      LQ.packs.load(); LQ.initData();
    },
  };

  /* Interface : sélection de fichiers et suppression, depuis l'écran Profil. */
  LQ.changes['pack-file'] = (el) => {
    const files = Array.from(el.files || []);
    if (!files.length) return;
    let done = 0, added = 0, skipped = 0, err = '';
    files.forEach((f) => {
      const rd = new FileReader();
      rd.onload = () => {
        const res = LQ.packs.add(String(rd.result || ''));
        if (res.error) err = res.error; else { added += res.added; skipped += res.skipped; }
        if (++done === files.length) {
          el.value = '';
          LQ.toast(err ? LQ.esc(err) : '<strong>' + added + ' question' + (added > 1 ? 's' : '') + ' importée' + (added > 1 ? 's' : '') + '</strong>' + (skipped ? ' · ' + skipped + ' ligne(s) ignorée(s)' : ''), err ? 'ko' : '', 'check');
          LQ.route();
        }
      };
      rd.onerror = () => { err = 'Lecture du fichier impossible.'; if (++done === files.length) { LQ.toast(LQ.esc(err), 'ko'); } };
      rd.readAsText(f);
    });
  };
  LQ.actions['pack-clear'] = () => {
    LQ.modal({ title: 'Supprimer les questions importées ?', html: '<p>Les ' + LQ.packs.count() + ' questions personnelles seront retirées de ce navigateur. Ta progression sur le reste du jeu n’est pas touchée.</p>', actions: [{ id: 'no', label: 'Annuler' }, { id: 'yes', label: 'Supprimer', kind: 'danger' }] })
      .then((r) => { if (r === 'yes') { LQ.packs.clear(); LQ.toast('Questions personnelles supprimées.'); LQ.route(); } });
  };
  LQ.packs.panelHTML = () => {
    const n = LQ.packs.count(), forms = LQ.packs.forms();
    return '<h2 class="sec-title">Questions personnelles</h2><div class="card pad"><p class="small">Importe tes propres questions depuis un fichier CSV (un cours ou des annales que tu possèdes). Elles restent <strong>dans ce navigateur uniquement</strong> : rien n’est envoyé ni publié. Chaque test devient un examen blanc sur la page Examen.</p>' +
      '<p class="small">' + (n ? '<strong>' + n + ' questions</strong> importées, en ' + forms.length + ' test' + (forms.length > 1 ? 's' : '') + ' : ' + forms.map((f) => f.label + ' (' + f.n + ')').join(', ') + '.' : 'Aucune question importée pour l’instant.') + '</p>' +
      '<div class="row"><label class="btn primary">Importer des fichiers CSV<input type="file" accept=".csv,text/csv" multiple data-change="pack-file" hidden></label>' +
      (n ? '<button type="button" class="btn danger" data-act="pack-clear">Tout supprimer</button>' : '') + '</div>' +
      '<p class="small muted">Colonnes : test, question_no, type, domain, question, option_A à option_F, correct_answer, explanation, feedback_A à feedback_F.</p></div>';
  };
})();
