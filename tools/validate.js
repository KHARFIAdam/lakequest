#!/usr/bin/env node
/* LakeQuest — contrôle du contenu.  Usage : node tools/validate.js
   Charge les fichiers de js/data/ comme le fait le navigateur et vérifie leur cohérence :
   identifiants uniques, tâches et missions existantes, forme des questions, renvois vers les fiches,
   composition des examens blancs, flux, chantiers, blitz. Code de sortie 1 s'il y a une erreur. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script src="(js\/data\/[^"]+)"/g)].map((m) => m[1]);
const box = {}; box.window = box;
vm.createContext(box);
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), box, { filename: f }));
const LQ = box.LQ;

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const dup = (list, what) => { const seen = new Set(); list.forEach((x) => { if (seen.has(x.id)) err(what + ' en double : ' + x.id); seen.add(x.id); }); return seen; };

const topicIds = dup(LQ.topics, 'mission');
const cardIds = dup(LQ.cards || [], 'fiche');
const flowIds = dup(LQ.flows || [], 'flux');
dup(LQ.duels || [], 'duel');
dup(LQ.scenarios || [], 'chantier');
dup(LQ.questions, 'question');

/* ── questions ── */
const perTopic = {}, perForm = { A: {}, B: {}, C: {} }, perDomain = {};
let mr = 0, longest = 0, single = 0;
LQ.questions.forEach((q) => {
  const w = 'question ' + q.id + ' : ';
  if (!LQ.tasks[q.ts]) err(w + 'tâche inconnue ' + q.ts);
  if (!topicIds.has(q.t)) err(w + 'mission inconnue ' + q.t);
  if (!q.q || !q.e) err(w + 'énoncé ou explication manquant');
  if (!Array.isArray(q.o) || !Array.isArray(q.a)) return err(w + 'options ou réponses manquantes');
  if (q.a.some((i) => i < 0 || i >= q.o.length) || new Set(q.a).size !== q.a.length) err(w + 'index de réponse invalide');
  if (new Set(q.o).size !== q.o.length) err(w + 'deux options identiques');
  if (q.k === 'mr') {
    mr++;
    if (q.o.length < 5) err(w + 'une question à réponses multiples doit avoir au moins 5 options');
    if (q.a.length < 2) err(w + 'une question à réponses multiples doit avoir au moins 2 bonnes réponses');
    const word = { 2: 'TWO', 3: 'THREE' }[q.a.length];
    if (!word || !q.q.includes('(Select ' + word + '.)')) err(w + 'l\'énoncé doit se terminer par (Select ' + (word || '?') + '.)');
  } else {
    single++;
    if (q.o.length !== 4) err(w + 'une question à réponse unique doit avoir 4 options');
    if (q.a.length !== 1) err(w + 'une question à réponse unique doit avoir 1 bonne réponse');
    if (/\(Select /.test(q.q)) err(w + 'mention (Select …) sur une question à réponse unique');
    const L = q.o.map((x) => x.length);
    if (L[q.a[0]] === Math.max(...L) && L.filter((n) => n === Math.max(...L)).length === 1) longest++;
  }
  (q.r || []).forEach((c) => { if (!cardIds.has(c)) err(w + 'fiche inconnue ' + c); });
  if (!q.r || !q.r.length) warn(w + 'aucune fiche liée');
  const d = +String(q.ts)[0];
  if (q.x) {
    if (!perForm[q.x]) err(w + 'examen inconnu ' + q.x);
    else perForm[q.x][d] = (perForm[q.x][d] || 0) + 1;
  } else {
    perTopic[q.t] = (perTopic[q.t] || 0) + 1;
    perDomain[d] = (perDomain[d] || 0) + 1;
    const td = LQ.topics.find((t) => t.id === q.t);
    if (td && td.d !== d) warn(w + 'tâche du domaine ' + d + ' dans une mission du domaine ' + td.d);
  }
});
LQ.topics.forEach((t) => {
  if ((perTopic[t.id] || 0) < 8) err('mission ' + t.id + ' : ' + (perTopic[t.id] || 0) + ' question(s) d\'entraînement, il en faut au moins 8');
  (t.flows || []).forEach((f) => { if (!flowIds.has(f)) err('mission ' + t.id + ' : flux inconnu ' + f); });
  (t.cards || []).forEach((c) => { if (!cardIds.has(c)) err('mission ' + t.id + ' : fiche inconnue ' + c); });
});
const SPLIT = { 1: 22, 2: 17, 3: 14, 4: 12 };
['A', 'B', 'C'].forEach((f) => {
  const got = perForm[f], n = Object.values(got).reduce((a, b) => a + b, 0);
  if (!n) return warn('examen ' + f + ' : aucune question');
  Object.keys(SPLIT).forEach((d) => { if ((got[d] || 0) !== SPLIT[d]) err('examen ' + f + ' : domaine ' + d + ' = ' + (got[d] || 0) + ' question(s), attendu ' + SPLIT[d]); });
});
if (single && longest / single > 0.4) warn('la bonne réponse est l\'option la plus longue dans ' + Math.round(100 * longest / single) + ' % des questions : rééquilibrer');

/* ── flux ── */
(LQ.flows || []).forEach((f) => {
  const w = 'flux ' + f.id + ' : ';
  const ids = new Set((f.actors || []).map((a) => a.id));
  if (!LQ.domains.some((d) => d.id === f.d)) err(w + 'domaine invalide');
  (f.actors || []).forEach((a) => {
    if (a.label.length > 15) warn(w + 'libellé long « ' + a.label + ' »');
    if (a.x < 100 || a.x > 660 || a.y < 40 || a.y > (f.h || 440) - 40) warn(w + 'acteur ' + a.id + ' proche du bord');
  });
  (f.links || []).forEach((l) => { if (!ids.has(l[0]) || !ids.has(l[1])) err(w + 'lien vers un acteur inconnu ' + l.join('→')); });
  if (!f.events || f.events.length < 4 || f.events.length > 8) err(w + 'un flux compte 4 à 8 étapes');
  (f.events || []).forEach((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) err(w + 'étape ' + (i + 1) + ' : acteur inconnu');
    if (!e.title || !e.text || !e.label) err(w + 'étape ' + (i + 1) + ' : titre, texte ou libellé manquant');
    Object.keys(e.state || {}).forEach((k) => { if (!ids.has(k)) err(w + 'étape ' + (i + 1) + ' : état sur un acteur inconnu ' + k); });
  });
  (f.topics || []).forEach((t) => { if (!topicIds.has(t)) err(w + 'mission inconnue ' + t); });
  (f.cards || []).forEach((c) => { if (!cardIds.has(c)) err(w + 'fiche inconnue ' + c); });
  if (!(f.topics || []).some((t) => (perTopic[t] || 0) >= 3)) err(w + 'pas assez de questions pour le quiz de validation');
});

/* ── codex ── */
(LQ.cards || []).forEach((c) => {
  if (!c.n || !c.s || !c.c || !c.tag || !(c.use || []).length) err('fiche ' + c.id + ' : champ manquant');
});
(LQ.duels || []).forEach((d) => {
  (d.rows || []).forEach((r) => { if (r.length !== d.cols.length) err('duel ' + d.id + ' : ligne de ' + r.length + ' cellules pour ' + d.cols.length + ' colonnes'); });
  (d.cards || []).forEach((c) => { if (!cardIds.has(c)) err('duel ' + d.id + ' : fiche inconnue ' + c); });
});
const gl = new Set();
(LQ.glossary || []).forEach((g) => { const k = g.t.toLowerCase(); if (gl.has(k)) err('décodeur : terme en double ' + g.t); gl.add(k); if (!g.fr || !g.hint) err('décodeur : ' + g.t + ' incomplet'); });

/* ── chantiers ── */
(LQ.scenarios || []).forEach((s) => {
  if (!s.slots || s.slots.length < 3) err('chantier ' + s.id + ' : au moins 3 choix');
  (s.slots || []).forEach((sl, i) => {
    if (!sl.o || sl.o.length < 3 || sl.a < 0 || sl.a >= sl.o.length || !sl.e) err('chantier ' + s.id + ' : choix ' + (i + 1) + ' invalide');
  });
});

/* ── blitz ── */
const groups = {};
((LQ.blitz || {}).services || []).forEach((c) => { (groups[c.g] = groups[c.g] || new Set()).add(c.a); });
Object.keys(groups).forEach((g) => { if (groups[g].size < 4) err('blitz : le groupe ' + g + ' n\'a que ' + groups[g].size + ' réponses distinctes (4 au minimum)'); });
((LQ.blitz || {}).tf || []).forEach((t, i) => { if (typeof t.v !== 'boolean' || !t.s || !t.w) err('blitz vrai/faux n° ' + (i + 1) + ' invalide'); });

/* ── bilan ── */
const count = (o) => Object.keys(o).sort().map((k) => k + ':' + o[k]).join('  ');
console.log('Questions d\'entraînement : ' + Object.values(perTopic).reduce((a, b) => a + b, 0) + '   par domaine  ' + count(perDomain));
console.log('Examen A : ' + count(perForm.A) + '   Examen B : ' + count(perForm.B) + '   Examen C : ' + count(perForm.C));
console.log('Réponses multiples : ' + mr + '   Bonne réponse = option la plus longue : ' + longest + ' / ' + single);
console.log('Flux : ' + (LQ.flows || []).length + '   Fiches : ' + (LQ.cards || []).length + '   Duels : ' + (LQ.duels || []).length + '   Décodeur : ' + (LQ.glossary || []).length + '   Chantiers : ' + (LQ.scenarios || []).length + '   Blitz : ' + ((LQ.blitz || {}).services || []).length + ' indices, ' + ((LQ.blitz || {}).tf || []).length + ' vrai/faux');
warns.forEach((w) => console.log('  attention  ' + w));
errors.forEach((e) => console.log('  ERREUR     ' + e));
console.log(errors.length ? '\n' + errors.length + ' erreur(s).' : '\nContenu valide.');
process.exit(errors.length ? 1 : 0);
