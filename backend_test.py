#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "aracom_admin"
}

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    return success

def test_validation_requests_workflow():
    """Test the complete validation requests workflow"""
    print("=" * 80)
    print("TESTING VALIDATION REQUESTS WORKFLOW")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Step 1: Seed the database
    print("\n1. SEEDING DATABASE")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/seed", 
                               json={"force": True}, 
                               headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("seeded") == True
            passed_tests += log_test("POST /api/seed force=true", success, 
                                   f"Seeded: {data.get('seeded')}, Associations: {data.get('associations')}, Stands: {data.get('stands_planned')}")
        else:
            log_test("POST /api/seed force=true", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/seed force=true", False, f"Exception: {str(e)}")
    
    # Step 2: Find a suitable registration (with stand, not confirmed, no validation_request_id)
    print("\n2. FINDING SUITABLE REGISTRATION")
    total_tests += 1
    reg_id = None
    venue_id = None
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=HEADERS)
        if response.status_code == 200:
            registrations = response.json()
            # Find one with stand_code but no validation_request_id and not confirmed
            for reg in registrations:
                if (reg.get('stand_code') and 
                    not reg.get('validation_request_id') and 
                    reg.get('status') in ['prospect', 'a_relancer', 'a_confirmer']):
                    reg_id = reg['id']
                    venue_id = reg.get('venue_id')
                    org_name = reg.get('organization_name', 'Unknown')
                    stand_code = reg.get('stand_code')
                    status = reg.get('status')
                    break
                
            if reg_id:
                passed_tests += log_test("Find suitable registration", True, 
                                       f"Found reg_id: {reg_id}, org: {org_name}, stand: {stand_code}, status: {status}")
            else:
                log_test("Find suitable registration", False, "No suitable registration found")
        else:
            log_test("Find suitable registration", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Find suitable registration", False, f"Exception: {str(e)}")
    
    if not reg_id:
        print("❌ Cannot continue without a valid registration ID")
        return passed_tests, total_tests
    
    # Step 3: Create an animation slot (required for validation)
    print("\n3. CREATING ANIMATION SLOT")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/animation-slots",
                               json={
                                   "registration_id": reg_id,
                                   "venue_id": venue_id,
                                   "day_label": "vendredi",
                                   "start_time": "10:00",
                                   "end_time": "11:00",
                                   "title": "Animation test validation",
                                   "type": "stand"
                               },
                               headers=HEADERS)
        if response.status_code in [200, 201]:
            data = response.json()
            success = data.get("id") is not None  # Animation slot created successfully
            if success:
                passed_tests += 1
            log_test("POST animation-slot", success, f"Response: {data}")
        else:
            log_test("POST animation-slot", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST animation-slot", False, f"Exception: {str(e)}")
    
    # Step 4: Test negative cases first - request validation without venue_id
    print("\n4. NEGATIVE TEST - REQUEST VALIDATION WITHOUT VENUE")
    total_tests += 1
    try:
        # Temporarily remove venue_id to test the error
        requests.put(f"{BASE_URL}/api/registrations/{reg_id}", 
                    json={"venue_id": None}, headers=HEADERS)
        
        response = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/request-validation",
                               json={"preferred_payment": "cheque", "rdv_proposal": "matin"},
                               headers=HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'site' in error_msg.lower() or 'venue' in error_msg.lower()
            passed_tests += log_test("Request validation without venue → 400", success, f"Error: {error_msg}")
        else:
            log_test("Request validation without venue → 400", False, f"Expected 400, got {response.status_code}")
        
        # Restore venue_id
        requests.put(f"{BASE_URL}/api/registrations/{reg_id}", 
                    json={"venue_id": venue_id}, headers=HEADERS)
    except Exception as e:
        log_test("Request validation without venue → 400", False, f"Exception: {str(e)}")
    
    # Step 5: Test request-validation (positive test)
    print("\n5. REQUEST VALIDATION (POSITIVE)")
    total_tests += 1
    validation_request_id = None
    try:
        response = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/request-validation",
                               json={
                                   "preferred_payment": "cheque",
                                   "rdv_proposal": "matin",
                                   "notes": "Test validation request"
                               },
                               headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("ok") == True and data.get("validation_request_id")
            if success:
                validation_request_id = data.get("validation_request_id")
            passed_tests += log_test("POST request-validation", success, f"Response: {data}")
        else:
            log_test("POST request-validation", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST request-validation", False, f"Exception: {str(e)}")
    
    if not validation_request_id:
        print("❌ Cannot continue without validation_request_id")
        return passed_tests, total_tests
    
    # Step 6: Verify registration has validation_request_id
    print("\n6. VERIFY REGISTRATION UPDATED")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("validation_request_id") == validation_request_id
            passed_tests += log_test("Registration has validation_request_id", success, 
                                   f"Expected: {validation_request_id}, Got: {data.get('validation_request_id')}")
        else:
            log_test("Registration has validation_request_id", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Registration has validation_request_id", False, f"Exception: {str(e)}")
    
    # Step 7: Test GET validation-requests
    print("\n7. GET VALIDATION REQUESTS")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            found_request = None
            for req in data:
                if req.get('id') == validation_request_id:
                    found_request = req
                    break
            
            success = found_request is not None
            if success:
                # Check enrichment
                has_org = found_request.get('organization') is not None
                has_venue = found_request.get('venue') is not None
                status_correct = found_request.get('status') == 'en_attente'
                no_mongodb_id = found_request.get('_id') is None
                success = has_org and has_venue and status_correct and no_mongodb_id
                
            passed_tests += log_test("GET validation-requests", success, 
                                   f"Found request with enriched data: org={has_org}, venue={has_venue}, status={found_request.get('status') if found_request else 'N/A'}, no _id={no_mongodb_id}")
        else:
            log_test("GET validation-requests", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET validation-requests", False, f"Exception: {str(e)}")
    
    # Step 8: Test GET validation-requests with status filter
    print("\n8. GET VALIDATION REQUESTS WITH STATUS FILTER")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests?status=en_attente", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            found_request = any(req.get('id') == validation_request_id for req in data)
            all_en_attente = all(req.get('status') == 'en_attente' for req in data)
            success = found_request and all_en_attente
            passed_tests += log_test("GET validation-requests?status=en_attente", success, 
                                   f"Found our request: {found_request}, All en_attente: {all_en_attente}")
        else:
            log_test("GET validation-requests?status=en_attente", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET validation-requests?status=en_attente", False, f"Exception: {str(e)}")
    
    # Step 9: Test GET alerts (should include validation_pending)
    print("\n9. GET ALERTS (VALIDATION COUNTS)")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/alerts", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            has_validation_pending = 'validation_pending' in data
            has_validation_rdv = 'validation_rdv' in data
            validation_pending_count = data.get('validation_pending', 0)
            success = has_validation_pending and has_validation_rdv and validation_pending_count >= 1
            passed_tests += log_test("GET alerts includes validation counts", success, 
                                   f"validation_pending: {validation_pending_count}, validation_rdv: {data.get('validation_rdv', 0)}")
        else:
            log_test("GET alerts includes validation counts", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET alerts includes validation counts", False, f"Exception: {str(e)}")
    
    # Step 10: Test set-rdv negative case
    print("\n10. NEGATIVE TEST - SET RDV WITHOUT DATE")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/validation-requests/{validation_request_id}/set-rdv",
                               json={"rdv_location": "Test without date"},
                               headers=HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'rdv_date' in error_msg
            passed_tests += log_test("Set RDV without rdv_date → 400", success, f"Error: {error_msg}")
        else:
            log_test("Set RDV without rdv_date → 400", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Set RDV without rdv_date → 400", False, f"Exception: {str(e)}")
    
    # Step 11: Test set-rdv (positive)
    print("\n11. SET RDV")
    total_tests += 1
    rdv_date = "2026-08-01T10:00:00.000Z"
    try:
        response = requests.post(f"{BASE_URL}/api/validation-requests/{validation_request_id}/set-rdv",
                               json={
                                   "rdv_date": rdv_date,
                                   "rdv_location": "Bureau ARACOM",
                                   "rdv_notes": "Parking au sous-sol"
                               },
                               headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("ok") == True
            passed_tests += log_test("POST set-rdv", success, f"Response: {data}")
        else:
            log_test("POST set-rdv", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST set-rdv", False, f"Exception: {str(e)}")
    
    # Step 12: Verify status changed to rdv_fixe
    print("\n12. VERIFY RDV STATUS")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests?status=rdv_fixe", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            found_request = any(req.get('id') == validation_request_id for req in data)
            success = found_request
            passed_tests += log_test("Validation request status = rdv_fixe", success, 
                                   f"Found in rdv_fixe list: {found_request}")
        else:
            log_test("Validation request status = rdv_fixe", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Validation request status = rdv_fixe", False, f"Exception: {str(e)}")
    
    # Step 13: Test alerts validation_rdv count
    print("\n13. VERIFY ALERTS RDV COUNT")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/alerts", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            validation_rdv_count = data.get('validation_rdv', 0)
            success = validation_rdv_count >= 1
            passed_tests += log_test("Alerts validation_rdv >= 1", success, 
                                   f"validation_rdv count: {validation_rdv_count}")
        else:
            log_test("Alerts validation_rdv >= 1", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Alerts validation_rdv >= 1", False, f"Exception: {str(e)}")
    
    # Step 14: Test lock (verrouillage)
    print("\n14. LOCK VALIDATION REQUEST")
    total_tests += 1
    receipt_number = None
    receipt_document_id = None
    try:
        response = requests.post(f"{BASE_URL}/api/validation-requests/{validation_request_id}/lock",
                               json={
                                   "payment_mode": "cheque",
                                   "amount_xpf": 20000
                               },
                               headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("ok") == True and 
                      data.get("receipt_number", "").startswith("CAUT-2026-") and
                      data.get("receipt_document_id"))
            if success:
                receipt_number = data.get("receipt_number")
                receipt_document_id = data.get("receipt_document_id")
            if success:
                passed_tests += 1
            log_test("POST lock", success, f"Response: {data}")
        else:
            log_test("POST lock", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST lock", False, f"Exception: {str(e)}")
    
    # Step 15: Verify registration status changed to confirme
    print("\n15. VERIFY REGISTRATION CONFIRMED")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            status_confirme = data.get("status") == "confirme"
            is_locked = data.get("is_locked") == True
            is_deposit_received = data.get("is_deposit_received") == True
            has_confirmed_at = data.get("confirmed_at") is not None
            
            success = status_confirme and is_locked and is_deposit_received and has_confirmed_at
            passed_tests += log_test("Registration confirmed and locked", success, 
                                   f"status={data.get('status')}, is_locked={is_locked}, is_deposit_received={is_deposit_received}")
        else:
            log_test("Registration confirmed and locked", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Registration confirmed and locked", False, f"Exception: {str(e)}")
    
    # Step 16: Verify deposit transaction status
    print("\n16. VERIFY DEPOSIT TRANSACTION")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            deposit = data.get("deposit", {})
            deposit_status = deposit.get("status")
            success = deposit_status == "recue"
            passed_tests += log_test("Deposit status = recue", success, 
                                   f"deposit.status: {deposit_status}")
        else:
            log_test("Deposit status = recue", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Deposit status = recue", False, f"Exception: {str(e)}")
    
    # Step 17: Verify animation slots are locked
    print("\n17. VERIFY ANIMATION SLOTS LOCKED")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/animation-slots?venue_id={venue_id}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            reg_slots = [slot for slot in data if slot.get('registration_id') == reg_id]
            all_locked = all(slot.get('is_locked') == True for slot in reg_slots)
            success = len(reg_slots) > 0 and all_locked
            passed_tests += log_test("Animation slots locked", success, 
                                   f"Found {len(reg_slots)} slots, all locked: {all_locked}")
        else:
            log_test("Animation slots locked", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Animation slots locked", False, f"Exception: {str(e)}")
    
    # Step 18: Verify receipt document created
    print("\n18. VERIFY RECEIPT DOCUMENT")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/documents?registration_id={reg_id}", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            receipt_docs = [doc for doc in data if doc.get('document_type') == 'recu_caution']
            found_receipt = any(doc.get('receipt_number') == receipt_number for doc in receipt_docs)
            has_valid_status = any(doc.get('status') == 'valide' for doc in receipt_docs)
            success = len(receipt_docs) > 0 and found_receipt and has_valid_status
            passed_tests += log_test("Receipt document created", success, 
                                   f"Found {len(receipt_docs)} receipt docs, matching receipt_number: {found_receipt}, valid status: {has_valid_status}")
        else:
            log_test("Receipt document created", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Receipt document created", False, f"Exception: {str(e)}")
    
    # Step 19: Test cancel on locked request (should fail)
    print("\n19. TEST CANCEL LOCKED REQUEST (NEGATIVE)")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/validation-requests/{validation_request_id}/cancel",
                               json={"reason": "Test cancel locked"},
                               headers=HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'verrouillée' in error_msg or 'locked' in error_msg.lower()
            passed_tests += log_test("Cancel locked request → 400", success, f"Error: {error_msg}")
        else:
            log_test("Cancel locked request → 400", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Cancel locked request → 400", False, f"Exception: {str(e)}")
    
    # Step 20: Test request validation on already confirmed registration (should fail)
    print("\n20. TEST REQUEST VALIDATION ON CONFIRMED REG (NEGATIVE)")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/request-validation",
                               json={"preferred_payment": "especes", "rdv_proposal": "apres-midi"},
                               headers=HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'confirmée' in error_msg or 'confirmed' in error_msg.lower()
            passed_tests += log_test("Request validation on confirmed reg → 400", success, f"Error: {error_msg}")
        else:
            log_test("Request validation on confirmed reg → 400", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Request validation on confirmed reg → 400", False, f"Exception: {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print(f"VALIDATION REQUESTS WORKFLOW TEST SUMMARY")
    print("=" * 80)
    print(f"PASSED: {passed_tests}/{total_tests} tests")
    print(f"SUCCESS RATE: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED - Validation Requests Workflow is working correctly!")
    else:
        print(f"⚠️  {total_tests - passed_tests} tests failed - See details above")
    
    return passed_tests, total_tests

def test_non_regression():
    """Test that existing critical endpoints still work"""
    print("\n" + "=" * 80)
    print("NON-REGRESSION TESTS")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test dashboard KPIs
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = 'total' in data
            passed_tests += log_test("GET /api/dashboard/kpis", success, f"Total: {data.get('total')}")
        else:
            log_test("GET /api/dashboard/kpis", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/kpis", False, f"Exception: {str(e)}")
    
    # Test SMTP test
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/test-smtp", json={}, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = 'ok' in data and 'configured' in data
            passed_tests += log_test("POST /api/mailing/test-smtp", success, f"OK: {data.get('ok')}, Configured: {data.get('configured')}")
        else:
            log_test("POST /api/mailing/test-smtp", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/mailing/test-smtp", False, f"Exception: {str(e)}")
    
    # Test release-stand (existing workflow)
    total_tests += 1
    try:
        # Get a registration with a stand that's not confirmed
        regs_response = requests.get(f"{BASE_URL}/api/registrations?status=a_relancer", headers=HEADERS)
        
        if regs_response.status_code == 200:
            registrations = regs_response.json()
            
            test_reg = None
            # Find a registration with stand but not confirmed
            for reg in registrations:
                if reg.get('stand_code') and reg.get('status') != 'confirme':
                    test_reg = reg
                    break
            
            if test_reg:
                response = requests.post(f"{BASE_URL}/api/registrations/{test_reg['id']}/release-stand",
                                       headers=HEADERS)
                if response.status_code == 200:
                    data = response.json()
                    success = data.get("ok") == True
                    passed_tests += log_test("POST release-stand (non-regression)", success, f"Response: {data}")
                else:
                    log_test("POST release-stand (non-regression)", False, f"Status: {response.status_code}")
            else:
                log_test("POST release-stand (non-regression)", False, "No suitable registration found")
        else:
            log_test("POST release-stand (non-regression)", False, "Failed to get registrations")
    except Exception as e:
        log_test("POST release-stand (non-regression)", False, f"Exception: {str(e)}")
    
    print(f"\nNON-REGRESSION SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

if __name__ == "__main__":
    print("🧪 BACKEND TESTING - VALIDATION REQUESTS WORKFLOW")
    print(f"Base URL: {BASE_URL}")
    print(f"Headers: {HEADERS}")
    
    # Run validation requests workflow tests
    workflow_passed, workflow_total = test_validation_requests_workflow()
    
    # Run non-regression tests
    regression_passed, regression_total = test_non_regression()
    
    # Final summary
    total_passed = workflow_passed + regression_passed
    total_tests = workflow_total + regression_total
    
    print("\n" + "=" * 80)
    print("FINAL TEST SUMMARY")
    print("=" * 80)
    print(f"Validation Workflow: {workflow_passed}/{workflow_total} passed")
    print(f"Non-Regression: {regression_passed}/{regression_total} passed")
    print(f"OVERALL: {total_passed}/{total_tests} tests passed ({(total_passed/total_tests)*100:.1f}%)")
    
    if total_passed == total_tests:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"❌ {total_tests - total_passed} tests failed")
        sys.exit(1)