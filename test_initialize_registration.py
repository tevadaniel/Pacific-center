#!/usr/bin/env python3
"""
Test script for POST /api/admin/organizations/:id/initialize-registration endpoint

Tests:
1. Permission check (403 without admin role)
2. 404 on non-existent organization
3. Happy path - create org, initialize registration, verify
4. Idempotency check (400 if already has 2026 dossier)
5. Initialize without venue
"""

import os
import sys
import requests
import json
from pymongo import MongoClient
from datetime import datetime
import uuid

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

# Admin headers
ADMIN_HEADERS = {
    'Content-Type': 'application/json',
    'x-user-role': 'aracom_admin',
    'x-user-id': 'u-admin'
}

# Non-admin headers (exposant)
EXPOSANT_HEADERS = {
    'Content-Type': 'application/json',
    'x-user-role': 'exposant',
    'x-user-id': 'u-test-exposant'
}

def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {message}")
    return success

def get_db():
    """Get MongoDB database connection"""
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def cleanup_test_data(db):
    """Clean up test organizations and registrations"""
    print("\n🧹 Cleaning up test data...")
    result_orgs = db.organizations.delete_many({'source': 'admin_manual_test'})
    print(f"   Deleted {result_orgs.deleted_count} test organizations")
    
    # Get all test org IDs to clean up related registrations
    test_org_ids = []
    for org in db.organizations.find({'source': 'admin_manual_test'}):
        test_org_ids.append(org['id'])
    
    if test_org_ids:
        result_regs = db.registrations.delete_many({'organization_id': {'$in': test_org_ids}})
        print(f"   Deleted {result_regs.deleted_count} test registrations")

def test_1_permission_check():
    """Test 1: Permission check (no admin role)"""
    print_test(1, "Permission check (no admin role)")
    
    try:
        # Try to initialize without admin role
        response = requests.post(
            f"{API_BASE}/admin/organizations/some-id/initialize-registration",
            headers=EXPOSANT_HEADERS,
            json={}
        )
        
        if response.status_code == 403:
            data = response.json()
            if 'error' in data and 'admin' in data['error'].lower():
                return print_result(True, f"Got expected 403 with error: {data['error']}")
            else:
                return print_result(False, f"Got 403 but unexpected error message: {data}")
        else:
            return print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
    
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_2_non_existent_org():
    """Test 2: 404 on non-existent organization"""
    print_test(2, "404 on non-existent organization")
    
    try:
        response = requests.post(
            f"{API_BASE}/admin/organizations/non-existent-org-xyz-12345/initialize-registration",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        if response.status_code == 404:
            data = response.json()
            if 'error' in data and 'introuvable' in data['error'].lower():
                return print_result(True, f"Got expected 404 with error: {data['error']}")
            else:
                return print_result(False, f"Got 404 but unexpected error message: {data}")
        else:
            return print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
    
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_3_happy_path():
    """Test 3: Happy path - create org, initialize registration, verify"""
    print_test(3, "Happy path - create org, initialize registration, verify")
    
    db = get_db()
    test_org_id = f"org-test-init-{uuid.uuid4().hex[:8]}"
    test_passed = True
    
    try:
        # Step A: Create a brand new organization via direct DB insert
        print("\n  Step A: Creating test organization in DB...")
        test_org = {
            'id': test_org_id,
            'name': 'Asso Test Initialization',
            'discipline': 'Test',
            'main_email': 'testinit@example.com',
            'contact_name': 'Test Contact',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'source': 'admin_manual_test'
        }
        db.organizations.insert_one(test_org)
        print(f"  ✓ Created organization: {test_org_id}")
        
        # Step B: Verify GET /api/registrations does NOT return this org
        print("\n  Step B: Verifying org is not in registrations list...")
        response = requests.get(f"{API_BASE}/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            registrations = response.json()
            # Check if it's a list or dict with registrations key
            if isinstance(registrations, dict) and 'registrations' in registrations:
                registrations = registrations['registrations']
            org_ids = [r.get('organization_id') for r in registrations if isinstance(r, dict)]
            if test_org_id not in org_ids:
                print(f"  ✓ Organization not in registrations list (as expected)")
            else:
                print(f"  ✗ Organization found in registrations list (unexpected)")
                test_passed = False
        else:
            print(f"  ⚠ Could not verify registrations list (status {response.status_code}), continuing...")
        
        # Step C: Call POST /api/admin/organizations/:id/initialize-registration
        print("\n  Step C: Initializing registration with venue_id='venue-aru'...")
        response = requests.post(
            f"{API_BASE}/admin/organizations/{test_org_id}/initialize-registration",
            headers=ADMIN_HEADERS,
            json={'venue_id': 'venue-aru'}
        )
        
        if response.status_code != 200:
            print(f"  ✗ Expected 200, got {response.status_code}: {response.text}")
            test_passed = False
            return print_result(test_passed, "Failed to initialize registration")
        
        data = response.json()
        if not data.get('ok'):
            print(f"  ✗ Response ok=false: {data}")
            test_passed = False
            return print_result(test_passed, "Response ok=false")
        
        if data.get('action') != 'registration_initialized':
            print(f"  ✗ Expected action='registration_initialized', got: {data.get('action')}")
            test_passed = False
        
        new_reg_id = data.get('registration_id')
        if not new_reg_id:
            print(f"  ✗ No registration_id in response: {data}")
            test_passed = False
            return print_result(test_passed, "No registration_id in response")
        
        print(f"  ✓ Registration initialized: {new_reg_id}")
        
        # Step D: GET /api/registrations/:newRegId
        print(f"\n  Step D: Verifying registration {new_reg_id}...")
        response = requests.get(f"{API_BASE}/registrations/{new_reg_id}", headers=ADMIN_HEADERS)
        
        if response.status_code != 200:
            print(f"  ✗ Expected 200, got {response.status_code}: {response.text}")
            test_passed = False
            return print_result(test_passed, "Failed to get registration")
        
        data = response.json()
        reg = data.get('registration', {})
        
        # Verify registration fields
        checks = [
            (reg.get('status') == 'a_confirmer', f"status is 'a_confirmer' (got: {reg.get('status')})"),
            (reg.get('venue_id') == 'venue-aru', f"venue_id is 'venue-aru' (got: {reg.get('venue_id')})"),
            (reg.get('edition_id') == 'edition-2026', f"edition_id is 'edition-2026' (got: {reg.get('edition_id')})"),
            (reg.get('source') == 'admin_manual', f"source is 'admin_manual' (got: {reg.get('source')})"),
            (reg.get('candidature_locked') == False, f"candidature_locked is false (got: {reg.get('candidature_locked')})"),
        ]
        
        for check, desc in checks:
            if check:
                print(f"  ✓ {desc}")
            else:
                print(f"  ✗ {desc}")
                test_passed = False
        
        # Step E: GET /api/exposant/my-sites?organization_id=:newOrgId
        print(f"\n  Step E: Verifying my-sites endpoint...")
        response = requests.get(
            f"{API_BASE}/exposant/my-sites?organization_id={test_org_id}",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 200:
            print(f"  ✗ Expected 200, got {response.status_code}: {response.text}")
            test_passed = False
        else:
            sites = response.json()
            if not isinstance(sites, list):
                print(f"  ✗ Expected array, got: {type(sites)}")
                test_passed = False
            elif len(sites) != 1:
                print(f"  ✗ Expected 1 site, got {len(sites)}")
                test_passed = False
            elif sites[0].get('id') != new_reg_id:
                print(f"  ✗ Expected registration_id {new_reg_id}, got {sites[0].get('id')}")
                test_passed = False
            else:
                print(f"  ✓ my-sites returned 1 registration as expected")
        
        return print_result(test_passed, "Happy path test completed")
    
    except Exception as e:
        print(f"  ✗ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return print_result(False, f"Exception: {str(e)}")

def test_4_idempotency():
    """Test 4: Idempotency check - call same endpoint twice"""
    print_test(4, "Idempotency check - call same endpoint twice")
    
    db = get_db()
    test_org_id = f"org-test-idem-{uuid.uuid4().hex[:8]}"
    test_passed = True
    
    try:
        # Create test organization
        print("\n  Creating test organization...")
        test_org = {
            'id': test_org_id,
            'name': 'Asso Test Idempotency',
            'discipline': 'Test',
            'main_email': 'testidem@example.com',
            'contact_name': 'Test Contact',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'source': 'admin_manual_test'
        }
        db.organizations.insert_one(test_org)
        print(f"  ✓ Created organization: {test_org_id}")
        
        # First call - should succeed
        print("\n  First call to initialize-registration...")
        response = requests.post(
            f"{API_BASE}/admin/organizations/{test_org_id}/initialize-registration",
            headers=ADMIN_HEADERS,
            json={'venue_id': 'venue-faaa'}
        )
        
        if response.status_code != 200:
            print(f"  ✗ First call failed: {response.status_code}: {response.text}")
            test_passed = False
            return print_result(test_passed, "First call failed")
        
        data = response.json()
        print(f"  ✓ First call succeeded: {data.get('registration_id')}")
        
        # Second call - should fail with 400
        print("\n  Second call to initialize-registration (should fail)...")
        response = requests.post(
            f"{API_BASE}/admin/organizations/{test_org_id}/initialize-registration",
            headers=ADMIN_HEADERS,
            json={'venue_id': 'venue-pun'}
        )
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and '2026' in data['error']:
                print(f"  ✓ Got expected 400 with error: {data['error']}")
            else:
                print(f"  ✗ Got 400 but unexpected error: {data}")
                test_passed = False
        else:
            print(f"  ✗ Expected 400, got {response.status_code}: {response.text}")
            test_passed = False
        
        return print_result(test_passed, "Idempotency check completed")
    
    except Exception as e:
        print(f"  ✗ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return print_result(False, f"Exception: {str(e)}")

def test_5_initialize_without_venue():
    """Test 5: Initialize without venue"""
    print_test(5, "Initialize without venue")
    
    db = get_db()
    test_org_id = f"org-test-novenue-{uuid.uuid4().hex[:8]}"
    test_passed = True
    
    try:
        # Step A: Create test organization
        print("\n  Step A: Creating test organization...")
        test_org = {
            'id': test_org_id,
            'name': 'Asso Test No Venue',
            'discipline': 'Test',
            'main_email': 'testnovenue@example.com',
            'contact_name': 'Test Contact',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'source': 'admin_manual_test'
        }
        db.organizations.insert_one(test_org)
        print(f"  ✓ Created organization: {test_org_id}")
        
        # Step B: Call initialize-registration without venue_id
        print("\n  Step B: Initializing registration without venue_id...")
        response = requests.post(
            f"{API_BASE}/admin/organizations/{test_org_id}/initialize-registration",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        if response.status_code != 200:
            print(f"  ✗ Expected 200, got {response.status_code}: {response.text}")
            test_passed = False
            return print_result(test_passed, "Failed to initialize registration")
        
        data = response.json()
        new_reg_id = data.get('registration_id')
        print(f"  ✓ Registration initialized: {new_reg_id}")
        
        # Step C: Verify registration has venue_id=null and wizard_step=1
        print(f"\n  Step C: Verifying registration fields...")
        response = requests.get(f"{API_BASE}/registrations/{new_reg_id}", headers=ADMIN_HEADERS)
        
        if response.status_code != 200:
            print(f"  ✗ Expected 200, got {response.status_code}: {response.text}")
            test_passed = False
            return print_result(test_passed, "Failed to get registration")
        
        data = response.json()
        reg = data.get('registration', {})
        
        # Verify fields
        if reg.get('venue_id') is None:
            print(f"  ✓ venue_id is null (as expected)")
        else:
            print(f"  ✗ venue_id should be null, got: {reg.get('venue_id')}")
            test_passed = False
        
        if reg.get('wizard_step') == 1:
            print(f"  ✓ wizard_step is 1 (as expected)")
        else:
            print(f"  ✗ wizard_step should be 1, got: {reg.get('wizard_step')}")
            test_passed = False
        
        return print_result(test_passed, "Initialize without venue completed")
    
    except Exception as e:
        print(f"  ✗ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return print_result(False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("TESTING: POST /api/admin/organizations/:id/initialize-registration")
    print("="*80)
    
    # Get DB connection for cleanup
    db = get_db()
    
    # Clean up any existing test data
    cleanup_test_data(db)
    
    # Run tests
    results = []
    results.append(test_1_permission_check())
    results.append(test_2_non_existent_org())
    results.append(test_3_happy_path())
    results.append(test_4_idempotency())
    results.append(test_5_initialize_without_venue())
    
    # Clean up test data
    cleanup_test_data(db)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total} ({100*passed//total}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == '__main__':
    sys.exit(main())
