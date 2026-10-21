(function (G) {
  'use strict';

  // Muebles y vehículos: dónde se colocan, cómo se ven y qué hay dentro.
  // Cada mueble es una caja (AABB) que bloquea el paso; los que son contenedores
  // se pueden registrar (Abrir/Registrar) y sueltan lo que tengan dentro.
  // Se colocan contra las paredes, sin tapar puertas, y comprobando que la
  // habitación siga siendo transitable.

  const U = G.Util;

  // ---------- Tipos ----------
  // w: ancho (a lo largo de la pared) · d: fondo · h: alto · cont: tipo de contenedor (o null)
  // tall: no va delante de ventanas · block: la casilla queda ocupada para los zombis
  const T = {
    cama: { w: 1.45, d: 2.0, h: 0.55, cont: null, block: true },
    cama1: { w: 0.95, d: 2.0, h: 0.55, cont: null, block: true },
    mesita: { w: 0.45, d: 0.42, h: 0.55, cont: 'mesita' },
    comoda: { w: 1.2, d: 0.5, h: 0.9, cont: 'comoda' },
    armario: { w: 1.0, d: 0.6, h: 1.95, cont: 'armario', tall: true, block: true },
    sofa: { w: 1.9, d: 0.85, h: 0.85, cont: null, block: true },
    sillon: { w: 0.85, d: 0.85, h: 0.85, cont: null, block: true },
    mueble_tv: { w: 1.4, d: 0.45, h: 0.55, cont: 'mueble_tv' },
    estanteria: { w: 0.9, d: 0.35, h: 1.9, cont: 'estanteria', tall: true },
    encimera: { w: 1.0, d: 0.6, h: 0.92, cont: 'armario_cocina', block: true },
    fregadero: { w: 1.0, d: 0.6, h: 0.92, cont: 'armario_cocina', block: true },
    fogon: { w: 0.7, d: 0.6, h: 0.92, cont: null, block: true },
    nevera: { w: 0.72, d: 0.68, h: 1.8, cont: 'nevera', tall: true, block: true },
    mesa: { w: 1.5, d: 0.9, h: 0.76, cont: null, block: true, center: true },
    inodoro: { w: 0.42, d: 0.62, h: 0.78, cont: null },
    lavabo: { w: 0.6, d: 0.45, h: 0.88, cont: 'botiquin' },
    banera: { w: 1.6, d: 0.75, h: 0.58, cont: null, block: true },
    lavadora: { w: 0.62, d: 0.6, h: 0.86, cont: null },
    banco: { w: 1.7, d: 0.7, h: 0.92, cont: 'banco', block: true },
    caja_herr: { w: 0.6, d: 0.35, h: 0.32, cont: 'caja_herr' },
    escritorio: { w: 1.3, d: 0.65, h: 0.76, cont: 'escritorio', block: true },
    archivador: { w: 0.5, d: 0.62, h: 1.3, cont: 'archivador', tall: true },
    taquilla: { w: 0.48, d: 0.5, h: 1.85, cont: 'taquilla', tall: true },
    armero: { w: 1.1, d: 0.5, h: 1.9, cont: 'armero', tall: true },
    camilla: { w: 0.9, d: 2.0, h: 0.7, cont: null, block: true },
    carrito: { w: 0.6, d: 0.45, h: 0.9, cont: 'carrito' },
    mostrador: { w: 2.2, d: 0.7, h: 1.0, cont: 'mostrador', block: true, center: true },
    gondola: { w: 3.0, d: 0.7, h: 1.55, cont: 'estante', block: true, center: true },
    estante: { w: 1.8, d: 0.55, h: 2.0, cont: 'estante', tall: true, block: true },
    cajas: { w: 0.8, d: 0.8, h: 0.62, cont: 'cajas' },
    banco_espera: { w: 1.8, d: 0.55, h: 0.5, cont: null },
    // refugio (modo Retorno): mesa del mapa con el corcho detrás, cofre de recompensas, puesto de comercio y
    // banco de mejoras con su tapete
    mesa_mapa: { w: 2.0, d: 0.9, h: 0.8, cont: null, block: true },
    cofre: { w: 1.3, d: 0.64, h: 0.5, cont: null, block: true },
    puesto: { w: 2.0, d: 0.6, h: 2.05, cont: null, block: true, tall: true },      // comercio: armario lleno de armas
    banco_mej: { w: 2.0, d: 0.8, h: 0.92, cont: null, block: true },
    // vehículos (no funcionan; algunos tienen un cofre que se puede registrar)
    // ---- mapas (terminal de carga, calles, escuela): contenedores de carga (solo se dibujan: los costados son
    // aristas CONT), tanques, palés, lonas, barreras, bidones, tubos, bloques, charcos y vehículos abandonados
    cont6: { w: 6.0, d: 2.36, h: 2.6, cont: null, deco: true },
    cont12: { w: 12.0, d: 2.36, h: 2.6, cont: null, deco: true },
    ibc: { w: 1.2, d: 1.0, h: 1.16, cont: null, block: true },
    palets: { w: 1.2, d: 1.0, h: 0.72, cont: null, block: true },
    lona: { w: 1.9, d: 1.3, h: 1.1, cont: null, block: true },
    barrera: { w: 2.0, d: 0.62, h: 0.82, cont: null, block: true },
    bidones: { w: 1.3, d: 0.7, h: 0.92, cont: null, block: true },
    tubo: { w: 2.2, d: 1.2, h: 1.2, cont: null, block: true },
    bloques: { w: 1.2, d: 0.9, h: 0.88, cont: null, block: true },
    charco: { w: 3.0, d: 2.0, h: 0.01, cont: null, deco: true, flat: true },
    persiana: { w: 3.0, d: 0.12, h: 3.4, cont: null, deco: true },
    galpon: { w: 14.0, d: 5.0, h: 7.5, cont: null, deco: true },
    camioneta: { w: 2.0, d: 5.3, h: 1.85, cont: 'maletero', block: true, vehicle: true },
    coche: { w: 1.8, d: 4.4, h: 1.45, cont: 'maletero', block: true, vehicle: true },
    montacargas: { w: 1.2, d: 2.7, h: 2.25, cont: 'maletero', block: true, vehicle: true },
    camion: { w: 2.5, d: 7.4, h: 3.0, cont: 'cofre_camion', block: true, vehicle: true },
    patrulla: { w: 1.85, d: 4.6, h: 1.5, cont: 'maletero', block: true, vehicle: true },
    ambulancia: { w: 2.1, d: 5.6, h: 2.6, cont: 'ambulancia', block: true, vehicle: true }
  };

  // ---------- Contenedores: nombre y botín ----------
  // chance: probabilidad de que haya algo · table: pesos · fixed: siempre · extra: [id, probabilidad]
  const C = {
    mesita: { name: 'Mesita de noche', chance: 0.45, table: { mun_9mm: 1.8, pistola: 0.8, cuchillo_caza: 0.6, destornillador: 1, silenciador: 0.08 } },
    comoda: { name: 'Cómoda', chance: 0.32, table: { mun_9mm: 1.2, mun_cartucho: 1, cuchillo: 1, pistola: 0.3 } },
    armario: { name: 'Armario', chance: 0.45, table: { bate: 3, golf: 2, bate_clavos: 0.6, katana: 0.15, escopeta: 0.122, mun_cartucho: 1.5, pistola: 0.6, mun_9mm: 0.6 } },
    armario_cabana: { name: 'Armario', chance: 0.85, table: { rifle: 0.525, arco: 0.525, mun_rifle: 2, mun_flecha: 2, machete: 1, hacha_mano: 1, cuchillo_caza: 1 } },
    armario_cocina: { name: 'Armario de cocina', chance: 0.4, table: { cuchillo: 4, cuchilla: 1.5, sarten: 2, rodillo: 2 } },
    nevera: { name: 'Nevera', chance: 0, table: {} },
    botiquin: { name: 'Mueble del lavabo', chance: 0.1, table: { destornillador: 1 } },
    mueble_tv: { name: 'Mueble de la tele', chance: 0.25, table: { mun_9mm: 0.6, destornillador: 1, pistola: 0.25 } },
    estanteria: { name: 'Estantería', chance: 0.25, table: { mun_9mm: 0.6, mun_flecha: 0.6, golf: 0.4, mun_rifle: 0.4 } },
    escritorio: { name: 'Escritorio', chance: 0.4, table: { mun_9mm: 1.2, pistola: 0.45, destornillador: 1.5, cuchillo: 0.5 } },
    archivador: { name: 'Archivador', chance: 0.3, table: { porra: 1, mun_9mm: 0.6, destornillador: 0.5 } },
    banco: { name: 'Banco de trabajo', chance: 0.85, table: { martillo: 3, llave: 3, palanca: 2, tubo: 2, destornillador: 2, hacha_mano: 1.5, mazo: 0.5, mun_cartucho: 0.6, silenciador: 0.12 } },
    caja_herr: { name: 'Caja de herramientas', chance: 0.75, table: { martillo: 2, llave: 2, destornillador: 2 } },
    taquilla: { name: 'Taquilla', chance: 0.5, table: { porra: 2, mun_9mm: 1.2, mun_cartucho: 1, cuchillo_caza: 0.5 } },
    taquilla_bomberos: { name: 'Taquilla', chance: 0.55, table: { palanca: 2, hacha_mano: 1, mun_9mm: 0.3, cuchillo_caza: 0.5 } },
    armero: { name: 'Armero', extra: [['pistola', 0.6], ['escopeta', 0.3], ['mun_9mm', 0.5], ['mun_cartucho', 0.6], ['rifle', 0.06], ['mun_rifle', 0.15], ['silenciador', 0.2], ['venda', 0.2]] },
    carrito: { name: 'Carrito', chance: 0.3, table: { cuchillo: 1, destornillador: 1 } },
    mostrador: { name: 'Mostrador', chance: 0.4, table: { pistola: 1.2, mun_9mm: 1.2, cuchillo: 0.6, porra: 0.3 } },
    mostrador_recepcion: { name: 'Mostrador', chance: 0.35, table: { porra: 1, mun_9mm: 0.9, destornillador: 0.5 } },
    estante: { name: 'Estante', chance: 0.12, table: { mun_9mm: 0.6, cuchillo: 1, rodillo: 1 } },
    cajas: { name: 'Cajas', chance: 0.3, table: { mun_cartucho: 1, mun_9mm: 0.6, palanca: 1, tabla: 1 } },
    cofre_camion: { name: 'Cofre del camión', fixed: ['hacha_bombero'], extra: [['palanca', 0.35], ['hacha_bombero', 0.15]] },
    maletero: { name: 'Maletero de la patrulla', chance: 0.65, table: { escopeta: 0.28, mun_cartucho: 2, porra: 1, mun_9mm: 0.6 } },
    ambulancia: { name: 'Ambulancia', chance: 0.25, table: { cuchillo: 1, destornillador: 1 } }
  };

  // Vendas, alcohol y la mochila: tiradas aparte en ciertos muebles [id, probabilidad]
  const SUPPLIES = {
    botiquin: [['venda', 0.12], ['alcohol', 0.5], ['trapo', 0.3]], mesita: [['venda', 0.1]], comoda: [['venda', 0.06]],
    armario: [['mochila', 0.12], ['venda', 0.05]], armario_cabana: [['mochila', 0.15], ['venda', 0.15]],
    armario_cocina: [['alcohol', 0.12], ['trapo', 0.15]], estanteria: [['alcohol', 0.05]], mostrador: [['trapo', 0.08]],
    carrito: [['venda', 0.5]], ambulancia: [['venda', 0.7]],
    taquilla: [['venda', 0.15], ['mochila', 0.12]], taquilla_bomberos: [['venda', 0.25], ['mochila', 0.12]],
    banco: [['mochila', 0.08]], cajas: [['mochila', 0.1], ['venda', 0.06]], estante: [['venda', 0.05], ['mochila', 0.05]],
    maletero: [['venda', 0.3], ['mina', 0.05]], archivador: [['venda', 0.04]],
    // explosivos: escasos (la mina, rarísima)
    escritorio: [['clavos', 0.1]]
  };
  // materiales de explosivos repartidos en otros muebles [id, probabilidad]
  const EXTRA_SUP = {
    botiquin: [['clavos', 0.15]], mesita: [['clavos', 0.06], ['trapo', 0.1]], comoda: [['trapo', 0.12], ['clavos', 0.04]],
    armario: [['trapo', 0.1]], cajas: [['polvo', 0.05], ['mina', 0.02]], banco: [['polvo', 0.06]], estante: [['polvo', 0.03]],
    taquilla: [['polvo', 0.04], ['mina', 0.015]], armario_cocina: [['polvo', 0.02], ['clavos', 0.05]], mostrador: [['clavos', 0.04]]
  };
  for (const k in EXTRA_SUP) SUPPLIES[k] = (SUPPLIES[k] || []).concat(EXTRA_SUP[k]);

  function rollLoot(kind, rng, opts) {
    if (G.LOOT_ON === false) return [];          // botín guardado para después (mundo de pruebas)
    const c = C[kind];
    if (!c) return [];
    const out = [];
    if (c.fixed) out.push(...c.fixed);
    if (c.extra) for (const [id, p] of c.extra) if (rng() < p) out.push(id);
    if (SUPPLIES[kind]) for (const [id, p] of SUPPLIES[kind]) if (rng() < p) out.push(id);
    if (c.table && c.chance && rng() < c.chance) {
      let table = c.table;
      // en las casas de dos pisos es algo más fácil encontrar una pistola
      if (opts && opts.two && table.pistola) table = Object.assign({}, table, { pistola: table.pistola * 1.8 });
      out.push(U.weighted(rng, table));
      if (rng() < 0.18) out.push(U.weighted(rng, table));
    }
    // casas de una planta: menos pistolas y munición
    if (opts && opts.common) return out.filter((id) => !G.Weapons.commonHouseCut(id) || rng() < G.Weapons.COMMON_KEEP);
    return out;
  }

  // ---------- Qué muebles lleva cada habitación ----------
  // [tipo, cuántos, colocación] · colocación: 'wall' contra la pared, 'bed' cabecera contra la pared,
  // 'center' en medio, 'rows' filas de góndolas
  const SETS = {
    dormitorio: [['cama', 1, 'bed'], ['mesita', 2, 'wall'], ['armario', 1, 'wall'], ['comoda', 1, 'wall']],
    sala: [['sofa', 1, 'wall'], ['mueble_tv', 1, 'wall'], ['estanteria', 1, 'wall'], ['sillon', 1, 'wall']],
    comedor: [['mesa', 1, 'center'], ['estanteria', 1, 'wall'], ['comoda', 1, 'wall']],
    cocina: [['nevera', 1, 'wall'], ['fogon', 1, 'wall'], ['fregadero', 1, 'wall'], ['encimera', 3, 'wall']],
    bano: [['inodoro', 1, 'wall'], ['lavabo', 1, 'wall'], ['banera', 1, 'wall']],
    garaje: [['banco', 1, 'wall'], ['caja_herr', 1, 'wall'], ['estante', 1, 'wall']],
    lavadero: [['lavadora', 1, 'wall'], ['estante', 1, 'wall'], ['caja_herr', 1, 'wall']],
    estudio: [['escritorio', 1, 'wall'], ['estanteria', 2, 'wall'], ['sillon', 1, 'wall']],
    recibidor: [['comoda', 1, 'wall']],
    cabana: [['cama1', 1, 'bed'], ['armario', 1, 'wall', 'armario_cabana'], ['mesa', 1, 'center'], ['banco', 1, 'wall'], ['fogon', 1, 'wall']],
    oficina: [['escritorio', 2, 'wall'], ['archivador', 2, 'wall'], ['estanteria', 1, 'wall']],
    archivo: [['archivador', 4, 'wall'], ['estante', 1, 'wall']],
    recepcion: [['mostrador', 1, 'center', 'mostrador_recepcion'], ['banco_espera', 1, 'wall']],
    espera: [['banco_espera', 2, 'wall']],
    habitacion: [['camilla', 2, 'bed'], ['mesita', 1, 'wall'], ['carrito', 1, 'wall']],
    quirofano: [['camilla', 1, 'center'], ['carrito', 2, 'wall']],
    celda: [['cama1', 1, 'bed'], ['inodoro', 1, 'wall']],
    tienda: [['mostrador', 1, 'counter'], ['gondola', 3, 'rows'], ['estante', 2, 'wall'], ['nevera', 2, 'wall']],
    almacen: [['estante', 3, 'wall'], ['cajas', 3, 'wall']],
    nave: [['banco', 2, 'wall'], ['estante', 3, 'wall'], ['taquilla', 2, 'wall'], ['nevera', 1, 'wall'], ['cajas', 3, 'wall'], ['caja_herr', 1, 'wall']]
  };
  // especiales según el edificio
  const SPECIAL = {
    policia: { oficina: [['armero', 1, 'wall'], ['escritorio', 2, 'wall'], ['taquilla', 2, 'wall']] },
    bomberos: { dormitorio: [['cama1', 2, 'bed'], ['taquilla', 3, 'wall', 'taquilla_bomberos']] },
    hospital: { recepcion: [['mostrador', 1, 'center', 'mostrador_recepcion'], ['archivador', 1, 'wall']] }
  };

  // ---------- Colocación ----------
  // c: chunk en generación (se usan sus tablas locales); b: edificio; room: habitación; lv: planta
  // tiles: casillas locales del chunk [x, z] de esa habitación
  function furnishRoom(c, b, room, lv, tiles, rng, CS, E) {
    const set = (SPECIAL[b.kind] && SPECIAL[b.kind][room.type]) || SETS[room.type];
    if (!set || !tiles.length) return;
    const L = lv ? c.up : c;
    const idx = (x, z) => z * CS + x;
    const inRoom = new Set(tiles.map(([x, z]) => idx(x, z)));
    const eN = (x, z) => L.eN[idx(x, z)], eW = (x, z) => L.eW[idx(x, z)];
    const blocked = new Set();              // casillas ocupadas por muebles grandes
    const reserved = new Set();             // delante de puertas y escaleras
    const isOpen = (e) => e === E.DOOR || e === E.DOOR_OPEN || e === E.DOOR_BROKEN || e === E.ARCH || e === E.RAIL || e === 11;
    const isWallLike = (e, tall) => e === E.WALL || (!tall && e === E.WIN);
    // lados de cada casilla: [arista, dirección hacia dentro de la habitación (fx, fz), vecino]
    const sides = (x, z) => [
      { e: eN(x, z), fx: 0, fz: 1, nx: x, nz: z - 1, side: 'N' },
      { e: eN(x, z + 1), fx: 0, fz: -1, nx: x, nz: z + 1, side: 'S' },
      { e: eW(x, z), fx: 1, fz: 0, nx: x - 1, nz: z, side: 'W' },
      { e: eW(x + 1, z), fx: -1, fz: 0, nx: x + 1, nz: z, side: 'E' }
    ];
    for (const [x, z] of tiles) {
      for (const s of sides(x, z)) {
        if (isOpen(s.e) || (c.stairMap && c.stairMap[idx(x, z)])) {
          reserved.add(idx(x, z));
          // y la casilla siguiente hacia dentro
          const ix = x + s.fx, iz = z + s.fz;
          if (inRoom.has(idx(ix, iz))) reserved.add(idx(ix, iz));
        }
      }
    }
    const free = (x, z) => inRoom.has(idx(x, z)) && !blocked.has(idx(x, z)) && !reserved.has(idx(x, z));

    // ¿Siguen conectadas todas las casillas libres de la habitación?
    const connected = (extra) => {
      const open = tiles.filter(([x, z]) => !blocked.has(idx(x, z)) && !extra.has(idx(x, z)));
      if (!open.length) return false;
      const seen = new Set([idx(open[0][0], open[0][1])]);
      const q = [open[0]];
      while (q.length) {
        const [x, z] = q.pop();
        for (const s of sides(x, z)) {
          if (s.e && !isOpen(s.e)) continue;
          const k = idx(s.nx, s.nz);
          if (!inRoom.has(k) || seen.has(k) || blocked.has(k) || extra.has(k)) continue;
          seen.add(k); q.push([s.nx, s.nz]);
        }
      }
      return seen.size === open.length;
    };

    const placed = [];
    const ox = c.cx * CS, oz = c.cz * CS;
    const base = (b.baseY || 0) + (lv ? G.World.FLOOR_H : 0);
    const add = (type, x0, z0, x1, z1, fx, fz, contKind) => {
      const t = T[type];
      const f = {
        type, lv, x0: ox + x0, z0: oz + z0, x1: ox + x1, z1: oz + z1, y: base, h: t.h,
        fx, fz, solid: true, cont: null, seed: Math.floor(rng() * 1e9)
      };
      const ck = contKind || t.cont;
      if (ck && C[ck]) {
        f.cont = { kind: ck, name: C[ck].name, items: rollLoot(ck, rng, { two: b.floors === 2, common: b.kind === 'casa' && b.floors !== 2 }), searched: false };
      }
      placed.push(f);
      c.furn.push(f);
      return f;
    };

    const WT = 0.07;      // medio grosor de pared
    for (const [type, count, mode, contKind] of set) {
      const t = T[type];
      for (let n = 0; n < count; n++) {
        let done = false;
        for (let attempt = 0; attempt < 24 && !done; attempt++) {
          if (mode === 'wall' || mode === 'bed') {
            // una casilla junto a una pared adecuada
            const [x, z] = U.pick(rng, tiles);
            if (!free(x, z)) continue;
            const opts = sides(x, z).filter((s) => isWallLike(s.e, t.tall) && !(s.e === E.WIN && mode === 'bed'));
            if (!opts.length) continue;
            const s = U.pick(rng, opts);
            const ax = s.fz !== 0;                      // la pared corre a lo largo de x
            const along = mode === 'bed' ? t.w : t.w, depth = t.d;
            const nAlong = Math.max(1, Math.ceil(along - 0.02)), nDepth = Math.max(1, Math.ceil(depth - 0.02));
            // casillas que ocupa (a lo largo de la pared y hacia dentro)
            const cells = [];
            let ok = true;
            for (let i = 0; i < nAlong && ok; i++) {
              for (let j = 0; j < nDepth && ok; j++) {
                const cx = ax ? x + i : x + s.fx * j, cz = ax ? z + s.fz * j : z + i;
                if (!free(cx, cz)) { ok = false; break; }
                // la pared tiene que seguir a lo largo de todo el mueble
                if (j === 0 && !isWallLike(sides(cx, cz).find((q) => q.side === s.side).e, t.tall)) ok = false;
                cells.push(idx(cx, cz));
              }
            }
            if (!ok) continue;
            const blocks = t.block || depth > 0.55;
            const ext = new Set(blocks ? cells : []);
            if (blocks && !connected(ext)) continue;
            // rectángulo del mueble: pegado a la pared, centrado en las casillas que ocupa
            let x0, z0, x1, z1;
            if (ax) {
              const xc = x + nAlong / 2;
              x0 = xc - along / 2; x1 = xc + along / 2;
              if (s.fz > 0) { z0 = z + WT; z1 = z0 + depth; } else { z1 = z + 1 - WT; z0 = z1 - depth; }
            } else {
              const zc = z + nAlong / 2;
              z0 = zc - along / 2; z1 = zc + along / 2;
              if (s.fx > 0) { x0 = x + WT; x1 = x0 + depth; } else { x1 = x + 1 - WT; x0 = x1 - depth; }
            }
            if (blocks) for (const k of cells) blocked.add(k);
            else for (const k of cells) reserved.add(k);     // no apilar dos muebles en la misma casilla
            add(type, x0, z0, x1, z1, s.fx, s.fz, contKind);
            done = true;
          } else if (mode === 'center' || mode === 'counter') {
            // en medio de la habitación, dejando paso alrededor
            const xs = tiles.map((q) => q[0]), zs = tiles.map((q) => q[1]);
            const rx0 = Math.min(...xs), rx1 = Math.max(...xs) + 1, rz0 = Math.min(...zs), rz1 = Math.max(...zs) + 1;
            const W = rx1 - rx0, H = rz1 - rz0;
            if (Math.min(W, H) < 3) break;
            const alongX = W >= H;
            const along = t.w, depth = t.d;
            let xc = (rx0 + rx1) / 2 + (rng() - 0.5) * 0.4, zc = (rz0 + rz1) / 2 + (rng() - 0.5) * 0.4;
            if (mode === 'counter') {
              // mostrador cerca de la entrada, a un lado
              const doorSide = sideOfDoor(tiles, sides, isOpen, E);
              if (doorSide) {
                if (doorSide.fz) zc = (doorSide.fz > 0 ? rz0 + 1.6 : rz1 - 1.6);
                else xc = (doorSide.fx > 0 ? rx0 + 1.6 : rx1 - 1.6);
                if (doorSide.fz) xc = rx0 + 2.2; else zc = rz0 + 2.2;
              }
            }
            const hw = (alongX ? along : depth) / 2, hd = (alongX ? depth : along) / 2;
            const x0 = xc - hw, x1 = xc + hw, z0 = zc - hd, z1 = zc + hd;
            const cells = [];
            for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) cells.push(idx(x, z));
            if (cells.some((k) => !inRoom.has(k) || blocked.has(k) || reserved.has(k))) break;
            const ext = new Set(cells);
            if (!connected(ext)) break;
            for (const k of cells) blocked.add(k);
            add(type, x0, z0, x1, z1, alongX ? 0 : 1, alongX ? 1 : 0, contKind);
            done = true;
          } else if (mode === 'rows') {
            // góndolas de la tienda: filas paralelas al lado largo, con pasillos
            const xs = tiles.map((q) => q[0]), zs = tiles.map((q) => q[1]);
            const rx0 = Math.min(...xs), rx1 = Math.max(...xs) + 1, rz0 = Math.min(...zs), rz1 = Math.max(...zs) + 1;
            const W = rx1 - rx0, H = rz1 - rz0;
            const alongX = W >= H;
            const span = alongX ? H : W, len = alongX ? W : H;
            const rows = [];
            for (let r = 1.5; r < span - 2.5; r += 2) rows.push(r);
            if (n >= rows.length) break;
            const r = rows[n];
            const L2 = Math.min(t.w, len - 4.2);
            if (L2 < 1.4) break;
            const c0 = (alongX ? rx0 : rz0) + len / 2;
            let x0, x1, z0, z1;
            if (alongX) { x0 = c0 - L2 / 2; x1 = c0 + L2 / 2; z0 = rz0 + r + 0.15; z1 = z0 + t.d; }
            else { z0 = c0 - L2 / 2; z1 = c0 + L2 / 2; x0 = rx0 + r + 0.15; x1 = x0 + t.d; }
            const cells = [];
            for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) cells.push(idx(x, z));
            if (cells.some((k) => !inRoom.has(k) || blocked.has(k) || reserved.has(k))) break;
            if (!connected(new Set(cells))) break;
            for (const k of cells) blocked.add(k);
            add(type, x0, z0, x1, z1, alongX ? 0 : 1, alongX ? 1 : 0, contKind);
            done = true;
          }
        }
      }
    }
    return placed;
  }

  function sideOfDoor(tiles, sides, isOpen, E) {
    for (const [x, z] of tiles) {
      for (const s of sides(x, z)) if (s.e === E.DOOR && !tiles.some((q) => q[0] === s.nx && q[1] === s.nz)) return s;
    }
    return null;
  }

  // Índices de colisión del chunk (se llaman tras colocar todo)
  function indexChunk(c, CS) {
    c.fidx = [new Map(), new Map()];
    c.fblock = [new Uint8Array(CS * CS), c.up ? new Uint8Array(CS * CS) : null];
    const ox = c.cx * CS, oz = c.cz * CS;
    c.furn.forEach((f, k) => {
      const lv = f.lv || 0;
      const m = c.fidx[lv];
      for (let z = Math.floor(f.z0 - oz); z <= Math.floor(f.z1 - oz - 1e-6); z++) {
        for (let x = Math.floor(f.x0 - ox); x <= Math.floor(f.x1 - ox - 1e-6); x++) {
          if (x < 0 || z < 0 || x >= CS || z >= CS) continue;
          const i = z * CS + x;
          if (!m.has(i)) m.set(i, []);
          m.get(i).push(k);
          // casilla bloqueada para las rutas si el mueble la cubre casi entera
          const cx0 = Math.max(f.x0 - ox, x), cx1 = Math.min(f.x1 - ox, x + 1);
          const cz0 = Math.max(f.z0 - oz, z), cz1 = Math.min(f.z1 - oz, z + 1);
          if (f.solid !== false && (cx1 - cx0) * (cz1 - cz0) > 0.4 && c.fblock[lv]) c.fblock[lv][i] = 1;
        }
      }
    });
  }

  // ---------- Modelos ----------
  // Dibuja un mueble en el mesher. Sistema local: la parte de delante mira a +Z, el ancho va en X.
  function draw(m, f) {
    const t = T[f.type];
    const ry = Math.atan2(f.fx, f.fz);
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const y0 = f.y + 0.04;
    const rnd = U.mulberry32(f.seed || 1);
    // caja en coordenadas locales (lx: a lo ancho, lz: hacia delante)
    const box = (lx, ly, lz, w, h, d, hex) => m.box(cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs, w, h, d, hex, ry);
    const cyl = (lx, ly, lz, r, h, hex, seg) => m.cyl(cx + lx * cs + lz * sn, y0 + ly, cz - lx * sn + lz * cs, r, r, h, hex, seg || 8);
    let W = t.w, D = t.d, H = t.h;
    if (t.flat) { const al = Math.abs(f.fz) > 0.5; W = al ? f.x1 - f.x0 : f.z1 - f.z0; D = al ? f.z1 - f.z0 : f.x1 - f.x0; }
    const wood = U.pick(rnd, [0x8a6440, 0x6f4f33, 0x9c7650, 0x5f4632, 0xb08a60]);
    const dark = U.shade(wood, 0.75);
    const fabric = U.pick(rnd, [0x6d7a5a, 0x7a5a52, 0x55667a, 0x8a7a62, 0x6a5a72, 0x4f5f58]);
    const metal = 0x8d939a, white = 0xe8e6de, steel = 0x6f757b;
    const legs = (w, d, h, r, hex) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - r), h / 2, sz * (d / 2 - r), r * 2, h, r * 2, hex);
    };
    switch (f.type) {
      case 'cama': case 'cama1': case 'camilla': {
        const hosp = f.type === 'camilla';
        const fr = hosp ? steel : wood;
        legs(W, D, 0.25, 0.04, fr);
        box(0, 0.3, 0, W, 0.12, D, fr);
        box(0, 0.44, 0.02, W - 0.06, 0.18, D - 0.08, hosp ? 0xdfe6e8 : 0xe6e0d0);       // colchón
        box(0, 0.54, -D / 2 + 0.28, W - 0.2, 0.1, 0.36, white);                            // almohada
        box(0, 0.52, 0.25, W - 0.02, 0.06, D * 0.62, hosp ? 0x9fc4c8 : fabric);           // manta
        box(0, 0.6, -D / 2 + 0.03, W, hosp ? 0.5 : 0.9, 0.06, fr);                         // cabecero
        break;
      }
      case 'mesita':
        box(0, H / 2, 0, W, H, D, wood);
        box(0, H * 0.62, D / 2 + 0.005, W - 0.08, 0.14, 0.01, dark);
        box(0, H * 0.25, D / 2 + 0.005, W - 0.08, 0.14, 0.01, dark);
        box(0, H * 0.62, D / 2 + 0.015, 0.06, 0.02, 0.02, 0xc9b27a);
        if (rnd() < 0.6) cyl(0.08, H + 0.12, -0.05, 0.05, 0.24, 0xd8c9a0, 8);           // lámpara
        break;
      case 'comoda':
        box(0, H / 2, 0, W, H, D, wood);
        for (let k = 0; k < 3; k++) {
          box(0, 0.15 + k * 0.27, D / 2 + 0.005, W - 0.08, 0.22, 0.01, dark);
          box(0, 0.15 + k * 0.27, D / 2 + 0.015, 0.14, 0.025, 0.02, 0xc9b27a);
        }
        break;
      case 'armario':
        box(0, H / 2, 0, W, H, D, wood);
        box(-W / 4, H / 2 + 0.05, D / 2 + 0.005, W / 2 - 0.04, H - 0.2, 0.01, dark);
        box(W / 4, H / 2 + 0.05, D / 2 + 0.005, W / 2 - 0.04, H - 0.2, 0.01, dark);
        box(-0.04, H / 2, D / 2 + 0.02, 0.02, 0.16, 0.02, 0xc9b27a);
        box(0.04, H / 2, D / 2 + 0.02, 0.02, 0.16, 0.02, 0xc9b27a);
        break;
      case 'sofa': case 'sillon':
        box(0, 0.22, 0, W, 0.24, D, fabric);
        box(0, 0.4, 0.06, W - 0.3, 0.14, D - 0.2, U.shade(fabric, 1.08));
        box(0, 0.58, -D / 2 + 0.12, W, 0.5, 0.22, fabric);
        box(-W / 2 + 0.1, 0.44, 0, 0.2, 0.3, D, U.shade(fabric, 0.92));
        box(W / 2 - 0.1, 0.44, 0, 0.2, 0.3, D, U.shade(fabric, 0.92));
        break;
      case 'mueble_tv':
        box(0, H / 2, 0, W, H, D, wood);
        box(0, H + 0.3, -0.05, 0.9, 0.55, 0.08, 0x1e2124);                                // tele
        box(0, H + 0.3, -0.005, 0.84, 0.49, 0.01, 0x2c3238);
        box(0, H + 0.02, -0.05, 0.25, 0.04, 0.15, 0x1e2124);
        break;
      case 'estanteria': case 'estante': {
        const fr = f.type === 'estante' ? steel : wood;
        box(-W / 2 + 0.02, H / 2, 0, 0.04, H, D, fr);
        box(W / 2 - 0.02, H / 2, 0, 0.04, H, D, fr);
        box(0, H / 2, -D / 2 + 0.01, W, H, 0.02, U.shade(fr, 0.85));
        for (let k = 0; k <= 4; k++) box(0, 0.05 + k * (H - 0.08) / 4, 0, W - 0.04, 0.03, D, fr);
        // cosas en los estantes
        for (let k = 0; k < 4; k++) {
          const n = 2 + Math.floor(rnd() * 4);
          for (let j = 0; j < n; j++) {
            if (rnd() < 0.3) continue;
            const hh = 0.12 + rnd() * 0.2;
            box(-W / 2 + 0.1 + (j + 0.5) * (W - 0.2) / n, 0.08 + k * (H - 0.08) / 4 + hh / 2, 0.02, 0.06 + rnd() * 0.08, hh, D * 0.7,
              U.pick(rnd, [0x8c3b2e, 0x2f4f6a, 0x5d6b3a, 0xc9b27a, 0x7a6a5a, 0xb9b2a6]));
          }
        }
        break;
      }
      case 'encimera': case 'fregadero': case 'fogon': {
        box(0, 0.45, 0, W, 0.86, D, f.type === 'fogon' ? 0xd9d6cc : 0xe2ddd0);
        box(0, 0.89, 0, W + 0.02, 0.05, D + 0.02, 0x6b6e6a);                              // encimera
        box(0, 0.05, D / 2 - 0.02, W, 0.1, 0.04, 0x3d3a36);                                // zócalo
        if (f.type !== 'fogon') {
          box(-W / 4, 0.48, D / 2 + 0.005, W / 2 - 0.04, 0.66, 0.01, U.shade(0xe2ddd0, 0.92));
          box(W / 4, 0.48, D / 2 + 0.005, W / 2 - 0.04, 0.66, 0.01, U.shade(0xe2ddd0, 0.92));
        }
        if (f.type === 'fregadero') { box(0, 0.9, 0.02, 0.5, 0.03, 0.36, metal); box(0, 1.05, -D / 2 + 0.08, 0.03, 0.28, 0.03, metal); }
        if (f.type === 'fogon') {
          for (const sx of [-0.15, 0.15]) for (const sz of [-0.12, 0.12]) cyl(sx, 0.93, sz, 0.08, 0.02, 0x222222, 10);
          box(0, 0.4, D / 2 + 0.005, W - 0.1, 0.45, 0.01, 0x2a2a2a);
        }
        break;
      }
      case 'nevera':
        box(0, H / 2, 0, W, H, D, 0xe9e7e0);
        box(0, H * 0.72, D / 2 + 0.005, W - 0.04, 0.005, 0.01, 0xb8b6ae);
        box(W / 2 - 0.08, H * 0.82, D / 2 + 0.02, 0.03, 0.3, 0.03, metal);
        box(W / 2 - 0.08, H * 0.4, D / 2 + 0.02, 0.03, 0.4, 0.03, metal);
        break;
      case 'mesa':
        box(0, H - 0.03, 0, W, 0.05, D, wood);
        legs(W - 0.1, D - 0.1, H - 0.05, 0.03, dark);
        // sillas
        for (const s of [-1, 1]) {
          for (const k of [-0.35, 0.35]) {
            box(k * W / 1.5, 0.45, s * (D / 2 + 0.25), 0.4, 0.04, 0.4, wood);
            box(k * W / 1.5, 0.7, s * (D / 2 + 0.43), 0.4, 0.5, 0.04, wood);
            box(k * W / 1.5, 0.22, s * (D / 2 + 0.25), 0.36, 0.44, 0.36, dark);
          }
        }
        break;
      case 'inodoro':
        box(0, 0.2, 0.05, 0.36, 0.4, 0.5, white);
        box(0, 0.42, 0.06, 0.38, 0.04, 0.48, 0xf2f0ea);
        box(0, 0.6, -D / 2 + 0.1, 0.4, 0.4, 0.18, white);
        break;
      case 'lavabo':
        box(0, 0.4, 0, W, 0.8, D, 0xddd6c6);
        box(0, 0.84, 0, W, 0.08, D, white);
        box(0, 1.45, -D / 2 + 0.03, 0.5, 0.6, 0.04, 0xbcd0d6);                            // espejo
        box(0, 0.95, -D / 2 + 0.06, 0.03, 0.15, 0.03, metal);
        break;
      case 'banera':
        box(0, H / 2, 0, W, H, D, white);
        box(0, H - 0.04, 0, W - 0.12, 0.02, D - 0.12, 0xcfd9dc);
        break;
      case 'lavadora':
        box(0, H / 2, 0, W, H, D, 0xe9e7e0);
        cyl(0, H * 0.48, D / 2 + 0.005, 0.18, 0.02, 0x5a6066, 14);
        break;
      case 'banco':
        box(0, H - 0.04, 0, W, 0.08, D, 0x8a6440);
        legs(W - 0.1, D - 0.1, H - 0.08, 0.04, 0x6f4f33);
        box(0, 0.25, 0, W - 0.1, 0.03, D - 0.1, 0x6f4f33);
        box(0, H + 0.45, -D / 2 + 0.02, W, 0.9, 0.03, 0x9c8a6a);                          // panel de herramientas
        box(-0.4, H + 0.6, -D / 2 + 0.05, 0.05, 0.3, 0.03, steel);
        box(0.1, H + 0.55, -D / 2 + 0.05, 0.25, 0.04, 0.03, steel);
        box(0.5, H + 0.5, -D / 2 + 0.05, 0.04, 0.35, 0.03, 0xa8322a);
        break;
      case 'mesa_mapa': {
        // mesa de tablones con un mapa desplegado, chinchetas y un farol; detrás, el corcho con notas y hilo rojo
        box(0, H - 0.03, 0, W, 0.06, D, 0x5e4630);
        legs(W - 0.12, D - 0.12, H - 0.06, 0.045, 0x4a3726);
        box(0, H + 0.004, 0.02, W * 0.78, 0.008, D * 0.8, 0xcbbd98);
        for (let k = 0; k < 6; k++) box(-W * 0.36 + k * W * 0.145, H + 0.009, 0.02, 0.006, 0.002, D * 0.78, 0xa89a78);
        for (let k = 0; k < 4; k++) box(0, H + 0.009, -D * 0.34 + k * D * 0.23, W * 0.76, 0.002, 0.006, 0xa89a78);
        box(-0.3, H + 0.01, 0.05, 0.5, 0.004, 0.02, 0x9e2b22); box(0.1, H + 0.01, -0.06, 0.4, 0.004, 0.02, 0x9e2b22);
        box(0.05, H + 0.01, 0.15, 0.03, 0.004, 0.3, 0x3d6f8a);
        for (const [px, pz, col] of [[-0.55, 0.05, 0xc23a2a], [-0.05, 0.05, 0xc23a2a], [0.3, -0.06, 0xd9b23a], [0.55, 0.2, 0x3a7ac2]]) { cyl(px, H + 0.03, pz, 0.012, 0.04, col, 6); }
        // farol
        cyl(W / 2 - 0.22, H + 0.03, -D / 2 + 0.2, 0.07, 0.04, 0x3a3a36, 8);
        cyl(W / 2 - 0.22, H + 0.13, -D / 2 + 0.2, 0.05, 0.16, 0xf2c776, 8);
        cyl(W / 2 - 0.22, H + 0.24, -D / 2 + 0.2, 0.065, 0.04, 0x3a3a36, 8);
        // corcho en la pared, con marco, papeles, fotos y el hilo rojo entre chinchetas
        const by = 1.62, bz = -D / 2 + 0.03;
        box(0, by, bz, W * 0.98, 1.06, 0.035, 0x3a2a1c);
        box(0, by, bz + 0.012, W * 0.92, 0.98, 0.03, 0x9a7650);
        for (const [px, py, w2, h2, col] of [[-0.62, 0.22, 0.32, 0.4, 0xe2d9bc], [-0.15, 0.28, 0.42, 0.3, 0xd2c8a4], [0.42, 0.18, 0.36, 0.44, 0xeae4cf],
          [-0.5, -0.24, 0.3, 0.28, 0x8a9aa4], [0.05, -0.2, 0.46, 0.34, 0xcbbd98], [0.6, -0.25, 0.26, 0.3, 0x9a8a7a]]) box(px, by + py, bz + 0.03, w2, h2, 0.006, col);
        const pins = [[-0.62, 0.38], [-0.15, 0.4], [0.42, 0.36], [-0.5, -0.12], [0.05, -0.05], [0.6, -0.12]];
        for (const [px, py] of pins) box(px, by + py, bz + 0.04, 0.025, 0.025, 0.02, 0xc23a2a);
        for (let k = 0; k < pins.length - 1; k++) {
          const [ax, ay] = pins[k], [bx2, byy] = pins[k + 1];
          const L = Math.hypot(bx2 - ax, byy - ay), ang = Math.atan2(byy - ay, bx2 - ax);
          const mx = (ax + bx2) / 2, my = (ay + byy) / 2;
          m.box(cx + mx * cs + (bz + 0.045) * sn, y0 + by + my, cz - mx * sn + (bz + 0.045) * cs, L, 0.006, 0.004, 0xb3261c, ry, undefined, 0, ang);
        }
        break;
      }
      case 'cofre': {
        // cofre de recompensas: una caja grande de transporte, de plástico duro color arena, con nervios, asas
        // y cierres. Sin tapa: la tapa (que se abre) y lo de dentro van aparte (refugio.js)
        const SH = 0x8f7b55, SD = 0x6f5f42, IN = 0x2f2b24, t = 0.045;
        box(0, 0.03, 0, W, 0.06, D, SD);                                               // fondo
        box(0, 0.065, 0, W - 2 * t, 0.01, D - 2 * t, IN);                              // suelo de dentro
        box(0, H / 2, D / 2 - t / 2, W, H, t, SH); box(0, H / 2, -D / 2 + t / 2, W, H, t, SH);   // frente y fondo
        for (const sx of [-1, 1]) box(sx * (W / 2 - t / 2), H / 2, 0, t, H, D - 2 * t, SH);       // lados
        // por dentro, más oscuro
        box(0, H / 2, D / 2 - t - 0.002, W - 2 * t, H - 0.08, 0.004, IN); box(0, H / 2, -D / 2 + t + 0.002, W - 2 * t, H - 0.08, 0.004, IN);
        for (const sx of [-1, 1]) box(sx * (W / 2 - t - 0.002), H / 2, 0, 0.004, H - 0.08, D - 2 * t, IN);
        // nervios y borde de arriba
        box(0, H - 0.015, D / 2 + 0.004, W + 0.01, 0.03, 0.012, SD); box(0, H - 0.015, -D / 2 - 0.004, W + 0.01, 0.03, 0.012, SD);
        for (const sx of [-1, 1]) box(sx * (W / 2 + 0.004), H - 0.015, 0, 0.012, 0.03, D + 0.01, SD);
        for (const yy of [0.14, 0.3]) box(0, yy, D / 2 + 0.006, W - 0.1, 0.022, 0.01, SD);
        for (const sx of [-0.36, 0.36]) box(sx * W, H / 2, D / 2 + 0.008, 0.05, H - 0.04, 0.012, SD);
        // cierres de la tapa (abajo) y asas a los lados
        for (const sx of [-0.25, 0.25]) box(sx * W, H - 0.07, D / 2 + 0.016, 0.07, 0.06, 0.016, 0x3a3630);
        for (const sx of [-1, 1]) { box(sx * (W / 2 + 0.02), H * 0.62, 0, 0.025, 0.035, 0.2, 0x2a2826); box(sx * (W / 2 + 0.012), H * 0.62, -0.1, 0.02, 0.035, 0.02, 0x2a2826); box(sx * (W / 2 + 0.012), H * 0.62, 0.1, 0.02, 0.035, 0.02, 0x2a2826); }
        box(-0.3 * W, 0.2, D / 2 + 0.013, 0.2, 0.05, 0.004, 0xd8d0b8);                 // etiqueta
        break;
      }
      case 'puesto': {
        // el comercio: un armario de armas abierto de par en par, lleno. Arriba, armas largas de pie en el
        // armero (rifles, escopetas, un arco); en las puertas, pistolas y revólveres colgados; abajo, un estante
        // con cajas de munición, botes y bidones, y dos cajones
        const MW = 0x5a4632, MD = 0x3a2e22, PEG = 0x9a8a6c, GM = 0x2a2b2d, GM2 = 0x50535a, WD = 0xa0703f;
        box(0, H / 2, -D / 2 + 0.015, W, H, 0.03, MD);                                    // fondo
        box(-W / 2 + 0.02, H / 2, 0, 0.04, H, D, MW); box(W / 2 - 0.02, H / 2, 0, 0.04, H, D, MW);   // laterales
        box(0, H - 0.02, 0, W, 0.04, D, MW); box(0, 0.03, 0, W, 0.06, D, MW);              // techo y base
        box(0, 0.62, 0, W - 0.06, 0.035, D - 0.02, MW);                                    // estante
        box(0, 1.35, -D / 2 + 0.04, W - 0.08, 1.3, 0.01, PEG);                             // panel perforado
        for (let k = 0; k < 9; k++) for (let j = 0; j < 6; j++) box(-0.8 + k * 0.2, 0.8 + j * 0.2, -D / 2 + 0.047, 0.012, 0.012, 0.004, 0x3a2e22);
        // pistolas y revólveres colgados del panel, arriba del todo
        for (let k = 0; k < 7; k++) {
          const gx = -0.78 + k * 0.26;
          box(gx, 1.9, -D / 2 + 0.06, 0.16, 0.04, 0.03, k % 2 ? GM2 : GM);
          box(gx - 0.05, 1.85, -D / 2 + 0.06, 0.035, 0.08, 0.03, k % 3 ? 0x3b3431 : WD);
        }
        // soporte del armero: una barra con muescas delante
        box(0, 1.2, D / 2 - 0.1, W - 0.1, 0.03, 0.03, MW);
        // armas largas de pie (culata abajo, sobre el estante, cañón arriba)
        const longs = [[-0.72, 0, 1.68], [-0.42, 1, 1.75], [-0.12, 0, 1.62], [0.18, 2, 1.8], [0.48, 1, 1.7], [0.74, 3, 1.85]];
        for (const [gx, kind, top] of longs) {
          const z0 = -0.02;
          box(gx, 0.79, z0, 0.07, 0.3, 0.045, kind === 2 ? 0x8a5a33 : WD);              // culata
          box(gx, 0.99, z0, 0.055, 0.15, 0.05, GM);                                         // cajón
          if (kind === 3) {                                                                  // arco
            box(gx, 1.2, z0 + 0.02, 0.02, 1.1, 0.02, 0x8a5a33); box(gx + 0.05, 1.2, z0 + 0.02, 0.003, 1.05, 0.003, 0xd8d0b8);
          } else {
            box(gx, (1.05 + top) / 2, z0 - 0.005, kind === 1 ? 0.03 : 0.024, top - 1.05, 0.024, GM2);   // cañón
            if (kind === 1) box(gx, 1.2, z0 + 0.012, 0.03, 0.18, 0.028, WD);               // guardamanos (escopeta)
            if (kind === 0) box(gx, 1.05, z0 - 0.04, 0.03, 0.16, 0.03, 0x1a1a1a);          // mira (rifle)
            if (kind === 2) { box(gx + 0.022, (1.05 + top) / 2, z0 - 0.005, 0.016, top - 1.05, 0.016, GM2); }   // doble cañón
          }
        }
        // abajo: munición, botes, un bidón rojo y dos cajones
        const shelf = [[-0.82, 0x8a6b3a, 0.1, 0.13], [-0.68, 0x9c3528, 0.1, 0.13], [-0.54, 0x4c6a3a, 0.1, 0.1], [-0.4, 0xb58a2a, 0.08, 0.09],
          [-0.18, 0xeceae2, 0.07, 0.17], [-0.08, 0x6b6e70, 0.07, 0.12], [0.06, 0xc4302a, 0.13, 0.17], [0.3, 0x3a3c40, 0.04, 0.16], [0.36, 0x3a3c40, 0.04, 0.16]];
        for (const [gx, col, gw, gh] of shelf) box(gx, 0.64 + gh / 2, -0.05, gw, gh, 0.08, col);
        box(0.62, 0.64 + 0.12, -0.05, 0.16, 0.24, 0.12, 0xa8322a); box(0.62, 0.9, -0.05, 0.08, 0.03, 0.04, 0x6a1c16);
        for (const sx of [-1, 1]) {
          box(sx * W * 0.25, 0.33, D / 2 - 0.02, W / 2 - 0.08, 0.5, 0.02, MW);
          box(sx * W * 0.25, 0.4, D / 2 - 0.005, 0.12, 0.025, 0.02, 0x9a9a92);
        }
        // puertas abiertas hacia fuera (unos 115°) con armas cortas colgadas
        for (const sx of [-1, 1]) {
          const a = 2.0, dl = W / 2 - 0.02;
          const dx = -sx * Math.cos(a), dz = Math.sin(a);              // dirección de la puerta desde la bisagra
          const beta = Math.atan2(-dz, dx);
          const at = (t, y, h, ww, dd, col, off) => {
            const px = sx * W / 2 + dx * dl * t, pz = D / 2 + dz * dl * t + (off || 0);
            m.box(cx + px * cs + pz * sn, y0 + y, cz - px * sn + pz * cs, ww, h, dd, col, ry + beta);
          };
          const px = sx * W / 2 + dx * dl * 0.5, pz = D / 2 + dz * dl * 0.5;
          m.box(cx + px * cs + pz * sn, y0 + 1.03, cz - px * sn + pz * cs, dl, 2.0, 0.03, MW, ry + beta);
          for (let j = 0; j < 3; j++) {
            const t = 0.28 + j * 0.24;
            at(t, 1.5, 0.035, 0.14, 0.045, j === 1 ? GM2 : GM);         // corredera o cañón
            at(t - 0.04, 1.44, 0.08, 0.03, 0.045, j === 1 ? WD : 0x3b3431);   // empuñadura
            at(t, 1.15, 0.12, 0.1, 0.05, 0x8a6b3a);                    // caja de balas en el estante de la puerta
          }
        }
        break;
      }
      case 'banco_mej': {
        // banco de mejoras: tablero grueso, estante abajo, tapete verde con cuadrícula, tornillo de banco, flexo
        // y un panel de herramientas detrás
        box(0, H - 0.04, 0, W, 0.08, D, 0x7a5a3a);
        legs(W - 0.1, D - 0.1, H - 0.08, 0.045, 0x4a4a46);
        box(0, 0.22, 0, W - 0.12, 0.03, D - 0.12, 0x5f4632);
        box(0, 0.32, 0.05, 0.5, 0.18, 0.3, 0xa8322a);
        box(-0.05, H + 0.004, 0.04, 1.1, 0.008, 0.6, 0x2c5a48);
        for (let k = 0; k <= 10; k++) box(-0.6 + k * 0.11, H + 0.009, 0.04, 0.004, 0.002, 0.6, 0x4f8a72);
        for (let k = 0; k <= 5; k++) box(-0.05, H + 0.009, -0.26 + k * 0.12, 1.1, 0.002, 0.004, 0x4f8a72);
        box(W / 2 - 0.2, H + 0.08, 0.15, 0.16, 0.12, 0.2, 0x3d4a5a);
        box(W / 2 - 0.2, H + 0.16, 0.15, 0.22, 0.05, 0.08, 0x3d4a5a);
        // flexo
        cyl(-W / 2 + 0.2, H + 0.02, -D / 2 + 0.15, 0.08, 0.03, 0x2a2a28, 10);
        m.box(cx + (-W / 2 + 0.2) * cs + (-D / 2 + 0.15) * sn, y0 + H + 0.22, cz - (-W / 2 + 0.2) * sn + (-D / 2 + 0.15) * cs, 0.025, 0.42, 0.025, 0x2a2a28, ry, undefined, 0.35, 0);
        box(-W / 2 + 0.2, H + 0.42, -D / 2 + 0.3, 0.16, 0.08, 0.14, 0x3a5a3a);
        // panel de herramientas
        box(0, H + 0.6, -D / 2 + 0.02, W, 1.0, 0.03, 0x9c8a6a);
        for (let k = 0; k < 9; k++) for (let j = 0; j < 4; j++) box(-W / 2 + 0.15 + k * 0.21, H + 0.25 + j * 0.22, -D / 2 + 0.04, 0.012, 0.012, 0.004, 0x5f523e);
        box(-0.7, H + 0.62, -D / 2 + 0.05, 0.05, 0.36, 0.03, steel); box(-0.55, H + 0.6, -D / 2 + 0.05, 0.04, 0.3, 0.03, 0xa8322a);
        box(-0.2, H + 0.7, -D / 2 + 0.05, 0.32, 0.05, 0.03, steel); box(0.15, H + 0.55, -D / 2 + 0.05, 0.04, 0.4, 0.03, 0xc29a2a);
        box(0.45, H + 0.66, -D / 2 + 0.05, 0.22, 0.22, 0.03, 0x6a6e72); box(0.75, H + 0.6, -D / 2 + 0.05, 0.05, 0.34, 0.03, steel);
        break;
      }
      case 'caja_herr':
        box(0, 0.13, 0, W, 0.26, D, 0xa8322a);
        box(0, 0.29, 0, 0.3, 0.04, 0.04, 0x2a2a2a);
        break;
      case 'escritorio':
        box(0, H - 0.03, 0, W, 0.05, D, wood);
        box(W / 2 - 0.22, (H - 0.05) / 2, 0, 0.42, H - 0.05, D - 0.04, dark);
        box(-W / 2 + 0.03, (H - 0.05) / 2, 0, 0.04, H - 0.05, D - 0.04, dark);
        box(W / 2 - 0.22, H * 0.7, D / 2 - 0.01, 0.36, 0.12, 0.01, U.shade(dark, 0.85));
        box(-0.2, H + 0.02, -0.1, 0.4, 0.02, 0.3, 0xe8e2d0);                               // papeles
        box(-0.2, 0.46, 0.55, 0.42, 0.06, 0.42, 0x3a3a3a);                                  // silla
        box(-0.2, 0.75, 0.75, 0.42, 0.5, 0.05, 0x3a3a3a);
        cyl(-0.2, 0.22, 0.55, 0.03, 0.44, steel, 6);
        break;
      case 'archivador':
        box(0, H / 2, 0, W, H, D, 0x7f878c);
        for (let k = 0; k < 4; k++) {
          box(0, 0.18 + k * 0.3, D / 2 + 0.005, W - 0.06, 0.26, 0.01, 0x737b80);
          box(0, 0.24 + k * 0.3, D / 2 + 0.015, 0.12, 0.02, 0.02, 0xc8c8c8);
        }
        break;
      case 'taquilla':
        box(0, H / 2, 0, W, H, D, U.pick(rnd, [0x5d6f7a, 0x6a7a5e, 0x8a4a3a]));
        for (let k = 0; k < 5; k++) box(0, H - 0.2 - k * 0.04, D / 2 + 0.005, W * 0.5, 0.012, 0.01, 0x3a4348);
        box(W / 2 - 0.08, H / 2, D / 2 + 0.015, 0.025, 0.12, 0.02, 0xc8c8c8);
        break;
      case 'armero':
        box(0, H / 2, 0, W, H, D, 0x3f4a3d);
        box(0, H / 2 + 0.05, D / 2 + 0.005, W - 0.1, H - 0.25, 0.01, 0x2f382e);
        box(0, H / 2, D / 2 + 0.02, 0.04, 0.2, 0.03, 0xc8c8c8);
        box(0, H - 0.25, D / 2 + 0.012, W * 0.5, 0.1, 0.005, 0xd8c860);                    // placa
        break;
      case 'carrito':
        legs(W, D, 0.85, 0.02, steel);
        for (const y of [0.25, 0.85]) box(0, y, 0, W, 0.03, D, metal);
        box(0.1, 0.9, 0, 0.15, 0.08, 0.1, 0xe6e6e6);
        break;
      case 'mostrador': {
        box(0, H / 2, 0, W, H, D, 0x8a6a4a);
        box(0, H + 0.02, 0, W + 0.04, 0.04, D + 0.04, 0x5d5a55);
        box(0.5, H + 0.12, 0, 0.36, 0.16, 0.3, 0x2c2c2e);                                  // caja registradora
        box(0.5, H + 0.24, -0.06, 0.3, 0.1, 0.04, 0x1b3a2b);
        break;
      }
      case 'gondola': {
        box(0, 0.06, 0, W, 0.12, D, 0x9a9da0);
        box(0, H / 2, 0, W, H, 0.06, 0xb9bcbf);
        for (let k = 0; k < 4; k++) {
          const y = 0.25 + k * 0.38;
          box(0, y, 0, W, 0.03, D, 0xc8cbce);
          // estantes casi vacíos: alguna lata o caja suelta
          for (let j = 0; j < 6; j++) {
            if (rnd() < 0.7) continue;
            const side = rnd() < 0.5 ? -1 : 1;
            box(-W / 2 + 0.2 + j * (W - 0.4) / 5, y + 0.09, side * D * 0.25, 0.12, 0.16, 0.12, U.pick(rnd, [0xb8452e, 0xd8b84a, 0x3f6f8a, 0x6a8a3a, 0xe0d8c8]));
          }
        }
        break;
      }
      case 'cajas':
        box(-0.12, 0.2, 0, 0.5, 0.4, 0.5, 0xa4865a);
        box(0.2, 0.15, 0.1, 0.4, 0.3, 0.4, 0xb08f62);
        box(0, 0.5, -0.05, 0.42, 0.24, 0.42, 0x9a7c50);
        break;
      case 'banco_espera':
        box(0, 0.42, 0, W, 0.05, D, 0x4f6a8a);
        box(0, 0.7, -D / 2 + 0.04, W, 0.5, 0.04, 0x4f6a8a);
        legs(W - 0.1, D - 0.1, 0.4, 0.025, steel);
        break;
      case 'camion': drawTruck(box, cyl, W, D, rnd); break;
      case 'patrulla': drawCar(box, cyl, W, D, 'policia', rnd); break;
      case 'cont6': case 'cont12': drawContainer(box, W, D, H, f, rnd); break;
      case 'coche': drawCar(box, cyl, W, D, 'civil', rnd, f.col); break;
      case 'camioneta': drawPickup(box, cyl, W, D, rnd, f.col); break;
      case 'montacargas': drawForklift(box, cyl, W, D, rnd); break;
      case 'ibc': {
        // tanque de 1000 L: depósito blanco sucio dentro de una jaula de tubos, sobre un palé
        box(0, 0.07, 0, W, 0.14, D, 0x6e5a40);
        box(0, 0.62, 0, W - 0.1, 0.92, D - 0.1, 0xd9d4c2);
        box(0, 1.1, 0, 0.18, 0.06, 0.18, 0x2a2a2a);
        for (const yy of [0.18, 0.5, 0.82, 1.12]) { box(0, yy, D / 2 - 0.02, W, 0.035, 0.035, 0x8a8e92); box(0, yy, -D / 2 + 0.02, W, 0.035, 0.035, 0x8a8e92); box(W / 2 - 0.02, yy, 0, 0.035, 0.035, D, 0x8a8e92); box(-W / 2 + 0.02, yy, 0, 0.035, 0.035, D, 0x8a8e92); }
        for (let k = 0; k < 5; k++) { const x = -W / 2 + 0.05 + k * (W - 0.1) / 4; box(x, 0.65, D / 2 - 0.02, 0.035, 1.0, 0.035, 0x8a8e92); box(x, 0.65, -D / 2 + 0.02, 0.035, 1.0, 0.035, 0x8a8e92); }
        box(0, 0.25, D / 2 + 0.01, 0.14, 0.14, 0.04, 0x3a3a3a);
        box(0.1, 0.9, D / 2 - 0.03, 0.3, 0.25, 0.006, 0x6a8a3a);
        break;
      }
      case 'palets': {
        // pila de palés de madera gastada
        const n = 4 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          const y = k * 0.13, col = U.shade(0x9a7a54, 0.85 + rnd() * 0.25);
          for (const zz of [-D / 2 + 0.05, 0, D / 2 - 0.05]) box((rnd() - 0.5) * 0.05, y + 0.045, zz, W, 0.09, 0.1, col);
          for (let j = 0; j < 5; j++) box(-W / 2 + 0.1 + j * (W - 0.2) / 4, y + 0.11, 0, 0.14, 0.025, D, U.shade(col, 1.08));
        }
        break;
      }
      case 'lona': {
        // bultos tapados con una lona azul atada con cuerdas
        const col = U.pick(rnd, [0x3f5f86, 0x4a6a8c, 0x5a6a4a]);
        box(0, H / 2 - 0.02, 0, W, H - 0.04, D, col);
        box(0, H - 0.01, 0, W - 0.12, 0.04, D - 0.12, U.shade(col, 1.1));
        box(0.2, H * 0.55, D / 2 + 0.01, W * 0.5, H * 0.6, 0.02, U.shade(col, 0.9));
        box(-W / 2 - 0.01, 0.3, 0, 0.02, 0.6, D * 0.8, U.shade(col, 0.88));
        for (const xx of [-W * 0.3, W * 0.3]) { box(xx, H / 2, D / 2 + 0.02, 0.03, H, 0.02, 0xc9b98a); box(xx, H / 2, -D / 2 - 0.02, 0.03, H, 0.02, 0xc9b98a); box(xx, H + 0.01, 0, 0.03, 0.02, D, 0xc9b98a); }
        box(0, 0.05, 0, W + 0.1, 0.1, D + 0.06, 0x6e5a40);
        break;
      }
      case 'barrera': {
        // barrera de hormigón (tipo New Jersey), manchada
        box(0, 0.12, 0, W, 0.24, D, 0x9a978e);
        box(0, 0.42, 0, W, 0.36, D * 0.62, 0xa19e95);
        box(0, 0.72, 0, W, 0.2, D * 0.36, 0xa6a39a);
        box(rnd() - 0.5, 0.3, D / 2 + 0.002, 0.6, 0.3, 0.004, 0x7c796f);
        box(-W / 2 + 0.25, 0.75, 0, 0.12, 0.06, D * 0.38, 0x6a6862);
        break;
      }
      case 'bidones': {
        const cols = [0x3a5a8a, 0x8a3a2a, 0x4a6a3a, 0x6a6a6a];
        for (const [x, z] of [[-0.32, 0], [0.32, 0.05]]) {
          const col = U.pick(rnd, cols);
          cyl(x, 0.44, z, 0.29, 0.88, col, 12);
          cyl(x, 0.3, z, 0.3, 0.04, U.shade(col, 0.8), 12); cyl(x, 0.62, z, 0.3, 0.04, U.shade(col, 0.8), 12);
          cyl(x + 0.1, 0.885, z, 0.04, 0.02, 0x2a2a2a, 8);
        }
        break;
      }
      case 'tubo': {
        // tubo de hormigón tumbado (se ve el hueco por dentro)
        const R = H / 2;
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
          box(0, R + co * (R - 0.06), s * (R - 0.06), W, 0.12, R * 0.55, 0x9c998f);
        }
        box(W / 2 - 0.08, R, 0, 0.16, H - 0.2, 0.08, 0x8a877e);
        break;
      }
      case 'bloques': {
        // bloques de hormigón apilados sobre un palé
        box(0, 0.06, 0, W, 0.12, D, 0x7a6248);
        for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
          if (k === 2 && rnd() < 0.35) continue;
          box(-W / 2 + 0.2 + i * 0.4, 0.22 + k * 0.24, -D / 4 + j * D / 2, 0.38, 0.22, D / 2 - 0.04, U.shade(0x8f8c84, 0.9 + rnd() * 0.2));
        }
        break;
      }
      case 'persiana': {
        // persiana metálica enrollable bajada, con su cajón arriba y las guías
        box(0, H / 2 - 0.2, 0, W, H - 0.4, 0.04, 0x6f7375);
        for (let y = 0.15; y < H - 0.5; y += 0.12) box(0, y, 0.025, W - 0.05, 0.03, 0.01, 0x5d6163);
        box(0, H - 0.2, 0, W + 0.1, 0.4, 0.16, 0x55595b);
        for (const s2 of [-1, 1]) box(s2 * (W / 2 + 0.03), H / 2 - 0.2, 0, 0.06, H - 0.4, 0.1, 0x45494b);
        box(-W * 0.3, 0.9, 0.03, 0.5, 0.35, 0.006, 0x8a4a2a);
        break;
      }
      case 'galpon': {
        // galpón industrial de fuera del mapa: bloques de hormigón, persianas, ventanas altas y techo plano
        const wall = U.pick(rnd, [0x7d8384, 0x8a8478, 0x6f777a]);
        box(0, H / 2, 0, W, H, D, wall);
        box(0, H + 0.2, 0, W + 0.2, 0.4, D + 0.2, U.shade(wall, 0.8));
        for (let k = 0; k < 3; k++) {
          const x = -W / 2 + 2.5 + k * 4.5;
          box(x, 1.7, D / 2 + 0.02, 3.2, 3.4, 0.04, 0x5d6163);
          for (let y = 0.2; y < 3.3; y += 0.18) box(x, y, D / 2 + 0.045, 3.1, 0.04, 0.01, 0x4f5355);
          box(x, 3.55, D / 2 + 0.06, 3.4, 0.3, 0.12, 0x45494b);
        }
        for (let k = 0; k < 6; k++) box(-W / 2 + 1.3 + k * 2.3, H - 1.5, D / 2 + 0.02, 1.4, 1.0, 0.04, 0x2a3236);
        box(0, H * 0.62, D / 2 + 0.03, W, 0.1, 0.03, U.shade(wall, 0.7));
        for (let k = 0; k < 6; k++) box((rnd() - 0.5) * (W - 2), 1 + rnd() * (H - 3), D / 2 + 0.03, 0.4 + rnd(), 0.4 + rnd() * 1.5, 0.006, U.shade(wall, 0.75));
        break;
      }
      case 'charco': {
        // charco: agua quieta que refleja el cielo (gris azulado), con bordes irregulares
        const col = 0x3d4850;
        box(0, 0.004, 0, W * 0.8, 0.008, D * 0.7, col);
        box(W * 0.12, 0.005, D * 0.18, W * 0.5, 0.008, D * 0.5, U.shade(col, 1.1));
        box(-W * 0.2, 0.004, -D * 0.15, W * 0.45, 0.008, D * 0.55, U.shade(col, 0.95));
        box(W * 0.28, 0.004, -D * 0.22, W * 0.3, 0.008, D * 0.4, col);
        break;
      }
      case 'ambulancia': drawVan(box, cyl, W, D, rnd); break;
      default:
        box(0, H / 2, 0, W, H, D, wood);
    }
  }

  // Camión de bomberos abandonado: rojo apagado y oxidado, ruedas pinchadas, cristales rotos
  function drawTruck(box, cyl, W, D, rnd) {
    const red = 0x8e2a22, rust = 0x7a4a2c, chrome = 0x9a9a92, dark = 0x2a2a2a;
    const L = D;
    // chasis y cabina (delante = +Z)
    box(0, 0.75, 0, W - 0.1, 0.35, L - 0.4, dark);
    box(0, 1.55, L / 2 - 1.2, W, 1.6, 2.0, red);                                  // cabina
    box(0, 1.95, L / 2 - 0.22, W - 0.3, 0.7, 0.04, 0x2a3236);                     // parabrisas (roto)
    box(0.5, 2.0, L / 2 - 0.2, 0.5, 0.3, 0.03, 0x50606a);
    box(0, 0.95, L / 2 - 0.12, W - 0.1, 0.4, 0.1, chrome);                        // parachoques
    box(-W / 2 + 0.3, 1.2, L / 2 - 0.1, 0.22, 0.14, 0.04, 0xd8d0b0);
    box(W / 2 - 0.3, 1.2, L / 2 - 0.1, 0.22, 0.14, 0.04, 0xd8d0b0);
    box(0, 2.42, L / 2 - 1.3, 1.2, 0.14, 0.3, 0xa03030);                          // luces de emergencia
    // caja con compartimentos (el cofre es el de la derecha)
    box(0, 1.6, -0.9, W, 1.8, L - 2.6, red);
    for (let k = 0; k < 3; k++) {
      const z = -L / 2 + 1.3 + k * 1.45;
      box(W / 2 + 0.005, 1.45, z, 0.01, 1.2, 1.2, U.shade(red, 0.85));
      box(-W / 2 - 0.005, 1.45, z, 0.01, 1.2, 1.2, U.shade(red, 0.85));
      box(W / 2 + 0.015, 1.1, z, 0.02, 0.05, 1.0, chrome);
    }
    box(W / 2 + 0.02, 1.45, -L / 2 + 1.3, 0.03, 1.1, 1.1, 0xb8b030);              // cofre marcado
    box(0, 2.6, -0.9, W - 0.2, 0.1, L - 2.8, chrome);                             // escalera del techo
    for (let k = 0; k < 7; k++) box(0, 2.62, -L / 2 + 1.0 + k * 0.7, W - 0.3, 0.04, 0.05, chrome);
    // óxido y suciedad
    for (let k = 0; k < 10; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      box(side * (W / 2 + 0.008), 0.9 + rnd() * 1.6, -L / 2 + rnd() * L, 0.01, 0.15 + rnd() * 0.35, 0.2 + rnd() * 0.6, rust);
    }
    // ruedas (algunas pinchadas: más bajas y anchas)
    for (const z of [L / 2 - 1.3, -L / 2 + 1.4, -L / 2 + 2.6]) {
      for (const sx of [-1, 1]) {
        const flat = rnd() < 0.5;
        const r = flat ? 0.42 : 0.5;
        m2cyl(cyl, box, sx * (W / 2 - 0.15), r, z, r, 0.4, flat);
      }
    }
  }
  function m2cyl(cyl, box, x, y, z, r, w, flat) {
    // rueda: un cilindro tumbado (se aproxima con cajas cruzadas para no complicar)
    box(x, y, z, w, r * 2 * (flat ? 0.85 : 1), r * 1.6, 0x1c1c1c);
    box(x, y, z, w, r * 1.6 * (flat ? 0.85 : 1), r * 2, 0x1c1c1c);
    box(x + Math.sign(x) * 0.02, y, z, w * 0.6, r * 0.9, r * 0.9, 0x6a6a64);
  }
  function drawCar(box, cyl, W, D, kind, rnd, col) {
    const L = D;
    const body = kind === 'policia' ? 0xe8e6de : (col || U.pick(rnd, [0x8a8f86, 0x6e7a84, 0xa8a49a, 0x7a5a48, 0x5e6a5a, 0xb4b0a4]));
    box(0, 0.62, 0, W, 0.55, L, body);
    box(0, 0.62, L / 2 - 0.55, W + 0.01, 0.56, 1.0, kind === 'policia' ? 0x1e2a44 : body);
    box(0, 0.62, -L / 2 + 0.55, W + 0.01, 0.56, 1.0, kind === 'policia' ? 0x1e2a44 : body);
    box(0, 1.12, -0.15, W - 0.2, 0.45, 2.0, U.shade(body, 0.95));                 // habitáculo
    box(0, 1.15, 0.86, W - 0.25, 0.38, 0.04, 0x2c3a44);
    box(0, 1.15, -1.16, W - 0.25, 0.38, 0.04, 0x2c3a44);
    box(W / 2 - 0.09, 1.15, -0.15, 0.02, 0.36, 1.8, 0x2c3a44);
    box(-W / 2 + 0.09, 1.15, -0.15, 0.02, 0.36, 1.8, 0x2c3a44);
    if (kind === 'policia') {
      box(0, 1.4, -0.1, 1.1, 0.1, 0.25, 0x2a2a2a);
      box(-0.3, 1.47, -0.1, 0.45, 0.08, 0.2, 0xb02a2a);
      box(0.3, 1.47, -0.1, 0.45, 0.08, 0.2, 0x2a4ab0);
      box(W / 2 + 0.006, 0.66, 0, 0.01, 0.12, L * 0.5, 0x2a4a8a);
      box(-W / 2 - 0.006, 0.66, 0, 0.01, 0.12, L * 0.5, 0x2a4a8a);
    }
    for (const z of [L / 2 - 0.85, -L / 2 + 0.85]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.1), 0.33, z, 0.33, 0.24, rnd() < 0.4);
    if (kind !== 'policia') dirty(box, W, L, 1.1, rnd);
  }
  // suciedad, polvo y musgo de años: manchas sobre la carrocería y hierba que crece por debajo
  function dirty(box, W, L, top, rnd) {
    for (let k = 0; k < 8; k++) {
      const side = rnd() < 0.5 ? -1 : 1;
      box(side * (W / 2 + 0.008), 0.45 + rnd() * 0.4, -L / 2 + rnd() * L, 0.01, 0.12 + rnd() * 0.25, 0.3 + rnd() * 0.7, U.pick(rnd, [0x6a5a44, 0x5a6a44, 0x7a6a50]));
    }
    for (let k = 0; k < 4; k++) box((rnd() - 0.5) * W * 0.7, top + 0.012, (rnd() - 0.5) * L * 0.5, 0.3 + rnd() * 0.5, 0.012, 0.3 + rnd() * 0.6, U.pick(rnd, [0x7a7058, 0x5f6a48]));
  }
  // camioneta (pick-up) abandonada: cabina, caja descubierta, polvo y ruedas pinchadas
  function drawPickup(box, cyl, W, D, rnd, col) {
    const L = D, body = col || U.pick(rnd, [0x8f8a7a, 0x6a7a6c, 0x9a9488, 0x5a6670, 0x7a6a58]);
    const glass = 0x2c3a44, dark = 0x2a2a2a;
    box(0, 0.62, 0, W, 0.5, L, body);                                              // chasis y laterales bajos
    box(0, 0.95, L / 2 - 0.75, W, 0.4, 1.45, body);                                // capó
    box(0, 1.35, 0.35, W - 0.1, 0.75, 1.6, U.shade(body, 0.96));                   // cabina
    box(0, 1.4, 1.16, W - 0.25, 0.5, 0.04, glass);
    box(W / 2 - 0.04, 1.42, 0.35, 0.02, 0.42, 1.3, glass); box(-W / 2 + 0.04, 1.42, 0.35, 0.02, 0.42, 1.3, glass);
    box(0, 1.42, -0.46, W - 0.25, 0.4, 0.04, glass);
    // caja de carga
    box(0, 1.05, -L / 2 + 1.05, W, 0.45, 0.06, body); box(W / 2 - 0.03, 1.05, -L / 2 + 1.05 + 0.0, 0.06, 0.45, 2.1, body); box(-W / 2 + 0.03, 1.05, -L / 2 + 1.05, 0.06, 0.45, 2.1, body);
    box(0, 0.9, -L / 2 + 0.03, W, 0.55, 0.06, U.shade(body, 0.9));
    box(0, 0.86, -L / 2 + 1.05, W - 0.12, 0.04, 2.0, 0x3a3a38);
    if (rnd() < 0.6) box(0.2, 0.98, -L / 2 + 1.2, 0.6, 0.2, 0.5, U.pick(rnd, [0x8a6440, 0x3f5f86, 0x6a6a6a]));
    box(0, 0.55, L / 2 + 0.02, W + 0.04, 0.2, 0.08, 0x9a9a92);                   // parachoques
    box(0, 0.5, -L / 2 - 0.02, W + 0.04, 0.16, 0.06, 0x9a9a92);
    for (const sx of [-1, 1]) box(sx * (W / 2 - 0.25), 0.9, L / 2 + 0.01, 0.3, 0.14, 0.03, 0xcfc8a8);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.1), 0.36, z, 0.36, 0.26, rnd() < 0.5);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) box(sx * (W / 2 + 0.01), 0.72, z, 0.04, 0.12, 0.95, dark);
    dirty(box, W, L, 1.72, rnd);
  }
  // montacargas: amarillo descolorido, mástil con las horquillas, jaula del conductor y contrapeso
  function drawForklift(box, cyl, W, D, rnd) {
    const yel = 0xc9a032, dark = 0x2a2a2a, L = D;
    box(0, 0.55, -0.2, W, 0.6, L - 1.0, yel);                                       // cuerpo
    box(0, 0.75, -L / 2 + 0.35, W, 0.9, 0.5, U.shade(yel, 0.85));                  // contrapeso
    box(0, 1.0, -0.15, 0.5, 0.15, 0.5, 0x3a3a3a);                                   // asiento
    box(0, 1.25, -0.4, 0.5, 0.45, 0.08, 0x3a3a3a);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (W / 2 - 0.06), 1.45, -0.15 + sz * 0.55, 0.06, 1.4, 0.06, dark);   // jaula
    box(0, 2.16, -0.15, W, 0.06, 1.2, dark);
    for (const sx of [-1, 1]) box(sx * 0.3, 1.15, L / 2 - 0.55, 0.1, 2.2, 0.12, dark);   // mástil
    box(0, 2.2, L / 2 - 0.55, 0.7, 0.08, 0.12, dark);
    box(0, 0.45, L / 2 - 0.45, 0.8, 0.5, 0.06, 0x3a3a38);
    for (const sx of [-1, 1]) box(sx * 0.25, 0.08, L / 2 - 0.05, 0.12, 0.05, 0.9, 0x4a4a48);   // horquillas
    for (const z of [L / 2 - 0.9, -L / 2 + 0.55]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.05), 0.3, z, 0.3, 0.22, false);
    for (let k = 0; k < 5; k++) box((rnd() < 0.5 ? -1 : 1) * (W / 2 + 0.006), 0.4 + rnd() * 0.4, -L / 2 + rnd() * L * 0.7, 0.01, 0.12 + rnd() * 0.2, 0.2 + rnd() * 0.3, 0x7a4a2c);
  }
  // Contenedor de carga (6 o 12 m): chapa ondulada con nervios, marco oscuro, puertas con barras de cierre en un
  // extremo, óxido y un rótulo de la naviera (inventado: rayas claras desvaídas). f.open: abierto (se puede entrar)
  const CONT_COLS = [0x6f8a6a, 0x4f6f86, 0x8f3c30, 0xb0653a, 0xb8ab84, 0x5f6e5c, 0x8d8a80, 0x3f5f6a, 0x9a5a3a];
  function drawContainer(box, W, D, H, f, rnd) {
    const col = f.col != null ? f.col : U.pick(rnd, CONT_COLS);
    const dark = U.shade(col, 0.62), rib = U.shade(col, 0.86), rust = 0x6e4428, inside = 0x4a443c;
    if (f.lod) {
      // los de fuera de la valla (se ven de lejos): menos piezas
      box(0, H / 2, 0, W - 0.06, H - 0.06, D - 0.06, col);
      for (let x = -W / 2 + 0.6; x < W / 2 - 0.4; x += 1.2) { box(x, H / 2, D / 2, 0.5, H - 0.3, 0.04, rib); box(x, H / 2, -D / 2, 0.5, H - 0.3, 0.04, rib); }
      for (const s of [-1, 1]) { box(0, H - 0.07, s * (D / 2 - 0.03), W, 0.14, 0.08, dark); box(0, 0.08, s * (D / 2 - 0.03), W, 0.16, 0.08, dark); box(s * (W / 2 - 0.03), H / 2, 0, 0.1, H, D + 0.02, dark); }
      if (rnd() < 0.6) box((rnd() - 0.5) * (W - 2), H * 0.6, (rnd() < 0.5 ? -1 : 1) * (D / 2 + 0.03), 1.5 + rnd(), 0.6 + rnd(), 0.005, rust);
      return;
    }
    const T2 = 0.05;
    if (f.open) {
      box(0, 0.02, 0, W - 0.1, 0.04, D - 0.1, 0x5a5046);                                     // suelo de madera
      box(0, H / 2, D / 2 - T2, W - 0.1, H - 0.1, T2, col); box(0, H / 2, -D / 2 + T2, W - 0.1, H - 0.1, T2, col);
      box(0, H / 2, D / 2 - T2 - 0.03, W - 0.2, H - 0.2, 0.01, inside); box(0, H / 2, -D / 2 + T2 + 0.03, W - 0.2, H - 0.2, 0.01, inside);
      box(-W / 2 + T2, H / 2, 0, T2, H - 0.1, D - 0.1, col);                                  // fondo
      box(-W / 2 + T2 + 0.03, H / 2, 0, 0.01, H - 0.2, D - 0.2, inside);
      box(0, H - T2, 0, W - 0.1, T2, D - 0.1, col);                                          // techo
      box(0, H - T2 - 0.03, 0, W - 0.2, 0.01, D - 0.2, inside);
      // puertas abiertas de par en par, plegadas contra los costados
      for (const s of [-1, 1]) {
        box(W / 2 - D / 4 + 0.05, H / 2, s * (D / 2 + 0.07), D / 2 - 0.08, H - 0.25, 0.04, U.shade(col, 0.92));
        for (const k of [0.25, 0.75]) box(W / 2 - (D / 2 - 0.08) * k, H / 2, s * (D / 2 + 0.1), 0.035, H - 0.35, 0.035, 0x55575a);
      }
    } else {
      box(0, H / 2, 0, W - 0.1, H - 0.1, D - 0.1, col);
      // puertas en el extremo +X: dos hojas con cuatro barras de cierre
      for (const s of [-1, 1]) box(W / 2 - 0.03, H / 2, s * D / 4, 0.03, H - 0.25, D / 2 - 0.06, U.shade(col, 0.93));
      for (const z of [-0.36, -0.12, 0.12, 0.36]) {
        box(W / 2 + 0.02, H / 2, z * D, 0.035, H - 0.3, 0.035, 0x55575a);
        box(W / 2 + 0.03, H * 0.42, z * D + 0.04, 0.03, 0.05, 0.1, 0x55575a);
      }
      box(W / 2 + 0.005, H / 2, 0, 0.02, H - 0.25, 0.04, dark);
    }
    // nervios de la chapa en los costados largos (y en el fondo)
    const step = 0.5;
    for (let x = -W / 2 + 0.32; x < W / 2 - 0.25; x += step) {
      box(x, H / 2, D / 2 - 0.02, 0.18, H - 0.3, 0.05, rib);
      box(x, H / 2, -D / 2 + 0.02, 0.18, H - 0.3, 0.05, rib);
    }
    for (let z = -D / 2 + 0.3; z < D / 2 - 0.25; z += step) box(-W / 2 + 0.02, H / 2, z, 0.05, H - 0.3, 0.13, rib);
    // techo ondulado (más oscuro, con charcos de óxido)
    box(0, H - 0.03, 0, W - 0.14, 0.03, D - 0.14, U.shade(col, 0.8));
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.3; x += 0.9) box(x, H - 0.01, 0, 0.3, 0.02, D - 0.2, U.shade(col, 0.74));
    for (let k = 0; k < Math.round(W / 3); k++) box((rnd() - 0.5) * (W - 1), H + 0.003, (rnd() - 0.5) * (D - 0.6), 0.4 + rnd() * 0.9, 0.006, 0.3 + rnd() * 0.6, rust);
    // marco: largueros arriba y abajo, postes de las esquinas y cantoneras
    for (const s of [-1, 1]) {
      box(0, H - 0.07, s * (D / 2 - 0.03), W, 0.14, 0.07, dark);
      box(0, 0.08, s * (D / 2 - 0.03), W, 0.16, 0.07, dark);
      box(s * (W / 2 - 0.03), H - 0.07, 0, 0.07, 0.14, D, dark);
      box(s * (W / 2 - 0.03), 0.08, 0, 0.07, 0.16, D, dark);
      for (const t of [-1, 1]) {
        box(s * (W / 2 - 0.05), H / 2, t * (D / 2 - 0.05), 0.1, H, 0.1, dark);
        box(s * (W / 2 - 0.05), H - 0.06, t * (D / 2 - 0.05), 0.16, 0.12, 0.16, 0x5a5a56);
        box(s * (W / 2 - 0.05), 0.06, t * (D / 2 - 0.05), 0.16, 0.12, 0.16, 0x5a5a56);
      }
    }
    // óxido y churretones en los costados
    for (let k = 0; k < 3 + Math.round(W / 2.5); k++) {
      const s = rnd() < 0.5 ? -1 : 1, w = 0.3 + rnd() * 1.2, h = 0.2 + rnd() * 1.2;
      box((rnd() - 0.5) * (W - 1), H - 0.15 - h / 2 - rnd() * 0.6, s * (D / 2 + 0.008), w, h, 0.005, rnd() < 0.7 ? rust : U.shade(col, 0.7));
    }
    // rótulo de la naviera (inventado): un emblema redondo y letras desvaídas
    if (rnd() < 0.75) {
      const s = rnd() < 0.5 ? -1 : 1, ex = (rnd() - 0.5) * (W - 4), lt = 0xd8d4c6;
      const ey = H * 0.62;
      box(ex - 1.1, ey + 0.05, s * (D / 2 + 0.01), 0.45, 0.45, 0.004, lt);
      box(ex - 1.1, ey + 0.05, s * (D / 2 + 0.012), 0.25, 0.25, 0.004, col);
      for (let k = 0; k < 6; k++) box(ex - 0.6 + k * 0.28, ey + 0.05, s * (D / 2 + 0.01), 0.07 + (k % 2) * 0.08, 0.42, 0.004, lt);
      box(ex + 0.15, ey - 0.3, s * (D / 2 + 0.01), 1.4, 0.06, 0.004, lt);
    }
    // número de serie junto a las puertas
    box(W / 2 - 0.5, H - 0.4, D / 2 + 0.01, 0.5, 0.08, 0.004, 0xd8d4c6);
  }
  function drawVan(box, cyl, W, D, rnd) {
    const L = D, wh = 0xe9e7e0;
    box(0, 1.35, -0.4, W, 1.9, L - 1.6, wh);
    box(0, 1.0, L / 2 - 1.0, W, 1.1, 1.8, wh);
    box(0, 1.65, L / 2 - 0.6, W - 0.2, 0.5, 0.04, 0x2c3a44);
    box(W / 2 + 0.006, 1.2, -0.4, 0.01, 0.25, L - 1.8, 0xc23b2b);
    box(-W / 2 - 0.006, 1.2, -0.4, 0.01, 0.25, L - 1.8, 0xc23b2b);
    // cruz
    for (const sx of [1, -1]) {
      box(sx * (W / 2 + 0.008), 1.75, -0.6, 0.01, 0.5, 0.16, 0xc23b2b);
      box(sx * (W / 2 + 0.008), 1.75, -0.6, 0.01, 0.16, 0.5, 0xc23b2b);
    }
    box(0, 2.35, L / 2 - 1.6, 1.0, 0.12, 0.25, 0xb02a2a);
    box(0, 0.45, L / 2 - 0.05, W, 0.25, 0.1, 0x9a9a92);
    for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const sx of [-1, 1]) m2cyl(cyl, box, sx * (W / 2 - 0.12), 0.38, z, 0.38, 0.28, rnd() < 0.5);
  }

  // Coloca un vehículo (centro, dirección del frente) en la lista del chunk
  function addVehicle(c, type, xc, zc, fx, fz, rng, lv, y) {
    const t = T[type];
    const along = Math.abs(fz) > 0.5;      // el largo va en z
    const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
    const f = {
      type, lv: lv || 0, x0: xc - hw, x1: xc + hw, z0: zc - hd, z1: zc + hd, y: y || 0, h: t.h,
      fx, fz, solid: true, seed: Math.floor(rng() * 1e9), vehicle: true,
      cont: { kind: t.cont, name: C[t.cont].name, items: rollLoot(t.cont, rng), searched: false }
    };
    c.furn.push(f);
    return f;
  }

  // Punto desde el que se registra: delante del mueble (o, en vehículos, junto al cofre)
  function frontPoint(f) {
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    const t = T[f.type];
    if (f.type === 'camion') {
      // cofre en el lateral derecho (visto desde detrás), cerca de la parte trasera
      const rx = f.fz, rz = -f.fx;   // derecha del vehículo
      return { x: cx - rx * (t.w / 2 + 0.5) - f.fx * (t.d / 2 - 1.3), z: cz - rz * (t.w / 2 + 0.5) - f.fz * (t.d / 2 - 1.3) };
    }
    if (t.vehicle) return { x: cx - f.fx * (t.d / 2 + 0.5), z: cz - f.fz * (t.d / 2 + 0.5) };   // por detrás (maletero)
    const half = Math.abs(f.fx) > 0.5 ? (f.x1 - f.x0) / 2 : (f.z1 - f.z0) / 2;
    return { x: cx + f.fx * (half + 0.45), z: cz + f.fz * (half + 0.45) };
  }

  G.Furniture = { T, C, furnishRoom, indexChunk, draw, addVehicle, rollLoot, frontPoint };
})(window.Game = window.Game || {});
