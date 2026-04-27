#!/usr/bin/env python3
"""
Backend testing script for Forum de la Rentrée 2026 - New Workflow Endpoints (Comprehensive)
Tests the new workflow endpoints for stand pre-reservation and caution receipt management.
This version handles the real-world scenario where all stands are initially assigned.
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

def test_profile_endpoint():
    """Test POST /api/registrations/:id/profile"""
    print("\n=== Testing POST /api/registrations/:id/profile ===")
    
    try:
        # Get a test registration
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

def test_workflow_endpoints():
    """Test the complete workflow: release -> pre-reserve -> confirm"""
    print("\n=== Testing Complete Workflow: Release -> Pre-reserve -> Confirm ===")
    
    try:
        # Get two non-confirmed registrations
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS_ADMIN, timeout=10)
        if reg_response.status_code != 200:
            log_test("Get registrations for workflow test", False, "Could not fetch registrations")
            return
            
        registrations = reg_response.json()
        test_regs = []
        
        # Check first few registrations individually to get full data
        for i, reg in enumerate(registrations[:10]):  # Check first 10
            detail_response = requests.get(f"{BASE_URL}/registrations/{reg['id']}", headers=HEADERS_ADMIN, timeout=10)
            if detail_response.status_code == 200:
                full_reg = detail_response.json()
                reg_data = full_reg.get('registration', {})
                if (reg_data.get('status') not in ['confirme'] and 
                    reg_data.get('stand_code') is not None):
                    test_regs.append(full_reg)
                    if len(test_regs) >= 2:
                        break
        
        if len(test_regs) < 2:
            log_test("Get registrations for workflow test", False, "Not enough non-confirmed registrations with stands")
            return
            
        reg_a = test_regs[0]
        reg_b = test_regs[1]
        
        reg_a_id = reg_a.get('registration', {}).get('id') or reg_a.get('id')
        reg_b_id = reg_b.get('registration', {}).get('id') or reg_b.get('id')
        
        # Step 1: Release stand from reg_a
        print("\n--- Step 1: Release Stand ---")
        release_response = requests.post(f"{BASE_URL}/registrations/{reg_a_id}/release-stand",
                                       headers=HEADERS_EXPOSANT, json={}, timeout=10)
        
        if release_response.status_code == 200:
            data = release_response.json()
            success = data.get("ok") is True
            log_test("Release stand from reg_a", success, f"Response: {data}")
            
            # Verify the stand was released
            if success:
                verify_response = requests.get(f"{BASE_URL}/registrations/{reg_a_id}", 
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
                    
                    if all_checks_passed:
                        # Step 2: Get the released stand and pre-reserve it with reg_b
                        print("\n--- Step 2: Pre-reserve Released Stand ---")
                        
                        # Find a free stand (the one we just released)
                        # Get the venue from the released registration
                        released_venue_id = reg_a.get('registration', {}).get('venue_id')
                        if released_venue_id:
                            stands_response = requests.get(f"{BASE_URL}/venues/{released_venue_id}/stands", headers=HEADERS_ADMIN, timeout=10)
                        if released_venue_id:
                            stands_response = requests.get(f"{BASE_URL}/venues/{released_venue_id}/stands", headers=HEADERS_ADMIN, timeout=10)
                        else:
                            log_test("Get released venue ID", False, "Could not determine released venue")
                            return
                        
                        if stands_response.status_code == 200:
                            stands = stands_response.json()
                            free_stand = None
                            for stand in stands:
                                if not stand.get('organization'):  # Stand is free
                                    free_stand = stand
                                    break
                            
                            if free_stand:
                                # Pre-reserve the free stand with reg_b
                                payload = {"stand_id": free_stand['id']}
                                prereserve_response = requests.post(f"{BASE_URL}/registrations/{reg_b_id}/pre-reserve-stand",
                                                                  headers=HEADERS_EXPOSANT, json=payload, timeout=10)
                                
                                if prereserve_response.status_code == 200:
                                    data = prereserve_response.json()
                                    success = (
                                        data.get("ok") is True and
                                        "stand_code" in data
                                    )
                                    log_test("Pre-reserve free stand with reg_b", success, 
                                            f"Stand code: {data.get('stand_code')}, Status: {data.get('status')}")
                                    
                                    # Verify pre-reservation
                                    if success:
                                        verify_response = requests.get(f"{BASE_URL}/registrations/{reg_b_id}", 
                                                                     headers=HEADERS_ADMIN, timeout=10)
                                        if verify_response.status_code == 200:
                                            updated_reg = verify_response.json()
                                            reg_data = updated_reg.get('registration', {})
                                            checks = [
                                                reg_data.get('stand_code') == free_stand['stand_code'],
                                                reg_data.get('venue_id') == free_stand['venue_id'],
                                                reg_data.get('status') in ['a_confirmer', 'confirme'],
                                                reg_data.get('is_pre_reserved') is True
                                            ]
                                            
                                            all_checks_passed = all(checks)
                                            log_test("Pre-reserve verification", all_checks_passed,
                                                    f"Stand: {reg_data.get('stand_code')}, Venue: {reg_data.get('venue_id')}, "
                                                    f"Status: {reg_data.get('status')}, Pre-reserved: {reg_data.get('is_pre_reserved')}")
                                            
                                            if all_checks_passed:
                                                # Step 3: Try to pre-reserve the same stand with reg_a (should fail with 409)
                                                print("\n--- Step 3: Test Conflict (409) ---")
                                                conflict_payload = {"stand_id": free_stand['id']}
                                                conflict_response = requests.post(f"{BASE_URL}/registrations/{reg_a_id}/pre-reserve-stand",
                                                                                headers=HEADERS_EXPOSANT, json=conflict_payload, timeout=10)
                                                
                                                success_409 = conflict_response.status_code == 409
                                                log_test("Pre-reserve already taken stand (409 expected)", success_409,
                                                        f"Status: {conflict_response.status_code}")
                                                
                                                # Step 4: Confirm the pre-reserved stand
                                                print("\n--- Step 4: Confirm Stand ---")
                                                confirm_response = requests.post(f"{BASE_URL}/registrations/{reg_b_id}/confirm-stand",
                                                                               headers=HEADERS_ADMIN, json={}, timeout=10)
                                                
                                                if confirm_response.status_code == 200:
                                                    data = confirm_response.json()
                                                    success = data.get("ok") is True
                                                    log_test("Confirm pre-reserved stand", success, f"Response: {data}")
                                                    
                                                    # Verify confirmation
                                                    if success:
                                                        verify_response = requests.get(f"{BASE_URL}/registrations/{reg_b_id}", 
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
                                                            
                                                            # Check deposit status
                                                            deposit = updated_reg.get('deposit')
                                                            if deposit:
                                                                deposit_ok = deposit.get('status') == 'recue'
                                                                log_test("Deposit status updated to 'recue'", deposit_ok,
                                                                        f"Deposit status: {deposit.get('status')}")
                                                else:
                                                    log_test("Confirm pre-reserved stand", False,
                                                            f"Status: {confirm_response.status_code}")
                                else:
                                    log_test("Pre-reserve free stand with reg_b", False,
                                            f"Status: {prereserve_response.status_code}")
                            else:
                                log_test("Find free stand after release", False, "No free stand found")
                        else:
                            log_test("Get stands after release", False, "Could not fetch stands")
        else:
            log_test("Release stand from reg_a", False,
                    f"Status: {release_response.status_code}")
        
        # Test error cases
        print("\n--- Error Cases ---")
        
        # Test with non-existent stand_id
        fake_payload = {"stand_id": "fake-stand-id"}
        fake_response = requests.post(f"{BASE_URL}/registrations/{reg_a_id}/pre-reserve-stand",
                                    headers=HEADERS_EXPOSANT, json=fake_payload, timeout=10)
        
        success_404 = fake_response.status_code == 404
        log_test("Pre-reserve non-existent stand (404 expected)", success_404,
                f"Status: {fake_response.status_code}")
        
        # Test without stand_id
        empty_payload = {}
        empty_response = requests.post(f"{BASE_URL}/registrations/{reg_a_id}/pre-reserve-stand",
                                     headers=HEADERS_EXPOSANT, json=empty_payload, timeout=10)
        
        success_400 = empty_response.status_code == 400
        log_test("Pre-reserve without stand_id (400 expected)", success_400,
                f"Status: {empty_response.status_code}")
        
        # Test release confirmed stand (should fail)
        confirmed_regs = []
        for reg in registrations:
            reg_data = reg.get('registration', {})
            if reg_data.get('status') == 'confirme':
                confirmed_regs.append(reg)
        
        if confirmed_regs:
            confirmed_reg = confirmed_regs[0]
            confirmed_response = requests.post(f"{BASE_URL}/registrations/{confirmed_reg['id']}/release-stand",
                                             headers=HEADERS_EXPOSANT, json={}, timeout=10)
            
            success_400 = (confirmed_response.status_code == 400 and 
                          "Impossible de libérer un stand confirmé" in confirmed_response.text)
            log_test("Release confirmed stand (400 expected)", success_400,
                    f"Status: {confirmed_response.status_code}")
        
    except Exception as e:
        log_test("Workflow endpoints test", False, f"Exception: {str(e)}")

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
    test_workflow_endpoints()  # This tests release, pre-reserve, and confirm in sequence
    test_generate_caution_receipt_endpoint()
    test_non_regression()
    
    print("\n" + "=" * 70)
    print("🏁 WORKFLOW TESTS COMPLETED")
    print(f"Test finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()