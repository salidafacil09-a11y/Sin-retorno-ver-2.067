(function (G) {
  'use strict';

  // Menú de pausa: a la izquierda la lista (de momento solo funciona Opciones) y, dentro de Opciones, pestañas
  // con todas las opciones hechas igual: nombre a la izquierda, valor a la derecha (sí/no, barra con número o
  // selector) y a un lado la explicación de la opción elegida. Táctil, ratón y teclado (flechas, Intro, Esc)
  const S = () => G.Settings;
  const el = (id) => document.getElementById(id);

  const MAIN = [
    { id: 'options', name: 'Opciones', note: 'Ajustes del juego, la imagen, el sonido y los controles.' },
    { id: 'retos', name: 'Desafíos', note: 'Los desafíos de Retorno y los que llevas en esta carrera.' },
    { id: 'foto', name: 'Modo foto', soon: true },
    { id: 'extras', name: 'Extras', soon: true },
    { id: 'tutos', name: 'Tutoriales', soon: true },
    { id: 'salir', name: 'Ir al menú principal', note: 'Volver al menú principal.' }
  ];
  const SOON = 'Todavía no está disponible: llegará en una próxima versión.';

  const QUAL = [['auto', 'Auto'], ['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']];
  const TABS = [
    { name: 'Opciones', rows: [
      { sec: 'Juego' },
      { type: 'toggle', label: 'Abrir puertas al correr', get: () => S().autoDoors, set: (v) => S().setAutoDoors(v), def: true,
        desc: 'Corriendo hacia una puerta cerrada, la abres de un empujón sin pararte (hace ruido).' },
      { type: 'toggle', label: 'Subtítulos de combate', get: () => S().subs, set: (v) => S().setSubs(v), def: true,
        desc: 'Los avisos de lo que pasa en el combate, arriba a la izquierda.' },
      { type: 'toggle', label: 'Consejos', get: () => S().tips, set: (v) => S().setTips(v), def: true,
        desc: 'Las ayudas que salen arriba en el centro (cómo usar un objeto, qué hacer con un enemigo...).' },
      { type: 'toggle', label: 'Pruebas de desarrollador', get: () => S().dev, set: (v) => S().setDev(v), def: false,
        desc: 'Todas las armas y munición sin fin, para probar cosas.' },
      { sec: 'Imagen' },
      { type: 'choice', label: 'Calidad', opts: QUAL, get: () => S().quality, set: (v) => S().setQuality(v), def: 'auto',
        desc: () => 'Detalle de la imagen. En Auto se ajusta sola según cómo vaya el juego' + (S().quality === 'auto' ? ' (ahora: ' + S().qualityNow + ').' : '.') },
      { type: 'toggle', label: 'Limitar a 30 fps', get: () => S().fps30, set: (v) => S().setFps30(v), def: false,
        desc: 'Menos imágenes por segundo: el móvil se calienta menos y la batería dura más.' },
      { type: 'slider', label: 'Distancia de la cámara', min: -40, max: 40, step: 5, get: () => S().zoom, set: (v) => S().setZoom(v), def: 0,
        fmt: (v) => (v > 0 ? '+' : '') + v + ' %', desc: 'Más cerca o más lejos del personaje.' }
    ] },
    { name: 'Sonido', rows: [
      { sec: 'Volumen' },
      ...[['master', 'General', 'Todo el sonido del juego.'], ['zombies', 'Zombis', 'Gruñidos, gritos y pasos de los infectados.'],
        ['guns', 'Disparos y explosiones', 'Armas de fuego, el arco, las minas y las explosiones.'], ['amb', 'Ambiente', 'Viento, el sonido de fondo de cada sitio y los ruidos lejanos.'],
        ['fx', 'Efectos', 'Golpes, pasos, puertas, vidrios y objetos.']].map(([k, label, desc]) => ({
        type: 'slider', label, min: 0, max: 100, step: 5, get: () => S().vol(k), set: (v) => S().setVol(k, v), done: () => S().previewVol(k),
        def: () => S().volDefault(k), desc
      }))
    ] },
    { name: 'Controles', rows: [
      { sec: 'Menú de armas' },
      { type: 'slider', label: 'Sensibilidad del menú de armas', min: 1, max: 10, step: 1, get: () => S().weaponSens, set: (v) => S().setWeaponSens(v), def: 5,
        desc: 'Cuánto hay que deslizar el dedo (o mover el ratón) para pasar de una casilla a otra en la cruz de armas. Más alto: menos recorrido.' },
      { sec: 'Pantalla táctil', touch: true },
      { type: 'action', label: 'Editar botones', touch: true, run: () => S().editButtons(),
        desc: 'Mueve y cambia el tamaño de los botones de la pantalla.' }
    ] }
  ];

  let vRetos = null;
  let root = null, vMain = null, vOpts = null, list = null, note = null, tabsEl = null, rowsEl = null, descT = null, descP = null;
  let view = 'main', mainSel = 0, tab = 0, rowSel = -1, open = false, fromMenu = null, quitArm = false;

  function svgIcon(kind) {
    if (kind === 'x') return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M6.8 6.8 L13.2 13.2 M13.2 6.8 L6.8 13.2"/></svg>';
    if (kind === 'o') return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><circle cx="10" cy="10" r="4"/></svg>';
    return '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M10 5.5 L10 11.5 M10 13.6 L10 14.6"/></svg>';
  }

  function init() {
    root = el('paused');
    if (!root) return;
    root.classList.add('pm');
    root.innerHTML =
      '<div class="pm-view pm-main">' +
        '<ul class="pm-list"></ul>' +
        '<div class="pm-note"><i>' + svgIcon('!') + '</i><p></p></div>' +
      '</div>' +
      '<div class="pm-view pm-retos hidden"><h3>Desafíos</h3><p class="pm-rnote"></p><div class="pm-rlist"></div></div>' +
      '<div class="pm-view pm-opts hidden">' +
        '<div class="pm-tabs"></div>' +
        '<div class="pm-body"><div class="pm-rows"></div><div class="pm-desc"><b></b><p></p></div></div>' +
      '</div>' +
      '<div class="pm-foot">' +
        '<button type="button" data-pm="ok">' + svgIcon('x') + 'Seleccionar</button>' +
        '<button type="button" data-pm="reset" class="pm-reset hidden">' + svgIcon('!') + 'Restablecer a los valores predeterminados</button>' +
        '<button type="button" data-pm="back">' + svgIcon('o') + 'Atrás</button>' +
      '</div>';
    vMain = root.querySelector('.pm-main'); vOpts = root.querySelector('.pm-opts'); vRetos = root.querySelector('.pm-retos');
    list = root.querySelector('.pm-list'); note = root.querySelector('.pm-note');
    tabsEl = root.querySelector('.pm-tabs'); rowsEl = root.querySelector('.pm-rows');
    descT = root.querySelector('.pm-desc b'); descP = root.querySelector('.pm-desc p');
    list.innerHTML = MAIN.map((m, i) => '<li><button type="button" data-i="' + i + '"' + (m.soon ? ' class="soon"' : '') + '>' + m.name + '</button></li>').join('');
    list.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { mainSel = +b.dataset.i; markMain(); activateMain(); } });
    list.addEventListener('pointerover', (e) => { const b = e.target.closest('button[data-i]'); if (b && e.pointerType === 'mouse') { mainSel = +b.dataset.i; markMain(); } });
    tabsEl.innerHTML = TABS.map((t, i) => '<button type="button" data-t="' + i + '">' + t.name + '</button>').join('');
    tabsEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) setTab(+b.dataset.t); });
    root.querySelector('.pm-foot').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-pm]');
      if (!b) return;
      if (b.dataset.pm === 'back') back();
      else if (b.dataset.pm === 'reset') resetTab();
      else if (view === 'main') activateMain();
      else if (rowSel >= 0) activateRow(rowSel, 1);
    });
    window.addEventListener('keydown', onKey, true);
  }

  // ---------- Lista principal ----------
  function markMain() {
    list.querySelectorAll('button').forEach((b, i) => b.classList.toggle('sel', i === mainSel));
    const m = MAIN[mainSel];
    if (m.id !== 'salir') quitArm = false;
    const danger = m.id === 'salir' && S() && S().quitDanger;
    note.classList.toggle('warn', !!m.soon || danger || (m.id === 'salir' && quitArm));
    note.querySelector('p').textContent = m.soon ? m.name + ': ' + SOON.charAt(0).toLowerCase() + SOON.slice(1)
      : (m.id === 'salir' ? (S() ? S().quitNote : m.note) + (quitArm ? ' Pulsa Seleccionar otra vez para salir.' : '') : m.note);
  }
  function activateMain() {
    const m = MAIN[mainSel];
    if (m.soon) { note.classList.remove('pulse'); void note.offsetWidth; note.classList.add('pulse'); return; }
    if (m.id === 'options') showOpts();
    if (m.id === 'retos') showRetos();
    if (m.id === 'salir') {
      // hay que confirmarlo (una segunda vez)
      if (!quitArm) { quitArm = true; markMain(); note.classList.remove('pulse'); void note.offsetWidth; note.classList.add('pulse'); return; }
      quitArm = false;
      if (S() && S().quitToMenu) S().quitToMenu();
    }
  }
  // Desafíos: la lista, cuántas veces los has hecho y si ya cuentan en la carrera de ahora
  function showRetos() {
    view = 'retos';
    vMain.classList.add('hidden'); vOpts.classList.add('hidden'); vRetos.classList.remove('hidden');
    root.querySelector('.pm-reset').classList.add('hidden');
    const R = G.Run, run = !!(R && R.active);
    vRetos.querySelector('.pm-rnote').textContent = 'Cada desafío cuenta una vez por carrera de Retorno: multiplica las piezas, los suplementos y las monedas del enfrentamiento en el que lo completes (más cuanto más difícil). Los difíciles, a veces, dejan un arma en el refugio.';
    vRetos.querySelector('.pm-rlist').innerHTML = (R ? R.CHALLENGES : []).map((c) => {
      const now = run && R.chalDone(c.id), n = R.chalTimes(c.id);
      const L = R.LEVEL[c.lv] || R.LEVEL.facil;
      return '<div class="pm-rrow' + (now ? ' done' : '') + '"><i>' + (now ? '✓' : '') + '</i><span><b>' + c.name + ' <u class="lv-' + c.lv + '">' + L.name + ' · ×' + String(L.mult).replace('.', ',') + '</u></b><small>' + c.text + '</small></span><em>' +
        (now ? 'En esta carrera' : (n ? 'Hecho ' + n + (n === 1 ? ' vez' : ' veces') : 'Sin completar')) + '</em></div>';
    }).join('');
  }
  function showMain() {
    view = 'main';
    vMain.classList.remove('hidden'); vOpts.classList.add('hidden'); if (vRetos) vRetos.classList.add('hidden');
    root.querySelector('.pm-reset').classList.add('hidden');
    markMain();
  }
  function showOpts() {
    view = 'opts';
    vMain.classList.add('hidden'); vOpts.classList.remove('hidden'); if (vRetos) vRetos.classList.add('hidden');
    root.querySelector('.pm-reset').classList.remove('hidden');
    setTab(tab);
  }

  // ---------- Opciones ----------
  const touch = () => !!(G.Input && G.Input.isTouch);
  function visibleRows() { return TABS[tab].rows.filter((r) => !r.touch || touch()); }
  function setTab(i) {
    tab = (i + TABS.length) % TABS.length;
    tabsEl.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === tab));
    rowSel = -1;
    renderRows();
    const rows = visibleRows();
    const first = rows.findIndex((r) => !r.sec);
    selectRow(first);
  }
  function valueHtml(r) {
    if (r.type === 'toggle') { const on = !!r.get(); return '<span class="pm-val"><small>' + (on ? 'SÍ' : 'NO') + '</small><i class="pm-sw' + (on ? ' on' : '') + '"><b></b></i></span>'; }
    if (r.type === 'choice') { const v = r.get(), o = r.opts.find((x) => x[0] === v) || r.opts[0]; return '<span class="pm-val pm-ch"><em data-d="-1">‹</em><small>' + o[1] + '</small><em data-d="1">›</em></span>'; }
    if (r.type === 'slider') {
      const v = +r.get(), k = (v - r.min) / (r.max - r.min);
      return '<span class="pm-val pm-sl"><small>' + (r.fmt ? r.fmt(v) : v) + '</small><span class="pm-track"><i style="width:' + (k * 100).toFixed(1) + '%"></i><b style="left:' + (k * 100).toFixed(1) + '%"></b></span></span>';
    }
    return '<span class="pm-val"><svg viewBox="0 0 20 20" class="pm-go" aria-hidden="true"><rect x="3.5" y="5.5" width="10" height="10"/><path d="M7 3.5 L16.5 3.5 L16.5 13"/></svg></span>';
  }
  function renderRows() {
    const rows = visibleRows();
    rowsEl.innerHTML = rows.map((r, i) => r.sec ? '<h4>' + r.sec + '</h4>'
      : '<div class="pm-row' + (i === rowSel ? ' sel' : '') + '" data-r="' + i + '"><span class="pm-lb">' + r.label + '</span>' + valueHtml(r) + '</div>').join('');
    rowsEl.querySelectorAll('.pm-row').forEach((d) => {
      const i = +d.dataset.r, r = rows[i];
      d.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') selectRow(i); });
      if (r.type === 'slider') {
        const tr = d.querySelector('.pm-track');
        const at = (e) => { const b = tr.getBoundingClientRect(); const k = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)); setVal(r, r.min + Math.round(k * (r.max - r.min) / r.step) * r.step); };
        tr.addEventListener('pointerdown', (e) => { e.preventDefault(); selectRow(i); try { tr.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } tr._drag = true; at(e); });
        tr.addEventListener('pointermove', (e) => { if (tr._drag) at(e); });
        const up = () => { if (tr._drag) { tr._drag = false; if (r.done) r.done(); } };
        tr.addEventListener('pointerup', up); tr.addEventListener('pointercancel', up);
        d.addEventListener('click', (e) => { if (!e.target.closest('.pm-track')) selectRow(i); });
      } else if (r.type === 'choice') {
        d.addEventListener('click', (e) => { selectRow(i); const a = e.target.closest('em[data-d]'); activateRow(i, a ? +a.dataset.d : 1); });
      } else d.addEventListener('click', () => { selectRow(i); activateRow(i, 1); });
    });
  }
  function selectRow(i) {
    const rows = visibleRows();
    if (i < 0 || !rows[i] || rows[i].sec) return;
    rowSel = i;
    rowsEl.querySelectorAll('.pm-row').forEach((d) => d.classList.toggle('sel', +d.dataset.r === i));
    const r = rows[i];
    descT.textContent = r.label;
    descP.textContent = typeof r.desc === 'function' ? r.desc() : (r.desc || '');
    const d = rowsEl.querySelector('.pm-row[data-r="' + i + '"]');
    if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' });
  }
  function setVal(r, v) {
    if (r.type === 'slider') v = Math.max(r.min, Math.min(r.max, v));
    if (r.get() === v) return;
    r.set(v);
    refresh();
  }
  function activateRow(i, dir) {
    const r = visibleRows()[i];
    if (!r || r.sec) return;
    if (r.type === 'toggle') setVal(r, !r.get());
    else if (r.type === 'choice') { const k = r.opts.findIndex((x) => x[0] === r.get()); setVal(r, r.opts[(k + dir + r.opts.length) % r.opts.length][0]); }
    else if (r.type === 'slider') { setVal(r, +r.get() + dir * r.step); if (r.done) r.done(); }
    else if (r.type === 'action') r.run();
  }
  function resetTab() {
    for (const r of visibleRows()) {
      if (r.sec || r.def === undefined) continue;
      const d = typeof r.def === 'function' ? r.def() : r.def;
      if (r.get() !== d) r.set(d);
    }
    refresh();
  }

  function back() {
    // abiertas desde el menú de inicio: Atrás las cierra y vuelve allí
    if ((view === 'opts' || view === 'retos') && fromMenu) { const f = fromMenu; fromMenu = null; open = false; root.classList.add('hidden'); f(); return; }
    if (view === 'opts' || view === 'retos') { showMain(); return; }
    if (S()) S().resume();
  }

  function refresh() {
    if (!open || view !== 'opts') return;
    const keep = rowSel;
    renderRows();
    if (keep >= 0) selectRow(keep);
  }

  function onKey(e) {
    if (!open || !root || root.classList.contains('hidden') || (G.HudEdit && G.HudEdit.editing)) return;
    const c = e.code;
    let used = true;
    if (view === 'retos') {
      if (c === 'Escape' || c === 'Backspace' || c === 'Enter' || c === 'Space' || c === 'KeyP') back(); else used = false;
    } else if (view === 'main') {
      if (c === 'ArrowDown' || c === 'KeyS') { mainSel = (mainSel + 1) % MAIN.length; markMain(); }
      else if (c === 'ArrowUp' || c === 'KeyW') { mainSel = (mainSel - 1 + MAIN.length) % MAIN.length; markMain(); }
      else if (c === 'Enter' || c === 'Space') activateMain();
      else if (c === 'Escape' || c === 'Backspace' || c === 'KeyP') back();
      else used = false;
    } else {
      const rows = visibleRows();
      const move = (d) => { let i = rowSel; for (let k = 0; k < rows.length; k++) { i = (i + d + rows.length) % rows.length; if (!rows[i].sec) { selectRow(i); break; } } };
      if (c === 'ArrowDown' || c === 'KeyS') move(1);
      else if (c === 'ArrowUp' || c === 'KeyW') move(-1);
      else if (c === 'ArrowRight' || c === 'KeyD') { if (rowSel >= 0 && rows[rowSel].type !== 'action') activateRow(rowSel, 1); }
      else if (c === 'ArrowLeft' || c === 'KeyA') { if (rowSel >= 0 && rows[rowSel].type !== 'action') activateRow(rowSel, -1); }
      else if (c === 'Enter' || c === 'Space') { if (rowSel >= 0) activateRow(rowSel, 1); }
      else if (c === 'KeyQ' || c === 'PageUp') setTab(tab - 1);
      else if (c === 'KeyE' || c === 'PageDown' || c === 'Tab') setTab(tab + 1);
      else if (c === 'Escape' || c === 'Backspace') back();
      else used = false;
    }
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }

  G.PauseMenu = {
    init,
    open() { open = true; fromMenu = null; quitArm = false; showMain(); },
    openOptions(onClose) { open = true; fromMenu = onClose || (() => {}); root.classList.remove('hidden'); showOpts(); },
    openChallenges(onClose) { open = true; fromMenu = onClose || (() => {}); root.classList.remove('hidden'); showRetos(); },
    close() { open = false; },
    refresh,
    get handlesKeys() { return open; }
  };
})(window.Game = window.Game || {});
