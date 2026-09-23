import { useEffect, useRef, useState } from "react";

// Compteur qui s'incrémente de 0 jusqu'à `valeur` (donnée réelle calculée
// côté serveur — voir /api/vitrine) au moment où il entre dans le viewport.
// L'animation elle-même est purement esthétique ; le nombre final n'est
// jamais inventé.
export default function CompteurAnime({ valeur, suffixe = "", dureeMs = 1400 }) {
  const ref = useRef(null);
  const [affiche, setAffiche] = useState(0);
  const lance = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (!entree.isIntersecting || lance.current) return;
        lance.current = true;
        const debut = performance.now();
        function frame(maintenant) {
          const t = Math.min(1, (maintenant - debut) / dureeMs);
          const progression = 1 - Math.pow(1 - t, 3); // ease-out cubique
          setAffiche(Math.round(progression * valeur));
          if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        observateur.disconnect();
      },
      { threshold: 0.3 }
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [valeur, dureeMs]);

  return (
    <span ref={ref}>
      {affiche.toLocaleString("fr-FR")}
      {suffixe}
    </span>
  );
}
