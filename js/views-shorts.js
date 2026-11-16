/* LakeQuest — shorts : chaque concept expliqué en une courte séquence verticale de 30 à 45 secondes.
   Les shorts sont fabriqués à partir du codex (une fiche = un short, un comparatif = un short) :
   corriger une fiche corrige aussi son short. Lecture automatique, voix facultative, navigation au clavier ou au doigt. */
(function () {
  const LQ = window.LQ, V = LQ.views, A = LQ.actions, esc = LQ.esc, rich = LQ.rich, icon = LQ.icon;
  const CATS = [['stream', 'Streaming'], ['analytics', 'Analytique et ETL'], ['storage', 'Stockage'], ['db', 'Bases de données'], ['integ', 'Orchestration et intégration'], ['compute', 'Calcul et conteneurs'],
    ['migr', 'Migration et transfert'], ['sec', 'Sécurité'], ['gov', 'Gouvernance et audit'], ['ops', 'Supervision'], ['dev', 'Développement'], ['ml', 'IA générative et ML'], ['concept', 'Concepts transverses']];
  const catName = (c) => (CATS.find((x) => x[0] === c) || [0, 'Comparatif'])[1];
  const P = { id: '', i: 0, playing: true, list: [] };   // lecteur en cours

  const seen = () => (LQ.S.shorts = LQ.S.shorts || {});
  const voiceOn = () => !!LQ.S.settings.shortVoice && 'speechSynthesis' in window;

  /* Catalogue : toutes les fiches dans l'ordre des catégories, puis les comparatifs. */
  function catalog() {
    const out = [];
    CATS.forEach((c) => LQ.cards.filter((k) => k.c === c[0]).forEach((k) => out.push({ id: k.id, kind: 'card', c: k.c, s: k.s, n: k.n, sub: k.tag, ref: k })));
    LQ.duels.forEach((d) => out.push({ id: 'vs-' + d.id, kind: 'duel', c: 'vs', s: 'VS', n: d.title, sub: d.sub, ref: d }));
    const fx = LQ.shortsFx || {};
    out.forEach((x) => { if (x.kind === 'card' && fx[x.id]) { x.fx = 1; x.sub = fx[x.id].title; } });
    out.sort((a, b) => (b.fx || 0) - (a.fx || 0));   /* tri stable : les shorts animés d'abord */
    return out;
  }

  /* Découpe un short en scènes : { k (surtitre), h (titre), lines (lignes révélées une à une), tone } */
  function scenes(it) {
    const sc = [];
    const fx = it.kind === 'card' && (LQ.shortsFx || {})[it.id];
    if (fx) {
      fx.scenes.forEach((x) => sc.push(Object.assign({ fx: 1, lines: [] }, x)));
      sc.push({ k: 'À retenir', h: it.ref.n, lines: [it.ref.tag], tone: 'end', end: 1 });
      return sc;
    }
    if (it.kind === 'card') {
      const c = it.ref;
      sc.push({ k: catName(c.c), h: c.n, lines: [c.tag], tone: 'hook', gly: c.s, cat: c.c });
      if ((c.use || []).length) sc.push({ k: 'Quand le choisir', lines: c.use, tone: 'use' });
      (c.traps || []).forEach((t, i) => sc.push({ k: 'Piège d’examen' + (c.traps.length > 1 ? ' n° ' + (i + 1) : ''), lines: [t], tone: 'trap' }));
      if (c.vs) sc.push({ k: 'À ne pas confondre', lines: [c.vs], tone: 'vs' });
      sc.push({ k: 'À retenir', h: c.n, lines: [c.tag], tone: 'end', end: 1 });
    } else {
      const d = it.ref;
      sc.push({ k: 'Comparatif', h: d.title, lines: [d.sub], tone: 'hook', gly: 'VS', cat: 'vs' });
      d.rows.forEach((r) => sc.push({ k: r[0].replace(/\*\*/g, ''), lines: r.slice(1).map((v, j) => (d.cols.length > 2 && d.cols[j + 1] ? '**' + d.cols[j + 1].replace(/\*\*/g, '') + '** : ' : '') + v), tone: 'use' }));
      if (d.tip) sc.push({ k: 'Le réflexe', lines: [d.tip], tone: 'trap' });
      sc.push({ k: 'À retenir', h: d.title, lines: [d.tip || d.sub], tone: 'end', end: 1 });
    }
    return sc;
  }
  const plain = (s) => String(s).replace(/\*\*|`/g, '');
  const fxText = (s) => (s.hook ? s.hook : [s.big, s.sub].concat((s.caps || []).map((c) => c[1]), s.v && s.v.type === 'tree' ? s.v.qs.map((q) => q[0] + ' ' + q[1]) : [])).filter(Boolean).map(plain).join('. ');
  const sceneText = (s) => s.fx ? fxText(s) : [s.h && s.tone !== 'end' ? s.h : '', s.tone === 'hook' ? '' : s.k].concat(s.lines).filter(Boolean).map(plain).join('. ');
  const duration = (s) => Math.round(Math.max(s.fx && !s.hook ? 6500 : 3600, Math.min(13000, (s.fx ? 3800 : 2200) + 52 * sceneText(s).length)));

  /* ── Visuels des shorts animés ── */
  const KEYS = 'ABCD';
  const tile = (ch, delay, cls) => '<b class="fx-t k' + KEYS.indexOf(ch) + (cls || '') + '" style="animation-delay:' + delay + 'ms">' + esc(ch) + '</b>';
  function routeHTML(v) {
    const tiles = v.tiles.split(''), n = v.n, buckets = [];
    for (let i = 0; i < n; i++) buckets.push([]);
    if (v.rule === 'round') tiles.forEach((t, i) => buckets[i % n].push([t, i]));
    else if (v.rule === 'key') tiles.forEach((t, i) => buckets[KEYS.indexOf(t) % n].push([t, i]));
    else if (v.rule === 'all') buckets.forEach((b) => tiles.forEach((t, i) => b.push([t, i])));
    const avg = tiles.length / n, step = Math.min(260, 2600 / Math.max(1, tiles.length));
    return '<div class="fx-route"><div class="fx-src"><span>' + esc(v.src) + '</span><div>' + tiles.map((t, i) => tile(t, 0, v.rule === 'none' ? '' : ' leave" data-i="' + i).replace('animation-delay:0ms', 'animation-delay:' + (v.rule === 'none' ? i * 90 : 700 + i * step) + 'ms')).join('') + '</div></div>' +
      (v.key ? '<p class="fx-key">' + esc(v.key) + '</p>' : '') +
      '<div class="fx-buckets n' + n + '">' + buckets.map((b, j) => '<div class="fx-bucket' + (v.rule === 'key' && b.length > avg * 1.9 ? ' hot' : '') + '">' + (v.rule !== 'none' ? '<em style="animation-delay:' + (900 + tiles.length * step) + 'ms">' + b.length + '</em>' : '') +
        '<div class="fx-stack' + (v.rule === 'all' ? ' ring' : '') + '">' + b.map((x) => tile(x[0], 800 + x[1] * step + (v.rule === 'all' ? j * 220 : 0), ' drop')).join('') + '</div><span>' + esc(v.unit) + ' ' + (j + 1) + '</span></div>').join('') + '</div></div>';
  }
  const barsHTML = (v) => '<div class="fx-bars">' + (v.title ? '<p class="fx-cap">' + esc(v.title) + '</p>' : '') + v.items.map((it, i) =>
    '<div class="fx-bar"><span>' + esc(it[0]) + '</span><div><i class="t-' + esc(it[3] || 'teal') + '" style="--w:' + Math.max(2, it[1]) + '%;animation-delay:' + (500 + i * 550) + 'ms"></i></div>' + (it[2] ? '<small style="animation-delay:' + (900 + i * 550) + 'ms">' + esc(it[2]) + '</small>' : '') + '</div>').join('') + '</div>';
  const chainHTML = (v) => '<ol class="fx-chain">' + v.steps.map((st, i) => '<li style="animation-delay:' + (400 + i * 1000) + 'ms"><i>' + esc(st[0]) + '</i><div><strong>' + esc(st[1]) + '</strong><span>' + esc(st[2] || '') + '</span></div></li>').join('') + '</ol>';
  const treeHTML = (v) => '<ol class="fx-tree">' + v.qs.map((q, i) => '<li style="animation-delay:' + (400 + i * 1500) + 'ms"><span>' + esc(q[0]) + '</span><b class="t-' + esc(q[2] || 'teal') + '" style="animation-delay:' + (1000 + i * 1500) + 'ms">' + esc(q[1]) + '</b></li>').join('') + '</ol>';
  const CAPI = { ok: 'check', ko: 'x', warn: 'info' };
  function fxHTML(s) {
    if (s.hook) return '<div class="fx-hook"><p>' + esc(s.hook[0]) + '</p><p>' + esc(s.hook[1]) + '</p><p class="punch">' + esc(s.hook[2]) + '</p></div>';
    const v = s.v || {}, capStart = v.type === 'route' ? 3600 : v.type === 'chain' ? 600 + v.steps.length * 1000 : v.type === 'bars' ? 900 + v.items.length * 550 : 0;
    return '<div class="fx-head t-' + esc(s.tone || 'teal') + '">' + (s.tag ? '<span class="fx-tag">' + esc(s.tag) + '</span>' : '') + '<h2 class="' + (s.small ? 'small' : '') + '">' + esc(s.big) + '</h2>' + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + '</div>' +
      (v.type === 'route' ? routeHTML(v) : v.type === 'bars' ? barsHTML(v) : v.type === 'chain' ? chainHTML(v) : v.type === 'tree' ? treeHTML(v) : '') +
      (s.caps || []).map((c, i) => '<p class="fx-capline ' + esc(c[0]) + '" style="animation-delay:' + (capStart + i * 1300) + 'ms">' + (CAPI[c[0]] ? icon(CAPI[c[0]]) : '') + '<span>' + rich(c[1]) + '</span></p>').join('');
  }

  /* ---------------------------------------------------------------- liste des shorts */
  V.shorts = () => {
    const list = catalog(), sn = seen(), done = list.filter((x) => sn[x.id]).length;
    const first = list.find((x) => !sn[x.id]) || list[0];
    const group = (title, items) => items.length ? '<h2 class="sec-title">' + esc(title) + '</h2><div class="short-grid">' + items.map((x) =>
      '<a class="short-tile' + (sn[x.id] ? ' seen' : '') + '" href="#short-' + esc(x.id) + '"><i class="gly c-' + esc(x.c) + '">' + esc(x.s) + '</i><span><strong>' + esc(x.n) + '</strong><small>' + esc(plain(x.sub)) + '</small></span>' + (sn[x.id] ? icon('check', 'short-ok') : icon('play', 'short-go')) + '</a>').join('') + '</div>' : '';
    return {
      html: '<header class="page-h"><p class="eyebrow">Shorts</p><h1>Un concept, quarante secondes</h1><p class="lead">Chaque service et chaque comparatif du codex, raconté en quelques écrans : à quoi ça sert, quand le choisir, les pièges d’examen, ce qu’il ne faut pas confondre.</p></header>' +
        '<section class="card pad short-top"><div><strong>' + done + ' / ' + list.length + '</strong><span>shorts vus</span>' + LQ.bar(Math.round(100 * done / list.length)) + '</div>' +
        '<a class="btn primary big" href="#short-' + esc(first.id) + '">' + icon('play') + (done ? 'Reprendre la lecture' : 'Lancer la lecture') + '</a></section>' +
        group('Shorts animés', list.filter((x) => x.fx)) + CATS.map((c) => group(c[1], list.filter((x) => x.c === c[0] && !x.fx))).join('') + group('Comparatifs', list.filter((x) => x.kind === 'duel')),
    };
  };

  /* ---------------------------------------------------------------- lecteur */
  V.short = (id) => {
    const list = catalog(), k = list.findIndex((x) => x.id === id);
    if (k < 0) return V.shorts();
    P.id = id; P.i = 0; P.playing = true; P.list = list; P.sc = scenes(list[k]); P.k = k;
    const prev = list[k - 1], next = list[k + 1];
    return {
      html: '<a class="back" href="#shorts">' + icon('left') + 'Tous les shorts</a>' +
        '<div class="short-wrap"><section class="short" id="short" aria-live="polite"></section>' +
        '<div class="short-side"><div class="short-ctl">' +
        '<button type="button" class="btn ghost" data-act="short-prev" aria-label="Écran précédent">' + icon('left') + '</button>' +
        '<button type="button" class="btn primary" data-act="short-toggle" id="short-pp" aria-label="Lecture ou pause">' + icon('pause') + '</button>' +
        '<button type="button" class="btn ghost" data-act="short-next" aria-label="Écran suivant">' + icon('right') + '</button>' +
        ('speechSynthesis' in window ? '<button type="button" class="btn ghost' + (voiceOn() ? ' on' : '') + '" data-act="short-voice" id="short-voice" aria-pressed="' + voiceOn() + '">' + icon('sound') + 'Voix</button>' : '') + '</div>' +
        '<p class="small muted">Touche l’écran à droite pour avancer, à gauche pour revenir. Clavier : flèches et espace.</p>' +
        '<div class="short-nav">' + (prev ? '<a class="btn ghost" href="#short-' + esc(prev.id) + '">' + icon('prev') + esc(prev.n) + '</a>' : '') + (next ? '<a class="btn ghost" href="#short-' + esc(next.id) + '">' + esc(next.n) + icon('next') + '</a>' : '') + '</div>' +
        '<p class="small muted">' + (k + 1) + ' sur ' + list.length + '</p></div></div>',
      mount() {
        const key = (e) => {
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
          else if (e.key === ' ') { e.preventDefault(); A['short-toggle'](); }
        };
        document.addEventListener('keydown', key);
        LQ.cleanup.push(() => { document.removeEventListener('keydown', key); stopVoice(); });
        draw();
      },
    };
  };

  function stopVoice() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* sans voix */ } }
  function speak(s) {
    stopVoice();
    if (!voiceOn() || !P.playing) return;
    try {
      const u = new SpeechSynthesisUtterance(sceneText(s));
      u.lang = 'fr-FR'; u.rate = 1.02;
      const mine = P.id + ':' + P.i;
      u.onend = () => { if (P.playing && mine === P.id + ':' + P.i && voiceOn()) step(1, true); };
      window.speechSynthesis.speak(u);
    } catch (e) { /* la lecture continue au chronomètre */ }
  }

  function draw() {
    const box = document.getElementById('short');
    if (!box) return;
    const it = P.list[P.k], s = P.sc[P.i], dur = duration(s) * (voiceOn() ? 1.6 : 1);
    const next = P.list[P.k + 1];
    box.className = 'short tone-' + (s.fx ? 'fx' : s.tone) + (P.playing ? '' : ' paused');
    box.innerHTML = '<div class="short-bars">' + P.sc.map((x, j) => '<i class="' + (j < P.i ? 'full' : j === P.i ? 'run' : '') + '"><b style="animation-duration:' + dur + 'ms"></b></i>').join('') + '</div>' +
      (s.fx ? '<div class="short-body fx">' + fxHTML(s) + '</div>' : '<div class="short-body"><p class="short-k">' + esc(s.k) + '</p>' +
      (s.gly ? '<i class="gly big c-' + esc(s.cat) + '">' + esc(s.gly) + '</i>' : '') +
      (s.h ? '<h2>' + esc(s.h) + '</h2>' : '') +
      '<ul class="short-lines' + (s.lines.length > 1 ? ' many' : '') + '">' + s.lines.map((l, j) => '<li style="animation-delay:' + (250 + j * Math.min(1400, dur / (s.lines.length + 1))) + 'ms">' + rich(l) + '</li>').join('') + '</ul>' +
      (s.end ? '<div class="short-end">' +
        (it.kind === 'card' && (LQ.cardQs[it.id] || []).length ? '<button type="button" class="btn primary" data-act="card-train" data-id="' + esc(it.id) + '">S’entraîner' + icon('right') + '</button>' : '') +
        '<a class="btn ghost" href="#' + (it.kind === 'card' ? 'fiche-' + esc(it.id) : 'duel-' + esc(it.ref.id)) + '">Voir la fiche</a>' +
        (next ? '<a class="btn ghost" href="#short-' + esc(next.id) + '">Short suivant' + icon('right') + '</a>' : '<a class="btn ghost" href="#shorts">Tous les shorts</a>') + '</div>' : '') +
      '</div>') +
      '<button type="button" class="short-tap l" data-act="short-prev" aria-label="Écran précédent"></button><button type="button" class="short-tap r" data-act="short-next" aria-label="Écran suivant"></button>' +
      '<p class="short-foot"><span>' + esc(it.n) + '</span><span>' + (P.i + 1) + ' / ' + P.sc.length + '</span></p>';
    const run = box.querySelector('.short-bars .run b');
    if (run) run.addEventListener('animationend', () => { if (!voiceOn()) step(1, true); });
    const pp = document.getElementById('short-pp');
    if (pp) pp.innerHTML = icon(P.playing ? 'pause' : 'play');
    if (s.end) markSeen(it);
    speak(s);
  }

  function markSeen(it) {
    const sn = seen();
    if (sn[it.id]) return;
    sn[it.id] = Date.now();
    if (it.kind === 'card' && LQ.S.cnt.cards && !LQ.S.cnt.cards[it.id]) LQ.S.cnt.cards[it.id] = 1;
    if (LQ.addXp) LQ.addXp(5);
    LQ.save(); LQ.checkTrophies(); LQ.refreshChrome && LQ.refreshChrome();
  }

  /* auto = avance déclenchée par la fin d'un écran : au dernier écran on s'arrête, on n'enchaîne pas tout seul. */
  function step(d, auto) {
    const n = P.i + d;
    if (n < 0) return;
    if (n >= P.sc.length) { if (auto) { P.playing = false; draw(); } return; }
    P.i = n;
    if (!auto) P.playing = true;
    draw();
  }
  A['short-next'] = () => step(1);
  A['short-prev'] = () => step(-1);
  A['short-toggle'] = () => {
    P.playing = !P.playing;
    const box = document.getElementById('short'), pp = document.getElementById('short-pp');
    if (box) box.classList.toggle('paused', !P.playing);
    if (pp) pp.innerHTML = icon(P.playing ? 'pause' : 'play');
    if (P.playing) speak(P.sc[P.i]); else stopVoice();
  };
  A['short-voice'] = () => {
    LQ.S.settings.shortVoice = !LQ.S.settings.shortVoice; LQ.save();
    const b = document.getElementById('short-voice');
    if (b) { b.classList.toggle('on', voiceOn()); b.setAttribute('aria-pressed', voiceOn()); }
    P.playing = true; draw();
  };
})();
