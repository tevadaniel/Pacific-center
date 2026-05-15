#!/usr/bin/env python3
"""
Backend test for NEW admin caution appointments management endpoints.
Tests 11 scenarios as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from .env
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Test data
ADMIN_HEADERS = {
    "x-user-id": "u-admin",
    "x-user-role": "aracom_admin",
    "Content-Type": "application/json"
}

EXPOSANT_HEADERS = {
    "x-user-id": "u-exp-1",
    "x-user-role": "exposant",
    "Content-Type": "application/json"
}

def print_test(num, desc):
    print(f"\n{'='*80}")
    print(f"TEST {num}: {desc}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def test_1_list_appointments_admin():
    """Test 1: List appointments — empty/non-empty (admin)"""
    print_test(1, "List appointments — empty/non-empty (admin)")
    try:
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                print(f"Found {len(data)} appointments")
                return print_result(True, f"GET /api/admin/caution-appointments returned 200 with {len(data)} appointments")
            else:
                return print_result(False, f"Expected array, got {type(data)}")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_2_list_appointments_non_admin():
    """Test 2: List appointments — NON-ADMIN forbidden"""
    print_test(2, "List appointments — NON-ADMIN forbidden")
    try:
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments", headers=EXPOSANT_HEADERS, timeout=10)
        if resp.status_code == 403:
            data = resp.json()
            if 'error' in data:
                return print_result(True, f"Non-admin correctly rejected with 403: {data['error']}")
            else:
                return print_result(True, "Non-admin correctly rejected with 403")
        else:
            return print_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_3_create_appointment_admin():
    """Test 3: Create appointment (admin) — new exposant"""
    print_test(3, "Create appointment (admin) — new exposant")
    try:
        # First, get a real registration
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return print_result(False, f"Failed to get registrations: {resp.status_code}")
        
        regs = resp.json()
        if not regs:
            return print_result(False, "No registrations found")
        
        # Use the first registration
        reg = regs[0]
        reg_id = reg['id']
        org_id = reg['organization']['id'] if reg.get('organization') else None
        
        print(f"Using registration: {reg_id}, org: {org_id}")
        
        # Create appointment
        body = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "confirmed_date": "2026-08-20",
            "confirmed_time": "14:30",
            "admin_note": "Test admin E2E"
        }
        
        resp = requests.post(f"{BASE_URL}/admin/caution-appointments/create", 
                            headers=ADMIN_HEADERS, 
                            json=body, 
                            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('appointment'):
                appt = data['appointment']
                if (appt.get('status') == 'confirme' and 
                    appt.get('confirmed_date') == '2026-08-20' and 
                    appt.get('confirmed_time') == '14:30'):
                    # Store appointment ID for later tests
                    global CREATED_APPT_ID, CREATED_REG_ID
                    CREATED_APPT_ID = appt['id']
                    CREATED_REG_ID = reg_id
                    return print_result(True, f"Appointment created: id={appt['id']}, status=confirme")
                else:
                    return print_result(False, f"Appointment data incorrect: {appt}")
            else:
                return print_result(False, f"Response missing ok/appointment: {data}")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_4_list_appointments_includes_new():
    """Test 4: List appointments — now includes the new one"""
    print_test(4, "List appointments — now includes the new one")
    try:
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            found = False
            for appt in data:
                if (appt.get('confirmed_date') == '2026-08-20' and 
                    appt.get('confirmed_time') == '14:30'):
                    found = True
                    # Check enrichment
                    has_enrichment = (
                        'organization_name' in appt and
                        'venue_name' in appt and
                        'stand_code' in appt and
                        'survey_submitted' in appt
                    )
                    if has_enrichment:
                        return print_result(True, f"Found appointment with enrichment: org={appt.get('organization_name')}, venue={appt.get('venue_name')}")
                    else:
                        return print_result(False, f"Appointment found but missing enrichment fields")
            
            if not found:
                return print_result(False, "Created appointment not found in list")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_5_list_with_status_filter():
    """Test 5: List with status filter"""
    print_test(5, "List with status filter")
    try:
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments?status=confirme", 
                           headers=ADMIN_HEADERS, 
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            # Check all have status=confirme
            all_confirme = all(appt.get('status') == 'confirme' for appt in data)
            if all_confirme:
                return print_result(True, f"Filter works: {len(data)} appointments with status=confirme")
            else:
                return print_result(False, "Some appointments don't have status=confirme")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_6_update_appointment_propose():
    """Test 6: Update appointment — propose new slot"""
    print_test(6, "Update appointment — propose new slot")
    try:
        if not CREATED_APPT_ID:
            return print_result(False, "No appointment ID from test 3")
        
        body = {
            "id": CREATED_APPT_ID,
            "status": "propose",
            "confirmed_date": "2026-08-21",
            "confirmed_time": "10:00",
            "admin_note": "Reprogrammé"
        }
        
        resp = requests.post(f"{BASE_URL}/admin/caution-appointments/update", 
                            headers=ADMIN_HEADERS, 
                            json=body, 
                            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('appointment'):
                appt = data['appointment']
                if (appt.get('status') == 'propose' and 
                    appt.get('confirmed_date') == '2026-08-21' and
                    appt.get('confirmed_time') == '10:00'):
                    return print_result(True, f"Appointment updated to propose with new date/time")
                else:
                    return print_result(False, f"Appointment data incorrect: {appt}")
            else:
                return print_result(False, f"Response missing ok/appointment: {data}")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_7_update_appointment_restitue():
    """Test 7: Update appointment — mark restituted"""
    print_test(7, "Update appointment — mark restituted")
    try:
        if not CREATED_APPT_ID:
            return print_result(False, "No appointment ID from test 3")
        
        body = {
            "id": CREATED_APPT_ID,
            "status": "restitue"
        }
        
        resp = requests.post(f"{BASE_URL}/admin/caution-appointments/update", 
                            headers=ADMIN_HEADERS, 
                            json=body, 
                            timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('appointment'):
                appt = data['appointment']
                if appt.get('status') == 'restitue' and appt.get('restituted_at'):
                    return print_result(True, f"Appointment marked as restitue with restituted_at set")
                else:
                    return print_result(False, f"Appointment status or restituted_at incorrect: {appt}")
            else:
                return print_result(False, f"Response missing ok/appointment: {data}")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_8_update_invalid_status():
    """Test 8: Update with INVALID status"""
    print_test(8, "Update with INVALID status")
    try:
        if not CREATED_APPT_ID:
            return print_result(False, "No appointment ID from test 3")
        
        body = {
            "id": CREATED_APPT_ID,
            "status": "bogus"
        }
        
        resp = requests.post(f"{BASE_URL}/admin/caution-appointments/update", 
                            headers=ADMIN_HEADERS, 
                            json=body, 
                            timeout=10)
        
        if resp.status_code == 400:
            data = resp.json()
            if 'error' in data:
                return print_result(True, f"Invalid status correctly rejected with 400: {data['error']}")
            else:
                return print_result(True, "Invalid status correctly rejected with 400")
        else:
            return print_result(False, f"Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_9_update_non_admin():
    """Test 9: Update appointment — non-admin forbidden"""
    print_test(9, "Update appointment — non-admin forbidden")
    try:
        if not CREATED_APPT_ID:
            return print_result(False, "No appointment ID from test 3")
        
        body = {
            "id": CREATED_APPT_ID,
            "status": "confirme"
        }
        
        resp = requests.post(f"{BASE_URL}/admin/caution-appointments/update", 
                            headers=EXPOSANT_HEADERS, 
                            json=body, 
                            timeout=10)
        
        if resp.status_code == 403:
            data = resp.json()
            if 'error' in data:
                return print_result(True, f"Non-admin correctly rejected with 403: {data['error']}")
            else:
                return print_result(True, "Non-admin correctly rejected with 403")
        else:
            return print_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_10_alert_in_briefing():
    """Test 10: Alert in /api/dashboard/extended (smart_alerts)"""
    print_test(10, "Alert in /api/dashboard/extended (smart_alerts)")
    try:
        # First, create an appointment with status='demande' to trigger the alert
        # Get another registration
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return print_result(False, f"Failed to get registrations: {resp.status_code}")
        
        regs = resp.json()
        if len(regs) < 2:
            return print_result(False, "Need at least 2 registrations")
        
        # Use a different registration
        reg = regs[1] if len(regs) > 1 else regs[0]
        reg_id = reg['id']
        org_id = reg['organization']['id'] if reg.get('organization') else None
        
        # Create appointment via exposant endpoint to set status='demande'
        body = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "requested_date": "2026-08-19",
            "requested_time": "11:00"
        }
        
        resp = requests.post(f"{BASE_URL}/exposant/caution-appointment", 
                            headers=ADMIN_HEADERS,  # Using admin headers for simplicity
                            json=body, 
                            timeout=10)
        
        if resp.status_code != 200:
            print(f"Warning: Failed to create demande appointment: {resp.status_code}")
        
        # Now check /api/dashboard/extended for smart_alerts (correct endpoint)
        resp = requests.get(f"{BASE_URL}/dashboard/extended", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            smart_alerts = data.get('smart_alerts', [])
            found = False
            for alert in smart_alerts:
                if 'RDV de restitution caution' in alert.get('text', ''):
                    found = True
                    if alert.get('severity') == 'info' and alert.get('icon') == '🗓️':
                        return print_result(True, f"Alert found in smart_alerts: {alert['text']}")
                    else:
                        return print_result(False, f"Alert found but severity/icon incorrect: {alert}")
            
            if not found:
                return print_result(False, f"Alert not found in /api/dashboard/extended smart_alerts. Found {len(smart_alerts)} alerts total.")
        else:
            return print_result(False, f"Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

def test_11_cleanup():
    """Test 11: CLEANUP — delete test appointments"""
    print_test(11, "CLEANUP — delete test appointments")
    try:
        # Get all appointments with our test notes
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return print_result(False, f"Failed to get appointments: {resp.status_code}")
        
        appts = resp.json()
        deleted = 0
        
        for appt in appts:
            note = appt.get('admin_note', '')
            if 'Test admin E2E' in note or 'Reprogrammé' in note:
                # Mark as annule
                body = {
                    "id": appt['id'],
                    "status": "annule",
                    "admin_note": "Cleanup test"
                }
                resp = requests.post(f"{BASE_URL}/admin/caution-appointments/update", 
                                    headers=ADMIN_HEADERS, 
                                    json=body, 
                                    timeout=10)
                if resp.status_code == 200:
                    deleted += 1
        
        return print_result(True, f"Cleanup complete: {deleted} test appointments marked as annule")
    except Exception as e:
        return print_result(False, f"Exception: {e}")

# Global variables for test data
CREATED_APPT_ID = None
CREATED_REG_ID = None

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Admin Caution Appointments Management")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(test_1_list_appointments_admin())
    results.append(test_2_list_appointments_non_admin())
    results.append(test_3_create_appointment_admin())
    results.append(test_4_list_appointments_includes_new())
    results.append(test_5_list_with_status_filter())
    results.append(test_6_update_appointment_propose())
    results.append(test_7_update_appointment_restitue())
    results.append(test_8_update_invalid_status())
    results.append(test_9_update_non_admin())
    results.append(test_10_alert_in_briefing())
    results.append(test_11_cleanup())
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    passed = sum(results)
    total = len(results)
    print(f"Tests passed: {passed}/{total} ({passed*100//total}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
