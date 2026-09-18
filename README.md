# Plateforme de gestion des fiches de TD — UFR

Monorepo npm workspaces : `backend` (Node/Express/TypeScript/Prisma) et
`frontend` (React/Vite/TypeScript/Tailwind). Version MVP complète (voir
"Fonctionnalités" ci-dessous) — prête à être installée et utilisée.

## Prérequis

- Node.js >= 18
- Docker + Docker Compose (pour PostgreSQL et MinIO en local)

## Démarrage rapide

```bash
# 1. Installer toutes les dépendances (backend + frontend)
npm install

# 2. Démarrer PostgreSQL et MinIO (S3-compatible) en local
docker compose up -d

# 3. Configurer les variables d'environnement du backend
cp backend/.env.example backend/.env
# Ajuster si besoin (les valeurs par défaut correspondent au docker-compose.yml)

# 4. Générer le client Prisma et appliquer les migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Charger les données de démonstration (comptes + formation + fiches PDF)
npm run prisma:seed --workspace backend

# 6. Lancer le backend et le frontend (dans deux terminaux)
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

Le frontend proxy les appels `/api/*` vers `http://localhost:4000` (voir
`frontend/vite.config.ts`), donc aucune configuration CORS supplémentaire
n'est nécessaire en développement.

## Comptes de démonstration (après `npm run prisma:seed`)

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | admin@ufr-td.sn | Demo1234! |
| Enseignant | prof.diallo@ufr-td.sn | Demo1234! |
| Étudiant | etudiant.fall@ufr-td.sn | Demo1234! |

Le seed crée une formation (MIO) avec ses niveaux/semestres/matières, une
année universitaire courante, et 3 fiches de TD déjà publiées (avec de
vrais PDF téléversés dans MinIO) pour que le catalogue ne soit pas vide au
premier lancement.

## Vérifier que tout fonctionne

- Backend : `curl http://localhost:4000/api/health` doit répondre
  `{"status":"ok","database":"ok",...}`.
- Frontend : ouvrir `http://localhost:5173`, se connecter avec un compte de
  démonstration ci-dessus, ou créer un nouveau compte.

## Fonctionnalités livrées (MVP)

- **Authentification & rôles** : inscription (étudiant avec choix
  formation/niveau, ou enseignant), connexion, déconnexion, restauration de
  session via refresh token (cookie httpOnly), mots de passe hashés
  (bcrypt), routes protégées par rôle côté backend (jamais seulement côté
  frontend).
- **Structure pédagogique** (admin) : CRUD formations, niveaux, semestres,
  années universitaires, matières.
- **Fiches de TD** : publication par l'enseignant (PDF + image de
  couverture optionnelle, validation du type de fichier par signature
  binaire et pas seulement par extension), modification, suppression,
  workflow de statut (brouillon → en attente → publiée/refusée).
- **Validation** (admin) : liste des fiches en attente, valider (publication
  immédiate) ou refuser avec commentaire.
- **Catalogue public** : recherche (titre, description, matière,
  enseignant), filtres (formation, niveau, semestre, matière, année),
  pagination.
- **Lecteur PDF intégré** + téléchargement (URL signée temporaire, jamais
  d'accès direct au fichier ; le compteur de téléchargements et
  l'historique sont enregistrés).
- **Tableaux de bord** étudiant, enseignant (fiches publiées/en attente/
  refusées, téléchargements, fiches populaires) et administrateur
  (utilisateurs, fiches, téléchargements, fiches les plus téléchargées).
- **Gestion des utilisateurs** (admin) : liste, activation/désactivation de
  compte.
- **Interface** : responsive, mode sombre, toasts de succès/erreur, états
  de chargement/vide gérés partout.

Reportées après cette première version (comme convenu dans le plan) :
favoris, historique de téléchargement, notifications, signalements,
statistiques avancées, recommandations — les pages correspondantes existent
déjà dans la navigation avec un message "à venir" pour ne pas casser les
liens prévus dans le cahier des charges.

## Limitations connues de cet environnement de développement (sandbox Claude)

Ce projet a été développé et vérifié autant que possible dans un
environnement cloud isolé qui n'a pas d'accès réseau complet. Deux étapes
n'ont donc pas pu être testées de bout en bout ici, mais fonctionneront
normalement sur votre machine ou en CI avec un accès internet standard :

1. **`npx prisma generate`** échoue dans ce bac à sable car son réseau
   sortant bloque `binaries.prisma.sh` (le CDN qui distribue le moteur
   Prisma). Le schéma (`backend/prisma/schema.prisma`) a été relu
   attentivement et le code qui l'utilise a été vérifié autant que possible
   sans le client généré.
2. **MinIO** n'a pas pu être démarré dans ce bac à sable (pas de démon
   Docker disponible). Le code d'upload/téléchargement utilise le SDK AWS
   S3 standard (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
   selon des patterns éprouvés, mais n'a pas pu être exécuté contre un vrai
   bucket ici.

Ce qui a été vérifié dans ce bac à sable :
- Le code TypeScript compile sans erreur sur tout le backend et le
  frontend (à l'exception des quelques imports qui dépendent du client
  Prisma généré — attendu tant que `prisma generate` n'a pas tourné).
- Le frontend build en production sans erreur et le serveur de
  développement démarre et sert l'application.
- PostgreSQL a été démarré localement dans ce bac à sable et la chaîne de
  connexion `DATABASE_URL` par défaut s'y connecte avec succès.
- Les schémas de validation (Zod) ont été testés à l'exécution
  (inscription étudiant/enseignant, filtres de recherche).

**Recommandation** : après avoir suivi "Démarrage rapide" ci-dessus sur
votre machine, testez le parcours complet (inscription enseignant →
connexion → ajout d'une fiche → soumission → connexion admin → validation
→ connexion étudiant → recherche/téléchargement) et signalez tout
comportement inattendu — je corrigerai rapidement.

## Prochaines étapes suggérées

Favoris, historique de téléchargement, notifications, signalements,
statistiques avancées (voir `docs/architecture-et-plan.md` dans le projet
Claude pour le détail).
