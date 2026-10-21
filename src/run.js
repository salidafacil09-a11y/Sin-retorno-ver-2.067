(function (G) {
  'use strict';

  // Modo Retorno: una carrera de 5 enfrentamientos (y el jefe final, todavía «próximamente") con un refugio
  // entre uno y otro. Aquí vive el estado de la carrera: el mapa de enfrentamientos, las monedas (para el
  // puesto de comercio) y las piezas (para el banco de mejoras), las mejoras de las armas, lo que hay a la
  // venta, lo que espera en el cofre de recompensas y lo que llevas encima.
  //
  // Guardado (como un roguelike): solo se guarda en el refugio. Al empezar un enfrentamiento la partida queda
  // marcada; si sales a mitad (o se cierra el juego) la carrera se pierde. Una carrera nueva desde el menú
  // principal empieza de cero (sin mejoras).

  const KEY = 'ceniza.retorno';
  const STEPS = 5;
  const U = G.Util;

  // ---------- Enfrentamientos ----------
  const TYPES = {
    asalto: { name: 'Asalto', text: 'Aguanta tres oleadas de infectados que llegan desde todo el mapa. Al despejar cada oleada aparece un cofre con suministros.', foes: 'Corredores y acechadores; en la 2.ª oleada, a veces un chasqueador o un temblante; en la 3.ª, uno o dos temblantes.' },
    caza: { name: 'Caza', text: 'Sobrevive hasta que se acabe el tiempo. Los infectados no dejan de llegar (como mucho 12 a la vez) y cada vez más rápido cuanto menos falta para volver.', foes: 'Muchos corredores, algunos chasqueadores y pocos acechadores. Sin temblantes.' }
  };
  // duración de la caza según la columna del mapa (segundos)
  const CAZA_T = [120, 135, 150, 165, 180];

  // ---------- Puesto de comercio ----------
  // Solo hay 4 cosas a la vez (y los dados para volver a sortearlas, que cuestan monedas). Se renueva tras cada
  // enfrentamiento. Las monedas cuestan de ganar (de 13 a 32 por enfrentamiento): los precios son bajos.
  // p: peso al sortear lo que sale
  const SHOP = [
    { id: 'venda', name: 'Venda', icon: 'botiquin', n: 1, price: 3, p: 1.0, desc: 'Una venda para curarte.' },
    { id: 'humo', name: 'Bomba de humo', icon: 'humo', n: 1, price: 4, p: 0.6, desc: 'Una nube que aturde a los infectados que la cruzan.' },
    { id: 'molotov', name: 'Molotov', icon: 'molotov', n: 1, price: 4, p: 0.7, desc: 'Prende fuego a todo lo que alcanza.' },
    { id: 'mina', name: 'Mina', icon: 'mina', n: 1, price: 5, p: 0.5, desc: 'Revienta cuando un infectado la pisa.' },
    { id: 'mun_9mm', name: 'Balas de 9 mm', icon: 'mun_9mm', n: 6, price: 2, p: 1.2, desc: 'Munición para la pistola.' },
    { id: 'mun_cartucho', name: 'Cartuchos', icon: 'mun_cartucho', n: 4, price: 3, p: 0.8, desc: 'Munición para las escopetas.' },
    { id: 'mun_rifle', name: 'Balas de rifle', icon: 'mun_rifle', n: 3, price: 3, p: 0.7, desc: 'Munición para el rifle de cerrojo.' },
    { id: 'mun_flecha', name: 'Flechas', icon: 'mun_flecha', n: 4, price: 2, p: 0.7, desc: 'Flechas para el arco (se pueden recuperar).' },
    { id: 'mun_revolver', name: 'Balas de revólver', icon: 'mun_revolver', n: 4, price: 3, p: 0.7, desc: 'Munición para el revólver.' },
    { id: 'mun_smg', name: 'Balas de subfusil', icon: 'mun_smg', n: 16, price: 3, p: 0.5, desc: 'Munición para el subfusil silenciado.' },
    { id: 'mun_gas', name: 'Combustible', icon: 'mun_gas', n: 20, price: 3, p: 0.5, desc: 'Combustible para el lanzallamas.' },
    { id: 'pistola', name: 'Pistola semiautomática', icon: 'pistola', weapon: true, price: 6, p: 0.3, desc: 'Arma corta de 9 mm. Se mejora en el banco de mejoras.' },
    { id: 'revolver', name: 'Revólver', icon: 'revolver', weapon: true, price: 10, p: 0.4, desc: 'Arma corta: mucho daño y seis balas. Se mejora en el banco de mejoras.' },
    { id: 'arco', name: 'Arco', icon: 'arco', weapon: true, price: 10, p: 0.4, desc: 'Silencioso. Mantén Atacar para tensarlo.' },
    { id: 'escopeta', name: 'Escopeta de corredera', icon: 'escopeta', weapon: true, price: 12, p: 0.4, desc: 'Demoledora de cerca. Se mejora en el banco de mejoras.' },
    { id: 'rifle', name: 'Rifle de cerrojo', icon: 'rifle', weapon: true, price: 14, p: 0.35, desc: 'El arma más potente, con mira. Se mejora en el banco de mejoras.' },
    { id: 'doble', name: 'Escopeta de doble cañón', icon: 'doble', weapon: true, price: 14, p: 0.35, desc: 'Dos disparos brutales de cerca.' },
    { id: 'subfusil', name: 'Subfusil silenciado', icon: 'subfusil', weapon: true, special: true, price: 18, p: 0.2, desc: 'Ráfagas casi sin ruido. Arma especial: no se mejora.' },
    { id: 'lanzallamas', name: 'Lanzallamas', icon: 'lanzallamas', weapon: true, special: true, price: 20, p: 0.15, desc: 'Un chorro de fuego de unos 7 m. Arma especial: no se mejora.' }
  ];
  const SHOP_SLOTS = 4, REROLL = 3;

  // Sitios del mapa (nombres para los enfrentamientos; inventados)
  const PLACES = ['Granja del arroyo', 'Taller de la ruta', 'Depósito ferroviario', 'Escuela del barrio', 'Estación de servicio', 'Aserradero',
    'Oficina del primer piso', 'Mercado cubierto', 'Galpón portuario', 'Clínica vieja', 'Biblioteca municipal', 'Planta de agua'];

  // ---------- Desafíos ----------
  // Cada uno cuenta una vez por carrera. Al completarlo, las recompensas del enfrentamiento en el que lo hiciste
  // (piezas, suplementos y monedas) se multiplican según lo difícil que es (si haces varios, se suman). Los
  // difíciles, además, tienen una probabilidad baja de dejar un arma (una sola) sobre un mueble del refugio.
  // Se cuenta también cuántas veces los has hecho en total (en el menú de Desafíos)
  const LEVEL = { facil: { name: 'Fácil', mult: 1.15 }, media: { name: 'Media', mult: 1.3 }, dificil: { name: 'Difícil', mult: 1.5 } };
  const GIFT_P = 0.2;          // probabilidad de arma con un desafío difícil
  const CHALLENGES = [
    { id: 'sigilo_chasq', name: 'Silencio mortal', lv: 'dificil', text: 'Mata a un chasqueador por la espalda sin que se entere.' },
    { id: 'molotov_temb', name: 'Fuego al gigante', lv: 'media', text: 'Mata a un temblante con una molotov.' },
    { id: 'cabezas', name: 'Puntería', lv: 'media', text: 'Mata a 5 infectados de un disparo en la cabeza en un mismo enfrentamiento.' },
    { id: 'remates', name: 'Sin piedad', lv: 'facil', text: 'Remata a 3 infectados aturdidos en un mismo enfrentamiento.' },
    { id: 'intacta', name: 'Ni un rasguño', lv: 'dificil', text: 'Supera una oleada de un asalto sin recibir daño.' },
    { id: 'cazador', name: 'Cazadora', lv: 'facil', text: 'Elimina a 15 infectados en una caza.' }
  ];
  const CKEY = 'ceniza.desafios';
  const GIFTS = ['revolver', 'doble', 'escopeta', 'rifle', 'arco', 'subfusil', 'lanzallamas'];
  function chalRecord() { try { return JSON.parse(localStorage.getItem(CKEY) || '{}') || {}; } catch (e) { return {}; } }

  let st = null;          // estado de la carrera (null: no hay)
  let inRefuge = false;

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function pickMap() { const L = G.Maps ? G.Maps.list() : []; return L.length ? L[Math.floor(Math.random() * L.length)] : null; }
  function mapName(node) { const m = node && node.map && G.Maps && G.Maps.get(node.map); return m ? m.name : (node && node.place) || 'Campo de pruebas'; }
  function makeMap() {
    const cols = [];
    for (let k = 0; k < STEPS; k++) {
      // dos caminos por paso: casi siempre uno de cada; a veces dos iguales
      const a = Math.random() < 0.5 ? 'asalto' : 'caza';
      const b = Math.random() < 0.8 ? (a === 'asalto' ? 'caza' : 'asalto') : a;
      cols.push([a, b].map((type) => ({
        type,
        time: type === 'caza' ? CAZA_T[k] : 0,
        // el mapa (cualquiera, sea asalto o caza) y su nombre
        map: pickMap(),
        // recompensa (en el cofre del refugio): las monedas cuestan de ganar, de 13 a 32; más cuanto más cerca
        // del jefe final y en la caza (más difícil). El asalto da más piezas
        piezas: (type === 'asalto' ? 50 : 35) + k * 10 + rint(0, 2) * 5,
        suplementos: 50 + k * 8 + rint(0, 4) * 5,
        monedas: 13 + k * 4 + (type === 'caza' ? 2 : 0) + rint(0, 1)
      })));
    }
    return cols;
  }

  // 4 cosas al azar (sin repetir, sin armas que ya tengas)
  function makeShop(player) {
    const out = [], pool = {};
    for (const s of SHOP) {
      if (s.weapon && player && player.weapons.some((w) => w.id === s.id)) continue;
      pool[s.id] = s.p;
    }
    while (out.length < SHOP_SLOTS && Object.keys(pool).length) {
      const id = U.weighted(Math.random, pool);
      delete pool[id];
      out.push({ id, left: 1 });
    }
    return out;
  }

  // ---------- Inventario (entre el refugio y los enfrentamientos) ----------
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
  function snapshot(p) {
    return {
      hands: clone(p.hands), stored: clone(p.stored), items: clone(p.items), ammo: clone(p.ammo),
      backpack: !!p.backpack, silencers: p.silencers || 0, arrowExp: !!p.arrowExp, throwable: p.throwable || null,
      health: p.health
    };
  }
  function restore(p, s) {
    if (!s) return;
    p.hands = clone(s.hands) || [];
    while (p.hands.length < 5) p.hands.push(null);
    p.stored = (clone(s.stored) || []).filter(Boolean);
    for (const k in s.items) p.items[k] = s.items[k];
    for (const k in s.ammo) p.ammo[k] = s.ammo[k];
    p.backpack = s.backpack !== false; p.silencers = s.silencers || 0; p.arrowExp = !!s.arrowExp; p.throwable = s.throwable || null;
    // se llega como se estaba (la vida no se llena sola al volver al refugio)
    if (s.health != null) { p.health = Math.max(1, Math.min(100, s.health)); p.heal = 0; }
    // las armas de fuego no traen más balas de las que caben ahora en el cargador
    for (const h of p.hands.concat(p.stored)) if (h && h.mag != null) h.mag = Math.min(h.mag, G.Weapons.get(h.id).mag);
    // (partidas viejas: las armas de fuego ya no se rompen)
    for (const h of p.hands.concat(p.stored)) if (h && G.Weapons.isGun(G.Weapons.get(h.id))) { h.broken = false; h.cond = 1; }
    p.cur = -1; p.prev = -1;
    G.Models.setBackpack(p.model, p.backpack);
    p.refreshModel();
  }

  function save() {
    if (!st || st.free) return;           // el modo libre no se guarda
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* sin guardado */ }
  }
  function readSave() {
    try { const t = localStorage.getItem(KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }

  const Run = {
    STEPS, TYPES, SHOP, REROLL, mapName,
    get active() { return !!st; },
    get st() { return st; },
    get inRefuge() { return inRefuge; },
    set inRefuge(v) { inRefuge = !!v; },
    get step() { return st ? st.step : 0; },
    get monedas() { return st ? st.monedas : 0; },
    get piezas() { return st ? st.piezas : 0; },
    get suplementos() { return st ? (st.suplementos || 0) : 0; },
    // recompensas esperando en el cofre del refugio (o null)
    get pending() { return st ? st.pending || null : null; },
    get done() { return !!st && st.step >= STEPS; },

    // ¿Hay una carrera guardada que se puede continuar? (si saliste en medio de un enfrentamiento, se perdió)
    saveInfo() {
      const s = readSave();
      if (!s || s.v !== 1) return null;
      if (s.inEnc) return { lost: true, char: s.char, step: s.step };
      return { lost: false, char: s.char, step: s.step };
    },
    discard() { st = null; inRefuge = false; try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } G.Weapons.applyUpgrades(null); },

    // Carrera nueva: solo con la pistola (cargador lleno y un cargador de reserva) y una venda
    newRun(charId, player) {
      st = {
        v: 1, char: charId, step: 0, path: [], map: makeMap(), monedas: 4, piezas: 0, suplementos: 0, pending: null, up: {},
        inv: null, shop: [], crate: [], inEnc: false, enc: null, chal: {}, gifts: [],
        totals: { kills: 0, time: 0, score: 0 }, last: null
      };
      G.Weapons.applyUpgrades(st.up);
      if (player) {
        player.hands = [null, null, null, null, null]; player.stored = [];
        player.pickUp('pistola', G.Weapons.get('pistola').mag, 1);
        player.ammo['9mm'] = 6;
        player.items.venda = 1;
        player.equip(-1);
        st.inv = snapshot(player);
      }
      st.shop = makeShop(player);
      save();
    },
    // Continuar la carrera guardada
    load() {
      const s = readSave();
      if (!s || s.v !== 1 || s.inEnc) return false;
      st = s;
      G.Weapons.applyUpgrades(st.up);
      return true;
    },
    save,

    // ---------- Refugio ----------
    // al llegar al refugio: llegas tal cual saliste del enfrentamiento (vida, balas y todo) y se guarda
    enterRefuge(player) {
      if (!st) return;
      inRefuge = true;
      st.inEnc = false; st.enc = null;
      G.Weapons.applyUpgrades(st.up);
      restore(player, st.inv);
      // el arma de un desafío difícil (si salió): espera sobre un mueble del refugio hasta que la cojas
      this.newGift = null;
      const give = (id, mag) => {
        if (player.weapons.some((w) => w.id === id)) return false;
        player.stored.push({ id, mag: mag != null ? mag : G.Weapons.get(id).mag, cond: 1 });
        return true;
      };
      if (st.gifts && st.gifts.length && !st.shelf) { st.shelf = st.gifts[0]; this.newGift = st.shelf; }
      st.gifts = [];
      // (partidas viejas: lo que quedaba en el cofre de antes va a la mochila)
      for (const c of st.crate || []) {
        const w = G.Weapons.get(c.id);
        if (w && w.cat === 'gun') give(c.id, c.cond); else player.takeItem(c.id, c.cond || 1);
      }
      st.crate = [];
      st.inv = snapshot(player);
      save();
    },
    // lo que llevas, otra vez encima (al empezar un enfrentamiento, tras reiniciar el mundo)
    restoreInv(player) { if (st) { G.Weapons.applyUpgrades(st.up); restore(player, st.inv); } },
    // guarda lo que llevas (cada vez que cambia algo en el refugio)
    keep(player) { if (!st || !player) return; st.inv = snapshot(player); save(); },

    // ---------- Mapa ----------
    choices() { return st && st.step < STEPS ? st.map[st.step] : []; },
    // empieza el enfrentamiento i de la columna actual (queda marcado: salir a mitad pierde la carrera)
    beginEncounter(i, player) {
      if (!st || st.step >= STEPS) return null;
      const node = st.map[st.step][i];
      if (!node) return null;
      st.inv = snapshot(player);
      if (!node.map || !(G.Maps && G.Maps.get(node.map))) node.map = pickMap();
      st.enc = { col: st.step, i, type: node.type, time: node.time, map: node.map };
      st.encBonus = 0; st.encChal = [];
      st.inEnc = true;
      inRefuge = false;
      save();
      return st.enc;
    },
    get encounter() { return st ? st.enc : null; },
    // enfrentamiento superado: las recompensas (piezas, suplementos y monedas) esperan en el cofre del refugio
    winEncounter(player, score, stats) {
      if (!st || !st.enc) return null;
      const e = st.enc, node = st.map[e.col][e.i];
      // desafíos completados en este enfrentamiento: multiplican lo que da (se suman entre sí)
      const mult = 1 + (st.encBonus || 0);
      const got = {
        piezas: Math.round(node.piezas * mult),
        suplementos: Math.round((node.suplementos != null ? node.suplementos : 50 + e.col * 8) * mult),
        monedas: Math.round((node.monedas != null && node.monedas <= 32 ? node.monedas : 13 + e.col * 4) * mult),
        place: mapName(node), type: e.type, mult: Math.round(mult * 100) / 100, chals: (st.encChal || []).slice()
      };
      st.encBonus = 0; st.encChal = [];
      const p = st.pending;
      if (p) { p.piezas += got.piezas; p.suplementos += got.suplementos; p.monedas += got.monedas; p.place = got.place; p.type = got.type; p.mult = got.mult; p.chals = got.chals; }
      else st.pending = Object.assign({}, got);
      st.path.push(e.i);
      st.step++;
      st.totals.score += score || 0;
      if (stats) { st.totals.kills += stats.kills || 0; st.totals.time += stats.time || 0; }
      st.inv = snapshot(player);
      st.shop = makeShop(player);
      st.last = got;
      // el enfrentamiento ya terminó: si sales ahora, se continúa desde el refugio
      st.inEnc = false;
      save();
      return got;
    },

    // recoger lo del cofre del refugio
    takeRewards(player) {
      const p = st && st.pending;
      if (!p) return null;
      st.piezas += p.piezas; st.suplementos = (st.suplementos || 0) + p.suplementos; st.monedas += p.monedas;
      st.pending = null;
      if (player) st.inv = snapshot(player);
      save();
      return p;
    },

    // ---------- Comercio ----------
    shopList() { return st ? st.shop.filter((o) => SHOP.some((s) => s.id === o.id)).map((o) => Object.assign({}, SHOP.find((s) => s.id === o.id), { left: o.left }, st.free ? { price: 0 } : {})) : []; },
    // los dados: vuelve a sortear lo que hay a la venta (cuesta monedas)
    rerollWhyNot() { if (!st || st.free) return 'No disponible'; return st.monedas < REROLL ? 'Te faltan monedas' : null; },
    reroll(player) {
      const no = this.rerollWhyNot();
      if (no) return { msg: no, fail: true };
      st.monedas -= REROLL;
      st.shop = makeShop(player);
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return { msg: 'El puesto de comercio cambió' };
    },
    // Modo libre: comercio y banco de mejoras gratis (todo a la venta, sin gastar nada). No se guarda
    get free() { return !!(st && st.free); },
    startFree(charId) {
      st = {
        v: 1, free: true, char: charId, step: 0, path: [], map: makeMap(), monedas: 0, piezas: 0, up: {},
        inv: null, shop: SHOP.map((s) => ({ id: s.id, left: 99 })), crate: [], inEnc: false, enc: null, chal: {}, gifts: [],
        totals: { kills: 0, time: 0, score: 0 }, last: null
      };
      inRefuge = false;
      G.Weapons.applyUpgrades(st.up);
    },
    endFree() { if (st && st.free) { st = null; inRefuge = false; G.Weapons.applyUpgrades(null); } },
    // por qué no se puede comprar (o null)
    whyNot(o, player) {
      if (!o || o.left <= 0) return 'Agotado';
      if (st.monedas < o.price) return 'Te faltan monedas';
      if (o.weapon) return player.weapons.some((w) => w.id === o.id) ? 'Ya la tienes' : (player.spotFor(o.id) ? null : 'Sin espacio');
      if (o.id === 'molotov') return player.fullOf('molotov') ? 'No te caben más' : null;
      return player.itemRoom(o.id) > 0 ? null : 'No te caben más';
    },
    buy(id, player) {
      if (!st) return null;
      const o = this.shopList().find((x) => x.id === id);
      const no = this.whyNot(o, player);
      if (no) return { msg: no, fail: true };
      let msg;
      if (o.weapon) {
        const w = G.Weapons.get(o.id);
        const r = player.pickUp(o.id, w.mag, 1);
        if (!r.ok) return { msg: 'Sin espacio', fail: true };
        player.equip(-1);
        msg = 'Compraste: ' + w.name;
      } else if (o.id === 'molotov') {
        player.items.molotov = (player.items.molotov || 0) + 1; msg = 'Compraste una molotov';
      } else {
        const r = player.takeItem(o.id, o.n);
        msg = 'Compraste: ' + (o.n > 1 ? o.n + ' ' : '') + o.name.toLowerCase() + (r.left > 0 ? ' (no te cabía todo)' : '');
      }
      st.monedas -= o.price;
      const so = st.shop.find((x) => x.id === id);
      if (!st.free) so.left = 0;
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return { msg };
    },

    // ---------- Mejoras ----------
    upgraded(wid, uid) { return !!(st && st.up[wid] && st.up[wid][uid]); },
    upgradeWhyNot(wid, u) {
      if (!st) return 'Sin carrera';
      if (this.upgraded(wid, u.id)) return 'Mejorada';
      if (u.req && !this.upgraded(wid, u.req)) return 'Antes: ' + G.Weapons.UPGRADES[wid].find((x) => x.id === u.req).name;
      if (!st.free && st.piezas < u.cost) return 'Te faltan piezas';
      return null;
    },
    upgrade(wid, uid, player) {
      const u = (G.Weapons.UPGRADES[wid] || []).find((x) => x.id === uid);
      if (!u) return { msg: 'No existe', fail: true };
      const no = this.upgradeWhyNot(wid, u);
      if (no) return { msg: no, fail: true };
      if (!st.free) st.piezas -= u.cost;
      (st.up[wid] || (st.up[wid] = {}))[uid] = true;
      G.Weapons.applyUpgrades(st.up);
      // con más capacidad, el cargador se llena gratis (como en el banco del vídeo de referencia)
      if (uid === 'capacidad') for (const h of player.hands.concat(player.stored)) if (h && h.id === wid) h.mag = G.Weapons.get(wid).mag;
      this.keep(player);
      return { msg: G.Weapons.get(wid).name + ': ' + u.name + ' mejorada' };
    },

    // ---------- Cofre de recompensas ----------
    get crate() { return st ? st.crate : []; },

    // ---------- Desafíos ----------
    CHALLENGES, LEVEL,
    // el arma esperando sobre un mueble del refugio (o null) y cogerla
    get shelf() { return st ? st.shelf || null : null; },
    takeShelf(player) {
      const id = st && st.shelf;
      if (!id) return null;
      const w = G.Weapons.get(id);
      if (player.weapons.some((x) => x.id === id)) { st.shelf = null; this.keep(player); return 'Ya tienes ' + w.name.toLowerCase(); }
      const r = player.pickUp(id, w.mag, 1);
      if (!r || !r.ok) player.stored.push({ id, mag: w.mag, cond: 1 });
      st.shelf = null;
      this.keep(player);
      if (G.Audio) G.Audio.play('pickup');
      return 'Cogiste: ' + w.name;
    },
    chalDone(id) { return !!(st && st.chal && st.chal[id]); },
    chalTimes(id) { return chalRecord()[id] || 0; },
    // completar un desafío (en una carrera): una sola vez por carrera. Multiplica las recompensas de este
    // enfrentamiento; si es difícil, a veces deja un arma (una sola, y solo si no hay ya otra esperando)
    challenge(id, player) {
      const c = CHALLENGES.find((x) => x.id === id);
      if (!st || !c) return null;
      st.chal = st.chal || {}; st.gifts = st.gifts || [];
      if (st.chal[id]) return null;
      st.chal[id] = true;
      const rec = chalRecord(); rec[id] = (rec[id] || 0) + 1;
      try { localStorage.setItem(CKEY, JSON.stringify(rec)); } catch (e) { /* nada */ }
      const L = LEVEL[c.lv] || LEVEL.facil;
      st.encBonus = (st.encBonus || 0) + (L.mult - 1);
      (st.encChal || (st.encChal = [])).push(c.name);
      let gift = null;
      if (c.lv === 'dificil' && !st.shelf && !st.gifts.length && Math.random() < GIFT_P) {
        const have = new Set(player ? player.weapons.map((w) => w.id) : []);
        const pool = GIFTS.filter((g) => !have.has(g));
        if (pool.length) { gift = pool[Math.floor(Math.random() * pool.length)]; st.gifts.push(gift); }
      }
      save();
      return { gift, c, mult: L.mult, total: Math.round((1 + st.encBonus) * 100) / 100 };
    },

    // ---------- Final ----------
    get totals() { return st ? st.totals : null; },
    get last() { return st ? st.last : null; }
  };

  G.Run = Run;
})(window.Game = window.Game || {});
