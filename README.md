# Plateforme de gestion des fiches de TD — UFR

Monorepo npm workspaces : `backend` (Node/Express/TypeScript/Prisma) et
`frontend` (React/Vite/TypeScript/Tailwind). Voir
« Fonctionnalités » ci-dessous.

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

## Fonctionnalités

- **Authentification & rôles** : inscription, connexion, déconnexion, mots de
  passe hashés (bcrypt), routes protégées par rôle côté backend (jamais
  seulement côté frontend).
  - Un compte étudiant (avec choix formation/niveau) est actif immédiatement.
  - Un compte enseignant est créé inactif : un administrateur doit le valider
    depuis « Utilisateurs » avant la première connexion.
- **Mot de passe oublié** : lien de réinitialisation envoyé par email, valable
  30 minutes et utilisable une seule fois. Sans serveur SMTP configuré
  (développement), le lien est affiché dans la console du backend.
- **Sessions** : access token de 15 min renouvelé automatiquement, refresh
  token en cookie httpOnly avec rotation et détection de rejeu. Désactiver un
  compte ou changer un mot de passe ferme les sessions ouvertes.
- **Structure pédagogique** (admin) : CRUD formations, niveaux, semestres,
  années universitaires, matières.
- **Fiches de TD** : dépôt par l'enseignant (PDF + image de couverture
  optionnelle, type de fichier vérifié par signature binaire et pas seulement
  par extension), suppression, workflow de statut (brouillon → en attente →
  publiée/refusée). Une fiche publiée modifiée par son enseignant repasse en
  attente de validation.
- **Validation** (admin) : liste des fiches en attente, valider (publication
  immédiate) ou refuser avec commentaire.
- **Catalogue** : recherche (titre, description, matière, enseignant), filtres
  (formation, niveau, semestre, matière, année), pagination. Un étudiant ne
  voit que les fiches de sa filière.
- **Lecteur PDF intégré** + téléchargement, réservés aux utilisateurs
  connectés. Le bucket de stockage est privé : le backend transmet lui-même le
  fichier après avoir revérifié le compte et la fiche, à l'aide d'un jeton de
  120 secondes. Les téléchargements sont comptés et historisés.
- **Favoris**, **historique de téléchargement** et **notifications** (fiche
  publiée, validée ou refusée, signalement traité).
- **Signalements** : tout utilisateur connecté peut signaler une fiche
  publiée ; l'administration traite ou classe le signalement.
- **Tableaux de bord** étudiant, enseignant (fiches publiées/en attente/
  refusées, téléchargements, fiches populaires) et administrateur
  (utilisateurs, fiches, téléchargements, signalements en attente).
- **Gestion des utilisateurs** (admin) : liste, validation des enseignants,
  activation/désactivation de compte.
- **Limites de débit** : par route (connexion, inscription, envoi de fichiers,
  consultation des PDF, signalements), en plus d'un plafond global.
- **Interface** : responsive, mode sombre, toasts de succès/erreur, états de
  chargement/vide gérés partout.

## Vérifications

```bash
npm run test --workspace backend    # tests unitaires (vitest)
npm run lint --workspace backend    # eslint
npm run build:backend               # compilation TypeScript
npm run lint --workspace frontend   # oxlint
npm run build:frontend              # compilation TypeScript + build Vite
```

Il n'y a pas encore de tests côté frontend.

## Mise en production

- Définir `NODE_ENV=production` et des valeurs aléatoires d'au moins 32
  caractères, différentes l'une de l'autre, pour `JWT_ACCESS_SECRET` et
  `JWT_REFRESH_SECRET` : le backend refuse de démarrer sinon.
- Renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` et
  `MAIL_FROM` (voir `backend/.env.example`) : sans eux, aucun email de
  réinitialisation de mot de passe ne part. `CLIENT_URL` doit être l'adresse
  publique du site, car elle sert à construire le lien envoyé.
- Appliquer les migrations avec `npx prisma migrate deploy` (et non
  `prisma migrate dev`, réservé au développement).
- Placer le backend derrière un reverse proxy : `trust proxy` est réglé sur
  un seul saut (voir `backend/src/app.ts`).

## Pas encore fait

- L'image de couverture d'une fiche est enregistrée à l'envoi mais n'est
  affichée nulle part.
- L'API permet de modifier une fiche ou de remplacer son PDF, mais aucun
  écran ne le propose encore.
- Le modèle `Category`, le statut `VALIDATED` et le type de notification
  `TD_NEEDS_CHANGES` existent dans le schéma sans être utilisés.
- Statistiques avancées et recommandations.
