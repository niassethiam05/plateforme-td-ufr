// Mesure LEGERE du site en ligne : quelques visiteurs anonymes consultent le
// catalogue public. Aucun compte, aucune ecriture en base.
//
// Le debit reste sous le plafond global (1000 requetes / 15 min par adresse
// IP) : ce test mesure le temps de reponse de Render et Neon a faible charge,
// pas la capacite maximale. Celle-ci se mesure en local avec campus.js.
//
//   k6 run -e BASE_URL=https://votre-site.onrender.com loadtest/prod-leger.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL;
if (!BASE_URL) throw new Error("Indiquez l'adresse du site : -e BASE_URL=https://...");

export const options = {
  // 5 visiteurs, environ 2 requetes toutes les 4 s chacun : ~450 requetes en 3 min.
  vus: 5,
  duration: "3m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export function setup() {
  // Reveille le service (le plan gratuit de Render s'endort apres 15 min sans
  // visite) pour que le premier demarrage ne fausse pas les mesures.
  const res = http.get(`${BASE_URL}/api/health`, { timeout: "90s" });
  if (res.status !== 200) throw new Error(`Le site ne repond pas (${res.status}).`);
}

export default function () {
  const list = http.get(`${BASE_URL}/api/td?page=1&pageSize=12`, { tags: { name: "catalogue" } });
  check(list, { "catalogue 200": (r) => r.status === 200 });
  sleep(2);

  const search = http.get(`${BASE_URL}/api/td?search=TD&page=1&pageSize=12`, { tags: { name: "recherche" } });
  check(search, { "recherche 200": (r) => r.status === 200 });
  sleep(2);
}
