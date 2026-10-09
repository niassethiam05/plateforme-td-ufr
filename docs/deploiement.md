# Mise en ligne sur Render

Ce guide met le site en ligne gratuitement pour une phase de test, puis décrit
le passage à une publication normale. Un seul service Render fait tourner
l'API et sert les pages du site ; la base est chez Neon et les PDF chez
Cloudflare R2.

Les limites et tarifs cités sont ceux relevés en octobre 2026 : vérifiez-les
sur le site de chaque fournisseur.

## Ce que fait le dépôt

| Élément | Rôle |
|---|---|
| `render.yaml` | décrit le service à Render : commandes, réglages, secrets à saisir |
| `npm run build` | génère le client Prisma, compile le backend, construit le frontend |
| `npm run start` | applique les migrations en attente, puis démarre le serveur |

## 1. Créer la base de données (Neon)

1. Créer un compte sur <https://neon.com> puis un projet, région **Europe
   (Frankfurt)** pour être proche du service Render.
2. Dans « Connection details », **désactiver « Connection pooling »** et copier
   la chaîne de connexion. L'hôte ne doit pas contenir `-pooler` : les
   migrations ont besoin d'une connexion directe.
3. Ajouter `&connect_timeout=15` à la fin de la chaîne. La base gratuite se met
   en pause après 5 minutes d'inactivité ; ce délai lui laisse le temps de se
   réveiller.

Forme attendue :

```
postgresql://utilisateur:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15
```

## 2. Créer le stockage des PDF (Cloudflare R2)

1. Créer un compte sur <https://dash.cloudflare.com>, puis ouvrir **R2**. Une
   carte bancaire est demandée pour activer R2, même sur l'offre gratuite.
2. Créer un bucket, par exemple `td-ufr-fichiers`. Le laisser **privé** (ne
   pas activer l'accès public).
3. Dans « Manage R2 API Tokens », créer un jeton avec la permission **Object
   Read & Write**, limité à ce bucket. Noter l'*Access Key ID*, le *Secret
   Access Key* et l'adresse du point d'accès S3, de la forme
   `https://<identifiant-de-compte>.r2.cloudflarestorage.com`.

## 3. Créer le service (Render)

1. Créer un compte sur <https://render.com> et le relier à GitHub.
2. **New → Blueprint**, choisir le dépôt `plateforme-td-ufr`. Render lit
   `render.yaml` et demande les valeurs ci-dessous.
3. Lancer le déploiement. La première construction prend quelques minutes.
   Le site est ensuite disponible à l'adresse `https://<nom>.onrender.com`.

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | la chaîne de connexion Neon (étape 1) |
| `STORAGE_ENDPOINT` | `https://<identifiant-de-compte>.r2.cloudflarestorage.com` |
| `STORAGE_BUCKET` | le nom du bucket R2 |
| `STORAGE_ACCESS_KEY_ID` | l'Access Key ID du jeton R2 |
| `STORAGE_SECRET_ACCESS_KEY` | le Secret Access Key du jeton R2 |
| `ADMIN_EMAIL` | votre adresse email (une vraie boîte) |
| `ADMIN_PASSWORD` | un mot de passe d'au moins 12 caractères |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | laisser vide pour l'instant (voir étape 6) |

Les autres réglages sont déjà fixés par `render.yaml`, et les deux secrets JWT
sont générés par Render.

## 4. Premier démarrage

1. Dans les journaux du service (onglet **Logs**), vérifier la ligne
   `Compte administrateur cree pour ...`.
2. Se connecter sur le site avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`.
3. **Supprimer `ADMIN_PASSWORD`** dans l'onglet **Environment** de Render,
   puis changer le mot de passe depuis la page Profil du site. Ces variables
   n'ont plus aucun effet dès qu'un administrateur existe.
4. Créer la structure pédagogique depuis l'espace d'administration :
   formations, niveaux, années universitaires, semestres, matières.

Ne jamais lancer `npm run prisma:seed` sur la base en ligne : il crée des
comptes de démonstration dont le mot de passe est public.

## 5. Vérifier l'adresse des visiteurs dans les journaux

Les limites de débit comptent par adresse IP. Si le backend voit l'adresse
d'un proxy au lieu de celle du visiteur, tous les utilisateurs partagent le
même compteur.

1. Ouvrir le site depuis votre navigateur, puis chercher votre visite dans
   les journaux Render. Chaque ligne commence par une adresse IP.
2. Comparer avec votre adresse publique (affichée par exemple sur
   <https://ifconfig.me>).
3. Si ce n'est pas la vôtre, augmenter `TRUST_PROXY` de 1 dans l'onglet
   **Environment** (2, puis 3), jusqu'à ce que votre adresse apparaisse.

## 6. Emails « mot de passe oublié »

Sans réglage SMTP, aucun email n'est envoyé : la fonction « mot de passe
oublié » ne sert à rien tant que cette étape n'est pas faite.

**Attention, offre gratuite de Render :** les services gratuits ne peuvent pas
sortir sur les ports 25, 465 et 587, ceux qu'utilisent Gmail et la plupart des
services d'email. Deux possibilités :

- **Pendant la phase gratuite** : utiliser un fournisseur d'envoi qui accepte
  le port **2525**. Renseigner `SMTP_HOST`, `SMTP_PORT=2525`, `SMTP_USER`,
  `SMTP_PASSWORD` et `MAIL_FROM` avec les valeurs qu'il fournit. `MAIL_FROM`
  doit être une adresse d'expéditeur validée chez lui.
- **Après le passage en formule payante** : les ports habituels sont ouverts.
  Une adresse Gmail dédiée fonctionne alors : `SMTP_HOST=smtp.gmail.com`,
  `SMTP_PORT=587`, l'adresse dans `SMTP_USER` et `MAIL_FROM`, et un « mot de
  passe d'application » Google dans `SMTP_PASSWORD`.

Tester ensuite avec votre propre adresse, et regarder aussi dans les
courriers indésirables.

## 7. Parcours à tester

1. Inscription d'un enseignant, puis validation depuis « Utilisateurs ».
2. Dépôt d'une fiche (PDF) par l'enseignant, puis soumission.
3. Validation de la fiche par l'administrateur.
4. Inscription d'un étudiant de la même filière ; la fiche apparaît dans le
   catalogue.
5. **Lecture du PDF dans la page** et téléchargement.
6. Favoris, signalement, notifications.
7. Mot de passe oublié avec une vraie adresse (après l'étape 6).
8. Rester connecté plus de 15 minutes puis naviguer : la session doit se
   prolonger sans repasser par la connexion.

## 8. Passage à la publication normale

1. Dans Render, passer le service de **Free** à **Starter** : il ne s'endort
   plus. Aucune donnée n'est déplacée.
2. Acheter un nom de domaine et l'ajouter dans **Settings → Custom Domains**,
   en suivant les enregistrements DNS indiqués par Render.
3. Ajouter la variable `CLIENT_URL` avec la nouvelle adresse (par exemple
   `https://fiches-td.example.sn`), sans barre oblique finale. Elle sert aux
   liens envoyés par email.
4. Décider du sort des données de test : les garder, ou repartir d'une base
   vide (nouveau projet Neon, puis mise à jour de `DATABASE_URL`).

## Limites connues de l'offre gratuite

- Le service s'endort après 15 minutes sans visite ; la visite suivante
  attend environ une minute.
- Pas d'accès au terminal du service : tout passe par les variables
  d'environnement et les journaux.
- Ports SMTP 25, 465 et 587 fermés (voir étape 6).
- Neon : 1 Go de base. R2 : 10 Go de fichiers.

## Mises à jour

Chaque `git push` sur `master` déclenche un nouveau déploiement : Render
reconstruit le site, applique les migrations, puis redémarre le service.
