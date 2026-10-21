(function (G) {
  'use strict';

  // Menús de inicio (diseño propio, todo dibujado por código y siempre en movimiento):
  //   portada   una orilla al atardecer: olas que van y vienen, nubes, gaviotas, un faro que parpadea y un bote
  //             varado. «Presiona cualquier botón»
  //   principal un taller de noche: un mapa clavado en un corcho bajo una lámpara que titila, polvo en la luz
  //   modo      el taller desenfocado: partida estándar (oleadas) o partida libre
  //   personaje el personaje en 3D, quieto respirando, con su ficha
  //   carga     oscuridad, una luz fría arriba a la derecha y esporas que flotan (sin barra ni texto)
  const el = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const sin = Math.sin, cos = Math.cos;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  const rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a.toFixed(3) + ')';
  function rngOf(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // ruido suave 1D para crestas de montes y titileo de la lámpara
  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i, h = (n) => { const s = Math.sin((n + seed * 131) * 12.9898) * 43758.5453; return s - Math.floor(s); };
    const u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  }
  const fbm1 = (x, seed) => noise1(x, seed) * 0.55 + noise1(x * 2.1, seed + 3) * 0.28 + noise1(x * 4.7, seed + 7) * 0.17;

  // ================= Portada: la orilla =================
  const Shore = {
    build(W, H) {
      const r = rngOf(17);
      this.W = W; this.H = H;
      this.hz = H * 0.57; this.shore = H * 0.665;
      // cielo
      const sky = mk(W, this.hz + 2), x = sky.getContext('2d');
      let g = x.createLinearGradient(0, 0, 0, this.hz);
      g.addColorStop(0, '#2c3644'); g.addColorStop(0.45, '#5d5f68'); g.addColorStop(0.78, '#b48a6a'); g.addColorStop(1, '#e2b07a');
      x.fillStyle = g; x.fillRect(0, 0, W, this.hz + 2);
      this.sky = sky;
      // nubes: manchas suaves con la panza oscura y el borde de arriba encendido
      this.clouds = [];
      for (let i = 0; i < 7; i++) {
        const cw = W * (0.25 + r() * 0.3), ch = cw * (0.28 + r() * 0.12), c = mk(cw, ch), cx = c.getContext('2d');
        for (let k = 0; k < 26; k++) {
          const px = cw * (0.12 + r() * 0.76), py = ch * (0.35 + r() * 0.4), rr = ch * (0.18 + r() * 0.3);
          const lit = 1 - (py / ch);
          const gg = cx.createRadialGradient(px, py - rr * 0.3, rr * 0.1, px, py, rr);
          const L = 0.55 + lit * 0.5;
          gg.addColorStop(0, rgba(250 * L, 205 * L, 160 * L, 0.5)); gg.addColorStop(1, rgba(120, 110, 115, 0));
          cx.fillStyle = gg; cx.beginPath(); cx.arc(px, py, rr, 0, TAU); cx.fill();
        }
        this.clouds.push({ c, x: r() * W * 1.4 - W * 0.2, y: H * (0.04 + r() * 0.33), sp: W * (0.004 + r() * 0.007), a: 0.55 + r() * 0.4 });
      }
      // montes lejanos (más ancho que la pantalla: se mueven un poco al derivar la cámara)
      const MW = W * 1.1, far = mk(MW, this.hz + 4), fx = far.getContext('2d');
      const ridge = (base, amp, sc, seed, col, x0, x1) => {
        fx.beginPath(); fx.moveTo(x0, this.hz + 4);
        for (let px = x0; px <= x1; px += 4) fx.lineTo(px, base - fbm1(px / MW * sc, seed) * amp * Math.min(1, (px - x0) / (MW * 0.12)) * Math.min(1, (x1 - px) / (MW * 0.08)));
        fx.lineTo(x1, this.hz + 4); fx.closePath(); fx.fillStyle = col; fx.fill();
      };
      ridge(this.hz, H * 0.2, 4, 3, '#8c7f7c', MW * 0.25, MW * 0.98);
      ridge(this.hz, H * 0.09, 6, 5, '#7a6d6b', MW * 0.0, MW * 0.48);
      g = fx.createLinearGradient(0, this.hz - H * 0.22, 0, this.hz);
      g.addColorStop(0, 'rgba(226,176,122,0)'); g.addColorStop(1, 'rgba(226,176,122,0.45)');
      fx.globalCompositeOperation = 'source-atop'; fx.fillStyle = g; fx.fillRect(0, 0, MW, this.hz + 4); fx.globalCompositeOperation = 'source-over';
      this.far = far;
      // acantilado de la derecha (más cerca y más oscuro, con la cara iluminada por el sol bajo)
      const cl = mk(W * 0.6, this.shore + 6), cc = cl.getContext('2d'), CW = W * 0.6;
      cc.beginPath(); cc.moveTo(0, this.shore + 6);
      for (let px = 0; px <= CW; px += 3) {
        const k = px / CW;
        cc.lineTo(px, this.shore - Math.pow(k, 0.85) * H * 0.58 - fbm1(k * 7, 11) * H * 0.07 * k);
      }
      cc.lineTo(CW, this.shore + 6); cc.closePath();
      g = cc.createLinearGradient(0, 0, CW, 0); g.addColorStop(0, '#6f625b'); g.addColorStop(0.5, '#4f4542'); g.addColorStop(1, '#2f2a2a');
      cc.fillStyle = g; cc.fill();
      cc.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 90; i++) {   // vetas de roca
        const px = r() * CW, py = this.shore - r() * H * 0.6, l = W * (0.01 + r() * 0.04);
        cc.strokeStyle = r() < 0.5 ? 'rgba(220,170,120,0.07)' : 'rgba(20,15,15,0.14)'; cc.lineWidth = 1 + r() * 2.5;
        cc.beginPath(); cc.moveTo(px, py); cc.lineTo(px + l, py + l * 0.35); cc.stroke();
      }
      g = cc.createLinearGradient(0, this.shore - H * 0.1, 0, this.shore + 6); g.addColorStop(0, 'rgba(200,170,150,0)'); g.addColorStop(1, 'rgba(200,170,150,0.35)');
      cc.fillStyle = g; cc.fillRect(0, 0, CW, this.shore + 6);
      cc.globalCompositeOperation = 'source-over';
      this.cliff = cl;
      // arena con manchas, piedras y un tronco
      const sand = mk(W * 1.06, H - this.shore + 2), sx = sand.getContext('2d'), SW = W * 1.06, SH = H - this.shore + 2;
      g = sx.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, '#8c7663'); g.addColorStop(0.25, '#a68b70'); g.addColorStop(1, '#5e4d3f');
      sx.fillStyle = g; sx.fillRect(0, 0, SW, SH);
      for (let i = 0; i < 1400; i++) { sx.fillStyle = r() < 0.5 ? 'rgba(60,45,35,0.12)' : 'rgba(230,200,160,0.08)'; sx.fillRect(r() * SW, r() * SH, 1 + r() * 2, 1); }
      for (let i = 0; i < 9; i++) {
        const px = r() * SW, py = SH * (0.3 + r() * 0.7), rr = H * (0.008 + r() * 0.02);
        sx.fillStyle = '#3f3630'; sx.beginPath(); sx.ellipse(px, py, rr * 1.6, rr, 0, 0, TAU); sx.fill();
        sx.fillStyle = 'rgba(220,180,140,0.18)'; sx.beginPath(); sx.ellipse(px - rr * 0.3, py - rr * 0.3, rr * 0.9, rr * 0.4, 0, 0, TAU); sx.fill();
      }
      sx.strokeStyle = '#4a3b2f'; sx.lineWidth = H * 0.012; sx.lineCap = 'round';
      sx.beginPath(); sx.moveTo(SW * 0.08, SH * 0.62); sx.lineTo(SW * 0.21, SH * 0.55); sx.stroke();
      sx.lineWidth = H * 0.005; sx.beginPath(); sx.moveTo(SW * 0.17, SH * 0.57); sx.lineTo(SW * 0.2, SH * 0.48); sx.stroke();
      this.sand = sand;
      // bote de remos varado (propio): casco de madera pintado de verde agua descascarado, dos bancos y un remo
      const BW = W * 0.34, BH = BW * 0.42, b = mk(BW, BH), bx = b.getContext('2d');
      const hull = () => { bx.beginPath(); bx.moveTo(BW * 0.03, BH * 0.36); bx.quadraticCurveTo(BW * 0.25, BH * 0.18, BW * 0.97, BH * 0.3); bx.lineTo(BW * 0.95, BH * 0.62); bx.quadraticCurveTo(BW * 0.5, BH * 0.98, BW * 0.12, BH * 0.62); bx.closePath(); };
      bx.fillStyle = 'rgba(30,22,18,0.45)'; bx.beginPath(); bx.ellipse(BW * 0.5, BH * 0.86, BW * 0.48, BH * 0.1, 0, 0, TAU); bx.fill();
      hull(); g = bx.createLinearGradient(0, BH * 0.2, 0, BH); g.addColorStop(0, '#5d7a74'); g.addColorStop(1, '#2b3532'); bx.fillStyle = g; bx.fill();
      bx.save(); hull(); bx.clip();
      for (let i = 0; i < 60; i++) { bx.fillStyle = r() < 0.6 ? 'rgba(90,64,44,0.55)' : 'rgba(170,190,180,0.2)'; bx.fillRect(r() * BW, BH * (0.3 + r() * 0.6), 4 + r() * 18, 2 + r() * 4); }
      bx.strokeStyle = 'rgba(15,12,10,0.35)'; bx.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) { bx.beginPath(); bx.moveTo(BW * 0.06, BH * (0.36 + k * 0.1)); bx.quadraticCurveTo(BW * 0.5, BH * (0.55 + k * 0.1), BW * 0.96, BH * (0.3 + k * 0.08)); bx.stroke(); }
      bx.restore();
      // borde (regala) y el interior
      bx.beginPath(); bx.moveTo(BW * 0.05, BH * 0.36); bx.quadraticCurveTo(BW * 0.25, BH * 0.2, BW * 0.96, BH * 0.31); bx.quadraticCurveTo(BW * 0.55, BH * 0.44, BW * 0.05, BH * 0.36);
      bx.fillStyle = '#231b16'; bx.fill(); bx.strokeStyle = '#7b6650'; bx.lineWidth = BH * 0.035; bx.stroke();
      bx.fillStyle = '#806a52'; bx.fillRect(BW * 0.34, BH * 0.25, BW * 0.05, BH * 0.15); bx.fillRect(BW * 0.62, BH * 0.27, BW * 0.05, BH * 0.14);
      bx.strokeStyle = '#6a5642'; bx.lineWidth = BH * 0.03; bx.lineCap = 'round';
      bx.beginPath(); bx.moveTo(BW * 0.15, BH * 0.25); bx.lineTo(BW * 0.72, BH * 0.12); bx.stroke();
      bx.fillStyle = '#6a5642'; bx.beginPath(); bx.ellipse(BW * 0.76, BH * 0.11, BW * 0.06, BH * 0.035, -0.2, 0, TAU); bx.fill();
      this.boat = b;
      // destellos del agua (cerca del reflejo del sol) y espuma
      this.glints = []; for (let i = 0; i < 160; i++) this.glints.push({ x: r(), y: r(), l: 4 + r() * 22, ph: r() * TAU, sp: 0.6 + r() * 1.6 });
      this.gulls = []; for (let i = 0; i < 3; i++) this.gulls.push({ x: r(), y: 0.12 + r() * 0.25, sp: 0.008 + r() * 0.01, ph: r() * TAU, s: 0.6 + r() * 0.6 });
      this.spray = []; for (let i = 0; i < 40; i++) this.spray.push({ x: r(), y: r(), sp: 0.004 + r() * 0.01, ph: r() * TAU });
      this.grass = []; for (let i = 0; i < 26; i++) this.grass.push({ x: r() * 0.22, h: 0.04 + r() * 0.06, ph: r() * TAU });
    },
    draw(x, W, H, t) {
      const drift = sin(t * 0.07) * W * 0.012;
      x.drawImage(this.sky, 0, 0);
      // sol bajo detrás de las nubes
      const sx = W * 0.3, sy = this.hz - H * 0.05;
      let g = x.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
      const pulse = 0.85 + 0.15 * sin(t * 0.4);
      g.addColorStop(0, rgba(255, 228, 180, 0.75 * pulse)); g.addColorStop(0.2, rgba(255, 190, 120, 0.3 * pulse)); g.addColorStop(1, 'rgba(255,170,100,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, this.hz);
      for (const c of this.clouds) {
        const cw = c.c.width, px = ((c.x + t * c.sp) % (W + cw * 1.2)) - cw * 0.6;
        x.globalAlpha = c.a; x.drawImage(c.c, px - drift * 0.2, c.y); x.globalAlpha = 1;
      }
      // gaviotas
      x.strokeStyle = 'rgba(40,36,38,0.75)'; x.lineWidth = 1.4;
      for (const gl of this.gulls) {
        const px = ((gl.x + t * gl.sp) % 1.2 - 0.1) * W, py = gl.y * H + sin(t * 0.7 + gl.ph) * H * 0.01, s = gl.s * H * 0.012, f = sin(t * 6 + gl.ph) * 0.6;
        x.beginPath(); x.moveTo(px - s * 1.4, py - s * f); x.quadraticCurveTo(px - s * 0.6, py - s * (0.6 + f * 0.5), px, py); x.quadraticCurveTo(px + s * 0.6, py - s * (0.6 + f * 0.5), px + s * 1.4, py - s * f); x.stroke();
      }
      x.drawImage(this.far, -W * 0.05 - drift * 0.3, 0);
      // faro en el cabo, con la luz que gira (parpadea)
      const lx = W * 0.2 - drift * 0.3, ly = this.hz - H * 0.075;
      x.fillStyle = '#d9cfc2'; x.fillRect(lx - H * 0.006, ly, H * 0.012, H * 0.05);
      x.fillStyle = '#7a3d33'; x.fillRect(lx - H * 0.008, ly - H * 0.012, H * 0.016, H * 0.012);
      const bl = Math.pow(Math.max(0, sin(t * 1.3)), 6);
      g = x.createRadialGradient(lx, ly - H * 0.006, 0, lx, ly - H * 0.006, H * 0.06);
      g.addColorStop(0, rgba(255, 240, 200, 0.9 * bl)); g.addColorStop(1, 'rgba(255,240,200,0)');
      x.fillStyle = g; x.fillRect(lx - H * 0.06, ly - H * 0.07, H * 0.12, H * 0.12);
      // mar
      g = x.createLinearGradient(0, this.hz, 0, this.shore);
      g.addColorStop(0, '#b29a86'); g.addColorStop(0.35, '#7f8486'); g.addColorStop(1, '#55605f');
      x.fillStyle = g; x.fillRect(0, this.hz, W, this.shore - this.hz + 2);
      for (const s of this.glints) {
        const px = s.x * W, py = this.hz + s.y * (this.shore - this.hz), near = Math.max(0, 1 - Math.abs(px - sx) / (W * 0.35));
        const a = (0.06 + 0.5 * near) * Math.max(0, sin(t * s.sp + s.ph)) * (1 - s.y * 0.5);
        if (a < 0.02) continue;
        x.fillStyle = rgba(255, 230, 190, a); x.fillRect(px + sin(t * 0.5 + s.ph) * 6, py, s.l * (0.4 + s.y), 1.2);
      }
      x.drawImage(this.cliff, W * 0.42 - drift * 0.6, 0);
      // olas: suben por la arena, se apagan y vuelven
      x.drawImage(this.sand, -W * 0.03 - drift, this.shore);
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.11 + k / 3) % 1, y0 = this.shore + ph * H * 0.08, a = sin(Math.PI * ph);
        x.fillStyle = rgba(70, 72, 70, 0.22 * a);
        x.beginPath(); x.moveTo(0, this.shore);
        for (let px = 0; px <= W; px += 16) x.lineTo(px, y0 + sin(px * 0.012 + k * 2 + t * 0.3) * H * 0.008);
        x.lineTo(W, this.shore); x.closePath(); x.fill();
        x.strokeStyle = rgba(235, 228, 215, 0.55 * a); x.lineWidth = 1.6;
        x.beginPath();
        for (let px = 0; px <= W; px += 16) { const py = y0 + sin(px * 0.012 + k * 2 + t * 0.3) * H * 0.008; if (px === 0) x.moveTo(px, py); else x.lineTo(px, py); }
        x.stroke();
      }
      // bote y hierbas que se mecen
      x.drawImage(this.boat, W * 0.56 - drift * 1.2, H * 0.66);
      x.strokeStyle = 'rgba(70,64,40,0.85)'; x.lineWidth = 1.5;
      for (const gr of this.grass) {
        const bx = gr.x * W - drift * 1.3, by = H * 0.99, hh = gr.h * H, sw = sin(t * 1.4 + gr.ph) * hh * 0.25;
        x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + sw * 0.3, by - hh * 0.6, bx + sw, by - hh); x.stroke();
      }
      // espuma en el aire
      for (const p of this.spray) {
        const px = ((p.x + t * p.sp) % 1) * W, py = this.hz + p.y * (H - this.hz) + sin(t + p.ph) * 8;
        x.fillStyle = rgba(255, 240, 220, 0.12 + 0.12 * sin(t * 2 + p.ph)); x.fillRect(px, py, 1.6, 1.6);
      }
      vignette(x, W, H, 0.55);
    }
  };

  // ================= Menú principal: el taller =================
  const Shop = {
    build(W, H) {
      const r = rngOf(29);
      this.W = W; this.H = H;
      const PW = W * 1.06, PH = H * 1.06, c = mk(PW, PH), x = c.getContext('2d');
      // pared de tablas
      x.fillStyle = '#1f1914'; x.fillRect(0, 0, PW, PH);
      for (let px = 0; px < PW; px += PW / 26) {
        x.fillStyle = r() < 0.5 ? 'rgba(80,60,42,0.25)' : 'rgba(10,8,6,0.25)'; x.fillRect(px, 0, PW / 26 - 2, PH * 0.66);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px - 1, 0, 2, PH * 0.66);
      }
      // estantes a la izquierda con frascos y cajas
      for (let k = 0; k < 3; k++) {
        const sy = PH * (0.16 + k * 0.17);
        x.fillStyle = '#3a2c20'; x.fillRect(PW * 0.02, sy, PW * 0.25, PH * 0.014);
        let px = PW * 0.03;
        while (px < PW * 0.25) {
          const w = PW * (0.012 + r() * 0.03), h = PH * (0.03 + r() * 0.07);
          x.fillStyle = ['#2b2f2a', '#4a3a28', '#3c3a33', '#5a4630', '#2e3a3e'][(r() * 5) | 0];
          if (r() < 0.4) { x.beginPath(); x.ellipse(px + w / 2, sy - h / 2, w / 2, h / 2, 0, 0, TAU); x.fill(); } else x.fillRect(px, sy - h, w, h);
          px += w + PW * 0.006;
        }
      }
      // corcho con un mapa de la ciudad clavado (rutas marcadas en rojo), notas y fotos
      const bx = PW * 0.33, by = PH * 0.07, bw = PW * 0.32, bh = PH * 0.44;
      x.fillStyle = '#2a2018'; x.fillRect(bx - 8, by - 8, bw + 16, bh + 16);
      x.fillStyle = '#7d5f3e'; x.fillRect(bx, by, bw, bh);
      for (let i = 0; i < 1500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(40,25,12,0.25)' : 'rgba(190,150,100,0.18)'; x.fillRect(bx + r() * bw, by + r() * bh, 1.5, 1.5); }
      const mx = bx + bw * 0.18, my = by + bh * 0.14, mw = bw * 0.58, mh = bh * 0.66;
      x.save(); x.translate(mx + mw / 2, my + mh / 2); x.rotate(-0.025);
      x.fillStyle = '#cbbd9c'; x.fillRect(-mw / 2, -mh / 2, mw, mh);
      x.strokeStyle = 'rgba(80,70,55,0.5)'; x.lineWidth = 1;
      for (let i = 0; i < 9; i++) { const yy = -mh / 2 + mh * (i + 0.5) / 9; x.beginPath(); x.moveTo(-mw / 2, yy + (r() - 0.5) * 6); x.lineTo(mw / 2, yy + (r() - 0.5) * 6); x.stroke(); }
      for (let i = 0; i < 11; i++) { const xx = -mw / 2 + mw * (i + 0.5) / 11; x.beginPath(); x.moveTo(xx + (r() - 0.5) * 6, -mh / 2); x.lineTo(xx + (r() - 0.5) * 6, mh / 2); x.stroke(); }
      x.strokeStyle = 'rgba(70,110,130,0.7)'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(-mw / 2, mh * 0.2); x.bezierCurveTo(-mw * 0.1, mh * 0.05, mw * 0.1, mh * 0.45, mw / 2, mh * 0.3); x.stroke();
      x.strokeStyle = '#a3291f'; x.lineWidth = 2.5; x.setLineDash([7, 5]);
      x.beginPath(); x.moveTo(-mw * 0.38, -mh * 0.3); x.lineTo(-mw * 0.1, -mh * 0.22); x.lineTo(mw * 0.05, mh * 0.05); x.lineTo(mw * 0.3, mh * 0.12); x.stroke();
      x.setLineDash([]);
      for (const [px, py] of [[-mw * 0.38, -mh * 0.3], [mw * 0.3, mh * 0.12], [-mw * 0.1, -mh * 0.22]]) {
        x.strokeStyle = '#a3291f'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(px - 6, py - 6); x.lineTo(px + 6, py + 6); x.moveTo(px + 6, py - 6); x.lineTo(px - 6, py + 6); x.stroke();
      }
      x.restore();
      const notes = [[0.05, 0.08, 0.13, 0.17, '#d8cfa8'], [0.8, 0.1, 0.15, 0.13, '#e3dcc6'], [0.82, 0.62, 0.12, 0.2, '#c9c2a8'], [0.06, 0.7, 0.14, 0.14, '#ddd3a5']];
      for (const [nx, ny, nw, nh, col] of notes) {
        x.save(); x.translate(bx + bw * (nx + nw / 2), by + bh * (ny + nh / 2)); x.rotate((r() - 0.5) * 0.18);
        x.fillStyle = col; x.fillRect(-bw * nw / 2, -bh * nh / 2, bw * nw, bh * nh);
        x.strokeStyle = 'rgba(40,40,60,0.45)'; x.lineWidth = 1;
        for (let l = 0; l < 4; l++) { x.beginPath(); x.moveTo(-bw * nw * 0.38, -bh * nh * 0.25 + l * bh * nh * 0.16); x.lineTo(bw * nw * (0.1 + r() * 0.28), -bh * nh * 0.25 + l * bh * nh * 0.16); x.stroke(); }
        x.fillStyle = ['#b33', '#36a', '#da3'][(r() * 3) | 0]; x.beginPath(); x.arc(0, -bh * nh * 0.42, 3, 0, TAU); x.fill();
        x.restore();
      }
      // banco de trabajo con cajones, un torno y latas
      const ty = PH * 0.6;
      x.fillStyle = '#4a3828'; x.fillRect(0, ty, PW, PH * 0.035);
      x.fillStyle = '#6b5238'; x.fillRect(0, ty, PW, PH * 0.008);
      x.fillStyle = '#2a2018'; x.fillRect(0, ty + PH * 0.035, PW, PH);
      for (let i = 0; i < 4; i++) {
        const dx = PW * (0.06 + i * 0.13);
        x.fillStyle = '#382a1e'; x.fillRect(dx, ty + PH * 0.08, PW * 0.11, PH * 0.12);
        x.fillStyle = '#6d6a62'; x.fillRect(dx + PW * 0.045, ty + PH * 0.13, PW * 0.02, PH * 0.012);
      }
      x.fillStyle = '#3d4240'; x.fillRect(PW * 0.18, ty - PH * 0.06, PW * 0.06, PH * 0.06); x.fillRect(PW * 0.2, ty - PH * 0.085, PW * 0.02, PH * 0.03);
      for (let i = 0; i < 5; i++) { const cx = PW * (0.5 + i * 0.035); x.fillStyle = ['#5c3a2a', '#4a4a3a', '#6a5a3a'][i % 3]; x.fillRect(cx, ty - PH * (0.03 + (i % 2) * 0.02), PW * 0.025, PH * (0.03 + (i % 2) * 0.02)); }
      // radio transmisora a la derecha
      const rx = PW * 0.72, ry = PH * 0.24, rw = PW * 0.24, rh = PH * 0.36;
      x.fillStyle = '#4b4434'; x.fillRect(rx, ry, rw, rh);
      x.fillStyle = '#5c5440'; x.fillRect(rx, ry, rw, rh * 0.05);
      x.fillStyle = '#2a2720'; x.fillRect(rx + rw * 0.08, ry + rh * 0.12, rw * 0.5, rh * 0.32);
      x.fillStyle = '#8a8270'; x.fillRect(rx + rw * 0.1, ry + rh * 0.15, rw * 0.46, rh * 0.26);
      for (let i = 0; i < 6; i++) { x.fillStyle = '#1e1c18'; x.beginPath(); x.arc(rx + rw * (0.12 + i * 0.13), ry + rh * 0.62, rw * 0.035, 0, TAU); x.fill(); }
      for (let l = 0; l < 7; l++) { x.fillStyle = 'rgba(20,18,15,0.6)'; x.fillRect(rx + rw * 0.66, ry + rh * (0.14 + l * 0.04), rw * 0.26, rh * 0.015); }
      x.fillStyle = '#c9a43a'; x.fillRect(rx + rw * 0.06, ry + rh * 0.82, rw * 0.3, rh * 0.04);
      x.fillStyle = '#3a3528'; x.fillRect(rx - PW * 0.02, ry + rh, rw + PW * 0.04, PH * 0.03);
      // lámpara de brazo colgando del techo
      x.strokeStyle = '#1a1714'; x.lineWidth = 3; x.beginPath(); x.moveTo(PW * 0.62, 0); x.lineTo(PW * 0.6, PH * 0.06); x.stroke();
      x.fillStyle = '#2b2a26'; x.beginPath(); x.moveTo(PW * 0.57, PH * 0.06); x.lineTo(PW * 0.63, PH * 0.06); x.lineTo(PW * 0.65, PH * 0.1); x.lineTo(PW * 0.55, PH * 0.1); x.closePath(); x.fill();
      this.room = c;
      this.radio = { x: rx, y: ry, w: rw, h: rh };
      this.dust = []; for (let i = 0; i < 70; i++) this.dust.push({ x: r(), y: r(), sp: 0.003 + r() * 0.01, ph: r() * TAU, s: 0.6 + r() * 1.4 });
    },
    draw(x, W, H, t) {
      const ox = sin(t * 0.06) * W * 0.015 + W * 0.03, oy = cos(t * 0.05) * H * 0.008 + H * 0.03;
      x.drawImage(this.room, -ox, -oy);
      // luz de la lámpara sobre el corcho, que titila de vez en cuando
      const fl = 0.86 + 0.1 * fbm1(t * 2.3, 4) + (noise1(t * 0.7, 9) > 0.93 ? -0.3 * noise1(t * 30, 2) : 0);
      const lx = W * 0.6 - ox, ly = H * 0.1 - oy;
      let g = x.createRadialGradient(W * 0.5 - ox, H * 0.32 - oy, 0, W * 0.5 - ox, H * 0.32 - oy, W * 0.34);
      g.addColorStop(0, rgba(255, 214, 160, 0.42 * fl)); g.addColorStop(0.5, rgba(255, 190, 130, 0.14 * fl)); g.addColorStop(1, 'rgba(255,180,120,0)');
      x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(0, 0, W, H);
      g = x.createRadialGradient(lx, ly + H * 0.04, 0, lx, ly + H * 0.04, H * 0.05);
      g.addColorStop(0, rgba(255, 235, 200, 0.8 * fl)); g.addColorStop(1, 'rgba(255,235,200,0)');
      x.fillStyle = g; x.fillRect(lx - H * 0.06, ly - H * 0.02, H * 0.12, H * 0.12);
      x.globalCompositeOperation = 'source-over';
      // luces de la radio: una roja que parpadea, una verde que titila y la aguja que tiembla
      const R = this.radio, rx = R.x - ox, ry = R.y - oy;
      const led = (px, py, col, a) => { const gg = x.createRadialGradient(px, py, 0, px, py, R.w * 0.06); gg.addColorStop(0, rgba(col[0], col[1], col[2], a)); gg.addColorStop(1, rgba(col[0], col[1], col[2], 0)); x.fillStyle = gg; x.fillRect(px - R.w * 0.06, py - R.w * 0.06, R.w * 0.12, R.w * 0.12); };
      led(rx + R.w * 0.85, ry + R.h * 0.82, [255, 60, 40], sin(t * 3) > 0.2 ? 0.9 : 0.15);
      led(rx + R.w * 0.72, ry + R.h * 0.82, [90, 255, 140], 0.35 + 0.35 * noise1(t * 6, 3));
      const ang = -0.6 + 0.5 * fbm1(t * 0.8, 5);
      x.strokeStyle = '#2a1a14'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(rx + R.w * 0.33, ry + R.h * 0.4); x.lineTo(rx + R.w * 0.33 + sin(ang) * R.h * 0.2, ry + R.h * 0.4 - cos(ang) * R.h * 0.2); x.stroke();
      // polvo en la luz
      for (const d of this.dust) {
        const px = ((d.x + t * d.sp * 0.5) % 1) * W, py = ((d.y + t * d.sp) % 1) * H + sin(t * 0.8 + d.ph) * 10;
        const inL = Math.max(0, 1 - Math.hypot(px - (W * 0.5 - ox), py - (H * 0.32 - oy)) / (W * 0.3));
        const a = 0.04 + 0.5 * inL;
        x.fillStyle = rgba(255, 230, 190, a); x.fillRect(px, py, d.s, d.s);
      }
      // sombra hacia la izquierda (donde va el menú)
      g = x.createLinearGradient(0, 0, W * 0.45, 0); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, W * 0.45, H);
      vignette(x, W, H, 0.7);
    }
  };

  // ================= Pantalla de carga: luz fría y esporas =================
  const Spores = {
    build(W, H) {
      const r = rngOf(41);
      this.p = [];
      for (let i = 0; i < 90; i++) this.p.push({ x: r(), y: r(), s: 1.2 + r() * 3.2, sp: 0.012 + r() * 0.03, sw: 0.5 + r() * 1.5, ph: r() * TAU, rot: r() * TAU, vr: (r() - 0.5) * 2 });
      this.haze = mk(W / 4, H / 4);
      const hx = this.haze.getContext('2d');
      for (let i = 0; i < 260; i++) { hx.fillStyle = rgba(120, 170, 165, 0.025); hx.beginPath(); hx.arc(r() * W / 4, r() * H / 4, 4 + r() * 18, 0, TAU); hx.fill(); }
    },
    draw(x, W, H, t) {
      x.fillStyle = '#030505'; x.fillRect(0, 0, W, H);
      const cx = W * (0.88 + 0.03 * sin(t * 0.13)), cy = H * (0.02 + 0.03 * sin(t * 0.17));
      const br = 0.85 + 0.15 * sin(t * 0.5);
      let g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.85);
      g.addColorStop(0, rgba(170, 220, 215, 0.55 * br)); g.addColorStop(0.18, rgba(70, 120, 118, 0.38 * br)); g.addColorStop(0.55, rgba(18, 36, 36, 0.3)); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.globalAlpha = 0.7; x.drawImage(this.haze, -((t * 6) % (W / 4)) * 0, 0, W, H); x.globalAlpha = 1;
      x.globalCompositeOperation = 'lighter';
      for (const p of this.p) {
        // caen despacio desde la luz hacia abajo a la izquierda, meciéndose
        const k = (p.y + t * p.sp) % 1;
        const px = (p.x - k * 0.25 + sin(t * p.sw * 0.4 + p.ph) * 0.02) * W + W * 0.15, py = k * H * 0.9;
        const near = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (Math.max(W, H) * 0.7));
        const a = (0.15 + 0.85 * near * near) * Math.min(1, k * 8) * (1 - k * 0.6);
        const rot = p.rot + t * p.vr;
        x.save(); x.translate(px, py); x.rotate(rot);
        x.fillStyle = rgba(225, 250, 245, a);
        x.beginPath(); x.ellipse(0, 0, p.s, p.s * (0.45 + 0.35 * Math.abs(sin(t * 1.3 + p.ph))), 0, 0, TAU); x.fill();
        x.restore();
      }
      x.globalCompositeOperation = 'source-over';
      vignette(x, W, H, 0.6);
    }
  };

  function vignette(x, W, H, k) {
    const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rgba(0, 0, 0, k));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  // ================= Personaje en 3D =================
  let C3 = null;
  function char3d() {
    if (C3) return C3;
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x030303);
    sc.fog = new THREE.Fog(0x030303, 4.5, 9);
    const cam = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 30);
    sc.add(new THREE.HemisphereLight(0x7d848c, 0x15110e, 0.5));
    const key = new THREE.DirectionalLight(0xffe0bf, 1.15); key.position.set(-1.6, 2.6, 2.4); sc.add(key);
    const rim = new THREE.DirectionalLight(0x86b0d4, 0.9); rim.position.set(1.8, 2.2, -2.6); sc.add(rim);
    // fondo: un resplandor tenue detrás del personaje
    const bc = mk(256, 256), bx = bc.getContext('2d');
    const g = bx.createRadialGradient(128, 118, 0, 128, 128, 128); g.addColorStop(0, 'rgba(34,31,27,1)'); g.addColorStop(0.55, 'rgba(10,10,10,1)'); g.addColorStop(1, 'rgba(3,3,3,1)');
    bx.fillStyle = g; bx.fillRect(0, 0, 256, 256);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), fog: false }));
    back.position.set(0, 1.4, -2.6); sc.add(back);
    // polvo flotando
    const N = 140, pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 3.2; pos[i * 3 + 1] = Math.random() * 2.6; pos[i * 3 + 2] = (Math.random() - 0.5) * 2 - 0.4; seeds.push(Math.random() * TAU); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xd8cbb0, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false }));
    sc.add(pts);
    C3 = { sc, cam, models: {}, pts, seeds };
    return C3;
  }
  function charModel(id) {
    const c = char3d();
    if (c.models[id]) return c.models[id];
    const ch = G.Player.CHARS[id];
    const h = G.Models.createHumanoid(ch.opts);
    G.Models.setBackpack(h, true);
    h.female = !!ch.opts.female;
    c.sc.add(h.root);
    c.models[id] = h;
    return h;
  }
  const _poseS = {};
  function render3d(renderer, dt, t) {
    const c = char3d();
    for (const id in c.models) c.models[id].root.visible = id === M.charId;
    const h = charModel(M.charId);
    h.root.visible = true;
    h.root.position.set(0, 0, 0);
    h.root.rotation.y = -0.32 + sin(t * 0.25) * 0.06;
    Object.assign(_poseS, {
      phase: 0, amt: 0, run: false, crouch: 0, prone: 0, rel: 0, hop: 0, cat: 'none', two: false, aim: false, dt, time: t,
      action: null, t: 0, climb: null, dodge: null, dodgeRel: 0, gun: null, pitch: 0, guard: 0, speed: 0, female: h.female,
      turn: 0, acc: 0, breath: 0.15, breathT: t * 1.6, look: { yaw: 0.28 + sin(t * 0.35) * 0.25, pitch: 0.06 + sin(t * 0.21) * 0.05, w: 1 },
      alert: 0, fidget: null, blow: null, struggle: null, cover: null, draw: null
    });
    G.Models.posePlayer(h, _poseS);
    const W = window.innerWidth, H = window.innerHeight;
    c.cam.aspect = W / H; c.cam.fov = W < H ? 46 : 30; c.cam.updateProjectionMatrix();
    c.cam.position.set(0.15 + sin(t * 0.1) * 0.06, 1.42 + sin(t * 0.13) * 0.02, 2.75);
    c.cam.lookAt(0.02, 1.2, 0);
    const p = c.pts.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.03; if (y > 2.6) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + sin(t * 0.5 + c.seeds[i]) * dt * 0.02);
    }
    p.needsUpdate = true;
    renderer.render(c.sc, c.cam);
  }

  // ================= Menús =================
  const MAIN = [
    { id: 'cont', name: 'Continuar', note: '' },
    { id: 'new', name: 'Nueva partida', note: 'Empieza una partida nueva.' },
    { id: 'retos', name: 'Desafíos', note: 'Los desafíos de Retorno: multiplican las recompensas del enfrentamiento en el que los completas.' },
    { id: 'tabla', name: 'Clasificación', soon: true },
    { id: 'tutos', name: 'Tutoriales', soon: true },
    { id: 'opts', name: 'Opciones', note: 'Juego, imagen, sonido y controles.' }
  ];
  const MODES = [
    { id: 'retorno', name: 'Retorno', desc: ['Empieza una carrera de Retorno.', 'Desde el refugio eliges cada enfrentamiento en el mapa: asaltos por oleadas o cazas contra reloj. Cinco enfrentamientos hasta el jefe final. Empiezas solo con la pistola: las demás armas se compran en el comercio y se mejoran en el banco con las piezas que ganas.', 'La muerte es definitiva. La carrera se guarda solo en el refugio.'] },
    { id: 'practica', name: 'Partida libre', desc: ['Empieza una partida libre.', 'El mapa sin oleadas, para explorar y probar a tu ritmo. Saca infectados cuando quieras con «+ Zombi»; lo que gastas no se pierde.'] },
    { id: 'diaria', name: 'Partida diaria', soon: true, desc: ['Próximamente.', 'Un mapa y unas reglas distintas cada día, iguales para todos.'] }
  ];
  const BIO = {
    vera: { style: 'Equilibrado', text: 'Creció en los barrios del puerto. Rápida y silenciosa: prefiere pasar sin que la vean antes que pelear, pero no le tiembla el pulso.' },
    tomas: { style: 'Equilibrado', text: 'Mecánico antes de todo esto. Lleva años arreglando lo que otros rompen y aguanta más de lo que aparenta.' }
  };
  // consejos de la pantalla de carga
  const TIPS = [
    'En el refugio se puede apuntar, pero no disparar ni golpear.',
    'Si sales en medio de un enfrentamiento, la carrera se pierde. Desde el refugio, se guarda.',
    'Las mejoras de las armas duran toda la carrera; una carrera nueva empieza sin ninguna.',
    'Estabilidad quita parte del retroceso y del movimiento de la mira; después, Retroceso los deja al mínimo.',
    'Los chasqueadores no ven: agachada y sin correr puedes llegar a su espalda.',
    'Al temblante se le puede golpear, pero tumbarlo a golpes es casi imposible: mejor fuego y explosivos.',
    'Las chocolatinas que sueltan los infectados curan un poco al cogerlas (con la vida llena no se cogen).',
    'Desde la segunda oleada del asalto, al despejar cada oleada aparece un maletín con suministros.',
    'En la caza no hace falta acabar con todos: aguanta hasta que se termine el tiempo.',
    'Con polvo reactivo y clavos fabricas una mina; con polvo reactivo y un trapo, una bomba de humo.'
  ];
  const ICON = { x: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><path d="M6.8 6.8 L13.2 13.2 M13.2 6.8 L6.8 13.2"/></svg>',
    o: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/><circle cx="10" cy="10" r="4"/></svg>',
    lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="1"/><path d="M7 9 V6.5 A3 3 0 0 1 13 6.5 V9"/></svg>' };

  const M = {
    active: true, stage: 'title', charId: 'vera', mode: 'retorno',
    sel: { main: 0, mode: 0, char: 0 }
  };
  let root, cv, ctx, cb = {}, scene = Shore, built = null, t0 = performance.now(), lastDraw = 0, padPrev = [], busy = false, loadingOn = false;

  function init(callbacks) {
    cb = callbacks || {};
    root = el('start');
    if (!root) return;
    try { const c = localStorage.getItem('ceniza.personaje'); if (c && G.Player.CHARS[c]) M.charId = c; } catch (e) { /* nada */ }
    root.className = 'screen mn';
    root.innerHTML =
      '<canvas class="mn-bg"></canvas>' +
      '<div class="mn-st mn-title"><div class="mn-logo">PROYECTO RETORNO</div><div class="mn-press">Presiona cualquier botón</div></div>' +
      '<div class="mn-st mn-main hidden"><h1>Proyecto Retorno</h1><ul class="mn-list"></ul><p class="mn-note"></p></div>' +
      '<div class="mn-st mn-mode hidden"><div class="mn-tabs"><span>Proyecto Retorno</span><b>Nueva partida</b></div><div class="mn-cols"><ul class="mn-list"></ul><div class="mn-desc"></div></div></div>' +
      '<div class="mn-st mn-char hidden"><h2>Selección de personaje</h2><ul class="mn-list"></ul>' +
        '<div class="mn-info"><h3>Inventario</h3><div class="mn-inv"></div><h3>Estilo de juego</h3><p class="mn-style"></p></div><div class="mn-bio"><h3>Historia</h3><p></p></div></div>' +
      '<div class="mn-foot hidden"></div>' +
      '<div class="mn-tip hidden"></div>' +
      '<div class="mn-fade"></div>';
    cv = root.querySelector('.mn-bg'); ctx = cv.getContext('2d');
    buildMain();
    root.querySelector('.mn-mode .mn-list').innerHTML = MODES.map((m, i) => '<li><button type="button" data-i="' + i + '"' + (m.soon ? ' class="soon"' : '') + '>' + (m.soon ? ICON.lock : '') + m.name + (m.soon ? '<small>Próximamente</small>' : '') + '</button></li>').join('');
    root.querySelector('.mn-char .mn-list').innerHTML = Object.keys(G.Player.CHARS).map((id, i) => '<li><button type="button" data-i="' + i + '" data-c="' + id + '">' + G.Player.CHARS[id].name + '</button></li>').join('');
    M.sel.char = Math.max(0, Object.keys(G.Player.CHARS).indexOf(M.charId));
    for (const st of ['main', 'mode', 'char']) {
      const list = root.querySelector('.mn-' + st + ' .mn-list');
      list.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b || busy) return; M.sel[st] = +b.dataset.i; mark(); confirm(); });
      list.addEventListener('pointerover', (e) => { const b = e.target.closest('button[data-i]'); if (b && e.pointerType === 'mouse') { M.sel[st] = +b.dataset.i; mark(); } });
    }
    root.querySelector('.mn-foot').addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b || busy) return; if (b.dataset.a === 'ok') confirm(); else back(); });
    // portada: cualquier tecla, toque o botón del mando
    const any = (e) => {
      if (!M.active || M.stage !== 'title' || busy || loadingOn) return;
      if (e && e.type === 'keydown' && (e.repeat || e.code === 'F12')) return;
      first();
    };
    root.addEventListener('pointerdown', (e) => { if (M.stage === 'title') { e.preventDefault(); any(e); } });
    window.addEventListener('keydown', (e) => {
      if (!M.active || loadingOn || (G.HudEdit && G.HudEdit.editing) || (G.PauseMenu && G.PauseMenu.handlesKeys)) return;
      if (M.stage === 'title') { any(e); e.preventDefault(); return; }
      onKey(e);
    });
    window.addEventListener('resize', () => { built = null; });
    show('title', true);
    requestAnimationFrame(tick);
  }

  // menú principal: «Continuar» solo si hay una carrera guardada (si se perdió por salir a mitad de un
  // enfrentamiento, se avisa una vez y se borra)
  let mainList = MAIN, lostNote = null;
  function buildMain() {
    const info = G.Run ? G.Run.saveInfo() : null;
    if (info && info.lost) { lostNote = 'Tu carrera anterior se perdió: saliste en medio de un enfrentamiento.'; G.Run.discard(); }
    const can = !!(info && !info.lost);
    mainList = MAIN.filter((m) => m.id !== 'cont' || can);
    const c = MAIN[0];
    if (can) c.note = 'Continúa tu carrera de Retorno desde el refugio (' + ((G.Player.CHARS[info.char] || {}).name || '') + ', enfrentamiento ' + Math.min(5, info.step + 1) + ' de 5).';
    root.querySelector('.mn-main .mn-list').innerHTML = mainList.map((m, i) => '<li><button type="button" data-i="' + i + '"' + (m.soon ? ' class="soon"' : '') + '>' + m.name + '</button></li>').join('');
    M.sel.main = Math.min(M.sel.main, mainList.length - 1);
  }

  function first() {
    if (cb.onFirst) cb.onFirst();
    go('main');
  }

  // ---------- Navegación ----------
  function show(stage, instant) {
    M.stage = stage;
    if (stage === 'main') buildMain();
    for (const s of ['title', 'main', 'mode', 'char']) root.querySelector('.mn-' + s).classList.toggle('hidden', s !== stage);
    scene = stage === 'title' ? Shore : Shop;
    root.classList.toggle('blur', stage === 'mode');
    root.classList.toggle('three', stage === 'char');
    const foot = root.querySelector('.mn-foot');
    foot.classList.toggle('hidden', stage === 'title');
    foot.innerHTML = stage === 'char'
      ? '<button type="button" data-a="ok">' + ICON.x + 'Iniciar partida</button><button type="button" data-a="back">' + ICON.o + 'Atrás</button>'
      : '<button type="button" data-a="ok">' + ICON.x + 'Seleccionar</button><button type="button" data-a="back">' + ICON.o + 'Atrás</button>';
    mark();
  }
  // cambio de pantalla con un fundido a negro
  function go(stage) {
    if (busy) return;
    busy = true;
    const f = root.querySelector('.mn-fade');
    f.classList.add('on');
    setTimeout(() => { show(stage); f.classList.remove('on'); setTimeout(() => { busy = false; }, 200); }, 320);
  }
  function mark() {
    const st = M.stage;
    if (st === 'title') return;
    const list = root.querySelectorAll('.mn-' + st + ' .mn-list button');
    list.forEach((b, i) => b.classList.toggle('sel', i === M.sel[st]));
    if (st === 'main') {
      const m = mainList[M.sel.main], n = root.querySelector('.mn-main .mn-note');
      n.classList.toggle('warn', !!m.soon || !!lostNote);
      n.textContent = lostNote || (m.soon ? m.name + ': todavía no está disponible.' : m.note);
    } else if (st === 'mode') {
      const m = MODES[M.sel.mode];
      const has = m.id === 'retorno' && G.Run && G.Run.saveInfo();
      root.querySelector('.mn-desc').innerHTML = m.desc.map((p) => '<p>' + p + '</p>').join('') + (has ? '<p class="warn">Tienes una carrera guardada: si empiezas una nueva, se borrará.</p>' : '');
    } else if (st === 'char') {
      const id = Object.keys(G.Player.CHARS)[M.sel.char];
      M.charId = id;
      const bio = BIO[id] || BIO.vera;
      root.querySelector('.mn-style').textContent = bio.style;
      root.querySelector('.mn-bio p').textContent = bio.text;
      const inv = M.mode === 'retorno' ? ['pistola'] : ['navaja'];
      root.querySelector('.mn-inv').innerHTML = inv.map((k) => { const u = G.Icons && G.Icons.white(k); return u ? '<img alt="" src="' + u + '">' : ''; }).join('');
    }
  }
  function confirm() {
    const st = M.stage;
    if (st === 'main') {
      const m = mainList[M.sel.main];
      lostNote = null;
      if (m.soon) { nudge('.mn-main .mn-note'); return; }
      if (m.id === 'cont') {
        const info = G.Run && G.Run.saveInfo();
        if (!info || info.lost) { buildMain(); mark(); return; }
        if (cb.onConfirm) cb.onConfirm();
        M.mode = 'retorno';
        startLoading(() => { if (cb.onStart) cb.onStart('retorno', info.char, true); }, null, { min: 3.4, tip: true });
        return;
      }
      if (m.id === 'new') go('mode');
      else if (m.id === 'opts' && G.PauseMenu && G.PauseMenu.openOptions) G.PauseMenu.openOptions(() => {});
      else if (m.id === 'retos' && G.PauseMenu && G.PauseMenu.openChallenges) G.PauseMenu.openChallenges(() => {});
    } else if (st === 'mode') {
      const m = MODES[M.sel.mode];
      if (m.soon) { nudge('.mn-desc'); return; }
      M.mode = m.id;
      go('char');
    } else if (st === 'char') {
      try { localStorage.setItem('ceniza.personaje', M.charId); } catch (e) { /* nada */ }
      if (cb.onConfirm) cb.onConfirm();          // gesto del usuario: captura del ratón, pantalla completa
      startLoading(() => { if (cb.onStart) cb.onStart(M.mode, M.charId); }, null, { min: 3.4, tip: true });
    }
  }
  function back() {
    const st = M.stage;
    if (st === 'main') go('title');
    else if (st === 'mode') go('main');
    else if (st === 'char') go('mode');
  }
  function nudge(sel) { const n = root.querySelector(sel); if (!n) return; n.classList.remove('nudge'); void n.offsetWidth; n.classList.add('nudge'); }
  function count(st) { return st === 'main' ? mainList.length : (st === 'mode' ? MODES.length : Object.keys(G.Player.CHARS).length); }
  function move(d) { const st = M.stage, n = count(st); M.sel[st] = (M.sel[st] + d + n) % n; mark(); }
  function onKey(e) {
    if (busy) return;
    const c = e.code;
    let used = true;
    if (c === 'ArrowDown' || c === 'KeyS') move(1);
    else if (c === 'ArrowUp' || c === 'KeyW') move(-1);
    else if (c === 'Enter' || c === 'Space') confirm();
    else if (c === 'Escape' || c === 'Backspace') back();
    else used = false;
    if (used) e.preventDefault();
  }
  function pollPad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads(); let p = null;
    for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    if (!p) return;
    const now = p.buttons.map((b) => !!(b && b.pressed));
    const edge = (i) => now[i] && !padPrev[i];
    const anyEdge = now.some((v, i) => v && !padPrev[i]);
    padPrev = now;
    if (busy || loadingOn || (G.PauseMenu && G.PauseMenu.handlesKeys)) return;
    if (M.stage === 'title') { if (anyEdge) first(); return; }
    if (edge(0)) confirm();
    else if (edge(1)) back();
    else if (edge(12)) move(-1);
    else if (edge(13)) move(1);
  }

  // ---------- Carga ----------
  const LOAD_MIN = 1.8;
  // opts: { min (segundos que dura como mínimo), tip (un consejo abajo) }. Sin «after», al terminar se quita
  // la pantalla y el juego aparece desde negro (onLoaded)
  function startLoading(work, after, opts) {
    opts = opts || {};
    loadingOn = true; busy = true;
    const f = root.querySelector('.mn-fade');
    f.classList.add('on');
    const tip = root.querySelector('.mn-tip');
    tip.classList.add('hidden'); tip.classList.remove('in');
    setTimeout(() => {
      if (opts.tip) { tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; tip.classList.remove('hidden'); setTimeout(() => tip.classList.add('in'), 500); }
      for (const s of ['title', 'main', 'mode', 'char']) root.querySelector('.mn-' + s).classList.add('hidden');
      root.querySelector('.mn-foot').classList.add('hidden');
      root.classList.remove('blur', 'three');
      root.classList.remove('hidden');
      scene = Spores; built = null; M.active = true;
      f.classList.remove('on');
      const t1 = performance.now();
      // deja que se vea la carga un momento antes del trabajo pesado (que congela la imagen)
      setTimeout(() => {
        try { work(); } catch (e) { console.error(e); }
        const wait = Math.max(0.4, (opts.min || LOAD_MIN) - (performance.now() - t1) / 1000);
        setTimeout(() => {
          f.classList.add('on');
          setTimeout(() => {
            tip.classList.add('hidden'); tip.classList.remove('in');
            if (after) after();
            else { M.active = false; root.classList.add('hidden'); if (cb.onLoaded) cb.onLoaded(); }
            loadingOn = false; busy = false;
            f.classList.remove('on');
          }, 380);
        }, wait * 1000);
      }, 700);
    }, 340);
  }

  // ---------- Fondo animado ----------
  function tick(ts) {
    requestAnimationFrame(tick);
    document.body.classList.toggle('in-menu', !!(M.active && root && !root.classList.contains('hidden')));
    if (!M.active || !root || root.classList.contains('hidden')) return;
    pollPad();
    if (M.stage === 'char' && !loadingOn) return;            // el personaje lo dibuja el 3D
    if (ts - lastDraw < 1000 / 31) return;                   // 30 imágenes por segundo bastan
    lastDraw = ts;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; built = null; }
    if (built !== scene) { scene.build(W, H); built = scene; }
    scene.draw(ctx, W, H, (ts - t0) / 1000);
  }

  G.Menus = {
    init,
    get active() { return M.active; },
    get stage() { return M.stage; },
    get covering() { return M.active && !!root && !root.classList.contains('hidden') && !(M.stage === 'char' && !loadingOn); },
    get wants3d() { return M.active && M.stage === 'char' && !loadingOn && !!root && !root.classList.contains('hidden'); },
    render3d(renderer, dt) { render3d(renderer, dt, (performance.now() - t0) / 1000); },
    // volver al menú principal (tras morir o terminar): carga breve y el taller
    toMain(work) {
      M.active = true;
      root.classList.remove('hidden');
      startLoading(work || (() => {}), () => { show('main'); });
    },
    loading: startLoading,
    hide() { M.active = false; if (root) root.classList.add('hidden'); },
    get _busy() { return [busy, loadingOn]; }
  };
})(window.Game = window.Game || {});
