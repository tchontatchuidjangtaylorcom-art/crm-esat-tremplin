import { useState } from "react";

// 🔊 Lit un texte à voix haute (synthèse vocale du navigateur, voix
// française) — ex. pour savoir prononcer le nom d'une entreprise avant l'appel.
export function BoutonPrononcer({ texte, className = "" }) {
  const [enLecture, setEnLecture] = useState(false);
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  function lire() {
    const synthese = window.speechSynthesis;
    synthese.cancel();
    // Noms souvent en majuscules ("WIPRO LAUAK") : lus comme des mots, pas
    // épelés lettre par lettre.
    const enonce = new SpeechSynthesisUtterance(String(texte || "").toLowerCase());
    enonce.lang = "fr-FR";
    enonce.rate = 0.9;
    const voix = synthese.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (voix) enonce.voice = voix;
    enonce.onend = enonce.onerror = () => setEnLecture(false);
    setEnLecture(true);
    synthese.speak(enonce);
  }

  return (
    <button
      type="button"
      onClick={lire}
      title="Écouter la prononciation"
      aria-label={`Écouter la prononciation de ${texte}`}
      className={`inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
        enLecture ? "bg-marine-100 dark:bg-marine-900/50 border-marine-400" : ""
      } ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    </button>
  );
}

// ⧉ Copie un texte (ex. numéro de téléphone, pour Aircall ou une autre
// application d'appel). Repli sans l'API presse-papiers (page non sécurisée).
export function BoutonCopier({ texte, libelle = "Copier", className = "", onCopie }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    const valeur = String(texte || "").trim();
    try {
      await navigator.clipboard.writeText(valeur);
    } catch {
      const zone = document.createElement("textarea");
      zone.value = valeur;
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      document.execCommand("copy");
      zone.remove();
    }
    onCopie?.();
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copier}
      title={copie ? "Copié !" : `${libelle} ${texte}`}
      aria-label={`${libelle} ${texte}`}
      className={`inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg border transition ${
        copie
          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
          : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
      } ${className}`}
    >
      {copie ? (
        <span className="text-sm font-bold">✓</span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-9.077M15.75 17.25H9.375a1.125 1.125 0 01-1.125-1.125V9.375m7.5 7.875V9.375c0-.621-.504-1.125-1.125-1.125H9.375" />
        </svg>
      )}
    </button>
  );
}
