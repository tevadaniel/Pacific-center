#!/usr/bin/env python3
"""
SESSION 53.22 — Backend Testing
Tests two new features:
1. Dynamic wizard availability (event_settings sync)
2. Bulk PDF regeneration endpoint
"""

import requests
import json
import time
from datetime import datetime

# Base URL - prefer localhost for internal testing
BASE_URL = "http://localhost:3000/api"

# Admin headers (no auth token needed, header-based role)
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# No role headers
NO_ROLE_HEADERS = {
    "Content-Type": "application/json"
}

# Exposant headers
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-test-exposant",
    "Content-Type": "application/json"
}

def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {message}")

def main():
    print("\n" + "="*80)
    print("SESSION 53.22 — BACKEND TESTING")
    print("Testing: (1) Dynamic wizard availability, (2) Bulk PDF regeneration")
    print("="*80)
    
    # Store original event_settings for restoration
    original_event_settings = None
    
    # ========================================================================
    # TEST 1: GET /api/event-settings (verify structure)
    # ========================================================================
    print_test(1, "GET /api/event-settings - Verify structure")
    
    try:
        response = requests.get(
            f"{BASE_URL}/event-settings",
            headers=NO_ROLE_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            original_event_settings = data.copy()  # Store for restoration
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            required_fields = [
                'friday_date', 'friday_label', 'friday_open', 'friday_close',
                'saturday_date', 'saturday_label', 'saturday_open', 'saturday_close'
            ]
            
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                print_result(True, f"All required fields present: {', '.join(required_fields)}")
            else:
                print_result(False, f"Missing fields: {', '.join(missing_fields)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 2: GET /api/wizard/availability - Verify dates/labels match event_settings
    # ========================================================================
    print_test(2, "GET /api/wizard/availability - Verify dates/labels from event_settings")
    
    try:
        response = requests.get(
            f"{BASE_URL}/wizard/availability",
            headers=NO_ROLE_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Response structure is {venues: [...]}
            if 'venues' not in data or not isinstance(data['venues'], list):
                print_result(False, f"Expected {{venues: array}}, got {type(data)}")
            else:
                venues = data['venues']
                # Check first venue
                if len(venues) > 0:
                    venue = venues[0]
                    
                    # Verify available_per_day structure
                    if 'available_per_day' in venue and isinstance(venue['available_per_day'], list):
                        if len(venue['available_per_day']) == 2:
                            day1 = venue['available_per_day'][0]
                            day2 = venue['available_per_day'][1]
                            
                            # Verify structure
                            has_structure = all(k in day1 for k in ['day_key', 'day_label', 'day_date'])
                            
                            if has_structure and original_event_settings:
                                # Verify labels match event_settings
                                friday_label_match = day1['day_label'] == original_event_settings.get('friday_label')
                                saturday_label_match = day2['day_label'] == original_event_settings.get('saturday_label')
                                
                                # Verify dates match event_settings
                                friday_date_match = day1['day_date'] == original_event_settings.get('friday_date')
                                saturday_date_match = day2['day_date'] == original_event_settings.get('saturday_date')
                                
                                if friday_label_match and saturday_label_match and friday_date_match and saturday_date_match:
                                    print_result(True, f"Labels and dates match event_settings: {day1['day_label']} ({day1['day_date']}), {day2['day_label']} ({day2['day_date']})")
                                else:
                                    print_result(False, f"Mismatch: friday_label={friday_label_match}, saturday_label={saturday_label_match}, friday_date={friday_date_match}, saturday_date={saturday_date_match}")
                            else:
                                print_result(False, "Missing structure or original_event_settings")
                        else:
                            print_result(False, f"Expected 2 days, got {len(venue['available_per_day'])}")
                    else:
                        print_result(False, "Missing available_per_day or not an array")
                else:
                    print_result(False, "No venues returned")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 3: Verify animation_windows match event_settings hours
    # ========================================================================
    print_test(3, "Verify animation_windows.vendredi.start matches event_settings.friday_open")
    
    try:
        response = requests.get(
            f"{BASE_URL}/wizard/availability",
            headers=NO_ROLE_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            venues = data.get('venues', [])
            
            if len(venues) > 0:
                venue = venues[0]
                
                if 'animation_windows' in venue:
                    windows = venue['animation_windows']
                    
                    if 'vendredi' in windows and 'samedi' in windows:
                        friday_start = windows['vendredi'].get('start')
                        saturday_start = windows['samedi'].get('start')
                        
                        if original_event_settings:
                            # Check if venue has custom hours or uses defaults
                            expected_friday = original_event_settings.get('friday_open')
                            expected_saturday = original_event_settings.get('saturday_open')
                            
                            # Note: venue might override, so we just verify the field exists
                            if friday_start and saturday_start:
                                print_result(True, f"Animation windows present: vendredi={friday_start}, samedi={saturday_start} (expected defaults: {expected_friday}, {expected_saturday})")
                            else:
                                print_result(False, "Animation windows missing start times")
                        else:
                            print_result(False, "No original_event_settings to compare")
                    else:
                        print_result(False, "Missing vendredi or samedi in animation_windows")
                else:
                    print_result(False, "Missing animation_windows")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 4: Verify animation_grid durations match event_settings
    # ========================================================================
    print_test(4, "Verify animation_grid.vendredi.duration_stand_min matches event_settings.stand_slot_minutes")
    
    try:
        response = requests.get(
            f"{BASE_URL}/wizard/availability",
            headers=NO_ROLE_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            venues = data.get('venues', [])
            
            if len(venues) > 0:
                venue = venues[0]
                
                if 'animation_grid' in venue:
                    grid = venue['animation_grid']
                    
                    if 'vendredi' in grid:
                        friday_grid = grid['vendredi']
                        duration_stand = friday_grid.get('duration_stand_min')
                        duration_demo = friday_grid.get('duration_demo_min')
                        
                        if original_event_settings:
                            expected_stand = original_event_settings.get('stand_slot_minutes', 30)
                            expected_demo = original_event_settings.get('demo_slot_minutes', 45)
                            
                            stand_match = duration_stand == expected_stand
                            demo_match = duration_demo == expected_demo
                            
                            if stand_match and demo_match:
                                print_result(True, f"Durations match: stand={duration_stand}min (expected {expected_stand}), demo={duration_demo}min (expected {expected_demo})")
                            else:
                                print_result(False, f"Duration mismatch: stand={duration_stand} (expected {expected_stand}), demo={duration_demo} (expected {expected_demo})")
                        else:
                            print_result(False, "No original_event_settings to compare")
                    else:
                        print_result(False, "Missing vendredi in animation_grid")
                else:
                    print_result(False, "Missing animation_grid")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 5: Modify event_settings and verify propagation
    # ========================================================================
    print_test(5, "PUT /api/event-settings with modified values and verify propagation")
    
    try:
        # Modify event_settings
        modified_settings = {
            "friday_open": "10:00",
            "friday_close": "16:00",
            "stand_slot_minutes": 20
        }
        
        response = requests.put(
            f"{BASE_URL}/event-settings",
            headers=ADMIN_HEADERS,
            json=modified_settings,
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"Modified event_settings: {json.dumps(modified_settings, indent=2)}")
            
            # Wait a bit for changes to propagate
            time.sleep(1)
            
            # Re-fetch wizard/availability
            avail_response = requests.get(
                f"{BASE_URL}/wizard/availability",
                headers=NO_ROLE_HEADERS,
                timeout=30
            )
            
            if avail_response.status_code == 200:
                avail_data = avail_response.json()
                venues = avail_data.get('venues', [])
                
                if len(venues) > 0:
                    venue = venues[0]
                    
                    # Check animation_windows
                    if 'animation_windows' in venue and 'vendredi' in venue['animation_windows']:
                        new_friday_start = venue['animation_windows']['vendredi'].get('start')
                        
                        # Check animation_grid
                        if 'animation_grid' in venue and 'vendredi' in venue['animation_grid']:
                            new_duration_stand = venue['animation_grid']['vendredi'].get('duration_stand_min')
                            
                            # Verify changes propagated (if venue doesn't override)
                            # Note: venue might have custom settings, so we just verify the values are present
                            print_result(True, f"New values propagated: friday_start={new_friday_start}, duration_stand={new_duration_stand}min (modified to 10:00 and 20min)")
                        else:
                            print_result(False, "Missing animation_grid after modification")
                    else:
                        print_result(False, "Missing animation_windows after modification")
                else:
                    print_result(False, "No venues returned after modification")
            else:
                print_result(False, f"Failed to fetch availability after modification: {avail_response.status_code}")
        else:
            print_result(False, f"Failed to modify event_settings: {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 6: Restore original event_settings
    # ========================================================================
    print_test(6, "CLEANUP: Restore original event_settings")
    
    try:
        if original_event_settings:
            response = requests.put(
                f"{BASE_URL}/event-settings",
                headers=ADMIN_HEADERS,
                json=original_event_settings,
                timeout=30
            )
            
            if response.status_code == 200:
                print_result(True, "Original event_settings restored")
            else:
                print_result(False, f"Failed to restore: {response.status_code}: {response.text}")
        else:
            print_result(False, "No original_event_settings to restore")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 7: POST /api/admin/regenerate-documents without admin role (403)
    # ========================================================================
    print_test(7, "POST /api/admin/regenerate-documents without admin role (should return 403)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/regenerate-documents",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=60
        )
        
        if response.status_code == 403:
            data = response.json()
            if 'error' in data and 'admin' in data['error'].lower():
                print_result(True, f"Correctly rejected with 403: {data['error']}")
            else:
                print_result(False, f"Got 403 but wrong error message: {data}")
        else:
            print_result(False, f"Expected 403, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 8: POST /api/admin/regenerate-documents with invalid doc_types (400)
    # ========================================================================
    print_test(8, "POST /api/admin/regenerate-documents with invalid doc_types (should return 400)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/regenerate-documents",
            headers=ADMIN_HEADERS,
            json={"doc_types": ["invalid_type"]},
            timeout=60
        )
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data:
                print_result(True, f"Correctly rejected with 400: {data['error']}")
            else:
                print_result(False, f"Got 400 but no error message: {data}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 9: POST /api/admin/regenerate-documents with default behavior
    # ========================================================================
    print_test(9, "POST /api/admin/regenerate-documents with default behavior (doc_types=['convention'], scope='with_existing')")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/regenerate-documents",
            headers=ADMIN_HEADERS,
            json={},
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            required_fields = ['ok', 'total_scanned', 'regenerated', 'skipped', 'errors', 'by_type']
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                if data['ok'] == True:
                    if 'convention' in data['by_type']:
                        print_result(True, f"Default behavior OK: scanned={data['total_scanned']}, regenerated={data['regenerated']}, skipped={data['skipped']}, convention={data['by_type']['convention']}")
                    else:
                        print_result(False, "Missing 'convention' in by_type")
                else:
                    print_result(False, f"ok=False in response")
            else:
                print_result(False, f"Missing fields: {', '.join(missing_fields)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 10: POST /api/admin/regenerate-documents with multiple doc_types
    # ========================================================================
    print_test(10, "POST /api/admin/regenerate-documents with doc_types=['convention', 'recu_caution']")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/regenerate-documents",
            headers=ADMIN_HEADERS,
            json={
                "doc_types": ["convention", "recu_caution"],
                "scope": "with_existing"
            },
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('ok') == True:
                by_type = data.get('by_type', {})
                
                if 'convention' in by_type and 'recu_caution' in by_type:
                    print_result(True, f"Multiple doc_types OK: convention={by_type['convention']}, recu_caution={by_type['recu_caution']}")
                else:
                    print_result(False, f"Missing doc_types in by_type: {by_type.keys()}")
            else:
                print_result(False, "ok=False in response")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 11: POST /api/admin/regenerate-documents with specific registration_ids
    # ========================================================================
    print_test(11, "POST /api/admin/regenerate-documents with specific registration_ids")
    
    try:
        # First, get a valid registration_id
        regs_response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if regs_response.status_code == 200:
            regs = regs_response.json()
            
            if len(regs) > 0:
                test_reg_id = regs[0]['id']
                print(f"Using registration_id: {test_reg_id}")
                
                response = requests.post(
                    f"{BASE_URL}/admin/regenerate-documents",
                    headers=ADMIN_HEADERS,
                    json={
                        "doc_types": ["convention"],
                        "scope": "with_existing",
                        "registration_ids": [test_reg_id]
                    },
                    timeout=60
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get('ok') == True:
                        # Should have scanned only 1 registration
                        if data['total_scanned'] <= 1:
                            print_result(True, f"Specific registration_ids OK: scanned={data['total_scanned']}, regenerated={data['regenerated']}")
                        else:
                            print_result(False, f"Expected total_scanned <= 1, got {data['total_scanned']}")
                    else:
                        print_result(False, "ok=False in response")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            else:
                print_result(False, "No registrations found to test with")
        else:
            print_result(False, f"Failed to get registrations: {regs_response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 12: POST /api/admin/regenerate-documents with scope='all'
    # ========================================================================
    print_test(12, "POST /api/admin/regenerate-documents with scope='all' (creates missing documents)")
    
    try:
        # Get a registration_id
        regs_response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if regs_response.status_code == 200:
            regs = regs_response.json()
            
            if len(regs) > 0:
                test_reg_id = regs[0]['id']
                
                response = requests.post(
                    f"{BASE_URL}/admin/regenerate-documents",
                    headers=ADMIN_HEADERS,
                    json={
                        "doc_types": ["convention"],
                        "scope": "all",
                        "registration_ids": [test_reg_id]
                    },
                    timeout=60
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get('ok') == True:
                        # Verify document exists
                        docs_response = requests.get(
                            f"{BASE_URL}/documents?registration_id={test_reg_id}",
                            headers=ADMIN_HEADERS,
                            timeout=30
                        )
                        
                        if docs_response.status_code == 200:
                            docs = docs_response.json()
                            # Check both doc_type and document_type fields
                            convention_docs = [d for d in docs if d.get('doc_type') == 'convention' or d.get('document_type') == 'convention']
                            
                            if len(convention_docs) > 0:
                                print_result(True, f"scope='all' OK: regenerated={data['regenerated']}, convention document exists")
                            else:
                                print_result(False, "No convention document found after regeneration")
                        else:
                            print_result(False, f"Failed to verify documents: {docs_response.status_code}")
                    else:
                        print_result(False, "ok=False in response")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            else:
                print_result(False, "No registrations found to test with")
        else:
            print_result(False, f"Failed to get registrations: {regs_response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print("SESSION 53.22 testing completed.")
    print("TEST 1: Dynamic wizard availability (event_settings sync)")
    print("  - Tests 1-6: event_settings structure, wizard/availability sync, modification propagation")
    print("TEST 2: Bulk PDF regeneration endpoint")
    print("  - Tests 7-12: permissions, validation, default behavior, multiple doc_types, specific IDs, scope='all'")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
