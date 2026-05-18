#!/usr/bin/env python3
"""
SESSION 28i Backend Tests - Auto-Repair Missing Registrations
Tests the new endpoint for bulk-creating registrations for organizations without one.
"""

import requests
import json
import uuid
from pymongo import MongoClient
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
DB_NAME = os.getenv('DB_NAME', 'your_database_name')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

# Admin headers
ADMIN_HEADERS = {
    'x-user-role': 'aracom_admin',
    'x-user-id': 'u-admin',
    'Content-Type': 'application/json'
}

# Non-admin headers (exposant)
EXPOSANT_HEADERS = {
    'x-user-role': 'exposant',
    'x-user-id': 'u-test-exposant',
    'Content-Type': 'application/json'
}

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def setup_test_data():
    """Create test organizations in MongoDB"""
    print_test_header("SETUP - Creating test data")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Create 4 test organizations
        test_orgs = [
            {
                'id': 'org-test-r1',
                'name': 'Test Repair 1',
                'created_at': datetime.utcnow(),
                'main_email': 'test-repair-1@test.pf'
            },
            {
                'id': 'org-test-r2',
                'name': 'Test Repair 2',
                'created_at': datetime.utcnow(),
                'main_email': 'test-repair-2@test.pf'
            },
            {
                'id': 'org-test-r3',
                'name': 'Test Repair 3 Archived',
                'archived_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'main_email': 'test-repair-3@test.pf'
            },
            {
                'id': 'org-test-r4',
                'name': 'Test Repair 4 Mailing',
                'is_mailing_only': True,
                'created_at': datetime.utcnow(),
                'main_email': 'test-repair-4@test.pf'
            }
        ]
        
        db.organizations.insert_many(test_orgs)
        print_result(True, f"Created 4 test organizations (org-test-r1 to org-test-r4)")
        
        # Create existing registration for org-test-r2
        existing_reg = {
            'id': 'reg-test-r2-existing',
            'organization_id': 'org-test-r2',
            'edition_id': 'edition-2026',
            'status': 'a_confirmer',
            'created_at': datetime.utcnow(),
            'completion_percent': 10,
            'wizard_step': 1
        }
        
        db.registrations.insert_one(existing_reg)
        print_result(True, f"Created existing registration for org-test-r2")
        
        client.close()
        return True
        
    except Exception as e:
        print_result(False, f"Setup failed: {str(e)}")
        return False

def cleanup_test_data():
    """Remove test data from MongoDB"""
    print_test_header("CLEANUP - Removing test data")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        org_result = db.organizations.delete_many({'id': {'$regex': '^org-test-r'}})
        print_result(True, f"Deleted {org_result.deleted_count} test organizations")
        
        reg_result = db.registrations.delete_many({'organization_id': {'$regex': '^org-test-r'}})
        print_result(True, f"Deleted {reg_result.deleted_count} test registrations")
        
        client.close()
        
    except Exception as e:
        print_result(False, f"Cleanup failed: {str(e)}")

def test_1_auto_repair_without_admin():
    """Test 1: POST /api/admin/auto-repair/initialize-all-missing-registrations without admin → 403"""
    print_test_header("Test 1: Auto-repair without admin role")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/auto-repair/initialize-all-missing-registrations",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 403:
            data = response.json()
            if 'Accès admin requis' in data.get('error', ''):
                print_result(True, f"403 with correct error message: {data.get('error')}")
                return True
            else:
                print_result(False, f"403 but wrong error message: {data}")
                return False
        else:
            print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_2_auto_repair_happy_path():
    """Test 2: HAPPY PATH - Auto-repair creates missing registrations"""
    print_test_header("Test 2: HAPPY PATH - Auto-repair")
    
    try:
        # Step A: Call the auto-repair endpoint
        print("\n--- Step A: Call auto-repair endpoint ---")
        response = requests.post(
            f"{API_URL}/admin/auto-repair/initialize-all-missing-registrations",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        if not data.get('ok'):
            print_result(False, f"Response ok=false: {data}")
            return False
        
        if data.get('action') != 'auto_repair_done':
            print_result(False, f"Wrong action: {data.get('action')}")
            return False
        
        created = data.get('created', 0)
        already_ok = data.get('already_ok', 0)
        errors = data.get('errors', [])
        
        print_result(True, f"200 OK with action='auto_repair_done'")
        print_result(True, f"Created: {created}, Already OK: {already_ok}, Errors: {len(errors)}")
        
        # Verify at least 1 created (org-test-r1)
        if created < 1:
            print_result(False, f"Expected at least 1 created, got {created}")
            return False
        else:
            print_result(True, f"At least 1 registration created")
        
        # Verify at least 1 already_ok (org-test-r2)
        if already_ok < 1:
            print_result(False, f"Expected at least 1 already_ok, got {already_ok}")
            return False
        else:
            print_result(True, f"At least 1 registration already existed")
        
        # Step B: Verify via pymongo
        print("\n--- Step B: Verify database state ---")
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # org-test-r1: should have 1 new registration
        r1_count = db.registrations.count_documents({'organization_id': 'org-test-r1', 'status': {'$ne': 'annule'}})
        if r1_count == 1:
            print_result(True, f"org-test-r1: 1 registration created")
        else:
            print_result(False, f"org-test-r1: expected 1 registration, got {r1_count}")
            client.close()
            return False
        
        # org-test-r2: should still have 1 registration (existing)
        r2_count = db.registrations.count_documents({'organization_id': 'org-test-r2', 'status': {'$ne': 'annule'}})
        if r2_count == 1:
            print_result(True, f"org-test-r2: still has 1 registration (no duplicate)")
        else:
            print_result(False, f"org-test-r2: expected 1 registration, got {r2_count}")
            client.close()
            return False
        
        # org-test-r3: should have 0 registrations (archived → skipped)
        r3_count = db.registrations.count_documents({'organization_id': 'org-test-r3'})
        if r3_count == 0:
            print_result(True, f"org-test-r3: 0 registrations (archived → skipped)")
        else:
            print_result(False, f"org-test-r3: expected 0 registrations, got {r3_count}")
            client.close()
            return False
        
        # org-test-r4: should have 0 registrations (mailing_only → skipped)
        r4_count = db.registrations.count_documents({'organization_id': 'org-test-r4'})
        if r4_count == 0:
            print_result(True, f"org-test-r4: 0 registrations (mailing_only → skipped)")
        else:
            print_result(False, f"org-test-r4: expected 0 registrations, got {r4_count}")
            client.close()
            return False
        
        # Step C: Verify the new registration for org-test-r1
        print("\n--- Step C: Verify new registration details ---")
        r1_reg = db.registrations.find_one({'organization_id': 'org-test-r1', 'status': {'$ne': 'annule'}})
        
        if not r1_reg:
            print_result(False, "org-test-r1 registration not found")
            client.close()
            return False
        
        # Check status
        if r1_reg.get('status') == 'a_confirmer':
            print_result(True, f"status: 'a_confirmer'")
        else:
            print_result(False, f"status: expected 'a_confirmer', got '{r1_reg.get('status')}'")
            client.close()
            return False
        
        # Check source
        source = r1_reg.get('source')
        if source in ['auto_repair_bulk', 'auto_ensure']:
            print_result(True, f"source: '{source}'")
        else:
            print_result(False, f"source: expected 'auto_repair_bulk' or 'auto_ensure', got '{source}'")
            client.close()
            return False
        
        # Check candidature_locked
        if r1_reg.get('candidature_locked') == False or r1_reg.get('candidature_locked') is None:
            print_result(True, f"candidature_locked: false")
        else:
            print_result(False, f"candidature_locked: expected false, got {r1_reg.get('candidature_locked')}")
            client.close()
            return False
        
        # Check edition_id
        if r1_reg.get('edition_id') == 'edition-2026':
            print_result(True, f"edition_id: 'edition-2026'")
        else:
            print_result(False, f"edition_id: expected 'edition-2026', got '{r1_reg.get('edition_id')}'")
            client.close()
            return False
        
        # Step D: Call endpoint AGAIN (idempotency check)
        print("\n--- Step D: Idempotency check ---")
        response2 = requests.post(
            f"{API_URL}/admin/auto-repair/initialize-all-missing-registrations",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response2.status_code != 200:
            print_result(False, f"Second call: expected 200, got {response2.status_code}")
            client.close()
            return False
        
        data2 = response2.json()
        print(f"Second call response: {json.dumps(data2, indent=2)}")
        
        # Should have created=0 (all already exist now)
        if data2.get('created') == 0:
            print_result(True, f"Second call: created=0 (idempotent)")
        else:
            print_result(False, f"Second call: expected created=0, got {data2.get('created')}")
            client.close()
            return False
        
        # already_ok should include the one from first call
        if data2.get('already_ok', 0) >= already_ok + created:
            print_result(True, f"Second call: already_ok includes new registrations from first call")
        else:
            print_result(False, f"Second call: already_ok={data2.get('already_ok')}, expected >= {already_ok + created}")
            client.close()
            return False
        
        client.close()
        return True
        
    except Exception as e:
        print_result(False, f"Test failed: {str(e)}")
        return False

def test_3_regression_existing_endpoints():
    """Test 3: Verify existing endpoints still work (regression)"""
    print_test_header("Test 3: Regression - Existing endpoints")
    
    try:
        # Test 3.1: GET /api/dashboard/kpis
        print("\n--- Test 3.1: GET /api/dashboard/kpis ---")
        response = requests.get(
            f"{API_URL}/dashboard/kpis",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'total' in data and 'by_status' in data:
                print_result(True, f"GET /api/dashboard/kpis → 200 OK")
            else:
                print_result(False, f"GET /api/dashboard/kpis → 200 but missing fields: {data}")
                return False
        else:
            print_result(False, f"GET /api/dashboard/kpis → {response.status_code}: {response.text}")
            return False
        
        # Test 3.2: GET /api/stats/public
        print("\n--- Test 3.2: GET /api/stats/public ---")
        response = requests.get(
            f"{API_URL}/stats/public",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'sites' in data and 'stands' in data and 'associations' in data:
                print_result(True, f"GET /api/stats/public → 200 OK")
            else:
                print_result(False, f"GET /api/stats/public → 200 but missing fields: {data}")
                return False
        else:
            print_result(False, f"GET /api/stats/public → {response.status_code}: {response.text}")
            return False
        
        # Test 3.3: POST /api/admin/registrations/:id/unlock-candidature
        print("\n--- Test 3.3: POST /api/admin/registrations/:id/unlock-candidature ---")
        
        # First, find a valid registration
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        reg = db.registrations.find_one({'status': {'$ne': 'annule'}})
        client.close()
        
        if not reg:
            print_result(False, "No valid registration found for testing unlock-candidature")
            return False
        
        reg_id = reg.get('id')
        response = requests.post(
            f"{API_URL}/admin/registrations/{reg_id}/unlock-candidature",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('action') == 'candidature_unlocked':
                print_result(True, f"POST /api/admin/registrations/:id/unlock-candidature → 200 OK")
            else:
                print_result(False, f"POST unlock-candidature → 200 but wrong response: {data}")
                return False
        else:
            print_result(False, f"POST unlock-candidature → {response.status_code}: {response.text}")
            return False
        
        return True
        
    except Exception as e:
        print_result(False, f"Regression test failed: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("SESSION 28i - Auto-Repair Missing Registrations Backend Tests")
    print("="*80)
    
    # Setup
    if not setup_test_data():
        print("\n❌ SETUP FAILED - Cannot proceed with tests")
        return
    
    results = []
    
    # Run tests
    try:
        results.append(("Test 1: Auto-repair without admin", test_1_auto_repair_without_admin()))
        results.append(("Test 2: HAPPY PATH - Auto-repair", test_2_auto_repair_happy_path()))
        results.append(("Test 3: Regression - Existing endpoints", test_3_regression_existing_endpoints()))
        
    finally:
        # Cleanup
        cleanup_test_data()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total if total > 0 else 0}%)")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("✅ ALL TESTS PASSED - SESSION 28i auto-repair feature is fully functional")
    else:
        print("⚠️  SOME TESTS FAILED - Review the failures above")

if __name__ == '__main__':
    main()
