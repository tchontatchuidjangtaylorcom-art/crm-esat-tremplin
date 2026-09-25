import { useEffect, useState } from "react";

// Calcule une progression continue (0 → 1) selon la position d'un conteneur
// "épinglé" (sticky) dans le viewport, plutôt qu'un simple booléen "visible" :
// c'est ce qui permet un récit au scroll façon terminal-industries.com (le
// fond et les textes évoluent EN CONTINU avec la barre de défilement, au lieu
// d'apparaître une fois puis de rester figés). Le conteneur doit faire
// plusieurs fois la hauteur du viewport (voir RecitImmersif.jsx) ; la
// progression vaut 0 quand son haut atteint le haut du viewport et 1 quand
// son bas atteint le bas du viewport.
export default function useProgressionScroll(ref) {
  const [progression, setProgression] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let idFrame = null;

    function mesurer() {
      const rect = el.getBoundingClientRect();
      const distanceTotale = rect.height - window.innerHeight;
      const p = distanceTotale > 0 ? -rect.top / distanceTotale : 0;
      setProgression(Math.min(1, Math.max(0, p)));
      idFrame = null;
    }

    function onScroll() {
      if (idFrame === null) idFrame = requestAnimationFrame(mesurer);
    }

    mesurer();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (idFrame) cancelAnimationFrame(idFrame);
    };
  }, [ref]);

  return progression;
}

// Fondu en trapèze : monte de 0 à 1 entre a et b, reste à 1 entre b et c,
// redescend à 0 entre c et d. Le bloc "outil" standard de tout récit au
// scroll par bandes de progression (voir usages dans RecitImmersif.jsx).
export function trapeze(p, a, b, c, d) {
  if (p <= a || p >= d) return 0;
  if (p < b) return (p - a) / (b - a);
  if (p > c) return 1 - (p - c) / (d - c);
  return 1;
}
