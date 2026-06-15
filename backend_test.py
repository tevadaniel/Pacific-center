#!/usr/bin/env python3
"""
SESSION 53 — Test du mécanisme d'auto-heal / auto-creation d'organisation dans GET /api/auth/me
"""
import requests
import json
from pymongo import MongoClient
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def print_test(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

# ============================================================================
# TEST 1 - Admin (non-régression)
# ============================================================================
def test_admin_no_org_creation():
    print_test("TEST 1 - Admin (non-régression) - Aucune org ne doit être créée pour admin")
    
    try:
        # Step 1: Login admin
        print_info("Step 1: Login admin admin@aracom.pf / Projetaracom12")
        login_resp = requests.post(
            f"{API_URL}/auth/password-login",
            json={"email": "admin@aracom.pf", "password": "Projetaracom12"},
            timeout=10
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code}"
        login_data = login_resp.json()
        assert login_data.get('ok') == True, "Login should return ok:true"
        assert login_data.get('user', {}).get('role_code') == 'aracom_admin', "Should be aracom_admin"
        print_success(f"Admin login OK: {login_data.get('user', {}).get('email')}")
        
        user_id = login_data['user']['id']
        
        # Step 2: GET /api/auth/me
        print_info("Step 2: GET /api/auth/me avec headers admin")
        me_resp = requests.get(
            f"{API_URL}/auth/me",
            headers={
                'x-user-id': user_id,
                'x-user-role': 'aracom_admin'
            },
            timeout=10
        )
        assert me_resp.status_code == 200, f"GET /auth/me failed: {me_resp.status_code}"
        me_data = me_resp.json()
        assert me_data.get('user', {}).get('role_code') == 'aracom_admin', "Role should be aracom_admin"
        assert me_data.get('organization') is None, "Admin should NOT have organization"
        print_success("Admin has no organization (expected)")
        
        # Step 3: Verify no org was created for admin
        print_info("Step 3: Vérifier qu'aucune org 'org-auto-...' n'a été créée pour admin")
        auto_orgs = list(db.organizations.find({'id': {'$regex': '^org-auto-'}}))
        print_info(f"Found {len(auto_orgs)} org-auto-* organizations in DB")
        
        # Check activity_logs - should NOT have auto_create_org for admin
        admin_auto_logs = list(db.activity_logs.find({
            'user_id': user_id,
            'action_type': 'auto_create_org'
        }))
        assert len(admin_auto_logs) == 0, f"Admin should NOT have auto_create_org logs, found {len(admin_auto_logs)}"
        print_success("No auto_create_org logs for admin (expected)")
        
        print_success("TEST 1 PASSED - Admin non-regression OK")
        return True
        
    except Exception as e:
        print_error(f"TEST 1 FAILED: {str(e)}")
        return False

# ============================================================================
# TEST 2 - Exposant existant avec organization_id valide (non-régression)
# ============================================================================
def test_existing_exposant_no_change():
    print_test("TEST 2 - Exposant existant avec organization_id valide (non-régression)")
    
    try:
        # Find an existing exposant with organization_id
        print_info("Step 1: Trouver un exposant existant avec organization_id")
        existing_user = db.users.find_one({
            'role_code': 'exposant',
            'organization_id': {'$ne': None, '$exists': True}
        })
        
        if not existing_user:
            print_error("No existing exposant found with organization_id")
            return False
        
        print_success(f"Found exposant: {existing_user.get('email')} with org_id: {existing_user.get('organization_id')}")
        
        original_org_id = existing_user.get('organization_id')
        user_id = existing_user.get('id')
        
        # Step 2: GET /api/auth/me
        print_info("Step 2: GET /api/auth/me avec headers exposant")
        me_resp = requests.get(
            f"{API_URL}/auth/me",
            headers={
                'x-user-id': user_id,
                'x-user-role': 'exposant'
            },
            timeout=10
        )
        assert me_resp.status_code == 200, f"GET /auth/me failed: {me_resp.status_code}"
        me_data = me_resp.json()
        
        # Step 3: Verify organization_id unchanged
        print_info("Step 3: Vérifier que organization_id reste inchangé")
        assert me_data.get('user', {}).get('organization_id') == original_org_id, "Organization ID should not change"
        assert me_data.get('organization') is not None, "Organization should be returned"
        assert me_data.get('organization', {}).get('id') == original_org_id, "Organization ID should match"
        
        # Verify it's NOT an auto-created org
        org_id = me_data.get('organization', {}).get('id', '')
        assert not org_id.startswith('org-auto-'), f"Should NOT be auto-created org, got: {org_id}"
        print_success(f"Organization valid: {me_data.get('organization', {}).get('name')}")
        
        # Step 4: Verify no auto_create_org log was created
        print_info("Step 4: Vérifier qu'aucun log auto_create_org n'a été créé")
        auto_create_logs = list(db.activity_logs.find({
            'user_id': user_id,
            'action_type': 'auto_create_org'
        }))
        assert len(auto_create_logs) == 0, f"Should NOT have auto_create_org logs, found {len(auto_create_logs)}"
        print_success("No auto_create_org logs (expected)")
        
        print_success("TEST 2 PASSED - Existing exposant non-regression OK")
        return True
        
    except Exception as e:
        print_error(f"TEST 2 FAILED: {str(e)}")
        return False

# ============================================================================
# TEST 3 - Exposant orphelin avec pattern u-exp-{orgId} (auto-link)
# ============================================================================
def test_orphan_exposant_auto_link():
    print_test("TEST 3 - Exposant orphelin avec pattern u-exp-{orgId} (auto-link)")
    
    test_user_id = "u-exp-test-orphan-link-XYZ"
    test_org_id = "test-orphan-link-XYZ"
    
    try:
        # Cleanup first
        print_info("Cleanup: Supprimer les données de test existantes")
        db.users.delete_many({'id': test_user_id})
        db.organizations.delete_many({'id': test_org_id})
        db.activity_logs.delete_many({'user_id': test_user_id})
        
        # Step 1: Create test organization
        print_info(f"Step 1: Créer organisation test id={test_org_id}")
        db.organizations.insert_one({
            'id': test_org_id,
            'name': 'Test Orphan Link Organization',
            'discipline': 'Test',
            'priority_level': 'confirme',
            'main_email': 'orphan-link@test.local',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })
        print_success(f"Organization created: {test_org_id}")
        
        # Step 2: Create orphan user (no organization_id)
        print_info(f"Step 2: Créer user orphelin id={test_user_id} SANS organization_id")
        db.users.insert_one({
            'id': test_user_id,
            'email': 'orphan-link@test.local',
            'full_name': 'Test Orphan Link User',
            'role_code': 'exposant',
            'organization_id': None,  # ORPHAN
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })
        print_success(f"Orphan user created: {test_user_id}")
        
        # Step 3: GET /api/auth/me (should trigger auto-link)
        print_info("Step 3: GET /api/auth/me (devrait déclencher auto-link)")
        me_resp = requests.get(
            f"{API_URL}/auth/me",
            headers={
                'x-user-id': test_user_id,
                'x-user-role': 'exposant'
            },
            timeout=10
        )
        assert me_resp.status_code == 200, f"GET /auth/me failed: {me_resp.status_code}"
        me_data = me_resp.json()
        
        # Step 4: Verify organization returned
        print_info("Step 4: Vérifier que organization est retournée")
        assert me_data.get('organization') is not None, "Organization should be returned"
        assert me_data.get('organization', {}).get('id') == test_org_id, f"Organization ID should be {test_org_id}"
        print_success(f"Organization returned: {me_data.get('organization', {}).get('name')}")
        
        # Step 5: Verify user.organization_id updated in DB
        print_info("Step 5: Vérifier que user.organization_id est mis à jour en DB")
        updated_user = db.users.find_one({'id': test_user_id})
        assert updated_user is not None, "User should exist in DB"
        assert updated_user.get('organization_id') == test_org_id, f"User organization_id should be {test_org_id}"
        assert updated_user.get('auto_healed_at') is not None, "auto_healed_at should be set"
        print_success(f"User organization_id updated: {updated_user.get('organization_id')}")
        
        # Step 6: Verify activity_log created
        print_info("Step 6: Vérifier qu'un activity_log auto_heal_link_org a été créé")
        heal_logs = list(db.activity_logs.find({
            'user_id': test_user_id,
            'action_type': 'auto_heal_link_org'
        }))
        assert len(heal_logs) > 0, "Should have auto_heal_link_org log"
        print_success(f"Activity log created: {len(heal_logs)} log(s) found")
        
        print_success("TEST 3 PASSED - Auto-link orphan exposant OK")
        return True
        
    except Exception as e:
        print_error(f"TEST 3 FAILED: {str(e)}")
        return False
    finally:
        # Cleanup
        print_info("Cleanup: Supprimer les données de test")
        db.users.delete_many({'id': test_user_id})
        db.organizations.delete_many({'id': test_org_id})
        db.activity_logs.delete_many({'user_id': test_user_id})

# ============================================================================
# TEST 4 - HAPPY PATH FILET DE SÉCURITÉ (auto-create org + registration)
# ============================================================================
def test_safety_net_auto_create():
    print_test("TEST 4 - HAPPY PATH FILET DE SÉCURITÉ (auto-create org + registration)")
    
    test_user_id = "u-exp-test-noorg-ABC123"
    
    try:
        # Cleanup first
        print_info("Cleanup: Supprimer les données de test existantes")
        db.users.delete_many({'id': test_user_id})
        # Find and delete any auto-created orgs for this user
        auto_orgs = list(db.organizations.find({'id': {'$regex': 'org-auto-.*ABC123'}}))
        for org in auto_orgs:
            db.registrations.delete_many({'organization_id': org['id']})
            db.organizations.delete_one({'id': org['id']})
        db.activity_logs.delete_many({'user_id': test_user_id})
        
        # Step 1: Create orphan user WITHOUT matching org
        print_info(f"Step 1: Créer user orphelin id={test_user_id} SANS org existante")
        db.users.insert_one({
            'id': test_user_id,
            'email': 'noorg@test.local',
            'full_name': 'Test NoOrg Exposant',
            'role_code': 'exposant',
            'organization_id': None,  # NO ORG
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })
        print_success(f"Orphan user created: {test_user_id}")
        
        # Verify no org exists for this user
        print_info("Step 2: Vérifier qu'AUCUNE organisation n'existe pour ce user")
        # Check pattern-based org (would be "test-noorg-ABC123" if auto-link was triggered)
        pattern_org = db.organizations.find_one({'id': 'test-noorg-ABC123'})
        assert pattern_org is None, "Pattern-based org should NOT exist"
        # Check auto-created orgs
        auto_org_count_before = db.organizations.count_documents({'id': {'$regex': 'org-auto-.*ABC123'}})
        assert auto_org_count_before == 0, "Auto-created org should NOT exist yet"
        print_success("No organization exists for this user (expected)")
        
        # Step 3: GET /api/auth/me (should trigger auto-create)
        print_info("Step 3: GET /api/auth/me (devrait déclencher auto-create)")
        me_resp = requests.get(
            f"{API_URL}/auth/me",
            headers={
                'x-user-id': test_user_id,
                'x-user-role': 'exposant'
            },
            timeout=10
        )
        assert me_resp.status_code == 200, f"GET /auth/me failed: {me_resp.status_code}"
        me_data = me_resp.json()
        
        # Step 4: Verify organization returned
        print_info("Step 4: Vérifier que organization est retournée (non-null)")
        assert me_data.get('organization') is not None, "Organization should be returned"
        org_name = me_data.get('organization', {}).get('name')
        assert org_name == 'Test NoOrg Exposant', f"Organization name should be 'Test NoOrg Exposant', got: {org_name}"
        print_success(f"Organization returned: {org_name}")
        
        new_org_id = me_data.get('organization', {}).get('id')
        assert new_org_id is not None, "Organization ID should not be None"
        assert new_org_id.startswith('org-auto-'), f"Organization ID should start with 'org-auto-', got: {new_org_id}"
        print_success(f"New organization ID: {new_org_id}")
        
        # Step 5: Verify org exists in DB
        print_info("Step 5: Vérifier qu'une nouvelle org existe en DB")
        new_org = db.organizations.find_one({'id': new_org_id})
        assert new_org is not None, "New organization should exist in DB"
        assert new_org.get('source_origin') == 'auto_heal_auth_me', "source_origin should be 'auto_heal_auth_me'"
        print_success(f"Organization in DB: {new_org.get('name')}, source_origin: {new_org.get('source_origin')}")
        
        # Step 6: Verify user.organization_id updated
        print_info("Step 6: Vérifier que user.organization_id est défini")
        updated_user = db.users.find_one({'id': test_user_id})
        assert updated_user is not None, "User should exist in DB"
        assert updated_user.get('organization_id') == new_org_id, f"User organization_id should be {new_org_id}"
        print_success(f"User organization_id: {updated_user.get('organization_id')}")
        
        # Step 7: Verify registration prospect created
        print_info("Step 7: Vérifier qu'une registration prospect a été créée")
        expected_reg_id = f"reg-{new_org_id}"
        new_reg = db.registrations.find_one({'id': expected_reg_id})
        assert new_reg is not None, f"Registration {expected_reg_id} should exist"
        assert new_reg.get('status') == 'prospect', "Registration status should be 'prospect'"
        assert new_reg.get('completion_percent') == 5, "completion_percent should be 5"
        assert new_reg.get('wizard_step') == 1, "wizard_step should be 1"
        assert new_reg.get('source') == 'auto_heal_auth_me', "source should be 'auto_heal_auth_me'"
        print_success(f"Registration created: {expected_reg_id}, status: {new_reg.get('status')}")
        
        # Step 8: Verify activity_log created
        print_info("Step 8: Vérifier qu'un activity_log auto_create_org a été créé")
        create_logs = list(db.activity_logs.find({
            'user_id': test_user_id,
            'action_type': 'auto_create_org'
        }))
        assert len(create_logs) > 0, "Should have auto_create_org log"
        print_success(f"Activity log created: {len(create_logs)} log(s) found")
        
        print_success("TEST 4 PASSED - Safety net auto-create OK")
        return True, new_org_id
        
    except Exception as e:
        print_error(f"TEST 4 FAILED: {str(e)}")
        return False, None

# ============================================================================
# TEST 5 - IDEMPOTENCE (no duplicates on second call)
# ============================================================================
def test_idempotence(test_user_id, expected_org_id):
    print_test("TEST 5 - IDEMPOTENCE (pas de doublons sur second appel)")
    
    try:
        # Step 1: Count orgs and registrations before
        print_info("Step 1: Compter les orgs et registrations avant second appel")
        org_count_before = db.organizations.count_documents({'id': expected_org_id})
        reg_count_before = db.registrations.count_documents({'organization_id': expected_org_id})
        print_info(f"Before: {org_count_before} org(s), {reg_count_before} registration(s)")
        
        # Step 2: Call GET /api/auth/me again
        print_info("Step 2: Rappeler GET /api/auth/me avec les MÊMES headers")
        me_resp = requests.get(
            f"{API_URL}/auth/me",
            headers={
                'x-user-id': test_user_id,
                'x-user-role': 'exposant'
            },
            timeout=10
        )
        assert me_resp.status_code == 200, f"GET /auth/me failed: {me_resp.status_code}"
        me_data = me_resp.json()
        
        # Step 3: Verify same organization returned
        print_info("Step 3: Vérifier que la MÊME organization est retournée")
        returned_org_id = me_data.get('organization', {}).get('id')
        assert returned_org_id == expected_org_id, f"Should return same org ID: {expected_org_id}, got: {returned_org_id}"
        print_success(f"Same organization returned: {returned_org_id}")
        
        # Step 4: Verify no new org created
        print_info("Step 4: Vérifier qu'AUCUNE nouvelle org n'a été créée")
        org_count_after = db.organizations.count_documents({'id': expected_org_id})
        assert org_count_after == org_count_before, f"Org count should remain {org_count_before}, got: {org_count_after}"
        print_success(f"Org count unchanged: {org_count_after}")
        
        # Step 5: Verify no new registration created
        print_info("Step 5: Vérifier qu'AUCUNE nouvelle registration n'a été créée")
        reg_count_after = db.registrations.count_documents({'organization_id': expected_org_id})
        assert reg_count_after == reg_count_before, f"Registration count should remain {reg_count_before}, got: {reg_count_after}"
        print_success(f"Registration count unchanged: {reg_count_after}")
        
        print_success("TEST 5 PASSED - Idempotence OK")
        return True
        
    except Exception as e:
        print_error(f"TEST 5 FAILED: {str(e)}")
        return False

# ============================================================================
# CLEANUP
# ============================================================================
def cleanup_test_data():
    print_test("NETTOYAGE APRÈS TESTS")
    
    try:
        # Test 3 cleanup
        print_info("Nettoyage TEST 3...")
        db.users.delete_many({'id': 'u-exp-test-orphan-link-XYZ'})
        db.organizations.delete_many({'id': 'test-orphan-link-XYZ'})
        db.activity_logs.delete_many({'user_id': 'u-exp-test-orphan-link-XYZ'})
        
        # Test 4 & 5 cleanup
        print_info("Nettoyage TEST 4 & 5...")
        test_user_id = "u-exp-test-noorg-ABC123"
        db.users.delete_many({'id': test_user_id})
        
        # Find and delete auto-created orgs
        auto_orgs = list(db.organizations.find({'id': {'$regex': 'org-auto-.*ABC123'}}))
        for org in auto_orgs:
            org_id = org['id']
            print_info(f"Suppression org: {org_id}")
            db.registrations.delete_many({'organization_id': org_id})
            db.organizations.delete_one({'id': org_id})
        
        db.activity_logs.delete_many({'user_id': test_user_id})
        
        print_success("Nettoyage terminé")
        return True
        
    except Exception as e:
        print_error(f"Cleanup failed: {str(e)}")
        return False

# ============================================================================
# MAIN
# ============================================================================
def main():
    print("\n" + "="*80)
    print("SESSION 53 — Test du mécanisme d'auto-heal / auto-creation d'organisation")
    print("="*80)
    
    results = []
    
    # TEST 1
    results.append(("TEST 1 - Admin non-regression", test_admin_no_org_creation()))
    
    # TEST 2
    results.append(("TEST 2 - Existing exposant non-regression", test_existing_exposant_no_change()))
    
    # TEST 3
    results.append(("TEST 3 - Auto-link orphan exposant", test_orphan_exposant_auto_link()))
    
    # TEST 4
    test4_result, new_org_id = test_safety_net_auto_create()
    results.append(("TEST 4 - Safety net auto-create", test4_result))
    
    # TEST 5 (only if TEST 4 passed)
    if test4_result and new_org_id:
        test_user_id = "u-exp-test-noorg-ABC123"
        results.append(("TEST 5 - Idempotence", test_idempotence(test_user_id, new_org_id)))
    else:
        results.append(("TEST 5 - Idempotence", False))
        print_error("TEST 5 SKIPPED - TEST 4 failed")
    
    # CLEANUP
    cleanup_test_data()
    
    # SUMMARY
    print("\n" + "="*80)
    print("RÉSUMÉ DES TESTS")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("\n" + "="*80)
    print(f"RÉSULTAT FINAL: {passed}/{total} tests passés ({passed*100//total}%)")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
