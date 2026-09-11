# BDD Creator — Gestion simplifiée des bases de données MySQL

Application web permettant de créer, explorer et administrer des bases de données MySQL sans écrire de SQL : gestion des bases, des tables, des colonnes et des lignes depuis une interface React, via une API REST en PHP « from scratch » (pas de framework).

> ⚠️ **Projet pédagogique / prototype.** L'API construit une grande partie de ses requêtes SQL par concaténation de chaînes (voir [Sécurité](#-sécurité--limites-connues)). Ne pas exposer cette API sur un réseau non maîtrisé sans corriger ces points au préalable.

## Sommaire

- [Aperçu](#-aperçu)
- [Architecture du dépôt](#-architecture-du-dépôt)
- [Stack technique](#-stack-technique)
- [Démarrage rapide (Docker)](#-démarrage-rapide-docker)
- [Configuration](#-configuration)
- [Frontend — pages et routes](#-frontend--pages-et-routes)
- [API — endpoints](#-api--endpoints)
- [Sauvegarde / restauration (dump SQL)](#-sauvegarde--restauration-dump-sql)
- [Tests](#-tests)
- [Intégration continue](#-intégration-continue)
- [Sécurité & limites connues](#-sécurité--limites-connues)
- [Pistes d'amélioration](#-pistes-damélioration)
- [Licence](#-licence)

## 📌 Aperçu

BDD Creator est composé de deux applications distinctes qui communiquent en HTTP/JSON :

- **`BDD_Creator/`** — API REST en PHP 8.3 (sans framework), organisée en routes par verbe HTTP, qui pilote une base MySQL via PDO.
- **`front_bdd_creator/`** — Client React 18 (Create React App + React Router) qui consomme cette API pour offrir une interface de type « phpMyAdmin simplifié ».

Fonctionnalités couvertes :

- ✅ Créer / renommer / supprimer une base de données
- ✅ Créer / renommer / supprimer une table
- ✅ Ajouter / renommer / modifier / supprimer une colonne
- ✅ Insérer / lister / modifier / supprimer des lignes
- ✅ Exporter une base sous forme de dump `.sql` (via `mysqldump`)
- ✅ Restaurer une base à partir d'un dump précédemment généré
- 🕓 Génération d'un JWT au chargement de l'API (mise en place initiale, pas encore utilisée pour protéger les routes — voir [Sécurité](#-sécurité--limites-connues))

## 🗂 Architecture du dépôt

```
BDD_Depresion/
├── docker-compose.yaml        # Orchestration des 3 services : php-api, react-frontend, mysql
├── php.ini                    # Config PHP montée dans le conteneur php-api
├── .github/workflows/         # Pipeline CI (composer, npm, docker-compose, PHPUnit)
│
├── BDD_Creator/                       # API PHP
│   ├── Dockerfile                     # Image php:8.3-apache + PDO MySQL + Composer
│   ├── composer.json                  # Dépendances (firebase/php-jwt, phpunit)
│   └── src/
│       ├── index.php                  # Point d'entrée (bootstrap + génération JWT)
│       ├── conf.php                   # Paramètres de connexion MySQL ($HOST/$USERNAME/$PASSWORD)
│       ├── cron_script.php            # Script de dump automatique (usage cron)
│       ├── Class/
│       │   ├── Database.php           # Couche d'accès aux données (CRUD bases/tables/colonnes/lignes)
│       │   ├── Table.php              # Extension de Database dédiée à la création de tables
│       │   └── User.php               # Squelette (non implémenté)
│       ├── routes/                    # Une route = un fichier PHP autonome, groupé par verbe HTTP
│       │   ├── GET/{database,table}/…
│       │   ├── POST/{database,table}/…
│       │   ├── PATCH/{database,table}/…
│       │   └── DELETE/{database,table}/…
│       └── dump/                      # Fichiers .sql générés par l'export/dump
│   └── tests/functional/DatabaseTest.php  # Tests PHPUnit contre une vraie base MySQL
│
└── front_bdd_creator/                 # Client React
    ├── Dockerfile                     # Image node:20, npm start
    ├── package.json
    └── src/
        ├── App.js                     # Déclaration des routes React Router
        ├── utils/utils.js             # Client HTTP (fetch) vers chaque endpoint de l'API
        └── components/
            ├── Header/                # Barre de navigation
            ├── Home/                  # Liste des bases de données
            ├── Database/              # Vue « liste des bases » / création
            ├── Table/                 # Vue « liste des tables » d'une base
            ├── SelectedTable/         # Vue détail d'une table (lignes/colonnes)
            ├── Modules/
            │   ├── PATCH/             # Formulaires de mise à jour
            │   ├── DELETE/            # Confirmations de suppression (table, base)
            │   └── save/              # Export / restauration de bases (RestoreDatabase)
            └── Test/                  # Composant de test
```

## 🛠 Stack technique

| Couche      | Technologies |
|-------------|--------------|
| Frontend    | React 18, React Router 6, Create React App (react-scripts 5), CSS pur |
| Backend     | PHP 8.3 (Apache), PDO / PDO MySQL, [firebase/php-jwt](https://github.com/firebase/php-jwt) |
| Base de données | MySQL 5.7 |
| Tests       | PHPUnit 11 (tests fonctionnels contre une vraie instance MySQL) |
| Conteneurisation | Docker, Docker Compose |
| CI          | GitHub Actions |

## 🚀 Démarrage rapide (Docker)

### Prérequis

- Docker & Docker Compose
- (Optionnel, pour du développement hors conteneur) Node.js 18+, PHP 8.3 avec l'extension PDO MySQL, Composer

### Lancer le projet

```bash
docker-compose up -d --build
```

Trois services démarrent (voir [docker-compose.yaml](docker-compose.yaml)) :

| Service          | Image / build          | Port hôte → conteneur | Rôle |
|------------------|-------------------------|------------------------|------|
| `php-api`        | build de `BDD_Creator/` | `80 → 80`               | API REST PHP servie par Apache |
| `react-frontend` | build de `front_bdd_creator/` | `3000 → 3000`     | Interface React (hot-reload via `CHOKIDAR_USEPOLLING`) |
| `mysql`          | `mysql:5.7`             | `3307 → 3306`           | Base de données (volume persistant `mysql-data`) |

➡️ Frontend : http://localhost:3000
➡️ API : http://localhost/src/routes/... (voir la liste des endpoints ci-dessous)

Les répertoires `BDD_Creator/` et `front_bdd_creator/` sont montés en volumes : toute modification du code source est immédiatement visible dans les conteneurs.

## ⚙️ Configuration

La connexion MySQL de l'API est définie « en dur » dans [`BDD_Creator/src/conf.php`](BDD_Creator/src/conf.php) :

```php
$HOST = 'mysql';       // nom du service docker-compose de la base
$USERNAME = 'root';
$PASSWORD = 'root';
```

Ces valeurs doivent correspondre à `MYSQL_ROOT_PASSWORD` défini dans [`docker-compose.yaml`](docker-compose.yaml). Il n'y a pas de fichier `.env` : toute modification (nom d'hôte, identifiants) se fait directement dans ce fichier.

Le frontend appelle l'API en dur sur `http://localhost` (voir [`front_bdd_creator/src/utils/utils.js`](front_bdd_creator/src/utils/utils.js)) : si l'API est exposée sur un autre host/port, ces URLs doivent être adaptées.

## 🖥 Frontend — pages et routes

Déclarées dans [`front_bdd_creator/src/App.js`](front_bdd_creator/src/App.js) :

| Route React                          | Composant           | Description |
|---------------------------------------|----------------------|--------------|
| `/`                                    | `Home`               | Liste des bases de données existantes |
| `/database`                            | `Database`           | Vue dédiée gestion des bases |
| `/database/create`                     | `CreateDatabase`     | Formulaire de création d'une base |
| `/restore`                             | `RestoreDatabase`    | Restauration d'une base à partir d'un dump sauvegardé |
| `/:databaseName`                       | `Table`              | Liste des tables d'une base |
| `/:databaseName/createTable`           | `CreateTables`       | Formulaire de création d'une table |
| `/:databaseName/delete`                | `DeleteDatabase`     | Confirmation de suppression d'une base |
| `/:databaseName/:tableName`            | `SelectedTable`      | Détail d'une table : colonnes, lignes, édition |
| `/:databaseName/delete/:tableName`     | `DeleteTable`        | Confirmation de suppression d'une table |

Toute la logique d'appel réseau est centralisée dans [`utils.js`](front_bdd_creator/src/utils/utils.js) (une fonction par endpoint : `getDatabaseCollection`, `createTable`, `insertRow`, `deleteRow`, `updateRow`, `dumpBase`, `restoreDatabase`, …).

## 🔌 API — endpoints

Chaque route est un script PHP indépendant (pas de routeur central), organisé par verbe HTTP sous `BDD_Creator/src/routes/<METHOD>/<domaine>/<action>.php`. Toutes les routes :

- répondent en `application/json` ;
- autorisent CORS (`Access-Control-Allow-Origin: *`) ;
- attendent un corps JSON (`php://input`) pour les méthodes autres que GET simple.

### Bases de données (`database`)

| Méthode | Route | Payload | Description |
|---------|-------|---------|--------------|
| GET  | `GET/database/getCollectionDatabases.php` | — | Liste toutes les bases (hors bases système) |
| POST | `GET/database/getDatabase.php` | `{ databaseName }` | Vérifie/récupère une base |
| POST | `POST/database/createDatabase.php` | `{ databaseName }` | Crée une base |
| DELETE | `DELETE/database/dropDatabase.php` | `{ databaseName }` | Supprime une base |
| PATCH | `PATCH/database/updateDatabaseName.php` | `{ databaseName, newDatabaseName }` | Renomme une base |
| POST | `POST/database/dumpDatabase.php` | `{ databaseName }` | Exporte la base en `.sql` via `mysqldump` |
| GET  | `GET/database/getDatabaseSave.php` | — | Liste les dumps disponibles |
| POST | `POST/database/restoreDatabase.php` | `{ databaseName, databaseNewName }` | Restaure un dump sous un nouveau nom |

### Tables & colonnes (`table`)

| Méthode | Route | Payload | Description |
|---------|-------|---------|--------------|
| POST | `GET/table/getCollectionTable.php` | `{ databaseName }` | Liste les tables d'une base |
| POST | `GET/table/getTable.php` | `{ databaseName, tableName }` | Récupère la structure d'une table |
| POST | `GET/table/getTableColumnValue.php` | `{ databaseName, tableName }` | Récupère les colonnes + valeurs |
| POST | `POST/table/createTable.php` | `{ databaseName, tableName, columns }` | Crée une table |
| PATCH | `PATCH/table/updateTableName.php` | `{ databaseName, tableName, newTableName }` | Renomme une table |
| DELETE | `DELETE/table/dropTables.php` | `{ databaseName, tableName }` | Supprime une table |
| POST | `POST/table/createColumn.php` | `{ databaseName, tableName, columnName, columnType }` | Ajoute une colonne |
| PATCH | `PATCH/table/updateColumn.php` | `{ databaseName, tableName, columnName, newColumnName, columnType }` | Modifie une colonne |
| DELETE | `DELETE/table/dropColumn.php` | `{ databaseName, tableName, columnName }` | Supprime une colonne |

### Lignes (`table`)

| Méthode | Route | Payload | Description |
|---------|-------|---------|--------------|
| POST | `POST/table/insertRow.php` | `{ databaseName, tableName, values }` | Insère une ligne |
| POST | `GET/table/getRow.php` | `{ databaseName, tableName, columnName, value }` | Récupère une ligne précise |
| POST | `GET/table/getCollectionRow.php` | `{ databaseName, tableName }` | Liste toutes les lignes |
| PATCH | `PATCH/table/updateRow.php` | `{ databaseName, tableName, columnName, value, data }` | Met à jour une ligne |
| DELETE | `DELETE/table/dropRow.php` | `{ databaseName, tableName, columnName, value }` | Supprime une ligne |

> La logique métier (construction des requêtes SQL, exécution PDO) vit dans [`BDD_Creator/src/Class/Database.php`](BDD_Creator/src/Class/Database.php) (et `Table.php` pour la création de tables) ; chaque script de route ne fait qu'instancier `Database`, valider la méthode HTTP et relayer le résultat en JSON.

## 💾 Sauvegarde / restauration (dump SQL)

- `POST /database/dumpDatabase.php` exécute `mysqldump` en ligne de commande et écrit le résultat dans `BDD_Creator/src/dump/<databaseName><date>_<timestamp>.sql`.
- `GET /database/getDatabaseSave.php` liste les fichiers présents dans ce dossier pour permettre à l'écran « Restore » du frontend de proposer une restauration.
- `BDD_Creator/src/cron_script.php` reproduit cette logique pour un usage planifié (cron) : il parcourt toutes les bases (hors bases système) et produit un dump quotidien par base. ⚠️ Ce script contient encore des chemins Windows (`C:\wamp64\www\...`) hérités d'un environnement de dev local — à adapter (`/var/www/html/src/dump/...`) avant toute utilisation en conteneur.

## ✅ Tests

Les tests fonctionnels ([`BDD_Creator/tests/functional/DatabaseTest.php`](BDD_Creator/tests/functional/DatabaseTest.php)) s'exécutent avec PHPUnit contre une vraie instance MySQL (pas de mock) : création de base, création de tables, ajout/suppression de colonnes, etc.

```bash
cd BDD_Creator
composer install
./vendor/bin/phpunit tests/functional/DatabaseTest.php
```

À exécuter avec une base MySQL accessible via les identifiants définis dans le test (`mysql` / `root` / `root`), par exemple en ayant lancé `docker-compose up -d mysql` au préalable.

## 🔄 Intégration continue

Le workflow [`.github/workflows/github-actions-demo.yml`](.github/workflows/github-actions-demo.yml) se déclenche sur chaque `push` et :

1. installe PHP 8.2 et les dépendances Composer/npm ;
2. démarre l'ensemble via `docker-compose up -d` ;
3. relance l'autoload Composer dans le conteneur `php-api` ;
4. exécute les tests PHPUnit fonctionnels dans le conteneur.

## 🔐 Sécurité & limites connues

Ce projet est un prototype ; plusieurs points sont à corriger avant tout usage en production :

- **Injection SQL** : la plupart des méthodes de `Database.php`/`Table.php` construisent leurs requêtes par concaténation directe des paramètres reçus (`"CREATE DATABASE $databaseName"`, `"DROP DATABASE $databaseName"`, noms de colonnes/tables interpolés, …) plutôt que via des requêtes préparées avec paramètres liés. Les noms d'objets SQL (base, table, colonne) devraient être whitelistés/échappés, et les valeurs de données passées en paramètres liés PDO.
- **Injection de commande** : `dumpDatabase.php` et `cron_script.php` construisent une commande shell (`exec("mysqldump --user=... --password=... ...")`) à partir du nom de base fourni par l'utilisateur, sans échappement (`escapeshellarg`) — un nom de base malveillant pourrait injecter des arguments shell.
- **Pas d'authentification effective** : `index.php` génère un JWT au chargement avec une clé (`"your_secret_key"`), un `issuer` et une `audience` codés en dur, mais aucune route ne vérifie actuellement ce token — n'importe qui peut appeler l'API.
- **CORS ouvert** (`Access-Control-Allow-Origin: *`) sur toutes les routes.
- **Identifiants en clair** dans `conf.php` et `docker-compose.yaml` (`root`/`root`), à sortir en variables d'environnement / secrets avant tout déploiement réel.
- `cron_script.php` référence encore des chemins Windows locaux (`C:\wamp64\www\...`), incompatibles avec l'exécution en conteneur Linux.

## 🧭 Pistes d'amélioration

- Passer toutes les requêtes SQL en requêtes préparées + whitelist des identifiants (bases/tables/colonnes).
- Activer réellement la vérification du JWT sur les routes sensibles (création/suppression) et sortir la clé secrète en variable d'environnement.
- Restreindre CORS aux origines connues.
- Ajouter un routeur central (au lieu d'un script PHP par endpoint) pour factoriser CORS, auth et validation.
- Compléter la classe `User.php` (actuellement un squelette) si une authentification utilisateur est prévue.
- Ajouter des tests unitaires (avec mocks PDO) en complément des tests fonctionnels existants.

## 📜 Licence

Projet sous licence MIT — utilisation libre et open-source.

## 📬 Contact & contribution

Les suggestions d'amélioration sont bienvenues via issues et pull requests sur [le dépôt GitHub](https://github.com/clement-machtelinckx/BDD_Depresion).
