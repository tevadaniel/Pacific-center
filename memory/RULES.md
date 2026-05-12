# 🚨 RÈGLES ABSOLUES — NE JAMAIS VIOLER

## 1. Données réelles d'exposants — INTOUCHABLES

**INTERDIT** : modifier, libérer, supprimer ou créer un alias d'un exposant réel
(I Mua Papeete, Dream Lab, ACE Arue, Budokan Judo Pirae, Lotus Bleu, et **TOUS** les
autres exposants existants en base) pour quelque raison que ce soit — y compris
"juste temporairement pour un test".

Cela inclut :
- `organizations` (ne pas renommer / supprimer / modifier)
- `stand_assignments` (ne jamais libérer un stand attribué à un vrai exposant)
- `venue_stands` (ne jamais réassigner)
- `registrations` (ne jamais altérer le profil, le statut, ou les jours)
- `animation_slots` (ne jamais supprimer une animation d'un vrai exposant)
- `validation_requests`, `deposit_transactions`, `registration_documents`

## 2. Noms autorisés pour les tests E2E

**SEULS** ces préfixes/noms sont autorisés pour créer des comptes ou données
de test : `teva`, `aracom`, `teka`.

Exemples valides :
- `teva-test@e2e.local`, `Teva ARACOM E2E`, `teka-debug`, `aracom-wizard-test`

Tout autre nom ou identifiant pour des données de test est **STRICTEMENT INTERDIT**.

## 3. Avant tout test qui peut modifier la DB

1. Faire un `mongodump` snapshot dans `/app/backups/pre_test_<ts>` AVANT
2. Vérifier que les seules données créées/modifiées sont sur des préfixes autorisés
3. À la fin du test, lancer `node scripts/safety-check.js --apply`
4. Vérifier que `db.organizations.findOne({name:'I Mua Papeete'})` retourne toujours
   le doc original (et idem pour tous les autres vrais exposants)

## 4. Si une modification accidentelle est détectée

- **NE PAS continuer** d'opérations destructives
- Restaurer immédiatement depuis le dernier snapshot dans `/app/backups/`
- Informer l'utilisateur de l'incident

## 5. Mode TEST mail TOUJOURS ACTIF par défaut

- `app_settings.mail_config.test_mode = true` en permanence
- Boot guard dans `route.js` force cette valeur sauf si `ALLOW_PROD_MAIL=true` en env
- Allow-list : `tevageros@me.com`, `teva.geros@aracom-conseil.fr`,
  `agence@aracom-conseil.fr`, `admin@aracom.pf` — tout autre destinataire est
  redirigé vers `tevageros@me.com`
