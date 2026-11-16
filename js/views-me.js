/* LakeQuest — salle des trophées et profil (statistiques, réglages, sauvegarde). */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, icon = LQ.icon;
  const V = LQ.views, A = LQ.actions;
  LQ.changes = LQ.changes || {};

  /* ---------------------------------------------------------------- trophées */
  V.trophees = () => {
    const S = LQ.S, comp = LQ.completion();
    const tile = (t) => {
      const got = S.trophies[t.id], hid = t.h && !got;
      let prog = '';
      if (!got && !hid && t.p) {
        let p = [0, 1];
        try { p = t.p(); } catch (e) { /* données partielles */ }
        prog = '<div class="tro-p">' + LQ.bar(LQ.pct(Math.min(p[0], p[1]), p[1])) + '<span>' + Math.min(p[0], p[1]) + ' / ' + p[1] + '</span></div>';
      }
      return '<li class="tro g-' + t.g + (got ? ' got' : '') + (hid ? ' hid' : '') + '"><span class="medal g-' + t.g + '">' + icon(hid ? 'lock' : t.ic) + '</span><div><strong>' + (hid ? 'Trophée caché' : esc(t.n)) + '</strong><p>' + (hid ? 'Il se révélera quand tu l’auras mérité.' : esc(t.d)) + '</p>' + prog + '</div>' +
        (got ? '<span class="tro-date">' + LQ.fmtDate(got) + '</span>' : '<span class="tro-xp">+' + LQ.GRADE[t.g].xp + ' XP</span>') + '</li>';
    };
    const grades = [['p', 'Platine'], ['g', 'Or'], ['s', 'Argent'], ['b', 'Bronze']];
    const counts = grades.map((g) => { const all = LQ.TROPHIES.filter((t) => t.g === g[0]); return '<div class="tro-count g-' + g[0] + '"><span class="medal g-' + g[0] + '">' + icon('medal') + '</span><strong>' + all.filter((t) => S.trophies[t.id]).length + ' / ' + all.length + '</strong><span>' + g[1] + '</span></div>'; }).join('');
    return {
      html: '<header class="page-h"><p class="eyebrow">Complétion</p><h1>Salle des trophées</h1><p class="lead">Chaque mètre de profondeur est un pour cent du jeu terminé. À 100 m, le coffre s’ouvre.</p></header>' +
        '<section class="card depth"><div class="depth-lake">' + LQ.lakeSVG(comp.total) + '</div><div class="depth-parts"><p class="depth-n"><strong>' + comp.total.toLocaleString('fr-FR') + ' m</strong> sur 100</p>' +
        comp.parts.map((p) => '<a class="part" href="#' + p.to + '"><span class="part-h"><span>' + esc(p.label) + '</span><strong>' + p.cur + ' / ' + p.max + '</strong></span>' + LQ.bar(LQ.pct(p.cur, p.max), p.cur >= p.max && p.max ? 'ok' : '') + '<small>' + p.w + ' m à gagner</small></a>').join('') + '</div></section>' +
        '<div class="tro-counts">' + counts + '</div>' +
        grades.map((g) => '<h2 class="sec-title">' + g[1] + '</h2><ul class="tro-list">' + LQ.TROPHIES.filter((t) => t.g === g[0]).map(tile).join('') + '</ul>').join(''),
    };
  };

  /* ---------------------------------------------------------------- profil */
  function heatmap() {
    const S = LQ.S, today = LQ.dayKey();
    const dow = (new Date().getDay() + 6) % 7; // lundi = 0
    const start = LQ.addDays(today, -(11 * 7 + dow));
    let cols = '';
    for (let w = 0; w < 12; w++) {
      let col = '';
      for (let d = 0; d < 7; d++) {
        const k = LQ.addDays(start, w * 7 + d), rec = S.days[k], n = rec ? rec.q : 0;
        const lvl = k > today ? 'x' : n === 0 ? 0 : n < 10 ? 1 : n < 20 ? 2 : n < 40 ? 3 : 4;
        col += '<i class="hm l' + lvl + '" title="' + LQ.fmtDayKey(k) + ' : ' + n + ' question' + (n > 1 ? 's' : '') + '"></i>';
      }
      cols += '<div class="hm-col">' + col + '</div>';
    }
    return '<div class="heat" role="img" aria-label="Activité des 12 dernières semaines">' + cols + '</div><p class="hm-key">Moins <i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i> Plus</p>';
  }

  V.profil = () => {
    const S = LQ.S, lv = LQ.level(), c = S.cnt;
    const played = Object.keys(S.days).filter((k) => S.days[k].q > 0 || S.days[k].xp > 0).length;
    const stats = [
      [c.answered, 'questions répondues'], [LQ.pct(c.correct, c.answered) + ' %', 'de bonnes réponses'], [c.bestRun, 'meilleure série de réponses justes'],
      [played, played > 1 ? 'jours joués' : 'jour joué'], [S.streak.best, 'jours d’affilée (record)'], [S.exams.filter((e) => e.strict).length, 'examens en conditions réelles'],
    ];
    const topics = LQ.topics.map((t) => { const st = LQ.topicStat(t.id); return { t, st, p: LQ.pct(st.ok, st.total) }; }).sort((a, b) => a.p - b.p || a.st.seen - b.st.seen);
    const sel = (opts, cur) => opts.map((o) => '<option value="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>').join('');
    const sw = (k, label, hint) => '<label class="switch"><input type="checkbox" data-change="set-bool" data-k="' + k + '"' + (S.settings[k] ? ' checked' : '') + '><span></span><span><strong>' + label + '</strong><small>' + hint + '</small></span></label>';
    return {
      html: '<header class="page-h"><p class="eyebrow">Profil</p><h1>' + (S.name ? esc(S.name) : 'Ton profil') + '</h1></header>' +
        '<section class="card pad me"><span class="me-badge">' + icon('fish') + '<b>' + lv.lvl + '</b></span><div class="me-main"><strong>Niveau ' + lv.lvl + ' · ' + esc(lv.title) + '</strong><span>' + S.xp + ' XP' + (lv.max ? '' : ' · encore ' + (lv.next - S.xp) + ' XP avant le niveau ' + (lv.lvl + 1)) + '</span>' + LQ.bar(lv.pct, 'gold') + '</div></section>' +
        '<div class="stat-grid">' + stats.map((s) => '<div class="card stat"><strong>' + s[0] + '</strong><span>' + s[1] + '</span></div>').join('') + '</div>' +
        '<div class="two-col"><section><h2 class="sec-title">Activité</h2><div class="card pad">' + heatmap() + '</div>' +
        '<h2 class="sec-title">Réglages</h2><div class="card pad form">' +
        '<label class="field"><span>Ton prénom</span><input type="text" id="set-name" maxlength="24" value="' + esc(S.name) + '" data-change="set-name" autocomplete="given-name"></label>' +
        '<label class="field"><span>Date de ton examen</span><input type="date" id="set-date" value="' + esc(S.examDate) + '" data-change="set-date"></label>' +
        '<label class="field"><span>Objectif quotidien</span><select id="set-goal" data-change="set-goal">' + sel([[10, '10 questions'], [20, '20 questions'], [30, '30 questions'], [50, '50 questions']], S.settings.goal) + '</select></label>' +
        '<label class="field"><span>Apparence</span><select id="set-theme" data-change="set-theme">' + sel([['auto', 'Comme mon appareil'], ['light', 'Claire'], ['dark', 'Sombre']], S.settings.theme) + '</select></label>' +
        sw('esl', 'Temps ESL +30 minutes par défaut', 'Pour les examens blancs, si tu as demandé cet aménagement.') + sw('fx', 'Animations', 'Paquets animés, confettis.') + sw('sound', 'Sons', 'Un petit signal à chaque réponse.') + '</div></section>' +
        '<section><h2 class="sec-title">Thèmes, du plus fragile au plus solide</h2><div class="card table-wrap"><table class="topic-table"><tbody>' +
        topics.map((x) => '<tr><td><a href="#mission-' + x.t.id + '"><strong>' + esc(x.t.name) + '</strong></a><span class="dom d' + x.t.d + '">D' + x.t.d + '</span></td><td><div class="cellbar">' + LQ.bar(x.p, 'd' + x.t.d) + '<span>' + x.st.ok + ' / ' + x.st.total + '</span></div></td></tr>').join('') + '</tbody></table></div></section></div>' +
        (LQ.packs ? LQ.packs.panelHTML() : '') + '<h2 class="sec-title">Sauvegarde</h2><div class="two-col"><div class="card pad"><h3>Exporter</h3><p class="small">Ta progression vit dans ce navigateur. Copie ce code pour la transférer sur un autre appareil ou la mettre à l’abri.</p><textarea id="save-out" readonly rows="3" aria-label="Code de sauvegarde"></textarea><button type="button" class="btn ghost" data-act="save-copy">' + icon('copy') + 'Copier le code</button></div>' +
        '<div class="card pad"><h3>Importer</h3><p class="small">Colle un code de sauvegarde. Il remplace la progression de ce navigateur.</p><textarea id="save-in" rows="3" placeholder="LQ1…" aria-label="Code à importer"></textarea><div class="row"><button type="button" class="btn ghost" data-act="save-import">Importer</button><button type="button" class="btn danger" data-act="save-reset">Tout effacer</button></div></div></div>' +
        '<p class="about">LakeQuest ' + LQ.APP.version + ' · ' + LQ.questions.length + ' questions originales, ' + LQ.flows.length + ' flux animés, ' + LQ.cards.length + ' fiches. Projet indépendant, sans lien avec Amazon Web Services. Aucune question ne provient de l’examen réel.</p>',
      mount() { const o = LQ.$('#save-out'); if (o) o.value = LQ.exportSave(); },
    };
  };

  LQ.changes['set-name'] = (el) => { LQ.S.name = el.value.trim().slice(0, 24); LQ.save(); LQ.toast('Prénom enregistré.', 'ok'); };
  LQ.changes['set-date'] = (el) => { LQ.S.examDate = /^\d{4}-\d{2}-\d{2}$/.test(el.value) ? el.value : ''; LQ.save(); LQ.toast(LQ.S.examDate ? 'Examen noté pour le ' + LQ.fmtDayKey(LQ.S.examDate) + '.' : 'Date effacée.', 'ok'); };
  LQ.changes['set-goal'] = (el) => { LQ.S.settings.goal = +el.value || 20; LQ.save(); };
  LQ.changes['set-theme'] = (el) => { LQ.S.settings.theme = el.value; LQ.save(); LQ.applyTheme(); };
  LQ.changes['set-bool'] = (el) => { LQ.S.settings[el.dataset.k] = el.checked; LQ.save(); if (el.dataset.k === 'sound' && el.checked) LQ.sfx('ok'); };

  A['save-copy'] = () => {
    const o = LQ.$('#save-out');
    if (!o) return;
    const done = () => LQ.toast('Code copié.', 'ok', 'copy');
    const fallback = () => { o.focus(); o.select(); LQ.toast('Code sélectionné : copie-le avec Ctrl + C.', 'warn'); };
    try { navigator.clipboard.writeText(o.value).then(done, fallback); } catch (e) { fallback(); }
  };
  A['save-import'] = () => {
    const i = LQ.$('#save-in');
    if (!i || !i.value.trim()) { LQ.toast('Colle d’abord un code de sauvegarde.', 'warn'); return; }
    const text = i.value;
    LQ.modal({ title: 'Remplacer ta progression ?', html: '<p>La progression de ce navigateur sera remplacée par celle du code collé.</p>', actions: [{ id: 'no', label: 'Annuler', kind: 'ghost' }, { id: 'yes', label: 'Importer', kind: 'primary' }] })
      .then((a) => {
        if (a !== 'yes') return;
        if (LQ.importSave(text)) { LQ.applyTheme(); LQ.toast('Progression importée.', 'ok'); LQ.route(); }
        else LQ.toast('Ce code n’est pas une sauvegarde LakeQuest valide.', 'ko');
      });
  };
  A['save-reset'] = () => {
    LQ.modal({
      title: 'Tout effacer ?',
      html: '<p>Niveaux, trophées, statistiques et historique d’examens seront supprimés de ce navigateur. C’est définitif.</p><label class="field"><span>Tape EFFACER pour confirmer</span><input type="text" name="confirm" autocomplete="off"></label>',
      actions: [{ id: 'no', label: 'Annuler', kind: 'ghost' }, { id: 'yes', label: 'Effacer ma progression', kind: 'danger' }],
    }).then((a) => {
      if (a !== 'yes') return;
      if (String((LQ.modalData || {}).confirm || '').trim().toUpperCase() !== 'EFFACER') { LQ.toast('Rien n’a été effacé : il fallait taper EFFACER.', 'warn'); return; }
      LQ.resetSave(); LQ.S.settings.onboarded = true; LQ.save(); LQ.applyTheme();
      LQ.toast('Progression effacée.', 'ok'); LQ.route();
    });
  };
})();
