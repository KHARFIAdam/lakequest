/* LakeQuest — examen blanc : conditions réelles (65 questions, 130 minutes, score sur 1 000). */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, icon = LQ.icon;
  const V = LQ.views, A = LQ.actions, UI = LQ.ui;

  /* Répartition par domaine identique à la pondération officielle : 34 / 26 / 22 / 18 %. */
  const MODES = {
    full: { n: 65, min: 130, esl: 30, split: [22, 17, 14, 12], label: 'Complet', bonus: 150 },
    half: { n: 33, min: 65, esl: 15, split: [11, 9, 7, 6], label: 'Demi-examen', bonus: 70 },
    mini: { n: 20, min: 40, esl: 9, split: [7, 5, 4, 4], label: 'Express', bonus: 40 },
  };
  LQ.EXAM_MODES = MODES;
  const PASS = 720;
  const scoreOf = (correct, n) => 100 + Math.round((900 * correct) / Math.max(1, n));

  function formQs(f) { return LQ.questions.filter((q) => q.x === f); }
  function randomQs(mode) {
    let out = [];
    LQ.domains.forEach((d, i) => { out = out.concat(LQ.pickQs(LQ.openQs(LQ.byDomain[d.id]), MODES[mode].split[i])); });
    return LQ.shuffle(out);
  }
  function opts() {
    if (!UI.exam) UI.exam = { esl: !!LQ.S.settings.esl, strict: true, rmode: 'full' };
    return UI.exam;
  }
  function minutes(mode) { return MODES[mode].min + (opts().esl ? MODES[mode].esl : 0); }

  /* ---------------------------------------------------------------- page d'accueil de l'examen */
  V.examen = () => {
    const S = LQ.S, o = opts();
    if (UI.examView) { const v = UI.examView; return { html: resultHTML(v.rec, v.items), mount() { window.scrollTo(0, 0); } }; }
    const run = S.examRun;
    if (run && run.endAt <= Date.now()) return { html: '<p class="empty">Temps écoulé pendant ton absence : correction de ta copie…</p>', mount() { resume(true); } };
    const resumeCard = run
      ? '<section class="card pad resume"><div><p class="eyebrow">Examen en cours</p><h2>' + esc(run.title) + '</h2><p>Il te reste <strong>' + LQ.fmtClock((run.endAt - Date.now()) / 1000) + '</strong>. ' + run.items.filter((x) => x.pick.length).length + ' réponses données sur ' + run.items.length + '.</p></div>' +
        '<div class="resume-acts"><button type="button" class="btn primary big" data-act="exam-resume">Reprendre' + icon('right') + '</button><button type="button" class="btn danger" data-act="exam-drop">Abandonner</button></div></section>'
      : '';
    const formCard = (f) => {
      const qs = formQs(f), r = S.forms[f] || {};
      const ready = qs.length >= 20;
      return '<article class="card pad exam-card' + (r.tries ? ' done' : '') + '"><div class="exam-card-h"><span class="exam-letter">' + f + '</span><div><h2>Examen blanc ' + f + '</h2><p>' + qs.length + ' questions inédites · ' + minutes('full') + ' minutes</p></div></div>' +
        (r.tries ? '<div class="exam-card-s"><div><strong>' + r.first + '</strong><span>première tentative</span></div><div><strong>' + r.best + '</strong><span>meilleur score</span></div><div><strong>' + r.tries + '</strong><span>' + (r.tries > 1 ? 'passages' : 'passage') + '</span></div></div>'
          : '<p class="exam-card-t">' + (f === 'C' ? '<strong>Format long.</strong> Des énoncés à plusieurs contraintes et des options rédigées comme des solutions complètes : le plus proche de ce que tu liras le jour J.' : 'Ces questions n’apparaissent nulle part ailleurs dans le jeu tant que tu n’as pas passé cet examen. Garde-le pour un vrai test.') + '</p>') +
        '<button type="button" class="btn ' + (r.tries ? 'ghost' : 'primary') + ' big full" data-act="exam-start" data-id="' + f + '"' + (run || !ready ? ' disabled' : '') + '>' + (r.tries ? 'Repasser l’examen ' + f : 'Passer l’examen ' + f) + '</button></article>';
    };
    const persoHTML = () => {
      const fs = LQ.packs ? LQ.packs.forms() : [];
      if (!fs.length) return '';
      return '<h2 class="sec-title">Mes questions importées</h2><div class="exam-grid2">' + fs.map((p) => {
        const r = S.forms[p.f] || {}, mins = Math.round((minutes('full') * p.n) / MODES.full.n);
        return '<article class="card pad exam-card' + (r.tries ? ' done' : '') + '"><div class="exam-card-h"><span class="exam-letter">' + LQ.esc(p.f.slice(1)) + '</span><div><h2>' + LQ.esc(p.label) + '</h2><p>' + p.n + ' questions · ' + mins + ' minutes</p></div></div>' +
          (r.tries ? '<div class="exam-card-s"><div><strong>' + r.first + '</strong><span>première tentative</span></div><div><strong>' + r.best + '</strong><span>meilleur score</span></div><div><strong>' + r.tries + '</strong><span>' + (r.tries > 1 ? 'passages' : 'passage') + '</span></div></div>' : '<p class="exam-card-t">Questions privées, importées dans ce navigateur. Après le premier passage, elles rejoignent ta révision espacée.</p>') +
          '<button type="button" class="btn ' + (r.tries ? 'ghost' : 'primary') + ' big full" data-act="exam-start" data-id="' + LQ.esc(p.f) + '"' + (run ? ' disabled' : '') + '>' + (r.tries ? 'Repasser' : 'Passer') + ' le ' + LQ.esc(p.label.toLowerCase()) + '</button></article>';
      }).join('') + '</div>';
    };
    const hist = S.exams.slice().reverse();
    const strictFull = S.exams.filter((e) => e.strict && e.mode === 'full');
    const chart = strictFull.length > 1
      ? '<div class="spark" aria-hidden="true"><i class="spark-pass"></i>' + strictFull.slice(-12).map((e) => '<span class="' + (e.pass ? 'ok' : 'ko') + '" style="height:' + Math.round(((e.score - 100) / 900) * 100) + '%" title="' + e.score + '"></span>').join('') + '</div>'
      : '';
    return {
      html: '<header class="page-h"><p class="eyebrow">Simulation</p><h1>Examen blanc</h1><p class="lead">Le format du vrai DEA-C01 : 65 questions à choix unique ou multiple, 130 minutes, aucune correction avant la fin, un score de 100 à 1 000 et la réussite à 720.</p></header>' + resumeCard +
        '<div class="exam-opts card pad"><label class="switch"><input type="checkbox" id="exam-esl" data-change="exam-opt" data-k="esl"' + (o.esl ? ' checked' : '') + '><span></span><span><strong>Temps ESL +30 minutes</strong><small>L’aménagement pour les candidats dont l’anglais n’est pas la langue maternelle.</small></span></label></div>' +
        '<div class="exam-grid2">' + formCard('A') + formCard('B') + '</div><div class="exam-wide">' + formCard('C') + '</div>' + persoHTML() +
        '<section class="card pad exam-random"><div><h2>Examen aléatoire</h2><p>Tiré de toute la banque ouverte, en privilégiant ce que tu as le moins vu. Idéal pour s’endurcir entre deux examens inédits.</p></div>' +
        '<div class="seg" role="group" aria-label="Longueur">' + Object.keys(MODES).map((k) => '<button type="button" class="' + (o.rmode === k ? 'on' : '') + '" data-act="exam-rmode" data-id="' + k + '">' + MODES[k].label + '<small>' + MODES[k].n + ' q · ' + minutes(k) + ' min</small></button>').join('') + '</div>' +
        '<label class="switch"><input type="checkbox" id="exam-strict" data-change="exam-opt" data-k="strict"' + (o.strict ? ' checked' : '') + '><span></span><span><strong>Conditions réelles</strong><small>Chronomètre et correction à la fin. Décoché : correction après chaque question, sans chronomètre.</small></span></label>' +
        '<button type="button" class="btn primary big" data-act="exam-start" data-id="random"' + (run ? ' disabled' : '') + '>Lancer un examen aléatoire</button></section>' +
        '<div class="two-col"><section><h2 class="sec-title">Ce que dit le guide officiel</h2><div class="card pad"><ul class="facts">' +
        '<li><strong>65 questions</strong>, dont 15 non notées qu’on ne peut pas repérer.</li><li><strong>Deux formats</strong> : une seule bonne réponse sur 4, ou plusieurs bonnes réponses sur 5 ou plus.</li>' +
        '<li><strong>Pas de pénalité</strong> : une question sans réponse compte comme fausse.</li><li><strong>Score global</strong> de 100 à 1 000, réussite à 720. Un domaine faible peut être compensé.</li>' +
        '<li><strong>4 domaines</strong> pondérés 34, 26, 22 et 18 %.</li></ul><p class="small">Ici, les 65 questions comptent toutes et le score est une estimation linéaire : le barème réel d’AWS n’est pas public.</p></div></section>' +
        '<section><h2 class="sec-title">Historique</h2><div class="card pad">' + chart +
        (hist.length ? '<ul class="hist">' + hist.map((e) => '<li><span class="hist-score ' + (e.strict ? (e.pass ? 'ok' : 'ko') : 'mid') + '">' + e.score + '</span><div><strong>' + esc(e.title) + '</strong><span>' + LQ.fmtDate(e.ts) + ' · ' + e.correct + ' / ' + e.n + (e.strict ? ' · ' + LQ.fmtDur(e.dur) : ' · entraînement') + '</span></div>' +
          (e.detail ? '<button type="button" class="btn ghost sm" data-act="exam-open" data-id="' + e.id + '">Correction</button>' : '') + '</li>').join('') + '</ul>'
          : '<p class="empty">Aucun examen pour l’instant. Le premier sert à te situer, pas à te juger.</p>') + '</div></section></div>',
    };
  };

  A['exam-rmode'] = (el) => { opts().rmode = el.dataset.id; LQ.route(); };
  LQ.changes = LQ.changes || {};
  LQ.changes['exam-opt'] = (el) => { opts()[el.dataset.k] = el.checked; LQ.route(); };
  A['exam-drop'] = () => {
    LQ.modal({ title: 'Abandonner cet examen ?', html: '<p>La tentative ne sera pas comptée et tes réponses seront effacées.</p>', actions: [{ id: 'no', label: 'Annuler', kind: 'ghost' }, { id: 'yes', label: 'Abandonner', kind: 'danger' }] })
      .then((a) => { if (a === 'yes') { LQ.S.examRun = null; LQ.save(); LQ.route(); } });
  };
  A['exam-resume'] = () => resume(false);

  A['exam-start'] = (el) => {
    const o = opts(), id = el.dataset.id;
    const form = /^([ABC]|P\w+)$/.test(id) ? id : '';
    const mode = form ? 'full' : o.rmode;
    const strict = form ? true : o.strict;
    const qs = form ? LQ.shuffle(formQs(form)) : randomQs(mode);
    if (!qs.length) { LQ.toast('Pas assez de questions disponibles.', 'warn'); return; }
    const title = form ? (form[0] === 'P' && form.length > 1 ? 'Test personnel ' + form.slice(1) : 'Examen blanc ' + form) : 'Examen aléatoire · ' + MODES[mode].label;
    const mins = Math.round((minutes(mode) * qs.length) / MODES[mode].n);
    if (!strict) {
      LQ.Quiz.start({
        kind: 'exam-train', title, eyebrow: 'Entraînement sans chronomètre', qs, xpPer: 5, back: '#examen',
        onDone(res) {
          const score = scoreOf(res.correct, res.n);
          LQ.S.exams.push({ id: Date.now(), ts: Date.now(), mode, form: '', strict: false, title: title + ' (entraînement)', n: res.n, correct: res.correct, score, pass: score >= PASS, dur: res.dur, byDomain: res.byDomain });
          return { eyebrow: title, title: score + ' sur 1 000', lead: 'Score indicatif : en entraînement, la correction immédiate t’aide. Seuls les examens en conditions réelles comptent pour les trophées.', extra: domainTable(res.byDomain), actions: [{ label: 'Retour aux examens', href: '#examen', kind: 'primary' }] };
        },
      });
      return;
    }
    LQ.modal({
      title: title,
      wide: true,
      html: '<ul class="facts"><li><strong>' + qs.length + ' questions</strong>, <strong>' + mins + ' minutes</strong>' + (o.esl ? ' (temps ESL inclus)' : '') + '. Vise 2 minutes par question.</li>' +
        '<li><strong>Le chronomètre ne s’arrête jamais</strong>, même si tu fermes la page. À zéro, la copie est rendue toute seule.</li>' +
        '<li><strong>Aucune correction avant la fin.</strong> Tu peux marquer une question et y revenir par le navigateur.</li>' +
        '<li>Les énoncés sont en anglais, comme le jour J. Le décodeur de mots-clés est coupé.</li>' +
        (form && !(LQ.S.forms[form] || {}).tries ? '<li>C’est ta <strong>première tentative</strong> sur l’examen ' + form + ' : c’est elle qui dira si tu es prêt.</li>' : '') + '</ul>' +
        '<p class="small">Installe-toi comme pour le vrai : téléphone loin, pas de notes, pas de pause.</p>',
      actions: [{ id: 'no', label: 'Pas maintenant', kind: 'ghost' }, { id: 'go', label: 'Démarrer le chronomètre', kind: 'primary' }],
    }).then((a) => {
      if (a !== 'go') return;
      UI.examView = null;
      LQ.Quiz.start({ kind: 'exam', mode, form, strict: true, persist: true, feedback: 'deferred', title, qs, seconds: mins * 60, esl: o.esl, onDone: examDone });
    });
  };

  function resume(expired) {
    const run = LQ.S.examRun;
    if (!run) { LQ.route(); return; }
    const items = run.items.map((x) => (LQ.Q[x.id] ? LQ.Quiz.makeItem(LQ.Q[x.id], x) : null)).filter(Boolean);
    if (!items.length) { LQ.S.examRun = null; LQ.save(); LQ.route(); return; }
    const s = LQ.Quiz.start({ kind: 'exam', mode: run.mode, form: run.form, strict: true, persist: true, feedback: 'deferred', title: run.title, items, i: run.i, startedAt: run.startedAt, endAt: run.endAt, seconds: run.total, esl: run.esl, onDone: examDone });
    if (expired) s.finish(true);
  }
  LQ.examResume = resume;

  function examDone(res, session) {
    const S = LQ.S, c = session.cfg;
    const score = scoreOf(res.correct, res.n);
    const flagged = session.items.filter((it) => it.flag).length;
    const total = c.seconds || Math.round((session.endAt - session.t0) / 1000);
    const rec = {
      id: Date.now(), ts: Date.now(), mode: c.mode, form: c.form || '', strict: true, title: c.title, n: res.n, correct: res.correct, score, pass: score >= PASS,
      dur: Math.min(res.dur, total), total, esl: !!c.esl, byDomain: res.byDomain, flagged, timeUp: !!res.timeUp,
      detail: session.items.map((it) => ({ id: it.q.id, order: it.order, pick: it.pick, flag: it.flag })),
    };
    S.exams.push(rec);
    S.exams.slice(0, -6).forEach((e) => { delete e.detail; });
    if (c.form) {
      const f = S.forms[c.form] || (S.forms[c.form] = { tries: 0, first: null, best: 0 });
      f.tries++;
      if (f.first == null) f.first = score;
      f.best = Math.max(f.best, score);
      f.ts = rec.ts;
    }
    if (flagged >= 10) S.cnt.flagger = 1;
    if (!res.timeUp && res.left > 0 && res.left < 120) S.cnt.lastMinute = 1;
    S.examRun = null;
    rec.xp = res.correct * 2 + (rec.pass ? MODES[c.mode].bonus : 0);
    LQ.addXp(rec.xp);
    UI.examView = { rec, items: session.items };
    UI.examFilter = 'wrong';
    if (rec.pass) { LQ.confetti(); LQ.sfx('trophy'); }
    const host = LQ.$('#view');
    if (host) { host.innerHTML = resultHTML(rec, session.items); window.scrollTo(0, 0); }
    if (location.hash !== '#examen') location.hash = '#examen';
    return false;
  }

  function domainTable(by) {
    return '<h2 class="sec-title">Résultat par domaine</h2><div class="table-wrap"><table class="dom-table"><thead><tr><th>Domaine</th><th>Poids</th><th>Bonnes réponses</th><th>Verdict</th></tr></thead><tbody>' +
      LQ.domains.map((d) => {
        const x = by[d.id] || { n: 0, ok: 0 }, p = LQ.pct(x.ok, x.n);
        return '<tr><td><span class="dom d' + d.id + '">Domaine ' + d.id + '</span> ' + esc(d.name) + '</td><td>' + d.w + ' %</td><td><div class="cellbar">' + LQ.bar(p, 'd' + d.id) + '<span>' + x.ok + ' / ' + x.n + '</span></div></td><td>' +
          (x.n ? '<span class="tag ' + (p >= 72 ? 'ok">Compétences atteintes' : 'ko">À renforcer') + '</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function resultHTML(rec, items) {
    const f = UI.examFilter || 'wrong';
    const wrong = items.filter((it) => !it.ok), flagged = items.filter((it) => it.flag);
    const list = f === 'all' ? items : f === 'flag' ? flagged : wrong;
    const pos = ((rec.score - 100) / 900) * 100, mark = ((PASS - 100) / 900) * 100;
    const first = rec.form && (LQ.S.forms[rec.form] || {}).tries === 1;
    return '<section class="exam-result"><div class="card score-card ' + (rec.pass ? 'pass' : 'fail') + '"><p class="eyebrow">' + esc(rec.title) + ' · ' + LQ.fmtDate(rec.ts) + '</p>' +
      '<div class="score-big"><strong>' + rec.score + '</strong><span>sur 1 000</span></div><p class="verdict">' + (rec.pass ? 'Réussi' : 'Pas encore') + (rec.timeUp ? ' · temps écoulé' : '') + '</p>' +
      '<div class="scale" aria-hidden="true"><div class="scale-track"><i style="width:' + pos.toFixed(1) + '%"></i><b style="left:' + mark.toFixed(1) + '%"></b></div><div class="scale-lab"><span>100</span><span style="left:' + mark.toFixed(1) + '%" class="scale-pass">720 pour réussir</span><span>1 000</span></div></div>' +
      '<div class="result-stats"><div><strong>' + rec.correct + ' / ' + rec.n + '</strong><span>bonnes réponses</span></div><div><strong>' + LQ.pct(rec.correct, rec.n) + ' %</strong><span>de réussite</span></div><div><strong>' + LQ.fmtDur(rec.dur) + '</strong><span>sur ' + LQ.fmtDur(rec.total) + '</span></div><div><strong>+' + (rec.xp || 0) + '</strong><span>XP gagnés</span></div></div>' +
      '<p class="lead">' + (rec.pass
        ? (rec.score >= 800 ? 'Au-dessus de 800 : c’est le niveau à tenir sur les examens A et B pour y aller serein.' : 'C’est réussi, mais la marge est mince. Vise 800 pour absorber le stress du jour J.')
        : 'Ce score sert à savoir où travailler. Regarde les domaines « à renforcer », lis chaque correction, puis rejoue les missions concernées.') +
      (first ? ' Les questions de cet examen rejoignent maintenant ta révision espacée.' : '') + '</p>' +
      '<div class="result-actions"><button type="button" class="btn primary" data-act="scroll-to" data-id="corr">Voir la correction</button><button type="button" class="btn ghost" data-act="exam-close">Retour aux examens</button><a class="btn ghost" href="#revision">Réviser mes erreurs</a></div></div>' +
      domainTable(rec.byDomain) +
      '<h2 class="sec-title" id="corr">Correction</h2><div class="seg small" role="group" aria-label="Filtre">' +
      [['wrong', 'Erreurs · ' + wrong.length], ['flag', 'Marquées · ' + flagged.length], ['all', 'Toutes · ' + items.length]].map((x) => '<button type="button" class="' + (f === x[0] ? 'on' : '') + '" data-act="exam-filter" data-id="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
      (list.length ? '<div class="rv-list">' + list.map((it) => LQ.reviewItemHTML(it, items.indexOf(it) + 1, false)).join('') + '</div>' : '<p class="all-good">' + icon('check') + 'Rien dans cette catégorie.</p>') + '</section>';
  }

  A['exam-filter'] = (el) => {
    UI.examFilter = el.dataset.id;
    const v = UI.examView, host = LQ.$('#view');
    if (!v || !host) return;
    const y = window.scrollY;
    host.innerHTML = resultHTML(v.rec, v.items);
    window.scrollTo(0, y);
  };
  A['exam-close'] = () => { UI.examView = null; LQ.route(); window.scrollTo(0, 0); };
  A['exam-open'] = (el) => {
    const rec = LQ.S.exams.find((e) => String(e.id) === el.dataset.id);
    if (!rec || !rec.detail) return;
    const items = rec.detail.map((x) => {
      if (!LQ.Q[x.id]) return null;
      const it = LQ.Quiz.makeItem(LQ.Q[x.id], x);
      it.done = true; it.ok = LQ.isRight(it);
      return it;
    }).filter(Boolean);
    UI.examView = { rec, items };
    UI.examFilter = 'wrong';
    LQ.route(); window.scrollTo(0, 0);
  };
})();
