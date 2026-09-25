import { useEffect, useRef } from "react";

// Fond "Dark Tech / Terminal" du récit immersif (voir RecitImmersif.jsx) :
// une grille technique subtile en perspective, des flux de données qui
// glissent horizontalement, et un réseau de nœuds qui convergent vers un
// pôle central — le tout en un seul canvas continu dont l'intensité, la
// vitesse et la teinte évoluent avec `progression` (0→1, fournie par le
// ScrollTrigger de RecitImmersif), plutôt que des illustrations figuratives
// (essayées puis écartées : elles faisaient "dessin animé" et cassaient le
// ton sobre/premium recherché). Canvas léger, pas de dépendance ajoutée,
// respecte prefers-reduced-motion (dérive coupée, composition figée mais
// toujours visible).
export default function SceneDarkTech({ progression = 0, className = "" }) {
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
    let actif = true;
    let idFrame = null;
    let flux = [];
    let noeuds = [];

    // Palette par phase (0 = intro froide/marine, 1 = convictions dorées,
    // 2 = synthèse) — interpolée en continu selon `progression`.
    const PALETTES = [
      { r: 111, g: 150, b: 224 },
      { r: 217, g: 160, b: 90 },
      { r: 150, g: 180, b: 210 },
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

      // Lignes de flux : trajectoires quasi horizontales, légèrement
      // ondulées, réparties sur la hauteur.
      const nbFlux = Math.max(5, Math.min(10, Math.round(hauteur / 90)));
      flux = Array.from({ length: nbFlux }, (_, i) => ({
        y: (hauteur / (nbFlux + 1)) * (i + 1) + (Math.random() - 0.5) * 30,
        amplitude: Math.random() * 14 + 6,
        frequence: Math.random() * 0.004 + 0.002,
        dephasage: Math.random() * Math.PI * 2,
        vitesseBase: Math.random() * 0.35 + 0.25,
        epaisseurTrait: Math.random() * 0.6 + 0.4,
        pulses: Array.from({ length: Math.random() < 0.5 ? 1 : 2 }, () => ({
          t: Math.random(),
          longueur: Math.random() * 70 + 60,
        })),
      }));

      const centre = { x: largeur * 0.82, y: hauteur * 0.32 };
      const nb = Math.round((largeur * hauteur) / 22000);
      noeuds = Array.from({ length: Math.min(46, Math.max(20, nb)) }, () => {
        const angle = Math.random() * Math.PI * 2;
        return {
          angle,
          vitesseAngle: (Math.random() * 0.05 + 0.012) * (Math.random() < 0.5 ? -1 : 1),
          rayonBase: 0.2 + Math.random() * 0.75,
          rayon: Math.random() * 1.5 + 0.8,
          phaseConnexion: Math.random(),
          scintillement: Math.random() * Math.PI * 2,
          centre,
        };
      });
    }

    function dessinerGrille(couleur, p) {
      const pasX = 64;
      const pasY = 64;
      const decalage = (p * 40) % pasY;
      ctx.strokeStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.055)`;
      ctx.lineWidth = 1;
      for (let y = -pasY + decalage; y < hauteur; y += pasY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(largeur, y);
        ctx.stroke();
      }
      // Verticales légèrement convergentes vers le centre-bas, effet de
      // profondeur discret plutôt qu'une grille plate.
      const fuite = largeur * 0.5;
      for (let x = 0; x <= largeur + pasX; x += pasX) {
        const decalHaut = (x - fuite) * 0.06;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - decalHaut, hauteur);
        ctx.stroke();
      }
    }

    function dessinerFlux(t, couleur, p) {
      const vitesseGlobale = 0.4 + p * 1.1;
      for (const f of flux) {
        ctx.beginPath();
        ctx.moveTo(0, f.y);
        for (let x = 0; x <= largeur; x += 24) {
          const y = f.y + Math.sin(x * f.frequence + t * 0.0003 + f.dephasage) * f.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.07)`;
        ctx.lineWidth = f.epaisseurTrait;
        ctx.stroke();

        if (!reduitMouvement) {
          for (const pulse of f.pulses) {
            pulse.t = (pulse.t + f.vitesseBase * vitesseGlobale * 0.00045) % 1;
          }
        }

        for (const pulse of f.pulses) {
          const xCentre = pulse.t * (largeur + pulse.longueur) - pulse.longueur;
          const degrade = ctx.createLinearGradient(xCentre - pulse.longueur, 0, xCentre + pulse.longueur, 0);
          degrade.addColorStop(0, `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0)`);
          degrade.addColorStop(0.5, `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, ${(0.55 + p * 0.25).toFixed(3)})`);
          degrade.addColorStop(1, `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0)`);

          ctx.beginPath();
          const debut = Math.max(0, xCentre - pulse.longueur);
          const fin = Math.min(largeur, xCentre + pulse.longueur);
          for (let x = debut; x <= fin; x += 8) {
            const y = f.y + Math.sin(x * f.frequence + t * 0.0003 + f.dephasage) * f.amplitude;
            if (x === debut) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = degrade;
          ctx.lineWidth = f.epaisseurTrait + 1.4;
          ctx.stroke();
        }
      }
    }

    function dessinerReseau(t, couleur, p) {
      const centre = noeuds[0]?.centre || { x: largeur * 0.82, y: hauteur * 0.32 };
      const rayonMax = Math.min(largeur, hauteur) * 0.3;

      const halo = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, rayonMax * 0.55);
      halo.addColorStop(0, `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.16)`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, largeur, hauteur);

      for (const n of noeuds) {
        if (!reduitMouvement) n.angle += n.vitesseAngle * 0.01;
        const attraction = Math.max(0, Math.min(1, (p - n.phaseConnexion * 0.7) * 2.2));
        const rayonOrbite = n.rayonBase * rayonMax * (1 - attraction * 0.55);
        const x = centre.x + Math.cos(n.angle) * rayonOrbite;
        const y = centre.y + Math.sin(n.angle) * rayonOrbite * 0.7;

        if (attraction > 0.05) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(centre.x, centre.y);
          ctx.strokeStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, ${(attraction * 0.3).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const scintillement = reduitMouvement ? 0.7 : 0.55 + 0.45 * Math.sin(t * 0.0012 + n.scintillement);
        ctx.beginPath();
        ctx.arc(x, y, n.rayon + attraction, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, ${(0.3 + scintillement * 0.45 + attraction * 0.15).toFixed(3)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 4 + p * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.85)`;
      ctx.fill();
    }

    function dessiner(t) {
      if (!actif) return;
      const p = progressionRef.current;
      ctx.clearRect(0, 0, largeur, hauteur);

      const couleur = couleurPhase(p);
      dessinerGrille(couleur, p);
      dessinerFlux(t, couleur, p);
      dessinerReseau(t, couleur, p);

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
