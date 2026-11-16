/* LakeQuest — coque de l'application : navigation, routeur, bandeau d'examen, première visite. */
(function () {
  'use strict';
  const LQ = window.LQ;
  const esc = LQ.esc, icon = LQ.icon;
  LQ.cleanup = [];
  LQ.changes = LQ.changes || {};
  LQ.inputs = LQ.inputs || {};

  const NAV = [['accueil', 'Accueil', 'home'], ['jouer', 'Jouer', 'target'], ['examen', 'Examen', 'clock'], ['explorer', 'Flux', 'wave'], ['shorts', 'Shorts', 'play'], ['codex', 'Codex', 'book'], ['trophees', 'Trophées', 'trophy'], ['profil', 'Profil', 'user']];
  const TABS = NAV.slice(0, 6);
  const SECTION = { mission: 'jouer', boss: 'jouer', quotidien: 'jouer', revision: 'jouer', blitz: 'jouer', chantier: 'jouer', flux: 'explorer', fiche: 'codex', duel: 'codex', tache: 'codex', short: 'shorts' };
  const PREFIX = ['mission', 'boss', 'flux', 'fiche', 'duel', 'chantier', 'tache', 'short'];
  const FISH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12c3.200-4.600 9.800-5.600 14-2.300L21 6.500v11l-4-3.200c-4.200 3.300-10.800 2.300-14-2.300z"/><circle cx="8" cy="11" r="1.100"/></svg>';

  function shell() {
    const link = (n) => '<a href="#' + n[0] + '" data-nav="' + n[0] + '">' + icon(n[2]) + '<span>' + n[1] + '</span></a>';
    return '<header class="top"><div class="top-in"><a class="brand" href="#accueil" aria-label="LakeQuest, retour à l’accueil"><span class="brand-ic">' + FISH + '</span><span class="brand-n">Lake<b>Quest</b></span></a>' +
      '<nav class="nav" aria-label="Navigation principale">' + NAV.map(link).join('') + '</nav>' +
      '<div class="chips"><a class="tchip" href="#profil" id="chip-streak" aria-label="Série de jours">' + icon('flame') + '<b>0</b></a><a class="tchip" href="#trophees" id="chip-depth" aria-label="Profondeur atteinte">' + icon('trophy') + '<b>0 m</b></a>' +
      '<a class="tchip lvl" href="#profil" id="chip-lvl" aria-label="Niveau"><span class="lvl-n">1</span><span class="lvl-t">Alevin</span><i class="lvl-bar"><b></b></i></a></div></div></header>' +
      '<a class="banner" id="exam-banner" href="#examen" hidden></a><main id="view" tabindex="-1"></main>' +
      '<footer class="foot"><p><strong>LakeQuest</strong> · entraînement indépendant à l’examen AWS Certified Data Engineer – Associate (DEA-C01). Sans lien avec Amazon Web Services. Les questions sont originales : aucune ne provient de l’examen réel.</p></footer>' +
      '<nav class="tabbar" aria-label="Navigation">' + TABS.map(link).join('') + '</nav>' +
      '<div id="toasts" aria-live="polite"></div><div id="modal" hidden></div><canvas id="fx" aria-hidden="true"></canvas>';
  }

  function parse() {
    let h = '';
    try { h = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (e) { h = ''; }
    h = h || 'accueil';
    for (let i = 0; i < PREFIX.length; i++) {
      if (h.indexOf(PREFIX[i] + '-') === 0) return { name: PREFIX[i], arg: h.slice(PREFIX[i].length + 1), key: h };
    }
    return { name: LQ.views[h] ? h : 'accueil', arg: null, key: h };
  }

  let lastKey = '';
  LQ.route = () => {
    const r = parse(), host = LQ.$('#view');
    if (!host) return;
    if (LQ.run) { if (LQ.run.cfg.persist) LQ.run.persist(); LQ.run.stop(); }
    LQ.cleanup.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* nettoyage au mieux */ } });
    document.body.classList.remove('focus-mode');
    if (r.name !== 'examen') LQ.ui.examView = null;
    const out = (LQ.views[r.name] || LQ.views.accueil)(r.arg) || {};
    host.innerHTML = out.html || '';
    if (out.mount) out.mount();
    const sec = SECTION[r.name] || r.name;
    LQ.$$('[data-nav]').forEach((a) => { const on = a.getAttribute('data-nav') === sec; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (r.key !== lastKey) { window.scrollTo(0, 0); lastKey = r.key; }
    LQ.refreshChrome();
  };

  LQ.refreshChrome = () => {
    const S = LQ.S;
    if (!S || !LQ.$('#chip-lvl')) return;
    const lv = LQ.level(), st = LQ.streakNow();
    const cs = LQ.$('#chip-streak');
    cs.querySelector('b').textContent = st;
    cs.classList.toggle('hot', st > 0);
    LQ.$('#chip-depth b').textContent = Math.floor(LQ.completion().total) + ' m';
    const cl = LQ.$('#chip-lvl');
    cl.querySelector('.lvl-n').textContent = lv.lvl;
    cl.querySelector('.lvl-t').textContent = lv.title;
    cl.querySelector('.lvl-bar b').style.width = lv.pct + '%';
    const due = LQ.dueList().length;
    LQ.$$('[data-nav="jouer"]').forEach((a) => { if (due) a.setAttribute('data-badge', due > 99 ? '99+' : due); else a.removeAttribute('data-badge'); });
    banner();
  };

  /* Rappel permanent quand un examen tourne en arrière-plan : le chronomètre ne s'arrête jamais. */
  function banner() {
    const b = LQ.$('#exam-banner'), run = LQ.S.examRun;
    if (!b) return;
    const active = LQ.run && LQ.run.active && LQ.run.cfg.persist;
    if (!run || active) { b.hidden = true; return; }
    const left = (run.endAt - Date.now()) / 1000;
    if (left <= 0) { b.hidden = true; if (LQ.examResume) LQ.examResume(true); return; }
    b.hidden = false;
    b.innerHTML = icon('clock') + '<span><strong>' + esc(run.title) + '</strong> en cours · il reste ' + LQ.fmtClock(left) + '</span><em>Reprendre</em>';
  }

  function onboarding() {
    const S = LQ.S;
    LQ.modal({
      title: 'Bienvenue sur LakeQuest',
      wide: true,
      html: '<p>Un jeu pour préparer l’examen <strong>AWS Certified Data Engineer – Associate</strong>. Les questions sont en anglais, comme le jour J ; les explications sont en français.</p>' +
        '<label class="field"><span>Ton prénom</span><input type="text" name="name" maxlength="24" autocomplete="given-name" placeholder="Pour te saluer"></label>' +
        '<label class="field"><span>Date de ton examen, si tu la connais</span><input type="date" name="date"></label>' +
        '<label class="switch"><input type="checkbox" name="esl" checked><span></span><span><strong>J’ai l’aménagement ESL +30 minutes</strong><small>Les examens blancs dureront 160 minutes au lieu de 130.</small></span></label>' +
        '<p class="small">Ta progression reste dans ce navigateur. Tu peux l’exporter depuis ton profil.</p>',
      actions: [{ id: 'go', label: 'C’est parti', kind: 'primary' }],
    }).then(() => {
      const d = LQ.modalData || {};
      S.name = String(d.name || '').trim().slice(0, 24);
      S.examDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : '';
      S.settings.esl = d.esl !== false;
      S.settings.onboarded = true;
      LQ.save();
      if (LQ.ui.exam) LQ.ui.exam.esl = S.settings.esl;
      LQ.route();
    });
  }

  LQ.actions['scroll-to'] = (el) => { const t = document.getElementById(el.dataset.id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  function boot() {
    LQ.load();
    if (LQ.packs) LQ.packs.load();
    LQ.initData();
    LQ.applyTheme();
    const app = LQ.$('#app');
    app.innerHTML = shell();

    document.addEventListener('click', (e) => {
      const m = e.target.closest && e.target.closest('[data-modal]');
      if (m) { e.preventDefault(); LQ.closeModal(m.getAttribute('data-modal')); return; }
      const el = e.target.closest && e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = LQ.actions[el.getAttribute('data-act')];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest && e.target.closest('[data-change]');
      if (el && LQ.changes[el.getAttribute('data-change')]) LQ.changes[el.getAttribute('data-change')](el, e);
    });
    document.addEventListener('input', (e) => {
      const el = e.target.closest && e.target.closest('[data-input]');
      if (el && LQ.inputs[el.getAttribute('data-input')]) LQ.inputs[el.getAttribute('data-input')](el, e);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('has-modal')) LQ.closeModal('close'); });
    window.addEventListener('hashchange', LQ.route);
    setInterval(banner, 1000);

    if (LQ.S.examDate && LQ.S.examDate === LQ.dayKey()) LQ.S.cnt.examDay = 1;
    LQ.route();
    LQ.checkTrophies();
    if (!LQ.S.settings.onboarded) onboarding();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
