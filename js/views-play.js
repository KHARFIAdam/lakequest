/* LakeQuest — vues de jeu : accueil, missions, gardiens, défi du jour, révision, blitz, chantier. */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, icon = LQ.icon, rich = LQ.rich;
  const V = (LQ.views = LQ.views || {});
  const A = LQ.actions;
  const UI = (LQ.ui = LQ.ui || {});

  /* ---------------------------------------------------------------- petits composants */
  LQ.bar = (p, cls) => '<div class="bar ' + (cls || '') + '"><i style="width:' + LQ.clamp(Math.round(p), 0, 100) + '%"></i></div>';
  LQ.ring = (p, size, txt, cls) => {
    const r = 15.5, c = 2 * Math.PI * r;
    return '<svg class="ring ' + (cls || '') + '" viewBox="0 0 36 36" width="' + size + '" height="' + size + '" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="' + r + '"/><circle class="ring-fg" cx="18" cy="18" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - LQ.clamp(p, 0, 100) / 100)).toFixed(2) + '" transform="rotate(-90 18 18)"/>' +
      (txt != null ? '<text x="18" y="22" text-anchor="middle">' + esc(txt) + '</text>' : '') + '</svg>';
  };
  const stars = (n) => LQ.Quiz.starsHTML(n);

  /* Coupe du lac : la profondeur atteinte est le pourcentage de complétion du jeu. */
  LQ.lakeSVG = (p) => {
    const t = LQ.clamp(p / 100, 0, 1);
    const P0 = [64, 46], P1 = [210, 214], P2 = [462, 216];
    const B = (u) => [(1 - u) * (1 - u) * P0[0] + 2 * (1 - u) * u * P1[0] + u * u * P2[0], (1 - u) * (1 - u) * P0[1] + 2 * (1 - u) * u * P1[1] + u * u * P2[1]];
    const pos = B(t);
    const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const water = 'M0 40H640V96C590 160 540 226 462 232C380 238 250 222 150 176C80 144 30 104 0 84Z';
    const lines = [25, 50, 75, 100].map((d) => { const y = 40 + d * 1.76; return '<line class="lk-line" x1="0" x2="640" y1="' + y + '" y2="' + y + '"/>'; }).join('');
    const labs = [25, 50, 75, 100].map((d) => '<text class="lk-depth" x="636" y="' + (40 + d * 1.76 - 7) + '" text-anchor="end">' + d + ' m</text>').join('');
    const marks = [25, 50, 75].map((m) => { const b = B(m / 100); return '<circle class="lk-mark' + (p >= m ? ' on' : '') + '" cx="' + b[0].toFixed(1) + '" cy="' + b[1].toFixed(1) + '" r="4.5"/>'; }).join('');
    const lx = LQ.clamp(pos[0] + 22, 20, 548), ly = Math.max(24, pos[1] - 26);
    return '<svg class="lake" viewBox="0 0 640 250" role="img" aria-label="Profondeur atteinte : ' + Math.floor(p) + ' mètres sur 100"><defs><linearGradient id="lkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="lk-s1"/><stop offset="1" class="lk-s2"/></linearGradient><clipPath id="lkc"><path d="' + water + '"/></clipPath></defs>' +
      '<path d="' + water + '" fill="url(#lkg)"/><g clip-path="url(#lkc)">' + lines + '</g>' + labs + '<path class="lk-surf" d="M0 40H640"/>' +
      '<path class="lk-path" d="M64 46Q210 214 462 216"/>' + marks +
      '<g class="lk-chest' + (p >= 100 ? ' on' : '') + '" transform="translate(470 203)"><rect x="0" y="8" width="24" height="13" rx="2"/><path d="M0 9a12 9 0 0 1 24 0z"/><rect class="lk-lockp" x="10" y="7" width="4" height="6" rx="1"/></g>' +
      '<g transform="translate(' + pos[0].toFixed(1) + ' ' + pos[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ') scale(-2.2 2.2) translate(-12 -12)"><path class="lk-fish" d="M3 12c3.200-4.600 9.800-5.600 14-2.300L21 6.500v11l-4-3.200c-4.200 3.300-10.800 2.300-14-2.300z"/><circle class="lk-eye" cx="8" cy="11" r="1.100"/></g>' +
      '<g transform="translate(' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')"><rect class="lk-tag" x="0" y="-19" width="76" height="28" rx="14"/><text class="lk-tagt" x="38" y="0.500" text-anchor="middle">' + Math.floor(p) + ' m</text></g></svg>';
  };

  /* ---------------------------------------------------------------- sélection de questions */
  /* Priorité : jamais vues, puis ratées la dernière fois, puis les plus anciennes. */
  LQ.pickQs = (pool, n, rnd) => {
    const S = LQ.S;
    const score = (q) => { const s = S.q[q.id]; if (!s || !s.n) return 0; if (!s.lastOk) return 1; return 2 + s.box; };
    const groups = {};
    LQ.shuffle(pool, rnd).forEach((q) => { const k = score(q); (groups[k] = groups[k] || []).push(q); });
    let out = [];
    Object.keys(groups).map(Number).sort((a, b) => a - b).forEach((k) => { out = out.concat(groups[k]); });
    return LQ.shuffle(out.slice(0, n), rnd);
  };

  function nextMission() {
    const S = LQ.S;
    return LQ.topics.find((t) => !S.missions[t.id]) || LQ.topics.slice().sort((a, b) => ((S.missions[a.id] || {}).stars || 0) - ((S.missions[b.id] || {}).stars || 0))[0];
  }
  function dailyDone() { return LQ.S.daily.done[LQ.dayKey()]; }

  /* ---------------------------------------------------------------- accueil */
  V.accueil = () => {
    const S = LQ.S, lv = LQ.level(), comp = LQ.completion(), due = LQ.dueList().length, today = LQ.today();
    const dleft = LQ.daysUntil(S.examDate), streak = LQ.streakNow(), ready = LQ.readiness();
    const goalP = LQ.pct(Math.min(today.q, S.settings.goal), S.settings.goal);
    const lastFull = S.exams.filter((e) => e.strict).slice(-1)[0];
    let count;
    if (dleft == null) count = '<a class="hero-date" href="#profil">' + icon('calendar') + 'Indique la date de ton examen</a>';
    else if (dleft > 0) count = '<span class="hero-date">' + icon('calendar') + 'Examen dans <strong>' + LQ.plural(dleft, 'jour') + '</strong> · ' + LQ.fmtDayKey(S.examDate) + '</span>';
    else if (dleft === 0) count = '<span class="hero-date">' + icon('calendar') + '<strong>C’est aujourd’hui.</strong> Respire, tu es prêt.</span>';
    else count = '<a class="hero-date" href="#profil">' + icon('calendar') + 'Examen passé ? Mets ta date à jour</a>';

    /* suggestions : dans l'ordre d'utilité */
    const sug = [];
    if (S.examRun) sug.push({ href: '#examen', ic: 'clock', k: 'Examen en cours', t: S.examRun.title, s: 'Le chronomètre tourne : reprends vite.' });
    if (!dailyDone()) sug.push({ href: '#quotidien', ic: 'calendar', k: 'Défi du jour', t: '10 questions, les mêmes pour tous', s: '+30 XP et un jour de plus dans ta série.' });
    if (due) sug.push({ href: '#revision', ic: 'repeat', k: 'Révision espacée', t: LQ.plural(due, 'question') + ' à revoir', s: 'Le bon moment pour les ancrer.' });
    const nm = nextMission();
    if (nm) sug.push({ href: '#mission-' + nm.id, ic: 'target', k: S.missions[nm.id] ? 'Mission à améliorer' : 'Nouvelle mission', t: nm.name, s: nm.blurb });
    const nf = LQ.flows.find((f) => !(S.flows[f.id] || {}).done);
    if (nf) sug.push({ href: '#flux-' + nf.id, ic: 'wave', k: 'Flux animé', t: nf.title, s: nf.sub });
    if (!S.examRun && !(S.forms.A || {}).tries) sug.push({ href: '#examen', ic: 'clock', k: 'Examen blanc inédit', t: 'Examen A · 65 questions', s: 'Conditions réelles, score sur 1 000.' });

    const modes = [
      { href: '#jouer', ic: 'target', t: 'Missions', s: LQ.totalStars() + ' / ' + LQ.topics.length * 3 + ' étoiles' },
      { href: '#examen', ic: 'clock', t: 'Examen blanc', s: lastFull ? 'Dernier score : ' + lastFull.score : '65 questions, 130 minutes' },
      { href: '#explorer', ic: 'wave', t: 'Flux animés', s: LQ.flows.filter((f) => (S.flows[f.id] || {}).done).length + ' / ' + LQ.flows.length + ' validés' },
      { href: '#blitz', ic: 'bolt', t: 'Blitz', s: 'Record : ' + Math.max(0, ...Object.values(S.blitz.best)) + ' pts' },
      { href: '#chantier', ic: 'layers', t: 'Chantier', s: LQ.scenarios.filter((s) => (S.scen[s.id] || {}).perfect).length + ' / ' + LQ.scenarios.length + ' sans erreur' },
      { href: '#revision', ic: 'repeat', t: 'Révision', s: due ? LQ.plural(due, 'question') + ' à revoir' : 'Rien à revoir pour l’instant' },
    ];

    const doms = LQ.domains.map((d) => {
      const st = LQ.domainStat(d.id), p = LQ.pct(st.ok, st.total);
      return '<div class="dom-row"><div class="dom-row-h"><span class="dom d' + d.id + '">Domaine ' + d.id + '</span><strong>' + esc(d.name) + '</strong><span class="dom-w">' + d.w + ' % de l’examen</span></div>' +
        LQ.bar(p, 'd' + d.id) + '<div class="dom-row-f"><span>' + st.ok + ' / ' + st.total + ' questions justes au dernier essai</span><strong>' + p + ' %</strong></div></div>';
    }).join('');

    const recent = LQ.TROPHIES.filter((t) => S.trophies[t.id]).sort((a, b) => S.trophies[b.id] - S.trophies[a.id]).slice(0, 4);
    const html =
      '<section class="hero"><div class="hero-main"><p class="eyebrow">Niveau ' + lv.lvl + ' · ' + esc(lv.title) + '</p>' +
      '<h1>' + (S.name ? 'Salut ' + esc(S.name) + '.' : 'Bienvenue.') + ' <span>Fini de buller.</span></h1>' + count +
      '<div class="hero-xp"><div class="hero-xp-h"><span>' + S.xp + ' XP</span><span>' + (lv.max ? 'Niveau maximum' : 'Niveau ' + (lv.lvl + 1) + ' à ' + lv.next + ' XP') + '</span></div>' + LQ.bar(lv.pct, 'gold') + '</div>' +
      '<div class="hero-chips"><div class="hchip">' + LQ.ring(goalP, 44, null, 'gold') + '<div><strong>' + today.q + ' / ' + S.settings.goal + '</strong><span>questions aujourd’hui</span></div></div>' +
      '<div class="hchip"><span class="hchip-ic' + (streak ? ' hot' : '') + '">' + icon('flame') + '</span><div><strong>' + LQ.plural(streak, 'jour') + '</strong><span>de série · record ' + S.streak.best + '</span></div></div>' +
      '<div class="hchip"><span class="hchip-ic">' + icon('chart') + '</span><div><strong>' + ready + ' %</strong><span>indice de préparation</span></div></div></div></div>' +
      '<a class="hero-lake" href="#trophees" aria-label="Complétion du jeu">' + LQ.lakeSVG(comp.total) + '<p><strong>' + comp.total.toLocaleString('fr-FR') + ' m sur 100</strong> · le trésor est au fond du lac</p></a></section>' +

      '<h2 class="sec-title">À faire maintenant</h2><div class="sug-grid">' +
      sug.slice(0, 3).map((s) => '<a class="sug card" href="' + s.href + '"><span class="sug-ic">' + icon(s.ic) + '</span><span class="sug-k">' + esc(s.k) + '</span><strong>' + esc(s.t) + '</strong><span class="sug-s">' + esc(s.s) + '</span><span class="sug-go">' + icon('right') + '</span></a>').join('') + '</div>' +

      '<h2 class="sec-title">Tous les modes</h2><div class="mode-grid">' +
      modes.map((m) => '<a class="mode" href="' + m.href + '"><span class="mode-ic">' + icon(m.ic) + '</span><span><strong>' + esc(m.t) + '</strong><small>' + esc(m.s) + '</small></span></a>').join('') + '</div>' +

      '<div class="two-col"><div><h2 class="sec-title">Ta préparation par domaine</h2><div class="card pad">' + doms +
      '<p class="note">' + icon('info') + '<span>Règle simple pour savoir si tu es prêt : <strong>800 ou plus aux examens A et B</strong>, dès la première tentative.</span></p></div></div>' +
      '<div><h2 class="sec-title">Derniers trophées</h2><div class="card pad">' +
      (recent.length ? '<ul class="tro-mini">' + recent.map((t) => '<li><span class="medal g-' + t.g + '">' + icon(t.ic) + '</span><div><strong>' + esc(t.n) + '</strong><span>' + esc(t.d) + '</span></div></li>').join('') + '</ul>'
        : '<p class="empty">Ton premier trophée t’attend à la première question.</p>') +
      '<a class="btn ghost full" href="#trophees">Voir la salle des trophées · ' + Object.keys(S.trophies).length + ' / ' + LQ.TROPHIES.length + '</a></div></div></div>';
    return { html };
  };

  /* ---------------------------------------------------------------- missions */
  function bossState(d) {
    const ms = LQ.topics.filter((t) => t.d === d.id);
    const started = ms.filter((t) => ((LQ.S.missions[t.id] || {}).stars || 0) >= 1).length;
    const needN = Math.ceil(ms.length / 2);
    return { open: started >= needN, started, needN, rec: LQ.S.boss[d.id] || {} };
  }
  V.jouer = () => {
    const S = LQ.S, due = LQ.dueList().length;
    const quick = [
      { href: '#quotidien', ic: 'calendar', t: 'Défi du jour', s: dailyDone() != null ? 'Fait · ' + dailyDone() + ' %' : '10 questions · +30 XP', done: dailyDone() != null },
      { href: '#revision', ic: 'repeat', t: 'Révision', s: due ? due + ' à revoir' : 'À jour' },
      { href: '#blitz', ic: 'bolt', t: 'Blitz', s: '60 secondes' },
      { href: '#chantier', ic: 'layers', t: 'Chantier', s: 'Assemble un pipeline' },
    ];
    const worlds = LQ.domains.map((d) => {
      const ms = LQ.topics.filter((t) => t.d === d.id);
      const got = ms.reduce((a, t) => a + ((S.missions[t.id] || {}).stars || 0), 0);
      const bs = bossState(d);
      const tiles = ms.map((t) => {
        const m = S.missions[t.id] || {};
        const n = LQ.trainQs(t.id).length;
        return '<a class="mission" href="#mission-' + t.id + '"><span class="mission-top">' + stars(m.stars || 0) + (m.plays ? '<span class="mission-best">' + m.best + ' %</span>' : '<span class="tag new">Nouveau</span>') + '</span>' +
          '<strong>' + esc(t.name) + '</strong><span class="mission-blurb">' + esc(t.blurb) + '</span><span class="mission-n">' + n + ' questions en réserve</span></a>';
      }).join('');
      const boss = '<a class="mission boss' + (bs.open ? '' : ' locked') + (bs.rec.won ? ' won' : '') + '" href="#boss-' + d.id + '"><span class="mission-top"><span class="boss-ic">' + icon(bs.open ? 'shield' : 'lock') + '</span>' +
        (bs.rec.won ? '<span class="tag ok">Vaincu</span>' : bs.rec.plays ? '<span class="mission-best">' + bs.rec.best + ' %</span>' : '') + '</span>' +
        '<strong>Gardien du domaine ' + d.id + '</strong><span class="mission-blurb">15 questions mélangées, 20 minutes. 80 % pour le vaincre.</span>' +
        '<span class="mission-n">' + (bs.open ? 'Ouvert' : 'S’ouvre avec ' + bs.needN + ' missions à 1 étoile ou plus (' + bs.started + ' / ' + bs.needN + ')') + '</span></a>';
      return '<section class="world"><header class="world-h"><span class="dom d' + d.id + '">Domaine ' + d.id + '</span><div><h2>' + esc(d.name) + '</h2><p>' + esc(d.en) + ' · ' + d.w + ' % de l’examen</p></div>' +
        '<div class="world-stars">' + icon('star', 'on') + '<strong>' + got + '</strong> / ' + ms.length * 3 + '</div></header><div class="mission-grid">' + tiles + boss + '</div></section>';
    }).join('');
    return {
      html: '<header class="page-h"><p class="eyebrow">Entraînement</p><h1>Missions</h1><p class="lead">Une mission, c’est 8 questions sur un thème, corrigées une par une. 1 étoile à 60 %, 2 à 80 %, 3 pour un sans-faute. Enchaîne une mission juste après la section du cours qui lui correspond.</p></header>' +
        '<div class="quick-row">' + quick.map((q) => '<a class="quick' + (q.done ? ' done' : '') + '" href="' + q.href + '">' + icon(q.ic) + '<span><strong>' + esc(q.t) + '</strong><small>' + esc(q.s) + '</small></span></a>').join('') + '</div>' + worlds,
    };
  };

  function topicLinks(t) {
    const fl = (t.flows || []).map((id) => LQ.flowMap[id]).filter(Boolean);
    const cs = (t.cards || []).map((id) => LQ.cardMap[id]).filter(Boolean);
    if (!fl.length && !cs.length) return '';
    return '<div class="prep"><h3>Réviser avant de jouer</h3><div class="prep-links">' +
      fl.map((f) => '<a class="chip big" href="#flux-' + f.id + '">' + icon('wave') + esc(f.title) + '</a>').join('') +
      cs.map((c) => '<button type="button" class="chip" data-act="card-peek" data-id="' + esc(c.id) + '">' + icon('book') + esc(c.s || c.n) + '</button>').join('') + '</div></div>';
  }

  V.mission = (id) => {
    const t = LQ.topicMap[id];
    if (!t) return V.jouer();
    const d = LQ.domainMap[t.d], m = LQ.S.missions[id] || {}, pool = LQ.trainQs(id), st = LQ.statOf(pool);
    return {
      html: '<a class="back" href="#jouer">' + icon('left') + 'Missions</a><section class="intro card"><span class="dom d' + t.d + '">Domaine ' + t.d + ' · ' + esc(d.name) + '</span><h1>' + esc(t.name) + '</h1><p class="lead">' + esc(t.blurb) + '</p>' +
        '<div class="intro-stats"><div>' + stars(m.stars || 0) + '<span>' + (m.plays ? 'meilleur score ' + m.best + ' %' : 'jamais jouée') + '</span></div><div><strong>' + Math.min(8, pool.length) + '</strong><span>questions par partie</span></div><div><strong>' + st.ok + ' / ' + st.total + '</strong><span>justes au dernier essai</span></div></div>' +
        '<button type="button" class="btn primary big" data-act="mission-start" data-id="' + esc(id) + '">' + (m.plays ? 'Rejouer la mission' : 'Lancer la mission') + icon('right') + '</button>' + topicLinks(t) + '</section>',
    };
  };

  A['mission-start'] = (el) => {
    const id = el.dataset.id, t = LQ.topicMap[id];
    if (!t) return;
    const qs = LQ.pickQs(LQ.trainQs(id), 8);
    LQ.Quiz.start({
      kind: 'mission', title: t.name, eyebrow: 'Mission · domaine ' + t.d, qs, back: '#mission-' + id,
      onDone(res) {
        const S = LQ.S, prev = S.missions[id] || { best: 0, stars: 0, plays: 0 };
        const st = LQ.Quiz.starsFor(res.pct);
        const bonus = st * 10 + (st === 3 && prev.stars < 3 ? 30 : 0);
        S.missions[id] = { best: Math.max(prev.best, res.pct), stars: Math.max(prev.stars, st), plays: prev.plays + 1 };
        LQ.addXp(bonus);
        const i = LQ.topics.indexOf(t), nx = LQ.topics[(i + 1) % LQ.topics.length];
        return {
          eyebrow: 'Mission · ' + t.name, stars: st, bonus,
          title: st === 3 ? 'Sans-faute.' : st === 2 ? 'Très solide.' : st === 1 ? 'Mission réussie.' : 'Pas encore.',
          lead: st === 3 ? 'Trois étoiles : ce thème est acquis.' : st >= 1 ? 'Rejoue pour décrocher les étoiles qui manquent : les questions ratées reviennent en priorité.' : 'Il faut 60 % pour une étoile. Lis les corrections ci-dessous, puis retente.',
          actions: [{ label: 'Rejouer', act: 'mission-start', arg: id, kind: st < 3 ? 'primary' : 'ghost' }, { label: 'Mission suivante : ' + nx.name, href: '#mission-' + nx.id, kind: st === 3 ? 'primary' : 'ghost' }, { label: 'Toutes les missions', href: '#jouer' }],
        };
      },
    });
  };

  /* ---------------------------------------------------------------- gardien (boss) */
  V.boss = (arg) => {
    const d = LQ.domainMap[+arg];
    if (!d) return V.jouer();
    const bs = bossState(d);
    return {
      html: '<a class="back" href="#jouer">' + icon('left') + 'Missions</a><section class="intro card boss-intro"><span class="dom d' + d.id + '">Domaine ' + d.id + '</span><h1>Gardien · ' + esc(d.name) + '</h1>' +
        '<p class="lead">15 questions tirées de tout le domaine, 20 minutes au chronomètre, correction immédiate. Il faut <strong>12 bonnes réponses</strong> pour le vaincre.</p>' +
        '<div class="intro-stats"><div><strong>' + (bs.rec.plays || 0) + '</strong><span>tentatives</span></div><div><strong>' + (bs.rec.best != null ? bs.rec.best + ' %' : '—') + '</strong><span>meilleur score</span></div><div><strong>' + (bs.rec.won ? 'Vaincu' : 'Debout') + '</strong><span>état du gardien</span></div></div>' +
        (bs.open ? '<button type="button" class="btn primary big" data-act="boss-start" data-id="' + d.id + '">Affronter le gardien' + icon('right') + '</button>'
          : '<p class="note">' + icon('lock') + '<span>Obtiens au moins 1 étoile sur ' + bs.needN + ' missions de ce domaine pour ouvrir le passage (' + bs.started + ' / ' + bs.needN + ').</span></p>') + '</section>',
    };
  };
  A['boss-start'] = (el) => {
    const d = LQ.domainMap[+el.dataset.id];
    if (!d) return;
    const qs = LQ.pickQs(LQ.byDomain[d.id].filter((q) => !q.x), 15);
    LQ.Quiz.start({
      kind: 'boss', title: 'Gardien du domaine ' + d.id, eyebrow: d.name, qs, seconds: 20 * 60, back: '#boss-' + d.id,
      onDone(res) {
        const S = LQ.S, prev = S.boss[d.id] || { best: 0, won: false, plays: 0 };
        const won = res.pct >= 80;
        const bonus = won && !prev.won ? 60 : 0;
        S.boss[d.id] = { best: Math.max(prev.best || 0, res.pct), won: prev.won || won, plays: (prev.plays || 0) + 1 };
        LQ.addXp(bonus);
        if (won) LQ.confetti();
        return { eyebrow: 'Gardien · ' + d.name, bonus, tone: won ? 'good' : 'low', title: won ? 'Gardien vaincu.' : 'Le gardien tient bon.', lead: won ? 'Ce domaine ne te fait plus peur.' : 'Il te faut 80 %. Reprends les missions les plus faibles de ce domaine.' + (res.timeUp ? ' Le temps s’est écoulé avant la fin.' : ''),
          actions: [{ label: 'Réessayer', act: 'boss-start', arg: String(d.id), kind: won ? 'ghost' : 'primary' }, { label: 'Retour aux missions', href: '#jouer', kind: won ? 'primary' : 'ghost' }] };
      },
    });
  };

  /* ---------------------------------------------------------------- défi du jour */
  function dailyQs() {
    const rnd = LQ.rng(LQ.hashStr('lakequest-daily-' + LQ.dayKey()));
    const split = { 1: 3, 2: 3, 3: 2, 4: 2 };
    let out = [];
    LQ.domains.forEach((d) => { out = out.concat(LQ.shuffle(LQ.byDomain[d.id].filter((q) => !q.x), rnd).slice(0, split[d.id])); });
    return LQ.shuffle(out, rnd);
  }
  V.quotidien = () => {
    const S = LQ.S, done = dailyDone();
    const week = [];
    for (let i = 6; i >= 0; i--) { const k = LQ.addDays(LQ.dayKey(), -i); week.push({ k, v: S.daily.done[k] }); }
    return {
      html: '<a class="back" href="#jouer">' + icon('left') + 'Missions</a><section class="intro card"><p class="eyebrow">' + LQ.fmtDayKey(LQ.dayKey()) + '</p><h1>Défi du jour</h1>' +
        '<p class="lead">10 questions couvrant les 4 domaines, identiques pour tous les joueurs aujourd’hui. Un essai compte : <strong>+30 XP</strong> à la première partie du jour.</p>' +
        '<div class="week">' + week.map((w) => '<div class="wk' + (w.v != null ? ' on' : '') + '"><i>' + (w.v != null ? icon('check') : '') + '</i><span>' + ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][new Date(w.k.split('-')[0], w.k.split('-')[1] - 1, w.k.split('-')[2]).getDay()] + '</span></div>').join('') + '</div>' +
        (done != null ? '<p class="note ok">' + icon('check') + '<span>Défi du jour réussi à <strong>' + done + ' %</strong>. Reviens demain pour le suivant.</span></p>' : '') +
        '<button type="button" class="btn ' + (done != null ? 'ghost' : 'primary') + ' big" data-act="daily-start">' + (done != null ? 'Rejouer pour le plaisir' : 'Relever le défi') + icon('right') + '</button>' +
        '<p class="small">' + LQ.plural(S.daily.count, 'défi relevé', 'défis relevés') + ' au total.</p></section>',
    };
  };
  A['daily-start'] = () => {
    const first = dailyDone() == null;
    LQ.Quiz.start({
      kind: 'daily', title: 'Défi du jour', eyebrow: LQ.fmtDayKey(LQ.dayKey()), qs: dailyQs(), back: '#quotidien',
      onDone(res) {
        const bonus = first ? 30 : 0;
        if (first) { LQ.S.daily.done[LQ.dayKey()] = res.pct; LQ.S.daily.count++; LQ.addXp(bonus); }
        return { eyebrow: 'Défi du jour', bonus, title: res.pct >= 80 ? 'Belle marée.' : res.pct >= 60 ? 'Défi relevé.' : 'Marée basse.', lead: first ? 'Bonus du jour encaissé. À demain pour le prochain défi.' : 'Partie hors bonus : le défi du jour ne compte qu’une fois.',
          actions: [{ label: 'Faire une mission', href: '#jouer', kind: 'primary' }, { label: 'Accueil', href: '#accueil' }] };
      },
    });
  };

  /* ---------------------------------------------------------------- révision espacée */
  V.revision = () => {
    const S = LQ.S, due = LQ.dueList();
    const boxes = [0, 0, 0, 0, 0, 0];
    let seen = 0;
    LQ.openQs().forEach((q) => { const s = S.q[q.id]; if (s && s.n) { boxes[s.box]++; seen++; } });
    const max = Math.max(1, ...boxes);
    const hard = LQ.openQs().filter((q) => (S.q[q.id] || {}).wr > 0).sort((a, b) => S.q[b.id].wr - S.q[a.id].wr);
    return {
      html: '<header class="page-h"><p class="eyebrow">Mémoire</p><h1>Révision espacée</h1><p class="lead">Chaque question déjà vue revient au bon moment : dès le lendemain si tu viens de la réussir, puis à 3 jours, 1 semaine, 2 semaines. Une erreur la renvoie au départ.</p></header>' +
        '<div class="two-col"><section class="card pad"><h2>À revoir maintenant</h2><p class="big-n">' + due.length + '</p><p class="small">' + (due.length ? 'questions arrivées à échéance' : seen ? 'Tout est à jour. Reviens demain, ou travaille tes erreurs les plus fréquentes.' : 'Joue une première mission : tes questions arriveront ici.') + '</p>' +
        (due.length ? '<button type="button" class="btn primary big" data-act="review-start" data-id="due">Réviser ' + Math.min(15, due.length) + ' questions' + icon('right') + '</button>' : '') +
        (hard.length ? '<button type="button" class="btn ghost full" data-act="review-start" data-id="hard">Retravailler mes ' + Math.min(10, hard.length) + ' pires erreurs</button>' : '') + '</section>' +
        '<section class="card pad"><h2>Tes boîtes de mémoire</h2><div class="boxes">' + boxes.map((n, i) => '<div class="box-col"><div class="box-bar"><i style="height:' + Math.round((100 * n) / max) + '%"></i></div><strong>' + n + '</strong><span>' + LQ.BOX_LABEL[i] + '</span></div>').join('') + '</div>' +
        '<p class="small">' + seen + ' questions déjà rencontrées sur ' + LQ.openQs().length + ' disponibles.</p></section></div>',
    };
  };
  A['review-start'] = (el) => {
    const S = LQ.S, mode = el.dataset.id;
    const qs = mode === 'hard' ? LQ.openQs().filter((q) => (S.q[q.id] || {}).wr > 0).sort((a, b) => S.q[b.id].wr - S.q[a.id].wr).slice(0, 10) : LQ.dueList().slice(0, 15);
    if (!qs.length) return;
    LQ.Quiz.start({
      kind: 'review', title: mode === 'hard' ? 'Pires erreurs' : 'Révision espacée', eyebrow: 'Révision', qs: LQ.shuffle(qs), xpPer: 8, back: '#revision',
      onDone(res) { return { eyebrow: 'Révision', title: res.pct >= 80 ? 'Mémoire rafraîchie.' : 'Ça revient.', lead: 'Les réponses justes passent dans la boîte suivante, les autres reviennent dans quelques minutes.', actions: [{ label: 'Retour à la révision', href: '#revision', kind: 'primary' }, { label: 'Accueil', href: '#accueil' }] }; },
    });
  };

  /* ---------------------------------------------------------------- séance libre (fiche du codex, tâche du guide) */
  LQ.startCustom = (title, eyebrow, pool, back) => {
    const qs = LQ.pickQs(LQ.openQs(pool), 10);
    if (!qs.length) { LQ.toast('Pas encore de question disponible ici.', 'warn'); return; }
    LQ.Quiz.start({ kind: 'custom', title, eyebrow, qs, back, onDone() { return { eyebrow, title: 'Séance terminée.', actions: [{ label: 'Retour', href: back, kind: 'primary' }] }; } });
  };
  V.tache = (arg) => {
    const ts = String(arg || '').replace('-', '.');
    const pool = LQ.questions.filter((q) => q.ts === ts);
    if (!LQ.tasks[ts] || !pool.length) return V.codex ? V.codex() : V.jouer();
    return { html: '<p class="empty">Chargement de la séance…</p>', mount() { LQ.startCustom(LQ.tasks[ts], 'Tâche ' + ts, pool, '#codex'); } };
  };

  /* ---------------------------------------------------------------- blitz */
  const BL = { deck: 'services', state: 'menu' };
  function blitzOpts(card) {
    const all = Array.from(new Set(LQ.blitz.services.filter((c) => c.g === card.g).map((c) => c.a))).filter((a) => a !== card.a);
    return LQ.shuffle([card.a].concat(LQ.shuffle(all).slice(0, 3)));
  }
  function blitzPaint() {
    const host = LQ.$('#view');
    if (!host) return;
    const best = LQ.S.blitz.best;
    if (BL.state === 'menu') {
      host.innerHTML = '<header class="page-h"><p class="eyebrow">Réflexes</p><h1>Blitz</h1><p class="lead">60 secondes. Chaque bonne réponse rapporte 10 points, multipliés par ton combo. Une erreur remet le combo à zéro et coûte 3 secondes.</p></header>' +
        '<div class="deck-grid"><button type="button" class="deck card" data-act="blitz-start" data-id="services"><span class="deck-ic">' + icon('bolt') + '</span><strong>Quel service ?</strong><span>Un besoin en anglais, 4 services : trouve celui que l’examen attend.</span><small>Record : ' + (best.services || 0) + ' pts · ' + LQ.blitz.services.length + ' cartes</small></button>' +
        '<button type="button" class="deck card" data-act="blitz-start" data-id="tf"><span class="deck-ic">' + icon('check') + '</span><strong>Vrai ou faux ?</strong><span>Des affirmations pièges sur les services, à trancher sans hésiter.</span><small>Record : ' + (best.tf || 0) + ' pts · ' + LQ.blitz.tf.length + ' cartes</small></button></div>' +
        '<p class="small center">Au clavier : touches 1 à 4, ou V et F.</p>';
      return;
    }
    if (BL.state === 'over') {
      const acc = LQ.pct(BL.right, BL.right + BL.miss.length);
      host.innerHTML = '<section class="result"><div class="result-hero card ' + (BL.record ? 'good' : 'mid') + '"><p class="eyebrow">Blitz · ' + (BL.deck === 'tf' ? 'Vrai ou faux' : 'Quel service ?') + '</p><h1>' + BL.score + ' points</h1>' +
        '<p class="lead">' + (BL.record ? 'Nouveau record.' : 'Record à battre : ' + (best[BL.deck] || 0) + ' points.') + '</p>' +
        '<div class="result-stats"><div><strong>' + BL.right + '</strong><span>bonnes réponses</span></div><div><strong>' + acc + ' %</strong><span>de précision</span></div><div><strong>×' + BL.maxCombo + '</strong><span>meilleur combo</span></div><div><strong>+' + BL.gain + '</strong><span>XP gagnés</span></div></div>' +
        '<div class="result-actions"><button type="button" class="btn primary" data-act="blitz-start" data-id="' + BL.deck + '">Rejouer</button><button type="button" class="btn ghost" data-act="blitz-menu">Changer de paquet</button><a class="btn ghost" href="#accueil">Accueil</a></div></div>' +
        (BL.miss.length ? '<h2 class="sec-title">À retenir</h2><ul class="miss-list">' + BL.miss.map((m) => '<li><span lang="en">' + esc(m.c) + '</span><strong>' + esc(m.a) + '</strong>' + (m.w ? '<small>' + rich(m.w) + '</small>' : '') + '</li>').join('') + '</ul>' : '') + '</section>';
      return;
    }
    const c = BL.cur, mult = 1 + Math.min(4, Math.floor(BL.combo / 5));
    const opts = BL.deck === 'tf'
      ? '<button type="button" class="bopt' + bcls('Vrai') + '" data-act="blitz-pick" data-id="Vrai"><span class="opt-k">V</span>Vrai</button><button type="button" class="bopt' + bcls('Faux') + '" data-act="blitz-pick" data-id="Faux"><span class="opt-k">F</span>Faux</button>'
      : BL.opts.map((o, i) => '<button type="button" class="bopt' + bcls(o) + '" data-act="blitz-pick" data-id="' + esc(o) + '"><span class="opt-k">' + (i + 1) + '</span>' + esc(o) + '</button>').join('');
    host.innerHTML = '<section class="blitz"><header class="blitz-h"><div class="blitz-time" id="blitz-time"><i style="width:100%"></i></div><div class="blitz-nums"><span class="pill clock" id="blitz-clock">' + icon('clock') + '<span>60</span></span><span class="pill gold">' + BL.score + ' pts</span><span class="pill' + (BL.combo >= 5 ? ' hot' : '') + '">' + icon('flame') + 'combo ' + BL.combo + ' · ×' + mult + '</span></div></header>' +
      '<div class="blitz-card card' + (BL.lock ? (BL.lastOk ? ' pulse-ok' : ' pulse-ko') : '') + '"><p class="eyebrow">' + (BL.deck === 'tf' ? 'Vrai ou faux ?' : 'Quel service ?') + '</p><p class="blitz-clue" lang="en">' + esc(c.c) + '</p></div>' +
      '<div class="bopts' + (BL.deck === 'tf' ? ' two' : '') + '">' + opts + '</div></section>';
    blitzClock();
  }
  function bcls(o) {
    if (!BL.lock) return '';
    if (o === BL.cur.a) return ' good';
    return o === BL.picked ? ' bad' : ' dim';
  }
  function blitzClock() {
    const left = Math.max(0, (BL.endAt - Date.now()) / 1000);
    const el = LQ.$('#blitz-clock span'), b = LQ.$('#blitz-time i');
    if (el) el.textContent = Math.ceil(left);
    if (b) b.style.width = Math.min(100, (left / 60) * 100) + '%';
    return left;
  }
  function blitzNext() {
    if (!BL.queue.length) BL.queue = LQ.shuffle(BL.deck === 'tf' ? LQ.blitz.tf : LQ.blitz.services);
    const raw = BL.queue.pop();
    BL.cur = BL.deck === 'tf' ? { c: raw.s, a: raw.v ? 'Vrai' : 'Faux', w: raw.w } : raw;
    BL.opts = BL.deck === 'tf' ? [] : blitzOpts(raw);
    BL.lock = false; BL.picked = null;
    blitzPaint();
  }
  function blitzEnd() {
    clearInterval(BL.timer); clearTimeout(BL.wait);
    const S = LQ.S;
    BL.state = 'over';
    BL.record = BL.score > (S.blitz.best[BL.deck] || 0);
    if (BL.record) S.blitz.best[BL.deck] = BL.score;
    S.blitz.plays++;
    S.blitz.maxCombo = Math.max(S.blitz.maxCombo, BL.maxCombo);
    BL.gain = Math.min(50, Math.floor(BL.score / 10));
    LQ.addXp(BL.gain);
    LQ.save(); LQ.checkTrophies();
    if (BL.record && BL.score > 0) LQ.confetti();
    blitzPaint();
  }
  A['blitz-menu'] = () => { BL.state = 'menu'; blitzPaint(); };
  A['blitz-start'] = (el) => {
    const deck = el.dataset.id;
    if (!(deck === 'tf' ? LQ.blitz.tf : LQ.blitz.services).length) return;
    Object.assign(BL, { deck, state: 'play', score: 0, combo: 0, maxCombo: 0, right: 0, miss: [], queue: [], endAt: Date.now() + 60000 });
    clearInterval(BL.timer);
    BL.timer = setInterval(() => { if (BL.state !== 'play') { clearInterval(BL.timer); return; } if (blitzClock() <= 0) blitzEnd(); }, 200);
    LQ.cleanup.push(() => { clearInterval(BL.timer); clearTimeout(BL.wait); BL.state = 'menu'; });
    blitzNext();
  };
  A['blitz-pick'] = (el) => {
    if (BL.state !== 'play' || BL.lock) return;
    const v = el.dataset.id, ok = v === BL.cur.a;
    BL.lock = true; BL.picked = v; BL.lastOk = ok;
    if (ok) {
      BL.combo++; BL.right++;
      BL.maxCombo = Math.max(BL.maxCombo, BL.combo);
      BL.score += 10 * (1 + Math.min(4, Math.floor((BL.combo - 1) / 5)));
      LQ.sfx('ok');
    } else {
      BL.combo = 0; BL.endAt -= 3000;
      BL.miss.push(BL.cur);
      LQ.sfx('ko');
    }
    blitzPaint();
    BL.wait = setTimeout(() => { if (BL.state === 'play') blitzNext(); }, ok ? 260 : 1300);
  };
  V.blitz = () => ({ html: '', mount() { BL.state = 'menu'; blitzPaint(); } });
  document.addEventListener('keydown', (e) => {
    if (BL.state !== 'play' || BL.lock || !LQ.$('.blitz')) return;
    let v = null;
    if (BL.deck === 'tf') { if (/^v$/i.test(e.key) || e.key === '1') v = 'Vrai'; else if (/^f$/i.test(e.key) || e.key === '2') v = 'Faux'; }
    else if (/^[1-4]$/.test(e.key)) v = BL.opts[+e.key - 1];
    if (v) { e.preventDefault(); A['blitz-pick']({ dataset: { id: v } }); }
  });

  /* ---------------------------------------------------------------- chantier (assembler un pipeline) */
  const SC = { id: null, pick: [], open: 0, done: false };
  V.chantier = (arg) => {
    const S = LQ.S;
    if (arg && LQ.scenMap[arg]) {
      return { html: '', mount() { if (SC.id !== arg) Object.assign(SC, { id: arg, pick: [], open: 0, done: false }); scenPaint(); } };
    }
    return {
      html: '<header class="page-h"><p class="eyebrow">Architecture</p><h1>Chantier</h1><p class="lead">Un client, des contraintes, un pipeline à assembler brique par brique. C’est exactement le raisonnement que demande l’examen : pour chaque étape, quel service répond aux exigences ?</p></header>' +
        '<div class="scen-grid">' + LQ.scenarios.map((s) => {
          const r = S.scen[s.id] || {};
          return '<a class="scen card" href="#chantier-' + s.id + '"><span class="scen-top"><span class="dom d' + s.d + '">Domaine ' + s.d + '</span>' + (r.perfect ? '<span class="tag ok">Sans erreur</span>' : r.plays ? '<span class="mission-best">' + r.best + ' / ' + s.slots.length + '</span>' : '<span class="tag new">Nouveau</span>') + '</span><strong>' + esc(s.title) + '</strong><span class="mission-blurb">' + esc(s.sub) + '</span><span class="mission-n">' + s.slots.length + ' étapes à décider</span></a>';
        }).join('') + '</div>',
    };
  };
  function scenPaint() {
    const host = LQ.$('#view'), s = LQ.scenMap[SC.id];
    if (!host || !s) return;
    const n = s.slots.length, filled = SC.pick.filter((p) => p != null).length;
    const chain = s.slots.map((sl, i) => {
      const p = SC.pick[i];
      let cls = 'slot' + (i === SC.open && !SC.done ? ' open' : '') + (p != null ? ' set' : '');
      if (SC.done) cls += p === sl.a ? ' ok' : ' ko';
      return '<button type="button" class="' + cls + '" data-act="scen-open" data-i="' + i + '"' + (SC.done ? ' disabled' : '') + '><span class="slot-n">' + (i + 1) + '</span><span class="slot-l">' + esc(sl.label) + '</span><strong>' + (p != null ? esc(sl.o[p]) : 'À choisir') + '</strong>' + (SC.done ? '<span class="slot-m">' + icon(p === sl.a ? 'check' : 'x') + '</span>' : '') + '</button>';
    }).join('<span class="slot-arrow" aria-hidden="true">' + icon('right') + '</span>');
    let body;
    if (!SC.done) {
      const sl = s.slots[SC.open];
      body = '<div class="card pad slot-panel"><p class="eyebrow">Étape ' + (SC.open + 1) + ' sur ' + n + '</p><h2>' + esc(sl.label) + '</h2>' + (sl.ask ? '<p class="slot-ask" lang="en">' + esc(sl.ask) + '</p>' : '') +
        '<div class="opts" lang="en">' + sl.o.map((o, k) => '<button type="button" class="opt' + (SC.pick[SC.open] === k ? ' sel' : '') + '" data-act="scen-pick" data-i="' + k + '"><span class="opt-k">' + 'ABCD'[k] + '</span><span class="opt-t">' + esc(o) + '</span></button>').join('') + '</div>' +
        '<div class="q-actions"><button type="button" class="btn primary big" data-act="scen-ship"' + (filled === n ? '' : ' disabled') + '>Livrer le pipeline' + (filled === n ? '' : ' · ' + filled + ' / ' + n) + '</button></div></div>';
    } else {
      const ok = s.slots.filter((sl, i) => SC.pick[i] === sl.a).length;
      body = '<div class="result-hero card ' + (ok === n ? 'good' : ok >= n / 2 ? 'mid' : 'low') + '"><p class="eyebrow">Chantier livré</p><h1>' + ok + ' sur ' + n + '</h1><p class="lead">' + (ok === n ? 'Pipeline validé sans réserve.' : 'Lis chaque retour, puis recommence : le chantier est validé à ' + n + ' sur ' + n + '.') + '</p>' +
        '<div class="result-actions"><button type="button" class="btn ' + (ok === n ? 'ghost' : 'primary') + '" data-act="scen-retry">Recommencer</button><a class="btn ' + (ok === n ? 'primary' : 'ghost') + '" href="#chantier">Autres chantiers</a></div></div>' +
        '<div class="rv-list">' + s.slots.map((sl, i) => '<div class="card pad slot-fb ' + (SC.pick[i] === sl.a ? 'ok' : 'ko') + '"><p class="fb-head">' + icon(SC.pick[i] === sl.a ? 'check' : 'x') + esc(sl.label) + ' · <span lang="en">' + esc(sl.o[sl.a]) + '</span></p>' +
          (SC.pick[i] !== sl.a ? '<p class="rv-line">Ton choix : <span lang="en">' + esc(sl.o[SC.pick[i]]) + '</span></p>' : '') + '<p class="fb-text">' + rich(sl.e) + '</p></div>').join('') + '</div>';
    }
    host.innerHTML = '<a class="back" href="#chantier">' + icon('left') + 'Chantiers</a><section class="scen-run"><div class="card pad brief"><span class="dom d' + s.d + '">Domaine ' + s.d + '</span><h1>' + esc(s.title) + '</h1><p class="q-text" lang="en">' + LQ.qText(s.brief, true) + '</p>' +
      '<ul class="reqs" lang="en">' + s.reqs.map((r) => '<li>' + LQ.qText(r, true) + '</li>').join('') + '</ul></div><div class="chain">' + chain + '</div>' + body + '</section>';
  }
  A['scen-open'] = (el) => { if (SC.done) return; SC.open = +el.dataset.i; scenPaint(); };
  A['scen-pick'] = (el) => {
    const s = LQ.scenMap[SC.id];
    if (!s || SC.done) return;
    SC.pick[SC.open] = +el.dataset.i;
    const nxt = s.slots.findIndex((_, i) => SC.pick[i] == null);
    if (nxt >= 0) SC.open = nxt;
    scenPaint();
  };
  A['scen-retry'] = () => { Object.assign(SC, { pick: [], open: 0, done: false }); scenPaint(); window.scrollTo(0, 0); };
  A['scen-ship'] = () => {
    const s = LQ.scenMap[SC.id];
    if (!s || SC.done || SC.pick.filter((p) => p != null).length !== s.slots.length) return;
    const S = LQ.S, ok = s.slots.filter((sl, i) => SC.pick[i] === sl.a).length, n = s.slots.length;
    const prev = S.scen[s.id] || { best: 0, perfect: false, plays: 0 };
    const perfect = ok === n;
    S.scen[s.id] = { best: Math.max(prev.best, ok), perfect: prev.perfect || perfect, plays: prev.plays + 1 };
    SC.done = true;
    LQ.addXp(ok * 8 + (perfect && !prev.perfect ? 20 : 0));
    LQ.save(); LQ.checkTrophies();
    LQ.sfx(perfect ? 'trophy' : 'ok');
    if (perfect) LQ.confetti();
    scenPaint();
    window.scrollTo(0, 0);
  };
})();
