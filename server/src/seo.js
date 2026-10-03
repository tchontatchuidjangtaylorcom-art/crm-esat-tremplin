// SEO du site public (oeth-fiph.fr/vitrine…) côté serveur :
//  - balises <title>, meta description, canonical, Open Graph, Twitter et
//    données structurées schema.org injectées DANS le HTML envoyé (Google et
//    surtout les aperçus LinkedIn / e-mail / messageries n'exécutent pas, ou
//    mal, le JavaScript) ;
//  - robots.txt (pages publiques indexables, CRM bloqué) et sitemap.xml ;
//  - noindex systématique sur les pages du CRM ;
//  - cache long des fichiers versionnés du build.
import fs from "fs";
import path from "path";
import express from "express";
import { PAGES_SEO, seoPourChemin, NOM_SITE, IMAGE_PARTAGE, EMAIL_CONTACT, TELEPHONE_CONTACT } from "../../client/src/seo/pagesSeo.js";
import { FAQ } from "../../client/src/components/vitrine/contenuFaq.js";

// Adresse publique canonique du site (domaine définitif).
export const SITE_URL = (process.env.SITE_URL || "https://oeth-fiph.fr").replace(/\/+$/, "");
const DOMAINE_PUBLIC = /(^|\.)oeth-fiph\.fr$/i;
const DATE_MISE_A_JOUR = new Date().toISOString().slice(0, 10);

// Pages du CRM : jamais indexées.
const CHEMINS_PRIVES = ["/connexion", "/admin", "/entreprise", "/chat", "/mes-kpis", "/kpis-equipe", "/api/"];

const echapper = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Données structurées schema.org (JSON-LD) selon la page.
function donneesStructurees(chemin, seo) {
  const url = `${SITE_URL}${chemin}`;
  const blocs = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: NOM_SITE,
      url: `${SITE_URL}/vitrine`,
      logo: `${SITE_URL}/logo-512.png`,
      email: EMAIL_CONTACT,
      telephone: TELEPHONE_CONTACT,
      areaServed: "FR",
      contactPoint: {
        "@type": "ContactPoint",
        email: EMAIL_CONTACT,
        telephone: TELEPHONE_CONTACT,
        contactType: "customer support",
        availableLanguage: "French",
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "08:45",
          closes: "18:00",
        },
      },
    },
  ];

  if (chemin === "/vitrine") {
    blocs.push(
      { "@context": "https://schema.org", "@type": "WebSite", name: NOM_SITE, url: `${SITE_URL}/vitrine`, inLanguage: "fr-FR" },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Simulateur OETH / DOETH",
        url,
        description: seo.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "fr-FR",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      }
    );
  } else {
    blocs.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Simulateur OETH", item: `${SITE_URL}/vitrine` },
        { "@type": "ListItem", position: 2, name: seo.titre.split(" — ")[0], item: url },
      ],
    });
  }

  // FAQ : questions/réponses visibles sur la page (résultats enrichis Google).
  if (chemin === "/vitrine/faq") {
    blocs.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.reponse },
      })),
    });
  }

  // "</script>" ne doit jamais apparaître dans le JSON inséré.
  return blocs
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, "\\u003c")}</script>`)
    .join("\n    ");
}

// Bloc <head> propre à une page (remplace le <title> du build).
export function balisesHead(chemin) {
  const seo = seoPourChemin(chemin);
  // Prise de rendez-vous depuis un e-mail (lien propre à une entreprise) :
  // page publique, mais jamais indexée.
  if (chemin.startsWith("/vitrine/rendez-vous/")) {
    return `<title>Prendre rendez-vous — Pôle OETH / AGEFIPH</title>\n    <meta name="robots" content="noindex, nofollow" />`;
  }
  // « Confirmer ma fiche » (lien propre à une entreprise, voir ficheClient.js).
  if (chemin.startsWith("/vitrine/ma-fiche/") || chemin === "/vitrine/mon-dossier") {
    return `<title>Confirmer ma fiche — Pôle OETH</title>\n    <meta name="robots" content="noindex, nofollow" />`;
  }
  if (!seo) {
    // Pages CRM / inconnues : titre neutre, jamais indexées.
    return `<title>CRM OETH — Espace sécurisé</title>\n    <meta name="robots" content="noindex, nofollow" />`;
  }
  const url = `${SITE_URL}${chemin}`;
  const image = `${SITE_URL}${IMAGE_PARTAGE}`;
  const titre = `${seo.titre}`;
  return [
    `<title>${echapper(titre)}</title>`,
    `<meta name="description" content="${echapper(seo.description)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${echapper(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:site_name" content="${echapper(NOM_SITE)}" />`,
    `<meta property="og:title" content="${echapper(titre)}" />`,
    `<meta property="og:description" content="${echapper(seo.description)}" />`,
    `<meta property="og:url" content="${echapper(url)}" />`,
    `<meta property="og:image" content="${echapper(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${echapper(`${NOM_SITE} — simulateur OETH / DOETH gratuit`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${echapper(titre)}" />`,
    `<meta name="twitter:description" content="${echapper(seo.description)}" />`,
    `<meta name="twitter:image" content="${echapper(image)}" />`,
    donneesStructurees(chemin, seo),
  ].join("\n    ");
}

function robotsTxt() {
  return [
    "# Site public du Pôle OETH — pages de la vitrine indexables, CRM interne exclu.",
    "User-agent: *",
    "Allow: /vitrine",
    ...CHEMINS_PRIVES.map((c) => `Disallow: ${c}`),
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

function sitemapXml() {
  const urls = Object.entries(PAGES_SEO)
    .map(
      ([chemin, p]) =>
        `  <url>\n    <loc>${SITE_URL}${chemin}</loc>\n    <lastmod>${DATE_MISE_A_JOUR}</lastmod>\n    <changefreq>${p.frequence}</changefreq>\n    <priority>${p.priorite.toFixed(1)}</priority>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Branche le SEO et le service du frontend buildé (remplace l'ancien
// express.static + renvoi brut d'index.html).
export function servirFrontend(app, distClient) {
  const fichierIndex = path.join(distClient, "index.html");
  let modele = null;
  // Les commentaires HTML sont retirés avant l'injection : un commentaire
  // contenant le mot "<title>" faisait remplacer le mauvais endroit et
  // enfermait tout le reste de la page (scripts compris) dans un commentaire
  // → page blanche.
  const lireModele = () => {
    if (!modele) modele = fs.readFileSync(fichierIndex, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    return modele;
  };

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(robotsTxt());
  });
  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(sitemapXml());
  });

  // Fichiers du build : ceux de /assets sont versionnés (hash dans le nom)
  // → cache d'un an ; les autres (images, favicon) → 1 jour. index.html n'est
  // jamais servi ici (index: false) pour toujours passer par l'injection SEO.
  app.use(
    express.static(distClient, {
      index: false,
      setHeaders(res, fichier) {
        if (fichier.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    })
  );

  app.get(/^(?!\/api\/).*/, (req, res) => {
    const chemin = req.path.replace(/\/+$/, "") || "/";

    // Nom de domaine public : la racine mène à la vitrine pour un visiteur
    // non connecté (les agents connectés gardent l'accès au CRM).
    if (chemin === "/" && DOMAINE_PUBLIC.test(req.hostname || "") && !/(^|;\s*)crm_session=/.test(req.headers.cookie || "")) {
      return res.redirect(302, "/vitrine");
    }

    const publique = Boolean(seoPourChemin(chemin));
    if (!publique) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(lireModele().replace(/<title>[\s\S]*?<\/title>/, balisesHead(chemin)));
  });
}
