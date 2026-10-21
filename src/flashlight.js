(function (G) {
  'use strict';

  // Linterna (sencilla): no se ve en el personaje; alumbra justo hacia donde mira la cámara, un círculo del mismo
  // tamaño que la mira de la escopeta cuando corres con ella, siempre en el centro de la pantalla. Se enciende y
  // se apaga con L, el botón de la linterna (táctil) o la cruceta derecha del mando. A los infectados les da
  // igual: no la ven ni la oyen. La luz existe siempre (apagada = intensidad 0): crearla o quitarla da tirones

  // radio del círculo (radianes): la mira de la escopeta apuntando y corriendo (dispersión 0,056 × 2,19 × 0,75)
  const ANGLE = 0.092;
  const COLOR = 0xfff1d6, INTENSITY = 10, DIST = 32, PENUMBRA = 0.18, DECAY = 1.1;
  let scene = null, player = null, light = null, target = null;
  let on = false, level = 0;
  // El suelo y las paredes se iluminan por vértice (son losas grandes): una luz pequeña como la de la
  // linterna casi no se notaría. Por eso, además de la luz, se pinta el círculo de luz donde da el haz
  let pool = null, poolMesh = null, poolMat = null;
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();

  function poolTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    // círculo de borde bastante definido (como el de la mira)
    g.addColorStop(0, 'rgba(255,246,224,1)'); g.addColorStop(0.7, 'rgba(255,240,210,0.85)');
    g.addColorStop(0.88, 'rgba(255,234,200,0.45)'); g.addColorStop(1, 'rgba(255,228,190,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  // hasta dónde llega el haz: el suelo, una pared o la parte de arriba de un mueble
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function castBeam(o, d, lv) {
    const W = G.World, step = 0.2, max = 18;
    _a.copy(o);
    for (let t = step; t <= max; t += step) {
      _b.copy(o).addScaledVector(d, t);
      if (W.lineHit(_a.x, _a.z, _b.x, _b.z, W.blocksSightEdge, lv) >= 0) {
        // pared: cuál de las dos líneas de la cuadrícula cruzó
        const nx = Math.floor(_a.x) !== Math.floor(_b.x), nz = Math.floor(_a.z) !== Math.floor(_b.z);
        const alongX = nx && (!nz || Math.abs(d.x) > Math.abs(d.z));
        const p = _a.clone();
        if (alongX) p.x = d.x > 0 ? Math.floor(_b.x) - 0.03 : Math.floor(_a.x) + 0.03;
        else p.z = d.z > 0 ? Math.floor(_b.z) - 0.03 : Math.floor(_a.z) + 0.03;
        return { p, t, wall: alongX ? 'x' : 'z' };
      }
      const gy = W.groundY(_b.x, _b.z, lv), top = W.furnTop(_b.x, _b.z, lv, 0.1);
      const fy = Math.max(gy, top || 0);
      if (_b.y <= fy) { _b.y = fy + 0.015; return { p: _b.clone(), t, wall: null }; }
      _a.copy(_b);
    }
    return null;
  }

  const Flashlight = {
    init(sc, pl) {
      scene = sc; player = pl;
      light = new THREE.SpotLight(COLOR, 0, DIST, ANGLE, PENUMBRA, DECAY);
      light.castShadow = false;
      target = new THREE.Object3D();
      scene.add(target);
      light.target = target;
      light.position.set(0, -50, 0);
      scene.add(light);
      poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
        polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -4 });
      poolMat.toneMapped = false;
      pool = new THREE.Group();
      poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat);
      poolMesh.renderOrder = -1;          // antes que los transparentes (el personaje se dibuja encima)
      pool.add(poolMesh);
      pool.visible = false;
      scene.add(pool);
    },
    get on() { return on; },
    toggle() {
      on = !on;
      if (G.Audio) G.Audio.play('flashlight');
      const b = document.getElementById('btn-light');
      if (b) b.classList.toggle('on', on);
      return on;
    },
    off() { if (on) this.toggle(); },
    update(dt, cam) {
      if (!light || !player) return;
      // se enciende y se apaga con un parpadeo corto
      const want = on && !player.dead ? 1 : 0;
      level += (want - level) * Math.min(1, dt * 18);
      if (level < 0.01 && !want) level = 0;
      light.intensity = INTENSITY * level;
      if (level <= 0) { light.position.set(player.pos.x, -50, player.pos.z); target.position.set(player.pos.x, -60, player.pos.z); pool.visible = false; return; }
      // desde la cámara, justo hacia donde mira (el círculo queda en el centro de la pantalla)
      _p.copy(cam.pos);
      _d.copy(cam.dir).normalize();
      light.position.copy(_p);
      target.position.copy(_p).addScaledVector(_d, 10);
      target.updateMatrixWorld();
      // el círculo de luz donde da el haz
      const hit = castBeam(light.position, _d, player.lv || 0);
      if (!hit) { pool.visible = false; return; }
      const r = Math.max(0.12, hit.t * Math.tan(ANGLE));
      pool.visible = true;
      pool.position.copy(hit.p);
      if (hit.wall) {
        // en la pared: de cara a la linterna
        pool.rotation.set(0, hit.wall === 'x' ? (_d.x > 0 ? -Math.PI / 2 : Math.PI / 2) : (_d.z > 0 ? Math.PI : 0), 0);
        poolMesh.rotation.set(0, 0, 0);
        poolMesh.scale.set(r * 2, r * 2, 1);
      } else {
        // en el suelo: alargado en la dirección del haz cuanto más rasante llega
        pool.rotation.set(0, Math.atan2(_d.x, _d.z), 0);
        poolMesh.rotation.set(-Math.PI / 2, 0, 0);
        poolMesh.scale.set(r * 2, r * 2 * Math.min(3, 1 / Math.max(0.2, -_d.y)), 1);
      }
      poolMat.opacity = level * 0.6 * Math.max(0.2, 1 - hit.t / 30);
    }
  };

  G.Flashlight = Flashlight;
})(window.Game = window.Game || {});
