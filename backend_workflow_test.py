#!/usr/bin/env python3
"""
Backend testing script for Forum de la Rentrée 2026 - New Workflow Endpoints
Tests the new workflow endpoints for stand pre-reservation and caution receipt management.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
HEADERS_ADMIN = {
    "Content-Type": "application/json",
    "x-user-role": "admin"
}
HEADERS_EXPOSANT = {
    "Content-Type": "application/json", 
    "x-user-role": "exposant"
}

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    return success

def setup_clean_state():
    """Setup clean state with seed data"""
    print("\n=== Setting up clean state with seed data ===")
    try:
        payload = {"force": True}
        response = requests.post(f"{BASE_URL}/seed", 
                               headers=HEADERS_ADMIN, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("seeded") is True and
                data.get("associations") == 66 and
                data.get("stands_planned") == 67
            )
            log_test("Seed with force=true", success, 
                    f"Seeded: {data.get('seeded')}, Associations: {data.get('associations')}, Stands: {data.get('stands_planned')}")
            return success
        else:
            log_test("Seed with force=true", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("Seed with force=true", False, f"Exception: {str(e)}")
        return False

def get_test_data():
    """Get test data: registrations and free stands"""
    try:
        # Get registrations
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            return None, None, None
            
        registrations = reg_response.json()
        if len(registrations) < 2:
            return None, None, None
            
        # Get a registration that is not 'confirme'
        test_reg_a = None
        test_reg_b = None
        for reg in registrations:
            if reg.get('status') != 'confirme':
                if test_reg_a is None:
                    test_reg_a = reg
                elif test_reg_b is None:
                    test_reg_b = reg
                    break
        
        # Get free stands from venue-faaa
        stands_response = requests.get(f"{BASE_URL}/venues/venue-faaa/stands", headers=HEADERS_ADMIN, timeout=10)
        if stands_response.status_code != 200:
            return test_reg_a, test_reg_b, None
            
        stands = stands_response.json()
        free_stand = None
        for stand in stands:
            if not stand.get('organization'):  # Stand is free
                free_stand = stand
                break
                
        return test_reg_a, test_reg_b, free_stand
        
    except Exception as e:
        print(f"Error getting test data: {str(e)}")
        return None, None, None

def test_profile_endpoint():
    """Test POST /api/registrations/:id/profile"""
    print("\n=== Testing POST /api/registrations/:id/profile ===")
    
    # Get a test registration
    try:
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registration for profile test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        if not registrations:
            log_test("Get registration for profile test", False, "No registrations found")
            return
            
        test_reg = registrations[0]
        reg_id = test_reg['id']
        
        # Test 1: Update profile with valid data
        payload = {
            "name": "Mon Asso TEST",
            "discipline": "Sport", 
            "contact_name": "John Doe",
            "main_phone": "87 12 34 56",
            "description": "Description test",
            "planned_arrival_time": "08:00",  # Should be forced to 09:00
            "planned_departure_time": "19:00"  # Should be forced to 17:00
        }
        
        response = requests.post(f"{BASE_URL}/registrations/{reg_id}/profile",
                               headers=HEADERS_EXPOSANT, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = data.get("ok") is True
            log_test("Profile update with valid data", success, f"Response: {data}")
            
            # Verify the changes were applied
            if success:
                verify_response = requests.get(f"{BASE_URL}/registrations/{reg_id}", 
                                             headers=HEADERS_ADMIN, timeout=10)
                if verify_response.status_code == 200:
                    updated_reg = verify_response.json()
                    org = updated_reg.get('organization', {})
                    reg_data = updated_reg.get('registration', {})
                    
                    checks = [
                        org.get('name') == "Mon Asso TEST",
                        org.get('discipline') == "Sport",
                        org.get('contact_name') == "John Doe", 
                        org.get('main_phone') == "87 12 34 56",
                        reg_data.get('planned_arrival_time') == "09:00",  # FORCED
                        reg_data.get('planned_departure_time') == "17:00"  # FORCED
                    ]
                    
                    all_checks_passed = all(checks)
                    log_test("Profile verification after update", all_checks_passed,
                            f"Name: {org.get('name')}, Discipline: {org.get('discipline')}, "
                            f"Contact: {org.get('contact_name')}, Phone: {org.get('main_phone')}, "
                            f"Arrival: {reg_data.get('planned_arrival_time')}, Departure: {reg_data.get('planned_departure_time')}")
                else:
                    log_test("Profile verification after update", False, "Could not fetch updated registration")
        else:
            log_test("Profile update with valid data", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
        
        # Test 2: Update with fake registration ID (should return 404)
        fake_payload = {"name": "Test"}
        fake_response = requests.post(f"{BASE_URL}/registrations/fake-uuid/profile",
                                    headers=HEADERS_EXPOSANT, json=fake_payload, timeout=10)
        
        success_404 = fake_response.status_code == 404
        log_test("Profile update with fake ID (404 expected)", success_404,
                f"Status: {fake_response.status_code}")
        
    except Exception as e:
        log_test("Profile endpoint test", False, f"Exception: {str(e)}")

def test_pre_reserve_stand_endpoint():
    """Test POST /api/registrations/:id/pre-reserve-stand"""
    print("\n=== Testing POST /api/registrations/:id/pre-reserve-stand ===")
    
    # Since all stands are assigned in seed data, we need to first release a stand
    # Get two registrations that are not confirmed
    try:
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registrations for pre-reserve test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        test_regs = []
        for reg in registrations:
            reg_data = reg.get('registration', {})
            if reg_data.get('status') != 'confirme':
                test_regs.append(reg)
        
        if len(test_regs) < 2:
            log_test("Get registrations for pre-reserve test", False, "Not enough non-confirmed registrations")
            return
            
        test_reg_a = test_regs[0]
        test_reg_b = test_regs[1]
        
        # Release the stand from test_reg_a to make it available
        reg_data_a = test_reg_a.get('registration', {})
        if reg_data_a.get('stand_code'):
            release_response = requests.post(f"{BASE_URL}/registrations/{test_reg_a['id']}/release-stand",
                                           headers=HEADERS_EXPOSANT, json={}, timeout=10)
            if release_response.status_code != 200:
                log_test("Release stand for testing", False, "Could not release stand for testing")
                return
        
        # Get the stand that was just released
        stands_response = requests.get(f"{BASE_URL}/venues/venue-faaa/stands", headers=HEADERS_ADMIN, timeout=10)
        if stands_response.status_code != 200:
            log_test("Get stands for pre-reserve test", False, "Could not fetch stands")
            return
            
        stands = stands_response.json()
        free_stand = None
        for stand in stands:
            if not stand.get('organization'):  # Stand is free
                free_stand = stand
                break
        
        if not free_stand:
            log_test("Find free stand for testing", False, "No free stand found")
            return
        
        # Test 1: Pre-reserve a free stand
        payload = {"stand_id": free_stand['id']}
        response = requests.post(f"{BASE_URL}/registrations/{test_reg_a['id']}/pre-reserve-stand",
                               headers=HEADERS_EXPOSANT, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is True and
                "stand_code" in data
            )
            log_test("Pre-reserve free stand", success, 
                    f"Stand code: {data.get('stand_code')}, Status: {data.get('status')}")
            
            # Verify registration was updated
            if success:
                verify_response = requests.get(f"{BASE_URL}/registrations/{test_reg_a['id']}", 
                                             headers=HEADERS_ADMIN, timeout=10)
                if verify_response.status_code == 200:
                    updated_reg = verify_response.json()
                    reg_data = updated_reg.get('registration', {})
                    checks = [
                        reg_data.get('stand_code') == free_stand['stand_code'],
                        reg_data.get('venue_id') == 'venue-faaa',
                        reg_data.get('status') in ['a_confirmer', 'confirme'],
                        reg_data.get('is_pre_reserved') is True
                    ]
                    
                    all_checks_passed = all(checks)
                    log_test("Pre-reserve verification", all_checks_passed,
                            f"Stand: {reg_data.get('stand_code')}, Venue: {reg_data.get('venue_id')}, "
                            f"Status: {reg_data.get('status')}, Pre-reserved: {reg_data.get('is_pre_reserved')}")
        else:
            log_test("Pre-reserve free stand", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
        
        # Test 2: Try to pre-reserve the same stand with another registration (should return 409)
        conflict_payload = {"stand_id": free_stand['id']}
        conflict_response = requests.post(f"{BASE_URL}/registrations/{test_reg_b['id']}/pre-reserve-stand",
                                        headers=HEADERS_EXPOSANT, json=conflict_payload, timeout=10)
        
        success_409 = conflict_response.status_code == 409
        log_test("Pre-reserve already taken stand (409 expected)", success_409,
                f"Status: {conflict_response.status_code}")
        
        # Test 3: Pre-reserve with non-existent stand_id (should return 404)
        fake_payload = {"stand_id": "fake-stand-id"}
        fake_response = requests.post(f"{BASE_URL}/registrations/{test_reg_b['id']}/pre-reserve-stand",
                                    headers=HEADERS_EXPOSANT, json=fake_payload, timeout=10)
        
        success_404 = fake_response.status_code == 404
        log_test("Pre-reserve non-existent stand (404 expected)", success_404,
                f"Status: {fake_response.status_code}")
        
        # Test 4: Pre-reserve without stand_id (should return 400)
        empty_payload = {}
        empty_response = requests.post(f"{BASE_URL}/registrations/{test_reg_b['id']}/pre-reserve-stand",
                                     headers=HEADERS_EXPOSANT, json=empty_payload, timeout=10)
        
        success_400 = empty_response.status_code == 400
        log_test("Pre-reserve without stand_id (400 expected)", success_400,
                f"Status: {empty_response.status_code}")
        
    except Exception as e:
        log_test("Pre-reserve stand endpoint test", False, f"Exception: {str(e)}")

def test_release_stand_endpoint():
    """Test POST /api/registrations/:id/release-stand"""
    print("\n=== Testing POST /api/registrations/:id/release-stand ===")
    
    try:
        # Get a registration that has a pre-reserved stand (from previous test)
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registration for release test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        pre_reserved_reg = None
        confirmed_reg = None
        
        for reg in registrations:
            reg_data = reg.get('registration', {})
            if reg_data.get('is_pre_reserved') and reg_data.get('status') != 'confirme':
                pre_reserved_reg = reg
            elif reg_data.get('status') == 'confirme' and reg_data.get('stand_code'):
                confirmed_reg = reg
        
        # Test 1: Release a pre-reserved stand
        if pre_reserved_reg:
            response = requests.post(f"{BASE_URL}/registrations/{pre_reserved_reg['id']}/release-stand",
                                   headers=HEADERS_EXPOSANT, json={}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("ok") is True
                log_test("Release pre-reserved stand", success, f"Response: {data}")
                
                # Verify the stand was released
                if success:
                    verify_response = requests.get(f"{BASE_URL}/registrations/{pre_reserved_reg['id']}", 
                                                 headers=HEADERS_ADMIN, timeout=10)
                    if verify_response.status_code == 200:
                        updated_reg = verify_response.json()
                        reg_data = updated_reg.get('registration', {})
                        checks = [
                            reg_data.get('stand_code') is None,
                            reg_data.get('is_pre_reserved') is False
                        ]
                        
                        all_checks_passed = all(checks)
                        log_test("Release verification", all_checks_passed,
                                f"Stand code: {reg_data.get('stand_code')}, Pre-reserved: {reg_data.get('is_pre_reserved')}")
            else:
                log_test("Release pre-reserved stand", False,
                        f"Status: {response.status_code}, Response: {response.text[:200]}")
        else:
            log_test("Release pre-reserved stand", False, "No pre-reserved registration found")
        
        # Test 2: Try to release a confirmed stand (should return 400)
        if confirmed_reg:
            confirmed_response = requests.post(f"{BASE_URL}/registrations/{confirmed_reg['id']}/release-stand",
                                             headers=HEADERS_EXPOSANT, json={}, timeout=10)
            
            success_400 = (confirmed_response.status_code == 400 and 
                          "Impossible de libérer un stand confirmé" in confirmed_response.text)
            log_test("Release confirmed stand (400 expected)", success_400,
                    f"Status: {confirmed_response.status_code}")
        else:
            log_test("Release confirmed stand (400 expected)", False, "No confirmed registration found")
        
    except Exception as e:
        log_test("Release stand endpoint test", False, f"Exception: {str(e)}")

def test_confirm_stand_endpoint():
    """Test POST /api/registrations/:id/confirm-stand"""
    print("\n=== Testing POST /api/registrations/:id/confirm-stand ===")
    
    try:
        # Get a registration that is not confirmed and has a deposit
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registration for confirm test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        test_reg = None
        
        for reg in registrations:
            reg_data = reg.get('registration', {})
            if reg_data.get('status') != 'confirme':
                test_reg = reg
                break
        
        if not test_reg:
            log_test("Get registration for confirm test", False, "No non-confirmed registration found")
            return
        
        # Test 1: Confirm a stand
        response = requests.post(f"{BASE_URL}/registrations/{test_reg['id']}/confirm-stand",
                               headers=HEADERS_ADMIN, json={}, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = data.get("ok") is True
            log_test("Confirm stand", success, f"Response: {data}")
            
            # Verify the confirmation
            if success:
                verify_response = requests.get(f"{BASE_URL}/registrations/{test_reg['id']}", 
                                             headers=HEADERS_ADMIN, timeout=10)
                if verify_response.status_code == 200:
                    updated_reg = verify_response.json()
                    reg_data = updated_reg.get('registration', {})
                    checks = [
                        reg_data.get('status') == 'confirme',
                        reg_data.get('is_pre_reserved') is False,
                        'confirmed_at' in reg_data
                    ]
                    
                    all_checks_passed = all(checks)
                    log_test("Confirm verification", all_checks_passed,
                            f"Status: {reg_data.get('status')}, Pre-reserved: {reg_data.get('is_pre_reserved')}, "
                            f"Confirmed at: {'present' if reg_data.get('confirmed_at') else 'missing'}")
                    
                    # Check if deposit status was updated
                    deposit = updated_reg.get('deposit')
                    if deposit:
                        deposit_ok = deposit.get('status') == 'recue'
                        log_test("Deposit status updated", deposit_ok,
                                f"Deposit status: {deposit.get('status')}")
        else:
            log_test("Confirm stand", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
        
        # Test 2: Confirm with non-existent registration ID (should return 404)
        fake_response = requests.post(f"{BASE_URL}/registrations/fake-uuid/confirm-stand",
                                    headers=HEADERS_ADMIN, json={}, timeout=10)
        
        success_404 = fake_response.status_code == 404
        log_test("Confirm non-existent registration (404 expected)", success_404,
                f"Status: {fake_response.status_code}")
        
    except Exception as e:
        log_test("Confirm stand endpoint test", False, f"Exception: {str(e)}")

def test_generate_caution_receipt_endpoint():
    """Test POST /api/registrations/:id/generate-caution-receipt"""
    print("\n=== Testing POST /api/registrations/:id/generate-caution-receipt ===")
    
    try:
        # Get any valid registration
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registration for receipt test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        if not registrations:
            log_test("Get registration for receipt test", False, "No registrations found")
            return
            
        test_reg = registrations[0]
        
        # Test 1: Generate caution receipt
        response = requests.post(f"{BASE_URL}/registrations/{test_reg['id']}/generate-caution-receipt",
                               headers=HEADERS_ADMIN, json={}, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is True and
                "receipt_number" in data and
                data.get("receipt_number", "").startswith("CAUT-2026-") and
                "document_id" in data
            )
            log_test("Generate caution receipt", success, 
                    f"Receipt number: {data.get('receipt_number')}, Document ID: {data.get('document_id')}")
            
            # Test 2: Verify the document was created (check documents collection directly)
            if success:
                # Check documents collection directly since there's a collection inconsistency
                docs_response = requests.get(f"{BASE_URL}/documents", headers=HEADERS_ADMIN, timeout=10)
                if docs_response.status_code == 200:
                    all_docs = docs_response.json()
                    receipt_doc = None
                    for doc in all_docs:
                        if (doc.get('document_type') == 'recu_caution' and 
                            doc.get('registration_id') == test_reg['id']):
                            receipt_doc = doc
                            break
                    
                    if receipt_doc:
                        checks = [
                            receipt_doc.get('status') == 'valide',
                            data.get('receipt_number') in receipt_doc.get('file_name', ''),
                            receipt_doc.get('file_size', 0) > 100
                        ]
                        
                        all_checks_passed = all(checks)
                        log_test("Receipt document verification", all_checks_passed,
                                f"Status: {receipt_doc.get('status')}, File name: {receipt_doc.get('file_name')}, "
                                f"File size: {receipt_doc.get('file_size')}")
                    else:
                        log_test("Receipt document verification", False, "Receipt document not found in documents collection")
                else:
                    log_test("Receipt document verification", False, "Could not fetch documents")
        else:
            log_test("Generate caution receipt", False,
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
        
        # Test 3: Generate receipt for non-existent registration (should return 404)
        fake_response = requests.post(f"{BASE_URL}/registrations/fake-uuid/generate-caution-receipt",
                                    headers=HEADERS_ADMIN, json={}, timeout=10)
        
        success_404 = fake_response.status_code == 404
        log_test("Generate receipt for fake ID (404 expected)", success_404,
                f"Status: {fake_response.status_code}")
        
    except Exception as e:
        log_test("Generate caution receipt endpoint test", False, f"Exception: {str(e)}")

def test_non_regression():
    """Test that existing endpoints still work (non-regression)"""
    print("\n=== Testing Non-Regression Endpoints ===")
    
    # Test mailing/generate-ai
    try:
        payload = {
            "mail_type": "relance_caution",
            "registration_ids": []
        }
        response = requests.post(f"{BASE_URL}/mailing/generate-ai", 
                               headers=HEADERS_ADMIN, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is True and
                "subject" in data and
                "body_html" in data
            )
            log_test("POST /api/mailing/generate-ai", success,
                    f"Subject present: {'subject' in data}, Body present: {'body_html' in data}")
        else:
            log_test("POST /api/mailing/generate-ai", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/mailing/generate-ai", False, f"Exception: {str(e)}")
    
    # Test dashboard/kpis
    try:
        response = requests.get(f"{BASE_URL}/dashboard/kpis", headers=HEADERS_ADMIN, timeout=10)
        if response.status_code == 200:
            data = response.json()
            success = (
                "total" in data and
                "by_status" in data
            )
            log_test("GET /api/dashboard/kpis", success,
                    f"Total: {data.get('total')}")
        else:
            log_test("GET /api/dashboard/kpis", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/kpis", False, f"Exception: {str(e)}")
    
    # Test satisfaction/stats
    try:
        response = requests.get(f"{BASE_URL}/satisfaction/stats", headers=HEADERS_ADMIN, timeout=10)
        if response.status_code == 200:
            data = response.json()
            success = (
                "total_responses" in data and
                "avg_overall" in data
            )
            log_test("GET /api/satisfaction/stats", success,
                    f"Total responses: {data.get('total_responses')}")
        else:
            log_test("GET /api/satisfaction/stats", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/satisfaction/stats", False, f"Exception: {str(e)}")
    
    # Test animation-slots
    try:
        response = requests.get(f"{BASE_URL}/animation-slots?venue_id=venue-faaa", 
                              headers=HEADERS_ADMIN, timeout=10)
        if response.status_code == 200:
            data = response.json()
            success = isinstance(data, list)
            log_test("GET /api/animation-slots?venue_id=venue-faaa", success,
                    f"Returned array: {isinstance(data, list)}, Length: {len(data) if isinstance(data, list) else 'N/A'}")
        else:
            log_test("GET /api/animation-slots?venue_id=venue-faaa", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/animation-slots?venue_id=venue-faaa", False, f"Exception: {str(e)}")

def main():
    """Run all workflow tests"""
    print("🧪 TESTING NEW WORKFLOW ENDPOINTS - Forum de la Rentrée 2026")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Setup clean state first
    if not setup_clean_state():
        print("❌ Failed to setup clean state. Aborting tests.")
        return
    
    # Run all workflow tests
    test_profile_endpoint()
    test_pre_reserve_stand_endpoint()
    test_release_stand_endpoint()
    test_confirm_stand_endpoint()
    test_generate_caution_receipt_endpoint()
    test_non_regression()
    
    print("\n" + "=" * 70)
    print("🏁 WORKFLOW TESTS COMPLETED")
    print(f"Test finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()