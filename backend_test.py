#!/usr/bin/env python3
"""
SESSION 47 — E2E Simulation Backend Testing
Tests the new simulation system endpoints and is_simulation flag propagation
"""

import requests
import json
import time
import sys

# Base URL from .env
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin credentials
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# Non-admin credentials for permission tests
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-test-exposant",
    "Content-Type": "application/json"
}

def log_test(test_name, passed, details=""):
    """Log test results"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"  Details: {details}")
    return passed

def test_1_begin_without_admin():
    """Test 1: POST /api/admin/simulation/begin without admin role → expect 403"""
    print("\n=== TEST 1: Begin simulation without admin role ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/begin",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=10
        )
        passed = response.status_code == 403
        return log_test("Begin without admin → 403", passed, f"Status: {response.status_code}")
    except Exception as e:
        return log_test("Begin without admin → 403", False, f"Error: {str(e)}")

def test_2_begin_with_admin():
    """Test 2: POST /api/admin/simulation/begin with admin → expect 200 with session_id"""
    print("\n=== TEST 2: Begin simulation with admin role ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/begin",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Begin with admin → 200", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        # Check required fields
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("session_id starts with 'sim-'", str(data.get("session_id", "")).startswith("sim-")))
        checks.append(("redirect_to is gerosteva@gmail.com", data.get("redirect_to") == "gerosteva@gmail.com"))
        checks.append(("message field present", "message" in data))
        
        all_passed = all(check[1] for check in checks)
        details = ", ".join([f"{check[0]}: {check[1]}" for check in checks])
        
        return log_test("Begin with admin → 200 with correct fields", all_passed, details)
    except Exception as e:
        return log_test("Begin with admin → 200", False, f"Error: {str(e)}")

def test_3_verify_simulation_active():
    """Test 3: Verify app_settings.mail_config has simulation_active=true"""
    print("\n=== TEST 3: Verify simulation_active in mail_config ===")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/simulation/status",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Verify simulation_active", False, f"Status: {response.status_code}")
        
        data = response.json()
        passed = data.get("simulation_active") == True
        return log_test("simulation_active is true", passed, f"simulation_active: {data.get('simulation_active')}")
    except Exception as e:
        return log_test("Verify simulation_active", False, f"Error: {str(e)}")

def test_4_end_without_admin():
    """Test 4: POST /api/admin/simulation/end without admin → expect 403"""
    print("\n=== TEST 4: End simulation without admin role ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/end",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=10
        )
        passed = response.status_code == 403
        return log_test("End without admin → 403", passed, f"Status: {response.status_code}")
    except Exception as e:
        return log_test("End without admin → 403", False, f"Error: {str(e)}")

def test_5_status_without_admin():
    """Test 5: GET /api/admin/simulation/status without admin → expect 403"""
    print("\n=== TEST 5: Status without admin role ===")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/simulation/status",
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        passed = response.status_code == 403
        return log_test("Status without admin → 403", passed, f"Status: {response.status_code}")
    except Exception as e:
        return log_test("Status without admin → 403", False, f"Error: {str(e)}")

def test_6_status_initial_counts():
    """Test 6: GET /api/admin/simulation/status → initial counts should be 0"""
    print("\n=== TEST 6: Status endpoint initial counts ===")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/simulation/status",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Status initial counts", False, f"Status: {response.status_code}")
        
        data = response.json()
        counts = data.get("counts", {})
        
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("simulation_active present", "simulation_active" in data))
        checks.append(("simulation_redirect present", "simulation_redirect" in data))
        checks.append(("simulation_session_id present", "simulation_session_id" in data))
        checks.append(("counts.organizations present", "organizations" in counts))
        checks.append(("counts.registrations present", "registrations" in counts))
        checks.append(("counts.animation_slots present", "animation_slots" in counts))
        checks.append(("counts.stand_assignments present", "stand_assignments" in counts))
        checks.append(("counts.validation_requests present", "validation_requests" in counts))
        
        all_passed = all(check[1] for check in checks)
        details = f"Counts: orgs={counts.get('organizations')}, regs={counts.get('registrations')}, anims={counts.get('animation_slots')}, stands={counts.get('stand_assignments')}, val_reqs={counts.get('validation_requests')}"
        
        return log_test("Status endpoint structure correct", all_passed, details)
    except Exception as e:
        return log_test("Status initial counts", False, f"Error: {str(e)}")

def test_7_self_register_with_simulation_flag():
    """Test 7: POST /api/auth/self-register with x-simulation:1 → creates org+reg with is_simulation:true"""
    print("\n=== TEST 7: Self-register with simulation flag ===")
    try:
        sim_headers = ADMIN_HEADERS.copy()
        sim_headers["x-simulation"] = "1"
        sim_headers["x-sim-session"] = "test-session-001"
        
        email = f"sim+e2e1@simulation.local"
        
        response = requests.post(
            f"{BASE_URL}/auth/self-register",
            headers=sim_headers,
            json={"email": email},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Self-register with sim flag", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("is_simulation is true", data.get("is_simulation") == True))
        checks.append(("registration_id present", "registration_id" in data))
        checks.append(("organization_id present", "organization_id" in data))
        
        all_passed = all(check[1] for check in checks)
        details = f"is_simulation: {data.get('is_simulation')}, reg_id: {data.get('registration_id')}, org_id: {data.get('organization_id')}"
        
        # Store for later tests
        global sim_registration_id, sim_organization_id
        sim_registration_id = data.get("registration_id")
        sim_organization_id = data.get("organization_id")
        
        return log_test("Self-register with sim flag → is_simulation:true", all_passed, details)
    except Exception as e:
        return log_test("Self-register with sim flag", False, f"Error: {str(e)}")

def test_8_self_register_without_simulation_flag():
    """Test 8: POST /api/auth/self-register without x-simulation → creates org+reg with is_simulation:false"""
    print("\n=== TEST 8: Self-register without simulation flag ===")
    try:
        email = f"normal+e2e@example.com"
        
        response = requests.post(
            f"{BASE_URL}/auth/self-register",
            headers={"Content-Type": "application/json"},
            json={"email": email},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Self-register without sim flag", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("is_simulation is false or absent", data.get("is_simulation") == False or "is_simulation" not in data))
        checks.append(("registration_id present", "registration_id" in data))
        checks.append(("organization_id present", "organization_id" in data))
        
        all_passed = all(check[1] for check in checks)
        details = f"is_simulation: {data.get('is_simulation')}, reg_id: {data.get('registration_id')}, org_id: {data.get('organization_id')}"
        
        # Store for later tests
        global normal_registration_id, normal_organization_id
        normal_registration_id = data.get("registration_id")
        normal_organization_id = data.get("organization_id")
        
        return log_test("Self-register without sim flag → is_simulation:false", all_passed, details)
    except Exception as e:
        return log_test("Self-register without sim flag", False, f"Error: {str(e)}")

def test_9_status_after_sim_creation():
    """Test 9: GET /api/admin/simulation/status → counts should reflect new sim records"""
    print("\n=== TEST 9: Status after simulation record creation ===")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/simulation/status",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Status after sim creation", False, f"Status: {response.status_code}")
        
        data = response.json()
        counts = data.get("counts", {})
        
        # Should have at least 1 org and 1 registration from test 7
        checks = []
        checks.append(("organizations >= 1", counts.get("organizations", 0) >= 1))
        checks.append(("registrations >= 1", counts.get("registrations", 0) >= 1))
        
        all_passed = all(check[1] for check in checks)
        details = f"Counts: orgs={counts.get('organizations')}, regs={counts.get('registrations')}"
        
        return log_test("Status counts reflect sim records", all_passed, details)
    except Exception as e:
        return log_test("Status after sim creation", False, f"Error: {str(e)}")

def test_10_wizard_profile_with_sim():
    """Test 10: POST /api/wizard/profile with simulation registration"""
    print("\n=== TEST 10: Wizard profile step with simulation ===")
    try:
        if not sim_registration_id:
            return log_test("Wizard profile with sim", False, "No sim_registration_id from previous test")
        
        sim_headers = ADMIN_HEADERS.copy()
        sim_headers["x-simulation"] = "1"
        
        response = requests.post(
            f"{BASE_URL}/wizard/profile",
            headers=sim_headers,
            json={
                "registration_id": sim_registration_id,
                "profile": {
                    "name": "[SIM] E2E Test Org",
                    "discipline": "Judo",
                    "contact_name": "Test Contact",
                    "main_email": "sim+e2e1@simulation.local",
                    "representatives_count": 2
                }
            },
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Wizard profile with sim", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        passed = data.get("ok") == True and data.get("next_step") == 2
        return log_test("Wizard profile step completed", passed, f"next_step: {data.get('next_step')}")
    except Exception as e:
        return log_test("Wizard profile with sim", False, f"Error: {str(e)}")

def test_11_cleanup_without_admin():
    """Test 11: POST /api/admin/simulation/cleanup without admin → expect 403"""
    print("\n=== TEST 11: Cleanup without admin role ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=10
        )
        passed = response.status_code == 403
        return log_test("Cleanup without admin → 403", passed, f"Status: {response.status_code}")
    except Exception as e:
        return log_test("Cleanup without admin → 403", False, f"Error: {str(e)}")

def test_12_cleanup_with_admin():
    """Test 12: POST /api/admin/simulation/cleanup with admin → deletes all sim records"""
    print("\n=== TEST 12: Cleanup simulation records ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/cleanup",
            headers=ADMIN_HEADERS,
            json={},
            timeout=15
        )
        
        if response.status_code != 200:
            return log_test("Cleanup with admin", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("deleted field present", "deleted" in data))
        checks.append(("message field present", "message" in data))
        
        deleted = data.get("deleted", {})
        details = f"Deleted: orgs={deleted.get('organizations')}, regs={deleted.get('registrations')}, users={deleted.get('users')}"
        
        all_passed = all(check[1] for check in checks)
        return log_test("Cleanup executed successfully", all_passed, details)
    except Exception as e:
        return log_test("Cleanup with admin", False, f"Error: {str(e)}")

def test_13_status_after_cleanup():
    """Test 13: GET /api/admin/simulation/status → all counts should be 0"""
    print("\n=== TEST 13: Status after cleanup ===")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/simulation/status",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Status after cleanup", False, f"Status: {response.status_code}")
        
        data = response.json()
        counts = data.get("counts", {})
        
        checks = []
        checks.append(("organizations == 0", counts.get("organizations") == 0))
        checks.append(("registrations == 0", counts.get("registrations") == 0))
        checks.append(("animation_slots == 0", counts.get("animation_slots") == 0))
        checks.append(("stand_assignments == 0", counts.get("stand_assignments") == 0))
        checks.append(("validation_requests == 0", counts.get("validation_requests") == 0))
        checks.append(("simulation_active is false", data.get("simulation_active") == False))
        
        all_passed = all(check[1] for check in checks)
        details = f"Counts: orgs={counts.get('organizations')}, regs={counts.get('registrations')}, simulation_active={data.get('simulation_active')}"
        
        return log_test("All sim counts are 0 after cleanup", all_passed, details)
    except Exception as e:
        return log_test("Status after cleanup", False, f"Error: {str(e)}")

def test_14_verify_normal_record_survives():
    """Test 14: Verify normal (non-simulation) record from test 8 still exists"""
    print("\n=== TEST 14: Verify normal record survives cleanup ===")
    try:
        if not normal_registration_id:
            return log_test("Normal record survives", False, "No normal_registration_id from previous test")
        
        # Try to fetch the normal registration
        response = requests.get(
            f"{BASE_URL}/registrations/{normal_registration_id}",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        # If it returns 200, the record still exists
        passed = response.status_code == 200
        details = f"Status: {response.status_code}, normal_registration_id: {normal_registration_id}"
        
        return log_test("Normal record survives cleanup", passed, details)
    except Exception as e:
        return log_test("Normal record survives", False, f"Error: {str(e)}")

def test_15_end_simulation():
    """Test 15: POST /api/admin/simulation/end → sets simulation_active=false"""
    print("\n=== TEST 15: End simulation ===")
    try:
        # First, start simulation again
        requests.post(f"{BASE_URL}/admin/simulation/begin", headers=ADMIN_HEADERS, json={}, timeout=10)
        
        # Now end it
        response = requests.post(
            f"{BASE_URL}/admin/simulation/end",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("End simulation", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        
        checks = []
        checks.append(("ok field is true", data.get("ok") == True))
        checks.append(("message contains 'désactivée'", "désactivée" in data.get("message", "").lower() or "desactivee" in data.get("message", "").lower()))
        
        all_passed = all(check[1] for check in checks)
        
        # Verify simulation_active is now false
        status_response = requests.get(f"{BASE_URL}/admin/simulation/status", headers=ADMIN_HEADERS, timeout=10)
        if status_response.status_code == 200:
            status_data = status_response.json()
            checks.append(("simulation_active is false", status_data.get("simulation_active") == False))
        
        all_passed = all(check[1] for check in checks)
        details = ", ".join([f"{check[0]}: {check[1]}" for check in checks])
        
        return log_test("End simulation successful", all_passed, details)
    except Exception as e:
        return log_test("End simulation", False, f"Error: {str(e)}")

def test_16_retest_begin_after_cleanup():
    """Test 16: POST /api/admin/simulation/begin again after cleanup → should work"""
    print("\n=== TEST 16: Re-test begin after cleanup ===")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/simulation/begin",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code != 200:
            return log_test("Re-test begin after cleanup", False, f"Status: {response.status_code}, Body: {response.text}")
        
        data = response.json()
        passed = data.get("ok") == True and str(data.get("session_id", "")).startswith("sim-")
        
        # End it again to clean up
        requests.post(f"{BASE_URL}/admin/simulation/end", headers=ADMIN_HEADERS, json={}, timeout=10)
        
        return log_test("Begin works after cleanup", passed, f"session_id: {data.get('session_id')}")
    except Exception as e:
        return log_test("Re-test begin after cleanup", False, f"Error: {str(e)}")

def main():
    """Run all tests"""
    print("=" * 80)
    print("SESSION 47 — E2E SIMULATION BACKEND TESTING")
    print("=" * 80)
    
    # Initialize global variables
    global sim_registration_id, sim_organization_id, normal_registration_id, normal_organization_id
    sim_registration_id = None
    sim_organization_id = None
    normal_registration_id = None
    normal_organization_id = None
    
    results = []
    
    # Run all tests
    results.append(test_1_begin_without_admin())
    results.append(test_2_begin_with_admin())
    results.append(test_3_verify_simulation_active())
    results.append(test_4_end_without_admin())
    results.append(test_5_status_without_admin())
    results.append(test_6_status_initial_counts())
    results.append(test_7_self_register_with_simulation_flag())
    results.append(test_8_self_register_without_simulation_flag())
    results.append(test_9_status_after_sim_creation())
    results.append(test_10_wizard_profile_with_sim())
    results.append(test_11_cleanup_without_admin())
    results.append(test_12_cleanup_with_admin())
    results.append(test_13_status_after_cleanup())
    results.append(test_14_verify_normal_record_survives())
    results.append(test_15_end_simulation())
    results.append(test_16_retest_begin_after_cleanup())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"Total tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success rate: {percentage:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
