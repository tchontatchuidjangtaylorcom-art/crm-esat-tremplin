import { useEffect, useRef } from "react";

// Fond animé du récit au scroll (voir RecitImmersif.jsx) : un réseau de
// nœuds qui se connectent progressivement à un pôle central, comme métaphore
// visuelle de l'insertion professionnelle (une personne qui rejoint un poste,
// une équipe, une organisation) — plutôt qu'une illustration figurative
// (poste de travail, rampe d'accès...) qui demanderait un vrai travail
// d'illustrateur pour ne pas sonner faux. Piloté par `progression` (0→1,
// fourni par le ScrollTrigger de RecitImmersif.jsx) : la teinte et l'intensité des connexions
// évoluent en 3 phases pour accompagner les 3 étapes du texte, sans jamais
// dépendre du texte pour rester lisible seule. Canvas léger (pas de
// dépendance 3D ajoutée), respecte prefers-reduced-motion.
export default function SceneRecitImmersif({ progression = 0, className = "" }) {
  const canvasRef = useRef(null);
  const progressionRef = useRef(progression);
  progressionRef.current = progression;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduitMouvement = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    let largeur = 0;
    let hauteur = 0;
    let noeuds = [];
    let actif = true;
    let idFrame = null;

    // Palette par phase (0 = intro froide, 1 = convictions chaleureuses,
    // 2 = synthèse marine/or) — interpolée en continu selon `progression`.
    const PALETTES = [
      { r: 99, g: 140, b: 220 }, // marine clair
      { r: 217, g: 160, b: 90 }, // or chaleureux
      { r: 140, g: 170, b: 200 }, // synthèse
    ];

    function couleurPhase(p) {
      const echelle = p * (PALETTES.length - 1);
      const i = Math.min(PALETTES.length - 2, Math.floor(echelle));
      const t = echelle - i;
      const a = PALETTES[i];
      const b = PALETTES[i + 1];
      return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t),
      };
    }

    function redimensionner() {
      largeur = canvas.clientWidth;
      hauteur = canvas.clientHeight;
      canvas.width = largeur * ratio;
      canvas.height = hauteur * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const centre = { x: largeur * 0.5, y: hauteur * 0.5 };
      const nb = Math.round((largeur * hauteur) / 14000);
      noeuds = Array.from({ length: Math.min(70, Math.max(28, nb)) }, () => {
        const angle = Math.random() * Math.PI * 2;
        const rayonOrbite = 0.25 + Math.random() * 0.65;
        return {
          angle,
          vitesseAngle: (Math.random() * 0.06 + 0.015) * (Math.random() < 0.5 ? -1 : 1),
          rayonBase: rayonOrbite,
          rayon: Math.random() * 1.6 + 1,
          phaseConnexion: Math.random(), // seuil de progression auquel ce nœud "rejoint" le centre
          scintillement: Math.random() * Math.PI * 2,
          centre,
        };
      });
    }

    function dessiner(t) {
      if (!actif) return;
      const p = progressionRef.current;
      ctx.clearRect(0, 0, largeur, hauteur);

      const couleur = couleurPhase(p);
      const centre = { x: largeur * 0.5, y: hauteur * 0.46 };
      const rayonMax = Math.min(largeur, hauteur) * 0.42;

      // Halo central — représente le "pôle" que les nœuds rejoignent.
      const halo = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, rayonMax * 0.5);
      halo.addColorStop(0, `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.18)`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, largeur, hauteur);

      for (const n of noeuds) {
        if (!reduitMouvement) n.angle += n.vitesseAngle * 0.01;
        // Plus la progression dépasse le seuil du nœud, plus il est "attiré"
        // vers le centre — matérialise visuellement une intégration continue
        // plutôt qu'un simple apparaître/disparaître.
        const attraction = Math.max(0, Math.min(1, (p - n.phaseConnexion * 0.7) * 2.2));
        const rayonOrbite = n.rayonBase * rayonMax * (1 - attraction * 0.6);
        const x = centre.x + Math.cos(n.angle) * rayonOrbite;
        const y = centre.y + Math.sin(n.angle) * rayonOrbite * 0.68;

        if (attraction > 0.05) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(centre.x, centre.y);
          ctx.strokeStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, ${(attraction * 0.35).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const scintillement = reduitMouvement ? 0.7 : 0.55 + 0.45 * Math.sin(t * 0.0012 + n.scintillement);
        ctx.beginPath();
        ctx.arc(x, y, n.rayon + attraction * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, ${(0.35 + scintillement * 0.5 + attraction * 0.15).toFixed(3)})`;
        ctx.fill();
      }

      // Cœur central, toujours visible : le pôle OETH lui-même.
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 5 + p * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.9)`;
      ctx.fill();

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
