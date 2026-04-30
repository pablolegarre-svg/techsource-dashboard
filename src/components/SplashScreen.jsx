import { useEffect, useRef, useState } from "react";

// ─── Constantes ────────────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id:       i,
  left:     Math.random() * 100,
  size:     1 + Math.random() * 2.5,
  duration: 4 + Math.random() * 6,
  delay:    Math.random() * 5,
}));

const PROGRESS_STEPS = [
  { value: 0,   label: "Iniciando...",              delay: 0    },
  { value: 28,  label: "Verificando credenciales…", delay: 600  },
  { value: 55,  label: "Cargando catálogo…",        delay: 1400 },
  { value: 78,  label: "Sincronizando precios…",    delay: 2400 },
  { value: 100, label: "Listo",                     delay: 3400 },
];

// ─── Componente ────────────────────────────────────────────────────────────────

export default function SplashScreen({ onEnter }) {
  const [progress,    setProgress]   = useState(0);
  const [statusLabel, setStatus]     = useState("Iniciando...");
  const [showEnter,   setShowEnter]  = useState(false);

  // Fases de la transición de salida:
  // "idle" → "exiting" (splash zoom+blur) → "wiping" (cortina barre) → "done" (llama onEnter)
  const [phase, setPhase] = useState("idle");

  const rafRef = useRef(null);

  // ── Progreso animado ────────────────────────────────────────────────────────
  useEffect(() => {
    const timers = [];

    PROGRESS_STEPS.forEach(({ value, label, delay }, idx) => {
      timers.push(
        setTimeout(() => {
          setStatus(label);
          const startVal = idx === 0 ? 0 : PROGRESS_STEPS[idx - 1].value;
          const duration = 600;
          const start    = performance.now();

          const animate = (now) => {
            const t    = Math.min((now - start) / duration, 1);
            const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            setProgress(Math.round(startVal + (value - startVal) * ease));
            if (t < 1) rafRef.current = requestAnimationFrame(animate);
          };
          rafRef.current = requestAnimationFrame(animate);
        }, delay)
      );
    });

    timers.push(setTimeout(() => setShowEnter(true), 4200));

    return () => {
      timers.forEach(clearTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Transición de salida ────────────────────────────────────────────────────
  const handleEnter = () => {
    if (phase !== "idle") return;

    setPhase("exiting");              // Fase 1: splash hace zoom y se desvanece
    setTimeout(() => setPhase("wiping"), 350);  // Fase 2: cortina entra a los 350ms
    setTimeout(() => {
      setPhase("done");
      onEnter?.();                    // Fase 3: llama onEnter cuando la cortina cubrió todo
    }, 1050);
  };

  if (phase === "done") return null;

  return (
    <div style={S.root}>

      {/* ── Fondo ── */}
      <div style={S.grid} />
      <div className="ts-glow" style={S.glow} />
      <div className="ts-scan" style={S.scan} />

      {/* Esquinas decorativas */}
      {["tl", "tr", "bl", "br"].map(pos => (
        <div key={pos} style={{ ...S.corner, ...S[`corner_${pos}`] }} />
      ))}

      {/* Partículas flotantes */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="ts-particle"
          style={{
            ...S.particle,
            left:              `${p.left}%`,
            width:             `${p.size}px`,
            height:            `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        />
      ))}

      {/* ── Contenido principal ── */}
      <div
        className={phase === "exiting" || phase === "wiping" ? "ts-splash-exit" : ""}
        style={S.content}
      >
        {/* Logo */}
        <div style={S.logoRow}>
          <div style={S.iconWrap}>
            <div style={S.iconBg} />
            <div className="ts-orbit" style={S.iconOrbit} />
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={S.iconSvg}>
              <path
                d="M5 8L14 4L23 8V14C23 19 14 24 14 24C14 24 5 19 5 14V8Z"
                stroke="#378ADD" strokeWidth="1.5" fill="none"
              />
              <path
                d="M11 14L13 16L17 12"
                stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={S.divider} />
          <div>
            <div style={S.brandMain}>
              Tech<span style={S.brandAccent}>Source</span>
            </div>
            <div style={S.brandSub}>Supplier · Parts · Devices · Storage</div>
          </div>
        </div>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { num: "89", label: "Productos"  },
            { num: "8",  label: "Categorías" },
            { num: "3",  label: "Marcas"     },
          ].map(({ num, label }, i, arr) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <div style={S.stat}>
                <div style={S.statNum}>{num}</div>
                <div style={S.statLabel}>{label}</div>
              </div>
              {i < arr.length - 1 && <div style={S.statSep} />}
            </div>
          ))}
        </div>

        {/* Barra de progreso */}
        <div style={S.progressWrap}>
          <div style={S.progressLabels}>
            <span style={S.progressText}>{statusLabel}</span>
            <span style={S.progressText}>{progress}%</span>
          </div>
          <div style={S.track}>
            <div style={{ ...S.fill, width: `${progress}%` }} />
          </div>
        </div>

        {/* Estado */}
        <div style={S.statusRow}>
          <span className="ts-dot" style={S.dot} />
          <span style={S.statusText}>Catálogo actualizado · 28/4/2026</span>
        </div>

        {/* Botón */}
        <button
          className="ts-enter-btn"
          style={{
            ...S.enterBtn,
            opacity:       showEnter ? 1 : 0,
            transform:     showEnter ? "translateY(0)" : "translateY(10px)",
            pointerEvents: showEnter ? "auto" : "none",
          }}
          onClick={handleEnter}
        >
          Ingresar al catálogo →
        </button>
      </div>

      {/* ── Cortina de transición ── */}
      {(phase === "wiping" || phase === "done") && (
        <div className="ts-wipe" style={S.wipeOverlay}>
          <div style={S.wipeBg} />
          <div style={S.wipeLine} />
        </div>
      )}

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(0);        opacity: 0;   }
          8%   { opacity: 0.7; }
          92%  { opacity: 0.3; }
          100% { transform: translateY(-520px) scale(0.3); opacity: 0;   }
        }
        @keyframes orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes scanMove {
          0%   { top: 0;     opacity: 0;   }
          3%   { opacity: 1; }
          97%  { opacity: 0.4; }
          100% { top: 100vh; opacity: 0;   }
        }
        @keyframes glowPulse {
          0%,100% { transform: translate(-50%,-50%) scale(1);    opacity: 0.6; }
          50%     { transform: translate(-50%,-50%) scale(1.18); opacity: 1;   }
        }
        @keyframes blink {
          0%,100% { opacity: 1;   }
          50%     { opacity: 0.3; }
        }
        @keyframes contentIn {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes splashExit {
          0%   { transform: scale(1);    opacity: 1;   filter: blur(0px);  }
          60%  { transform: scale(1.06); opacity: 0.6; filter: blur(3px);  }
          100% { transform: scale(1.14); opacity: 0;   filter: blur(10px); }
        }
        @keyframes wipeIn {
          0%   { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0%   0 0); }
        }

        .ts-particle    { animation-name: floatUp;    animation-timing-function: linear;     animation-iteration-count: infinite; }
        .ts-orbit       { animation: orbit     3s  linear       infinite; }
        .ts-scan        { animation: scanMove  5s  linear    1s infinite; }
        .ts-glow        { animation: glowPulse 3s  ease-in-out  infinite; }
        .ts-dot         { animation: blink     1.5s ease-in-out infinite; }
        .ts-content-in  { animation: contentIn 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .ts-splash-exit { animation: splashExit 0.7s cubic-bezier(0.4,0,1,1) forwards; }
        .ts-wipe        { animation: wipeIn    0.7s cubic-bezier(0.4,0,0.2,1) forwards; }

        .ts-enter-btn { transition: background 0.2s, transform 0.4s, opacity 0.4s; }
        .ts-enter-btn:hover { background: #1e6fc2 !important; }
      `}</style>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    background:     "#0d1b2e",
    minHeight:      "100vh",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    position:       "relative",
    overflow:       "hidden",
    fontFamily:     "'Segoe UI', system-ui, sans-serif",
  },
  grid: {
    position:        "absolute",
    inset:           0,
    backgroundImage: [
      "linear-gradient(rgba(55,138,221,0.06) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(55,138,221,0.06) 1px, transparent 1px)",
    ].join(", "),
    backgroundSize: "48px 48px",
  },
  glow: {
    position:   "absolute",
    width:      "600px",
    height:     "340px",
    background: "radial-gradient(ellipse, rgba(55,138,221,0.13) 0%, transparent 70%)",
    top:        "50%",
    left:       "50%",
  },
  scan: {
    position:   "absolute",
    left:       0,
    right:      0,
    height:     "1px",
    background: "linear-gradient(90deg, transparent 0%, rgba(55,138,221,0.55) 50%, transparent 100%)",
  },
  corner: {
    position:    "absolute",
    width:       18,
    height:      18,
    borderColor: "rgba(55,138,221,0.45)",
    borderStyle: "solid",
  },
  corner_tl: { top: 14,    left:  14, borderWidth: "1px 0 0 1px" },
  corner_tr: { top: 14,    right: 14, borderWidth: "1px 1px 0 0" },
  corner_bl: { bottom: 14, left:  14, borderWidth: "0 0 1px 1px" },
  corner_br: { bottom: 14, right: 14, borderWidth: "0 1px 1px 0" },
  particle: {
    position:     "absolute",
    bottom:       -4,
    borderRadius: "50%",
    background:   "#378ADD",
    opacity:      0,
  },
  content: {
    position:      "relative",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    animation:     "contentIn 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both",
  },
  logoRow: {
    display:      "flex",
    alignItems:   "center",
    gap:          14,
    marginBottom: 10,
  },
  iconWrap:  { position: "relative", width: 52, height: 52 },
  iconBg: {
    position:     "absolute",
    inset:        0,
    background:   "#1a3a5c",
    border:       "1px solid rgba(55,138,221,0.6)",
    borderRadius: 10,
  },
  iconOrbit: {
    position:       "absolute",
    inset:          -6,
    border:         "1px solid rgba(55,138,221,0.25)",
    borderRadius:   16,
    borderTopColor: "#378ADD",
  },
  iconSvg: {
    position:  "absolute",
    top:       "50%",
    left:      "50%",
    transform: "translate(-50%,-50%)",
  },
  divider:     { width: 1, height: 42, background: "rgba(55,138,221,0.3)" },
  brandMain: {
    fontSize:      28,
    fontWeight:    600,
    color:         "#ffffff",
    letterSpacing: "-0.3px",
    lineHeight:    1.1,
  },
  brandAccent: { color: "#378ADD" },
  brandSub: {
    fontSize:      11,
    color:         "rgba(255,255,255,0.35)",
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    marginTop:     4,
  },
  statsRow:    { display: "flex", alignItems: "center", marginTop: 36 },
  stat:        { textAlign: "center" },
  statNum:     { fontSize: 22, fontWeight: 600, color: "#ffffff", lineHeight: 1.1 },
  statLabel: {
    fontSize:      11,
    color:         "rgba(255,255,255,0.3)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginTop:     3,
  },
  statSep: {
    width:      1,
    height:     36,
    background: "rgba(55,138,221,0.2)",
    margin:     "0 24px",
  },
  progressWrap:   { width: 260, marginTop: 40 },
  progressLabels: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  progressText:   { fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px" },
  track: {
    height:       2,
    background:   "rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow:     "hidden",
  },
  fill: {
    height:       "100%",
    background:   "#378ADD",
    borderRadius: 2,
    transition:   "width 0.4s ease",
  },
  statusRow:  { display: "flex", alignItems: "center", gap: 6, marginTop: 14 },
  dot: {
    display:      "inline-block",
    width:        6,
    height:       6,
    borderRadius: "50%",
    background:   "#2ecc71",
  },
  statusText: { fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "1px" },
  enterBtn: {
    marginTop:     36,
    padding:       "11px 30px",
    background:    "#185FA5",
    border:        "1px solid #378ADD",
    color:         "#ffffff",
    fontSize:      13,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    borderRadius:  6,
    cursor:        "pointer",
  },

  // Cortina
  wipeOverlay: { position: "absolute", inset: 0, zIndex: 10 },
  wipeBg:      { position: "absolute", inset: 0, background: "#f0f4f8" },
  wipeLine: {
    position:   "absolute",
    top:        0,
    bottom:     0,
    right:      0,
    width:      3,
    background: "#378ADD",
  },
};
