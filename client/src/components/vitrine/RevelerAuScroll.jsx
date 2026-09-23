import { useEffect, useRef, useState } from "react";

// Fondu + léger décalage vertical à l'entrée dans le viewport, façon "scroll
// reveal" — purement décoratif, se déclenche une seule fois par section
// (pas de réapparition en remontant) pour rester sobre plutôt que gadget.
export default function RevelerAuScroll({ children, className = "", delai = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVisible(true);
          observateur.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
      style={{ transitionDelay: `${delai}ms` }}
    >
      {children}
    </div>
  );
}
