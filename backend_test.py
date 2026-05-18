#!/usr/bin/env python3
"""
Backend regression tests for 3 extracted handler modules (Session 23+):
1. admin-delete-reset.js (10 endpoints)
2. caution-appointments.js (3 endpoints)
3. caution-receipts.js (3 endpoints)

Tests verify the dispatcher pattern correctly routes to extracted handlers.
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin"
}

# Exposant headers
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "exposant",
    "x-user-id": "u-exp-1"
}

def log(msg, level="INFO"):
    """Log with timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [{level}] {msg}")

def test_result(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    log(f"{status} - {name}")
    if details:
        print(f"    {details}")
    return passed

# ═══════════════════════════════════════════════════════════════════
# MODULE 1: admin-delete-reset.js (10 endpoints)
# ═══════════════════════════════════════════════════════════════════

def test_module1_smoke():
    """Module 1 - admin-delete-reset smoke tests (already tested, just confirm routing)"""
    log("=" * 70)
    log("MODULE 1: admin-delete-reset.js (10 endpoints) - SMOKE TESTS")
    log("=" * 70)
    
    results = []
    
    # Test 1: Archive non-existent organization → 404
    try:
        r = requests.post(f"{BASE_URL}/admin/organizations/non-existent/archive", 
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 404 and "introuvable" in r.text.lower()
        results.append(test_result("Archive non-existent org → 404", passed, 
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Archive non-existent org → 404", False, str(e)))
    
    # Test 2: Reset caution non-existent registration → 404
    try:
        r = requests.post(f"{BASE_URL}/admin/registrations/non-existent/reset-caution",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 404 and "introuvable" in r.text.lower()
        results.append(test_result("Reset caution non-existent reg → 404", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Reset caution non-existent reg → 404", False, str(e)))
    
    return all(results)

# ═══════════════════════════════════════════════════════════════════
# MODULE 2: caution-appointments.js (3 endpoints) - NEW EXTRACTION
# ═══════════════════════════════════════════════════════════════════

def test_module2_smoke():
    """Module 2 - caution-appointments smoke tests"""
    log("=" * 70)
    log("MODULE 2: caution-appointments.js (3 endpoints) - SMOKE TESTS")
    log("=" * 70)
    
    results = []
    
    # Test 1: POST /api/exposant/caution-appointment WITHOUT body → 400
    try:
        r = requests.post(f"{BASE_URL}/exposant/caution-appointment",
                         headers=EXPOSANT_HEADERS, json={}, timeout=10)
        passed = r.status_code == 400 and "requis" in r.text.lower()
        results.append(test_result("Exposant caution-appointment no body → 400", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:150]}"))
    except Exception as e:
        results.append(test_result("Exposant caution-appointment no body → 400", False, str(e)))
    
    # Test 2: POST /api/admin/caution-appointments/update WITHOUT body → 400
    try:
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/update",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 400 and "id requis" in r.text.lower()
        results.append(test_result("Admin update appointment no id → 400", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Admin update appointment no id → 400", False, str(e)))
    
    # Test 3: POST /api/admin/caution-appointments/update invalid status → 400
    try:
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/update",
                         headers=ADMIN_HEADERS, 
                         json={"id": "x", "status": "foo"}, timeout=10)
        passed = r.status_code == 400 and "invalide" in r.text.lower()
        results.append(test_result("Admin update appointment invalid status → 400", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Admin update appointment invalid status → 400", False, str(e)))
    
    # Test 4: POST /api/admin/caution-appointments/update non-existent → 404
    try:
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/update",
                         headers=ADMIN_HEADERS,
                         json={"id": "non-existent", "status": "confirme"}, timeout=10)
        passed = r.status_code == 404 and "introuvable" in r.text.lower()
        results.append(test_result("Admin update non-existent appointment → 404", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Admin update non-existent appointment → 404", False, str(e)))
    
    # Test 5: POST /api/admin/caution-appointments/create WITHOUT body → 400
    try:
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/create",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 400 and "requis" in r.text.lower()
        results.append(test_result("Admin create appointment no body → 400", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:150]}"))
    except Exception as e:
        results.append(test_result("Admin create appointment no body → 400", False, str(e)))
    
    # Test 6: Without admin role on /admin/caution-appointments/update → 403
    try:
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/update",
                         headers=EXPOSANT_HEADERS,
                         json={"id": "x", "status": "confirme"}, timeout=10)
        passed = r.status_code == 403 and "admin" in r.text.lower()
        results.append(test_result("Non-admin update appointment → 403", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Non-admin update appointment → 403", False, str(e)))
    
    return all(results)

# ═══════════════════════════════════════════════════════════════════
# MODULE 3: caution-receipts.js (3 endpoints) - NEW EXTRACTION
# ═══════════════════════════════════════════════════════════════════

def test_module3_smoke():
    """Module 3 - caution-receipts smoke tests"""
    log("=" * 70)
    log("MODULE 3: caution-receipts.js (3 endpoints) - SMOKE TESTS")
    log("=" * 70)
    
    results = []
    
    # Test 1: POST /api/admin/register-virement/non-existent with admin → 404
    try:
        r = requests.post(f"{BASE_URL}/admin/register-virement/non-existent",
                         headers=ADMIN_HEADERS,
                         json={"virement_reference": "TEST123", "virement_date": "2026-01-15"},
                         timeout=10)
        passed = r.status_code == 404 and "introuvable" in r.text.lower()
        results.append(test_result("Register virement non-existent → 404", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Register virement non-existent → 404", False, str(e)))
    
    # Test 2: POST /api/admin/register-virement/non-existent without admin → 403
    try:
        r = requests.post(f"{BASE_URL}/admin/register-virement/non-existent",
                         headers=EXPOSANT_HEADERS,
                         json={"virement_reference": "TEST123", "virement_date": "2026-01-15"},
                         timeout=10)
        passed = r.status_code == 403 and "admin" in r.text.lower()
        results.append(test_result("Register virement without admin → 403", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Register virement without admin → 403", False, str(e)))
    
    # Test 3: POST /api/admin/refund-attestation/non-existent/upload body {} → 400
    try:
        r = requests.post(f"{BASE_URL}/admin/refund-attestation/non-existent/upload",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 400 and "file_base64" in r.text.lower()
        results.append(test_result("Upload attestation no file → 400", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Upload attestation no file → 400", False, str(e)))
    
    # Test 4: POST /api/admin/refund-attestation/non-existent/generate with admin → 404
    try:
        r = requests.post(f"{BASE_URL}/admin/refund-attestation/non-existent/generate",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        passed = r.status_code == 404 and "introuvable" in r.text.lower()
        results.append(test_result("Generate attestation non-existent → 404", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Generate attestation non-existent → 404", False, str(e)))
    
    # Test 5: POST /api/admin/register-virement/some-id with body {} (no virement_reference) → 400
    try:
        r = requests.post(f"{BASE_URL}/admin/register-virement/some-fake-id-12345",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        # Should return 400 for missing virement_reference OR 404 if reg doesn't exist
        passed = r.status_code in [400, 404]
        results.append(test_result("Register virement no reference → 400/404", passed,
                                   f"Status: {r.status_code}, Body: {r.text[:100]}"))
    except Exception as e:
        results.append(test_result("Register virement no reference → 400/404", False, str(e)))
    
    return all(results)

# ═══════════════════════════════════════════════════════════════════
# FUNCTIONAL END-TO-END TEST (caution appointments workflow)
# ═══════════════════════════════════════════════════════════════════

def test_functional_e2e():
    """Functional end-to-end test for caution appointments workflow"""
    log("=" * 70)
    log("FUNCTIONAL END-TO-END TEST: Caution Appointments Workflow")
    log("=" * 70)
    
    results = []
    
    # Step 0: Find an existing non-protected test registration
    try:
        log("Step 0: Finding a test registration...")
        r = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if r.status_code != 200:
            log(f"Failed to get registrations: {r.status_code}", "ERROR")
            return False
        
        regs = r.json()
        if not regs or len(regs) == 0:
            log("No registrations found in database", "ERROR")
            return False
        
        # Find a registration that's not protected (avoid I Mua Papeete, etc.)
        test_reg = None
        for reg in regs[:10]:  # Check first 10
            if reg.get('status') in ['a_confirmer', 'a_relancer']:
                test_reg = reg
                break
        
        if not test_reg:
            test_reg = regs[0]  # Fallback to first one
        
        reg_id = test_reg['id']
        log(f"Using registration: {reg_id} (status: {test_reg.get('status')})")
        
    except Exception as e:
        log(f"Step 0 failed: {str(e)}", "ERROR")
        return False
    
    # Step 1: Submit a caution appointment via POST /api/exposant/caution-appointment
    try:
        log("Step 1: Submitting caution appointment request...")
        payload = {
            "registration_id": reg_id,
            "organization_id": test_reg.get('organization_id'),
            "requested_date": "2026-09-15",
            "requested_time": "14:00",
            "requested_place": "aracom_paea",
            "notes": "Test appointment request"
        }
        r = requests.post(f"{BASE_URL}/exposant/caution-appointment",
                         headers=EXPOSANT_HEADERS, json=payload, timeout=10)
        
        if r.status_code != 200:
            results.append(test_result("Step 1: Submit appointment", False,
                                      f"Status: {r.status_code}, Body: {r.text[:200]}"))
            return False
        
        data = r.json()
        if not data.get('ok') or not data.get('appointment'):
            results.append(test_result("Step 1: Submit appointment", False,
                                      f"Missing ok/appointment in response: {data}"))
            return False
        
        appt = data['appointment']
        appt_id = appt.get('id')
        
        # Verify requested_place field is present
        has_place = 'requested_place' in appt
        results.append(test_result("Step 1: Submit appointment → 200 with requested_place", 
                                  has_place and appt_id is not None,
                                  f"Appointment ID: {appt_id}, requested_place: {appt.get('requested_place')}"))
        
        if not appt_id:
            return False
            
    except Exception as e:
        results.append(test_result("Step 1: Submit appointment", False, str(e)))
        return False
    
    # Step 2: Validate it via POST /api/admin/caution-appointments/update
    try:
        log("Step 2: Validating appointment (admin)...")
        payload = {
            "id": appt_id,
            "status": "confirme",
            "confirmed_place": "sur_site",
            "confirmed_date": "2026-09-15",
            "confirmed_time": "15:00",
            "admin_note": "Confirmé par test automatique"
        }
        r = requests.post(f"{BASE_URL}/admin/caution-appointments/update",
                         headers=ADMIN_HEADERS, json=payload, timeout=10)
        
        if r.status_code != 200:
            results.append(test_result("Step 2: Validate appointment", False,
                                      f"Status: {r.status_code}, Body: {r.text[:200]}"))
            return False
        
        data = r.json()
        if not data.get('ok') or not data.get('appointment'):
            results.append(test_result("Step 2: Validate appointment", False,
                                      f"Missing ok/appointment in response: {data}"))
            return False
        
        appt = data['appointment']
        has_confirmed_place = 'confirmed_place' in appt and appt['confirmed_place'] == 'sur_site'
        results.append(test_result("Step 2: Validate appointment → 200 with confirmed_place",
                                  has_confirmed_place,
                                  f"Status: {appt.get('status')}, confirmed_place: {appt.get('confirmed_place')}"))
        
    except Exception as e:
        results.append(test_result("Step 2: Validate appointment", False, str(e)))
        return False
    
    # Step 3: Reset it via POST /api/admin/registrations/{regId}/reset-caution-appointment
    try:
        log("Step 3: Resetting caution appointment...")
        r = requests.post(f"{BASE_URL}/admin/registrations/{reg_id}/reset-caution-appointment",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        
        if r.status_code != 200:
            results.append(test_result("Step 3: Reset appointment", False,
                                      f"Status: {r.status_code}, Body: {r.text[:200]}"))
            return False
        
        data = r.json()
        has_action = data.get('action') == 'caution_appointment_deleted'
        results.append(test_result("Step 3: Reset appointment → 200 action=caution_appointment_deleted",
                                  has_action,
                                  f"Response: {data}"))
        
    except Exception as e:
        results.append(test_result("Step 3: Reset appointment", False, str(e)))
        return False
    
    # Step 4: Re-call reset → should return 404
    try:
        log("Step 4: Re-calling reset (should fail)...")
        r = requests.post(f"{BASE_URL}/admin/registrations/{reg_id}/reset-caution-appointment",
                         headers=ADMIN_HEADERS, json={}, timeout=10)
        
        is_404 = r.status_code == 404 and "aucun" in r.text.lower()
        results.append(test_result("Step 4: Re-call reset → 404 'Aucun RDV'",
                                  is_404,
                                  f"Status: {r.status_code}, Body: {r.text[:100]}"))
        
    except Exception as e:
        results.append(test_result("Step 4: Re-call reset", False, str(e)))
        return False
    
    return all(results)

# ═══════════════════════════════════════════════════════════════════
# MAIN TEST RUNNER
# ═══════════════════════════════════════════════════════════════════

def main():
    """Run all regression tests"""
    log("=" * 70)
    log("BACKEND REGRESSION TESTS - 3 EXTRACTED HANDLER MODULES")
    log("Backend URL: " + BASE_URL)
    log("=" * 70)
    print()
    
    all_passed = True
    
    # Module 1: admin-delete-reset (smoke tests only, already fully tested)
    try:
        passed = test_module1_smoke()
        all_passed = all_passed and passed
        log(f"Module 1 Result: {'✅ PASS' if passed else '❌ FAIL'}")
    except Exception as e:
        log(f"Module 1 crashed: {str(e)}", "ERROR")
        all_passed = False
    
    print()
    
    # Module 2: caution-appointments (NEW EXTRACTION)
    try:
        passed = test_module2_smoke()
        all_passed = all_passed and passed
        log(f"Module 2 Result: {'✅ PASS' if passed else '❌ FAIL'}")
    except Exception as e:
        log(f"Module 2 crashed: {str(e)}", "ERROR")
        all_passed = False
    
    print()
    
    # Module 3: caution-receipts (NEW EXTRACTION)
    try:
        passed = test_module3_smoke()
        all_passed = all_passed and passed
        log(f"Module 3 Result: {'✅ PASS' if passed else '❌ FAIL'}")
    except Exception as e:
        log(f"Module 3 crashed: {str(e)}", "ERROR")
        all_passed = False
    
    print()
    
    # Functional end-to-end test
    try:
        passed = test_functional_e2e()
        all_passed = all_passed and passed
        log(f"Functional E2E Result: {'✅ PASS' if passed else '❌ FAIL'}")
    except Exception as e:
        log(f"Functional E2E crashed: {str(e)}", "ERROR")
        all_passed = False
    
    print()
    log("=" * 70)
    if all_passed:
        log("🎉 ALL TESTS PASSED - NO REGRESSION DETECTED", "SUCCESS")
        log("=" * 70)
        return 0
    else:
        log("❌ SOME TESTS FAILED - REGRESSION DETECTED", "ERROR")
        log("=" * 70)
        return 1

if __name__ == "__main__":
    sys.exit(main())
