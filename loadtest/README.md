# Tests de charge (k6)

Deux scénarios :

| Script | Contre | Ce qu'il mesure |
|---|---|---|
| `campus.js` | la copie **locale** du site | des étudiants connectés parcourent le catalogue, ouvrent et téléchargent des PDF ; la charge monte jusqu'à `MAX_VUS` étudiants simultanés |
| `prod-leger.js` | le site **en ligne** | le temps de réponse de Render + Neon avec 5 visiteurs anonymes, sans compte ni écriture, sous le plafond global de débit |

La capacité se mesure en local : un test lourd sur le site en ligne serait
bloqué par les limites de débit (c'est leur rôle) et consommerait le quota
gratuit de Neon.

## Lancer le test « campus » en local

```bash
# 1. Base locale à jour, données de démonstration et comptes de test
docker compose up -d
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run prisma:seed --workspace backend          # si la base est vide
npm run loadtest:users --workspace backend       # 300 comptes charge.etudiantN@ufr-td.test

# 2. Backend compilé, en mode production (comme sur Render), port 4100
npm run build --workspace backend
cd backend
NODE_ENV=production PORT=4100 \
  JWT_ACCESS_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))') \
  JWT_REFRESH_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))') \
  node dist/server.js

# 3. Dans un autre terminal, à la racine du projet (k6 par son image Docker)
docker run --rm -v "$(pwd -W)/loadtest:/scripts" \
  -e BASE_URL=http://host.docker.internal:4100 -e MAX_VUS=200 \
  grafana/k6 run /scripts/campus.js
```

`npm run loadtest:users` refuse de tourner si `DATABASE_URL` ne pointe pas sur
`localhost` : ces comptes ne doivent jamais exister en production.

Sous Git Bash, préfixez la commande `docker run` par `MSYS_NO_PATHCONV=1`.

## Lancer la mesure légère sur le site en ligne

```bash
docker run --rm -v "$(pwd -W)/loadtest:/scripts" \
  -e BASE_URL=https://votre-site.onrender.com \
  grafana/k6 run /scripts/prod-leger.js
```

## Résultats du 2026-11-22 (copie locale)

Poste : Intel Core i5-1145G7, Postgres et MinIO dans Docker. Node n'utilise
qu'un cœur pour le code du site.

| Étudiants simultanés | Erreurs du site | Temps de réponse (95 %) | Connexion (95 %) |
|---|---|---|---|
| 200 | 0 | 0,59 s | 2,4 s |
| 300 | 0 | 2,8 s | 5,3 s |

Les quelques « dial: i/o timeout » (0,3 %) viennent du réseau de Docker
Desktop : une sonde lancée en parallèle depuis Windows n'a eu aucun échec.

**Le goulot d'étranglement est la connexion.** Le hachage bcrypt d'un mot de
passe coûte environ 0,35 s de calcul, sur le fil unique de Node : pendant
une rafale de connexions (début de séance de TD), tout le site ralentit.
Une fois les 300 étudiants connectés, le serveur traite 62 requêtes par
seconde avec un temps de réponse de 16 à 22 ms.

Sur le plan gratuit de Render, le processeur est bien plus faible que celui
de ce poste : il faut s'attendre à des connexions de plusieurs secondes dès
quelques dizaines d'étudiants qui se connectent dans la même minute.

Le test a aussi révélé un défaut, corrigé depuis : les flux PDF étaient
comptés par adresse IP dans le plafond global, donc partagés par tout le
campus (refus 429 au-delà de 1000 PDF ouverts en 15 minutes).
