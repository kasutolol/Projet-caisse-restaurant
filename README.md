# 🍽️ App de Prise de Commande Restaurant

App mobile (Expo / React Native + FastAPI + MongoDB) pour serveurs de restaurant, en français.
Conçue pour le service en salle : prise de commande rapide par table, avec gestion des **rounds** ("à suivre") et des **options par plat** (cuisson, sauce, sirop, parfum…).

---

## 🎯 Contexte d'utilisation

- **Utilisateur cible** : serveur en service dans un restaurant français de type brasserie / bistrot.
- **Objectif principal** : prendre une commande en mouvement, sans erreur, sans devoir se rappeler manuellement de ce qui a été tapé.
- **Contraintes UX** :
  - Doigts qui peuvent être humides / sales / pressés.
  - Boutons grands, contrastes élevés, retours visuels INSTANTANÉS.
  - Tout doit être visible en 1-2 tap maximum.

---

## ✅ Fonctionnalités actuelles

### 1. Écran d'accueil — Tables
- Saisie directe du **numéro de table** (n'importe quel numéro, créé à la volée).
- Choix du **nombre de couverts** (chips 1-8 + saisie libre).
- Liste des **tables en cours** (occupées) avec bouton de reprise rapide.
- Bouton **Historique** pour voir les commandes passées.

### 2. Écran Commande (par table)
- Affichage **groupé par rounds** :
  - ⚡ **EN DIRECT** = 1ʳᵉ tournée (envoyée tout de suite au bar/cuisine)
  - ➡️ **À SUIVRE 1**, **À SUIVRE 2**, … = tournées suivantes
- **Couleurs par catégorie** sur chaque article (cadre coloré + fond pastel).
- Bouton **"+ Nouvelle ligne À SUIVRE"** pour créer une tournée.
- **Long-press → tap zone** pour déplacer un article entre tournées (simule un drag).
- Quantité +/-, suppression auto à 0.
- Modification des **couverts à tout moment**.
- Boutons **Envoyer** (marque comme envoyé au bar/cuisine) et **Clôturer** (libère la table).
- Confirmation de clôture par modal custom (fonctionne même si la commande est vide).

### 3. Écran Menu (ajout d'articles)
- **13 catégories** organisées : Apéritifs → Boissons fraîches → Vins au verre → Tapas → Entrées → Plats → Desserts → Boissons chaudes → Vins rouges → Vins blancs → Vins rosés → Champagnes → Digestifs.
- Barre de catégories horizontale (couleurs distinctes par catégorie).
- **Recherche transversale** (insensible aux accents) sur tous les articles.
- **Panneau récap LIVE en haut** (toujours visible) :
  - Compteur d'articles · total en € · 3 derniers articles avec quantité + options + prix.
  - Mise à jour **optimiste** (instantanée, sans attendre le serveur).
  - Bouton **"Tout"** pour voir l'intégralité de la commande groupée par round.
- Bouton **bleu "À suivre"** dans le header → crée un nouveau round sans quitter le menu.
- Bouton **vert "Terminé"** → retour à l'écran commande.
- **Options obligatoires** par article (modal bottom-sheet) :
  - Cuisson (Entrecôte : Bleu / Saignant / À point / Bien cuit)
  - Sauce (Moules : Marinière / Curry / Gorgonzola / Provençale)
  - Parfum sirop (Diabolo, Sirop à l'eau : 13 parfums dont **DBK = Banane Kiwi**)
  - Parfums multiples pour glaces (1, 2, ou 3 boules)
  - Choix charcuterie / fromage / mixte pour ardoise
  - … (~50 options sur ~150 articles)
- Champ **Note libre** par article (allergies, demandes spéciales).
- Retour visuel à chaque tap : **scale + flash vert + toast "+1 [nom]"**.

### 4. Historique
- Onglets **En cours** / **Clôturées**.
- Récap de chaque commande : table, couverts, total, 4 premiers articles.

---

## 🏗️ Architecture technique

```
/app
├── backend/                       ← FastAPI + MongoDB
│   ├── server.py                  ← Endpoints REST (~280 lignes)
│   ├── menu_seed.py               ← Carte complète du restaurant
│   ├── .env                       ← MONGO_URL, DB_NAME (à ne pas modifier)
│   └── requirements.txt
└── frontend/                      ← Expo Router (React Native)
    ├── src/
    │   ├── api.ts                 ← Constantes COLORS, fmtPrice, fonction api()
    │   └── utils/storage/         ← KV storage cross-platform
    └── app/
        ├── _layout.tsx            ← Layout racine
        ├── index.tsx              ← Écran Tables
        ├── menu.tsx               ← Écran Menu + recherche + panneau live
        ├── orders.tsx             ← Historique
        └── order/
            └── [id].tsx           ← Écran Commande (rounds, options)
```

### Stack
- **Frontend** : Expo SDK 54, React Native, Expo Router, TypeScript, Ionicons
- **Backend** : FastAPI, Motor (MongoDB async), Pydantic v2
- **DB** : MongoDB (collections : `menu`, `tables`, `orders`)
- **Auth** : aucune (accès direct, app interne)

### Endpoints REST (préfixe `/api`)
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/menu` | Toutes les catégories + articles + option_groups |
| GET | `/tables` | Liste des tables (en cours) |
| POST | `/tables/open-by-number` | Crée/reprend une table par numéro (body `{number, covers}`) |
| PUT | `/tables/{id}` | Met à jour une table |
| GET | `/orders/{id}` | Détail commande |
| POST | `/orders/{id}/items` | Ajoute un article (course auto = next_course) |
| PUT | `/orders/{id}/items/{item_id}/quantity?quantity=N` | Modifie qté (0 = supprime) |
| DELETE | `/orders/{id}/items/{item_id}` | Supprime un article |
| PUT | `/orders/{id}/items/{item_id}/course?course=N` | Déplace un article entre rounds |
| POST | `/orders/{id}/next-course` | Incrémente `next_course` (nouvelle ligne "à suivre") |
| PUT | `/orders/{id}/covers?covers=N` | Modifie le nombre de couverts |
| POST | `/orders/{id}/send` | Marque tous les items comme envoyés |
| POST | `/orders/{id}/close` | Clôture commande + libère table |
| GET | `/orders?status=open\|closed` | Historique |

### Modèles principaux

```python
class OrderItem:
    id, item_name, category_key, unit_price, quantity, options, note,
    sent (bool), course (int = 1 → EN DIRECT, 2 → À SUIVRE 1, ...)

class Order:
    id, table_id, table_number, covers, items[], status (open|closed),
    next_course (int = round actif pour nouveaux items)

class MenuItem (dans menu_seed.py):
    name, price, unit?, option_groups?[
      { name, type: "single"|"multi", required, max?, choices[] }
    ]
```

---

## 💡 Mes idées et besoins (pour ChatGPT)

L'app est un **MVP fonctionnel**. Voici les évolutions souhaitées par ordre de priorité :

### Court terme — UX en service
1. **Séparation Bar / Cuisine** : à l'envoi (`/send`), générer **2 tickets distincts** (un pour le bar = boissons + alcools, un pour la cuisine = plats + entrées + desserts). Actuellement tout est mélangé.
2. **Impression / partage du ticket** : générer un **PDF lisible** du ticket complet (ou texte WhatsApp / email) avec les couverts, articles groupés par round, et le total. Imprimable depuis l'iPhone.
3. **Modification d'un article ajouté** : changer la cuisson, la sauce ou les options d'un article déjà dans la commande sans devoir le supprimer et le re-créer.
4. **Vrai drag-and-drop** entre rounds (actuellement : long-press + tap, je voudrais un vrai glisser-déposer fluide avec `react-native-gesture-handler` / `reanimated`).

### Moyen terme — Gestion du service
5. **Menu du jour éditable** depuis l'app (interface admin pour ajouter/modifier des plats sans toucher au code Python).
6. **Multi-serveur** : chaque serveur s'identifie (sans mot de passe, juste choix dans une liste), et chaque commande retient quel serveur a pris la table.
7. **Notes par table** ("table VIP", "anniversaire", "allergie noix") qui restent visibles sur l'écran commande.
8. **Annuler une commande** (différent de "Clôturer") : marquer comme "annulée" pour les ouvertures par erreur, sans perdre l'historique.

### Long terme — Métier
9. **Statistiques** : top des plats vendus / chiffre d'affaires par jour / panier moyen.
10. **Réservations** : intégrer un agenda simple de réservations (nom, heure, couverts, table affectée).
11. **Stock** : marquer un plat "en rupture" → grisé dans le menu.
12. **Pourboire** : ajouter un champ pourboire à la clôture.
13. **Mode hors-ligne** : enregistrer les commandes localement et synchroniser quand le wifi revient (utile en terrasse).

### Bugs / améliorations connus
- Le déplacement entre rounds passe par long-press + tap (pas un vrai drag).
- Pas de confirmation visuelle quand on clique sur "Envoyer" (juste un toast bref).
- Le historique ne montre que les 4 premiers articles d'une commande clôturée.
- Pas de bouton pour réimprimer un ticket clôturé.

---

## 🚀 Démarrage local (si besoin)

```bash
# Backend (port 8001)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (Expo)
cd frontend
yarn install
npx expo start
```

Variables d'environnement à respecter (NE PAS MODIFIER sur Emergent) :
- `backend/.env` : `MONGO_URL`, `DB_NAME`
- `frontend/.env` : `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PACKAGER_*`

---

## 📋 Convention pour ChatGPT (ou tout assistant qui m'aide)

Si tu lis ce repo pour m'aider :
1. **Réponds toujours en français** (l'app est française, le restaurateur est francophone).
2. **Tout texte d'interface doit être en français** correct (pas de "Open" / "Save" / "Click here").
3. **Respecte la structure existante** : Expo Router file-based, FastAPI préfixe `/api`, MongoDB sans `_id` dans les réponses.
4. **N'introduis pas de nouvelle stack** (pas de Tailwind, pas de Redux, pas d'auth complexe) sauf si je le demande explicitement.
5. **Préfère les modifications incrémentales** plutôt que les réécritures complètes.
6. **Touches grandes, lisibilité maximum** — c'est utilisé en service réel par des gens pressés.
7. **Pas de drag-and-drop complexe** sans alternative simple (long-press + tap fait l'affaire au pire).
8. **Le menu est codé en dur** dans `menu_seed.py` et reseedé à chaque démarrage backend. Pour ajouter un plat : modifier ce fichier.

Pour proposer une amélioration, idéalement :
- Indique **quel fichier** modifier.
- Donne le **diff exact** (avant / après).
- Explique pourquoi c'est mieux pour le **serveur en service**.

---

## 📜 Carte intégrée (résumé)

~150 articles répartis sur 13 catégories. Issue d'une carte de restaurant français haut de gamme :
- **Apéritifs** (23) : Martini, Porto, Suze, Ricard, Pastis, Whiskies, Rhums, Vodka, Gins, Kirs, Rhums arrangés
- **Tapas** (6) : Bocaux à tartiner, Saucissons, Duos, Rillauds, Frites, Ardoise
- **Entrées** (5)
- **Plats** (8) : avec options cuisson / sauce / préparation
- **Desserts** (13) : avec parfums de glaces multi-choix
- **Boissons fraîches** (17) : sirops, diabolos (avec DBK = Banane Kiwi), sodas, eaux
- **Boissons chaudes** (11)
- **Vins** : ~60 références (verres + bouteilles, rouges / blancs / rosés)
- **Champagnes & Crémants** (6)
- **Digestifs** (9)

Toutes les options et prix sont éditables dans `backend/menu_seed.py`.
