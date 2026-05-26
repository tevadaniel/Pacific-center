# PRD — Forum de la Rentrée 2026 (ARACOM)

> **Document de référence** consolidant toutes les exigences fonctionnelles exprimées par l'utilisateur sur les ~7 derniers jours de développement (sessions 28+ à 47.13).
>
> **Source de vérité unique** : à utiliser par tout futur agent pour vérifier la complétude avant toute nouvelle tâche.
>
> Légende statut : ✅ Livré & testé · ⏳ Livré, non testé · ⚠️ Partiel · ❌ Non démarré · 🚫 Annulé / hors scope

---

## 🎯 Vision du produit

Plateforme web (PWA) pour gérer l'édition 2026 du Forum de la Rentrée en Polynésie française, sur 2 jours (vendredi 14 + samedi 15 août 2026), répartis sur 6 sites Pacific Centers (Faaa, Punaauia, Arue, Taravao, Mahina, Moorea).

3 cibles utilisateurs :
1. **ARACOM (admin)** — pilotage complet de l'édition
2. **Exposants (associations / entreprises)** — inscription, suivi de dossier, animations
3. **Pacific Centers (lecture seule)** — consultation en mode magic link

---

## 🔐 1. AUTHENTIFICATION & SESSIONS

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 1.1 | Login admin email+password (universel `Projetaracom12`) | ✅ | `/api/auth/password-login` — Session 28o |
| 1.2 | Login exposant via magic link (token email) | ✅ | Session 28+ |
| 1.3 | Auto-fill formulaire login (sync refs sans onChange React) | ✅ | Session 28o — bullet-proof autofill |
| 1.4 | Pacific Centers en lecture seule via magic link uniquement | ✅ | `role_code:pacific_centers_readonly` |
| 1.5 | Session persistée dans `localStorage.fr26_session` | ✅ | |
| 1.6 | Bouton "Accéder à mon espace" (magic link) auto-injecté dans tous les mails | ✅ | `/lib/mail-config.js` |
| 1.7 | Auto-heal des comptes exposant orphelins (`u-exp-<orgId>` sans `organization_id`) | ✅ | Session 28p — `/api/auth/me` self-healing |

---

## 📋 2. WIZARD PUBLIC (inscription exposant)

Parcours en 5 étapes : Profil → Site & Jours → Stand → Animation → Finalisation (RDV/Caution).

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 2.1 | **Étape 1 Profil allégé** — Seul le nom de la structure est obligatoire, tout le reste optionnel | ✅ | Session 43-i |
| 2.2 | **Étape 2 Cascade stricte** Site → Jours avec badges places restantes (vert/ambre/rouge) | ✅ | Session 43-j |
| 2.3 | Cards jours désactivées + "COMPLET" si is_full | ✅ | Session 43-j |
| 2.4 | Filtre venues actifs uniquement (`only_active=1`) — Mahina/Moorea cachés | ✅ | Session 47 |
| 2.5 | **Étape 3 Stand** — Carte interactive avec couleurs par statut | ✅ | `smart-venue-map` + `venue-map-png` |
| 2.6 | **Étape 4 Animation** — Obligatoire pour tous, 1 créneau/jour de présence | ✅ | Session 44 + 47 |
| 2.7 | Créneaux animation dynamiques (durée = plage ÷ N exposants), arrondi 5 min, min 15 / max 60 | ✅ | Session 44 — `buildAnimationGrid` |
| 2.8 | Auto-sélection du 1er créneau libre à l'entrée Step 4 | ✅ | Session 44 |
| 2.9 | **Étape 5 Finalisation** — Modale `SubmitFinalizeModal` collectant mode paiement caution + dépôt RDV + docs | ✅ | Session 47 |
| 2.10 | UrgencyBanner — affiche en temps réel le nombre d'exposants en attente | ✅ | Session 47 |
| 2.11 | Multi-sites : un exposant peut s'inscrire sur jusqu'à 3 sites | ✅ | Session 28k + 43-b |
| 2.12 | Bouton "Ajouter un autre site" intégré au wizard | ✅ | Session 47 |
| 2.13 | Auto-save de chaque étape en localStorage (`wizard:<reg_id>`) | ✅ | |
| 2.14 | Validation stricte : si jour coché mais pas d'animation → erreur "Créneau manquant pour samedi" | ✅ | Session 47 |

### 2.A WIZARD — Workflow Pending/Waitlist (SESSION 47.13)

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 2.A.1 | Toute demande stand/animation démarre en `request_status:'pending'` | ✅ | Backend `/wizard/stand` + `/wizard/animation` |
| 2.A.2 | Détection de conflit si stand/slot déjà demandé par un autre exposant | ✅ | Renvoie `{ok:false, conflict:true, owner_name, waitlist_position}` |
| 2.A.3 | **Popup ConflictDialog** s'ouvre — affiche owner, statut, position FIFO future, info promotion auto | ✅ | `/components/wizard/conflict-dialog.jsx` |
| 2.A.4 | Stands/slots `pending` ou `waitlist` **cliquables par les autres exposants** (popup au submit) | ✅ | `isStandClickable` ≠ `isStandFree` |
| 2.A.5 | Stands/slots `validated` **verrouillés** (cliquables = non) | ✅ | Couleur rouge 🔒 |
| 2.A.6 | Bandeau bleu pédagogique en haut de chaque étape (libre / déjà demandé / verrouillé) | ✅ | Étapes 3 + 4 |
| 2.A.7 | Bandeau jaune d'alerte préventive sous la sélection en conflit | ✅ | Avec nom owner + position future |
| 2.A.8 | Bouton "Demander ce stand" → "⏳ Demander (liste d'attente)" si conflit | ✅ | Couleur change bleu→orange |
| 2.A.9 | Site complet → bouton "Rejoindre la file la plus courte" (auto-sélection stand le moins waitlisté) | ✅ | Session 45 + 47.13 |
| 2.A.10 | Tooltip détaillé sur chaque stand de la carte (🟢/⏳/📋/🔒) | ✅ | `venue-map-png.jsx` |
| 2.A.11 | Toasts adaptés : "📋 En attente de validation ARACOM" / "⏳ Inscrit en liste d'attente position #N" | ✅ | |

---

## 👥 3. PORTAIL EXPOSANT

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 3.1 | Page d'accueil avec liste des sites + statut de chaque dossier | ✅ | Session 28k |
| 3.2 | Bandeau jaune "Documents officiels à télécharger" si présents | ✅ | Convention + Guide téléchargeables |
| 3.3 | Ajout / Suppression / Définir prioritaire site (multi-sites) | ✅ | Session 43-b |
| 3.4 | Animations CRUD : créer, éditer, supprimer ses animations (sync admin) | ✅ | Session 43-c |
| 3.5 | Bloc verrouillé après finalisation → demande de modification via formulaire envoyé à `agence@aracom-conseil.fr` | ✅ | Session 43-j |
| 3.6 | Sync temps réel admin → exposant (polling 60s + email auto si admin modifie bloc verrouillé) | ✅ | Session 43-j |
| 3.7 | Documents : upload + visualisation statut admin (✅/❌/⏳) | ✅ | |

---

## 🛡️ 4. COCKPIT ARACOM (Admin)

### 4.A Navigation & Dashboard

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.A.1 | 19 onglets organisés en groupes (Dashboard, Exposants, Pilotage, Communication, Sites, Logs, etc.) | ✅ | Session 28m |
| 4.A.2 | Dashboard KPIs (J-X, % complétion, exposants par statut, cautions) | ✅ | `/api/dashboard/kpis` |
| 4.A.3 | Carte Fidélité avec edition_buckets (0× à 5+×) + Ratio multi-site | ✅ | Session 43 |
| 4.A.4 | TOP 10 exposants enrichi avec badge multi-site | ✅ | |
| 4.A.5 | Export CSV de la liste exposants enrichi (Nb sites 2026, Multi-site OUI/non, Sites 2026) | ✅ | Session 43 |
| 4.A.6 | Badge counter en temps réel sur chaque onglet (validations, relances, à confirmer, etc.) | ✅ | `/api/menu-badges` |

### 4.B Liste & Fiches Exposants

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.B.1 | Liste avec 4 metrics cliquables 2x2 (À confirmer / Confirmés / Total / Annulés) | ✅ | Session 28v |
| 4.B.2 | Recherche + 3 filtres (site/statut/priorité) | ✅ | |
| 4.B.3 | Statut inline éditable par row (Select 4 options colorées) | ✅ | |
| 4.B.4 | Actions par row : Ouvrir / Confirmer / Rappel / Supprimer | ✅ | |
| 4.B.5 | Bulk bar : Changer statut / Rappel / Export / Supprimer | ✅ | |
| 4.B.6 | Suppression nominative obligatoire (taper le nom exact / "CONFIRMER" / "SUPPRIMER TOUT") | ✅ | Session 28v |
| 4.B.7 | **Fiche V2** scroll unique 11 sections collapsibles (au lieu de 6 onglets) | ✅ | Session 28u + 43-h |
| 4.B.8 | Toggle Entreprise/Association → labels conditionnels (SIRET/RNA, Président, Nb membres) | ✅ | Session 28u |
| 4.B.9 | EditableField : Pencil + inline input/select + OK/Annuler + toast | ✅ | Session 28u |
| 4.B.10 | Dropdown Discipline exhaustif (12 catégories, ~150 disciplines, optgroup natif) + custom | ✅ | Session 43-h |
| 4.B.11 | Stand & Site : grille visuelle des stands libres cliquables (réutilise pre-reserve-stand) | ✅ | Session 43-d |
| 4.B.12 | Échanger avec un stand occupé (`/admin/registrations/:id/swap-stand`) | ✅ | Session 43-f |
| 4.B.13 | Forcer un stand occupé (`/admin/registrations/:id/force-stand`) | ✅ | Session 43-f |
| 4.B.14 | Multi-sites admin : ajouter / retirer / définir prioritaire / basculer | ✅ | Session 43-b |
| 4.B.15 | Animations CRUD admin (jour/zone/créneau/site, selects natifs anti-bug Radix) | ✅ | Session 43-d + 43-c |
| 4.B.16 | Modifier le créneau d'animation existant (`/admin/registrations/:id/animation-slot/swap`) | ✅ | Session 44 — email auto à exposant |
| 4.B.17 | 📧 Envoyer un mail à l'exposant (composer avec 6 templates) | ✅ | Session 28n + 28q (portal fix) |
| 4.B.18 | ✏️ Modifier les choix de l'exposant (site/stand/animation/notes) | ✅ | Session 28n + 28q |
| 4.B.19 | Mail buttons (liste + bulk) ouvrent **MailingView avec preselect** (pas d'envoi auto) | ✅ | Session 47 |
| 4.B.20 | Danger zone : suppression définitive en 2 étapes (taper nom exact) | ✅ | Session 28u |
| 4.B.21 | **Ledger anti-resurrection** : `deleted_org_ledger` filtre toutes les listes | ✅ | Session 43-e |

### 4.C File de validation (Pending/Waitlist — SESSION 47.13)

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.C.1 | Nouvel onglet "🛡️ File de validation" dans le menu Exposants | ✅ | `/aracom?tab=file-validation` |
| 4.C.2 | 4 KPI cards (Pending / Waitlist / Validated / Refused) | ✅ | |
| 4.C.3 | Bandeau FIFO explicatif + date butoir configurable (datetime-local picker) | ✅ | |
| 4.C.4 | Filtres : statut, type (stand/animation), site, recherche libre | ✅ | |
| 4.C.5 | Table triée FIFO (request_submitted_at ASC) | ✅ | |
| 4.C.6 | Affichage par row : Exposant + Email + Site/Stand OU Détails anim + Statut + Position | ✅ | |
| 4.C.7 | Affichage "Suivant : Org X (#1)" sur les pending qui ont une waitlist derrière | ✅ | |
| 4.C.8 | Actions per-row : ✅ Valider / ❌ Refuser (modal motif obligatoire) | ✅ | |
| 4.C.9 | Refus → **auto-promotion** du 1er en liste d'attente | ✅ | Toast "Org B promu(e) automatiquement" |
| 4.C.10 | Bulk select + Valider en masse / Refuser en masse (motif) | ✅ | Refuse en masse demande 1 motif commun |
| 4.C.11 | Date butoir éditable et persistée dans `app_settings` | ✅ | |
| 4.C.12 | Counter pending sur l'onglet en temps réel | ✅ | `pending_validations` dans `/menu-badges` |

### 4.D Pilotage & Gestion

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.D.1 | Plan des sites : édition drag & drop + alignement + delete stand | ✅ | `/components/venue-map-png.jsx` editMode |
| 4.D.2 | Plage horaire animation configurable par site/date | ✅ | Session 44 — `/venues/:id/animation-windows` |
| 4.D.3 | Stand Picker : grille libre/occupé cliquable avec dropdown swap/force | ✅ | Session 43-f |
| 4.D.4 | Validation Requests workflow (RDV caution / Lock / Reçu CAUT-2026-XXX) | ✅ | Session 43 |
| 4.D.5 | Mode Jour J (cockpit live) avec compteur d'attendus | ✅ | Session 28m |
| 4.D.6 | Bilans Jour J : arrival/departure, stand_status, anomaly, agent_comment | ✅ | Session 28u |

### 4.E Communication

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.E.1 | MailingView composer avec presets (info / rdv_caution / doc_manquant / félicitations / personnalisé) | ✅ | |
| 4.E.2 | Auto-injection du bouton "Accéder à mon espace" dans tous les mails | ✅ | Session 47 |
| 4.E.3 | Variables remplaçables `[[NOM_EXPOSANT]] [[CONTACT_NAME]] [[STAND]] [[SITE]] [[MON_ESPACE]] [[MON_ESPACE_DOCS]]` | ✅ | |
| 4.E.4 | Mode TEST mail (redirige vers `tevageros@me.com`) | ✅ | |
| 4.E.5 | Bouton TEST MAIL dans le header | ✅ | |
| 4.E.6 | Scheduler de mails programmés (interval 60s) | ✅ | |
| 4.E.7 | Email auto à l'exposant lors de modification admin du bloc verrouillé (table avant→après) | ✅ | Session 43-j |
| 4.E.8 | Email auto à `agence@aracom-conseil.fr` lors d'une demande de modification | ✅ | Session 43-j |

### 4.F Documents & Conventions

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.F.1 | Onglet "Docs officiels" : upload/delete documents partagés (Convention, Guide, etc.) | ✅ | |
| 4.F.2 | Génération PDF convention pré-remplie par exposant | ✅ | `/api/registrations/:id/convention.pdf` |
| 4.F.3 | Génération PDF guide exposant | ✅ | |
| 4.F.4 | Génération PDF questionnaire vierge | ✅ | |
| 4.F.5 | Validation admin des docs uploadés (✅ Valider / ❌ Refuser + commentaire) | ✅ | |
| 4.F.6 | Sync auto des flags `is_convention_signed` / `is_insurance_uploaded` | ✅ | |
| 4.F.7 | Reçu de caution généré au lock (`CAUT-2026-XXXXXX`) | ✅ | |

### 4.G Data Management & Reset

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 4.G.1 | Import Excel exposants (auto-création registration + auto-réparation bulk) | ✅ | Session 28i |
| 4.G.2 | Reset SOFT "Nouvelle édition" : préserve orgs, reset registrations à `a_relancer` | ✅ | Session 46 |
| 4.G.3 | Reset TOTAL HARD : supprime orgs+regs+anims+docs+stand_assignments+deposits+users | ✅ | Session 46 |
| 4.G.4 | **Préservation des plans de sites** (`venue_layouts-backup.json`) lors des deux resets | ✅ | Session 46 |
| 4.G.5 | Confirmation par texte exact obligatoire : `RESET-NOUVELLE-EDITION` / `RESET-TOTAL-DEFINITIF` | ✅ | |
| 4.G.6 | Auto-création dossier d'inscription pour les exposants importés sans registration | ✅ | Session 28i |
| 4.G.7 | Auto-repair bulk endpoint `/admin/auto-repair/initialize-all-missing-registrations` | ✅ | Idempotent |
| 4.G.8 | Lier user existant à une organisation (UI orphans) | ✅ | Session 28g |

---

## 🧪 5. SIMULATION ENGINE (E2E)

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 5.1 | Modal simulation avec config (N exposants, concurrency, vitesse, profil mix) | ✅ | Session 47 |
| 5.2 | Logique E2E : self-register → profile → days → stand → animation → finalize | ✅ | |
| 5.3 | Pivot stand si conflict (retry sur stand libre suivant) | ✅ | Session 47 |
| 5.4 | Pivot animation slot si conflict (`_backup_slots`) | ✅ | Session 47 |
| 5.5 | Gestion du nouveau format `{conflict:true}` HTTP 200 (50% accept waitlist / 50% pivot) | ✅ | Session 47.13 |
| 5.6 | Stats live : total / success / failed / abandoned / waitlisted | ✅ | |
| 5.7 | Filter inactive venues pour simulation | ✅ | |
| 5.8 | Bouton "Nettoyage des sims" pour purger les exposants `is_simulation:true` | ✅ | |
| 5.9 | Export JSON des résultats de simulation | ✅ | |

---

## 📦 6. PWA & DÉPLOIEMENT

| # | Fonctionnalité | Statut | Notes |
|---|----------------|--------|-------|
| 6.1 | Service Worker avec cache versionné (`CACHE_VERSION` bumped à chaque session) | ✅ | Session 28s |
| 6.2 | Endpoint `/api/version` retourne BUILD_VERSION unique calculé au boot | ✅ | |
| 6.3 | Auto-update PWA : polling `/api/version` toutes les 60s + on focus/visibilitychange | ✅ | Session 28s |
| 6.4 | Clear caches automatique + reload sans action utilisateur | ✅ | |
| 6.5 | Production déployée sur `aracompacificcenters.com` | ✅ | Bouton "Save to Github" |

---

## 🐛 7. BUGS RÉCURRENTS RÉSOLUS

| # | Bug | Sessions | Statut |
|---|-----|---------|--------|
| 7.1 | Browser autofill ne déclenche pas onChange React (login bloqué) | 28o | ✅ Refs + form submit |
| 7.2 | Boutons dialog non cliquables dans le slide-over (Radix Sheet pointer-events) | 28q + 28r | ✅ Portal + style:'auto' |
| 7.3 | Nouveaux exposants flickering (cache HTTP + race condition) | 28r | ✅ no-store + loadSeqRef |
| 7.4 | "Votre dossier n'a pas encore été initialisé" (users orphelins) | 28p | ✅ Auto-heal `/api/auth/me` |
| 7.5 | Exposant supprimé qui revient après redéploiement | 43-e | ✅ Ledger persistant |
| 7.6 | Selects Radix interceptés par Sheet parent (animations vide) | 43-d | ✅ `<select>` HTML natifs |
| 7.7 | PWA cache empêchant les updates de s'afficher | 28s | ✅ Auto-update 60s |
| 7.8 | Plans de sites perdus lors d'un reset | 46 | ✅ Backup auto + restauration |
| 7.9 | Wizard bloquait clic sur stands pris (popup waitlist jamais déclenchée) | 47.13 | ✅ `isStandClickable` |
| 7.10 | Simulation engine traitait `conflict:true` comme succès silencieux | 47.13 | ✅ Détection + retry force_waitlist |

---

## 🗺️ 8. ARCHITECTURE — STATE OF THE CODEBASE

### Frontend (Next.js 14 / App Router)
```
/app
├── app/
│   ├── page.js                              # Landing + login
│   ├── aracom/page.js (~3500 lignes)       # Cockpit admin
│   ├── exposant/page.js                     # Portail exposant
│   ├── inscription/                         # Wizard public
│   ├── jour-j/                              # Mode Jour J live
│   └── api/[[...path]]/route.js (~10000 l) # ⚠️ MONOLITHE — à refactor vers /lib/api/handlers/
├── components/
│   ├── wizard-form.jsx (~1800 lignes)
│   ├── wizard/
│   │   ├── conflict-dialog.jsx              # Session 47.13
│   │   ├── urgency-banner.jsx               # Session 47
│   │   └── submit-finalize-modal.jsx        # Session 47
│   ├── aracom/
│   │   ├── fiche-exposant-v2.jsx           # Session 28u
│   │   ├── exposants-list-view.jsx          # Session 28v
│   │   ├── validation-queue-view.jsx        # Session 47.13
│   │   ├── send-exposant-mail-dialog.jsx    # Session 28n
│   │   ├── edit-exposant-choices-dialog.jsx # Session 28n
│   │   ├── simulation-modal.jsx             # Session 47
│   │   ├── dashboard-view.jsx               # Session 43
│   │   └── mailing-view.jsx                 # Session 47
│   ├── smart-venue-map.jsx
│   └── venue-map-png.jsx
└── lib/
    ├── simulation-engine.js                 # Session 47 + 47.13 fix
    ├── wizard-helpers.js                    # Session 44 + 47.13
    ├── mail-config.js                       # Session 47 — magic links
    └── api/handlers/dashboard.js            # Refactor partiel
```

### Backend (Next.js API Routes + MongoDB)
- **Monolithe** : `/app/app/api/[[...path]]/route.js` (~10 000 lignes)
- **Refactor amorcé** : `/app/lib/api/handlers/` (dashboard.js + helpers.js extraits)
- **Reste à extraire** : tous les handlers wizard, admin, validation, mailing, etc.

### Collections MongoDB (clé)
- `organizations`, `registrations`, `stand_assignments`, `animation_slots`, `venue_stands`, `venue_elements`
- `users`, `access_tokens`, `activity_logs`
- `validation_requests` (ancien workflow caution/RDV)
- `app_settings` (validation_deadline et autres configs)
- `deleted_org_ledger` (anti-resurrection)
- `mail_logs`, `mail_config`, `mail_queue`

### Champs Pending/Waitlist (SESSION 47.13)
Sur `stand_assignments` et `animation_slots` :
- `request_status` : `'pending'` | `'waitlist'` | `'validated'` | `'refused'` | `'annule'`
- `request_submitted_at` : Date
- `waitlist_position` : Int | null
- `validated_at` / `validated_by` / `refused_reason`

---

## 🔮 9. BACKLOG / FUTURE WORK

| # | Tâche | Priorité | Notes |
|---|-------|----------|-------|
| 9.1 | Refactor du monolithe `route.js` (~10k lignes) → `/lib/api/handlers/` | P2 | Critique pour maintenabilité long terme |
| 9.2 | ✅ ~~Email auto à l'exposant lors de validation/refus~~ | **DONE** | Session 47.14 — Dialog "Notifier" + composer pré-rempli modifiable |
| 9.3 | ✅ ~~Promotion automatique du waitlist + notification~~ | **DONE** | Session 47.14 — `promoteNextInWaitlist` + template "promoted" |
| 9.4 | Mode "À l'aveugle" pour les filtres dashboard (cacher noms pour démo) | P3 | Pas demandé explicitement, à confirmer |
| 9.5 | Audit complet des routes API (404 introuvables, dead code) | P2 | |
| 9.6 | Internationalisation FR/EN (actuellement FR-only) | P3 | |

---

## 🎁 SESSION 47.14 — Notifications & Auto-promotion (LIVRÉ)

### Backend
| Item | Détails |
|------|---------|
| `buildExposantEmailTemplate(reg_id, action, ctx)` | Helper qui génère subject + body_html avec `[[MON_ESPACE]]` selon action (validated / refused / promoted) |
| `promoteNextInWaitlist(asn, kind)` | **Promotion EFFECTIVE** : le 1er en waitlist passe en `pending`, `waitlist_position` nulle, les autres décrémentés de 1 |
| `/admin/validation/:id/validate` | Retourne `email_template` (sujet/corps pour le composer) |
| `/admin/validation/:id/refuse` | Retourne `email_template` (refusé) + `promoted_email_template` (promu) + promotion DB effective |
| `/admin/validation/bulk` | Retourne `email_templates[]` + `promoted_email_templates[]` + promotions DB |
| Activity log `WAITLIST_AUTO_PROMOTE` | Traçabilité de chaque promotion automatique |

### Frontend
| Item | Détails |
|------|---------|
| **Dialog "Notifier l'exposant ?"** s'ouvre après validate/refuse/bulk | Liste les emails à envoyer avec preview du sujet, couleur par type (vert/rouge/violet) |
| Bouton "📧 Préparer l'email" par destinataire | Ouvre `MailingView` avec `preselect` + `prefill_subject` + `prefill_body` |
| Bouton "Ignorer toutes les notifications" | Skip optionnel |
| `MailingView` accepte URL params `prefill_subject` & `prefill_body` (base64) | Sujet + corps pré-remplis, modifiables avant envoi |
| Composer affiche un toast "📝 Sujet & corps pré-remplis" pour notifier l'admin | |

### Templates email générés
- **Validated** : "🎉 Votre stand est confirmé !" — confirmation chaleureuse + magic link
- **Refused** : "Concernant votre demande" — motif détaillé + invitation à reconsidérer
- **Promoted** : "🎉 Vous êtes promu(e) — votre stand est disponible !" — explication waitlist → pending + magic link

### Tests automatisés
- ✅ Refuse A → B promu effectivement de waitlist#1 vers pending
- ✅ C waitlist#2 → décrémenté en waitlist#1
- ✅ Email templates générés pour A (refused) + B (promoted) avec [[MON_ESPACE]]
- ✅ Validate B → email template "confirmé" généré
- ✅ Bulk refuse 2 exposants → 2 templates email retournés

---

## 📝 10. DÉCISIONS UTILISATEUR ARCHIVÉES

| Date approximative | Décision |
|--------------------|----------|
| Session 43-i | "Seul le nom de la structure est obligatoire, tout le reste optionnel" |
| Session 43-h | Discipline = dropdown exhaustif natif (12 catégories, ~150 options) + custom |
| Session 43-h | Animations strictement liées au site de leur inscription |
| Session 43-h | Fiche exposant = scroll unique 11 sections (pas d'onglets) |
| Session 44 | Animation obligatoire pour TOUS les exposants |
| Session 44 | Durée créneau dynamique = plage ÷ N exposants attendus |
| Session 44 | Plage horaire animation configurable par site/date dans l'admin |
| Session 44 | Si plein → bloquer + liste d'attente |
| Session 47 | Mail boutons (liste + bulk) ouvrent MailingView, **pas d'envoi auto** |
| Session 47 | Venues inactifs (Mahina, Moorea) filtrés des dropdowns publics |
| Session 47 | Bouton "Accéder à mon espace" auto-injecté dans tous les mails |
| Session 47.13 | Toute réservation démarre en `pending`, ARACOM a le dernier mot |
| Session 47.13 | Si conflit pending → popup → choix utilisateur (waitlist OUI ou choisir autre) |
| Session 47.13 | Si site complet → bouton explicite "Basculer en liste d'attente" |
| Session 47.13 | File de validation centralisée FIFO pour ARACOM |
| Session 47.13 | Refus ARACOM → auto-promotion du suivant en waitlist |
| Session 47.13 | Validation/refus déclenche email à l'exposant via composer **modifiable avant envoi** |

---

## 🔑 11. CREDENTIALS DE TEST

Voir `/app/memory/test_credentials.md`. En résumé :
- Admin universel : `admin@aracom.pf` / `Projetaracom12`
- Test redirect mail : `tevageros@me.com`
- Mail destinataire prod : `agence@aracom-conseil.fr`

---

## 📌 12. RÈGLES DE SESSION (À RESPECTER PAR TOUT FUTUR AGENT)

1. ❗ **Toujours vérifier ce PRD avant de coder** une nouvelle fonctionnalité.
2. ❗ Si l'utilisateur demande "as-tu fait X", consulter ce PRD avant de répondre.
3. ❗ À chaque nouvelle fonctionnalité livrée → **ajouter une ligne dans la section concernée**.
4. ❗ Bumper `package.json` + `BUILD_VERSION` à chaque changement frontend.
5. ❗ DB peut être vide (post `reset-total`) — toujours seeder si besoin.
6. ❗ Tests backend : 24/24 endpoints critiques validés en SESSION 47.13.
7. ❗ Tests frontend : flux waitlist E2E validé visuellement en SESSION 47.13.
8. ❗ Production = `aracompacificcenters.com`. Toujours demander Preview vs Prod.

---

*Dernière mise à jour : SESSION 47.13 — 26 mai 2026*
