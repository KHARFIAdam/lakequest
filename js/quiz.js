/* LakeQuest — moteur de questions : sessions d'entraînement (correction immédiate)
   et sessions d'examen (correction différée, chronomètre, marquage, navigateur). */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, rich = LQ.rich, icon = LQ.icon;
  const LETTERS = 'ABCDEFGH';
  LQ.actions = LQ.actions || {};

  /* ---------------------------------------------------------------- décodeur d'énoncés */
  let glossRe = null, glossMap = null;
  function glossInit() {
    glossMap = {};
    const terms = (LQ.glossary || []).map((g) => { const k = esc(g.t); glossMap[k.toLowerCase()] = g; return k; });
    terms.sort((a, b) => b.length - a.length);
    glossRe = terms.length ? new RegExp('(^|[^\\w-])(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w-])', 'gi') : null;
  }
  /* Renvoie le HTML de l'énoncé ; en entraînement, les mots-clés d'examen deviennent cliquables. */
  LQ.qText = (text, withGloss) => {
    const html = LQ.code(text);
    if (!withGloss) return html;
    if (glossMap === null) glossInit();
    if (!glossRe) return html;
    return html.replace(glossRe, (m, pre, term) => pre + '<button type="button" class="gl" data-act="gloss" data-term="' + term.toLowerCase() + '">' + term + '</button>');
  };
  LQ.actions.gloss = (el) => {
    if (glossMap === null) glossInit();
    const g = glossMap[el.dataset.term];
    if (!g) return;
    LQ.S.cnt.gloss++; LQ.save(); LQ.checkTrophies();
    LQ.modal({
      title: g.t,
      html: '<p class="gloss-fr">' + esc(g.fr) + '</p><p class="gloss-hint">' + icon('info') + '<span>' + rich(g.hint) + '</span></p>',
      actions: [{ id: 'ok', label: 'Compris', kind: 'primary' }],
    });
  };

  /* ---------------------------------------------------------------- éléments de session */
  function makeItem(q, saved) {
    return {
      q,
      order: saved && saved.order ? saved.order : LQ.shuffle(q.o.map((_, i) => i)),
      pick: saved && saved.pick ? saved.pick.slice() : [],
      flag: !!(saved && saved.flag),
      done: false, ok: null,
    };
  }
  function isRight(it) {
    const a = it.q.a.slice().sort(), p = it.pick.slice().sort();
    return a.length === p.length && a.every((v, i) => v === p[i]);
  }
  LQ.isRight = isRight;

  function optionsHTML(it, opt) {
    const q = it.q, locked = opt.locked;
    return it.order
      .map((oi, pos) => {
        const sel = it.pick.indexOf(oi) >= 0, good = q.a.indexOf(oi) >= 0;
        let cls = 'opt' + (sel ? ' sel' : '');
        let mark = '';
        if (opt.reveal) {
          if (good) { cls += ' good'; mark = icon('check'); }
          else if (sel) { cls += ' bad'; mark = icon('x'); }
          else cls += ' dim';
        }
        return '<button type="button" class="' + cls + '"' + (locked ? ' disabled' : '') + ' data-act="q-pick" data-i="' + oi + '" aria-pressed="' + sel + '">' +
          '<span class="opt-k">' + LETTERS[pos] + '</span><span class="opt-t">' + LQ.code(q.o[oi]) + (opt.reveal && q.fo && q.fo[oi] ? '<small class="opt-fb">' + esc(q.fo[oi]) + '</small>' : '') + '</span>' + (mark ? '<span class="opt-m">' + mark + '</span>' : '') + '</button>';
      })
      .join('');
  }
  function lettersOf(it, idxs) {
    return idxs.map((oi) => LETTERS[it.order.indexOf(oi)]).sort().join(', ');
  }
  function cardChips(q) {
    const cs = (q.r || []).map((id) => LQ.cardMap[id]).filter(Boolean);
    if (!cs.length) return '';
    return '<div class="fb-links"><span>Pour aller plus loin :</span>' + cs.map((c) => '<button type="button" class="chip" data-act="card-peek" data-id="' + esc(c.id) + '">' + icon('book') + esc(c.s || c.n) + '</button>').join('') + '</div>';
  }
  function metaHTML(q) {
    const d = LQ.domainMap[q.d];
    return '<span class="dom d' + q.d + '">Domaine ' + q.d + '</span><span class="q-task" title="' + esc(LQ.tasks[q.ts] || '') + '">' + esc(q.ts) + ' · ' + esc(LQ.tasks[q.ts] || (d ? d.en : '')) + '</span>';
  }

  /* Bloc de correction réutilisé par les écrans de résultat et la relecture d'examen. */
  LQ.reviewItemHTML = (it, n, open) => {
    const q = it.q, ok = it.ok;
    const answered = it.pick.length > 0;
    const status = ok ? 'ok' : 'ko';
    return '<details class="rv ' + status + '"' + (open ? ' open' : '') + '><summary><span class="rv-n">' + n + '</span><span class="rv-s">' + icon(ok ? 'check' : 'x') + '</span><span class="rv-q">' + LQ.code(q.q) + '</span></summary>' +
      '<div class="rv-body"><div class="q-meta">' + metaHTML(q) + '</div><div class="opts static">' + optionsHTML(it, { locked: true, reveal: true }) + '</div>' +
      '<p class="rv-line">' + (answered ? 'Ta réponse : <strong>' + lettersOf(it, it.pick) + '</strong>' : '<strong>Sans réponse</strong>') + ' · Bonne réponse : <strong>' + lettersOf(it, q.a) + '</strong></p>' +
      '<div class="fb ' + status + '"><p class="fb-text">' + rich(q.e) + '</p>' + cardChips(q) + '</div></div></details>';
  };

  /* ---------------------------------------------------------------- session */
  function Session(cfg) {
    this.cfg = cfg;
    this.kind = cfg.kind;
    this.deferred = cfg.feedback === 'deferred';
    this.items = cfg.items || cfg.qs.map((q) => makeItem(q));
    this.i = cfg.i || 0;
    this.t0 = cfg.startedAt || Date.now();
    this.endAt = cfg.endAt || (cfg.seconds ? Date.now() + cfg.seconds * 1000 : 0);
    this.xp = 0;
    this.stage = 'run';          // run | check (écran de relecture avant de rendre) | done
    this.navOpen = false;
    this.active = true;
    this.timer = 0;
  }
  Session.prototype.cur = function () { return this.items[this.i]; };
  Session.prototype.host = function () { return LQ.$('#view'); };

  Session.prototype.paint = function (focusSel) {
    const host = this.host();
    if (!host) return;
    host.innerHTML = this.stage === 'check' ? this.checkHTML() : this.runHTML();
    document.body.classList.toggle('focus-mode', !!this.cfg.strict && this.stage !== 'done');
    if (this.endAt) this.tick();
    const f = focusSel && host.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  };

  Session.prototype.dotsHTML = function () {
    const self = this;
    return '<div class="dots" aria-hidden="true">' + this.items.map((it, k) => {
      let c = 'dot';
      if (k === self.i) c += ' cur';
      if (!self.deferred && it.done) c += it.ok ? ' ok' : ' ko';
      else if (self.deferred && it.pick.length) c += ' set';
      return '<i class="' + c + '"></i>';
    }).join('') + '</div>';
  };

  Session.prototype.runHTML = function () {
    const it = this.cur(), q = it.q, cfg = this.cfg, n = this.items.length;
    const need = q.a.length;
    const strict = !!cfg.strict;
    let head;
    if (this.deferred) {
      head = '<header class="exam-head"><div class="exam-id">' + esc(cfg.title) + '</div><div class="exam-pos">Question <strong>' + (this.i + 1) + '</strong> sur ' + n + '</div>' +
        '<div class="exam-clock" id="run-clock" role="timer" aria-label="Temps restant">' + icon('clock') + '<span>--:--</span></div></header>';
    } else {
      const right = this.items.filter((x) => x.done && x.ok).length;
      head = '<header class="run-head"><button type="button" class="back" data-act="q-quit">' + icon('left') + 'Quitter</button><div class="run-title"><p class="eyebrow">' + esc(cfg.eyebrow || '') + '</p><h1>' + esc(cfg.title) + '</h1></div>' +
        '<div class="run-side">' + (this.endAt ? '<span class="pill clock" id="run-clock">' + icon('clock') + '<span>--:--</span></span>' : '') + '<span class="pill">' + icon('check') + right + ' / ' + n + '</span></div></header>';
    }
    const hint = need > 1 ? '<p class="q-hint">' + need + ' réponses attendues</p>' : '';
    let foot = '';
    if (this.deferred) {
      const last = this.i === n - 1;
      foot = '<footer class="exam-foot"><button type="button" class="btn ghost" data-act="q-prev"' + (this.i === 0 ? ' disabled' : '') + '>' + icon('left') + '<span>Précédente</span></button>' +
        '<button type="button" class="btn ghost flagbtn' + (it.flag ? ' on' : '') + '" data-act="q-flag" aria-pressed="' + it.flag + '">' + icon('flag') + '<span>' + (it.flag ? 'Marquée' : 'Marquer') + '</span></button>' +
        '<button type="button" class="btn ghost" data-act="q-nav" aria-expanded="' + this.navOpen + '">' + icon('grid') + '<span>Navigateur</span></button>' +
        (last ? '<button type="button" class="btn primary" data-act="q-finish"><span>Relire et terminer</span>' + icon('right') + '</button>'
              : '<button type="button" class="btn primary" data-act="q-next"><span>Suivante</span>' + icon('right') + '</button>') + '</footer>' +
        '<div class="exam-grid"' + (this.navOpen ? '' : ' hidden') + '>' + this.gridHTML() + '<p class="grid-key"><i class="k set"></i>Répondue <i class="k flag"></i>Marquée <i class="k"></i>Sans réponse</p></div>';
    } else if (!it.done) {
      foot = '<div class="q-actions"><button type="button" class="btn primary big" data-act="q-check"' + (it.pick.length === need ? '' : ' disabled') + '>Valider</button></div>';
    } else {
      const lastOne = this.i === n - 1;
      foot = '<div class="fb ' + (it.ok ? 'ok' : 'ko') + '" role="status"><p class="fb-head">' + icon(it.ok ? 'check' : 'x') + (it.ok ? 'Bonne réponse' + (it.gain ? ' · +' + it.gain + ' XP' : '') : 'Pas cette fois · bonne réponse : ' + lettersOf(it, q.a)) + '</p>' +
        '<p class="fb-text">' + rich(q.e) + '</p>' + cardChips(q) + '</div>' +
        '<div class="q-actions"><button type="button" class="btn primary big" data-act="q-next" id="q-next">' + (lastOne ? 'Voir le résultat' : 'Question suivante') + icon('right') + '</button></div>';
    }
    return '<section class="run' + (this.deferred ? ' exam' : '') + '">' + head + this.dotsHTML() +
      '<article class="q card"><div class="q-meta">' + (strict ? '<span class="q-num">Question ' + (this.i + 1) + '</span>' : metaHTML(q)) + '</div>' +
      '<p class="q-text" lang="en">' + LQ.qText(q.q, !strict) + '</p>' + hint +
      '<div class="opts" lang="en">' + optionsHTML(it, { locked: it.done, reveal: it.done && !this.deferred }) + '</div>' + foot + '</article>' +
      (strict ? '<p class="exam-quit"><button type="button" class="linkish" data-act="q-quit">Quitter l’examen</button></p>' : '') + '</section>';
  };

  Session.prototype.gridHTML = function () {
    const self = this;
    return '<div class="grid-n">' + this.items.map((it, k) => '<button type="button" class="gn' + (it.pick.length ? ' set' : '') + (it.flag ? ' flag' : '') + (k === self.i ? ' cur' : '') + '" data-act="q-goto" data-i="' + k + '" aria-label="Question ' + (k + 1) + '">' + (k + 1) + '</button>').join('') + '</div>';
  };

  /* Écran de relecture avant de rendre la copie, comme au centre d'examen. */
  Session.prototype.checkHTML = function () {
    const blank = this.items.filter((it) => !it.pick.length).length;
    const flagged = this.items.filter((it) => it.flag).length;
    return '<section class="run exam"><header class="exam-head"><div class="exam-id">' + esc(this.cfg.title) + '</div><div class="exam-pos">Relecture</div>' +
      '<div class="exam-clock" id="run-clock" role="timer">' + icon('clock') + '<span>--:--</span></div></header>' +
      '<div class="card check"><h1>Avant de rendre ta copie</h1><p class="lead">Une question sans réponse compte comme fausse, et il n’y a pas de pénalité pour une mauvaise réponse : réponds à tout.</p>' +
      '<div class="check-stats"><div><strong>' + (this.items.length - blank) + '</strong><span>répondues</span></div><div class="' + (blank ? 'warn' : '') + '"><strong>' + blank + '</strong><span>sans réponse</span></div><div><strong>' + flagged + '</strong><span>marquées</span></div></div>' +
      this.gridHTML() + '<p class="grid-key"><i class="k set"></i>Répondue <i class="k flag"></i>Marquée <i class="k"></i>Sans réponse</p>' +
      '<div class="q-actions split"><button type="button" class="btn ghost" data-act="q-back">' + icon('left') + 'Revenir aux questions</button><button type="button" class="btn primary big" data-act="q-submit">Rendre l’examen</button></div></div></section>';
  };

  Session.prototype.tick = function () {
    const self = this;
    clearInterval(this.timer);
    const upd = () => {
      const left = (self.endAt - Date.now()) / 1000;
      const el = LQ.$('#run-clock');
      if (el) {
        el.querySelector('span').textContent = LQ.fmtClock(left);
        el.classList.toggle('low', left < 300);
      }
      if (left <= 0 && self.active) {
        clearInterval(self.timer);
        LQ.toast('Temps écoulé : ta copie est rendue.', 'warn', 'clock');
        self.finish(true);
      }
    };
    upd();
    this.timer = setInterval(upd, 500);
  };

  Session.prototype.persist = function () {
    if (!this.cfg.persist) return;
    const c = this.cfg;
    LQ.S.examRun = {
      mode: c.mode, form: c.form || '', strict: !!c.strict, title: c.title, esl: !!c.esl, total: c.seconds,
      startedAt: this.t0, endAt: this.endAt, i: this.i,
      items: this.items.map((it) => ({ id: it.q.id, order: it.order, pick: it.pick, flag: it.flag })),
    };
    LQ.save();
  };

  Session.prototype.pick = function (oi) {
    const it = this.cur();
    if (it.done) return;
    const need = it.q.a.length, at = it.pick.indexOf(oi);
    if (need === 1) it.pick = at >= 0 && this.deferred ? [] : [oi];
    else if (at >= 0) it.pick.splice(at, 1);
    else if (it.pick.length < need) it.pick.push(oi);
    else { LQ.toast('Retire d’abord une réponse : ' + need + ' attendues.', 'warn'); return; }
    this.persist();
    this.paint('[data-act="q-pick"][data-i="' + oi + '"]');
  };

  Session.prototype.check = function () {
    const it = this.cur();
    if (it.done || it.pick.length !== it.q.a.length) return;
    it.done = true;
    it.ok = isRight(it);
    const rec = LQ.recordAnswer(it.q, it.ok);
    if (rec.fixed) LQ.S.cnt.reviewFixed++;
    it.gain = 0;
    if (it.ok) {
      it.gain = (this.cfg.xpPer == null ? 10 : this.cfg.xpPer) + (rec.firstOk ? 5 : 0);
      this.xp += it.gain;
      LQ.addXp(it.gain);
    } else LQ.save();
    LQ.sfx(it.ok ? 'ok' : 'ko');
    LQ.checkTrophies();
    this.paint('#q-next');
    const card = LQ.$('.q.card');
    if (card) card.classList.add(it.ok ? 'pulse-ok' : 'pulse-ko');
  };

  Session.prototype.go = function (k) {
    this.i = LQ.clamp(k, 0, this.items.length - 1);
    this.stage = 'run';
    this.navOpen = false;
    this.persist();
    this.paint();
    window.scrollTo(0, 0);
  };

  Session.prototype.next = function () {
    if (!this.deferred && !this.cur().done) return;
    if (this.i >= this.items.length - 1) { if (!this.deferred) this.finish(); return; }
    this.go(this.i + 1);
  };

  Session.prototype.stop = function () {
    this.active = false;
    clearInterval(this.timer);
    document.body.classList.remove('focus-mode');
    if (LQ.run === this) LQ.run = null;
  };

  Session.prototype.result = function () {
    const items = this.items;
    const r = { n: items.length, correct: 0, byDomain: {}, dur: Math.round((Date.now() - this.t0) / 1000), xp: this.xp, items };
    items.forEach((it) => {
      if (this.deferred) it.ok = isRight(it);
      const d = (r.byDomain[it.q.d] = r.byDomain[it.q.d] || { n: 0, ok: 0 });
      d.n++;
      if (it.ok) { d.ok++; r.correct++; }
    });
    r.pct = LQ.pct(r.correct, r.n);
    r.wrong = items.filter((it) => !it.ok);
    return r;
  };

  Session.prototype.finish = function (timeUp) {
    if (!this.active) return;
    const left = this.endAt ? (this.endAt - Date.now()) / 1000 : 0;
    const res = this.result();
    res.timeUp = !!timeUp;
    res.left = left;
    this.stop();
    this.stage = 'done';
    if (this.deferred) {
      /* en examen, les réponses ne sont enregistrées qu'au moment de rendre la copie */
      this.items.forEach((it) => { it.done = true; const rec = LQ.recordAnswer(it.q, it.ok); if (rec.fixed) LQ.S.cnt.reviewFixed++; });
    }
    const out = this.cfg.onDone ? this.cfg.onDone(res, this) : null;
    LQ.save();
    LQ.checkTrophies();
    if (out === false) return; // la vue appelante affiche son propre écran
    const host = this.host();
    if (host) { host.innerHTML = LQ.Quiz.resultHTML(res, out || {}); window.scrollTo(0, 0); }
  };

  /* ---------------------------------------------------------------- API publique */
  LQ.Quiz = {
    makeItem,
    start(cfg) {
      if (LQ.run) LQ.run.stop();
      const s = new Session(cfg);
      LQ.run = s;
      s.persist();
      s.paint();
      window.scrollTo(0, 0);
      return s;
    },
    starsFor(pct) { return pct >= 100 ? 3 : pct >= 80 ? 2 : pct >= 60 ? 1 : 0; },
    starsHTML(n, max) {
      let h = '<span class="stars" aria-label="' + n + ' étoile' + (n > 1 ? 's' : '') + ' sur ' + (max || 3) + '">';
      for (let i = 0; i < (max || 3); i++) h += icon(i < n ? 'star' : 'starOff', i < n ? 'on' : 'off');
      return h + '</span>';
    },
    /* Écran de fin d'une session d'entraînement. `o` vient de la vue appelante. */
    resultHTML(res, o) {
      const wrong = res.wrong;
      const acts = (o.actions || [{ label: 'Retour', href: '#jouer' }])
        .map((a) => (a.href ? '<a class="btn ' + (a.kind || 'ghost') + '" href="' + esc(a.href) + '">' + esc(a.label) + '</a>' : '<button type="button" class="btn ' + (a.kind || 'ghost') + '" data-act="' + esc(a.act) + '"' + (a.arg ? ' data-id="' + esc(a.arg) + '"' : '') + '>' + esc(a.label) + '</button>'))
        .join('');
      return '<section class="result"><div class="result-hero card ' + (o.tone || (res.pct >= 80 ? 'good' : res.pct >= 60 ? 'mid' : 'low')) + '">' +
        (o.stars != null ? '<div class="result-stars">' + LQ.Quiz.starsHTML(o.stars) + '</div>' : '') +
        '<p class="eyebrow">' + esc(o.eyebrow || 'Session terminée') + '</p><h1>' + esc(o.title || res.correct + ' sur ' + res.n) + '</h1>' +
        (o.lead ? '<p class="lead">' + o.lead + '</p>' : '') +
        '<div class="result-stats"><div><strong>' + res.correct + ' / ' + res.n + '</strong><span>bonnes réponses</span></div><div><strong>' + res.pct + ' %</strong><span>de réussite</span></div><div><strong>+' + (res.xp + (o.bonus || 0)) + '</strong><span>XP gagnés</span></div><div><strong>' + LQ.fmtDur(Math.max(60, res.dur)) + '</strong><span>durée</span></div></div>' +
        '<div class="result-actions">' + acts + '</div></div>' +
        (o.extra || '') +
        (wrong.length
          ? '<h2 class="sec-title">' + LQ.plural(wrong.length, 'erreur') + ' à comprendre</h2><p class="sec-sub">Elles reviendront dans ta révision espacée jusqu’à ce qu’elles soient acquises.</p><div class="rv-list">' + wrong.map((it) => LQ.reviewItemHTML(it, res.items.indexOf(it) + 1, wrong.length <= 3)).join('') + '</div>'
          : '<p class="all-good">' + icon('check') + 'Aucune erreur sur cette session.</p>') + '</section>';
    },
  };

  /* ---------------------------------------------------------------- actions */
  const A = LQ.actions;
  A['q-pick'] = (el) => LQ.run && LQ.run.pick(+el.dataset.i);
  A['q-check'] = () => LQ.run && LQ.run.check();
  A['q-next'] = () => LQ.run && LQ.run.next();
  A['q-prev'] = () => LQ.run && LQ.run.go(LQ.run.i - 1);
  A['q-goto'] = (el) => LQ.run && LQ.run.go(+el.dataset.i);
  A['q-flag'] = () => { const r = LQ.run; if (!r) return; const it = r.cur(); it.flag = !it.flag; r.persist(); r.paint('.flagbtn'); };
  A['q-nav'] = () => { const r = LQ.run; if (!r) return; r.navOpen = !r.navOpen; r.paint('[data-act="q-nav"]'); };
  A['q-finish'] = () => { const r = LQ.run; if (!r) return; r.stage = 'check'; r.paint(); window.scrollTo(0, 0); };
  A['q-back'] = () => { const r = LQ.run; if (!r) return; r.stage = 'run'; r.paint(); };
  A['q-submit'] = () => {
    const r = LQ.run; if (!r) return;
    const blank = r.items.filter((it) => !it.pick.length).length;
    LQ.modal({
      title: 'Rendre l’examen ?',
      html: '<p>' + (blank ? 'Il te reste <strong>' + LQ.plural(blank, 'question') + ' sans réponse</strong>. ' : '') + 'Une fois la copie rendue, tu ne pourras plus modifier tes réponses.</p>',
      actions: [{ id: 'no', label: 'Continuer l’examen', kind: 'ghost' }, { id: 'yes', label: 'Rendre ma copie', kind: 'primary' }],
    }).then((a) => { if (a === 'yes' && LQ.run === r) r.finish(false); });
  };
  A['q-quit'] = () => {
    const r = LQ.run; if (!r) return;
    if (!r.cfg.persist) { r.stop(); location.hash = r.cfg.back || '#jouer'; if (LQ.route) LQ.route(); return; }
    LQ.modal({
      title: 'Quitter l’examen ?',
      html: '<p>Comme au centre d’examen, <strong>le chronomètre continue de tourner</strong> pendant ton absence. Tu peux reprendre tant qu’il reste du temps, ou abandonner cette tentative.</p>',
      actions: [{ id: 'stay', label: 'Rester', kind: 'primary' }, { id: 'leave', label: 'Sortir, je reprends plus tard', kind: 'ghost' }, { id: 'drop', label: 'Abandonner l’examen', kind: 'danger' }],
    }).then((a) => {
      if (LQ.run !== r) return;
      if (a === 'leave') { r.persist(); r.stop(); location.hash = '#accueil'; if (LQ.route) LQ.route(); }
      if (a === 'drop') { r.stop(); LQ.S.examRun = null; LQ.save(); location.hash = '#examen'; if (LQ.route) LQ.route(); }
    });
  };

  /* Raccourcis clavier : A-F ou 1-6 pour choisir, Entrée pour valider ou avancer, flèches en examen. */
  document.addEventListener('keydown', (e) => {
    const r = LQ.run;
    if (!r || !r.active || r.stage !== 'run') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || document.body.classList.contains('has-modal')) return;
    const it = r.cur();
    let pos = -1;
    if (/^[1-8]$/.test(e.key)) pos = +e.key - 1;
    else if (/^[a-h]$/i.test(e.key)) pos = LETTERS.indexOf(e.key.toUpperCase());
    if (pos >= 0 && pos < it.order.length) { e.preventDefault(); r.pick(it.order[pos]); return; }
    if (e.key === 'Enter') {
      if (tag === 'BUTTON' && !e.target.classList.contains('opt')) return;
      e.preventDefault();
      if (r.deferred) r.next(); else if (it.done) r.next(); else r.check();
    } else if (r.deferred && e.key === 'ArrowRight') r.next();
    else if (r.deferred && e.key === 'ArrowLeft') r.go(r.i - 1);
  });
})();
