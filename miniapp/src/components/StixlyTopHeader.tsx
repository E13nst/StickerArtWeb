import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Build asset path respecting Vite base (/miniapp/)
const BASE = (import.meta as any).env?.BASE_URL || "/miniapp/";
const img = (name: string) => `${BASE}assets/${name}`;

type Slide = {
  id: number;
  bg: string;
  img: string;
  text: string;
};

const RAW_SLIDES: Omit<Slide, "img"> & { img: string }[] = [
  {
    id: 1,
    bg: "linear-gradient(180deg, #000000 0%, #111111 100%)",
    img: "stixly-logo-light.webp",
    text: "Find, create & smile with stickers",
  },
  {
    id: 2,
    bg: "linear-gradient(180deg, #FF6700 0%, #FF944D 100%)",
    img: "stixly-logo-orange.webp",
    text: "",
  },
  {
    id: 3,
    bg: "linear-gradient(180deg, #3B1D73 0%, #2CD9FF 100%)",
    img: "stixly-mascot.webp",
    text: "Your Universe of stickers",
  },
];

export default function StixlyTopHeader() {
  const [index, setIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => RAW_SLIDES.map((s) => ({ ...s, img: img(s.img) })),
    []
  );

  // Preload
  useEffect(() => {
    slides.forEach((s) => {
      const i = new Image();
      i.src = s.img;
    });
  }, [slides]);

  // Autoplay
  useEffect(() => {
    const t = setInterval(() => setIndex((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[index];
  const isMascot = current.img.includes("mascot");

  return (
    <div
      className="stixly-top-header"
      style={{
        position: "relative",
        width: "100%",
        height: "160px",
        zIndex: 1,
        overflow: "hidden",
        borderBottomLeftRadius: "1.5rem",
        borderBottomRightRadius: "1.5rem",
        pointerEvents: "none", // не блокируем взаимодействия с контентом
      }}
    >
      {/* Два слоя для идеального кросс‑фейда без пустоты */}
      <div style={{ position: "absolute", inset: 0 }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${current.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            style={{ position: "absolute", inset: 0, background: current.bg }}
          />
        </AnimatePresence>
      </div>

      <div style={{ position: "absolute", inset: 0 }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={`content-${current.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="stixly-top-header__content"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: isMascot ? "space-between" : "center",
              flexDirection: isMascot ? "row" : "column",
              color: "#fff",
              textAlign: "center",
              paddingLeft: "16px",
              paddingRight: "16px",
              paddingTop: "18px", // подняли контент выше
            }}
          >
            {isMascot ? (
              <>
                <div
                  style={{
                    flex: "1 1 0%",
                    textAlign: "left",
                    paddingRight: "12px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "clamp(16px, 4.6vw, 24px)",
                      lineHeight: 1.15,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.96)",
                      letterSpacing: "0.2px",
                      textShadow:
                        "0 1px 2px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.25)",
                      transform: "translateY(10px)",
                    }}
                  >
                    {current.text}
                  </p>
                </div>
                <img
                  src={current.img}
                  alt="Stixly"
                  style={{
                    flex: "0 0 auto",
                    width: "240px",
                    height: "auto",
                    filter: "drop-shadow(0 0 10px rgba(255,255,255,0.28))",
                  }}
                  loading="eager"
                  decoding="async"
                />
              </>
            ) : (
              <>
                <img
                  src={current.img}
                  alt="Stixly"
                  style={{
                    width: "180px",
                    height: "auto",
                    marginBottom: "4px",
                    filter: "drop-shadow(0 0 10px rgba(255,255,255,0.28))",
                  }}
                  loading="eager"
                  decoding="async"
                />
                {current.text && (
                  <p
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                      bottom: 8,
                    margin: 0,
                    width: "100%",
                      fontSize: "clamp(14px, 3.8vw, 20px)",
                      lineHeight: 1.15,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.96)",
                    letterSpacing: "0.3px",
                      textShadow:
                        "0 1px 2px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.25)",
                  }}
                  >
                    {current.text}
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


