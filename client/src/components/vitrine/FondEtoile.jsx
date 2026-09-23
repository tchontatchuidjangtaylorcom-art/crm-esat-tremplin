import { useEffect, useRef } from "react";

// Fond animé "univers étoilé profond et respirant" pour le hero de la
// vitrine publique : un champ d'étoiles qui dérivent lentement et
// scintillent, en canvas (léger, pas de dépendance ajoutée). Purement
// décoratif — aria-hidden, jamais de contenu informatif dedans — et
// respecte prefers-reduced-motion (dérive/scintillement coupés, étoiles
// figées mais toujours visibles).
export default function FondEtoile({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduitMouvement = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    let largeur = 0;
    let hauteur = 0;
    let etoiles = [];
    let actif = true;
    let idFrame = null;

    function redimensionner() {
      largeur = canvas.clientWidth;
      hauteur = canvas.clientHeight;
      canvas.width = largeur * ratio;
      canvas.height = hauteur * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Densité modérée : assez pour la profondeur, jamais au point de
      // distraire du texte posé par-dessus.
      const nb = Math.round((largeur * hauteur) / 9000);
      etoiles = Array.from({ length: Math.min(160, Math.max(50, nb)) }, () => ({
        x: Math.random() * largeur,
        y: Math.random() * hauteur,
        rayon: Math.random() * 1.3 + 0.3,
        derive: Math.random() * 0.12 + 0.02,
        phase: Math.random() * Math.PI * 2,
        vitesseScintillement: Math.random() * 0.0015 + 0.0006,
      }));
    }

    function dessiner(t) {
      if (!actif) return;
      ctx.clearRect(0, 0, largeur, hauteur);
      for (const e of etoiles) {
        if (!reduitMouvement) {
          e.y += e.derive;
          if (e.y > hauteur) {
            e.y = 0;
            e.x = Math.random() * largeur;
          }
        }
        const scintillement = reduitMouvement ? 0.75 : 0.5 + 0.5 * Math.sin(t * e.vitesseScintillement + e.phase);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.rayon, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 232, 245, ${(0.25 + scintillement * 0.65).toFixed(3)})`;
        ctx.fill();
      }
      idFrame = requestAnimationFrame(dessiner);
    }

    redimensionner();
    idFrame = requestAnimationFrame(dessiner);
    window.addEventListener("resize", redimensionner);

    function onVisibilite() {
      actif = document.visibilityState === "visible";
      if (actif && idFrame === null) idFrame = requestAnimationFrame(dessiner);
    }
    document.addEventListener("visibilitychange", onVisibilite);

    return () => {
      actif = false;
      if (idFrame) cancelAnimationFrame(idFrame);
      window.removeEventListener("resize", redimensionner);
      document.removeEventListener("visibilitychange", onVisibilite);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 w-full h-full ${className}`} />;
}
