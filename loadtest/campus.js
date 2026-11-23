// Scenario "campus" : des etudiants connectes parcourent le catalogue et
// ouvrent des fiches, comme pendant une seance de TD.
//
// A lancer contre la copie LOCALE du site (voir loadtest/README.md) : chaque
// utilisateur virtuel se connecte avec son propre compte de test
// (charge.etudiantN@ufr-td.test), qui n'existe pas en production.
//
//   k6 run loadtest/campus.js
//   k6 run -e MAX_VUS=300 -e BASE_URL=http://localhost:4000 loadtest/campus.js
import http from "k6/http";
import { check, fail, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const MAX_VUS = Number(__ENV.MAX_VUS || 200);
const PASSWORD = __ENV.LOADTEST_PASSWORD || "Charge1234!";

const loginDuration = new Trend("connexion_duree", true);
const pdfDuration = new Trend("pdf_duree", true);
const rateLimited = new Counter("refus_429");

export const options = {
  stages: [
    { duration: "1m", target: Math.round(MAX_VUS / 4) },
    { duration: "2m", target: MAX_VUS },
    { duration: "3m", target: MAX_VUS },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    connexion_duree: ["p(95)<3000"],
  },
};

// Variables propres a chaque utilisateur virtuel, conservees d'une iteration
// a l'autre : on ne se connecte qu'une fois, comme un vrai etudiant.
let accessToken = null;

function track(res) {
  if (res.status === 429) rateLimited.add(1);
  return res;
}

function login() {
  const res = track(
    http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: `charge.etudiant${__VU}@ufr-td.test`, password: PASSWORD }),
      { headers: { "Content-Type": "application/json" }, tags: { name: "connexion" } }
    )
  );
  loginDuration.add(res.timings.duration);
  if (!check(res, { "connexion 200": (r) => r.status === 200 })) {
    fail(`connexion refusee (${res.status}) pour charge.etudiant${__VU}`);
  }
  accessToken = res.json("accessToken");
}

function get(path, name) {
  return track(http.get(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, tags: { name } }));
}

/** Demande un jeton de fichier, puis lit le PDF en entier. */
function openPdf(id, scope) {
  const issue = get(`/api/td/${id}/${scope}`, `jeton ${scope}`);
  if (!check(issue, { [`jeton ${scope} 200`]: (r) => r.status === 200 })) return;
  const { url, token } = issue.json();
  const res = track(http.get(`${BASE_URL}${url}?token=${encodeURIComponent(token)}`, { tags: { name: `flux ${scope}` } }));
  check(res, { [`flux ${scope} 200`]: (r) => r.status === 200 });
  pdfDuration.add(res.timings.duration);
}

export default function () {
  if (!accessToken) login();

  const list = get("/api/td?page=1&pageSize=12", "catalogue");
  check(list, { "catalogue 200": (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);

  const search = get("/api/td?search=TD&page=1&pageSize=12", "recherche");
  check(search, { "recherche 200": (r) => r.status === 200 });

  const items = list.status === 200 ? list.json("items") : [];
  if (!items || items.length === 0) {
    sleep(5);
    return;
  }
  const fiche = items[Math.floor(Math.random() * items.length)];

  const detail = get(`/api/td/${fiche.id}`, "fiche");
  check(detail, { "fiche 200": (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);

  openPdf(fiche.id, "view");
  // Un etudiant sur cinq telecharge la fiche apres l'avoir lue.
  if (Math.random() < 0.2) openPdf(fiche.id, "download");

  // Temps de lecture avant de revenir au catalogue.
  sleep(10 + Math.random() * 20);
}
