(function (G) {
  'use strict';

  // Mapas de los enfrentamientos (inspirados en los de los vídeos de referencia, con diseño propio).
  // Cada mapa se describe una vez con primitivas en coordenadas del mundo (suelo, muros, edificios,
  // contenedores, muebles, vehículos, árboles, hierba alta, charcos) y World los aplica chunk a chunk.
  // Los mapas no dependen del modo: cualquier enfrentamiento (asalto o caza) puede tocar en cualquiera.
  //
  // Contenedores de carga: ocupan casillas enteras (2 de ancho, 6 o 12 de largo). Sus costados son aristas
  // CONT (tapan la vista y el paso como una pared) y su techo es transitable (deck): se puede trepar a uno
  // de una altura y, desde arriba, a los de encima. Los abiertos se pueden recorrer por dentro.

  const U = G.Util;
  const MAPS = {};
  const LEVEL_H = 2.6;           // alto de un contenedor

  // ---------- Constructor de primitivas ----------
  function maker() {
    const P = { ground: [], edges: [], blds: [], furn: [], conts: [], obj: [], tall: [], occ: new Map() };
    const key = (x, z) => x + ',' + z;
    const occ = (x0, z0, x1, z1, v) => { for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) P.occ.set(key(x, z), v || 1); };
    const free = (x0, z0, x1, z1) => { for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) if (P.occ.has(key(x, z))) return false; return true; };
    const api = {
      P, occ, free,
      ground(x0, z0, x1, z1, g) { P.ground.push([x0, z0, x1, z1, g]); },
      // muro a lo largo de x en la línea z (casillas x0..x1-1) o a lo largo de z en la línea x
      wallN(x0, x1, z, e) { for (let x = x0; x < x1; x++) P.edges.push(['N', x, z, e]); },
      wallW(z0, z1, x, e) { for (let z = z0; z < z1; z++) P.edges.push(['W', x, z, e]); },
      edge(o, x, z, e) { P.edges.push([o, x, z, e]); },
      building(id, ox, oz, w, h, front, post) { P.blds.push({ id, ox, oz, front, post }); occ(ox - 1, oz - 1, ox + w + 1, oz + h + 1, 'b'); },
      // mueble centrado en (x, z), con el frente hacia (fx, fz); ex: más campos (col, open...)
      put(type, x, z, fx, fz, ex) {
        const t = G.Furniture.T[type], along = Math.abs(fz) > 0.5;
        const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
        const f = Object.assign({ type, lv: 0, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y: 0, h: t.h, fx, fz, solid: !t.deco, cont: null }, ex || {});
        P.furn.push(f);
        if (!t.flat) occ(Math.floor(f.x0), Math.floor(f.z0), Math.ceil(f.x1), Math.ceil(f.z1), 'f');
        return f;
      },
      // ¿cabe un mueble ahí (con un margen libre alrededor)?
      fits(type, x, z, fx, fz, m) {
        const t = G.Furniture.T[type], along = Math.abs(fz) > 0.5;
        const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
        m = m == null ? 1 : m;
        return free(Math.floor(x - hw) - m, Math.floor(z - hd) - m, Math.ceil(x + hw) + m, Math.ceil(z + hd) + m);
      },
      // contenedor: esquina (x, z) de su planta, eje 'x' o 'z', largo 6 o 12, pisos apilados (1 a 3)
      // o: { open: true (solo de un piso: puertas abiertas en el extremo final), cols: [colores por piso] }
      cont(x, z, axis, len, levels, o) {
        o = o || {};
        const w = axis === 'x' ? len : 2, d = axis === 'x' ? 2 : len;
        P.conts.push({ x, z, axis, len, levels: o.open ? 1 : levels, open: o.open || false, cols: o.cols || null, w, d, lod: o.lod || 0 });
        occ(x, z, x + w, z + d, 'c');
      },
      tree(x, z, pine) { P.obj.push([x, z, pine ? 2 : 1]); occ(x, z, x + 1, z + 1, 't'); },
      bush(x, z) { P.obj.push([x, z, 4]); },
      pole(x, z) { P.obj.push([x, z, 3]); occ(x, z, x + 1, z + 1, 't'); },
      tall(x0, z0, x1, z1) { P.tall.push(['r', x0, z0, x1, z1]); },
      tallCircle(x, z, r) { P.tall.push(['c', x, z, r]); },
      puddle(x, z, w, d) { P.furn.push({ type: 'charco', lv: 0, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y: 0, h: 0.01, fx: 0, fz: 1, solid: false, cont: null }); }
    };
    return api;
  }

  function prims(id) {
    const m = MAPS[id];
    if (!m.P) {
      const api = maker();
      m.build(api, U.mulberry32(m.seed || 7));
      m.P = api.P;
    }
    return m.P;
  }

  // ---------- Aplicar a un chunk ----------
  // phase 'base': suelo, muros, edificios, contenedores (aristas y techos), árboles e hierba alta
  // phase 'props': muebles, vehículos y los modelos de los contenedores (después de amueblar los edificios)
  function apply(id, c, cx, cz, rng, W, phase) {
    const P = prims(id), CS = G.World.CS, E = G.World.E;
    const X0 = cx * CS, Z0 = cz * CS;
    const inC = (x, z) => x >= X0 && z >= Z0 && x < X0 + CS && z < Z0 + CS;
    const li = (x, z) => (z - Z0) * CS + (x - X0);
    if (phase === 'base') {
      for (const [x0, z0, x1, z1, g] of P.ground) {
        for (let z = Math.max(z0, Z0); z < Math.min(z1, Z0 + CS); z++) for (let x = Math.max(x0, X0); x < Math.min(x1, X0 + CS); x++) c.ground[li(x, z)] = g;
      }
      // contenedores: costados (aristas) y techos transitables
      for (const k of P.conts) {
        const x1 = k.x + k.w, z1 = k.z + k.d;
        const deckH = k.open ? 0 : Math.round(k.levels * LEVEL_H * 10);
        for (let z = k.z; z < z1; z++) {
          for (let x = k.x; x < x1; x++) {
            if (!inC(x, z)) continue;
            if (deckH) { if (!c.deck) c.deck = new Uint8Array(CS * CS); c.deck[li(x, z)] = Math.max(c.deck[li(x, z)], deckH); }
            c.tall[li(x, z)] = 0;
          }
        }
        // abierto: las puertas del extremo final (o de los dos extremos: un túnel que se cruza)
        const endA = k.open === 'both', endB = !!k.open;
        for (let x = k.x; x < x1; x++) {
          if (inC(x, k.z) && !(k.axis === 'z' && endA)) c.eN[li(x, k.z)] = E.CONT;
          if (inC(x, z1) && !(k.axis === 'z' && endB)) c.eN[li(x, z1)] = E.CONT;
        }
        for (let z = k.z; z < z1; z++) {
          if (inC(k.x, z) && !(k.axis === 'x' && endA)) c.eW[li(k.x, z)] = E.CONT;
          if (inC(x1, z) && !(k.axis === 'x' && endB)) c.eW[li(x1, z)] = E.CONT;
        }
      }
      for (const [o, x, z, e] of P.edges) {
        if (!inC(x, z)) continue;
        (o === 'N' ? c.eN : c.eW)[li(x, z)] = e;
      }
      for (const b of P.blds) {
        if (!inC(b.ox, b.oz)) continue;
        const bb = W.placeBuilding(b.id, b.ox - X0, b.oz - Z0, b.front);
        // en los mapas no hay puertas: los huecos quedan abiertos
        for (let z = bb.z0; z <= bb.z0 + bb.h; z++) {
          for (let x = bb.x0; x <= bb.x0 + bb.w; x++) {
            if (!inC(x, z)) continue;
            const i = li(x, z);
            if (c.eN[i] === E.DOOR || c.eN[i] === E.DOOR_OPEN || c.eN[i] === E.DOOR_BROKEN) c.eN[i] = E.ARCH;
            if (c.eW[i] === E.DOOR || c.eW[i] === E.DOOR_OPEN || c.eW[i] === E.DOOR_BROKEN) c.eW[i] = E.ARCH;
          }
        }
        if (b.post) b.post(c, bb, (x, z) => li(x, z), E);
      }
      for (const [x, z, o] of P.obj) if (inC(x, z)) { c.obj[li(x, z)] = o; c.tall[li(x, z)] = 0; }
      for (let z = Z0; z < Z0 + CS; z++) {
        for (let x = X0; x < X0 + CS; x++) {
          const i = li(x, z);
          if (c.bld[i] || c.ground[i] === G.World.F.ROAD) continue;
          if (c.deck && c.deck[i]) continue;
          for (const t of P.tall) {
            const hit = t[0] === 'r' ? (x >= t[1] && z >= t[2] && x < t[3] && z < t[4]) : Math.hypot(x + 0.5 - t[1], z + 0.5 - t[2]) < t[3];
            if (hit) { c.tall[i] = 1; break; }
          }
        }
      }
      return;
    }
    // ----- muebles, vehículos y contenedores -----
    for (const f of P.furn) {
      const cxm = (f.x0 + f.x1) / 2, czm = (f.z0 + f.z1) / 2;
      if (!inC(Math.floor(cxm), Math.floor(czm))) continue;
      const g = Object.assign({}, f, { seed: Math.floor(rng() * 1e9) });
      if (G.Furniture.T[f.type].vehicle) g.vehicle = true;
      c.furn.push(g);
    }
    for (const k of P.conts) {
      const cxm = k.x + k.w / 2, czm = k.z + k.d / 2;
      if (!inC(Math.floor(cxm), Math.floor(czm))) continue;
      for (let l = 0; l < k.levels; l++) {
        const type = k.len >= 12 ? 'cont12' : 'cont6';
        const along = k.axis === 'z';          // el largo va en z: el frente mira a x
        c.furn.push({
          type, lv: 0, x0: k.x + 0.03, x1: k.x + k.w - 0.03, z0: k.z + 0.03, z1: k.z + k.d - 0.03, y: l * LEVEL_H, h: LEVEL_H,
          fx: along ? 1 : 0, fz: along ? 0 : 1, solid: false, cont: null, seed: Math.floor(rng() * 1e9),
          col: k.cols ? k.cols[l % k.cols.length] : undefined, open: l === 0 ? k.open : false, lod: k.lod
        });
      }
    }
  }

  // =====================================================================================================
  // Terminal de carga: un patio de contenedores apilados (de uno a tres de alto) con callejones y algún
  // contenedor abierto que se cruza como un túnel. Un solo interior, grande y alto: la nave del taller al
  // noroeste (donde se empieza), con un taller y un almacén al fondo, sin puertas. Montacargas, camionetas,
  // tanques, palés, lonas, barreras de hormigón, charcos y hierba alta. Valla de alambre con espino y, detrás,
  // pilas altas de contenedores y galpones que tapan la vista (como en el vídeo)
  // =====================================================================================================
  MAPS.terminal = {
    name: 'Terminal de carga', min: 6, max: 58, spawn: { x: 16.5, z: 22.5 }, seed: 4242, fence: 'chain',
    // luz: cielo cubierto, gris azulado, con algo de neblina (como en el vídeo)
    mood: { sky: 0x939ea4, fog: 0.8, hemi: [0xc2cace, 0x4c4a40, 0.74], sun: [0xe6ecee, 0.62],
      ground: { 0: [0x5a6a3c, 0x6e7646], 3: [0x5e5444, 0x6a604c], 1: [0x4a4b4c, 0x535352] } },
    skyline: { col: 0x7d888e, h: [8, 26], cranes: [0.7, 1.1, 4.2], towers: [0.25] },
    build(M, rng) {
      const F = G.World.F, E = G.World.E;
      // suelo: tierra y hierba en el patio; asfalto alrededor de la nave, en la calle principal y en los carriles
      M.ground(0, 0, 64, 64, F.DIRT);
      M.ground(6, 6, 30, 23, F.ROAD);
      M.ground(6, 20, 58, 23, F.ROAD);
      M.ground(30, 6, 34, 58, F.ROAD);
      M.ground(46, 23, 49, 58, F.ROAD);
      M.ground(6, 46, 58, 49, F.ROAD);
      for (const [x0, z0, x1, z1] of [[7, 24, 30, 32], [7, 33, 30, 46], [7, 49, 30, 58], [34, 24, 46, 46], [49, 24, 58, 46], [34, 49, 58, 58], [34, 6, 58, 20]]) M.ground(x0, z0, x1, z1, F.GRASS);

      // la nave del taller: grande (20 x 12) y alta (6 m), con dos portones abiertos al sur, uno al este y huecos
      // sin puertas hacia el taller y el almacén del fondo
      M.building('nave_t', 7, 7, 20, 12, 'S', (c, b, li, E2) => {
        for (const x of [9, 10, 11, 12, 16, 17, 18, 19]) c.eN[li(x, 19)] = E2.GATE;
        for (const z of [9, 10, 11]) c.eW[li(27, z)] = E2.GATE;
        // el taller y el almacén del fondo, abiertos a la nave por varios huecos
        for (const z of [8, 9, 10, 14, 15, 16, 17]) c.eW[li(21, z)] = E2.ARCH;
        for (const x of [23, 24]) c.eN[li(x, 13)] = E2.ARCH;
      });
      // persianas cerradas y bajantes en las fachadas sin huecos
      M.put('persiana', 13.0, 6.92, 0, -1); M.put('persiana', 21.5, 6.92, 0, -1); M.put('persiana', 6.92, 13.5, -1, 0);

      // ----- patio de contenedores: bloques de dos filas separados por callejones -----
      const bays = [
        // [x0, z0, x1, z1, eje]
        [35, 7, 57, 13, 'x'],
        [35, 15, 45, 20, 'x'],
        [49, 15, 57, 20, 'x'],
        [7, 24, 30, 32, 'x'],
        [7, 33, 18, 46, 'z'],
        [20, 33, 30, 46, 'x'],
        [7, 49, 30, 58, 'x'],
        [35, 24, 46, 32, 'x'],
        [35, 33, 46, 46, 'z'],
        [49, 24, 57, 46, 'z'],
        [35, 49, 57, 58, 'x']
      ];
      const pickLv = () => { const r = rng(); return r < 0.42 ? 1 : (r < 0.84 ? 2 : 3); };
      for (const [x0, z0, x1, z1, ax] of bays) {
        const across0 = ax === 'x' ? z0 : x0, across1 = ax === 'x' ? z1 : x1;
        const along0 = ax === 'x' ? x0 : z0, along1 = ax === 'x' ? x1 : z1;
        let r = across0, inBlock = 0;
        while (r + 2 <= across1) {
          let a = along0;
          while (a < along1) {
            const room = along1 - a;
            if (room < 6) break;
            if (rng() < 0.18 && a > along0) { a += 2 + Math.floor(rng() * 2); continue; }   // hueco: paso entre bloques
            const len = room >= 12 && rng() < 0.45 ? 12 : 6;
            const op = len === 6 && rng() < 0.18 ? (rng() < 0.5 ? 'both' : true) : false;
            const lv = op ? 1 : pickLv();
            if (ax === 'x') M.cont(a, r, 'x', len, lv, { open: op }); else M.cont(r, a, 'z', len, lv, { open: op });
            a += len + (rng() < 0.3 ? 1 : 0);
          }
          r += 2; inBlock++;
          if (inBlock === 2) { r += 3; inBlock = 0; }      // callejón de 3 m
        }
      }

      // ----- fuera de la valla: pilas altas de contenedores y galpones que tapan la vista -----
      const ring = (x0, z0, x1, z1, ax, lo, hi) => {
        const along0 = ax === 'x' ? x0 : z0, along1 = ax === 'x' ? x1 : z1, r = ax === 'x' ? z0 : x0;
        for (let a = along0; a + 6 <= along1;) {
          const len = along1 - a >= 12 && rng() < 0.5 ? 12 : 6;
          const lv = lo + Math.floor(rng() * (hi - lo + 1));
          if (ax === 'x') M.cont(a, r, 'x', len, lv, { lod: 1 }); else M.cont(r, a, 'z', len, lv, { lod: 1 });
          a += len;
        }
      };
      ring(5, 1, 40, 3, 'x', 3, 4); ring(5, 3, 40, 5, 'x', 2, 3);
      ring(54, 1, 64, 3, 'x', 3, 4); ring(54, 3, 59, 5, 'x', 2, 3);
      ring(5, 59, 59, 61, 'x', 2, 3); ring(5, 61, 64, 63, 'x', 3, 4);
      ring(1, 0, 3, 64, 'z', 3, 4); ring(3, 6, 5, 58, 'z', 2, 3);
      ring(61, 5, 63, 61, 'z', 3, 4); ring(59, 6, 61, 58, 'z', 2, 3);
      M.put('galpon', 47.0, 2.5, 0, 1);

      // ----- vehículos -----
      M.put('montacargas', 28.5, 21.5, 1, 0, { cont: null });
      M.put('camioneta', 39.5, 21.5, -1, 0, { cont: null });
      M.put('camioneta', 53.5, 21.5, 1, 0, { cont: null });
      M.put('coche', 31.8, 14.0, 0, 1, { cont: null });
      M.put('montacargas', 47.5, 36.5, 0, 1, { cont: null });
      M.put('camioneta', 47.5, 52.5, 0, -1, { cont: null });
      M.put('montacargas', 21.5, 47.5, 1, 0, { cont: null });
      M.put('coche', 38.5, 47.5, -1, 0, { cont: null });

      // ----- dentro de la nave: palés con cajas y bultos en el centro (las estanterías y bancos van contra
      // las paredes) -----
      M.put('palets', 12.5, 12.5, 1, 0); M.put('lona', 15.0, 12.5, 0, 1); M.put('palets', 17.5, 14.5, 0, 1);
      M.put('bidones', 12.5, 15.5, 1, 0);

      // ----- cosas sueltas por el patio (donde quepan) -----
      const scatter = (type, n, m) => {
        for (let k = 0, tries = 0; k < n && tries < 400; tries++) {
          const x = 8 + Math.floor(rng() * 48) + 0.5, z = 8 + Math.floor(rng() * 48) + 0.5;
          const fx = rng() < 0.5 ? 1 : 0, fz = fx ? 0 : 1;
          if (!M.fits(type, x, z, fx, fz, m)) continue;
          M.put(type, x, z, fx, fz);
          k++;
        }
      };
      // barreras de hormigón junto al inicio (como en la entrada del vídeo)
      M.put('barrera', 9.0, 22.5, 0, 1); M.put('barrera', 11.2, 22.5, 0, 1);
      M.put('ibc', 23.5, 21.5, 0, 1); M.put('ibc', 24.8, 21.5, 0, 1);
      M.put('lona', 28.4, 18.0, 1, 0);
      scatter('ibc', 6, 1); scatter('palets', 8, 1); scatter('lona', 7, 1); scatter('barrera', 6, 1);
      scatter('bidones', 5, 1); scatter('tubo', 2, 1); scatter('bloques', 4, 1);
      // charcos
      for (let k = 0, tries = 0; k < 14 && tries < 300; tries++) {
        const x = 8 + rng() * 48, z = 8 + rng() * 48;
        if (!M.free(Math.floor(x - 1.5), Math.floor(z - 1), Math.ceil(x + 1.5), Math.ceil(z + 1))) continue;
        M.puddle(x, z, 2 + rng() * 3, 1.5 + rng() * 2); k++;
      }
      // hierba alta en manchas
      for (let k = 0; k < 34; k++) M.tallCircle(8 + rng() * 48, 8 + rng() * 48, 1.8 + rng() * 3.2);
      // pinos y postes junto a la valla
      for (const [x, z] of [[7, 21], [57, 7], [57, 22], [45, 7], [7, 57], [57, 57], [30, 57], [57, 33], [7, 44]]) if (M.free(x, z, x + 1, z + 1)) M.tree(x, z, true);
      for (const [x, z] of [[29, 7], [33, 9], [47, 23], [33, 40], [7, 32]]) if (M.free(x, z, x + 1, z + 1)) M.pole(x, z);
    }
  };

  // ---------- Horizonte lejano ----------
  // Siluetas de la ciudad (y grúas, torres, árboles) alrededor del mapa, a unos 44 m de la cámara y sin niebla
  // propia: van con la cámara (como un cielo), en tonos que se funden con la neblina del cielo
  let sky = null;
  function skyline(scene, id) {
    if (sky) { scene.remove(sky); sky.geometry.dispose(); sky = null; }
    const m = id && MAPS[id];
    if (!m || !m.skyline) return null;
    const rng = U.mulberry32((m.seed || 7) + 99);
    const M = new G.Mesher();
    const R = 44, base = -6;
    const col = (k) => U.shade(m.skyline.col, k);
    const at = (a, r) => [Math.sin(a) * r, Math.cos(a) * r];
    // edificios en la distancia (dos capas: lejos más claros)
    for (const [r, k, n] of [[R + 6, 1.1, 46], [R, 0.95, 34]]) {
      for (let i = 0; i < n; i++) {
        const a = (i + rng() * 0.6) / n * Math.PI * 2;
        const [x, z] = at(a, r);
        const h = m.skyline.h[0] + rng() * (m.skyline.h[1] - m.skyline.h[0]);
        const w = 4 + rng() * 7;
        M.box(x, base + h / 2, z, w, h, 3, col(k * (0.92 + rng() * 0.12)), a);
        if (rng() < 0.35) M.box(x + (rng() - 0.5) * 2, base + h + 1.2, z, 1.2, 2.4, 1.2, col(k * 0.95), a);
      }
    }
    // grúas portuarias y una torre (terminal)
    for (const c of m.skyline.cranes || []) {
      const [x, z] = at(c, R - 2);
      const H = 26;
      for (const s of [-1, 1]) M.box(x + Math.cos(c) * s * 2.5, base + H / 2, z - Math.sin(c) * s * 2.5, 0.6, H, 0.6, col(0.8), c);
      M.box(x, base + H, z, 7, 1.2, 1.2, col(0.8), c);
      M.box(x + Math.sin(c) * -5, base + H + 3, z + Math.cos(c) * -5, 0.6, 0.6, 18, col(0.8), c);
      M.box(x, base + H + 4, z, 0.4, 8, 0.4, col(0.8), c);
    }
    for (const t of m.skyline.towers || []) {
      const [x, z] = at(t, R + 2);
      M.box(x, base + 16, z, 4, 32, 4, col(0.88), t);
      M.box(x, base + 33, z, 2.5, 4, 2.5, col(0.86), t);
      M.box(x, base + 37, z, 1, 6, 1, col(0.86), t);
    }
    // copas de árboles entre los edificios
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, [x, z] = at(a, R - 4);
      M.box(x, base + 6 + rng() * 3, z, 3 + rng() * 3, 6 + rng() * 5, 3, col(0.78), a);
    }
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false });
    sky = new THREE.Mesh(M.build(), mat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
    return sky;
  }
  function followSky(cam) { if (sky && cam) sky.position.set(cam.position.x, 0, cam.position.z); }

  G.Maps = {
    skyline, followSky,
    LEVEL_H,
    get(id) { return MAPS[id] || null; },
    list() { return Object.keys(MAPS); },
    apply,
    prims
  };
})(window.Game = window.Game || {});
