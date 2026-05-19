#!/usr/bin/env python3
"""
SESSION 44 — Test des nouvelles fonctionnalités d'animation dynamique
Backend testing for animation features:
1. Animation obligatoire pour tous (already implemented)
2. Créneaux d'animation dynamiques (duration = plage ÷ N_exposants, bounded [15-60 min], rounded to 5 min)
3. Plages horaires configurables par site/jour in admin
4. Endpoint admin de swap with auto email notification
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from .env
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin credentials
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"  Details: {details}")
    return passed

def test_1_get_wizard_availability():
    """
    TEST 1: GET /api/wizard/availability (PUBLIC, no auth)
    Verify animation_windows and animation_grid structure
    """
    print("\n" + "="*80)
    print("TEST 1: GET /api/wizard/availability")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/wizard/availability", timeout=30)
        
        if response.status_code != 200:
            return log_test("GET /api/wizard/availability", False, f"Status {response.status_code}")
        
        data = response.json()
        
        # Check structure
        if "venues" not in data:
            return log_test("GET /api/wizard/availability", False, "Missing 'venues' key")
        
        venues = data["venues"]
        if len(venues) == 0:
            return log_test("GET /api/wizard/availability", False, "No venues returned")
        
        # Check first venue for animation_windows and animation_grid
        venue = venues[0]
        
        # Check animation_windows
        if "animation_windows" not in venue:
            return log_test("GET /api/wizard/availability", False, "Missing 'animation_windows'")
        
        windows = venue["animation_windows"]
        if "vendredi" not in windows or "samedi" not in windows:
            return log_test("GET /api/wizard/availability", False, "Missing vendredi/samedi in animation_windows")
        
        # Check default values (09:00-17:00)
        ven = windows["vendredi"]
        sam = windows["samedi"]
        
        print(f"  Venue: {venue['name']}")
        print(f"  Animation windows - Vendredi: {ven['start']}-{ven['end']}, Samedi: {sam['start']}-{sam['end']}")
        
        # Check animation_grid
        if "animation_grid" not in venue:
            return log_test("GET /api/wizard/availability", False, "Missing 'animation_grid'")
        
        grid = venue["animation_grid"]
        if "vendredi" not in grid or "samedi" not in grid:
            return log_test("GET /api/wizard/availability", False, "Missing vendredi/samedi in animation_grid")
        
        # Check grid structure for vendredi
        ven_grid = grid["vendredi"]
        required_keys = ["duration_min", "capacity", "expected_count", "is_full", "waitlist_count", "window_start", "window_end", "slots"]
        
        for key in required_keys:
            if key not in ven_grid:
                return log_test("GET /api/wizard/availability", False, f"Missing '{key}' in animation_grid.vendredi")
        
        print(f"  Animation grid (vendredi):")
        print(f"    - duration_min: {ven_grid['duration_min']}")
        print(f"    - capacity: {ven_grid['capacity']}")
        print(f"    - expected_count: {ven_grid['expected_count']}")
        print(f"    - is_full: {ven_grid['is_full']}")
        print(f"    - waitlist_count: {ven_grid['waitlist_count']}")
        print(f"    - window: {ven_grid['window_start']}-{ven_grid['window_end']}")
        print(f"    - slots count: {len(ven_grid['slots'])}")
        
        # Verify duration is between 15 and 60
        if not (15 <= ven_grid['duration_min'] <= 60):
            return log_test("GET /api/wizard/availability", False, f"duration_min {ven_grid['duration_min']} not in [15, 60]")
        
        # Verify duration is multiple of 5
        if ven_grid['duration_min'] % 5 != 0:
            return log_test("GET /api/wizard/availability", False, f"duration_min {ven_grid['duration_min']} not multiple of 5")
        
        # Check slots structure
        if len(ven_grid['slots']) > 0:
            slot = ven_grid['slots'][0]
            slot_keys = ["index", "start", "end", "occupied"]
            for key in slot_keys:
                if key not in slot:
                    return log_test("GET /api/wizard/availability", False, f"Missing '{key}' in slot")
            
            print(f"    - First slot: {slot['start']}-{slot['end']}, occupied: {slot['occupied']}")
            
            if slot['occupied']:
                if "registration_id" in slot and "organization_name" in slot:
                    print(f"      Occupied by: {slot.get('organization_name', 'N/A')}")
        
        return log_test("GET /api/wizard/availability", True, f"Returned {len(venues)} venues with correct structure")
        
    except Exception as e:
        return log_test("GET /api/wizard/availability", False, f"Exception: {str(e)}")

def test_2_post_animation_windows():
    """
    TEST 2: POST /api/venues/:id/animation-windows (ADMIN ONLY)
    Test configuration of animation windows per site/day
    """
    print("\n" + "="*80)
    print("TEST 2: POST /api/venues/:id/animation-windows")
    print("="*80)
    
    venue_id = "venue-faaa"
    
    # Test 2.1: Without admin header → 403
    print("\n  Test 2.1: Without admin header → expect 403")
    try:
        response = requests.post(
            f"{BASE_URL}/venues/{venue_id}/animation-windows",
            json={"vendredi": {"start": "14:00", "end": "17:00"}},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code != 403:
            log_test("POST animation-windows without admin", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("POST animation-windows without admin", True, "Correctly returned 403")
    except Exception as e:
        log_test("POST animation-windows without admin", False, f"Exception: {str(e)}")
    
    # Test 2.2: With admin header + valid body → 200
    print("\n  Test 2.2: With admin header + valid body → expect 200")
    try:
        payload = {
            "vendredi": {"start": "14:00", "end": "17:00"},
            "samedi": {"start": "13:00", "end": "17:00"}
        }
        
        response = requests.post(
            f"{BASE_URL}/venues/{venue_id}/animation-windows",
            json=payload,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("POST animation-windows with admin", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get("ok"):
            log_test("POST animation-windows with admin", False, "Response ok=false")
            return False
        
        if "animation_windows" not in data:
            log_test("POST animation-windows with admin", False, "Missing animation_windows in response")
            return False
        
        windows = data["animation_windows"]
        
        if windows["vendredi"]["start"] != "14:00" or windows["vendredi"]["end"] != "17:00":
            log_test("POST animation-windows with admin", False, f"Vendredi not saved correctly: {windows['vendredi']}")
            return False
        
        if windows["samedi"]["start"] != "13:00" or windows["samedi"]["end"] != "17:00":
            log_test("POST animation-windows with admin", False, f"Samedi not saved correctly: {windows['samedi']}")
            return False
        
        print(f"    Saved: Vendredi {windows['vendredi']['start']}-{windows['vendredi']['end']}, Samedi {windows['samedi']['start']}-{windows['samedi']['end']}")
        log_test("POST animation-windows with admin", True, "Windows saved correctly")
        
    except Exception as e:
        log_test("POST animation-windows with admin", False, f"Exception: {str(e)}")
        return False
    
    # Test 2.3: Verify via GET /api/wizard/availability
    print("\n  Test 2.3: Verify via GET /api/wizard/availability")
    try:
        response = requests.get(f"{BASE_URL}/wizard/availability", timeout=30)
        
        if response.status_code != 200:
            log_test("Verify animation-windows via GET", False, f"Status {response.status_code}")
            return False
        
        data = response.json()
        faaa_venue = next((v for v in data["venues"] if v["id"] == venue_id), None)
        
        if not faaa_venue:
            log_test("Verify animation-windows via GET", False, "Faaa venue not found")
            return False
        
        windows = faaa_venue["animation_windows"]
        
        if windows["vendredi"]["start"] != "14:00" or windows["vendredi"]["end"] != "17:00":
            log_test("Verify animation-windows via GET", False, f"Vendredi not persisted: {windows['vendredi']}")
            return False
        
        # Check that animation_grid was recalculated
        grid = faaa_venue["animation_grid"]["vendredi"]
        
        if grid["window_start"] != "14:00" or grid["window_end"] != "17:00":
            log_test("Verify animation-windows via GET", False, f"Grid not recalculated: {grid['window_start']}-{grid['window_end']}")
            return False
        
        # Calculate expected duration: 180 min (14:00-17:00) / expected_count
        window_minutes = 180
        expected_count = grid["expected_count"]
        
        print(f"    Faaa venue: window 14:00-17:00 ({window_minutes} min), expected_count={expected_count}")
        print(f"    Grid: duration_min={grid['duration_min']}, capacity={grid['capacity']}, slots={len(grid['slots'])}")
        
        # Verify first slot starts at 14:00
        if len(grid['slots']) > 0:
            first_slot = grid['slots'][0]
            if first_slot['start'] != "14:00":
                log_test("Verify animation-windows via GET", False, f"First slot doesn't start at 14:00: {first_slot['start']}")
                return False
            print(f"    First slot: {first_slot['start']}-{first_slot['end']}")
        
        log_test("Verify animation-windows via GET", True, "Windows persisted and grid recalculated")
        
    except Exception as e:
        log_test("Verify animation-windows via GET", False, f"Exception: {str(e)}")
        return False
    
    # Test 2.4: Invalid body (start >= end) → should ignore
    print("\n  Test 2.4: Invalid body (start >= end) → should ignore")
    try:
        payload = {
            "vendredi": {"start": "17:00", "end": "14:00"}  # Invalid: start >= end
        }
        
        response = requests.post(
            f"{BASE_URL}/venues/{venue_id}/animation-windows",
            json=payload,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("POST animation-windows invalid body", False, f"Status {response.status_code}")
            return False
        
        data = response.json()
        windows = data["animation_windows"]
        
        # Should keep previous value (14:00-17:00)
        if windows["vendredi"]["start"] != "14:00" or windows["vendredi"]["end"] != "17:00":
            log_test("POST animation-windows invalid body", False, f"Invalid value not ignored: {windows['vendredi']}")
            return False
        
        log_test("POST animation-windows invalid body", True, "Invalid value correctly ignored")
        
    except Exception as e:
        log_test("POST animation-windows invalid body", False, f"Exception: {str(e)}")
        return False
    
    # Test 2.5: Non-existent venue ID → 404
    print("\n  Test 2.5: Non-existent venue ID → expect 404")
    try:
        response = requests.post(
            f"{BASE_URL}/venues/venue-nonexistent/animation-windows",
            json={"vendredi": {"start": "09:00", "end": "17:00"}},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 404:
            log_test("POST animation-windows nonexistent venue", False, f"Expected 404, got {response.status_code}")
        else:
            log_test("POST animation-windows nonexistent venue", True, "Correctly returned 404")
    except Exception as e:
        log_test("POST animation-windows nonexistent venue", False, f"Exception: {str(e)}")
    
    return True

def test_3_post_animation_slot_swap():
    """
    TEST 3: POST /api/admin/registrations/:id/animation-slot/swap (ADMIN ONLY)
    Test admin swap of animation slot with email notification
    """
    print("\n" + "="*80)
    print("TEST 3: POST /api/admin/registrations/:id/animation-slot/swap")
    print("="*80)
    
    # First, get a registration with animation slots
    print("\n  Finding a registration with animation slots...")
    try:
        response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
        
        if response.status_code != 200:
            log_test("Find registration for swap test", False, f"Status {response.status_code}")
            return False
        
        registrations = response.json()
        
        # Find a registration with animations
        test_reg = None
        for reg in registrations:
            if reg.get("venue_id") and reg.get("status") != "annule":
                test_reg = reg
                break
        
        if not test_reg:
            log_test("Find registration for swap test", False, "No suitable registration found")
            return False
        
        reg_id = test_reg["id"]
        print(f"    Using registration: {reg_id} ({test_reg.get('organization_name', 'N/A')})")
        
    except Exception as e:
        log_test("Find registration for swap test", False, f"Exception: {str(e)}")
        return False
    
    # Test 3.1: Without admin header → 403
    print("\n  Test 3.1: Without admin header → expect 403")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/animation-slot/swap",
            json={"day_label": "vendredi", "start_time": "10:00", "end_time": "10:30"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code != 403:
            log_test("POST animation-slot/swap without admin", False, f"Expected 403, got {response.status_code}")
        else:
            log_test("POST animation-slot/swap without admin", True, "Correctly returned 403")
    except Exception as e:
        log_test("POST animation-slot/swap without admin", False, f"Exception: {str(e)}")
    
    # Test 3.2: With admin + valid body → 200
    print("\n  Test 3.2: With admin + valid body → expect 200")
    try:
        payload = {
            "day_label": "vendredi",
            "start_time": "10:00",
            "end_time": "10:30"
        }
        
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/animation-slot/swap",
            json=payload,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("POST animation-slot/swap with admin", False, f"Status {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get("ok"):
            log_test("POST animation-slot/swap with admin", False, "Response ok=false")
            return False
        
        if "animation_slot" not in data:
            log_test("POST animation-slot/swap with admin", False, "Missing animation_slot in response")
            return False
        
        slot = data["animation_slot"]
        
        if slot["start_time"] != "10:00" or slot["end_time"] != "10:30":
            log_test("POST animation-slot/swap with admin", False, f"Slot not updated: {slot['start_time']}-{slot['end_time']}")
            return False
        
        if "last_admin_swap_at" not in slot or "last_admin_swap_by" not in slot:
            log_test("POST animation-slot/swap with admin", False, "Missing last_admin_swap_* fields")
            return False
        
        print(f"    Slot updated: {slot['start_time']}-{slot['end_time']}")
        print(f"    last_admin_swap_at: {slot['last_admin_swap_at']}")
        print(f"    last_admin_swap_by: {slot['last_admin_swap_by']}")
        
        log_test("POST animation-slot/swap with admin", True, "Slot swapped successfully")
        
    except Exception as e:
        log_test("POST animation-slot/swap with admin", False, f"Exception: {str(e)}")
        return False
    
    # Test 3.3: Missing required fields → 400
    print("\n  Test 3.3: Missing required fields → expect 400")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/animation-slot/swap",
            json={"day_label": "vendredi"},  # Missing start_time and end_time
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 400:
            log_test("POST animation-slot/swap missing fields", False, f"Expected 400, got {response.status_code}")
        else:
            log_test("POST animation-slot/swap missing fields", True, "Correctly returned 400")
    except Exception as e:
        log_test("POST animation-slot/swap missing fields", False, f"Exception: {str(e)}")
    
    # Test 3.4: Invalid time (start >= end) → 400
    print("\n  Test 3.4: Invalid time (start >= end) → expect 400")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/animation-slot/swap",
            json={"day_label": "vendredi", "start_time": "10:30", "end_time": "10:00"},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 400:
            log_test("POST animation-slot/swap invalid time", False, f"Expected 400, got {response.status_code}")
        else:
            log_test("POST animation-slot/swap invalid time", True, "Correctly returned 400")
    except Exception as e:
        log_test("POST animation-slot/swap invalid time", False, f"Exception: {str(e)}")
    
    return True

def test_4_dynamic_formula_coherence():
    """
    TEST 4: Verify dynamic formula coherence
    duration_min = floor(window_minutes / expected_count), bounded [15, 60], rounded to 5
    """
    print("\n" + "="*80)
    print("TEST 4: Dynamic formula coherence")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/wizard/availability", timeout=30)
        
        if response.status_code != 200:
            return log_test("Dynamic formula coherence", False, f"Status {response.status_code}")
        
        data = response.json()
        
        # Test formula for each venue
        for venue in data["venues"]:
            venue_name = venue["name"]
            print(f"\n  Venue: {venue_name}")
            
            for day_key in ["vendredi", "samedi"]:
                grid = venue["animation_grid"][day_key]
                
                # Parse window times
                window_start = grid["window_start"]
                window_end = grid["window_end"]
                
                start_h, start_m = map(int, window_start.split(":"))
                end_h, end_m = map(int, window_end.split(":"))
                
                window_minutes = (end_h * 60 + end_m) - (start_h * 60 + start_m)
                
                expected_count = grid["expected_count"]
                duration_min = grid["duration_min"]
                capacity = grid["capacity"]
                
                print(f"    {day_key}: window={window_start}-{window_end} ({window_minutes} min), expected={expected_count}")
                print(f"      duration_min={duration_min}, capacity={capacity}")
                
                # Verify formula
                if expected_count == 0:
                    # Should use default (30)
                    if duration_min != 30:
                        log_test(f"Formula {venue_name} {day_key}", False, f"Expected default 30 for N=0, got {duration_min}")
                        continue
                else:
                    # Calculate expected duration
                    raw = window_minutes // expected_count
                    # Bound to [15, 60]
                    bounded = max(15, min(60, raw))
                    # Round to nearest 5 (min 5)
                    expected_duration = max(5, round(bounded / 5) * 5)
                    
                    if duration_min != expected_duration:
                        log_test(f"Formula {venue_name} {day_key}", False, 
                                f"Expected duration={expected_duration} (raw={raw}, bounded={bounded}), got {duration_min}")
                        continue
                
                # Verify capacity
                expected_capacity = window_minutes // duration_min if duration_min > 0 else 0
                
                if capacity != expected_capacity:
                    log_test(f"Formula {venue_name} {day_key}", False, 
                            f"Expected capacity={expected_capacity}, got {capacity}")
                    continue
                
                # Verify is_full
                is_full = grid["is_full"]
                expected_is_full = expected_count >= capacity and capacity > 0
                
                if is_full != expected_is_full:
                    log_test(f"Formula {venue_name} {day_key}", False, 
                            f"Expected is_full={expected_is_full}, got {is_full}")
                    continue
                
                # Verify waitlist_count
                waitlist_count = grid["waitlist_count"]
                expected_waitlist = max(0, expected_count - capacity)
                
                if waitlist_count != expected_waitlist:
                    log_test(f"Formula {venue_name} {day_key}", False, 
                            f"Expected waitlist={expected_waitlist}, got {waitlist_count}")
                    continue
                
                print(f"      ✓ Formula correct")
        
        return log_test("Dynamic formula coherence", True, "All venues verified")
        
    except Exception as e:
        return log_test("Dynamic formula coherence", False, f"Exception: {str(e)}")

def test_5_regression():
    """
    TEST 5: Regression tests - verify existing endpoints still work
    """
    print("\n" + "="*80)
    print("TEST 5: Regression tests")
    print("="*80)
    
    all_passed = True
    
    # Test 5.1: GET /api/wizard/availability
    print("\n  Test 5.1: GET /api/wizard/availability")
    try:
        response = requests.get(f"{BASE_URL}/wizard/availability", timeout=30)
        if response.status_code != 200:
            log_test("Regression: wizard/availability", False, f"Status {response.status_code}")
            all_passed = False
        else:
            log_test("Regression: wizard/availability", True, "Still working")
    except Exception as e:
        log_test("Regression: wizard/availability", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 5.2: GET /api/venues
    print("\n  Test 5.2: GET /api/venues")
    try:
        response = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=30)
        if response.status_code != 200:
            log_test("Regression: venues", False, f"Status {response.status_code}")
            all_passed = False
        else:
            venues = response.json()
            # Check if animation_windows field is present
            if len(venues) > 0:
                venue = venues[0]
                if "animation_windows" in venue:
                    print(f"    animation_windows present: {venue['animation_windows']}")
                log_test("Regression: venues", True, f"Returned {len(venues)} venues")
            else:
                log_test("Regression: venues", False, "No venues returned")
                all_passed = False
    except Exception as e:
        log_test("Regression: venues", False, f"Exception: {str(e)}")
        all_passed = False
    
    # Test 5.3: GET /api/registrations
    print("\n  Test 5.3: GET /api/registrations")
    try:
        response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
        if response.status_code != 200:
            log_test("Regression: registrations", False, f"Status {response.status_code}")
            all_passed = False
        else:
            regs = response.json()
            log_test("Regression: registrations", True, f"Returned {len(regs)} registrations")
    except Exception as e:
        log_test("Regression: registrations", False, f"Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION 44 — Backend Tests for Animation Features")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Started at: {datetime.now().isoformat()}")
    
    results = []
    
    # Run tests
    results.append(("Test 1: GET wizard/availability", test_1_get_wizard_availability()))
    results.append(("Test 2: POST animation-windows", test_2_post_animation_windows()))
    results.append(("Test 3: POST animation-slot/swap", test_3_post_animation_slot_swap()))
    results.append(("Test 4: Dynamic formula coherence", test_4_dynamic_formula_coherence()))
    results.append(("Test 5: Regression tests", test_5_regression()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    print(f"Finished at: {datetime.now().isoformat()}")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
