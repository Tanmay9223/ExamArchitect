import { useEffect, useRef } from 'react';

/* ── City data (lat, lon) ────────────────────────────────────────────── */
const CITIES = [
  { lat: 37.77,  lon: -122.42, label: 'San Francisco', color: '#f43f5e' },
  { lat: 40.71,  lon: -74.01,  label: 'New York',      color: '#f43f5e' },
  { lat: 51.51,  lon: -0.13,   label: 'London',        color: '#10b981' },
  { lat: 35.68,  lon: 139.65,  label: 'Tokyo',         color: '#a855f7' },
  { lat: 12.97,  lon: 77.59,   label: 'Bengaluru',     color: '#ec4899' },
  { lat: -33.87, lon: 151.21,  label: 'Sydney',        color: '#06b6d4' },
  { lat: 48.86,  lon: 2.35,    label: 'Paris',         color: '#10b981' },
  { lat: 1.35,   lon: 103.82,  label: 'Singapore',     color: '#ec4899' },
  { lat: 25.20,  lon: 55.27,   label: 'Dubai',         color: '#06b6d4' },
  { lat: -23.55, lon: -46.63,  label: 'São Paulo',     color: '#f59e0b' },
];

/* ── Arc connections (indices into CITIES) ───────────────────────────── */
const ARCS = [
  [0, 2, '#a855f7'], [1, 4, '#818cf8'], [2, 3, '#ec4899'],
  [4, 5, '#06b6d4'], [3, 0, '#f59e0b'], [6, 1, '#10b981'],
  [2, 8, '#06b6d4'], [7, 4, '#ec4899'], [6, 7, '#10b981'],
  [0, 9, '#f59e0b'], [5, 3, '#a855f7'],
];

/* ── Helpers ──────────────────────────────────────────────────────────── */
function toRadians(deg) { return deg * Math.PI / 180; }

/** Project a (lat, lon) on the rotating globe to canvas (x, y, visible) */
function project(lat, lon, rotY, cx, cy, R) {
  const phi   = toRadians(90 - lat);
  const theta = toRadians(lon) + rotY;
  // 3D coords on unit sphere
  const x3 = Math.sin(phi) * Math.cos(theta);
  const y3 = Math.cos(phi);
  const z3 = Math.sin(phi) * Math.sin(theta);
  // Orthographic projection (slight tilt: rotate x by 20°)
  const tilt = toRadians(20);
  const yp = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
  const zp = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
  return {
    x: cx + x3 * R,
    y: cy - yp * R,
    z: zp,           // >0 = front hemisphere
    visible: zp > -0.05,
  };
}

export default function GithubGlobe({ width = 460, height = 460 }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ rotY: 0.8, dragging: false, lx: 0, velY: 0, raf: null });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const cx = width  / 2;
    const cy = height / 2;
    const R  = Math.min(width, height) * 0.40;

    let t = 0;
    let lastTs = null;
    const s = stateRef.current;

    /* ── Grid line data (precomputed, static relative to sphere) ───────── */
    const latLines = [];
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts = [];
      for (let lon = 0; lon <= 360; lon += 4) pts.push([lat, lon]);
      latLines.push(pts);
    }
    const lonLines = [];
    for (let lon = 0; lon < 360; lon += 15) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push([lat, lon]);
      lonLines.push(pts);
    }

    /* ── Draw one frame ─────────────────────────────────────────────────── */
    function draw(ts) {
      s.raf = requestAnimationFrame(draw);
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016; // cap at 50ms
      lastTs = ts;
      t += dt;

      // Auto-rotate + inertia
      if (!s.dragging) {
        s.velY = s.velY * 0.92 + 0.28 * dt; // gentle auto-spin
        s.rotY += s.velY;
      }

      ctx.clearRect(0, 0, width, height);

      /* Globe base sphere */
      const grad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      grad.addColorStop(0, 'rgba(30,40,90,0.92)');
      grad.addColorStop(1, 'rgba(8,10,28,0.88)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Atmosphere glow */
      const atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      atm.addColorStop(0, 'rgba(129,140,248,0.12)');
      atm.addColorStop(0.5, 'rgba(99,102,241,0.06)');
      atm.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
      ctx.fillStyle = atm;
      ctx.fill();

      /* Clip to globe circle for all interior drawing */
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();

      /* Grid lines */
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(99,102,241,0.18)';
      for (const pts of latLines) {
        ctx.beginPath();
        let first = true;
        for (const [la, lo] of pts) {
          const p = project(la, lo, s.rotY, cx, cy, R);
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.stroke();
      }
      for (const pts of lonLines) {
        ctx.beginPath();
        let first = true;
        for (const [la, lo] of pts) {
          const p = project(la, lo, s.rotY, cx, cy, R);
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.stroke();
      }

      /* Arcs (animated dashes travelling along great-circle arcs) */
      for (let i = 0; i < ARCS.length; i++) {
        const [ai, bi, color] = ARCS[i];
        const A = CITIES[ai], B = CITIES[bi];
        const steps = 60;
        const phase = (t * 0.4 + i / ARCS.length) % 1;
        const dashLen = 0.18;

        // Sample arc points
        const arcPts = [];
        for (let k = 0; k <= steps; k++) {
          const frac = k / steps;
          // Spherical interpolation (SLERP simplified via great-circle intermediate)
          const la  = A.lat + (B.lat - A.lat) * frac;
          const lo  = A.lon + (B.lon - A.lon) * frac;
          const arc = 0.22 * Math.sin(frac * Math.PI); // lift off globe
          const p   = project(la, lo, s.rotY, cx, cy, R * (1 + arc));
          arcPts.push({ ...p, frac });
        }

        ctx.lineWidth = 1.2;
        for (let k = 0; k < arcPts.length - 1; k++) {
          const frac = arcPts[k].frac;
          const dist = Math.abs(((frac - phase + 1) % 1));
          const inDash = dist < dashLen || dist > (1 - dashLen * 0.4);
          if (!inDash) continue;
          if (!arcPts[k].visible || !arcPts[k + 1].visible) continue;
          const alpha = 1 - dist / dashLen;
          ctx.beginPath();
          ctx.moveTo(arcPts[k].x, arcPts[k].y);
          ctx.lineTo(arcPts[k + 1].x, arcPts[k + 1].y);
          ctx.strokeStyle = color + Math.round(Math.max(0.1, alpha) * 255).toString(16).padStart(2, '0');
          ctx.stroke();
        }
      }

      /* City dots + pulsing rings */
      for (let i = 0; i < CITIES.length; i++) {
        const city = CITIES[i];
        const p = project(city.lat, city.lon, s.rotY, cx, cy, R);
        if (!p.visible) continue;
        const pulse = (t * 1.1 + i * 0.4) % 1;

        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + pulse * 10, 0, Math.PI * 2);
        ctx.strokeStyle = city.color + Math.round((1 - pulse) * 100).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        ctx.stroke();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = city.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.restore();

      /* Specular highlight on top-left */
      const spec = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.35, 0, cx - R * 0.38, cy - R * 0.35, R * 0.55);
      spec.addColorStop(0, 'rgba(255,255,255,0.07)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();
    }

    s.raf = requestAnimationFrame(draw);

    /* ── Drag interaction ─────────────────────────────────────────────── */
    const el = canvas;
    const onDown = (e) => {
      s.dragging = true;
      s.velY = 0;
      s.lx = e.touches ? e.touches[0].clientX : e.clientX;
      el.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!s.dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = x - s.lx;
      s.rotY += dx * 0.007;
      s.velY = dx * 0.007;
      s.lx = x;
    };
    const onUp = () => {
      s.dragging = false;
      el.style.cursor = 'grab';
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(s.raf);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'grab', borderRadius: '50%', display: 'block' }}
    />
  );
}
