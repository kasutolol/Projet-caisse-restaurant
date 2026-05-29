# PRD – App Prise de Commande Restaurant (FR)

## Objectif
App mobile Expo pour serveurs de restaurant pour saisir les commandes rapidement par table, avec sous-catégories (cuisson, sauce, sirop, parfum…).

## Carte intégrée (13 catégories, ~150 articles)
Apéritifs · Tapas & Délices salés · Entrées · Plats · Desserts · Boissons fraîches · Boissons chaudes · Vins au verre · Vins rouges · Vins blancs · Vins rosés · Champagnes & Crémants · Digestifs.

Options multi-choix gérées : Cuisson (entrecôte), Sauce (moules), Parfum (kir, sirop, jus, glaces), Type (whisky, schweppes, coca…), Préparation (tartare), Couleur (martini/porto), Ardoise (charcuterie/fromages/mixte), Bocaux à tartiner, etc.

## Flux principal
1. **Écran Tables** : grille 12 tables, couleur verte=libre, ambre=occupée.
2. Tap sur table libre → modal "Couverts" (chips 1-8) → ouvre une commande.
3. **Écran Commande** : items groupés par catégorie, qté +/-, total live, boutons "Envoyer" / "Clôturer".
4. Bouton "Ajouter" → **Écran Menu** : barre catégories horizontale + grille items.
5. Tap sur article avec options → bottom sheet : chips obligatoires + champ Note → "Ajouter".
6. Articles non envoyés signalés "NOUVEAU"; "Envoyer" les marque envoyés. "Clôturer" libère la table.
7. **Écran Historique** : onglets "En cours" / "Clôturées".

## Stack
- Backend FastAPI + MongoDB, seed automatique du menu et de 12 tables au démarrage
- Frontend Expo Router (file-based) avec SafeAreaView, Modals natifs RN, @expo/vector-icons (Ionicons)
- Pas d'authentification (accès direct)

## API
- `GET /api/menu` · `GET/POST/PUT /api/tables(/:id)`
- `POST /api/tables/:id/order?covers=N` · `GET /api/orders/:id`
- `POST /api/orders/:id/items` · `PUT /api/orders/:id/items/:itemId/quantity?quantity=N` · `DELETE …`
- `POST /api/orders/:id/send` (marque envoyés) · `POST /api/orders/:id/close`
- `GET /api/orders?status=open|closed`
