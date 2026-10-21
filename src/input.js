(function (G) {
  'use strict';

  // Entrada unificada. El juego solo lee:
  //   Input.move {x, y}   movimiento (-1 a 1; y negativo = adelante)
  //   Input.look {x, y}   giro de cámara de este fotograma (radianes)
  //   Input.run, Input.aim                      botones mantenidos
  //   Input.attack, shove, use, cycle, crouch, prone, jump, grip, drop,
  //   slot1, slot2, slot3, pause                pulsados en este fotograma
  //
  // PC: WASD, ratón (clic para capturarlo), clic izq. atacar, clic der. apuntar,
  //     Espacio empujar (o agarrar por la espalda), F esquivar, R recargar, E usar, Q o rueda cambiar arma, 1 2 3 elegir arma,
  //     C agacharse, Z pecho a tierra, V accesorio (silenciador / mira del rifle), Shift correr,
  //     E puertas y ventanas, T registrar y coger, I mochila, B vendarse, Q cambio rápido / selector.
  // Móvil: joystick fijo con bloqueo de carrera (arrástralo hacia arriba), mirar
  //        arrastrando a la derecha, botones al estilo de los shooters de móvil.
  // Mando: sticks, RT atacar, LT apuntar, A usar, X empujar, RB esquivar, Y arma,
  //        LB accesorio o mira, B pecho a tierra, R3 agacharse, L3 correr, Select mochila,
//        cruceta arriba botella a la mano, abajo venda a la mano. PC: G botella, B venda.

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const keys = {};
  const touch = { id: null, cx: 0, cy: 0, x: 0, y: 0, lookId: null, lx: 0, ly: 0, sprintLock: false, aim: false, lootHeld: false };
  const JOY_RADIUS = 56;
  const MOUSE_SENS = 0.0026;
  const TOUCH_SENS = 0.0065;
  const PAD_LOOK = 2.6;
  let mouseDX = 0, mouseDY = 0;
  let mouseAim = false, mouseFire = false;
  const ACTIONS = ['attack', 'dodge', 'reload', 'shove', 'use', 'loot', 'pack', 'bandage', 'quick', 'cycle', 'pause', 'crouch', 'prone', 'jump', 'grip', 'slot1', 'slot2', 'slot3', 'slot4', 'scope', 'throw', 'cancel', 'light'];
  const queued = {};
  ACTIONS.forEach((a) => { queued[a] = false; });
  const prevPad = [];
  let canvas = null;

  // Q (tocar = cambio rápido, mantener = selector de armas) lo lleva el HUD
  const KEYMAP = {
    Space: 'jump', KeyE: 'use', KeyT: 'loot', KeyI: 'pack', KeyB: 'bandage', KeyF: 'dodge', Tab: 'cycle', KeyP: 'pause',
    KeyC: 'crouch', KeyZ: 'prone', KeyV: 'grip',
    Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', KeyX: 'jump', KeyR: 'reload', KeyG: 'throw', KeyL: 'light'
  };

  const Input = {
    isTouch,
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    run: false, aim: false,
    pointerLocked: false,
    enabled: false,
    editing: false,     // editor de botones abierto: los controles no actúan
    blockLook: false,   // selector de armas abierto: el ratón elige en vez de mirar
    scopeable: false,   // el juego avisa si el arma en las manos tiene mira y estás apuntando
    scoped: false,      // ... y si la mira está puesta

    init(canvasEl) {
      canvas = canvasEl;
      ACTIONS.forEach((a) => { this[a] = false; });
      window.addEventListener('keydown', (e) => {
        if (keys[e.code]) return;
        keys[e.code] = true;
        if (!Input.enabled) return;
        const act = KEYMAP[e.code];
        if (act) { queued[act] = true; e.preventDefault(); }
        if (e.code.startsWith('Arrow')) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { keys[e.code] = false; });
      window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseAim = false; mouseFire = false; touch.fire = false; });

      if (!isTouch) {
        canvas.addEventListener('mousedown', (e) => {
          if (!Input.enabled) return;
          if (!Input.pointerLocked) { Input.requestLock(); return; }
          if (e.button === 0) { queued.attack = true; mouseFire = true; }
          if (e.button === 2) { if (mouseFire) queued.cancel = true; else mouseAim = true; }
        });
        window.addEventListener('mouseup', (e) => { if (e.button === 2) mouseAim = false; if (e.button === 0) mouseFire = false; });
        window.addEventListener('mousemove', (e) => {
          // sin ratón capturado (por ejemplo dentro de un iframe) se puede mirar arrastrando
          if (!Input.pointerLocked && !(Input.enabled && e.buttons)) return;
          mouseDX += e.movementX || 0;
          mouseDY += e.movementY || 0;
        });
        window.addEventListener('wheel', (e) => {
          if (Input.enabled && Input.pointerLocked && Math.abs(e.deltaY) > 2) queued.cycle = true;
        }, { passive: true });
        document.addEventListener('pointerlockchange', () => {
          Input.pointerLocked = document.pointerLockElement === canvas;
          if (!Input.pointerLocked) mouseAim = false;
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      } else {
        setupTouch();
      }
    },

    // Para que la interfaz (botones de armas) pueda pedir acciones
    queue(action) { if (Input.enabled && action in queued) queued[action] = true; },

    requestLock() {
      if (isTouch || !canvas || !canvas.requestPointerLock) return;
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* sin bloqueo de puntero */ }
    },

    get sprintLocked() { return touch.sprintLock; },

    update(dt) {
      let x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;
      if (touch.sprintLock && touch.id === null) { y -= 1; }
      else if (Math.hypot(touch.x, touch.y) > 0.12) { x += touch.x; y += touch.y; }

      let lx = this.blockLook ? 0 : mouseDX * MOUSE_SENS + touch.lx * TOUCH_SENS;
      let ly = this.blockLook ? 0 : mouseDY * MOUSE_SENS + touch.ly * TOUCH_SENS;
      mouseDX = mouseDY = 0;
      touch.lx = touch.ly = 0;

      const pad = readPad();
      x += pad.x; y += pad.y;
      lx += pad.lx * PAD_LOOK * dt;
      ly += pad.ly * PAD_LOOK * dt * 0.8;

      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      this.move.x = x; this.move.y = y;
      this.look.x = lx; this.look.y = ly;
      this.run = !!(keys.ShiftLeft || keys.ShiftRight || touch.sprintLock || pad.run);
      this.aim = !!(mouseAim || keys.ControlLeft || pad.aim || touch.aim);
      // atacar mantenido (para apuntar manteniendo el botón con la botella en la mano)
      this.attackHeld = !!(mouseFire || touch.fire || pad.fireHeld);
      for (const a of ACTIONS) this[a] = queued[a] || !!pad[a];
      this.padUse = !!pad.use;      // A del mando: botín o puerta según lo que haya
      // recoger mantenido (T, ∆ o A): coge de golpe todo lo que tienes delante
      this.lootHeld = !!(keys.KeyT || touch.lootHeld || pad.useHeld);
      for (const a of ACTIONS) queued[a] = false;
    },

    clear() {
      for (const a of ACTIONS) queued[a] = false;
      mouseDX = mouseDY = 0;
    },
    // todo a cero en este fotograma (un panel del refugio abierto)
    zero() {
      for (const a of ACTIONS) this[a] = false;
      this.move.x = this.move.y = 0; this.look.x = this.look.y = 0;
      this.run = false; this.aim = false; this.attackHeld = false; this.padUse = false;
    },

    // El juego avisa cuando deja de apuntar (por ejemplo al tumbarse)
    setAim(on) {
      touch.aim = !!on;
      const b = document.getElementById('btn-aim');
      if (b) b.classList.toggle('on', touch.aim);
    },

    setSprintLock(on) {
      touch.sprintLock = !!on;
      const b = document.getElementById('btn-run');
      if (b) b.classList.toggle('on', touch.sprintLock);
    },

    padConfirm() {
      const p = firstPad();
      return !!(p && p.buttons[0] && p.buttons[0].pressed);
    }
  };

  function firstPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) return pads[i];
    return null;
  }

  function readPad() {
    const out = { x: 0, y: 0, lx: 0, ly: 0, run: false, aim: false };
    const p = firstPad();
    if (!p) return out;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    out.x = dz(p.axes[0] || 0); out.y = dz(p.axes[1] || 0);
    out.lx = dz(p.axes[2] || 0); out.ly = dz(p.axes[3] || 0);
    const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4));
    const pressed = (i) => { const now = b(i); const was = prevPad[i]; prevPad[i] = now; return now && !was; };
    // cruceta: arriba la botella (o el ladrillo) a la mano, abajo la venda a la mano
    out.throw = pressed(12);
    out.bandage = pressed(13);
    out.run = b(10);
    out.aim = b(6);
    out.attack = pressed(7);
    out.fireHeld = b(7);
    out.use = pressed(0);
    out.useHeld = b(0);
    out.prone = pressed(1);
    out.reload = pressed(2);
    out.dodge = pressed(5);
    out.cycle = pressed(3);
    out.grip = pressed(4);
    out.pack = pressed(8);
    out.pause = pressed(9);
    out.crouch = pressed(11);
    out.light = pressed(15);       // cruceta derecha: linterna
    return out;
  }

  function setupTouch() {
    const ui = document.getElementById('touch-ui');
    const zone = document.getElementById('joy-zone');
    const lookZone = document.getElementById('look-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    ui.classList.add('visible');

    // Joystick fijo: el centro es el de la base dibujada
    const center = () => {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const setKnob = (dx, dy) => { knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))'; };

    zone.addEventListener('pointerdown', (e) => {
      if (touch.id !== null || Input.editing) return;
      touch.id = e.pointerId;
      const c = center();
      touch.cx = c.x; touch.cy = c.y;
      // tocar el joystick quita el bloqueo de carrera, salvo que sigas empujando hacia arriba
      zone.setPointerCapture(e.pointerId);
      move(e);
      base.classList.add('on');
      e.preventDefault();
    });
    const move = (e) => {
      let dx = e.clientX - touch.cx, dy = e.clientY - touch.cy;
      // arrastrar muy arriba (hasta el botón Correr) bloquea la carrera
      if (dy < -JOY_RADIUS * 1.55 && Math.abs(dx) < JOY_RADIUS) Input.setSprintLock(true);
      else if (touch.sprintLock && dy > -JOY_RADIUS * 0.3) Input.setSprintLock(false);
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
      touch.x = dx / JOY_RADIUS; touch.y = dy / JOY_RADIUS;
      setKnob(dx, dy);
    };
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === touch.id) move(e); });
    const endJoy = (e) => {
      if (e.pointerId !== touch.id) return;
      touch.id = null; touch.x = touch.y = 0;
      setKnob(0, touch.sprintLock ? -JOY_RADIUS : 0);
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', endJoy);
    zone.addEventListener('pointercancel', endJoy);

    // Mirar arrastrando con el pulgar derecho
    let lastX = 0, lastY = 0;
    lookZone.addEventListener('pointerdown', (e) => {
      if (touch.lookId !== null || Input.editing) return;
      touch.lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== touch.lookId) return;
      touch.lx += e.clientX - lastX; touch.ly += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === touch.lookId) touch.lookId = null; };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    // Botones que además dejan mirar si arrastras desde ellos (como en los shooters de móvil)
    const tap = (id, action, opts) => {
      const el = document.getElementById(id);
      if (!el) return;
      let pid = null, bx = 0, by = 0;
      el.addEventListener('pointerdown', (e) => {
        if (Input.editing) return;
        // Apuntar con el rifle: 1.er toque apunta, 2.º pone la mira telescópica, 3.º deja de apuntar
        if (action === 'aim') {
          if (touch.aim && Input.scopeable && !Input.scoped) Input.queue('scope');
          else Input.setAim(!touch.aim);
        }
        else if (action === 'run') Input.setSprintLock(!touch.sprintLock);
        else Input.queue(action);
        if (action === 'attack') touch.fire = true;
        if (action === 'loot') touch.lootHeld = true;
        el.classList.add('down');
        if (opts && opts.look && touch.lookId === null) {
          pid = e.pointerId; bx = e.clientX; by = e.clientY;
          el.setPointerCapture(e.pointerId);
        } else if (action === 'attack') {
          // atacar siempre sigue al dedo (para soltarlo encima de Cancelar aunque no sirva para mirar)
          try { el.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
        }
        e.preventDefault(); e.stopPropagation();
      });
      el.addEventListener('pointermove', (e) => {
        if (action === 'attack') {
          const cb = document.getElementById('btn-cancel');
          if (cb && !cb.classList.contains('hidden')) {
            const r = cb.getBoundingClientRect(), m = 14;
            cb.classList.toggle('hot', e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m);
          }
        }
        if (e.pointerId !== pid) return;
        touch.lx += e.clientX - bx; touch.ly += e.clientY - by;
        bx = e.clientX; by = e.clientY;
      });
      const up = (e) => {
        el.classList.remove('down');
        if (action === 'loot') touch.lootHeld = false;
        if (action === 'attack') {
          touch.fire = false;
          // soltar el dedo encima del botón de cancelar (al apuntar la botella o tensar el arco): no se lanza
          const cb = document.getElementById('btn-cancel');
          if (e && cb && !cb.classList.contains('hidden')) {
            const r = cb.getBoundingClientRect(), m = 14;
            if (e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m) queued.cancel = true;
          }
        }
        if (e && e.pointerId === pid) pid = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    tap('btn-attack', 'attack', { look: true });
    tap('btn-dodge', 'dodge', { look: true });
    tap('btn-reload', 'reload');
    tap('btn-use', 'use');
    tap('btn-loot', 'loot');
    tap('bag', 'pack');
    tap('btn-pause', 'pause');
    tap('btn-crouch', 'crouch');
    tap('btn-prone', 'prone');
    tap('btn-jump', 'jump');
    tap('btn-aim', 'aim');
    tap('btn-run', 'run');
    tap('btn-light', 'light');
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  G.Input = Input;
})(window.Game = window.Game || {});
