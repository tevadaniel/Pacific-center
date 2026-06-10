#!/usr/bin/env python3
"""
Backend test for SESSION 52g.9 — Waitlist request-validation flow
Tests the critical bug fix where exposants on waitlist can submit validation requests
without stand_code and animation slots.
"""

import requests
import json
import os
from datetime import datetime
from pymongo import MongoClient
import uuid

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'your_database_name')

# Admin credentials
ADMIN_HEADERS = {
    'x-user-role': 'aracom_admin',
    'x-user-id': 'u-admin',
    'Content-Type': 'application/json'
}

# MongoDB connection
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def cleanup_test_data():
    """Clean up test data from previous runs"""
    print("\n🧹 Cleaning up test data from previous runs...")
    
    # Find all test registrations
    test_regs = list(db.registrations.find({'id': {'$regex': '^reg-test-wl-'}}))
    test_reg_ids = [r['id'] for r in test_regs]
    
    if test_reg_ids:
        # Delete related data
        db.validation_requests.delete_many({'registration_id': {'$in': test_reg_ids}})
        db.animation_slots.delete_many({'registration_id': {'$in': test_reg_ids}})
        db.stand_assignments.delete_many({'registration_id': {'$in': test_reg_ids}})
        db.registrations.delete_many({'id': {'$in': test_reg_ids}})
        print(f"   Deleted {len(test_reg_ids)} test registrations and related data")
    
    # Delete test organizations
    test_orgs = list(db.organizations.find({'id': {'$regex': '^org-test-wl-'}}))
    test_org_ids = [o['id'] for o in test_orgs]
    
    if test_org_ids:
        db.organizations.delete_many({'id': {'$in': test_org_ids}})
        print(f"   Deleted {len(test_org_ids)} test organizations")
    
    print("✅ Cleanup complete\n")

def create_test_org(org_id, name):
    """Create a test organization"""
    org = {
        'id': org_id,
        'name': name,
        'main_email': f'{org_id}@test.com',
        'contact_name': 'Test Contact',
        'main_phone': '0689123456',
        'discipline': 'Test',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    db.organizations.insert_one(org)
    return org

def create_test_registration(reg_id, org_id, venue_id, **kwargs):
    """Create a test registration with custom fields"""
    reg = {
        'id': reg_id,
        'organization_id': org_id,
        'venue_id': venue_id,
        'edition_id': 'edition-2026',
        'status': kwargs.get('status', 'a_confirmer'),
        'is_waitlist': kwargs.get('is_waitlist', False),
        'stand_code': kwargs.get('stand_code', None),
        'attending_days': kwargs.get('attending_days', []),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    db.registrations.insert_one(reg)
    return reg

def create_animation_slot(reg_id, venue_id, day_label, start_time, end_time):
    """Create an animation slot"""
    slot = {
        'id': f'anim-{uuid.uuid4().hex[:8]}',
        'registration_id': reg_id,
        'venue_id': venue_id,
        'day_label': day_label,
        'start_time': start_time,
        'end_time': end_time,
        'title': f'Test Animation {day_label}',
        'location_type': 'sur_stand',
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    db.animation_slots.insert_one(slot)
    return slot

def test_1_waitlist_case():
    """
    TEST 1: Waitlist case
    Create a registration with is_waitlist=true, status='liste_attente', 
    valid venue_id, attending_days=['vendredi'], NO stand_code and NO animation_slots
    → should return 201 and create VR with status='waitlist'
    """
    print("\n" + "="*80)
    print("TEST 1: Waitlist case - Should accept submission without stand_code")
    print("="*80)
    
    try:
        # Get a valid venue_id
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        # Create test org and registration
        org_id = 'org-test-wl-waitlist-1'
        reg_id = 'reg-test-wl-waitlist-1'
        
        create_test_org(org_id, 'TEST_WL_WAITLIST_1')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=True,
            status='liste_attente',
            attending_days=['vendredi', 'samedi'],
            stand_code=None  # NO stand_code
        )
        # NO animation_slots created
        
        # Submit validation request
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={
                'rdv_proposal': 'matin',
                'notes': 'Test waitlist submission'
            }
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('validation_request_id'):
                # Verify VR was created with status='waitlist'
                vr = db.validation_requests.find_one({'id': data['validation_request_id']})
                if vr:
                    print(f"   ✅ Validation request created with ID: {vr['id']}")
                    print(f"   ✅ VR status: {vr['status']}")
                    print(f"   ✅ VR stand_code: {vr.get('stand_code')}")
                    
                    if vr['status'] == 'waitlist':
                        print("   ✅ TEST 1 PASSED: Waitlist VR created successfully")
                        return True
                    else:
                        print(f"   ❌ TEST 1 FAILED: Expected status='waitlist', got '{vr['status']}'")
                        return False
                else:
                    print("   ❌ TEST 1 FAILED: VR not found in database")
                    return False
            else:
                print(f"   ❌ TEST 1 FAILED: Invalid response structure")
                return False
        else:
            print(f"   ❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 1 FAILED with exception: {str(e)}")
        return False

def test_2_waitlist_without_attending_days():
    """
    TEST 2: Waitlist without attending_days
    Same reg but attending_days=[] → should return 400
    """
    print("\n" + "="*80)
    print("TEST 2: Waitlist without attending_days - Should return 400")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-no-days'
        reg_id = 'reg-test-wl-no-days'
        
        create_test_org(org_id, 'TEST_WL_NO_DAYS')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=True,
            status='liste_attente',
            attending_days=[],  # Empty attending_days
            stand_code=None
        )
        
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if 'jours de présence' in data.get('error', '').lower():
                print("   ✅ TEST 2 PASSED: Correctly rejected with 400 for missing attending_days")
                return True
            else:
                print(f"   ❌ TEST 2 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"   ❌ TEST 2 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 2 FAILED with exception: {str(e)}")
        return False

def test_3_normal_complete_case():
    """
    TEST 3: Normal complete case (NON-REGRESSION)
    Create reg with stand_code, attending_days and animation_slots (1 per day)
    → should create VR status='en_attente'
    """
    print("\n" + "="*80)
    print("TEST 3: Normal complete case - Should create VR with status='en_attente'")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-normal'
        reg_id = 'reg-test-wl-normal'
        
        create_test_org(org_id, 'TEST_WL_NORMAL')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=False,
            status='a_confirmer',
            attending_days=['vendredi', 'samedi'],
            stand_code='TEST-A01'  # Has stand_code
        )
        
        # Create animation slots (1 per day)
        create_animation_slot(reg_id, venue_id, 'vendredi', '10:00', '11:00')
        create_animation_slot(reg_id, venue_id, 'samedi', '14:00', '15:00')
        
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('validation_request_id'):
                vr = db.validation_requests.find_one({'id': data['validation_request_id']})
                if vr:
                    print(f"   ✅ Validation request created with ID: {vr['id']}")
                    print(f"   ✅ VR status: {vr['status']}")
                    
                    if vr['status'] == 'en_attente':
                        print("   ✅ TEST 3 PASSED: Normal VR created with status='en_attente'")
                        return True
                    else:
                        print(f"   ❌ TEST 3 FAILED: Expected status='en_attente', got '{vr['status']}'")
                        return False
                else:
                    print("   ❌ TEST 3 FAILED: VR not found in database")
                    return False
            else:
                print(f"   ❌ TEST 3 FAILED: Invalid response structure")
                return False
        else:
            print(f"   ❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 3 FAILED with exception: {str(e)}")
        return False

def test_4_normal_without_stand_code():
    """
    TEST 4: Normal without stand_code (NON-REGRESSION)
    Reg without is_waitlist, without stand_code → should return 400
    """
    print("\n" + "="*80)
    print("TEST 4: Normal without stand_code - Should return 400")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-no-stand'
        reg_id = 'reg-test-wl-no-stand'
        
        create_test_org(org_id, 'TEST_WL_NO_STAND')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=False,
            status='a_confirmer',
            attending_days=['vendredi'],
            stand_code=None  # NO stand_code
        )
        
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if 'stand' in data.get('error', '').lower():
                print("   ✅ TEST 4 PASSED: Correctly rejected with 400 for missing stand_code")
                return True
            else:
                print(f"   ❌ TEST 4 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"   ❌ TEST 4 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 4 FAILED with exception: {str(e)}")
        return False

def test_5_normal_without_animation():
    """
    TEST 5: Normal without animation (NON-REGRESSION)
    Reg with stand_code but without animation_slots → should return 400
    """
    print("\n" + "="*80)
    print("TEST 5: Normal without animation - Should return 400")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-no-anim'
        reg_id = 'reg-test-wl-no-anim'
        
        create_test_org(org_id, 'TEST_WL_NO_ANIM')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=False,
            status='a_confirmer',
            attending_days=['vendredi'],
            stand_code='TEST-A02'  # Has stand_code
        )
        # NO animation_slots created
        
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if 'animation' in data.get('error', '').lower():
                print("   ✅ TEST 5 PASSED: Correctly rejected with 400 for missing animation")
                return True
            else:
                print(f"   ❌ TEST 5 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"   ❌ TEST 5 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 5 FAILED with exception: {str(e)}")
        return False

def test_6_confirmed_case():
    """
    TEST 6: Confirmed case
    Reg with status='confirme' → should return 400
    """
    print("\n" + "="*80)
    print("TEST 6: Confirmed case - Should return 400")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-confirmed'
        reg_id = 'reg-test-wl-confirmed'
        
        create_test_org(org_id, 'TEST_WL_CONFIRMED')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=False,
            status='confirme',  # Already confirmed
            attending_days=['vendredi'],
            stand_code='TEST-A03'
        )
        
        response = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 400:
            data = response.json()
            if 'confirmée' in data.get('error', '').lower() or 'déjà' in data.get('error', '').lower():
                print("   ✅ TEST 6 PASSED: Correctly rejected with 400 for already confirmed")
                return True
            else:
                print(f"   ❌ TEST 6 FAILED: Wrong error message: {data.get('error')}")
                return False
        else:
            print(f"   ❌ TEST 6 FAILED: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 6 FAILED with exception: {str(e)}")
        return False

def test_7_cancel_previous_waitlist():
    """
    TEST 7: Cancel previous waitlist
    If a VR status='waitlist' exists → new submission should cancel it (status='annulee') then recreate
    """
    print("\n" + "="*80)
    print("TEST 7: Cancel previous waitlist VR - Should cancel old and create new")
    print("="*80)
    
    try:
        venues_resp = requests.get(f"{API_URL}/venues", headers=ADMIN_HEADERS)
        venues = venues_resp.json()
        venue_id = venues[0]['id'] if venues else 'venue-faaa'
        
        org_id = 'org-test-wl-cancel'
        reg_id = 'reg-test-wl-cancel'
        
        create_test_org(org_id, 'TEST_WL_CANCEL')
        create_test_registration(
            reg_id, org_id, venue_id,
            is_waitlist=True,
            status='liste_attente',
            attending_days=['vendredi', 'samedi'],
            stand_code=None
        )
        
        # First submission
        response1 = requests.post(
            f"{API_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json={'notes': 'First submission'}
        )
        
        print(f"   First submission - Status Code: {response1.status_code}")
        
        if response1.status_code == 200:
            data1 = response1.json()
            first_vr_id = data1.get('validation_request_id')
            print(f"   ✅ First VR created: {first_vr_id}")
            
            # Second submission
            response2 = requests.post(
                f"{API_URL}/registrations/{reg_id}/request-validation",
                headers=ADMIN_HEADERS,
                json={'notes': 'Second submission'}
            )
            
            print(f"   Second submission - Status Code: {response2.status_code}")
            
            if response2.status_code == 200:
                data2 = response2.json()
                second_vr_id = data2.get('validation_request_id')
                print(f"   ✅ Second VR created: {second_vr_id}")
                
                # Check first VR is cancelled
                first_vr = db.validation_requests.find_one({'id': first_vr_id})
                second_vr = db.validation_requests.find_one({'id': second_vr_id})
                
                if first_vr and second_vr:
                    print(f"   First VR status: {first_vr['status']}")
                    print(f"   Second VR status: {second_vr['status']}")
                    
                    if first_vr['status'] == 'annulee' and second_vr['status'] == 'waitlist':
                        print("   ✅ TEST 7 PASSED: Previous VR cancelled, new VR created")
                        return True
                    else:
                        print(f"   ❌ TEST 7 FAILED: Expected first='annulee' and second='waitlist'")
                        return False
                else:
                    print("   ❌ TEST 7 FAILED: VRs not found in database")
                    return False
            else:
                print(f"   ❌ TEST 7 FAILED: Second submission failed with {response2.status_code}")
                return False
        else:
            print(f"   ❌ TEST 7 FAILED: First submission failed with {response1.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ TEST 7 FAILED with exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION 52g.9 — WAITLIST REQUEST-VALIDATION BACKEND TESTS")
    print("="*80)
    print(f"API URL: {API_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("="*80)
    
    # Cleanup before tests
    cleanup_test_data()
    
    # Run all tests
    results = []
    results.append(("TEST 1: Waitlist case", test_1_waitlist_case()))
    results.append(("TEST 2: Waitlist without attending_days", test_2_waitlist_without_attending_days()))
    results.append(("TEST 3: Normal complete case", test_3_normal_complete_case()))
    results.append(("TEST 4: Normal without stand_code", test_4_normal_without_stand_code()))
    results.append(("TEST 5: Normal without animation", test_5_normal_without_animation()))
    results.append(("TEST 6: Confirmed case", test_6_confirmed_case()))
    results.append(("TEST 7: Cancel previous waitlist", test_7_cancel_previous_waitlist()))
    
    # Cleanup after tests
    cleanup_test_data()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
