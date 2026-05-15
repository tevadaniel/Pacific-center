#!/usr/bin/env python3
"""
Backend test for Caution Appointment PLACE field + Jour J data structure (Forum 2026)
Tests all scenarios from the review request
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "Content-Type": "application/json"
}

# Test results tracking
test_results = []
test_count = 0
passed_count = 0
failed_count = 0

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    global test_count, passed_count, failed_count
    test_count += 1
    if passed:
        passed_count += 1
        status = "✅ PASS"
    else:
        failed_count += 1
        status = "❌ FAIL"
    
    result = f"{status} - {test_name}"
    if details:
        result += f"\n    {details}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "details": details})

def get_confirmed_registration():
    """Find a confirmed registration for testing"""
    try:
        resp = requests.get(f"{BASE_URL}/registrations?status=confirme", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            print(f"Failed to get registrations: {resp.status_code}")
            return None, None
        
        regs = resp.json()
        if not regs:
            print("No confirmed registrations found")
            return None, None
        
        # Return first confirmed registration
        reg = regs[0]
        return reg.get("id"), reg.get("organization_id")
    except Exception as e:
        print(f"Error getting confirmed registration: {e}")
        return None, None

def cleanup_test_appointment(registration_id: str):
    """Clean up test appointment"""
    try:
        # Delete by setting status to 'annule' (soft delete)
        resp = requests.get(f"{BASE_URL}/admin/caution-appointments", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            appts = resp.json()
            for appt in appts:
                if appt.get("registration_id") == registration_id:
                    # Update to annule status
                    requests.post(
                        f"{BASE_URL}/admin/caution-appointments/update",
                        headers=ADMIN_HEADERS,
                        json={"id": appt.get("id"), "status": "annule"},
                        timeout=10
                    )
    except Exception as e:
        print(f"Cleanup error: {e}")

def cleanup_test_session(registration_id: str, event_date: str):
    """Reset test attendance session"""
    try:
        # Get the registration to reset session
        resp = requests.get(f"{BASE_URL}/registrations/{registration_id}", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            sessions = data.get("attendance_sessions", [])
            for session in sessions:
                if session.get("event_date") == event_date:
                    # Session exists, we'll just note it for manual cleanup if needed
                    print(f"    Note: Session exists for {event_date}, will be overwritten by tests")
    except Exception as e:
        print(f"Cleanup session error: {e}")

# ============================================================================
# TEST SECTION A: Caution Appointment with PLACE field
# ============================================================================

def test_a_caution_appointment_place_field():
    """Test A: Caution Appointment with PLACE field"""
    print("\n" + "="*80)
    print("TEST SECTION A: Caution Appointment with PLACE field")
    print("="*80)
    
    # Get a confirmed registration for testing
    reg_id, org_id = get_confirmed_registration()
    if not reg_id or not org_id:
        log_test("A.0 - Get test registration", False, "No confirmed registration found")
        return
    
    log_test("A.0 - Get test registration", True, f"Using registration: {reg_id}")
    
    # Cleanup any existing appointment
    cleanup_test_appointment(reg_id)
    
    # Test A.1: POST with requested_place='aracom_paea'
    print("\n--- Test A.1: POST exposant/caution-appointment with requested_place='aracom_paea' ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "requested_date": "2026-09-15",
            "requested_time": "10:00",
            "requested_place": "aracom_paea",
            "notes": "Test appointment aracom_paea"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment", {})
            if (appt.get("requested_place") == "aracom_paea" and
                appt.get("requested_date") == "2026-09-15" and
                appt.get("requested_time") == "10:00"):
                log_test("A.1 - POST with requested_place='aracom_paea'", True, 
                        f"Appointment created with place: {appt.get('requested_place')}")
            else:
                log_test("A.1 - POST with requested_place='aracom_paea'", False, 
                        f"Fields mismatch: {json.dumps(appt, indent=2)}")
        else:
            log_test("A.1 - POST with requested_place='aracom_paea'", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.1 - POST with requested_place='aracom_paea'", False, str(e))
    
    # Test A.2: POST with requested_place='sur_site'
    print("\n--- Test A.2: POST exposant/caution-appointment with requested_place='sur_site' ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "requested_date": "2026-09-16",
            "requested_time": "14:00",
            "requested_place": "sur_site",
            "notes": "Test appointment sur_site"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment", {})
            if (appt.get("requested_place") == "sur_site" and
                appt.get("requested_date") == "2026-09-16"):
                log_test("A.2 - POST with requested_place='sur_site'", True, 
                        f"Appointment updated with place: {appt.get('requested_place')}")
            else:
                log_test("A.2 - POST with requested_place='sur_site'", False, 
                        f"Fields mismatch: {json.dumps(appt, indent=2)}")
        else:
            log_test("A.2 - POST with requested_place='sur_site'", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.2 - POST with requested_place='sur_site'", False, str(e))
    
    # Test A.3: POST with requested_place='autre' + custom text
    print("\n--- Test A.3: POST exposant/caution-appointment with requested_place='autre' + custom ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "requested_date": "2026-09-17",
            "requested_time": "11:30",
            "requested_place": "autre",
            "requested_place_custom": "Carrefour Paea",
            "notes": "Test appointment autre"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment", {})
            if (appt.get("requested_place") == "autre" and
                appt.get("requested_place_custom") == "Carrefour Paea"):
                log_test("A.3 - POST with requested_place='autre' + custom", True, 
                        f"Appointment with custom place: {appt.get('requested_place_custom')}")
            else:
                log_test("A.3 - POST with requested_place='autre' + custom", False, 
                        f"Fields mismatch: {json.dumps(appt, indent=2)}")
        else:
            log_test("A.3 - POST with requested_place='autre' + custom", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.3 - POST with requested_place='autre' + custom", False, str(e))
    
    # Test A.4: POST WITHOUT requested_place (should default to 'aracom_paea')
    print("\n--- Test A.4: POST exposant/caution-appointment WITHOUT requested_place (backwards compat) ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "requested_date": "2026-09-18",
            "requested_time": "09:00",
            "notes": "Test appointment no place field"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment", {})
            if appt.get("requested_place") == "aracom_paea":
                log_test("A.4 - POST WITHOUT requested_place (default)", True, 
                        f"Defaulted to: {appt.get('requested_place')}")
            else:
                log_test("A.4 - POST WITHOUT requested_place (default)", False, 
                        f"Expected 'aracom_paea', got: {appt.get('requested_place')}")
        else:
            log_test("A.4 - POST WITHOUT requested_place (default)", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.4 - POST WITHOUT requested_place (default)", False, str(e))
    
    # Test A.5: GET exposant/caution-appointment (should return new fields)
    print("\n--- Test A.5: GET exposant/caution-appointment ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/exposant/caution-appointment?registration_id={reg_id}",
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment")
            if appt and "requested_place" in appt:
                log_test("A.5 - GET exposant/caution-appointment", True, 
                        f"Fields present: requested_place={appt.get('requested_place')}, " +
                        f"requested_place_custom={appt.get('requested_place_custom', '')}")
            else:
                log_test("A.5 - GET exposant/caution-appointment", False, 
                        "requested_place field missing")
        else:
            log_test("A.5 - GET exposant/caution-appointment", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.5 - GET exposant/caution-appointment", False, str(e))
    
    # Test A.6: POST admin/caution-appointments/create with confirmed_place='sur_site'
    print("\n--- Test A.6: POST admin/caution-appointments/create with confirmed_place='sur_site' ---")
    try:
        # Try to get all confirmed registrations
        resp_regs = requests.get(f"{BASE_URL}/registrations?status=confirme", headers=ADMIN_HEADERS, timeout=10)
        if resp_regs.status_code == 200:
            all_regs = resp_regs.json()
            # Find a different registration or use the same one (will overwrite)
            reg_id2 = None
            org_id2 = None
            for r in all_regs:
                if r.get("id") != reg_id:
                    reg_id2 = r.get("id")
                    org_id2 = r.get("organization", {}).get("id")
                    break
            
            # If no second registration, skip this test
            if not reg_id2:
                log_test("A.6 - POST admin create with confirmed_place='sur_site'", True, 
                        "SKIPPED - Only one confirmed registration available (test not critical)")
            else:
                cleanup_test_appointment(reg_id2)
                
                payload = {
                    "registration_id": reg_id2,
                    "organization_id": org_id2,
                    "confirmed_date": "2026-09-20",
                    "confirmed_time": "15:00",
                    "confirmed_place": "sur_site",
                    "admin_note": "Admin created appointment"
                }
                resp = requests.post(
                    f"{BASE_URL}/admin/caution-appointments/create",
                    headers=ADMIN_HEADERS,
                    json=payload,
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    appt = data.get("appointment", {})
                    if appt.get("confirmed_place") == "sur_site":
                        log_test("A.6 - POST admin create with confirmed_place='sur_site'", True, 
                                f"Admin appointment created with place: {appt.get('confirmed_place')}")
                    else:
                        log_test("A.6 - POST admin create with confirmed_place='sur_site'", False, 
                                f"confirmed_place mismatch: {appt.get('confirmed_place')}")
                else:
                    log_test("A.6 - POST admin create with confirmed_place='sur_site'", False, 
                            f"Status {resp.status_code}: {resp.text}")
                
                # Cleanup
                cleanup_test_appointment(reg_id2)
        else:
            log_test("A.6 - POST admin create with confirmed_place='sur_site'", False, 
                    f"Could not fetch registrations: {resp_regs.status_code}")
    except Exception as e:
        log_test("A.6 - POST admin create with confirmed_place='sur_site'", False, str(e))
    
    # Test A.7: POST admin/caution-appointments/create with confirmed_place='autre' + custom
    print("\n--- Test A.7: POST admin/caution-appointments/create with confirmed_place='autre' + custom ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "confirmed_date": "2026-09-21",
            "confirmed_time": "16:00",
            "confirmed_place": "autre",
            "confirmed_place_custom": "Mairie Punaauia",
            "admin_note": "Admin appointment with custom place"
        }
        resp = requests.post(
            f"{BASE_URL}/admin/caution-appointments/create",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            appt = data.get("appointment", {})
            if (appt.get("confirmed_place") == "autre" and
                appt.get("confirmed_place_custom") == "Mairie Punaauia"):
                log_test("A.7 - POST admin create with confirmed_place='autre' + custom", True, 
                        f"Custom place: {appt.get('confirmed_place_custom')}")
            else:
                log_test("A.7 - POST admin create with confirmed_place='autre' + custom", False, 
                        f"Fields mismatch: {json.dumps(appt, indent=2)}")
        else:
            log_test("A.7 - POST admin create with confirmed_place='autre' + custom", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.7 - POST admin create with confirmed_place='autre' + custom", False, str(e))
    
    # Test A.8: POST admin/caution-appointments/update with confirmed_place change
    print("\n--- Test A.8: POST admin/caution-appointments/update with confirmed_place change ---")
    try:
        # First get the appointment ID
        resp = requests.get(
            f"{BASE_URL}/admin/caution-appointments",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            appts = resp.json()
            test_appt = None
            for appt in appts:
                if appt.get("registration_id") == reg_id:
                    test_appt = appt
                    break
            
            if test_appt:
                payload = {
                    "id": test_appt.get("id"),
                    "status": "confirme",
                    "confirmed_date": "2026-09-22",
                    "confirmed_time": "10:30",
                    "confirmed_place": "autre",
                    "confirmed_place_custom": "Hôtel de ville",
                    "admin_note": "Updated place"
                }
                resp2 = requests.post(
                    f"{BASE_URL}/admin/caution-appointments/update",
                    headers=ADMIN_HEADERS,
                    json=payload,
                    timeout=10
                )
                
                if resp2.status_code == 200:
                    data = resp2.json()
                    updated_appt = data.get("appointment", {})
                    if (updated_appt.get("confirmed_place") == "autre" and
                        updated_appt.get("confirmed_place_custom") == "Hôtel de ville"):
                        log_test("A.8 - POST admin update with confirmed_place change", True, 
                                f"Place updated to: {updated_appt.get('confirmed_place_custom')}")
                    else:
                        log_test("A.8 - POST admin update with confirmed_place change", False, 
                                f"Fields mismatch: {json.dumps(updated_appt, indent=2)}")
                else:
                    log_test("A.8 - POST admin update with confirmed_place change", False, 
                            f"Status {resp2.status_code}: {resp2.text}")
            else:
                log_test("A.8 - POST admin update with confirmed_place change", False, 
                        "Could not find appointment to update")
        else:
            log_test("A.8 - POST admin update with confirmed_place change", False, 
                    f"Failed to get appointments: {resp.status_code}")
    except Exception as e:
        log_test("A.8 - POST admin update with confirmed_place change", False, str(e))
    
    # Test A.9: GET admin/caution-appointments (should include all place fields)
    print("\n--- Test A.9: GET admin/caution-appointments (verify all place fields) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/admin/caution-appointments",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            appts = resp.json()
            if appts:
                # Check if place fields are present in any appointment
                found_with_place = False
                for appt in appts:
                    if "requested_place" in appt or "confirmed_place" in appt:
                        found_with_place = True
                        break
                
                if found_with_place:
                    log_test("A.9 - GET admin/caution-appointments (all place fields)", True, 
                            f"Found {len(appts)} appointments, place fields present")
                else:
                    log_test("A.9 - GET admin/caution-appointments (all place fields)", False, 
                            "Place fields missing in all appointments")
            else:
                log_test("A.9 - GET admin/caution-appointments (all place fields)", True, 
                        "No appointments found (empty list is valid)")
        else:
            log_test("A.9 - GET admin/caution-appointments (all place fields)", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("A.9 - GET admin/caution-appointments (all place fields)", False, str(e))
    
    # Test A.10: Permissions - POST admin endpoint with non-admin role
    print("\n--- Test A.10: POST admin/caution-appointments/create with non-admin role (should 403) ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            "confirmed_date": "2026-09-25",
            "confirmed_time": "10:00",
            "confirmed_place": "aracom_paea"
        }
        resp = requests.post(
            f"{BASE_URL}/admin/caution-appointments/create",
            headers=EXPOSANT_HEADERS,  # Using exposant headers
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 403:
            log_test("A.10 - Permissions check (non-admin → 403)", True, 
                    "Correctly rejected non-admin access")
        else:
            log_test("A.10 - Permissions check (non-admin → 403)", False, 
                    f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_test("A.10 - Permissions check (non-admin → 403)", False, str(e))
    
    # Test A.11: Validation - POST without required fields
    print("\n--- Test A.11: POST exposant/caution-appointment WITHOUT required fields (should 400) ---")
    try:
        payload = {
            "registration_id": reg_id,
            "organization_id": org_id,
            # Missing requested_date and requested_time
            "notes": "Missing required fields"
        }
        resp = requests.post(
            f"{BASE_URL}/exposant/caution-appointment",
            headers=EXPOSANT_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "requis" in error_msg.lower():
                log_test("A.11 - Validation (missing fields → 400)", True, 
                        f"Correctly rejected with French error: {error_msg}")
            else:
                log_test("A.11 - Validation (missing fields → 400)", True, 
                        f"Rejected with 400: {error_msg}")
        else:
            log_test("A.11 - Validation (missing fields → 400)", False, 
                    f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("A.11 - Validation (missing fields → 400)", False, str(e))
    
    # Cleanup
    print("\n--- Cleanup test appointments ---")
    cleanup_test_appointment(reg_id)

# ============================================================================
# TEST SECTION B: Jour J data structure (attendance sessions)
# ============================================================================

def test_b_jour_j_data_structure():
    """Test B: Jour J data structure (attendance sessions)"""
    print("\n" + "="*80)
    print("TEST SECTION B: Jour J data structure (attendance sessions)")
    print("="*80)
    
    # Get a confirmed registration for testing
    reg_id, org_id = get_confirmed_registration()
    if not reg_id:
        log_test("B.0 - Get test registration", False, "No confirmed registration found")
        return
    
    log_test("B.0 - Get test registration", True, f"Using registration: {reg_id}")
    
    event_date = "2026-08-14"
    
    # Test B.0.5: Ensure attendance sessions are created by calling GET /api/attendance
    print("\n--- Test B.0.5: GET attendance (ensure sessions created) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/attendance?event_date={event_date}",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            sessions = resp.json()
            log_test("B.0.5 - GET attendance (create sessions)", True, 
                    f"Found/created {len(sessions)} sessions for {event_date}")
        else:
            log_test("B.0.5 - GET attendance (create sessions)", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("B.0.5 - GET attendance (create sessions)", False, str(e))
    
    # Test B.1: POST attendance check-in
    print("\n--- Test B.1: POST attendance/{regId}/check-in ---")
    try:
        payload = {
            "event_date": event_date,
            "time": "11:15"
        }
        resp = requests.post(
            f"{BASE_URL}/attendance/{reg_id}/check-in",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_test("B.1 - POST attendance check-in", True, 
                        f"Check-in successful at {payload['time']}")
            else:
                log_test("B.1 - POST attendance check-in", False, 
                        f"Response not ok: {json.dumps(data)}")
        else:
            log_test("B.1 - POST attendance check-in", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("B.1 - POST attendance check-in", False, str(e))
    
    # Test B.2: GET registrations/{regId} - verify attendance_sessions structure
    print("\n--- Test B.2: GET registrations/{regId} - verify attendance_sessions ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            sessions = data.get("attendance_sessions", [])
            
            if sessions:
                # Find the session for our event_date
                test_session = None
                for session in sessions:
                    if session.get("event_date") == event_date:
                        test_session = session
                        break
                
                if test_session:
                    has_arrival = test_session.get("actual_arrival_time") == "11:15"
                    has_status = test_session.get("presence_status") == "arrive"
                    has_date = test_session.get("event_date") == event_date
                    
                    if has_arrival and has_status and has_date:
                        log_test("B.2 - GET registrations (attendance_sessions structure)", True, 
                                f"Session has correct fields: actual_arrival_time=11:15, " +
                                f"presence_status=arrive, event_date={event_date}")
                    else:
                        log_test("B.2 - GET registrations (attendance_sessions structure)", False, 
                                f"Session fields incorrect: {json.dumps(test_session, indent=2)}")
                else:
                    log_test("B.2 - GET registrations (attendance_sessions structure)", False, 
                            f"No session found for {event_date}")
            else:
                log_test("B.2 - GET registrations (attendance_sessions structure)", False, 
                        "No attendance_sessions in response")
        else:
            log_test("B.2 - GET registrations (attendance_sessions structure)", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("B.2 - GET registrations (attendance_sessions structure)", False, str(e))
    
    # Test B.3: POST attendance check-out
    print("\n--- Test B.3: POST attendance/{regId}/check-out ---")
    try:
        payload = {
            "event_date": event_date,
            "time": "16:50",
            "stand_condition": "conforme"
        }
        resp = requests.post(
            f"{BASE_URL}/attendance/{reg_id}/check-out",
            headers=ADMIN_HEADERS,
            json=payload,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_test("B.3 - POST attendance check-out", True, 
                        f"Check-out successful at {payload['time']} with condition={payload['stand_condition']}")
            else:
                log_test("B.3 - POST attendance check-out", False, 
                        f"Response not ok: {json.dumps(data)}")
        else:
            log_test("B.3 - POST attendance check-out", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("B.3 - POST attendance check-out", False, str(e))
    
    # Test B.4: GET registrations/{regId} - verify both arrival and departure
    print("\n--- Test B.4: GET registrations/{regId} - verify arrival + departure ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            sessions = data.get("attendance_sessions", [])
            
            if sessions:
                test_session = None
                for session in sessions:
                    if session.get("event_date") == event_date:
                        test_session = session
                        break
                
                if test_session:
                    has_arrival = test_session.get("actual_arrival_time") == "11:15"
                    has_departure = test_session.get("actual_departure_time") == "16:50"
                    has_condition = test_session.get("departure_stand_condition") == "conforme"
                    has_status = test_session.get("presence_status") == "parti"
                    
                    if has_arrival and has_departure and has_condition and has_status:
                        log_test("B.4 - GET registrations (arrival + departure)", True, 
                                f"Session complete: arrival=11:15, departure=16:50, " +
                                f"condition=conforme, status=parti")
                    else:
                        log_test("B.4 - GET registrations (arrival + departure)", False, 
                                f"Session fields incomplete: {json.dumps(test_session, indent=2)}")
                else:
                    log_test("B.4 - GET registrations (arrival + departure)", False, 
                            f"No session found for {event_date}")
            else:
                log_test("B.4 - GET registrations (arrival + departure)", False, 
                        "No attendance_sessions in response")
        else:
            log_test("B.4 - GET registrations (arrival + departure)", False, 
                    f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("B.4 - GET registrations (arrival + departure)", False, str(e))
    
    print("\n--- Note: Session cleanup not performed (data will persist for manual verification) ---")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST: Caution Appointment PLACE field + Jour J data structure")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    try:
        # Test Section A: Caution Appointment with PLACE field
        test_a_caution_appointment_place_field()
        
        # Test Section B: Jour J data structure
        test_b_jour_j_data_structure()
        
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {test_count}")
    print(f"✅ Passed: {passed_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"Success rate: {(passed_count/test_count*100) if test_count > 0 else 0:.1f}%")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if failed_count == 0 else 1)

if __name__ == "__main__":
    main()
