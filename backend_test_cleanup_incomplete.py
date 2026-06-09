#!/usr/bin/env python3
"""
SESSION 52g.2 — Test du nouvel endpoint admin de cleanup ciblé des simulations incomplètes.

ENDPOINT: POST /api/admin/simulation/cleanup-incomplete

Comportement attendu :
1. Auth: Réservé aracom_admin (role via header x-user-role: aracom_admin). Sans le rôle → 403.
2. Dry-run: {"dry_run": true} → retourne {ok:true, dry_run:true, would_delete: {registrations, organizations_candidate}, sample: [...]} SANS modifier la DB.
3. Apply: {"dry_run": false} (ou body vide) → effectue la suppression. Retourne {ok:true, dry_run:false, deleted: {registrations, organizations, users, ...cascade}, message: "..."}.
4. Sélection cible: SEULES les inscriptions avec (is_simulation:true OU sim_session_id non null) ET status NOT IN ['a_confirmer', 'confirme', 'verrouille'].
5. Cascade: Supprime les enregistrements liés dans 15 collections.
6. Orgs/users orphelins: Pour chaque org sim qui n'a plus aucune reg, la supprime + supprime les users sim liés.
7. Activity log: Crée un log SIMULATION_CLEANUP_INCOMPLETE.
"""

import requests
import json
import sys
from pymongo import MongoClient
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "your_database_name"

# Admin headers
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# Exposant headers (for 403 test)
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-test-exposant",
    "Content-Type": "application/json"
}

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {message}")

def setup_test_data():
    """Create 3 simulation registrations with different statuses"""
    print_test("SETUP - Creating test simulation data")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get edition_id
    edition = db.editions.find_one({"year": 2026})
    edition_id = edition["id"] if edition else "edition-2026"
    
    # Get a venue_id
    venue = db.venues.find_one({"is_available_2026": {"$ne": False}})
    venue_id = venue["id"] if venue else "venue-faaa"
    
    # Clean up any existing test data
    db.registrations.delete_many({"id": {"$regex": "^reg-sim-test-cleanup-"}})
    db.organizations.delete_many({"id": {"$regex": "^org-sim-test-cleanup-"}})
    db.users.delete_many({"id": {"$regex": "^u-sim-test-cleanup-"}})
    
    test_data = []
    
    # 1. Simulation with status='provisoire' (should be deleted)
    org1_id = "org-sim-test-cleanup-1"
    reg1_id = "reg-sim-test-cleanup-1"
    user1_id = "u-sim-test-cleanup-1"
    
    db.organizations.insert_one({
        "id": org1_id,
        "name": "Test Sim Org 1 - Provisoire",
        "is_simulation": True,
        "created_at": datetime.utcnow()
    })
    
    db.users.insert_one({
        "id": user1_id,
        "email": f"sim-test-1@example.com",
        "organization_id": org1_id,
        "is_simulation": True,
        "role_code": "exposant",
        "created_at": datetime.utcnow()
    })
    
    db.registrations.insert_one({
        "id": reg1_id,
        "organization_id": org1_id,
        "edition_id": edition_id,
        "venue_id": venue_id,
        "status": "provisoire",
        "is_simulation": True,
        "sim_session_id": "test-session-1",
        "is_waitlist": False,
        "created_at": datetime.utcnow()
    })
    
    test_data.append({
        "reg_id": reg1_id,
        "org_id": org1_id,
        "user_id": user1_id,
        "status": "provisoire",
        "should_be_deleted": True
    })
    
    # 2. Simulation with status='liste_attente', is_waitlist=true (should be deleted)
    org2_id = "org-sim-test-cleanup-2"
    reg2_id = "reg-sim-test-cleanup-2"
    user2_id = "u-sim-test-cleanup-2"
    
    db.organizations.insert_one({
        "id": org2_id,
        "name": "Test Sim Org 2 - Liste Attente",
        "is_simulation": True,
        "created_at": datetime.utcnow()
    })
    
    db.users.insert_one({
        "id": user2_id,
        "email": f"sim-test-2@example.com",
        "organization_id": org2_id,
        "is_simulation": True,
        "role_code": "exposant",
        "created_at": datetime.utcnow()
    })
    
    db.registrations.insert_one({
        "id": reg2_id,
        "organization_id": org2_id,
        "edition_id": edition_id,
        "venue_id": venue_id,
        "status": "liste_attente",
        "is_simulation": True,
        "sim_session_id": "test-session-2",
        "is_waitlist": True,
        "created_at": datetime.utcnow()
    })
    
    test_data.append({
        "reg_id": reg2_id,
        "org_id": org2_id,
        "user_id": user2_id,
        "status": "liste_attente",
        "should_be_deleted": True
    })
    
    # 3. Simulation with status='a_confirmer' (should be KEPT)
    org3_id = "org-sim-test-cleanup-3"
    reg3_id = "reg-sim-test-cleanup-3"
    user3_id = "u-sim-test-cleanup-3"
    
    db.organizations.insert_one({
        "id": org3_id,
        "name": "Test Sim Org 3 - A Confirmer",
        "is_simulation": True,
        "created_at": datetime.utcnow()
    })
    
    db.users.insert_one({
        "id": user3_id,
        "email": f"sim-test-3@example.com",
        "organization_id": org3_id,
        "is_simulation": True,
        "role_code": "exposant",
        "created_at": datetime.utcnow()
    })
    
    db.registrations.insert_one({
        "id": reg3_id,
        "organization_id": org3_id,
        "edition_id": edition_id,
        "venue_id": venue_id,
        "status": "a_confirmer",
        "is_simulation": True,
        "sim_session_id": "test-session-3",
        "is_waitlist": False,
        "stand_code": "TEST-01",
        "created_at": datetime.utcnow()
    })
    
    # Add some child records for cascade testing
    db.animation_slots.insert_one({
        "id": "anim-sim-test-1",
        "registration_id": reg1_id,
        "created_at": datetime.utcnow()
    })
    
    db.stand_assignments.insert_one({
        "id": "stand-sim-test-1",
        "registration_id": reg1_id,
        "created_at": datetime.utcnow()
    })
    
    test_data.append({
        "reg_id": reg3_id,
        "org_id": org3_id,
        "user_id": user3_id,
        "status": "a_confirmer",
        "should_be_deleted": False
    })
    
    client.close()
    
    print_result(True, f"Created 3 test simulation registrations")
    print(f"  - {reg1_id}: status=provisoire (should be deleted)")
    print(f"  - {reg2_id}: status=liste_attente (should be deleted)")
    print(f"  - {reg3_id}: status=a_confirmer (should be KEPT)")
    
    return test_data

def test_auth_required():
    """Test 1: Auth required - 403 without aracom_admin role"""
    print_test("TEST 1: Auth required - 403 without aracom_admin role")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup-incomplete",
            headers=EXPOSANT_HEADERS,
            json={"dry_run": True},
            timeout=10
        )
        
        if response.status_code == 403:
            data = response.json()
            if "admin" in data.get("error", "").lower() or "réservé" in data.get("error", "").lower():
                print_result(True, f"403 returned correctly: {data.get('error')}")
                return True
            else:
                print_result(False, f"403 but wrong error message: {data}")
                return False
        else:
            print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_dry_run():
    """Test 2: Dry run mode - returns preview without modifying DB"""
    print_test("TEST 2: Dry run mode - returns preview without modifying DB")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Count before
    count_before = db.registrations.count_documents({"id": {"$regex": "^reg-sim-test-cleanup-"}})
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup-incomplete",
            headers=ADMIN_HEADERS,
            json={"dry_run": True},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            client.close()
            return False
        
        data = response.json()
        
        # Verify response structure
        checks = []
        
        # Check ok field
        if data.get("ok") == True:
            checks.append(("ok=true", True))
        else:
            checks.append(("ok=true", False))
        
        # Check dry_run field
        if data.get("dry_run") == True:
            checks.append(("dry_run=true", True))
        else:
            checks.append(("dry_run=true", False))
        
        # Check would_delete field
        would_delete = data.get("would_delete", {})
        if "registrations" in would_delete and "organizations_candidate" in would_delete:
            checks.append(("would_delete structure", True))
            
            # Should be 2 registrations (provisoire + liste_attente)
            if would_delete["registrations"] == 2:
                checks.append(("would_delete.registrations=2", True))
            else:
                checks.append((f"would_delete.registrations=2 (got {would_delete['registrations']})", False))
            
            # Should be 2 organizations
            if would_delete["organizations_candidate"] == 2:
                checks.append(("would_delete.organizations_candidate=2", True))
            else:
                checks.append((f"would_delete.organizations_candidate=2 (got {would_delete['organizations_candidate']})", False))
        else:
            checks.append(("would_delete structure", False))
        
        # Check sample field
        sample = data.get("sample", [])
        if isinstance(sample, list) and len(sample) <= 10:
            checks.append(("sample is list with ≤10 items", True))
            
            # Verify sample structure
            if len(sample) > 0:
                first_sample = sample[0]
                required_fields = ["id", "status", "is_waitlist", "org", "created_at"]
                has_all_fields = all(field in first_sample for field in required_fields)
                if has_all_fields:
                    checks.append(("sample items have required fields", True))
                else:
                    checks.append(("sample items have required fields", False))
        else:
            checks.append(("sample is list with ≤10 items", False))
        
        # Count after - should be unchanged
        count_after = db.registrations.count_documents({"id": {"$regex": "^reg-sim-test-cleanup-"}})
        if count_before == count_after:
            checks.append((f"DB unchanged (count={count_after})", True))
        else:
            checks.append((f"DB unchanged (before={count_before}, after={count_after})", False))
        
        client.close()
        
        # Print all checks
        all_passed = True
        for check_name, passed in checks:
            print(f"  {'✅' if passed else '❌'} {check_name}")
            if not passed:
                all_passed = False
        
        if all_passed:
            print_result(True, "Dry run mode works correctly")
        else:
            print_result(False, "Some checks failed")
            print(f"Response: {json.dumps(data, indent=2)}")
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {e}")
        client.close()
        return False

def test_apply_mode():
    """Test 3: Apply mode - actually deletes incomplete simulations"""
    print_test("TEST 3: Apply mode - actually deletes incomplete simulations")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Count before
    count_before = db.registrations.count_documents({"id": {"$regex": "^reg-sim-test-cleanup-"}})
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup-incomplete",
            headers=ADMIN_HEADERS,
            json={"dry_run": False},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            client.close()
            return False
        
        data = response.json()
        
        # Verify response structure
        checks = []
        
        # Check ok field
        if data.get("ok") == True:
            checks.append(("ok=true", True))
        else:
            checks.append(("ok=true", False))
        
        # Check dry_run field
        if data.get("dry_run") == False:
            checks.append(("dry_run=false", True))
        else:
            checks.append(("dry_run=false", False))
        
        # Check deleted field
        deleted = data.get("deleted", {})
        if "registrations" in deleted:
            checks.append(("deleted structure", True))
            
            # Should have deleted 2 registrations
            if deleted["registrations"] == 2:
                checks.append(("deleted.registrations=2", True))
            else:
                checks.append((f"deleted.registrations=2 (got {deleted['registrations']})", False))
            
            # Should have deleted 2 organizations
            if deleted.get("organizations", 0) == 2:
                checks.append(("deleted.organizations=2", True))
            else:
                checks.append((f"deleted.organizations=2 (got {deleted.get('organizations', 0)})", False))
            
            # Should have deleted 2 users
            if deleted.get("users", 0) == 2:
                checks.append(("deleted.users=2", True))
            else:
                checks.append((f"deleted.users=2 (got {deleted.get('users', 0)})", False))
            
            # Check cascade deletions
            if "animation_slots" in deleted:
                checks.append(("cascade: animation_slots present", True))
            if "stand_assignments" in deleted:
                checks.append(("cascade: stand_assignments present", True))
        else:
            checks.append(("deleted structure", False))
        
        # Check message field
        if "message" in data:
            checks.append(("message present", True))
        else:
            checks.append(("message present", False))
        
        # Verify DB changes
        # Should have only 1 registration left (the a_confirmer one)
        count_after = db.registrations.count_documents({"id": {"$regex": "^reg-sim-test-cleanup-"}})
        if count_after == 1:
            checks.append((f"DB has 1 registration left (a_confirmer)", True))
        else:
            checks.append((f"DB has 1 registration left (got {count_after})", False))
        
        # Verify the kept registration is the a_confirmer one
        kept_reg = db.registrations.find_one({"id": "reg-sim-test-cleanup-3"})
        if kept_reg and kept_reg.get("status") == "a_confirmer":
            checks.append(("Kept registration is a_confirmer", True))
        else:
            checks.append(("Kept registration is a_confirmer", False))
        
        # Verify deleted registrations are gone
        deleted_reg1 = db.registrations.find_one({"id": "reg-sim-test-cleanup-1"})
        deleted_reg2 = db.registrations.find_one({"id": "reg-sim-test-cleanup-2"})
        if deleted_reg1 is None and deleted_reg2 is None:
            checks.append(("Deleted registrations are gone", True))
        else:
            checks.append(("Deleted registrations are gone", False))
        
        # Verify deleted organizations are gone
        deleted_org1 = db.organizations.find_one({"id": "org-sim-test-cleanup-1"})
        deleted_org2 = db.organizations.find_one({"id": "org-sim-test-cleanup-2"})
        if deleted_org1 is None and deleted_org2 is None:
            checks.append(("Deleted organizations are gone", True))
        else:
            checks.append(("Deleted organizations are gone", False))
        
        # Verify kept organization still exists
        kept_org = db.organizations.find_one({"id": "org-sim-test-cleanup-3"})
        if kept_org:
            checks.append(("Kept organization still exists", True))
        else:
            checks.append(("Kept organization still exists", False))
        
        # Verify cascade deletions
        anim_slot = db.animation_slots.find_one({"id": "anim-sim-test-1"})
        stand_assign = db.stand_assignments.find_one({"id": "stand-sim-test-1"})
        if anim_slot is None and stand_assign is None:
            checks.append(("Cascade deletions worked", True))
        else:
            checks.append(("Cascade deletions worked", False))
        
        # Verify activity log was created
        activity_log = db.activity_logs.find_one({"action": "SIMULATION_CLEANUP_INCOMPLETE"})
        if activity_log:
            checks.append(("Activity log created", True))
        else:
            checks.append(("Activity log created", False))
        
        client.close()
        
        # Print all checks
        all_passed = True
        for check_name, passed in checks:
            print(f"  {'✅' if passed else '❌'} {check_name}")
            if not passed:
                all_passed = False
        
        if all_passed:
            print_result(True, "Apply mode works correctly")
        else:
            print_result(False, "Some checks failed")
            print(f"Response: {json.dumps(data, indent=2)}")
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {e}")
        client.close()
        return False

def test_full_cleanup_non_regression():
    """Test 4: Non-regression - full cleanup endpoint still works"""
    print_test("TEST 4: Non-regression - full cleanup endpoint still works")
    
    # First, create a test simulation registration
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    edition = db.editions.find_one({"year": 2026})
    edition_id = edition["id"] if edition else "edition-2026"
    venue = db.venues.find_one({"is_available_2026": {"$ne": False}})
    venue_id = venue["id"] if venue else "venue-faaa"
    
    # Create a simulation with a_confirmer status (should be deleted by full cleanup)
    org_id = "org-sim-test-full-cleanup"
    reg_id = "reg-sim-test-full-cleanup"
    user_id = "u-sim-test-full-cleanup"
    
    db.organizations.insert_one({
        "id": org_id,
        "name": "Test Full Cleanup Org",
        "is_simulation": True,
        "created_at": datetime.utcnow()
    })
    
    db.users.insert_one({
        "id": user_id,
        "email": "sim-test-full@example.com",
        "organization_id": org_id,
        "is_simulation": True,
        "role_code": "exposant",
        "created_at": datetime.utcnow()
    })
    
    db.registrations.insert_one({
        "id": reg_id,
        "organization_id": org_id,
        "edition_id": edition_id,
        "venue_id": venue_id,
        "status": "a_confirmer",
        "is_simulation": True,
        "sim_session_id": "test-session-full",
        "created_at": datetime.utcnow()
    })
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            client.close()
            return False
        
        data = response.json()
        
        checks = []
        
        # Check ok field
        if data.get("ok") == True:
            checks.append(("ok=true", True))
        else:
            checks.append(("ok=true", False))
        
        # Check deleted field structure
        deleted = data.get("deleted", {})
        if "registrations" in deleted and "organizations" in deleted and "users" in deleted:
            checks.append(("deleted structure correct", True))
        else:
            checks.append(("deleted structure correct", False))
        
        # Check message field
        if "message" in data:
            checks.append(("message present", True))
        else:
            checks.append(("message present", False))
        
        # Verify the test registration was deleted
        reg_after = db.registrations.find_one({"id": reg_id})
        org_after = db.organizations.find_one({"id": org_id})
        user_after = db.users.find_one({"id": user_id})
        
        if reg_after is None and org_after is None and user_after is None:
            checks.append(("Test simulation data deleted", True))
        else:
            checks.append(("Test simulation data deleted", False))
        
        # Verify activity log was created
        activity_log = db.activity_logs.find_one({"action": "SIMULATION_CLEANUP"})
        if activity_log:
            checks.append(("Activity log created", True))
        else:
            checks.append(("Activity log created", False))
        
        client.close()
        
        # Print all checks
        all_passed = True
        for check_name, passed in checks:
            print(f"  {'✅' if passed else '❌'} {check_name}")
            if not passed:
                all_passed = False
        
        if all_passed:
            print_result(True, "Full cleanup endpoint works correctly")
        else:
            print_result(False, "Some checks failed")
            print(f"Response: {json.dumps(data, indent=2)}")
        
        return all_passed
        
    except Exception as e:
        print_result(False, f"Exception: {e}")
        client.close()
        return False

def cleanup_test_data():
    """Clean up all test data"""
    print_test("CLEANUP - Removing all test data")
    
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Delete all test registrations
    db.registrations.delete_many({"id": {"$regex": "^reg-sim-test-"}})
    
    # Delete all test organizations
    db.organizations.delete_many({"id": {"$regex": "^org-sim-test-"}})
    
    # Delete all test users
    db.users.delete_many({"id": {"$regex": "^u-sim-test-"}})
    
    # Delete test animation slots
    db.animation_slots.delete_many({"id": {"$regex": "^anim-sim-test-"}})
    
    # Delete test stand assignments
    db.stand_assignments.delete_many({"id": {"$regex": "^stand-sim-test-"}})
    
    client.close()
    
    print_result(True, "All test data cleaned up")

def main():
    print("\n" + "="*80)
    print("SESSION 52g.2 — Test endpoint POST /api/admin/simulation/cleanup-incomplete")
    print("="*80)
    
    results = []
    
    # Setup
    test_data = setup_test_data()
    
    # Run tests
    results.append(("Auth required (403)", test_auth_required()))
    results.append(("Dry run mode", test_dry_run()))
    results.append(("Apply mode", test_apply_mode()))
    results.append(("Full cleanup non-regression", test_full_cleanup_non_regression()))
    
    # Cleanup
    cleanup_test_data()
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Endpoint is 100% functional")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
