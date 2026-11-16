/* LakeQuest — apprendre : lecteur de flux animés et codex (fiches, duels, décodeur, guide d'examen). */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, icon = LQ.icon, rich = LQ.rich;
  const V = LQ.views, A = LQ.actions, UI = LQ.ui;
  LQ.inputs = LQ.inputs || {};

  /* ================================================================ FLUX ANIMÉS */
  const W = 760, NW = 190, NH = 66;
  const FP = { flow: null, i: -1, playing: false, speed: 1, view: 'net', raf: 0, wait: 0, token: 0 };

  function flowState(f) { return LQ.S.flows[f.id] || {}; }

  V.explorer = () => {
    const blocks = LQ.domains.map((d) => {
      const fl = LQ.flows.filter((f) => f.d === d.id);
      if (!fl.length) return '';
      return '<section class="world"><header class="world-h"><span class="dom d' + d.id + '">Domaine ' + d.id + '</span><div><h2>' + esc(d.name) + '</h2><p>' + LQ.plural(fl.filter((f) => flowState(f).done).length, 'flux validé', 'flux validés') + ' sur ' + fl.length + '</p></div></header><div class="flow-grid">' +
        fl.map((f) => {
          const st = flowState(f), n = f.events.length;
          const tag = st.done ? '<span class="tag ok">Validé</span>' : st.step ? '<span class="tag mid">Étape ' + Math.min(st.step, n) + ' / ' + n + '</span>' : '<span class="tag new">Nouveau</span>';
          return '<a class="flow-tile card" href="#flux-' + f.id + '"><span class="flow-tile-top">' + tag + '<span class="flow-min">' + icon('clock') + f.mins + ' min</span></span><strong>' + esc(f.title) + '</strong><span class="mission-blurb">' + esc(f.sub) + '</span>' +
            '<span class="flow-actors">' + f.actors.map((a) => '<i class="gly c-' + a.c + '">' + esc(a.g) + '</i>').join('') + '</span></a>';
        }).join('') + '</div></section>';
    }).join('');
    return {
      html: '<header class="page-h"><p class="eyebrow">Comprendre</p><h1>Flux animés</h1><p class="lead">Regarde les données circuler entre les services, un message à la fois. Mets en pause, reviens en arrière, ouvre chaque échange dans l’inspecteur. Trois questions valident le flux à la fin.</p></header>' + blocks,
    };
  };

  V.flux = (id) => {
    const f = LQ.flowMap[id];
    if (!f) return V.explorer();
    return {
      html: flowShell(f),
      mount() {
        Object.assign(FP, { flow: f, i: -1, playing: false, view: 'net', token: FP.token + 1 });
        LQ.cleanup.push(() => { FP.token++; FP.playing = false; cancelAnimationFrame(FP.raf); clearTimeout(FP.wait); FP.flow = null; });
        drawStage(); updateAll();
      },
    };
  };

  function flowShell(f) {
    return '<a class="back" href="#explorer">' + icon('left') + 'Flux animés</a><section class="flow"><header class="page-h tight"><span class="dom d' + f.d + '">Domaine ' + f.d + '</span><h1>' + esc(f.title) + '</h1><p class="lead">' + esc(f.sub) + '</p></header>' +
      '<div class="flow-main"><div class="stage card"><div class="stage-bar"><div class="seg small" role="group" aria-label="Vue"><button type="button" class="on" data-act="flow-view" data-id="net">' + icon('net') + 'Architecture</button><button type="button" data-act="flow-view" data-id="seq">' + icon('seq') + 'Séquence</button></div><span class="stage-step" id="flow-step"></span></div>' +
      '<div class="stage-scroll" id="stage-scroll"><div id="stage"></div></div>' +
      '<div class="controls"><div class="ctl-btns"><button type="button" class="ctl" data-act="flow-restart" aria-label="Recommencer">' + icon('restart') + '</button><button type="button" class="ctl" data-act="flow-prev" aria-label="Étape précédente">' + icon('prev') + '</button>' +
      '<button type="button" class="ctl main" data-act="flow-play" id="flow-play" aria-label="Lecture">' + icon('play') + '</button><button type="button" class="ctl" data-act="flow-next" aria-label="Étape suivante">' + icon('next') + '</button></div>' +
      '<div class="seg small speed" role="group" aria-label="Vitesse">' + [0.5, 1, 2].map((s) => '<button type="button" class="' + (FP.speed === s ? 'on' : '') + '" data-act="flow-speed" data-id="' + s + '">' + String(s).replace('.', ',') + '×</button>').join('') + '</div></div>' +
      '<div class="autobar" id="autobar"><i></i></div></div>' +
      '<aside class="insp card" id="insp" aria-live="polite"></aside></div>' +
      '<div class="card log"><div class="table-wrap"><table><thead><tr><th>#</th><th>De</th><th>Vers</th><th>Message</th><th>Ce qui se passe</th></tr></thead><tbody id="flow-log"></tbody></table></div></div>' +
      '<div id="flow-end"></div></section>';
  }

  const actorOf = (id) => FP.flow.actors.find((a) => a.id === id);
  function clip(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, hw = NW / 2 + 8, hh = NH / 2 + 8;
    const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [a.x + dx * t, a.y + dy * t];
  }

  function drawStage() {
    const f = FP.flow, host = LQ.$('#stage');
    if (!host || !f) return;
    if (FP.view === 'seq') { host.innerHTML = seqSVG(); return; }
    const H = f.h || 440;
    const links = (f.links || []).map((l) => { const a = actorOf(l[0]), b = actorOf(l[1]); return a && b ? '<line class="link" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>' : ''; }).join('');
    const nodes = f.actors.map((a) =>
      '<g class="node c-' + a.c + '" data-node="' + esc(a.id) + '" transform="translate(' + (a.x - NW / 2) + ' ' + (a.y - NH / 2) + ')"><rect class="node-box" width="' + NW + '" height="' + NH + '" rx="14"/><rect class="node-tile" x="12" y="12" width="42" height="42" rx="11"/>' +
      '<text class="node-g" x="33" y="37.500" text-anchor="middle">' + esc(a.g) + '</text><text class="node-l" x="64" y="' + (a.sub ? 29 : 38) + '">' + esc(a.label) + '</text>' + (a.sub ? '<text class="node-s" x="64" y="48">' + esc(a.sub) + '</text>' : '') +
      '<text class="node-st" x="' + NW / 2 + '" y="' + (NH + 20) + '" text-anchor="middle"></text></g>').join('');
    host.innerHTML = '<svg class="stage-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Schéma du flux"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arr"/></marker></defs>' +
      '<g>' + links + '</g><path id="live" class="live" marker-end="url(#arr)" d=""/>' + nodes + '<g id="pkt" class="pkt" style="display:none"><rect x="-40" y="-14" width="80" height="28" rx="14"/><text x="0" y="4.500" text-anchor="middle"></text></g></svg>';
  }

  function seqSVG() {
    const f = FP.flow, n = f.actors.length, colW = Math.max(146, (W - 180) / Math.max(1, n - 1));
    const width = 180 + (n - 1) * colW, rowH = 62, top = 96;
    const xs = {};
    f.actors.forEach((a, k) => { xs[a.id] = 90 + k * colW; });
    const shown = Math.max(0, FP.i + 1);
    const H = top + Math.max(1, f.events.length) * rowH + 6;
    let h = '<svg class="stage-svg seq" viewBox="0 0 ' + width + ' ' + H + '" style="min-width:' + Math.round(width * 0.72) + 'px" role="img" aria-label="Diagramme de séquence"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="arr"/></marker></defs>';
    f.actors.forEach((a) => {
      h += '<line class="life" x1="' + xs[a.id] + '" x2="' + xs[a.id] + '" y1="48" y2="' + (H - 4) + '"/><g class="node c-' + a.c + '" transform="translate(' + (xs[a.id] - 68) + ' 6)"><rect class="node-box" width="136" height="38" rx="10"/><rect class="node-tile" x="6" y="6" width="26" height="26" rx="7"/><text class="node-g sm" x="19" y="23" text-anchor="middle">' + esc(a.g) + '</text><text class="node-l sm" x="40" y="24">' + esc(a.label) + '</text></g>';
    });
    for (let j = 0; j < shown; j++) {
      const ev = f.events[j], y = top + j * rowH, x1 = xs[ev.from], x2 = xs[ev.to];
      const cls = 'sq' + (j === FP.i ? ' cur' : ' past');
      if (ev.from === ev.to) {
        h += '<g class="' + cls + '" data-act="flow-goto" data-i="' + j + '"><path class="sq-line" d="M' + x1 + ' ' + (y - 12) + 'h44v24h-38" marker-end="url(#arr)"/><text class="sq-t" x="' + (x1 + 54) + '" y="' + (y + 4) + '">' + esc(ev.label) + '</text></g>';
      } else {
        const dir = x2 > x1 ? 1 : -1;
        h += '<g class="' + cls + '" data-act="flow-goto" data-i="' + j + '"><line class="sq-line" x1="' + (x1 + 4 * dir) + '" y1="' + y + '" x2="' + (x2 - 6 * dir) + '" y2="' + y + '" marker-end="url(#arr)"/><text class="sq-n" x="' + (x1 + 12 * dir) + '" y="' + (y - 9) + '" text-anchor="' + (dir > 0 ? 'start' : 'end') + '">' + (j + 1) + ' · ' + esc(ev.label) + '</text></g>';
      }
    }
    return h + '</svg>';
  }

  function setNodeClasses(ev, phase) {
    LQ.$$('#stage .node').forEach((g) => {
      const id = g.getAttribute('data-node');
      g.classList.toggle('src', !!ev && id === ev.from);
      g.classList.toggle('dst', !!ev && phase === 'end' && id === ev.to);
      g.classList.remove('hit');
    });
  }
  function applyStates() {
    const f = FP.flow, st = {};
    for (let j = 0; j <= FP.i; j++) Object.assign(st, f.events[j].state || {});
    LQ.$$('#stage .node').forEach((g) => { const t = g.querySelector('.node-st'); if (t) t.textContent = st[g.getAttribute('data-node')] || ''; });
  }
  function settle() {
    /* état final de l'étape courante, sans animation */
    const f = FP.flow, ev = f.events[FP.i];
    if (FP.view === 'seq') { drawStage(); return; }
    const live = LQ.$('#live'), pkt = LQ.$('#pkt');
    if (!live || !pkt) return;
    pkt.style.display = 'none';
    if (!ev) { live.setAttribute('d', ''); setNodeClasses(null); applyStates(); return; }
    const a = actorOf(ev.from), b = actorOf(ev.to);
    if (ev.from !== ev.to) { const p0 = clip(a, b), p1 = clip(b, a); live.setAttribute('d', 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + 'L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1)); }
    else live.setAttribute('d', '');
    setNodeClasses(ev, 'end');
    applyStates();
    scrollToNode(b);
  }
  function scrollToNode(a) {
    const sc = LQ.$('#stage-scroll');
    if (!sc || sc.scrollWidth <= sc.clientWidth + 4) return;
    const x = (a.x / W) * sc.scrollWidth - sc.clientWidth / 2;
    sc.scrollTo({ left: Math.max(0, x), behavior: 'smooth' });
  }
  function reduced() { return !LQ.S.settings.fx || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function animate(done) {
    const f = FP.flow, ev = f.events[FP.i], token = FP.token;
    if (FP.view === 'seq' || !ev || reduced()) { settle(); done(); return; }
    const live = LQ.$('#live'), pkt = LQ.$('#pkt');
    const a = actorOf(ev.from), b = actorOf(ev.to);
    const D = 1050 / FP.speed;
    setNodeClasses(ev, 'start');
    if (ev.from === ev.to) {
      live.setAttribute('d', ''); pkt.style.display = 'none';
      const g = LQ.$('#stage .node[data-node="' + ev.from + '"]');
      if (g) g.classList.add('work');
      FP.wait = setTimeout(() => { if (token !== FP.token) return; if (g) g.classList.remove('work'); settle(); if (g) g.classList.add('hit'); done(); }, D);
      return;
    }
    const p0 = clip(a, b), p1 = clip(b, a);
    live.setAttribute('d', 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + 'L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1));
    const label = ev.label.length > 22 ? ev.label.slice(0, 21) + '…' : ev.label;
    const w = Math.max(60, 24 + label.length * 8);
    const r = pkt.querySelector('rect');
    r.setAttribute('x', -w / 2); r.setAttribute('width', w);
    pkt.querySelector('text').textContent = label;
    pkt.style.display = '';
    scrollToNode(a);
    const t0 = performance.now();
    const step = (t) => {
      if (token !== FP.token) return;
      let u = Math.min(1, (t - t0) / D);
      u = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      pkt.setAttribute('transform', 'translate(' + (p0[0] + (p1[0] - p0[0]) * u).toFixed(1) + ' ' + (p0[1] + (p1[1] - p0[1]) * u).toFixed(1) + ')');
      if (u < 1) { FP.raf = requestAnimationFrame(step); return; }
      settle();
      const g = LQ.$('#stage .node[data-node="' + ev.to + '"]');
      if (g) g.classList.add('hit');
      done();
    };
    FP.raf = requestAnimationFrame(step);
  }

  function updateInsp() {
    const f = FP.flow, box = LQ.$('#insp');
    if (!box) return;
    if (FP.i < 0) {
      box.innerHTML = '<p class="eyebrow">Avant de commencer</p><h2>' + esc(f.title) + '</h2><p class="insp-t">' + rich(f.intro || f.sub) + '</p><h3>Les acteurs</h3><ul class="actor-list">' +
        f.actors.map((a) => '<li><i class="gly c-' + a.c + '">' + esc(a.g) + '</i><span><strong>' + esc(a.label) + '</strong>' + (a.role ? '<small>' + esc(a.role) + '</small>' : '') + '</span></li>').join('') + '</ul>' +
        '<p class="small">Lance la lecture, ou avance pas à pas avec les flèches du clavier.</p>';
      return;
    }
    const ev = f.events[FP.i], a = actorOf(ev.from), b = actorOf(ev.to);
    box.innerHTML = '<p class="eyebrow">Étape ' + (FP.i + 1) + ' sur ' + f.events.length + ' · ' + esc(a.label) + (a !== b ? ' → ' + esc(b.label) : '') + '</p><h2>' + esc(ev.title) + '</h2><p class="insp-t">' + rich(ev.text) + '</p>' +
      (ev.fields && ev.fields.length ? '<h3>Dans le message <code>' + esc(ev.label) + '</code></h3><dl class="fields">' + ev.fields.map((x) => '<div><dt>' + esc(x[0]) + '</dt><dd><code>' + esc(x[1]) + '</code>' + (x[2] ? '<small>' + rich(x[2]) + '</small>' : '') + '</dd></div>').join('') + '</dl>' : '') +
      (ev.trap ? '<div class="trap">' + icon('target') + '<div><strong>Piège d’examen</strong><p>' + rich(ev.trap) + '</p></div></div>' : '');
  }
  function updateLog() {
    const f = FP.flow, tb = LQ.$('#flow-log');
    if (!tb) return;
    if (FP.i < 0) { tb.innerHTML = '<tr class="empty-row"><td colspan="5">Le journal se remplit au fil de la lecture.</td></tr>'; return; }
    tb.innerHTML = f.events.slice(0, FP.i + 1).map((ev, j) => '<tr class="' + (j === FP.i ? 'cur' : '') + '" data-act="flow-goto" data-i="' + j + '" tabindex="0"><td>' + (j + 1) + '</td><td>' + esc(actorOf(ev.from).label) + '</td><td>' + esc(actorOf(ev.to).label) + '</td><td><code>' + esc(ev.label) + '</code></td><td>' + esc(ev.title) + '</td></tr>').join('');
  }
  function updateControls() {
    const f = FP.flow, n = f.events.length;
    const st = LQ.$('#flow-step'), pb = LQ.$('#flow-play');
    if (st) st.textContent = FP.i < 0 ? n + ' étapes' : 'Étape ' + (FP.i + 1) + ' / ' + n;
    if (pb) { pb.innerHTML = icon(FP.playing ? 'pause' : 'play'); pb.setAttribute('aria-label', FP.playing ? 'Pause' : 'Lecture'); }
    LQ.$$('.stage-bar .seg button').forEach((b) => b.classList.toggle('on', b.dataset.id === FP.view));
    LQ.$$('.speed button').forEach((b) => b.classList.toggle('on', +b.dataset.id === FP.speed));
  }
  function updateEnd() {
    const f = FP.flow, box = LQ.$('#flow-end');
    if (!box) return;
    const st = flowState(f), atEnd = FP.i >= f.events.length - 1;
    if (!atEnd && !st.done) { box.innerHTML = ''; return; }
    const i = LQ.flows.indexOf(f), nx = LQ.flows[(i + 1) % LQ.flows.length];
    box.innerHTML = '<div class="card pad flow-end' + (st.done ? ' done' : '') + '"><div><p class="eyebrow">' + (st.done ? 'Flux validé' : 'Fin du flux') + '</p><h2>À retenir pour l’examen</h2><ul class="takeaways">' + f.takeaways.map((t) => '<li>' + rich(t) + '</li>').join('') + '</ul>' +
      (f.docs && f.docs.length ? '<p class="small docs">Source : ' + f.docs.map((d) => '<a href="' + esc(d[1]) + '" target="_blank" rel="noopener">' + esc(d[0]) + icon('ext') + '</a>').join(' · ') + '</p>' : '') + '</div>' +
      '<div class="flow-end-acts"><button type="button" class="btn primary big" data-act="flow-quiz">' + (st.done ? 'Refaire les 3 questions' : 'Valider avec 3 questions') + icon('right') + '</button>' +
      (nx && nx !== f ? '<a class="btn ghost" href="#flux-' + nx.id + '">Flux suivant : ' + esc(nx.title) + '</a>' : '') + '</div></div>';
  }
  function updateAll() { updateInsp(); updateLog(); updateControls(); updateEnd(); settle(); }

  function cancelMotion() {
    FP.token++;
    cancelAnimationFrame(FP.raf); clearTimeout(FP.wait);
    const bar = LQ.$('#autobar i');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
    LQ.$$('#stage .node.work').forEach((g) => g.classList.remove('work'));
  }
  function goTo(k, anim) {
    const f = FP.flow;
    if (!f) return;
    cancelMotion();
    FP.i = LQ.clamp(k, -1, f.events.length - 1);
    if (FP.i >= 0) {
      const st = LQ.S.flows[f.id] || (LQ.S.flows[f.id] = { step: 0, done: false });
      if (FP.i + 1 > (st.step || 0)) { st.step = FP.i + 1; LQ.save(); }
    }
    updateInsp(); updateLog(); updateControls(); updateEnd();
    if (FP.view === 'seq') drawStage();
    const token = FP.token;
    const after = () => {
      if (token !== FP.token || !FP.playing) return;
      if (FP.i >= f.events.length - 1) { FP.playing = false; updateControls(); return; }
      const ev = f.events[FP.i];
      const ms = LQ.clamp(2200 + (ev.text || '').length * 26, 3500, 11000) / FP.speed;
      const bar = LQ.$('#autobar i');
      if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%'; }
      FP.wait = setTimeout(() => { if (token === FP.token && FP.playing) goTo(FP.i + 1, true); }, ms);
    };
    if (anim && FP.i >= 0) animate(after); else { settle(); after(); }
  }

  A['flow-play'] = () => {
    const f = FP.flow; if (!f) return;
    if (FP.playing) { FP.playing = false; cancelMotion(); settle(); updateControls(); return; }
    FP.playing = true;
    goTo(FP.i >= f.events.length - 1 ? 0 : FP.i + 1, true);
  };
  A['flow-next'] = () => { if (!FP.flow) return; FP.playing = false; goTo(FP.i + 1, true); };
  A['flow-prev'] = () => { if (!FP.flow) return; FP.playing = false; goTo(FP.i - 1, false); };
  A['flow-restart'] = () => { if (!FP.flow) return; FP.playing = false; goTo(-1, false); };
  A['flow-goto'] = (el) => { if (!FP.flow) return; FP.playing = false; goTo(+el.dataset.i, false); };
  A['flow-speed'] = (el) => { FP.speed = +el.dataset.id; updateControls(); };
  A['flow-view'] = (el) => { if (!FP.flow) return; FP.view = el.dataset.id; FP.playing = false; cancelMotion(); drawStage(); updateControls(); settle(); };
  A['flow-quiz'] = () => {
    const f = FP.flow; if (!f) return;
    const pool = LQ.questions.filter((q) => !q.x && (f.topics || []).indexOf(q.t) >= 0);
    const qs = LQ.pickQs(pool, 3);
    if (qs.length < 1) { LQ.toast('Pas de question disponible pour ce flux.', 'warn'); return; }
    LQ.Quiz.start({
      kind: 'flow', title: f.title, eyebrow: 'Validation du flux', qs, back: '#flux-' + f.id,
      onDone(res) {
        const st = LQ.S.flows[f.id] || (LQ.S.flows[f.id] = { step: 0, done: false });
        const pass = res.correct >= Math.min(2, res.n), first = pass && !st.done;
        if (pass) st.done = true;
        if (first) LQ.addXp(40);
        const i = LQ.flows.indexOf(f), nx = LQ.flows[(i + 1) % LQ.flows.length];
        return { eyebrow: 'Flux animé', bonus: first ? 40 : 0, tone: pass ? 'good' : 'low', title: pass ? 'Flux validé.' : 'Pas encore validé.', lead: pass ? 'Tu sais maintenant raconter ce flux message par message.' : 'Il faut 2 bonnes réponses sur 3. Rejoue le flux en lisant chaque piège d’examen.',
          actions: [{ label: pass ? 'Flux suivant : ' + nx.title : 'Revoir le flux', href: pass ? '#flux-' + nx.id : '#flux-' + f.id, kind: 'primary' }, { label: 'Tous les flux', href: '#explorer' }] };
      },
    });
  };
  document.addEventListener('keydown', (e) => {
    if (!FP.flow || !LQ.$('.flow') || document.body.classList.contains('has-modal')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); A['flow-next'](); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); A['flow-prev'](); }
    else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); A['flow-play'](); }
    else if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('tr[data-act]')) A['flow-goto'](e.target);
  });

  /* ================================================================ CODEX */
  const CATS = [
    ['stream', 'Streaming'], ['analytics', 'Analytique et ETL'], ['storage', 'Stockage'], ['db', 'Bases de données'], ['integ', 'Orchestration et intégration'], ['compute', 'Calcul et conteneurs'],
    ['migr', 'Migration et transfert'], ['sec', 'Sécurité'], ['gov', 'Gouvernance et audit'], ['ops', 'Supervision'], ['dev', 'Développement'], ['ml', 'IA générative et ML'], ['concept', 'Concepts transverses'],
  ];
  function cardMastery(c) {
    const qs = LQ.openQs(LQ.cardQs[c.id] || []);
    const st = LQ.statOf(qs);
    return { total: st.total, ok: st.ok, p: LQ.pct(st.ok, st.total) };
  }
  function cardBody(c, compact) {
    const duels = LQ.duels.filter((d) => (d.cards || []).indexOf(c.id) >= 0);
    const flows = LQ.flows.filter((f) => (f.cards || []).indexOf(c.id) >= 0);
    return '<p class="card-tag">' + rich(c.tag) + '</p>' +
      '<h3>' + icon('check') + 'Quand le choisir</h3><ul class="card-list">' + c.use.map((u) => '<li>' + rich(u) + '</li>').join('') + '</ul>' +
      '<h3>' + icon('target') + 'Pièges d’examen</h3><ul class="card-list traps">' + c.traps.map((u) => '<li>' + rich(u) + '</li>').join('') + '</ul>' +
      (c.vs ? '<h3>' + icon('layers') + 'À ne pas confondre</h3><p class="card-vs">' + rich(c.vs) + '</p>' : '') +
      (!compact && (duels.length || flows.length) ? '<h3>' + icon('compass') + 'Pour creuser</h3><div class="prep-links">' + duels.map((d) => '<a class="chip big" href="#duel-' + d.id + '">' + icon('layers') + esc(d.title) + '</a>').join('') + flows.map((f) => '<a class="chip big" href="#flux-' + f.id + '">' + icon('wave') + esc(f.title) + '</a>').join('') + '</div>' : '');
  }
  function seeCard(id) { if (!LQ.S.cnt.cards[id]) { LQ.S.cnt.cards[id] = 1; LQ.save(); LQ.checkTrophies(); } }
  A['card-peek'] = (el) => {
    const c = LQ.cardMap[el.dataset.id];
    if (!c) return;
    seeCard(c.id);
    LQ.modal({ title: c.n, wide: true, html: '<div class="cardv">' + cardBody(c, true) + '</div>', actions: [{ id: 'ok', label: 'Fermer', kind: 'primary' }] });
  };

  V.codex = () => {
    const tab = UI.codexTab || 'services';
    const tabs = [['services', 'Fiches', 'book'], ['duels', 'Duels', 'layers'], ['decodeur', 'Décodeur', 'search'], ['guide', 'Guide d’examen', 'list']];
    let body = '';
    if (tab === 'services') {
      const q = (UI.codexQ || '').trim().toLowerCase();
      const match = (c) => !q || (c.n + ' ' + (c.s || '') + ' ' + c.tag).toLowerCase().indexOf(q) >= 0;
      body = '<div class="search">' + icon('search') + '<input type="search" id="codex-q" placeholder="Chercher un service ou un concept" value="' + esc(UI.codexQ || '') + '" data-input="codex-q" aria-label="Chercher dans le codex"></div><div id="codex-list">' + codexList(match) + '</div>';
    } else if (tab === 'duels') {
      body = '<p class="lead">Les comparaisons qui reviennent le plus dans les énoncés. Quand deux services semblent convenir, c’est un mot de l’énoncé qui tranche.</p><div class="duel-grid">' +
        LQ.duels.map((d) => '<a class="card duel-tile" href="#duel-' + d.id + '">' + (LQ.S.cnt.duels[d.id] ? '<span class="tag ok">Lu</span>' : '<span class="tag new">À lire</span>') + '<strong>' + esc(d.title) + '</strong><span class="mission-blurb">' + esc(d.sub) + '</span></a>').join('') + '</div>';
    } else if (tab === 'decodeur') {
      body = '<p class="lead">Les énoncés sont en anglais et quelques expressions décident de la bonne réponse. En entraînement, elles sont soulignées dans les questions : clique dessus pour les décoder.</p><div class="gloss-list">' +
        LQ.glossary.map((g) => '<div class="card pad gloss"><strong lang="en">' + esc(g.t) + '</strong><span>' + esc(g.fr) + '</span><p>' + rich(g.hint) + '</p></div>').join('') + '</div>';
    } else {
      body = '<div class="card pad"><ul class="facts"><li><strong>Format</strong> : 65 questions (50 notées, 15 non notées et non repérables), 130 minutes.</li><li><strong>Score</strong> : de 100 à 1 000, réussite à 720, barème global : un domaine faible peut être compensé par un autre.</li><li><strong>Version</strong> : guide 1.1, qui ajoute Apache Iceberg, les index vectoriels (HNSW, IVF), les LLM dans les traitements et Amazon SageMaker Catalog.</li></ul>' +
        '<p class="small docs">Source : <a href="https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.html" target="_blank" rel="noopener">guide officiel de l’examen DEA-C01' + icon('ext') + '</a></p></div>' +
        LQ.domains.map((d) => {
          const rows = Object.keys(LQ.tasks).filter((k) => +k[0] === d.id).map((k) => {
            const pool = LQ.openQs(LQ.questions.filter((q) => q.ts === k)), st = LQ.statOf(pool), p = LQ.pct(st.ok, st.total);
            return '<tr><td><strong>' + k + '</strong></td><td lang="en">' + esc(LQ.tasks[k]) + '</td><td><div class="cellbar">' + LQ.bar(p, 'd' + d.id) + '<span>' + st.ok + ' / ' + st.total + '</span></div></td><td><a class="btn ghost sm" href="#tache-' + k.replace('.', '-') + '">S’entraîner</a></td></tr>';
          }).join('');
          return '<h2 class="sec-title"><span class="dom d' + d.id + '">Domaine ' + d.id + '</span> ' + esc(d.name) + ' · ' + d.w + ' %</h2><div class="table-wrap card"><table class="task-table"><thead><tr><th>Tâche</th><th>Intitulé officiel</th><th>Justes au dernier essai</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        }).join('');
    }
    return {
      html: '<header class="page-h"><p class="eyebrow">Référence</p><h1>Codex</h1></header><div class="tabs" role="tablist">' + tabs.map((t) => '<button type="button" role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '" data-act="codex-tab" data-id="' + t[0] + '">' + icon(t[2]) + t[1] + '</button>').join('') + '</div>' + body,
    };
  };
  function codexList(match) {
    const out = CATS.map((cat) => {
      const cs = LQ.cards.filter((c) => c.c === cat[0] && match(c));
      if (!cs.length) return '';
      return '<h2 class="sec-title">' + cat[1] + '</h2><div class="codex-grid">' + cs.map((c) => {
        const m = cardMastery(c);
        return '<a class="codex-tile card' + (LQ.S.cnt.cards[c.id] ? ' seen' : '') + '" href="#fiche-' + c.id + '"><i class="gly c-' + c.c + '">' + esc(c.s || c.n.slice(0, 3)) + '</i><span><strong>' + esc(c.n) + '</strong><small>' + esc(c.tag) + '</small></span>' +
          (m.total ? '<span class="codex-m" title="' + m.ok + ' questions justes sur ' + m.total + '">' + LQ.ring(m.p, 30, null, m.p >= 80 ? 'ok' : '') + '</span>' : '') + '</a>';
      }).join('') + '</div>';
    }).join('');
    return out || '<p class="empty">Aucune fiche ne correspond à cette recherche.</p>';
  }
  A['codex-tab'] = (el) => { UI.codexTab = el.dataset.id; LQ.route(); };
  LQ.inputs['codex-q'] = (el) => {
    UI.codexQ = el.value;
    const q = el.value.trim().toLowerCase(), box = LQ.$('#codex-list');
    if (box) box.innerHTML = codexList((c) => !q || (c.n + ' ' + (c.s || '') + ' ' + c.tag).toLowerCase().indexOf(q) >= 0);
  };

  V.fiche = (id) => {
    const c = LQ.cardMap[id];
    if (!c) return V.codex();
    const m = cardMastery(c), cat = (CATS.find((x) => x[0] === c.c) || [])[1] || '';
    return {
      html: '<a class="back" href="#codex">' + icon('left') + 'Codex</a><article class="card pad cardv full"><header class="cardv-h"><i class="gly big c-' + c.c + '">' + esc(c.s || c.n.slice(0, 3)) + '</i><div><p class="eyebrow">' + esc(cat) + '</p><h1>' + esc(c.n) + '</h1></div>' +
        (m.total ? '<div class="cardv-m">' + LQ.ring(m.p, 54, m.p + '%', m.p >= 80 ? 'ok' : '') + '<span>' + m.ok + ' / ' + m.total + ' questions justes</span></div>' : '') + '</header>' + cardBody(c, false) +
        '<div class="cardv-f">' + (m.total ? '<button type="button" class="btn primary" data-act="card-train" data-id="' + esc(c.id) + '">S’entraîner sur cette fiche' + icon('right') + '</button>' : '') +
        '<a class="btn ghost" href="#short-' + esc(c.id) + '">' + icon('play') + 'Voir le short</a>' + (c.doc ? '<a class="btn ghost" href="' + esc(c.doc) + '" target="_blank" rel="noopener">Documentation AWS' + icon('ext') + '</a>' : '') + '</div></article>',
      mount() { seeCard(c.id); },
    };
  };
  A['card-train'] = (el) => { const c = LQ.cardMap[el.dataset.id]; if (c) LQ.startCustom(c.n, 'Fiche du codex', LQ.cardQs[c.id] || [], '#fiche-' + c.id); };

  V.duel = (id) => {
    const d = LQ.duelMap[id];
    if (!d) { UI.codexTab = 'duels'; return V.codex(); }
    return {
      html: '<a class="back" href="#codex" data-act="codex-back">' + icon('left') + 'Duels</a><article class="duel"><header class="page-h tight"><p class="eyebrow">Duel</p><h1>' + esc(d.title) + '</h1><p class="lead">' + esc(d.sub) + '</p></header>' +
        '<div class="table-wrap card"><table class="duel-table"><thead><tr>' + d.cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + d.rows.map((r) => '<tr>' + r.map((x, k) => (k === 0 ? '<th scope="row">' + esc(x) + '</th>' : '<td>' + rich(x) + '</td>')).join('') + '</tr>').join('') + '</tbody></table></div>' +
        (d.tip ? '<div class="trap">' + icon('target') + '<div><strong>Le mot qui tranche</strong><p>' + rich(d.tip) + '</p></div></div>' : '') +
        ((d.cards || []).length ? '<div class="prep-links">' + d.cards.map((cid) => LQ.cardMap[cid]).filter(Boolean).map((c) => '<a class="chip big" href="#fiche-' + c.id + '">' + icon('book') + esc(c.n) + '</a>').join('') + '</div>' : '') + '</article>',
      mount() { if (!LQ.S.cnt.duels[d.id]) { LQ.S.cnt.duels[d.id] = 1; LQ.save(); } },
    };
  };
  A['codex-back'] = () => { UI.codexTab = 'duels'; location.hash = '#codex'; };
})();
