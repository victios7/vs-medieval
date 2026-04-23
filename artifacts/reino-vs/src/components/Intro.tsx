import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SESSION_FLAG = "reino_intro_seen_v2";

export function Intro() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_FLAG) !== "1";
  });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!show) return;
    const ts: number[] = [];
    ts.push(window.setTimeout(() => setPhase(1), 600));   // shield drop
    ts.push(window.setTimeout(() => setPhase(2), 1300));  // swords clash
    ts.push(window.setTimeout(() => setPhase(3), 2100));  // title
    ts.push(window.setTimeout(() => setPhase(4), 2900));  // banners + tagline
    ts.push(window.setTimeout(() => setPhase(5), 3700));  // call to action
    ts.push(window.setTimeout(() => dismiss(), 5200));
    return () => { ts.forEach(clearTimeout); };
  }, [show]);

  function dismiss() {
    sessionStorage.setItem(SESSION_FLAG, "1");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7 } }}
          className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at center, #2a1808 0%, #0a0402 70%, #000 100%)",
          }}
          onClick={dismiss}
        >
          {/* dust/embers floating up */}
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={`e${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${(i * 37) % 100}%`,
                bottom: -10,
                width: 3 + (i % 3),
                height: 3 + (i % 3),
                background: "#ffb060",
                boxShadow: "0 0 6px #ff8030",
              }}
              animate={{
                y: [-0, -window.innerHeight - 50],
                opacity: [0, 0.9, 0],
                x: [0, ((i % 5) - 2) * 30],
              }}
              transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: (i * 0.18) % 5, ease: "easeOut" }}
            />
          ))}

          {/* torch flicker */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 18% 78%, #ff8a3035 0%, transparent 35%), radial-gradient(circle at 82% 78%, #ff8a3035 0%, transparent 35%)",
            }}
            animate={{ opacity: [0.55, 1, 0.7, 1, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />

          {/* castle silhouette rising */}
          <motion.svg
            viewBox="0 0 800 200"
            className="absolute bottom-0 left-1/2 pointer-events-none"
            initial={{ y: 220, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 0.9, x: "-50%" }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{ width: "min(800px, 95vw)", filter: "drop-shadow(0 -20px 30px #ff8a3055)" }}
          >
            <defs>
              <linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a0e04" />
                <stop offset="100%" stopColor="#000" />
              </linearGradient>
            </defs>
            <path
              d="M 0,200 L 0,140 L 60,140 L 60,90 L 80,90 L 80,110 L 120,110 L 120,90 L 140,90 L 140,140 L 200,140 L 200,60 L 230,40 L 260,60 L 260,140 L 320,140 L 320,90 L 360,90 L 360,40 L 400,10 L 440,40 L 440,90 L 480,90 L 480,140 L 540,140 L 540,60 L 570,40 L 600,60 L 600,140 L 660,140 L 660,90 L 680,90 L 680,110 L 720,110 L 720,90 L 740,90 L 740,140 L 800,140 L 800,200 Z"
              fill="url(#cgrad)"
            />
            {/* tower flags */}
            <line x1="230" y1="40" x2="230" y2="20" stroke="#3a1a05" strokeWidth="2" />
            <polygon points="230,20 252,26 230,32" fill="#7a1f1f" />
            <line x1="400" y1="10" x2="400" y2="-15" stroke="#3a1a05" strokeWidth="2" />
            <polygon points="400,-15 426,-9 400,-3" fill="#c0902a" />
            <line x1="570" y1="40" x2="570" y2="20" stroke="#3a1a05" strokeWidth="2" />
            <polygon points="570,20 592,26 570,32" fill="#7a1f1f" />
            {/* lit windows */}
            <rect x="225" y="80" width="10" height="14" fill="#ffae5c" />
            <rect x="395" y="50" width="10" height="14" fill="#ffae5c" />
            <rect x="565" y="80" width="10" height="14" fill="#ffae5c" />
            <rect x="100" y="115" width="6" height="10" fill="#ffae5c" opacity="0.8" />
            <rect x="690" y="115" width="6" height="10" fill="#ffae5c" opacity="0.8" />
          </motion.svg>

          {/* central crest */}
          <div className="relative text-center" style={{ fontFamily: "MedievalSharp, serif" }}>
            {/* shield SVG */}
            <motion.svg
              viewBox="0 0 200 240"
              width="180"
              height="216"
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 80, damping: 11, duration: 1 }}
              style={{ filter: "drop-shadow(0 0 30px #c0902a)" }}
            >
              <defs>
                <linearGradient id="sgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7a1f1f" />
                  <stop offset="100%" stopColor="#3a0a0a" />
                </linearGradient>
              </defs>
              <path d="M 100,10 L 190,30 L 190,120 Q 190,200 100,230 Q 10,200 10,120 L 10,30 Z"
                fill="url(#sgrad)" stroke="#c0902a" strokeWidth="5" />
              {/* fleur-de-lis */}
              <text x="100" y="155" textAnchor="middle" fontSize="100" fill="#f4cd5b" style={{ filter: "drop-shadow(0 0 8px #f4cd5b)" }}>⚜</text>
            </motion.svg>

            {/* crossing swords */}
            <AnimatePresence>
              {phase >= 1 && (
                <>
                  <motion.div
                    key="sword-l"
                    initial={{ x: -350, rotate: -90, opacity: 0 }}
                    animate={{ x: -20, rotate: -45, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute"
                    style={{ top: "15%", left: "50%", fontSize: 130, transformOrigin: "center", color: "#d8c89a", textShadow: "0 0 12px #fff8" }}
                  >⚔</motion.div>
                  <motion.div
                    key="sword-r"
                    initial={{ x: 350, rotate: 90, opacity: 0 }}
                    animate={{ x: 20, rotate: 45, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute"
                    style={{ top: "15%", left: "50%", fontSize: 130, transformOrigin: "center", color: "#d8c89a", textShadow: "0 0 12px #fff8" }}
                  >⚔</motion.div>
                </>
              )}
            </AnimatePresence>

            {/* sparks burst on clash */}
            <AnimatePresence>
              {phase === 2 && (
                <>
                  {Array.from({ length: 14 }).map((_, i) => {
                    const ang = (i / 14) * Math.PI * 2;
                    return (
                      <motion.div
                        key={`spark${i}`}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                        animate={{ x: Math.cos(ang) * 160, y: Math.sin(ang) * 160, opacity: 0, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="absolute pointer-events-none"
                        style={{ top: "25%", left: "50%", width: 8, height: 8, borderRadius: 8, background: "#ffd96a", boxShadow: "0 0 10px #ff8030" }}
                      />
                    );
                  })}
                </>
              )}
            </AnimatePresence>

            {/* title */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 30, letterSpacing: "0.6em" }}
                  animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="mt-10"
                  style={{
                    fontSize: 84, color: "#f4cd5b", fontWeight: 900,
                    textShadow: "0 0 16px #c0902a, 0 4px 0 #5a1313, 0 8px 18px #000",
                  }}
                >REINO VS</motion.div>
              )}
            </AnimatePresence>

            {/* banners */}
            <AnimatePresence>
              {phase >= 4 && (
                <>
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      position: "absolute", top: "-60vh", left: "20%", width: 60, height: "60vh",
                      background: "linear-gradient(180deg,#7a1f1f,#5a0a0a)",
                      transformOrigin: "top",
                      boxShadow: "2px 4px 12px #000",
                    }}
                  >
                    <div style={{ position: "absolute", bottom: -22, left: 0, width: 0, height: 0, borderLeft: "30px solid transparent", borderRight: "30px solid transparent", borderTop: "22px solid #5a0a0a" }} />
                    <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translateX(-50%)", color: "#f4cd5b", fontSize: 32 }}>⚜</div>
                  </motion.div>
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    style={{
                      position: "absolute", top: "-60vh", right: "20%", width: 60, height: "60vh",
                      background: "linear-gradient(180deg,#7a1f1f,#5a0a0a)",
                      transformOrigin: "top",
                      boxShadow: "2px 4px 12px #000",
                    }}
                  >
                    <div style={{ position: "absolute", bottom: -22, left: 0, width: 0, height: 0, borderLeft: "30px solid transparent", borderRight: "30px solid transparent", borderTop: "22px solid #5a0a0a" }} />
                    <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translateX(-50%)", color: "#f4cd5b", fontSize: 32 }}>⚔</div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* tagline */}
            <AnimatePresence>
              {phase >= 4 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  className="mt-4 italic"
                  style={{ fontSize: 22, color: "#d8c89a", textShadow: "0 2px 4px #000" }}
                >· Forja tu destino en el reino de los códigos ·</motion.div>
              )}
            </AnimatePresence>

            {/* fanfare proclamation */}
            <AnimatePresence>
              {phase >= 5 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="mt-6"
                  style={{
                    display: "inline-block",
                    padding: "8px 26px",
                    background: "linear-gradient(90deg, #c0902a, #f4cd5b, #c0902a)",
                    color: "#2a1808",
                    fontWeight: 800,
                    border: "2px solid #5a3a18",
                    borderRadius: 4,
                    boxShadow: "0 4px 12px #000",
                    letterSpacing: "0.15em",
                  }}
                >📯 ¡QUE COMIENCE LA FORJA! 📯</motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-4 right-4 text-amber-200/70 text-xs">
            (clic para entrar)
          </div>

          {/* iron border */}
          <div className="absolute inset-3 pointer-events-none" style={{
            border: "4px double #c0902a55",
            boxShadow: "inset 0 0 80px #00000088",
            borderRadius: 6,
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
