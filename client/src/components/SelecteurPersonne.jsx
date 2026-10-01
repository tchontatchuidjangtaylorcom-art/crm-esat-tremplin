import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Sélecteur de personne (agent, collègue…) utilisé partout où l'on choisit
// quelqu'un : "Voir le compte de…", assignation d'une fiche, d'une sélection,
// d'une vague, import… Liste toujours triée par ordre alphabétique, avec une
// loupe de recherche (prénom, nom ou e-mail, sans tenir compte des accents)
// et la navigation au clavier (↑ ↓ Entrée Échap). La liste s'ouvre par-dessus
// la page (portail) pour ne jamais être coupée par un tableau défilant.

export function nomPersonne(p) {
  return [p?.prenom, p?.nom].filter(Boolean).join(" ").trim() || p?.email || "";
}

function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function trierPersonnes(personnes) {
  return [...(personnes || [])].sort((a, b) =>
    nomPersonne(a).localeCompare(nomPersonne(b), "fr", { sensitivity: "base" })
  );
}

export default function SelecteurPersonne({
  personnes,
  valeur = "",
  onChange,
  optionsSpeciales = [], // [{ valeur, label }] en tête de liste (ex. Non assigné)
  moiId = null, // si fourni : "Moi (Prénom)" en tête, après les options spéciales
  placeholder = "Choisir une personne…",
  disabled = false,
  className = "",
  titre,
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [surligne, setSurligne] = useState(0);
  const [position, setPosition] = useState(null);
  const bouton = useRef(null);
  const liste = useRef(null);

  const triees = useMemo(() => trierPersonnes(personnes), [personnes]);
  const moi = moiId ? triees.find((p) => p.id === moiId) : null;

  const options = useMemo(() => {
    const termes = normaliser(recherche).split(/\s+/).filter(Boolean);
    const correspond = (texte) => termes.every((t) => normaliser(texte).includes(t));
    const speciales = recherche.trim() ? [] : optionsSpeciales.map((o) => ({ ...o, type: "speciale" }));
    const personnesFiltrees = triees
      .filter((p) => p.id !== moi?.id)
      .filter((p) => !termes.length || correspond(`${nomPersonne(p)} ${p.email || ""}`))
      .map((p) => ({ valeur: p.id, label: nomPersonne(p), personne: p, type: "personne" }));
    const optionMoi =
      moi && (!termes.length || correspond(`moi ${nomPersonne(moi)} ${moi.email || ""}`))
        ? [{ valeur: moi.id, label: `Moi (${nomPersonne(moi)})`, personne: moi, type: "personne" }]
        : [];
    return [...speciales, ...optionMoi, ...personnesFiltrees];
  }, [triees, moi, recherche, optionsSpeciales]);

  const selection =
    optionsSpeciales.find((o) => o.valeur === valeur) ||
    (valeur && moi?.id === valeur ? { label: `Moi (${nomPersonne(moi)})` } : null) ||
    (valeur ? { label: nomPersonne(triees.find((p) => p.id === valeur)) } : null);

  function placer() {
    const r = bouton.current?.getBoundingClientRect();
    if (!r) return;
    const hauteur = 320;
    const enHaut = window.innerHeight - r.bottom < hauteur && r.top > hauteur;
    setPosition({
      left: Math.min(r.left, window.innerWidth - 280),
      top: enHaut ? undefined : r.bottom + 4,
      bottom: enHaut ? window.innerHeight - r.top + 4 : undefined,
      minWidth: Math.max(r.width, 260),
    });
  }

  useLayoutEffect(() => {
    if (ouvert) placer();
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;
    function fermerSiDehors(ev) {
      if (bouton.current?.contains(ev.target) || liste.current?.contains(ev.target)) return;
      setOuvert(false);
    }
    function surDefilement(ev) {
      if (liste.current?.contains(ev.target)) return;
      placer();
    }
    document.addEventListener("mousedown", fermerSiDehors);
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", surDefilement, true);
    return () => {
      document.removeEventListener("mousedown", fermerSiDehors);
      window.removeEventListener("resize", placer);
      window.removeEventListener("scroll", surDefilement, true);
    };
  }, [ouvert]);

  useEffect(() => setSurligne(0), [recherche]);

  function ouvrir(ev) {
    ev.stopPropagation();
    if (disabled) return;
    setRecherche("");
    setSurligne(0);
    setOuvert((o) => !o);
  }

  function choisir(option) {
    setOuvert(false);
    onChange?.(option.valeur);
  }

  function surTouche(ev) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setSurligne((i) => Math.min(i + 1, options.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setSurligne((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (options[surligne]) choisir(options[surligne]);
    } else if (ev.key === "Escape") {
      setOuvert(false);
    }
  }

  // Garde l'option surlignée visible pendant la navigation au clavier.
  useEffect(() => {
    liste.current?.querySelector(`[data-index="${surligne}"]`)?.scrollIntoView({ block: "nearest" });
  }, [surligne]);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        disabled={disabled}
        onClick={ouvrir}
        title={titre}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-left text-slate-700 dark:text-slate-200 disabled:opacity-40 ${
          className || "px-2.5 py-1.5 text-xs"
        }`}
      >
        <span className={`truncate ${selection?.label ? "" : "text-slate-400 dark:text-slate-500"}`}>
          {selection?.label || placeholder}
        </span>
        <span className="shrink-0 text-[10px] text-slate-400" aria-hidden>
          ▼
        </span>
      </button>

      {ouvert &&
        position &&
        createPortal(
          <div
            ref={liste}
            onClick={(ev) => ev.stopPropagation()}
            style={{ position: "fixed", left: position.left, top: position.top, bottom: position.bottom, minWidth: position.minWidth }}
            className="z-[90] max-w-[340px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="relative border-b border-slate-100 dark:border-slate-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
              <input
                autoFocus
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={surTouche}
                placeholder="Rechercher un nom…"
                aria-label="Rechercher une personne"
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
              {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Aucun nom ne correspond.</li>}
              {options.map((o, i) => (
                <li key={`${o.type}-${o.valeur}`} data-index={i} role="option" aria-selected={o.valeur === valeur}>
                  <button
                    type="button"
                    onMouseEnter={() => setSurligne(i)}
                    onClick={() => choisir(o)}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                      i === surligne ? "bg-marine-50 dark:bg-marine-900/40" : ""
                    } ${o.type === "speciale" ? "text-slate-500 dark:text-slate-400 italic" : "text-slate-800 dark:text-slate-100"}`}
                  >
                    <span className="truncate">
                      {o.label}
                      {o.personne?.email && o.label !== o.personne.email && (
                        <span className="block text-[11px] text-slate-400 dark:text-slate-500 not-italic truncate">{o.personne.email}</span>
                      )}
                    </span>
                    <span className="shrink-0 flex items-center gap-1">
                      {(o.personne?.role === "admin" || o.personne?.role === "super_admin") && (
                        <span className="text-[10px] font-semibold uppercase text-marine-600 dark:text-marine-300">admin</span>
                      )}
                      {o.valeur === valeur && <span className="text-marine-600 dark:text-marine-300">✓</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
