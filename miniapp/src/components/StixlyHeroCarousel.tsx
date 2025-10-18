import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Resolve images from public assets respecting Vite base URL (/miniapp/)
// Use a typed-agnostic access to avoid TS/eslint issues in workspace root
const BASE = (import.meta as any).env?.BASE_URL || "/miniapp/";
const imgPath = (name: string) => `${BASE}assets/${name}`;

const slides = [
  {
    id: 1,
    background: "linear-gradient(to bottom, #000000, #111111)",
    img: imgPath("stixly-logo-light.webp"),
    text: "Find, create & smile with stickers",
  },
  {
    id: 2,
    background: "linear-gradient(to bottom, #FF6700, #FF944D)",
    img: imgPath("stixly-logo-orange.webp"),
    text: "Your universe of Telegram stickers",
  },
  {
    id: 3,
    background: "linear-gradient(to bottom, #3B1D73, #2CD9FF)",
    img: imgPath("stixly-mascot.webp"),
    text: "Art. Fun. Community.",
  },
];

export default function StixlyHeroCarousel() {
  const [index, setIndex] = useState(0);

  // Preload images
  useEffect(() => {
    slides.forEach(({ img }) => {
      const image = new Image();
      image.src = img;
    });
  }, []);

  // Autoplay rotation
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const current = slides[index];

  return (
    <div
      className="stixly-hero"
      style={{
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.section
          key={current.id}
          initial={{ x: 120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -120, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="stixly-hero__section"
          style={{ background: current.background }}
        >
          <div className="stixly-hero__inner">
            <img
              src={current.img}
              alt="Stixly"
              className="stixly-hero__img"
              loading="eager"
              decoding="async"
            />
            <p className="stixly-hero__text">{current.text}</p>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

// CSS injection (scoped, minimal)
const styles = `
.stixly-hero {
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100vw;
  height: 340px;
  overflow: hidden;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
}
@media (min-width: 640px) {
  .stixly-hero { height: 360px; }
}
.stixly-hero__section {
  position: relative;
  width: 100%;
  height: 100%;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stixly-hero__inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 44px; /* Telegram safe zone */
  padding-left: 16px;
  padding-right: 16px;
  text-align: center;
}
.stixly-hero__img {
  width: 180px;
  height: auto;
  margin-bottom: 12px;
  object-fit: contain;
  filter: drop-shadow(0 0 12px rgba(255,255,255,0.3));
}
@media (min-width: 640px) {
  .stixly-hero__img { width: 220px; }
}
.stixly-hero__text {
  width: 100%;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.3px;
}
@media (min-width: 640px) {
  .stixly-hero__text { font-size: 16px; }
}
`;

if (typeof document !== "undefined") {
  const styleId = "stixly-hero-styles";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}
