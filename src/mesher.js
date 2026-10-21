(function (G) {
  'use strict';

  // Acumula muchas piezas (cajas, cilindros, esferas, triángulos) en UNA sola
  // geometría con colores por vértice. Así un chunk entero o un personaje se
  // dibuja con muy pocas llamadas de dibujo, que es lo que más cuesta en móviles.

  const colorCache = new Map();
  function lin(hex) {
    let c = colorCache.get(hex);
    if (!c) { c = new THREE.Color(hex).convertSRGBToLinear(); colorCache.set(hex, c); }
    return c;
  }

  const prims = {};
  function prim(key, make) {
    if (!prims[key]) { const g = make(); prims[key] = g.index ? g.toNonIndexed() : g; }
    return prims[key];
  }

  const _m = new THREE.Matrix4();
  const _n = new THREE.Matrix3();
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _e = new THREE.Euler();

  class Mesher {
    constructor(skinned) {
      this.pos = [];
      this.nor = [];
      this.col = [];
      this.skinned = !!skinned;
      this.si = [];
      this.ws = null;       // pesos explícitos por vértice (superficies continuas del protagonista)
      this.oy = 0;          // desplazamiento vertical de todo lo que se añade (altura del terreno o de la base de un edificio)
    }

    // Añade una geometría de Three.js transformada por "matrix"
    add(geo, matrix, hex, bone, jitter) {
      const c = lin(hex);
      const p = geo.attributes.position.array;
      const n = geo.attributes.normal.array;
      _n.getNormalMatrix(matrix);
      const jr = jitter ? 1 + (Math.random() - 0.5) * jitter : 1;
      for (let i = 0; i < p.length; i += 3) {
        _v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(matrix);
        this.pos.push(_v.x, _v.y, _v.z);
        _v.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(_n).normalize();
        this.nor.push(_v.x, _v.y, _v.z);
        this.col.push(c.r * jr, c.g * jr, c.b * jr);
        if (this.skinned) this.si.push(bone | 0);
      }
    }

    mat(x, y, z, sx, sy, sz, rx, ry, rz) {
      _e.set(rx || 0, ry || 0, rz || 0);
      _q.setFromEuler(_e);
      _p.set(x, y + this.oy, z);
      _s.set(sx, sy, sz);
      return _m.compose(_p, _q, _s);
    }

    // Caja centrada en (x, y, z)
    box(x, y, z, w, h, d, hex, ry, bone, rx, rz) {
      const g = prim('box', () => new THREE.BoxGeometry(1, 1, 1));
      this.add(g, this.mat(x, y, z, w, h, d, rx, ry, rz), hex, bone);
    }

    // Cilindro vertical centrado; r0 abajo, r1 arriba
    cyl(x, y, z, r0, r1, h, hex, seg, bone, rx, ry, rz) {
      seg = seg || 8;
      const key = 'cyl' + seg + '_' + (r0 / r1).toFixed(3);
      const g = prim(key, () => new THREE.CylinderGeometry(r1 / Math.max(r0, r1), r0 / Math.max(r0, r1), 1, seg));
      const s = Math.max(r0, r1);
      this.add(g, this.mat(x, y, z, s, h, s, rx, ry, rz), hex, bone);
    }

    // Esfera (o elipsoide) centrada
    sphere(x, y, z, sx, sy, sz, hex, detail, bone) {
      detail = detail || 1;
      const g = prim('ico' + detail, () => new THREE.IcosahedronGeometry(1, detail));
      this.add(g, this.mat(x, y, z, sx, sy, sz), hex, bone);
    }

    // Cono (para copas de árbol o puntas)
    cone(x, y, z, r, h, hex, seg, rx, ry, rz, bone) {
      seg = seg || 7;
      const g = prim('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg));
      this.add(g, this.mat(x, y, z, r, h, r, rx, ry, rz), hex, bone);
    }

    // Triángulo con normal calculada
    tri(a, b, c, hex) {
      const col = lin(hex);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (const p of [a, b, c]) {
        this.pos.push(p[0], p[1] + this.oy, p[2]);
        this.nor.push(nx, ny, nz);
        this.col.push(col.r, col.g, col.b);
        if (this.skinned) this.si.push(0);
      }
    }

    quad(a, b, c, d, hex) {
      this.tri(a, b, c, hex);
      this.tri(a, c, d, hex);
    }

    // Vértice suelto con normal, color lineal [r, g, b] y pesos [hueso, peso, ...] (hasta 4 huesos).
    // Se usa para superficies continuas (torso, brazos y piernas de una pieza) con normales suaves.
    vert(p, n, c, w) {
      this.pos.push(p[0], p[1] + this.oy, p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(c[0], c[1], c[2]);
      if (this.skinned) {
        if (!this.ws) this.ws = [];
        this.ws[this.si.length] = w;
        this.si.push(w[0] | 0);
      }
    }

    get count() {
      return this.pos.length / 3;
    }

    // weightFn(x, y, z, hueso) puede devolver [huesoA, pesoA, huesoB, pesoB] para
    // repartir un vértice entre dos huesos (piel suave en las articulaciones)
    build(weightFn) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (this.skinned) {
        const n = this.si.length;
        const idx = new Uint16Array(n * 4);
        const w = new Float32Array(n * 4);
        const P = this.pos;
        for (let i = 0; i < n; i++) {
          const ew = this.ws && this.ws[i];
          if (ew) {
            for (let k = 0; k < 4; k++) { idx[i * 4 + k] = ew[k * 2] || 0; w[i * 4 + k] = ew[k * 2 + 1] || 0; }
            continue;
          }
          const r = weightFn ? weightFn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], this.si[i]) : null;
          if (r) { idx[i * 4] = r[0]; w[i * 4] = r[1]; idx[i * 4 + 1] = r[2]; w[i * 4 + 1] = r[3]; }
          else { idx[i * 4] = this.si[i]; w[i * 4] = 1; }
        }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
      }
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    }
  }

  G.Mesher = Mesher;
  G.Mesher.lin = lin;
})(window.Game = window.Game || {});
