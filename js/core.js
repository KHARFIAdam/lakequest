/* LakeQuest — coeur : utilitaires, sauvegarde, progression, trophées, effets.
   Tout vit dans l'objet global LQ pour que le site fonctionne sans outil de build,
   y compris en ouvrant index.html directement depuis le disque. */
(function () {
  'use strict';
  const LQ = (window.LQ = window.LQ || {});
  LQ.APP = { name: 'LakeQuest', version: '1.0.0', saveKey: 'lakequest.save.v1' };

  /* ------------------------------------------------------------------ utilitaires */
  const DAY = 86400000;
  LQ.DAY = DAY;
  LQ.$ = (sel, root) => (root || document).querySelector(sel);
  LQ.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  LQ.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  /* Texte enrichi minimal : `code`, **gras**, retours à la ligne. Toujours échappé d'abord. */
  LQ.rich = (s) =>
    LQ.esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  /* Énoncés et options : seul le `code` est mis en forme, le reste est affiché tel quel. */
  LQ.code = (s) => LQ.esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  LQ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  LQ.pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  LQ.dayKey = (d) => {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  LQ.addDays = (key, n) => {
    const p = key.split('-').map(Number);
    return LQ.dayKey(new Date(p[0], p[1] - 1, p[2] + n));
  };
  LQ.daysUntil = (key) => {
    if (!key) return null;
    const p = key.split('-').map(Number);
    const t = new Date(p[0], p[1] - 1, p[2]).getTime();
    const n = new Date();
    const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    return Math.round((t - t0) / DAY);
  };
  LQ.fmtClock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  };
  LQ.fmtDur = (sec) => {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h ? h + ' h ' + String(m).padStart(2, '0') : m + ' min';
  };
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  LQ.fmtDate = (ts) => {
    const d = new Date(ts);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  LQ.fmtDayKey = (key) => {
    const p = key.split('-').map(Number);
    return p[2] + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
  };
  LQ.hashStr = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  LQ.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  LQ.shuffle = (arr, rnd) => {
    rnd = rnd || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  LQ.plural = (n, one, many) => n + ' ' + (n > 1 ? many || one + 's' : one);

  /* ------------------------------------------------------------------ icônes (tracés originaux, 24 x 24) */
  const IC = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    next: '<path d="M6 5v14l10-7z" fill="currentColor"/><path d="M19 5v14"/>',
    prev: '<path d="M18 5v14L8 12z" fill="currentColor"/><path d="M5 5v14"/>',
    restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4 4v4.5h4.5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.2A3.3 3.3 0 0 0 8 10.4M16 6h3.5v1.2a3.3 3.3 0 0 1-3.5 3.2"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor" stroke-linejoin="round"/>',
    starOff: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" stroke-linejoin="round"/>',
    flame: '<path d="M12 3c.6 3.2 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 .8-3.3 2-4.5.1 1.8.8 2.8 1.8 3C11.6 8.2 10.8 5.6 12 3z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.2 3.7L17 12H6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    book: '<path d="M5 4.5h10.5a2.5 2.5 0 0 1 2.5 2.5v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18"/><path d="M9 8.5h5"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    bolt: '<path d="M13 2.5L5.5 13.5H11l-1 8L17.5 10.5H12z" stroke-linejoin="round"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    repeat: '<path d="M5 10a7 7 0 0 1 12.5-3.5L20 9"/><path d="M20 4.5V9h-4.5"/><path d="M19 14a7 7 0 0 1-12.5 3.5L4 15"/><path d="M4 19.5V15h4.5"/>',
    layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5"/><path d="M3.5 16l8.5 4.5 8.5-4.5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    chart: '<path d="M3.5 20.5h17"/><path d="M6.5 20v-7M11 20V5.5M15.5 20v-10M20 20v-4"/>',
    gear: '<circle cx="12" cy="12" r="3.4"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 15.5h-1v-11h11v1"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 3.5l3.5 5.5 3.5-5.5"/><path d="M12 12.4v4.2"/>',
    shield: '<path d="M12 3.5l7.5 2.8v5.4c0 4.4-3.1 7.5-7.5 8.8-4.4-1.3-7.5-4.4-7.5-8.8V6.3z"/>',
    drop: '<path d="M12 3.5c3 4 5.5 6.800 5.500 10a5.500 5.500 0 0 1-11 0c0-3.200 2.500-6 5.500-10z"/>',
    wave: '<path d="M3 9c2.200 0 2.200 2 4.500 2S9.800 9 12 9s2.200 2 4.500 2S18.800 9 21 9"/><path d="M3 15c2.200 0 2.200 2 4.500 2s2.300-2 4.500-2 2.200 2 4.500 2 2.300-2 4.500-2"/>',
    list: '<path d="M8.500 6.500h11M8.500 12h11M8.500 17.500h11"/><circle cx="4.800" cy="6.500" r=".9" fill="currentColor"/><circle cx="4.800" cy="12" r=".9" fill="currentColor"/><circle cx="4.800" cy="17.500" r=".9" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500"/>',
    sound: '<path d="M4.500 9.500v5h3.500l4.500 4v-13l-4.500 4z"/><path d="M16 9a4.500 4.500 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
    fish: '<path d="M3 12c3.200-4.600 9.800-5.600 14-2.300L21 6.500v11l-4-3.200c-4.200 3.300-10.800 2.300-14-2.300z" stroke-linejoin="round"/><circle cx="8" cy="11" r=".9" fill="currentColor"/>',
    seq: '<path d="M6 4v16M18 4v16"/><path d="M6 8.500h11M14.500 6l2.500 2.500-2.500 2.500"/><path d="M18 15.500H7M9.500 13L7 15.500 9.500 18"/>',
    net: '<rect x="3" y="9" width="6" height="6" rx="1.500"/><rect x="15" y="3.500" width="6" height="6" rx="1.500"/><rect x="15" y="14.500" width="6" height="6" rx="1.500"/><path d="M9 12h3.500M12.500 12V6.500H15M12.500 12v5.500H15"/>',
    ext: '<path d="M13.500 5H19v5.500"/><path d="M19 5l-8 8"/><path d="M17 14v4.500H5.500V7H10"/>',
  };
  LQ.icon = (name, cls) =>
    '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    (IC[name] || IC.info) + '</svg>';

  /* ------------------------------------------------------------------ sauvegarde */
  const mem = {};
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { mem[k] = v; return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* stockage indisponible */ } delete mem[k]; },
  };
  LQ.store = store;

  function fresh() {
    return {
      v: 1, created: Date.now(), name: '', examDate: '',
      settings: { esl: true, goal: 20, sound: false, fx: true, theme: 'auto', onboarded: false },
      xp: 0,
      q: {},          // id -> { n, ok, box, due, last, lastOk, wr }
      missions: {},   // topic -> { best, stars, plays }
      boss: {},       // domaine -> { best, won, plays }
      flows: {},      // id -> { step, done }
      scen: {},       // id -> { best, perfect, plays }
      exams: [],      // historique des examens blancs
      forms: {},      // 'A' | 'B' -> { first, best, tries, ts }
      examRun: null,  // examen en cours (persisté pour survivre à un rechargement)
      blitz: { best: {}, plays: 0, maxCombo: 0 },
      daily: { done: {}, count: 0 },
      days: {},       // 'AAAA-MM-JJ' -> { xp, q, ok }
      streak: { cur: 0, best: 0, last: '' },
      trophies: {},   // id -> horodatage
      cnt: { answered: 0, correct: 0, run: 0, bestRun: 0, reviewFixed: 0, gloss: 0, night: 0, early: 0, nemesis: 0, flagger: 0, lastMinute: 0, examDay: 0, cards: {}, duels: {} },
    };
  }
  LQ.fresh = fresh;

  function merge(base, extra) {
    Object.keys(extra || {}).forEach((k) => {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], v);
      else base[k] = v;
    });
    return base;
  }

  LQ.load = () => {
    let s = fresh();
    const raw = store.get(LQ.APP.saveKey);
    if (raw) {
      try { s = merge(fresh(), JSON.parse(raw)); } catch (e) { s = fresh(); }
    }
    LQ.S = s;
    return s;
  };
  LQ.save = () => {
    try { return store.set(LQ.APP.saveKey, JSON.stringify(LQ.S)); } catch (e) { return false; }
  };
  LQ.exportSave = () => {
    const json = JSON.stringify(LQ.S);
    try { return 'LQ1.' + btoa(unescape(encodeURIComponent(json))); } catch (e) { return 'LQ1.' + btoa(json); }
  };
  LQ.importSave = (text) => {
    const t = String(text || '').trim();
    if (t.indexOf('LQ1.') !== 0) return false;
    try {
      const json = decodeURIComponent(escape(atob(t.slice(4))));
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== 'object' || typeof obj.xp !== 'number') return false;
      LQ.S = merge(fresh(), obj);
      LQ.save();
      return true;
    } catch (e) { return false; }
  };
  LQ.resetSave = () => { store.del(LQ.APP.saveKey); LQ.S = fresh(); LQ.save(); };

  /* ------------------------------------------------------------------ index des données */
  LQ.initData = () => {
    LQ.questions = LQ.questions || [];
    LQ.flows = LQ.flows || [];
    LQ.cards = LQ.cards || [];
    LQ.duels = LQ.duels || [];
    LQ.glossary = LQ.glossary || [];
    LQ.scenarios = LQ.scenarios || [];
    LQ.blitz = LQ.blitz || { services: [], tf: [] };
    LQ.Q = {}; LQ.byTopic = {}; LQ.byDomain = { 1: [], 2: [], 3: [], 4: [] };
    LQ.questions.forEach((q) => {
      q.d = +String(q.ts)[0];
      q.k = q.k || 'mc';
      LQ.Q[q.id] = q;
      (LQ.byTopic[q.t] = LQ.byTopic[q.t] || []).push(q);
      if (LQ.byDomain[q.d]) LQ.byDomain[q.d].push(q);
    });
    const idx = (arr) => arr.reduce((m, x) => ((m[x.id] = x), m), {});
    LQ.topicMap = idx(LQ.topics || []);
    LQ.cardMap = idx(LQ.cards);
    LQ.flowMap = idx(LQ.flows);
    LQ.duelMap = idx(LQ.duels);
    LQ.scenMap = idx(LQ.scenarios);
    LQ.domainMap = idx(LQ.domains || []);
    /* fiches liées à chaque question -> questions liées à chaque fiche */
    LQ.cardQs = {};
    LQ.questions.forEach((q) => (q.r || []).forEach((c) => (LQ.cardQs[c] = LQ.cardQs[c] || []).push(q)));
  };

  /* Une question réservée à un examen blanc (x: 'A' ou 'B') n'entre dans l'entraînement
     qu'après le premier passage de cet examen : c'est ce qui garde les examens inédits. */
  LQ.isOpen = (q) => !q.x || !!(LQ.S.forms[q.x] && LQ.S.forms[q.x].tries);
  LQ.openQs = (list) => (list || LQ.questions).filter(LQ.isOpen);
  LQ.trainQs = (topic) => (LQ.byTopic[topic] || []).filter((q) => !q.x);

  LQ.statOf = (list) => {
    const r = { total: list.length, seen: 0, ok: 0, mastered: 0, n: 0, right: 0 };
    list.forEach((q) => {
      const s = LQ.S.q[q.id];
      if (!s || !s.n) return;
      r.seen++; r.n += s.n; r.right += s.ok;
      if (s.lastOk) r.ok++;
      if (s.box >= 2) r.mastered++;
    });
    return r;
  };
  LQ.domainStat = (d) => LQ.statOf(LQ.openQs(LQ.byDomain[d] || []));
  LQ.topicStat = (t) => LQ.statOf(LQ.openQs(LQ.byTopic[t] || []));
  LQ.readiness = () => {
    let r = 0;
    (LQ.domains || []).forEach((d) => {
      const st = LQ.domainStat(d.id);
      r += d.w * (st.total ? st.ok / st.total : 0);
    });
    return Math.round(r);
  };
  LQ.totalStars = () => (LQ.topics || []).reduce((a, t) => a + ((LQ.S.missions[t.id] || {}).stars || 0), 0);
  LQ.dueList = () => {
    const now = Date.now();
    return LQ.openQs()
      .filter((q) => { const s = LQ.S.q[q.id]; return s && s.n && s.due <= now && s.box < 5; })
      .sort((a, b) => LQ.S.q[a.id].box - LQ.S.q[b.id].box || LQ.S.q[a.id].due - LQ.S.q[b.id].due);
  };

  /* ------------------------------------------------------------------ niveaux, série, XP */
  const LEVELS = [
    [0, 'Alevin'], [120, 'Vairon'], [300, 'Goujon'], [550, 'Ablette'], [900, 'Gardon'], [1400, 'Perche'], [2000, 'Carpe'],
    [2800, 'Truite'], [3800, 'Sandre'], [5000, 'Brochet'], [6500, 'Silure'], [8500, 'Esturgeon'], [11000, 'Monstre du lac'],
  ];
  LQ.LEVELS = LEVELS;
  LQ.level = (xp) => {
    xp = xp == null ? LQ.S.xp : xp;
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
    const cur = LEVELS[i][0], nxt = i + 1 < LEVELS.length ? LEVELS[i + 1][0] : null;
    return { lvl: i + 1, title: LEVELS[i][1], cur, next: nxt, pct: nxt ? Math.round((100 * (xp - cur)) / (nxt - cur)) : 100, max: nxt == null };
  };
  function dayRec() {
    const k = LQ.dayKey();
    return LQ.S.days[k] || (LQ.S.days[k] = { xp: 0, q: 0, ok: 0 });
  }
  LQ.today = () => LQ.S.days[LQ.dayKey()] || { xp: 0, q: 0, ok: 0 };
  LQ.streakNow = () => {
    const st = LQ.S.streak, t = LQ.dayKey();
    return st.last === t || st.last === LQ.addDays(t, -1) ? st.cur : 0;
  };
  function touchDay() {
    const st = LQ.S.streak, t = LQ.dayKey();
    if (st.last === t) return;
    st.cur = st.last === LQ.addDays(t, -1) ? st.cur + 1 : 1;
    st.last = t;
    st.best = Math.max(st.best, st.cur);
  }
  LQ.addXp = (n) => {
    n = Math.round(n || 0);
    if (n <= 0) return;
    const before = LQ.level().lvl;
    LQ.S.xp += n;
    dayRec().xp += n;
    touchDay();
    const after = LQ.level();
    LQ.save();
    if (after.lvl > before) {
      LQ.toast('<strong>Niveau ' + after.lvl + '</strong> · tu deviens ' + LQ.esc(after.title), 'level', 'fish');
      LQ.confetti(); LQ.sfx('trophy');
    }
    LQ.refreshChrome();
  };

  const BOX_DAYS = [0, 1, 3, 7, 14, 30];
  LQ.BOX_LABEL = ['À revoir', 'Demain', '3 jours', '1 semaine', '2 semaines', 'Acquise'];
  /* Enregistre une réponse : statistiques par question, boîte de Leitner, compteurs. */
  LQ.recordAnswer = (q, ok) => {
    const S = LQ.S, now = Date.now();
    const st = S.q[q.id] || (S.q[q.id] = { n: 0, ok: 0, box: 0, due: 0, last: 0, lastOk: false, wr: 0 });
    const firstOk = ok && st.ok === 0;
    const fixed = ok && st.n > 0 && !st.lastOk;
    if (ok && (st.wr || 0) >= 3 && !st.lastOk) S.cnt.nemesis = 1;
    st.n++; st.last = now; st.lastOk = !!ok;
    if (ok) { st.ok++; st.box = Math.min(5, st.box + 1); st.due = now + BOX_DAYS[st.box] * DAY; }
    else { st.wr = (st.wr || 0) + 1; st.box = 0; st.due = now + 10 * 60000; }
    S.cnt.answered++;
    if (ok) { S.cnt.correct++; S.cnt.run++; S.cnt.bestRun = Math.max(S.cnt.bestRun, S.cnt.run); } else S.cnt.run = 0;
    const d = dayRec(); d.q++; if (ok) d.ok++;
    const h = new Date().getHours();
    if (h < 5) S.cnt.night = 1; else if (h < 7) S.cnt.early = 1;
    return { firstOk, fixed };
  };

  /* ------------------------------------------------------------------ complétion (profondeur du lac) */
  LQ.completion = () => {
    const S = LQ.S;
    const tro = LQ.TROPHIES.filter((t) => t.g !== 'p');
    const parts = [
      { k: 'missions', label: 'Étoiles de mission', cur: LQ.totalStars(), max: (LQ.topics || []).length * 3, w: 25, to: 'jouer' },
      { k: 'bank', label: 'Questions maîtrisées', cur: LQ.questions.filter((q) => (S.q[q.id] || {}).box >= 2).length, max: LQ.questions.length, w: 25, to: 'revision' },
      { k: 'flows', label: 'Flux animés validés', cur: LQ.flows.filter((f) => (S.flows[f.id] || {}).done).length, max: LQ.flows.length, w: 15, to: 'explorer' },
      { k: 'exams', label: 'Examens A et B réussis', cur: ['A', 'B'].filter((f) => (S.forms[f] || {}).best >= 720).length, max: 2, w: 10, to: 'examen' },
      { k: 'scen', label: 'Chantiers sans erreur', cur: LQ.scenarios.filter((s) => (S.scen[s.id] || {}).perfect).length, max: LQ.scenarios.length, w: 10, to: 'chantier' },
      { k: 'boss', label: 'Gardiens vaincus', cur: (LQ.domains || []).filter((d) => (S.boss[d.id] || {}).won).length, max: (LQ.domains || []).length, w: 5, to: 'jouer' },
      { k: 'trophies', label: 'Trophées', cur: tro.filter((t) => S.trophies[t.id]).length, max: tro.length, w: 10, to: 'trophees' },
    ];
    let total = 0;
    parts.forEach((p) => { total += p.max ? (p.w * p.cur) / p.max : 0; });
    return { total: Math.min(100, Math.round(total * 10) / 10), parts };
  };

  /* ------------------------------------------------------------------ trophées */
  const S_ = () => LQ.S;
  const fullStrict = () => S_().exams.filter((e) => e.mode === 'full' && e.strict);
  const domMastery = (d) => { const st = LQ.statOf((LQ.byDomain[d] || []).filter((q) => !q.x)); return [st.ok, Math.ceil(st.total * 0.8)]; };
  const count = (obj) => Object.keys(obj || {}).length;
  LQ.TROPHIES = [
    /* bronze */
    { id: 'first-drop', g: 'b', ic: 'drop', n: 'Première goutte', d: 'Répondre à ta première question.', t: () => S_().cnt.answered >= 1 },
    { id: 'first-fish', g: 'b', ic: 'fish', n: 'Ça mord !', d: 'Donner ta première bonne réponse.', t: () => S_().cnt.correct >= 1 },
    { id: 'first-mission', g: 'b', ic: 'target', n: 'Mise à l’eau', d: 'Terminer une première mission.', t: () => count(S_().missions) >= 1 },
    { id: 'first-flow', g: 'b', ic: 'wave', n: 'Au fil de l’eau', d: 'Valider un premier flux animé.', t: () => LQ.flows.some((f) => (S_().flows[f.id] || {}).done) },
    { id: 'first-exam', g: 'b', ic: 'clock', n: 'Le grand bain', d: 'Terminer un premier examen blanc.', t: () => S_().exams.length >= 1 },
    { id: 'first-daily', g: 'b', ic: 'calendar', n: 'Marée du jour', d: 'Terminer un défi du jour.', t: () => S_().daily.count >= 1 },
    { id: 'first-scen', g: 'b', ic: 'layers', n: 'Premier ouvrage', d: 'Livrer un premier chantier.', t: () => count(S_().scen) >= 1 },
    { id: 'run-5', g: 'b', ic: 'check', n: 'Banc de poissons', d: 'Enchaîner 5 bonnes réponses.', t: () => S_().cnt.bestRun >= 5, p: () => [S_().cnt.bestRun, 5] },
    { id: 'streak-3', g: 'b', ic: 'flame', n: 'Trois jours de pêche', d: 'Jouer 3 jours d’affilée.', t: () => S_().streak.best >= 3, p: () => [S_().streak.best, 3] },
    { id: 'combo-10', g: 'b', ic: 'bolt', n: 'Réflexes de truite', d: 'Atteindre un combo de 10 en blitz.', t: () => S_().blitz.maxCombo >= 10, p: () => [S_().blitz.maxCombo, 10] },
    { id: 'review-10', g: 'b', ic: 'repeat', n: 'Leçon retenue', d: 'Corriger 10 erreurs passées.', t: () => S_().cnt.reviewFixed >= 10, p: () => [S_().cnt.reviewFixed, 10] },
    { id: 'gloss-10', g: 'b', ic: 'search', n: 'Décodeur', d: 'Consulter 10 termes du décodeur d’énoncés.', t: () => S_().cnt.gloss >= 10, p: () => [S_().cnt.gloss, 10] },
    { id: 'cards-10', g: 'b', ic: 'book', n: 'Curieux', d: 'Ouvrir 10 fiches du codex.', t: () => count(S_().cnt.cards) >= 10, p: () => [count(S_().cnt.cards), 10] },
    { id: 'q-100', g: 'b', ic: 'list', n: 'Cent lignes à l’eau', d: 'Répondre à 100 questions.', t: () => S_().cnt.answered >= 100, p: () => [S_().cnt.answered, 100] },
    /* argent */
    { id: 'run-10', g: 's', ic: 'check', n: 'Série de dix', d: 'Enchaîner 10 bonnes réponses.', t: () => S_().cnt.bestRun >= 10, p: () => [S_().cnt.bestRun, 10] },
    { id: 'streak-7', g: 's', ic: 'flame', n: 'Semaine complète', d: 'Jouer 7 jours d’affilée.', t: () => S_().streak.best >= 7, p: () => [S_().streak.best, 7] },
    { id: 'three-stars', g: 's', ic: 'star', n: 'Trois étoiles', d: 'Réussir une mission sans aucune erreur.', t: () => LQ.topics.some((t) => (S_().missions[t.id] || {}).stars === 3) },
    { id: 'stars-30', g: 's', ic: 'star', n: 'Constellation', d: 'Cumuler 30 étoiles de mission.', t: () => LQ.totalStars() >= 30, p: () => [LQ.totalStars(), 30] },
    { id: 'exam-pass', g: 's', ic: 'medal', n: 'Admis', d: 'Réussir un examen blanc complet en conditions réelles (720 ou plus).', t: () => fullStrict().some((e) => e.score >= 720) },
    { id: 'flows-8', g: 's', ic: 'wave', n: 'Hydrologue', d: 'Valider 8 flux animés.', t: () => LQ.flows.filter((f) => (S_().flows[f.id] || {}).done).length >= 8, p: () => [LQ.flows.filter((f) => (S_().flows[f.id] || {}).done).length, 8] },
    { id: 'q-500', g: 's', ic: 'list', n: 'Pêcheur assidu', d: 'Répondre à 500 questions.', t: () => S_().cnt.answered >= 500, p: () => [S_().cnt.answered, 500] },
    { id: 'correct-250', g: 's', ic: 'fish', n: 'Bonne pioche', d: 'Donner 250 bonnes réponses.', t: () => S_().cnt.correct >= 250, p: () => [S_().cnt.correct, 250] },
    { id: 'blitz-300', g: 's', ic: 'bolt', n: 'Éclair', d: 'Marquer 300 points en une partie de blitz.', t: () => Math.max(0, ...Object.values(S_().blitz.best)) >= 300, p: () => [Math.max(0, ...Object.values(S_().blitz.best)), 300] },
    { id: 'daily-7', g: 's', ic: 'calendar', n: 'Sept marées', d: 'Terminer 7 défis du jour.', t: () => S_().daily.count >= 7, p: () => [S_().daily.count, 7] },
    { id: 'boss-1', g: 's', ic: 'shield', n: 'Gardien vaincu', d: 'Battre le gardien d’un domaine.', t: () => LQ.domains.some((d) => (S_().boss[d.id] || {}).won) },
    { id: 'dom-1', g: 's', ic: 'drop', n: 'Maître de l’ingestion', d: 'Avoir juste à 80 % des questions d’entraînement du domaine 1.', t: () => { const p = domMastery(1); return p[1] > 0 && p[0] >= p[1]; }, p: () => domMastery(1) },
    { id: 'dom-2', g: 's', ic: 'layers', n: 'Gardien des réserves', d: 'Avoir juste à 80 % des questions d’entraînement du domaine 2.', t: () => { const p = domMastery(2); return p[1] > 0 && p[0] >= p[1]; }, p: () => domMastery(2) },
    { id: 'dom-3', g: 's', ic: 'chart', n: 'Vigie des pipelines', d: 'Avoir juste à 80 % des questions d’entraînement du domaine 3.', t: () => { const p = domMastery(3); return p[1] > 0 && p[0] >= p[1]; }, p: () => domMastery(3) },
    { id: 'dom-4', g: 's', ic: 'lock', n: 'Maître des clés', d: 'Avoir juste à 80 % des questions d’entraînement du domaine 4.', t: () => { const p = domMastery(4); return p[1] > 0 && p[0] >= p[1]; }, p: () => domMastery(4) },
    { id: 'scen-6', g: 's', ic: 'layers', n: 'Chef de chantier', d: 'Livrer 6 chantiers sans erreur.', t: () => LQ.scenarios.filter((s) => (S_().scen[s.id] || {}).perfect).length >= 6, p: () => [LQ.scenarios.filter((s) => (S_().scen[s.id] || {}).perfect).length, 6] },
    { id: 'half-depth', g: 's', ic: 'compass', n: 'Mi-profondeur', d: 'Atteindre 50 m : la moitié du lac explorée.', t: () => LQ.completion().total >= 50, p: () => [Math.floor(LQ.completion().total), 50] },
    { id: 'comeback', g: 's', ic: 'repeat', h: 1, n: 'Remontada', d: 'Réussir un examen complet après en avoir raté un.', t: () => { const f = fullStrict(); const i = f.findIndex((e) => e.score < 720); return i >= 0 && f.slice(i + 1).some((e) => e.score >= 720); } },
    { id: 'night', g: 's', ic: 'eye', h: 1, n: 'Poisson-lune', d: 'Répondre à une question entre minuit et 5 h.', t: () => !!S_().cnt.night },
    { id: 'early', g: 's', ic: 'eye', h: 1, n: 'Pêche à l’aube', d: 'Répondre à une question avant 7 h du matin.', t: () => !!S_().cnt.early },
    { id: 'flagger', g: 's', ic: 'flag', h: 1, n: 'Prudence', d: 'Marquer 10 questions à revoir dans un même examen.', t: () => !!S_().cnt.flagger },
    { id: 'last-minute', g: 's', ic: 'clock', h: 1, n: 'À la dernière seconde', d: 'Rendre un examen avec moins de 2 minutes au compteur.', t: () => !!S_().cnt.lastMinute },
    { id: 'nemesis', g: 's', ic: 'target', h: 1, n: 'Bête noire', d: 'Réussir enfin une question ratée au moins 3 fois.', t: () => !!S_().cnt.nemesis },
    { id: 'exam-day', g: 's', ic: 'calendar', h: 1, n: 'Jour J', d: 'Ouvrir LakeQuest le jour de ton examen. Bonne chance !', t: () => !!S_().cnt.examDay },
    /* or */
    { id: 'exam-800', g: 'g', ic: 'medal', n: 'Prêt pour le jour J', d: 'Obtenir 800 ou plus à un examen blanc complet en conditions réelles.', t: () => fullStrict().some((e) => e.score >= 800) },
    { id: 'exam-2x', g: 'g', ic: 'medal', n: 'Deux sur deux', d: 'Obtenir 800 ou plus aux examens A et B dès la première tentative.', t: () => ['A', 'B'].every((f) => (S_().forms[f] || {}).first >= 800), p: () => [['A', 'B'].filter((f) => (S_().forms[f] || {}).first >= 800).length, 2] },
    { id: 'exam-900', g: 'g', ic: 'trophy', n: 'Poisson volant', d: 'Obtenir 900 ou plus à un examen blanc complet.', t: () => fullStrict().some((e) => e.score >= 900) },
    { id: 'speedrun', g: 'g', ic: 'bolt', h: 1, n: 'Hors-bord', d: 'Réussir un examen complet en moins de 75 minutes.', t: () => fullStrict().some((e) => e.score >= 720 && e.dur < 75 * 60) },
    { id: 'streak-14', g: 'g', ic: 'flame', n: 'Deux semaines sans relâche', d: 'Jouer 14 jours d’affilée.', t: () => S_().streak.best >= 14, p: () => [S_().streak.best, 14] },
    { id: 'streak-30', g: 'g', ic: 'flame', n: 'Un mois dans le courant', d: 'Jouer 30 jours d’affilée.', t: () => S_().streak.best >= 30, p: () => [S_().streak.best, 30] },
    { id: 'all-stars', g: 'g', ic: 'star', n: 'Ciel étoilé', d: 'Obtenir 3 étoiles sur toutes les missions.', t: () => LQ.totalStars() >= LQ.topics.length * 3, p: () => [LQ.totalStars(), LQ.topics.length * 3] },
    { id: 'all-boss', g: 'g', ic: 'shield', n: 'Les quatre gardiens', d: 'Battre le gardien de chaque domaine.', t: () => LQ.domains.every((d) => (S_().boss[d.id] || {}).won), p: () => [LQ.domains.filter((d) => (S_().boss[d.id] || {}).won).length, 4] },
    { id: 'all-flows', g: 'g', ic: 'wave', n: 'Cartographe du lac', d: 'Valider tous les flux animés.', t: () => LQ.flows.length > 0 && LQ.flows.every((f) => (S_().flows[f.id] || {}).done), p: () => [LQ.flows.filter((f) => (S_().flows[f.id] || {}).done).length, LQ.flows.length] },
    { id: 'all-scen', g: 'g', ic: 'layers', n: 'Maître d’œuvre', d: 'Livrer tous les chantiers sans erreur.', t: () => LQ.scenarios.length > 0 && LQ.scenarios.every((s) => (S_().scen[s.id] || {}).perfect), p: () => [LQ.scenarios.filter((s) => (S_().scen[s.id] || {}).perfect).length, LQ.scenarios.length] },
    { id: 'bank', g: 'g', ic: 'book', n: 'Banque vidée', d: 'Répondre juste au moins une fois à chaque question du jeu.', t: () => LQ.questions.every((q) => (S_().q[q.id] || {}).ok > 0), p: () => [LQ.questions.filter((q) => (S_().q[q.id] || {}).ok > 0).length, LQ.questions.length] },
    { id: 'q-1000', g: 'g', ic: 'list', n: 'Mille questions', d: 'Répondre à 1 000 questions.', t: () => S_().cnt.answered >= 1000, p: () => [S_().cnt.answered, 1000] },
    { id: 'run-25', g: 'g', ic: 'check', n: 'Imperturbable', d: 'Enchaîner 25 bonnes réponses.', t: () => S_().cnt.bestRun >= 25, p: () => [S_().cnt.bestRun, 25] },
    { id: 'combo-30', g: 'g', ic: 'bolt', h: 1, n: 'Torrent', d: 'Atteindre un combo de 30 en blitz.', t: () => S_().blitz.maxCombo >= 30 },
    /* platine */
    { id: 'platinum', g: 'p', ic: 'trophy', n: 'Légende du lac', d: 'Obtenir tous les autres trophées.', t: () => LQ.TROPHIES.every((t) => t.g === 'p' || S_().trophies[t.id]), p: () => [LQ.TROPHIES.filter((t) => t.g !== 'p' && S_().trophies[t.id]).length, LQ.TROPHIES.length - 1] },
  ];
  LQ.GRADE = { b: { n: 'Bronze', xp: 20 }, s: { n: 'Argent', xp: 50 }, g: { n: 'Or', xp: 120 }, p: { n: 'Platine', xp: 500 } };

  let checking = false;
  LQ.checkTrophies = () => {
    if (checking) return;
    checking = true;
    try {
      let again = true, guard = 0;
      while (again && guard++ < 4) {
        again = false;
        LQ.TROPHIES.forEach((t) => {
          if (LQ.S.trophies[t.id]) return;
          let ok = false;
          try { ok = !!t.t(); } catch (e) { ok = false; }
          if (!ok) return;
          LQ.S.trophies[t.id] = Date.now();
          again = true;
          const gr = LQ.GRADE[t.g];
          LQ.toast('<small>Trophée ' + gr.n.toLowerCase() + ' débloqué</small><strong>' + LQ.esc(t.n) + '</strong>', 'trophy g-' + t.g, t.ic);
          LQ.S.xp += gr.xp; dayRec().xp += gr.xp;
          if (t.g !== 'b') LQ.confetti(); /* les trophées de bronze tombent souvent, parfois sur une erreur : pas de fête pour eux */
          LQ.sfx('trophy');
        });
      }
      LQ.save();
    } finally { checking = false; }
    LQ.refreshChrome();
  };

  /* ------------------------------------------------------------------ toasts, modale, effets */
  LQ.toast = (html, kind, ic) => {
    const box = LQ.$('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = (ic ? '<span class="toast-ic">' + LQ.icon(ic) + '</span>' : '') + '<span class="toast-tx">' + html + '</span>';
    box.appendChild(el);
    const life = /trophy|level/.test(kind || '') ? 5200 : 3200;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, life);
  };

  let modalResolve = null;
  LQ.modal = (opt) =>
    new Promise((resolve) => {
      const host = LQ.$('#modal');
      if (modalResolve) { modalResolve('close'); }
      modalResolve = resolve;
      const acts = (opt.actions || [{ id: 'ok', label: 'Fermer' }])
        .map((a) => '<button class="btn ' + (a.kind || '') + '" data-modal="' + LQ.esc(a.id) + '">' + LQ.esc(a.label) + '</button>')
        .join('');
      host.innerHTML =
        '<div class="modal-back" data-modal="close"></div><div class="modal-card' + (opt.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + LQ.esc(opt.title || '') + '">' +
        (opt.title ? '<h2 class="modal-title">' + LQ.esc(opt.title) + '</h2>' : '') +
        '<div class="modal-body">' + (opt.html || '') + '</div><div class="modal-actions">' + acts + '</div></div>';
      host.hidden = false;
      document.body.classList.add('has-modal');
      const first = host.querySelector('.modal-body input, .modal-body textarea, .modal-actions .btn');
      if (first) first.focus();
      if (opt.onOpen) opt.onOpen(host);
    });
  LQ.closeModal = (id) => {
    const host = LQ.$('#modal');
    if (!host || host.hidden) return;
    /* les champs nommés de la modale restent lisibles après fermeture */
    const data = {};
    host.querySelectorAll('[name]').forEach((el) => { data[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    LQ.modalData = data;
    host.hidden = true; host.innerHTML = '';
    document.body.classList.remove('has-modal');
    const r = modalResolve; modalResolve = null;
    if (r) r(id || 'close');
  };

  /* Confettis dessinés sur un canvas plein écran, coupés si l'utilisateur réduit les animations. */
  let fxRaf = 0;
  LQ.confetti = () => {
    const S = LQ.S;
    if (!S || !S.settings.fx) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = LQ.$('#fx');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    const W = (cv.width = window.innerWidth), H = (cv.height = window.innerHeight);
    const cols = ['#f0a81c', '#2aa9c9', '#e8f5f9', '#ff8a5b', '#4cd08c'];
    const ps = [];
    for (let i = 0; i < 110; i++) {
      ps.push({ x: W / 2 + (Math.random() - 0.5) * 160, y: H * 0.34, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 3, r: 3 + Math.random() * 4, c: cols[i % cols.length], a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.4 });
    }
    cancelAnimationFrame(fxRaf);
    const t0 = performance.now();
    const tick = (t) => {
      const dt = t - t0;
      ctx.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.globalAlpha = Math.max(0, 1 - dt / 1900);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      });
      if (dt < 1900) fxRaf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    fxRaf = requestAnimationFrame(tick);
  };

  /* Petits sons synthétiques, désactivés par défaut (réglage dans le profil). */
  let actx = null;
  LQ.sfx = (name) => {
    if (!LQ.S || !LQ.S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { ok: [[660, 0], [880, 0.09]], ko: [[220, 0], [180, 0.1]], trophy: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]], tick: [[440, 0]] }[name] || [[440, 0]];
      seq.forEach(([f, at]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = name === 'ko' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, actx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + at + 0.2);
        o.connect(g); g.connect(actx.destination);
        o.start(actx.currentTime + at); o.stop(actx.currentTime + at + 0.22);
      });
    } catch (e) { /* audio indisponible */ }
  };

  LQ.applyTheme = () => {
    const t = LQ.S.settings.theme, root = document.documentElement;
    if (t === 'light' || t === 'dark') { root.setAttribute('data-theme', t); root.setAttribute('data-lq-theme', '1'); }
    else if (root.getAttribute('data-lq-theme')) { root.removeAttribute('data-theme'); root.removeAttribute('data-lq-theme'); }
  };

  LQ.refreshChrome = () => { /* remplacé par app.js une fois l'interface montée */ };
})();
