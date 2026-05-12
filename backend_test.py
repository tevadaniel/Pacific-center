#!/usr/bin/env python3
"""
Backend audit Session 18 — Validation des corrections Admin Override Panel + non-régression complète.

CONTEXTE:
Le précédent agent avait inséré 2 nouveaux endpoints admin override À L'INTÉRIEUR du handler `wizard/profile` par erreur.
Le main agent a corrigé en déplaçant les endpoints au top-level du POST handler.

RÈGLES ABSOLUES (RULES.md):
- ❌ INTERDIT de modifier/supprimer exposants réels : "I Mua Papeete", "Dream Lab", "ACE Arue", "Budokan Judo Pirae", "Lotus Bleu"
- ✅ Pour tests destructifs : créer registrations préfixées `reg-teva-`, `reg-teka-`, `reg-aracom-`, `reg-test-` UNIQUEMENT
- ⚠️ Pour tester override sur exposant existant : read-only check (GET puis comparer) — NE PAS appeler reset/delete

BASE_URL: http://localhost:3000 (préfixer toutes les routes par /api)
Credentials admin: headers `x-user-role: aracom_admin` + `x-user-id: u-admin`
Mode mail: TEST (vérifier que MAIL_TEST_MODE reste à true)
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exp-1",
    "Content-Type": "application/json"
}

def log_test(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def log_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

# ============================================================================
# PRIORITÉ 1 — NOUVEAUX ENDPOINTS ADMIN OVERRIDE (CRITIQUE)
# ============================================================================

def test_01_reset_stand():
    """POST /api/admin/registrations/:id/reset avec body {reset: "stand"}"""
    log_test(1, "Reset stand - Créer test-reg avec stand, puis reset")
    
    try:
        # Créer une test-reg avec stand_code et SA active
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-ovr-stand"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Override Stand",
            "discipline": "Sport",
            "main_email": "teva.test.stand@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000001",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer registration test
        reg_id = "reg-teva-ovr-stand"
        db.registrations.delete_one({"id": reg_id})
        db.registrations.insert_one({
            "id": reg_id,
            "edition_id": "edition-2026",
            "organization_id": org_id,
            "venue_id": "venue-faaa",
            "stand_code": "A-Z99",
            "wizard_step": 4,
            "status": "a_confirmer",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer stand_assignment active
        import uuid
        sa_id = str(uuid.uuid4())
        db.stand_assignments.insert_one({
            "id": sa_id,
            "registration_id": reg_id,
            "venue_stand_id": "stand-A-Z99",
            "status": "provisoire",
            "assigned_by": "u-admin",
            "assigned_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # POST reset stand
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "stand"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("action") != "stand_released":
            return log_result(False, f"Expected action:'stand_released', got {data.get('action')}")
        
        # Vérifier en DB
        reg_after = db.registrations.find_one({"id": reg_id})
        if "stand_code" in reg_after:
            return log_result(False, f"stand_code should be unset, got {reg_after.get('stand_code')}")
        
        if reg_after.get("wizard_step") != 3:
            return log_result(False, f"Expected wizard_step=3, got {reg_after.get('wizard_step')}")
        
        sa_after = db.stand_assignments.find_one({"id": sa_id})
        if sa_after.get("status") != "annule":
            return log_result(False, f"Expected SA status='annule', got {sa_after.get('status')}")
        
        # Cleanup
        db.registrations.delete_one({"id": reg_id})
        db.organizations.delete_one({"id": org_id})
        db.stand_assignments.delete_one({"id": sa_id})
        
        return log_result(True, "Stand reset successful: stand_code unset, wizard_step=3, SA status='annule'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_02_reset_animations():
    """POST /api/admin/registrations/:id/reset avec body {reset: "animations"}"""
    log_test(2, "Reset animations - Créer test-reg avec 2 animation_slots, puis reset")
    
    try:
        from pymongo import MongoClient
        import uuid
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-ovr-anim"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Override Anim",
            "discipline": "Danse",
            "main_email": "teva.test.anim@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000002",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer registration test
        reg_id = "reg-teva-ovr-anim"
        db.registrations.delete_one({"id": reg_id})
        db.registrations.insert_one({
            "id": reg_id,
            "edition_id": "edition-2026",
            "organization_id": org_id,
            "venue_id": "venue-arue",
            "wizard_step": 4,
            "status": "a_confirmer",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer 2 animation_slots
        anim_ids = []
        for i in range(2):
            anim_id = str(uuid.uuid4())
            anim_ids.append(anim_id)
            db.animation_slots.insert_one({
                "id": anim_id,
                "registration_id": reg_id,
                "venue_id": "venue-arue",
                "day_label": "vendredi" if i == 0 else "samedi",
                "event_date": "2026-08-14" if i == 0 else "2026-08-15",
                "start_time": "14:00",
                "end_time": "15:00",
                "title": f"Animation test {i+1}",
                "status": "planifié",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        
        # Wait a bit for DB sync
        import time
        time.sleep(0.5)
        
        # POST reset animations
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "animations"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("action") != "animations_cleared":
            return log_result(False, f"Expected action:'animations_cleared', got {data.get('action')}")
        
        if data.get("count") != 2:
            return log_result(False, f"Expected count:2, got {data.get('count')}")
        
        # Vérifier en DB
        remaining = db.animation_slots.count_documents({"registration_id": reg_id})
        if remaining != 0:
            return log_result(False, f"Expected 0 animation_slots, got {remaining}")
        
        # Cleanup
        db.registrations.delete_one({"id": reg_id})
        db.organizations.delete_one({"id": org_id})
        
        return log_result(True, "Animations reset successful: 2 slots deleted, count:2 returned")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_03_reset_days():
    """POST /api/admin/registrations/:id/reset avec body {reset: "days"}"""
    log_test(3, "Reset days - Créer test-reg avec attending_days, venue_id, stand_code, puis reset")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-ovr-days"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Override Days",
            "discipline": "Culture",
            "main_email": "teva.test.days@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000003",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer registration test
        reg_id = "reg-teva-ovr-days"
        db.registrations.delete_one({"id": reg_id})
        db.registrations.insert_one({
            "id": reg_id,
            "edition_id": "edition-2026",
            "organization_id": org_id,
            "venue_id": "venue-punaauia",
            "stand_code": "P-A05",
            "attending_days": ["friday", "saturday"],
            "wizard_step": 3,
            "status": "a_confirmer",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # POST reset days
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "days"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("action") != "days_reset":
            return log_result(False, f"Expected action:'days_reset', got {data.get('action')}")
        
        # Vérifier en DB
        reg_after = db.registrations.find_one({"id": reg_id})
        if reg_after.get("attending_days") != []:
            return log_result(False, f"Expected attending_days=[], got {reg_after.get('attending_days')}")
        
        if "venue_id" in reg_after:
            return log_result(False, f"venue_id should be unset, got {reg_after.get('venue_id')}")
        
        if "stand_code" in reg_after:
            return log_result(False, f"stand_code should be unset, got {reg_after.get('stand_code')}")
        
        if reg_after.get("wizard_step") != 2:
            return log_result(False, f"Expected wizard_step=2, got {reg_after.get('wizard_step')}")
        
        # Cleanup
        db.registrations.delete_one({"id": reg_id})
        db.organizations.delete_one({"id": org_id})
        
        return log_result(True, "Days reset successful: attending_days=[], venue_id unset, stand_code unset, wizard_step=2")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_04_reset_cancel():
    """POST /api/admin/registrations/:id/reset avec body {reset: "cancel"}"""
    log_test(4, "Reset cancel - Créer test-reg avec status='contacte', puis cancel")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-ovr-cancel"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Override Cancel",
            "discipline": "Arts",
            "main_email": "teva.test.cancel@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000004",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer registration test
        reg_id = "reg-teva-ovr-cancel"
        db.registrations.delete_one({"id": reg_id})
        db.registrations.insert_one({
            "id": reg_id,
            "edition_id": "edition-2026",
            "organization_id": org_id,
            "status": "contacte",
            "wizard_step": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # POST reset cancel
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "cancel"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("action") != "registration_cancelled":
            return log_result(False, f"Expected action:'registration_cancelled', got {data.get('action')}")
        
        # Vérifier en DB
        reg_after = db.registrations.find_one({"id": reg_id})
        if reg_after.get("status") != "annule":
            return log_result(False, f"Expected status='annule', got {reg_after.get('status')}")
        
        if reg_after.get("cancelled_by") != "admin_override":
            return log_result(False, f"Expected cancelled_by='admin_override', got {reg_after.get('cancelled_by')}")
        
        if not reg_after.get("cancelled_at"):
            return log_result(False, "Expected cancelled_at to be present")
        
        # Cleanup
        db.registrations.delete_one({"id": reg_id})
        db.organizations.delete_one({"id": org_id})
        
        return log_result(True, "Cancel successful: status='annule', cancelled_by='admin_override', cancelled_at present")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_05_reset_invalid_action():
    """POST /api/admin/registrations/:id/reset avec body {reset: "foobar"} (action inconnue)"""
    log_test(5, "Reset invalid action - Devrait retourner 400")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Utiliser une registration existante (non-test)
        reg = db.registrations.find_one({"id": {"$regex": "^reg-arue-"}})
        if not reg:
            return log_result(False, "No existing registration found for test")
        
        reg_id = reg["id"]
        
        # POST reset avec action invalide
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "foobar"}
        )
        
        if response.status_code != 400:
            return log_result(False, f"Expected 400, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "Action de reset inconnue" not in data.get("error", ""):
            return log_result(False, f"Expected error message about unknown action, got {data}")
        
        return log_result(True, "Invalid action rejected with 400: 'Action de reset inconnue'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_06_reset_without_admin():
    """POST /api/admin/registrations/:id/reset SANS auth admin (headers exposant)"""
    log_test(6, "Reset without admin - Devrait retourner 403")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Utiliser une registration existante
        reg = db.registrations.find_one({"id": {"$regex": "^reg-arue-"}})
        if not reg:
            return log_result(False, "No existing registration found for test")
        
        reg_id = reg["id"]
        
        # POST reset avec headers exposant
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/reset",
            headers=EXPOSANT_HEADERS,
            json={"reset": "stand"}
        )
        
        if response.status_code != 403:
            return log_result(False, f"Expected 403, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "Accès admin requis" not in data.get("error", ""):
            return log_result(False, f"Expected error message about admin access, got {data}")
        
        return log_result(True, "Non-admin access rejected with 403: 'Accès admin requis'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_07_reset_nonexistent():
    """POST /api/admin/registrations/<id-inexistant>/reset body {reset:"stand"}"""
    log_test(7, "Reset nonexistent registration - Devrait retourner 404")
    
    try:
        # POST reset avec ID inexistant
        response = requests.post(
            f"{BASE_URL}/admin/registrations/reg-xxx-fake-999/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "stand"}
        )
        
        if response.status_code != 404:
            return log_result(False, f"Expected 404, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "Inscription introuvable" not in data.get("error", ""):
            return log_result(False, f"Expected error message about not found, got {data}")
        
        return log_result(True, "Nonexistent registration rejected with 404: 'Inscription introuvable'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_08_delete_full_test_reg():
    """POST /api/admin/registrations/:id/delete-full sur un test-reg"""
    log_test(8, "Delete-full test-reg - Créer reg-teva-del-test + org, puis delete-full")
    
    try:
        from pymongo import MongoClient
        import uuid
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-del-test"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Delete Full",
            "discipline": "Sport",
            "main_email": "teva.test.del@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000005",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer registration test
        reg_id = "reg-teva-del-test"
        db.registrations.delete_one({"id": reg_id})
        db.registrations.insert_one({
            "id": reg_id,
            "edition_id": "edition-2026",
            "organization_id": org_id,
            "status": "prospect",
            "wizard_step": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Créer quelques dépendances
        sa_id = str(uuid.uuid4())
        db.stand_assignments.insert_one({
            "id": sa_id,
            "registration_id": reg_id,
            "venue_stand_id": "stand-test",
            "status": "provisoire",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        anim_id = str(uuid.uuid4())
        db.animation_slots.insert_one({
            "id": anim_id,
            "registration_id": reg_id,
            "venue_id": "venue-faaa",
            "day_label": "vendredi",
            "event_date": "2026-08-14",
            "start_time": "14:00",
            "end_time": "15:00",
            "title": "Test animation",
            "status": "planifié",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Wait a bit for DB sync
        import time
        time.sleep(0.5)
        
        # POST delete-full
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/delete-full",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("action") != "fully_deleted":
            return log_result(False, f"Expected action:'fully_deleted', got {data.get('action')}")
        
        if not data.get("org_also_deleted"):
            return log_result(False, f"Expected org_also_deleted:true, got {data.get('org_also_deleted')}")
        
        # Vérifier en DB
        reg_after = db.registrations.find_one({"id": reg_id})
        if reg_after:
            return log_result(False, "Registration should be deleted")
        
        org_after = db.organizations.find_one({"id": org_id})
        if org_after:
            return log_result(False, "Organization should be deleted")
        
        sa_after = db.stand_assignments.find_one({"id": sa_id})
        if sa_after:
            return log_result(False, "Stand assignment should be deleted")
        
        anim_after = db.animation_slots.find_one({"id": anim_id})
        if anim_after:
            return log_result(False, "Animation slot should be deleted")
        
        return log_result(True, "Delete-full successful: reg deleted, org deleted, SA/animations cascade cleanup")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_09_delete_full_protected():
    """POST /api/admin/registrations/<id-d'un-exposant-protégé>/delete-full"""
    log_test(9, "Delete-full protected exposant - Devrait retourner 403 avec message spécifique")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Trouver "I Mua Papeete"
        org = db.organizations.find_one({"name": "I Mua Papeete"})
        if not org:
            return log_result(False, "Organization 'I Mua Papeete' not found")
        
        reg = db.registrations.find_one({"organization_id": org["id"]})
        if not reg:
            return log_result(False, "Registration for 'I Mua Papeete' not found")
        
        reg_id = reg["id"]
        
        # POST delete-full
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/delete-full",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 403:
            return log_result(False, f"Expected 403, got {response.status_code}: {response.text}")
        
        data = response.json()
        error_msg = data.get("error", "")
        if "I Mua Papeete" not in error_msg or "exposant protégé" not in error_msg:
            return log_result(False, f"Expected specific error message about protected exposant, got {data}")
        
        # Vérifier que l'org existe toujours
        org_after = db.organizations.find_one({"id": org["id"]})
        if not org_after:
            return log_result(False, "Organization should still exist after 403")
        
        return log_result(True, f"Protected exposant deletion rejected with 403: '{error_msg}'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_10_delete_full_without_admin():
    """POST /api/admin/registrations/:id/delete-full SANS auth admin"""
    log_test(10, "Delete-full without admin - Devrait retourner 403")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Utiliser une registration existante
        reg = db.registrations.find_one({"id": {"$regex": "^reg-arue-"}})
        if not reg:
            return log_result(False, "No existing registration found for test")
        
        reg_id = reg["id"]
        
        # POST delete-full avec headers exposant
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/delete-full",
            headers=EXPOSANT_HEADERS
        )
        
        if response.status_code != 403:
            return log_result(False, f"Expected 403, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "Accès admin requis" not in data.get("error", ""):
            return log_result(False, f"Expected error message about admin access, got {data}")
        
        return log_result(True, "Non-admin access rejected with 403: 'Accès admin requis'")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

# ============================================================================
# PRIORITÉ 2 — NON-RÉGRESSION CRITIQUE wizard/profile
# ============================================================================

def test_11_wizard_start():
    """POST /api/auth/self-register body {email: "tevatest+wiz@me.com"}"""
    log_test(11, "Wizard start (auth/self-register) - Devrait retourner 200 avec registration_id et organization_id")
    
    try:
        email = "tevatest+wiz@me.com"
        
        # POST auth/self-register
        response = requests.post(
            f"{BASE_URL}/auth/self-register",
            headers={"Content-Type": "application/json"},
            json={"email": email}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if not data.get("registration_id"):
            return log_result(False, f"Expected registration_id, got {data}")
        
        if not data.get("organization_id"):
            return log_result(False, f"Expected organization_id, got {data}")
        
        # Stocker pour test suivant
        global WIZARD_REG_ID, WIZARD_ORG_ID
        WIZARD_REG_ID = data["registration_id"]
        WIZARD_ORG_ID = data["organization_id"]
        
        return log_result(True, f"Wizard start successful: registration_id={WIZARD_REG_ID}, organization_id={WIZARD_ORG_ID}")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_12_wizard_profile():
    """POST /api/wizard/profile avec body complet"""
    log_test(12, "Wizard profile - Devrait retourner 200 avec next_step:2")
    
    try:
        if not WIZARD_REG_ID or not WIZARD_ORG_ID:
            return log_result(False, "WIZARD_REG_ID or WIZARD_ORG_ID not set from previous test")
        
        # POST wizard/profile
        response = requests.post(
            f"{BASE_URL}/wizard/profile",
            headers={"Content-Type": "application/json"},
            json={
                "registration_id": WIZARD_REG_ID,
                "profile": {
                    "name": "Teva Wizard Test",
                    "discipline": "Sport",
                    "contact_name": "Teva GEROS",
                    "main_email": "tevatest+wiz@me.com",
                    "main_phone": "87000000",
                    "representatives_count": 2,
                    "stand_description": "Stand de test pour wizard"
                }
            }
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if data.get("next_step") != 2:
            return log_result(False, f"Expected next_step:2, got {data.get('next_step')}")
        
        return log_result(True, "Wizard profile successful: next_step=2")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_13_wizard_profile_verification():
    """Vérifier organization updated et registration.wizard_step=2"""
    log_test(13, "Wizard profile verification - Vérifier DB")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        if not WIZARD_REG_ID or not WIZARD_ORG_ID:
            return log_result(False, "WIZARD_REG_ID or WIZARD_ORG_ID not set")
        
        # Vérifier organization
        org = db.organizations.find_one({"id": WIZARD_ORG_ID})
        if not org:
            return log_result(False, "Organization not found")
        
        if org.get("name") != "Teva Wizard Test":
            return log_result(False, f"Expected name='Teva Wizard Test', got {org.get('name')}")
        
        if org.get("discipline") != "Sport":
            return log_result(False, f"Expected discipline='Sport', got {org.get('discipline')}")
        
        if org.get("contact_name") != "Teva GEROS":
            return log_result(False, f"Expected contact_name='Teva GEROS', got {org.get('contact_name')}")
        
        if org.get("representatives_count") != 2:
            return log_result(False, f"Expected representatives_count=2, got {org.get('representatives_count')}")
        
        # Vérifier registration
        reg = db.registrations.find_one({"id": WIZARD_REG_ID})
        if not reg:
            return log_result(False, "Registration not found")
        
        if reg.get("wizard_step") != 2:
            return log_result(False, f"Expected wizard_step=2, got {reg.get('wizard_step')}")
        
        # Cleanup
        db.registrations.delete_one({"id": WIZARD_REG_ID})
        db.organizations.delete_one({"id": WIZARD_ORG_ID})
        
        return log_result(True, "Wizard profile verification successful: organization updated, wizard_step=2")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

# ============================================================================
# PRIORITÉ 3 — NON-RÉGRESSION ENDPOINTS CRITIQUES RÉCENTS
# ============================================================================

def test_14_admin_multi_site_alerts():
    """GET /api/admin/multi-site-alerts (admin)"""
    log_test(14, "Admin multi-site alerts - Devrait retourner 200 avec arrays")
    
    try:
        response = requests.get(
            f"{BASE_URL}/admin/multi-site-alerts",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "overbooked_sites" not in data and "overloaded_sites" not in data:
            return log_result(False, f"Expected 'overbooked_sites' or 'overloaded_sites' in response, got {list(data.keys())}")
        
        if "duplicate_exposants" not in data:
            return log_result(False, f"Expected 'duplicate_exposants' in response, got {list(data.keys())}")
        
        overbooked_key = "overbooked_sites" if "overbooked_sites" in data else "overloaded_sites"
        return log_result(True, f"Multi-site alerts successful: {overbooked_key}={len(data[overbooked_key])}, duplicate_exposants={len(data['duplicate_exposants'])}")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_15_auth_request_magic_link():
    """POST /api/auth/request-magic-link body {email: "swimua.tahiti@gmail.com"}"""
    log_test(15, "Auth request magic link - Devrait retourner 200 (mode TEST)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/request-magic-link",
            headers={"Content-Type": "application/json"},
            json={"email": "swimua.tahiti@gmail.com"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        return log_result(True, "Magic link request successful (mode TEST, no real email sent)")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_16_wizard_add_site():
    """POST /api/wizard/add-site body {organization_id: <un org-id existant>}"""
    log_test(16, "Wizard add-site - Créer nouveau site, puis delete-full")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Créer org test
        org_id = "org-teva-add-site"
        db.organizations.delete_one({"id": org_id})
        db.organizations.insert_one({
            "id": org_id,
            "name": "Test Org Add Site",
            "discipline": "Musique",
            "main_email": "teva.test.addsite@test.pf",
            "contact_name": "Teva Test",
            "main_phone": "87000006",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # POST wizard/add-site
        response = requests.post(
            f"{BASE_URL}/wizard/add-site",
            headers={"Content-Type": "application/json"},
            json={"organization_id": org_id}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok"):
            return log_result(False, f"Expected ok:true, got {data}")
        
        if not data.get("registration_id"):
            return log_result(False, f"Expected registration_id, got {data}")
        
        new_reg_id = data["registration_id"]
        
        # Vérifier en DB
        reg = db.registrations.find_one({"id": new_reg_id})
        if not reg:
            return log_result(False, "New registration not found in DB")
        
        # Delete-full le nouveau reg
        delete_response = requests.post(
            f"{BASE_URL}/admin/registrations/{new_reg_id}/delete-full",
            headers=ADMIN_HEADERS
        )
        
        if delete_response.status_code != 200:
            return log_result(False, f"Delete-full failed: {delete_response.status_code}: {delete_response.text}")
        
        # Cleanup org
        db.organizations.delete_one({"id": org_id})
        
        return log_result(True, f"Add-site successful: new registration_id={new_reg_id}, then deleted")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_17_wizard_org_sites():
    """GET /api/wizard/org-sites?organization_id=<un org-id existant>"""
    log_test(17, "Wizard org-sites - Devrait retourner 200 avec array sites")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Trouver une org existante
        org = db.organizations.find_one({"id": {"$regex": "^org-"}})
        if not org:
            return log_result(False, "No organization found for test")
        
        org_id = org["id"]
        
        # POST wizard/org-sites (note: endpoint is in POST handler, pass org_id in body)
        response = requests.post(
            f"{BASE_URL}/wizard/org-sites",
            headers={"Content-Type": "application/json"},
            json={"organization_id": org_id}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "sites" not in data:
            return log_result(False, f"Expected 'sites' in response, got {data}")
        
        if not isinstance(data["sites"], list):
            return log_result(False, f"Expected 'sites' to be array, got {type(data['sites'])}")
        
        return log_result(True, f"Org-sites successful: {len(data['sites'])} sites returned")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_18_dashboard_kpis():
    """GET /api/dashboard/kpis"""
    log_test(18, "Dashboard KPIs - Devrait retourner 200 avec total≥60")
    
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard/kpis",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "total" not in data:
            return log_result(False, f"Expected 'total' in response, got {data}")
        
        total = data["total"]
        if total < 60:
            return log_result(False, f"Expected total≥60, got {total}")
        
        return log_result(True, f"Dashboard KPIs successful: total={total}")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_19_mailing_status():
    """GET /api/mailing/status - Vérifier test_mode_active=true"""
    log_test(19, "Mailing status - Devrait retourner 200 avec test_mode_active=true")
    
    try:
        response = requests.get(
            f"{BASE_URL}/mailing/status",
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("test_mode_active"):
            return log_result(False, f"Expected test_mode_active=true, got {data.get('test_mode_active')}")
        
        return log_result(True, f"Mailing status successful: test_mode_active=true (SAFE)")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

def test_20_chatbot():
    """POST /api/chatbot (admin) body {message:"Combien d'exposants ?", role:"aracom_admin", user_id:"u-admin"}"""
    log_test(20, "Chatbot - Devrait retourner 200 avec reply")
    
    try:
        response = requests.post(
            f"{BASE_URL}/chatbot",
            headers=ADMIN_HEADERS,
            json={
                "message": "Combien d'exposants ?",
                "role": "aracom_admin",
                "user_id": "u-admin"
            }
        )
        
        if response.status_code != 200:
            return log_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("reply"):
            return log_result(False, f"Expected 'reply' in response, got {data}")
        
        return log_result(True, f"Chatbot successful: reply received (length={len(data['reply'])})")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

# ============================================================================
# NETTOYAGE FIN DE TEST
# ============================================================================

def test_21_cleanup_and_verify():
    """Nettoyage fin de test + vérification exposants réels intacts"""
    log_test(21, "Cleanup and verify - Supprimer test regs, vérifier exposants réels")
    
    try:
        from pymongo import MongoClient
        client = MongoClient('mongodb://localhost:27017/')
        db = client['your_database_name']
        
        # Supprimer toutes les regs/orgs test-teva-*
        test_prefixes = ["reg-teva-", "org-teva-", "reg-teka-", "org-teka-", "reg-aracom-", "org-aracom-", "reg-test-", "org-test-"]
        
        for prefix in test_prefixes:
            db.registrations.delete_many({"id": {"$regex": f"^{prefix}"}})
            db.organizations.delete_many({"id": {"$regex": f"^{prefix}"}})
            db.stand_assignments.delete_many({"registration_id": {"$regex": f"^{prefix}"}})
            db.animation_slots.delete_many({"registration_id": {"$regex": f"^{prefix}"}})
        
        # Vérifier que "I Mua Papeete" existe toujours
        org = db.organizations.find_one({"name": "I Mua Papeete"})
        if not org:
            return log_result(False, "CRITICAL: 'I Mua Papeete' was deleted!")
        
        # Compter registrations
        total_regs = db.registrations.count_documents({})
        if total_regs < 60:
            return log_result(False, f"CRITICAL: Only {total_regs} registrations found (expected ≥60)")
        
        return log_result(True, f"Cleanup successful: test regs deleted, {total_regs} registrations remain, 'I Mua Papeete' intact")
        
    except Exception as e:
        return log_result(False, f"Exception: {str(e)}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*80)
    print("BACKEND AUDIT SESSION 18 — Admin Override Panel + Non-régression")
    print("="*80)
    
    # Global variables for wizard tests
    global WIZARD_REG_ID, WIZARD_ORG_ID
    WIZARD_REG_ID = None
    WIZARD_ORG_ID = None
    
    results = []
    
    # PRIORITÉ 1 — NOUVEAUX ENDPOINTS ADMIN OVERRIDE (10 tests)
    print("\n" + "="*80)
    print("PRIORITÉ 1 — NOUVEAUX ENDPOINTS ADMIN OVERRIDE (CRITIQUE)")
    print("="*80)
    results.append(("Test 1: Reset stand", test_01_reset_stand()))
    results.append(("Test 2: Reset animations", test_02_reset_animations()))
    results.append(("Test 3: Reset days", test_03_reset_days()))
    results.append(("Test 4: Reset cancel", test_04_reset_cancel()))
    results.append(("Test 5: Reset invalid action", test_05_reset_invalid_action()))
    results.append(("Test 6: Reset without admin", test_06_reset_without_admin()))
    results.append(("Test 7: Reset nonexistent", test_07_reset_nonexistent()))
    results.append(("Test 8: Delete-full test-reg", test_08_delete_full_test_reg()))
    results.append(("Test 9: Delete-full protected", test_09_delete_full_protected()))
    results.append(("Test 10: Delete-full without admin", test_10_delete_full_without_admin()))
    
    # PRIORITÉ 2 — NON-RÉGRESSION wizard/profile (3 tests)
    print("\n" + "="*80)
    print("PRIORITÉ 2 — NON-RÉGRESSION CRITIQUE wizard/profile")
    print("="*80)
    results.append(("Test 11: Wizard start", test_11_wizard_start()))
    results.append(("Test 12: Wizard profile", test_12_wizard_profile()))
    results.append(("Test 13: Wizard profile verification", test_13_wizard_profile_verification()))
    
    # PRIORITÉ 3 — NON-RÉGRESSION endpoints critiques (7 tests)
    print("\n" + "="*80)
    print("PRIORITÉ 3 — NON-RÉGRESSION ENDPOINTS CRITIQUES RÉCENTS")
    print("="*80)
    results.append(("Test 14: Admin multi-site alerts", test_14_admin_multi_site_alerts()))
    results.append(("Test 15: Auth request magic link", test_15_auth_request_magic_link()))
    results.append(("Test 16: Wizard add-site", test_16_wizard_add_site()))
    results.append(("Test 17: Wizard org-sites", test_17_wizard_org_sites()))
    results.append(("Test 18: Dashboard KPIs", test_18_dashboard_kpis()))
    results.append(("Test 19: Mailing status", test_19_mailing_status()))
    results.append(("Test 20: Chatbot", test_20_chatbot()))
    
    # NETTOYAGE FIN DE TEST
    print("\n" + "="*80)
    print("NETTOYAGE FIN DE TEST")
    print("="*80)
    results.append(("Test 21: Cleanup and verify", test_21_cleanup_and_verify()))
    
    # RÉSUMÉ FINAL
    print("\n" + "="*80)
    print("RÉSUMÉ FINAL")
    print("="*80)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    print(f"\nTests passés: {passed}/{total} ({passed*100//total}%)")
    print("\nDétail par catégorie:")
    
    print("\n📋 PRIORITÉ 1 — Admin Override (10 tests):")
    for i in range(10):
        name, result = results[i]
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print("\n📋 PRIORITÉ 2 — Wizard/profile (3 tests):")
    for i in range(10, 13):
        name, result = results[i]
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print("\n📋 PRIORITÉ 3 — Non-régression (7 tests):")
    for i in range(13, 20):
        name, result = results[i]
        status = "✅" if result else "❌"
        print(f"  {status} {name}")
    
    print("\n📋 Cleanup (1 test):")
    name, result = results[20]
    status = "✅" if result else "❌"
    print(f"  {status} {name}")
    
    if passed == total:
        print("\n🎉 TOUS LES TESTS SONT PASSÉS!")
    else:
        print(f"\n⚠️ {total - passed} test(s) ont échoué")
    
    print("\n" + "="*80)
