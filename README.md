# DematBot

Bot Discord du serveur communautaire **DematGames** — édition physique de jeux indés.

Il construit et gère la structure du serveur (salons, catégories, rôles, permissions), anime la partie communautaire, et pilote la partie studio : annonces, sorties, précommandes, catalogue, support client et soumissions de jeux par les développeurs.

---

## Installation

### 1. Créer l'application Discord

1. Va sur le [portail développeur Discord](https://discord.com/developers/applications) → **New Application**.
2. Onglet **Bot** → **Reset Token** → copie le token.
3. Toujours dans **Bot**, active les trois *Privileged Gateway Intents* :
   - `PRESENCE INTENT` (facultatif)
   - **`SERVER MEMBERS INTENT`** (obligatoire — accueil des membres, rôles)
   - **`MESSAGE CONTENT INTENT`** (obligatoire — automod)
4. Onglet **General Information** → copie l'**Application ID**.

### 2. Inviter le bot

Remplace `TON_CLIENT_ID` puis ouvre l'URL :

```
https://discord.com/api/oauth2/authorize?client_id=TON_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

La permission **Administrateur** (`8`) est nécessaire pour créer salons, catégories et rôles. Place le rôle du bot **au-dessus** des rôles qu'il doit gérer dans *Paramètres du serveur → Rôles*.

### 3. Configurer

```bash
cp .env.example .env
```

Renseigne `DISCORD_TOKEN`, `CLIENT_ID` et `GUILD_ID` (clic droit sur ton serveur → *Copier l'identifiant*, avec le mode développeur activé).

### 4. Lancer

```bash
npm install
npm run deploy   # enregistre les slash commands sur le serveur
npm start        # démarre le bot
```

> Node 22.5+ requis : la base SQLite utilise le module natif `node:sqlite`, sans compilation.

---

## Déploiement sur Railway

1. **New Project → Deploy from GitHub repo** → sélectionne `dematbot`.
2. Onglet **Variables** → ajoute `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.
3. **Ajoute un volume** (onglet *Volumes*, point de montage `/data`) puis la variable :

   ```
   DB_PATH=/data/data.db
   ```

   Sans volume, le système de fichiers de Railway est éphémère : la base serait remise à zéro à chaque redéploiement, et le bot perdrait les ids de salons, le catalogue et les tickets.

4. Railway lance `npm start` automatiquement (voir `railway.json`). Le bot est un worker : il n'expose aucun port, ne configure pas de domaine.

Le déploiement des slash commands (`npm run deploy`) est une opération ponctuelle, à relancer depuis ta machine après chaque ajout ou modification de commande.

---

## Premier démarrage

Dans cet ordre, sur un **serveur de test** avant le vrai serveur :

```
/setup simulation:true   → affiche ce qui serait créé, sans rien modifier
/setup                   → crée rôles, catégories, salons et permissions
/panneaux                → publie règlement, rôles, support, espace devs, FAQ, en-têtes de salons
/panel                   → publie le hub de gestion dans #panel-admin
```

`/setup` est **idempotent** : relance-le autant de fois que tu veux, il ne crée que ce qui manque. Les salons existants sont retrouvés par leur id mémorisé en base, puis rattachés et renommés selon le blueprint — jamais dupliqués, et sans perdre un seul message.

`/panneaux` l'est aussi : il retrouve chaque message permanent par le titre de son embed et le **met à jour** au lieu d'en empiler un nouveau. Relance-le après toute modification d'un texte d'embed.

### Habillage des salons

Les salons portent un emoji suivi du séparateur `・` (`📢・annonces`, `💬・général`…), défini dans `src/config/blueprint.js`. Pour changer un emoji ou un nom : édite le blueprint et relance `/setup`.

Les **embeds d'en-tête** ne sont publiés que dans les salons vitrine (`coulisses`, `vitrine-devs`, `retours-et-idées`, `projets-en-cours`, `sorties-et-précommandes`), le forum et les salons staff. Les salons de discussion (`général`, `hors-sujet`, `jeux-vidéo`, `actus-gaming`, `clips`, `recherche-de-joueurs`, `créations`, `entraide-dev`) restent volontairement vierges pour ne pas gêner la conversation.

---

## Dépannage

### `DiscordjsError [TokenInvalid]: An invalid token was provided`

Le bot vérifie sa configuration au démarrage et affiche la cause exacte avant de tenter la connexion. Relance-le et lis le message : il distingue les cas courants.

- **« un caractère en trop au début »** — un copier-coller a dupliqué le premier caractère. Retire-le, ou recopie le token.
- **« appartiennent à deux applications différentes »** — le token vient d'une application Discord et le `CLIENT_ID` d'une autre. Reprends **les deux valeurs dans la même application** : onglet *Bot* → *Reset Token*, et *General Information* → *Application ID*.
- **« mal formé »** ou **« illisible »** — la valeur est tronquée ou altérée. Fais *Reset Token* et recopie l'intégralité.

Discord ne réaffiche jamais un token existant : le seul moyen fiable d'en récupérer un est **Reset Token**. Un token exposé (logs, capture d'écran, commit) doit être réinitialisé immédiatement.

Sur Railway, saisis les variables sans guillemets ni espaces autour du `=`. Les guillemets et espaces parasites sont retirés automatiquement, avec un avertissement dans les logs.

---

## Commandes

| Commande | Rôle |
|---|---|
| `/setup [simulation]` | Construit ou met à jour la structure du serveur |
| `/panel [salon]` | Publie le hub de gestion à boutons |
| `/panneaux` | Publie tous les messages permanents |
| `/salon` | `creer` · `renommer` · `supprimer` · `deplacer` · `verrouiller` · `deverrouiller` · `slowmode` |
| `/categorie` | `creer` · `renommer` · `supprimer` · `synchroniser` |
| `/jeu` | `liste` · `voir` · `retirer` |
| `/mod` | `warn` · `warns` · `unwarn` · `mute` · `unmute` · `kick` · `ban` · `unban` · `clear` |

## Le panneau admin

`/panel` publie un message épinglé dans `#panel-admin`. Chaque bouton ouvre un formulaire, affiche un aperçu, puis publie dans le bon salon :

- **Annonce** → `#annonces`, avec ping optionnel du rôle *📢 Annonces*
- **Sortie** → `#sorties-et-précommandes`, ping *🚀 Sorties*
- **Précommande** → `#sorties-et-précommandes`, ping *🚀 Sorties*
- **Fiche jeu** → `#catalogue` + création du post dans le forum jeux
- **Panneaux** → republie règlement, rôles, support, espace devs, FAQ, catalogue
- **Partenaire** → promeut un membre en *🎮 Développeur partenaire*

Les `customId` sont statiques : le panneau reste fonctionnel après un redémarrage du bot.

---

## Espace développeurs

`#éditer-mon-jeu` porte l'offre DematGames et deux boutons :

- **Soumettre mon jeu** — parcours en 5 étapes (état du jeu, tirage, type d'édition, taille d'équipe, puis un formulaire nom/description/lien/contact). À la validation, un salon privé `dev-0001-nom-du-jeu` est créé sous `🎫 TICKETS`, avec le récapitulatif épinglé et le staff notifié.
- **Poser une question** — ticket d'échange simple avec le staff.

Dans le salon de soumission, le staff dispose de **Prendre en charge**, **Accepter le projet** (attribue *Développeur partenaire* et ouvre `#projets-en-cours`), **Mettre en attente** et **Fermer** (transcript vers `#logs-bot`, puis suppression).

---

## Modération

`/mod` couvre avertissements, mute (timeout natif), kick, ban et purge. Les avertissements sont persistés ; au-delà de 3, le bot le signale au staff.

L'automod (`src/events/messageCreate.js`) supprime les invitations vers d'autres serveurs, bloque le mass-mention (> 5) et applique un timeout d'une minute en cas de flood (5 messages en 5 s). Le staff en est exempté. Tout est journalisé dans `#logs-bot`.

---

## Personnaliser

| Fichier | Contenu |
|---|---|
| `src/config/blueprint.js` | **La structure du serveur** : rôles, catégories, salons, permissions. Modifie, relance `/setup`. |
| `src/config/brand.js` | Couleurs, emojis, lien du site, arguments de vente |
| `src/lib/permissions.js` | Les presets de permissions (`PUBLIC_READONLY`, `MEMBER_CHAT`, `DEV_PARTNER`…) |
| `src/lib/embeds.js` | L'apparence de tout ce que le bot publie |
| `src/lib/layout.js` | Séparateurs, puces et titres de section partagés par tous les embeds |
| `src/components/rules.js` | Le texte du règlement |

Après tout ajout ou modification de commande : `npm run deploy`.

---

## Structure

```
src/
├── index.js              démarrage du client
├── deploy-commands.js    enregistrement des slash commands
├── config/               blueprint du serveur + charte de marque
├── db/                   SQLite (node:sqlite) + schéma
├── lib/                  permissions, embeds, logger, résolution guild, loader
├── commands/             admin/ · studio/ · moderation/
├── components/           hub admin, tickets, panneau de rôles, règlement
└── events/               ready, interactionCreate, guildMemberAdd, messageCreate
```

Les interactions de composants suivent la convention `domaine:action:argument` et sont routées par un dispatcher unique dans `src/events/interactionCreate.js`.

La base `data.db` est créée au premier démarrage à la racine du projet. Elle contient la configuration résolue (ids de salons et de rôles), le catalogue, les tickets, les soumissions et les avertissements.
