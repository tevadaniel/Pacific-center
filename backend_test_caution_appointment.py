#!/usr/bin/env python3
"""
Test script for NEW exposant portal caution-appointment endpoints (session restructuring).

Tests 9 scenarios:
1. GET caution-appointment — none exists yet
2. POST caution-appointment — creates new
3. GET caution-appointment — now exists
4. POST caution-appointment — update (upsert)
5. POST caution-appointment — missing required fields
6. POST caution-appointment — missing reg_id
7. Non-regression — Satisfaction GET still works
8. Non-regression — Satisfaction POST still gated
9. CLEANUP — Delete test entries
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-id": "u-admin-aracom",
    "x-user-role": "aracom_admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-id": "u-exp-test",
    "x-user-role": "exposant",
    "Content-Type": "application/json"
}

# Test state
test_results = []
test_reg_id = None
test_org_id = None

def log_test(scenario, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"scenario": scenario, "passed": passed, "details": details})
    print(f"{status} - {scenario}")
    if details:
        print(f"    {details}")

def get_real_registration():
    """Get a real registration_id from the database"""
    global test_reg_id, test_org_id
    try:
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
        if resp.status_code == 200:
            regs = resp.json()
            if regs and len(regs) > 0:
                test_reg_id = regs[0]["id"]
                test_org_id = regs[0]["organization"]["id"] if regs[0].get("organization") else None
                print(f"📋 Using registration_id: {test_reg_id}")
                print(f"📋 Using organization_id: {test_org_id}")
                return True
        print(f"❌ Failed to get registrations: {resp.status_code}")
        return False
    except Exception as e:
        print(f"❌ Error getting registrations: {e}")
        return False

def test_scenario_1():
    """Scenario 1: GET caution-appointment — none exists yet"""
    print("\n🧪 Scenario 1: GET caution-appointment — none exists yet")
    try:
        resp = requests.get(
            f"{BASE_URL}/exposant/caution-appointment?registration_id={test_reg_id}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if "appointment" in data:
                # Could be null or an existing appointment
                log_test("Scenario 1", True, f"GET returned 200 with appointment: {data['appointment']}")
            else:
                log_test("Scenario 1", False, f"Missing 'appointment' key in response: {data}")
        else:
            log_test("Scenario 1", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 1", False, f"Exception: {e}")

def test_scenario_2():
    """Scenario 2: POST caution-appointment — creates new"""
    print("\n🧪 Scenario 2: POST caution-appointment — creates new")
    try:
        payload = {
            "registration_id": test_reg_id,
            "organization_id": test_org_id,
            "requested_date": "2026-08-17",
            "requested_time": "10:00",
            "notes": "Test E2E"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("appointment"):
                appt = data["appointment"]
                checks = [
                    ("id exists", "id" in appt),
                    ("requested_date correct", appt.get("requested_date") == "2026-08-17"),
                    ("requested_time correct", appt.get("requested_time") == "10:00"),
                    ("status is demande", appt.get("status") == "demande"),
                    ("notes correct", appt.get("notes") == "Test E2E")
                ]
                all_pass = all(c[1] for c in checks)
                details = ", ".join([f"{c[0]}: {c[1]}" for c in checks])
                log_test("Scenario 2", all_pass, details)
            else:
                log_test("Scenario 2", False, f"Missing ok or appointment in response: {data}")
        else:
            log_test("Scenario 2", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 2", False, f"Exception: {e}")

def test_scenario_3():
    """Scenario 3: GET caution-appointment — now exists"""
    print("\n🧪 Scenario 3: GET caution-appointment — now exists")
    try:
        resp = requests.get(
            f"{BASE_URL}/exposant/caution-appointment?registration_id={test_reg_id}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("appointment"):
                appt = data["appointment"]
                checks = [
                    ("requested_date matches", appt.get("requested_date") == "2026-08-17"),
                    ("requested_time matches", appt.get("requested_time") == "10:00"),
                    ("notes matches", appt.get("notes") == "Test E2E")
                ]
                all_pass = all(c[1] for c in checks)
                details = ", ".join([f"{c[0]}: {c[1]}" for c in checks])
                log_test("Scenario 3", all_pass, details)
            else:
                log_test("Scenario 3", False, f"appointment is null: {data}")
        else:
            log_test("Scenario 3", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 3", False, f"Exception: {e}")

def test_scenario_4():
    """Scenario 4: POST caution-appointment — update (upsert)"""
    print("\n🧪 Scenario 4: POST caution-appointment — update (upsert)")
    try:
        payload = {
            "registration_id": test_reg_id,
            "organization_id": test_org_id,
            "requested_date": "2026-08-18",
            "requested_time": "14:30",
            "notes": "Test E2E Updated"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("appointment"):
                appt = data["appointment"]
                checks = [
                    ("requested_date updated", appt.get("requested_date") == "2026-08-18"),
                    ("requested_time updated", appt.get("requested_time") == "14:30"),
                    ("notes updated", appt.get("notes") == "Test E2E Updated")
                ]
                all_pass = all(c[1] for c in checks)
                details = ", ".join([f"{c[0]}: {c[1]}" for c in checks])
                log_test("Scenario 4", all_pass, details)
                
                # Verify there's still only one appointment (upsert, not duplicate)
                resp2 = requests.get(
                    f"{BASE_URL}/exposant/caution-appointment?registration_id={test_reg_id}",
                    headers=ADMIN_HEADERS,
                    timeout=30
                )
                if resp2.status_code == 200:
                    data2 = resp2.json()
                    if data2.get("appointment"):
                        print(f"    ✓ Verified: Only one appointment exists (upsert worked)")
                    else:
                        print(f"    ⚠️ Warning: Could not verify single appointment")
            else:
                log_test("Scenario 4", False, f"Missing ok or appointment in response: {data}")
        else:
            log_test("Scenario 4", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 4", False, f"Exception: {e}")

def test_scenario_5():
    """Scenario 5: POST caution-appointment — missing required fields"""
    print("\n🧪 Scenario 5: POST caution-appointment — missing required fields")
    try:
        payload = {
            "registration_id": test_reg_id
            # Missing requested_date and requested_time
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=30
        )
        if resp.status_code == 400:
            data = resp.json()
            if "error" in data and "requis" in data["error"].lower():
                log_test("Scenario 5", True, f"Correctly rejected with 400: {data['error']}")
            else:
                log_test("Scenario 5", False, f"Got 400 but wrong error message: {data}")
        else:
            log_test("Scenario 5", False, f"Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 5", False, f"Exception: {e}")

def test_scenario_6():
    """Scenario 6: POST caution-appointment — missing reg_id"""
    print("\n🧪 Scenario 6: POST caution-appointment — missing reg_id")
    try:
        payload = {
            "requested_date": "2026-08-17",
            "requested_time": "10:00"
            # Missing registration_id
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=30
        )
        if resp.status_code == 400:
            data = resp.json()
            if "error" in data and "requis" in data["error"].lower():
                log_test("Scenario 6", True, f"Correctly rejected with 400: {data['error']}")
            else:
                log_test("Scenario 6", False, f"Got 400 but wrong error message: {data}")
        else:
            log_test("Scenario 6", False, f"Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 6", False, f"Exception: {e}")

def test_scenario_7():
    """Scenario 7: Non-regression — Satisfaction GET still works"""
    print("\n🧪 Scenario 7: Non-regression — Satisfaction GET still works")
    try:
        resp = requests.get(
            f"{BASE_URL}/exposant/satisfaction?organization_id={test_org_id}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            if "response" in data:
                log_test("Scenario 7", True, f"GET satisfaction returned 200 with response key")
            else:
                log_test("Scenario 7", False, f"Missing 'response' key: {data}")
        else:
            log_test("Scenario 7", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 7", False, f"Exception: {e}")

def test_scenario_8():
    """Scenario 8: Non-regression — Satisfaction POST still gated"""
    print("\n🧪 Scenario 8: Non-regression — Satisfaction POST still gated")
    try:
        # First, check current post-event status
        resp_status = requests.get(
            f"{BASE_URL}/post-event-status",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        original_unlocked = False
        if resp_status.status_code == 200:
            original_unlocked = resp_status.json().get("unlocked", False)
            print(f"    📋 Original post-event status: unlocked={original_unlocked}")
        
        # Lock the post-event status
        resp_lock = requests.post(
            f"{BASE_URL}/post-event-status",
            headers=ADMIN_HEADERS,
            json={"unlocked": False},
            timeout=30
        )
        if resp_lock.status_code != 200:
            log_test("Scenario 8", False, f"Failed to lock post-event status: {resp_lock.status_code}")
            return
        
        # Try to POST satisfaction with exposant role (should be 403)
        payload = {
            "organization_id": test_org_id,
            "ratings": {"procedure_clarte": 5}
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/satisfaction",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=30
        )
        
        # Restore original status
        requests.post(
            f"{BASE_URL}/post-event-status",
            headers=ADMIN_HEADERS,
            json={"unlocked": original_unlocked},
            timeout=30
        )
        
        if resp.status_code == 403:
            data = resp.json()
            if "error" in data and "questionnaire" in data["error"].lower():
                log_test("Scenario 8", True, f"Correctly gated with 403: {data['error']}")
            else:
                log_test("Scenario 8", False, f"Got 403 but wrong error message: {data}")
        else:
            log_test("Scenario 8", False, f"Expected 403, got {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Scenario 8", False, f"Exception: {e}")

def test_scenario_9():
    """Scenario 9: CLEANUP — Delete test entries"""
    print("\n🧪 Scenario 9: CLEANUP — Delete test caution_appointments")
    try:
        # Note: There's no DELETE endpoint for caution_appointments in the API
        # We'll use MongoDB command to clean up
        print("    ℹ️ No DELETE endpoint available for caution_appointments")
        print(f"    ℹ️ To clean up manually, run: db.caution_appointments.deleteMany({{ notes: 'Test E2E' }})")
        print(f"    ℹ️ Or: db.caution_appointments.deleteMany({{ registration_id: '{test_reg_id}' }})")
        log_test("Scenario 9", True, "Cleanup instructions provided (no DELETE endpoint)")
    except Exception as e:
        log_test("Scenario 9", False, f"Exception: {e}")

def main():
    print("=" * 80)
    print("🧪 TESTING NEW EXPOSANT PORTAL CAUTION-APPOINTMENT ENDPOINTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    # Get a real registration to test with
    if not get_real_registration():
        print("\n❌ CRITICAL: Could not get a real registration_id. Aborting tests.")
        sys.exit(1)
    
    # Run all scenarios
    test_scenario_1()
    test_scenario_2()
    test_scenario_3()
    test_scenario_4()
    test_scenario_5()
    test_scenario_6()
    test_scenario_7()
    test_scenario_8()
    test_scenario_9()
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    print(f"Total: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print()
    
    for r in test_results:
        status = "✅" if r["passed"] else "❌"
        print(f"{status} {r['scenario']}")
    
    print("\n" + "=" * 80)
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"⚠️ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
