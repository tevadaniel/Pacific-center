#!/usr/bin/env python3
"""
SESSION 47.16 - Backend Testing for Waitlist Max 3 + Venue Filters + Anonymous Waitlist
Tests 3 critical changes applied at end of previous session
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# Exposant headers (for testing venue filters)
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-test-exposant",
    "Content-Type": "application/json"
}

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "total": 0,
    "details": []
}

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        print(f"✅ TEST {test_results['total']}: {test_name} - PASS")
    else:
        test_results["failed"] += 1
        print(f"❌ TEST {test_results['total']}: {test_name} - FAIL")
    
    if details:
        print(f"   Details: {details}")
    
    test_results["details"].append({
        "test": test_name,
        "passed": passed,
        "details": details
    })

def make_request(method: str, endpoint: str, headers: Optional[Dict] = None, data: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (status_code, response_json)"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=30)
        else:
            return (0, {"error": f"Unknown method {method}"})
        
        try:
            return (resp.status_code, resp.json())
        except:
            return (resp.status_code, {"text": resp.text})
    except Exception as e:
        return (0, {"error": str(e)})

def test_seed():
    """Test 1: Seed database with force=true"""
    print("\n=== TEST 1: Seed Database ===")
    status, data = make_request("POST", "/seed", headers=ADMIN_HEADERS, data={"force": True})
    
    if status == 200 and data.get("seeded") == True:
        associations = data.get("associations", 0)
        stands_planned = data.get("stands_planned", 0)
        log_test("Seed database", 
                 associations == 66 and stands_planned == 67,
                 f"seeded:true, associations:{associations}, stands_planned:{stands_planned}")
        return True
    else:
        log_test("Seed database", False, f"Status {status}, data: {data}")
        return False

def get_free_stand(venue_id: str = "venue-faaa") -> Optional[str]:
    """Get a free stand from a venue"""
    status, data = make_request("GET", f"/venues/{venue_id}/stands", headers=ADMIN_HEADERS)
    
    if status == 200 and isinstance(data, list):
        if len(data) > 0:
            return data[0].get("id")
    return None

def create_exposant(email: str, name: str, discipline: str = "Judo") -> Optional[Dict]:
    """Create a complete exposant through wizard steps"""
    print(f"\n--- Creating exposant: {name} ({email}) ---")
    
    # Step 1: Self-register
    status, data = make_request("POST", "/auth/self-register", data={"email": email})
    if status != 200 or not data.get("ok"):
        print(f"❌ Self-register failed: {status}, {data}")
        return None
    
    registration_id = data.get("registration_id")
    organization_id = data.get("organization_id")
    print(f"✓ Self-registered: reg_id={registration_id}, org_id={organization_id}")
    
    # Step 2: Profile
    profile_data = {
        "registration_id": registration_id,
        "profile": {
            "name": name,
            "discipline": discipline,
            "contact_name": name,
            "main_email": email,
            "representatives_count": 2
        }
    }
    status, data = make_request("POST", "/wizard/profile", data=profile_data)
    if status != 200 or not data.get("ok"):
        print(f"❌ Profile failed: {status}, {data}")
        return None
    print(f"✓ Profile completed: next_step={data.get('next_step')}")
    
    # Step 3: Days
    days_data = {
        "registration_id": registration_id,
        "venue_id": "venue-faaa",
        "attending_days": ["vendredi"],
        "attending_day_times": {
            "vendredi": {
                "start": "09:00",
                "end": "17:00"
            }
        }
    }
    status, data = make_request("POST", "/wizard/days", data=days_data)
    if status != 200 or not data.get("ok"):
        print(f"❌ Days failed: {status}, {data}")
        return None
    print(f"✓ Days completed")
    
    return {
        "registration_id": registration_id,
        "organization_id": organization_id,
        "email": email,
        "name": name
    }

def test_waitlist_max_3_wizard_stand():
    """Tests 2-6: Waitlist max 3 on /api/wizard/stand"""
    print("\n=== TESTS 2-6: Waitlist Max 3 on /api/wizard/stand ===")
    
    # Get a free stand
    free_stand = get_free_stand("venue-faaa")
    if not free_stand:
        log_test("Get free stand", False, "No free stand found")
        return None
    log_test("Get free stand", True, f"Found free stand: {free_stand}")
    
    # Test 2: Create exposant A and assign stand (should be pending)
    exp_a = create_exposant("expA47-16@test.local", "Exposant A", "Judo")
    if not exp_a:
        log_test("Create exposant A", False, "Failed to create exposant A")
        return None
    log_test("Create exposant A", True, f"Created {exp_a['name']}")
    
    # Test 3: Assign stand to A (should be pending, no conflict)
    stand_data_a = {
        "registration_id": exp_a["registration_id"],
        "venue_stand_id": free_stand
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_a)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        log_test("Stand A (free) - pending", 
                 request_status == "pending",
                 f"request_status={request_status}")
    else:
        log_test("Stand A (free) - pending", False, f"Status {status}, data: {data}")
        return None
    
    # Test 4: Create exposant B and add to waitlist position 1
    exp_b = create_exposant("expB47-16@test.local", "Exposant B", "Karate")
    if not exp_b:
        log_test("Create exposant B", False, "Failed to create exposant B")
        return None
    log_test("Create exposant B", True, f"Created {exp_b['name']}")
    
    # First try without force_waitlist (should get conflict info)
    stand_data_b = {
        "registration_id": exp_b["registration_id"],
        "venue_stand_id": free_stand
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_b)
    
    if status == 200 and data.get("ok") == False and data.get("conflict") == True:
        waitlist_count = data.get("waitlist_count")
        waitlist_position = data.get("waitlist_position")
        waitlist_max = data.get("waitlist_max")
        log_test("Stand B (conflict) - no force", 
                 waitlist_count == 0 and waitlist_position == 1 and waitlist_max == 3,
                 f"conflict=true, waitlist_count={waitlist_count}, waitlist_position={waitlist_position}, waitlist_max={waitlist_max}")
    else:
        log_test("Stand B (conflict) - no force", False, f"Status {status}, data: {data}")
    
    # Now with force_waitlist (should be waitlist position 1)
    stand_data_b_force = {
        "registration_id": exp_b["registration_id"],
        "venue_stand_id": free_stand,
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_b_force)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        waitlist_position = data.get("waitlist_position")
        log_test("Stand B (force_waitlist) - waitlist pos 1", 
                 request_status == "waitlist" and waitlist_position == 1,
                 f"request_status={request_status}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand B (force_waitlist) - waitlist pos 1", False, f"Status {status}, data: {data}")
        return None
    
    # Test 5: Create exposant C and add to waitlist position 2
    exp_c = create_exposant("expC47-16@test.local", "Exposant C", "Taekwondo")
    if not exp_c:
        log_test("Create exposant C", False, "Failed to create exposant C")
        return None
    log_test("Create exposant C", True, f"Created {exp_c['name']}")
    
    stand_data_c = {
        "registration_id": exp_c["registration_id"],
        "venue_stand_id": free_stand,
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_c)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        waitlist_position = data.get("waitlist_position")
        log_test("Stand C (force_waitlist) - waitlist pos 2", 
                 request_status == "waitlist" and waitlist_position == 2,
                 f"request_status={request_status}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand C (force_waitlist) - waitlist pos 2", False, f"Status {status}, data: {data}")
        return None
    
    # Test 6: Create exposant D and add to waitlist position 3
    exp_d = create_exposant("expD47-16@test.local", "Exposant D", "Natation")
    if not exp_d:
        log_test("Create exposant D", False, "Failed to create exposant D")
        return None
    log_test("Create exposant D", True, f"Created {exp_d['name']}")
    
    stand_data_d = {
        "registration_id": exp_d["registration_id"],
        "venue_stand_id": free_stand,
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_d)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        waitlist_position = data.get("waitlist_position")
        log_test("Stand D (force_waitlist) - waitlist pos 3", 
                 request_status == "waitlist" and waitlist_position == 3,
                 f"request_status={request_status}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand D (force_waitlist) - waitlist pos 3", False, f"Status {status}, data: {data}")
        return None
    
    # Test 7: Create exposant E and try to add to waitlist (should be REJECTED with waitlist_full)
    exp_e = create_exposant("expE47-16@test.local", "Exposant E", "Boxe")
    if not exp_e:
        log_test("Create exposant E", False, "Failed to create exposant E")
        return None
    log_test("Create exposant E", True, f"Created {exp_e['name']}")
    
    stand_data_e = {
        "registration_id": exp_e["registration_id"],
        "venue_stand_id": free_stand,
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_e)
    
    # CRITICAL TEST: Should return 200 with ok:false, conflict:true, waitlist_full:true
    if status == 200 and data.get("ok") == False and data.get("conflict") == True and data.get("waitlist_full") == True:
        waitlist_count = data.get("waitlist_count")
        waitlist_max = data.get("waitlist_max")
        message = data.get("message", "")
        log_test("Stand E (force_waitlist) - REJECTED waitlist_full", 
                 waitlist_count == 3 and waitlist_max == 3 and "complète" in message and "3 exposants" in message,
                 f"waitlist_full=true, waitlist_count={waitlist_count}, waitlist_max={waitlist_max}, message contains 'complète' and '3 exposants'")
    else:
        log_test("Stand E (force_waitlist) - REJECTED waitlist_full", False, 
                 f"Status {status}, expected ok:false + conflict:true + waitlist_full:true, got: {data}")
    
    return {
        "free_stand": free_stand,
        "exp_a": exp_a,
        "exp_b": exp_b,
        "exp_c": exp_c,
        "exp_d": exp_d,
        "exp_e": exp_e
    }

def test_waitlist_max_3_pre_reserve_stand(test_data):
    """Test 8: Waitlist max 3 on /api/registrations/:id/pre-reserve-stand"""
    print("\n=== TEST 8: Waitlist Max 3 on /api/registrations/:id/pre-reserve-stand ===")
    
    if not test_data:
        log_test("Pre-reserve-stand waitlist max 3", False, "No test data from previous tests")
        return
    
    free_stand = test_data["free_stand"]
    
    # Create exposant F
    exp_f = create_exposant("expF47-16@test.local", "Exposant F", "Escrime")
    if not exp_f:
        log_test("Create exposant F", False, "Failed to create exposant F")
        return
    log_test("Create exposant F", True, f"Created {exp_f['name']}")
    
    # Try to pre-reserve the same stand (already has 1 pending + 3 waitlist)
    # Should be REJECTED with waitlist_full
    status, data = make_request("POST", f"/registrations/{exp_f['registration_id']}/pre-reserve-stand", 
                               headers=ADMIN_HEADERS,
                               data={"stand_id": free_stand, "force_waitlist": True})
    
    # CRITICAL TEST: Should return 200 with ok:false, conflict:true, waitlist_full:true
    if status == 200 and data.get("ok") == False and data.get("conflict") == True and data.get("waitlist_full") == True:
        waitlist_count = data.get("waitlist_count")
        waitlist_max = data.get("waitlist_max")
        message = data.get("message", "")
        log_test("Pre-reserve-stand F - REJECTED waitlist_full", 
                 waitlist_count == 3 and waitlist_max == 3 and "complète" in message,
                 f"waitlist_full=true, waitlist_count={waitlist_count}, waitlist_max={waitlist_max}")
    else:
        log_test("Pre-reserve-stand F - REJECTED waitlist_full", False, 
                 f"Status {status}, expected ok:false + waitlist_full:true, got: {data}")

def test_venue_filter_only_active():
    """Tests 9-12: Venue filter only_active with exposant_visible"""
    print("\n=== TESTS 9-12: Venue Filter only_active + exposant_visible ===")
    
    # Test 9: GET /api/venues without filter (admin should see all 6 venues)
    status, data = make_request("GET", "/venues", headers=ADMIN_HEADERS)
    
    if status == 200 and isinstance(data, list):
        venue_count = len(data)
        mahina = next((v for v in data if v.get("id") == "venue-mah"), None)
        moorea = next((v for v in data if v.get("id") == "venue-moo"), None)
        
        mahina_visible = mahina.get("exposant_visible") if mahina else None
        moorea_visible = moorea.get("exposant_visible") if moorea else None
        
        log_test("GET /venues (admin, no filter) - all 6 venues", 
                 venue_count == 6 and mahina_visible == False and moorea_visible == False,
                 f"venues={venue_count}, Mahina exposant_visible={mahina_visible}, Moorea exposant_visible={moorea_visible}")
    else:
        log_test("GET /venues (admin, no filter) - all 6 venues", False, f"Status {status}, data: {data}")
    
    # Test 10: GET /api/venues?only_active=1 (admin should exclude Mahina and Moorea)
    status, data = make_request("GET", "/venues?only_active=1", headers=ADMIN_HEADERS)
    
    if status == 200 and isinstance(data, list):
        venue_count = len(data)
        venue_ids = [v.get("id") for v in data]
        has_mahina = "venue-mah" in venue_ids
        has_moorea = "venue-moo" in venue_ids
        
        log_test("GET /venues?only_active=1 (admin) - excludes Mahina/Moorea", 
                 venue_count == 4 and not has_mahina and not has_moorea,
                 f"venues={venue_count}, has_mahina={has_mahina}, has_moorea={has_moorea}, ids={venue_ids}")
    else:
        log_test("GET /venues?only_active=1 (admin) - excludes Mahina/Moorea", False, f"Status {status}, data: {data}")
    
    # Test 11: GET /api/venues?only_active=1 (exposant should also exclude Mahina/Moorea)
    status, data = make_request("GET", "/venues?only_active=1", headers=EXPOSANT_HEADERS)
    
    if status == 200 and isinstance(data, list):
        venue_count = len(data)
        venue_ids = [v.get("id") for v in data]
        has_mahina = "venue-mah" in venue_ids
        has_moorea = "venue-moo" in venue_ids
        
        log_test("GET /venues?only_active=1 (exposant) - excludes Mahina/Moorea", 
                 venue_count == 4 and not has_mahina and not has_moorea,
                 f"venues={venue_count}, has_mahina={has_mahina}, has_moorea={has_moorea}")
    else:
        log_test("GET /venues?only_active=1 (exposant) - excludes Mahina/Moorea", False, f"Status {status}, data: {data}")
    
    # Test 12: Toggle Faaa to exposant_visible=false, then verify only_active=1 excludes it
    status, data = make_request("POST", "/venues/venue-faaa/set-exposant-visible", 
                               headers=ADMIN_HEADERS,
                               data={"exposant_visible": False})
    
    if status == 200:
        log_test("Toggle Faaa exposant_visible=false", True, "Toggled successfully")
        
        # Verify only_active=1 now excludes Faaa
        time.sleep(0.5)
        status2, data2 = make_request("GET", "/venues?only_active=1", headers=ADMIN_HEADERS)
        
        if status2 == 200 and isinstance(data2, list):
            venue_count = len(data2)
            venue_ids = [v.get("id") for v in data2]
            has_faaa = "venue-faaa" in venue_ids
            
            log_test("GET /venues?only_active=1 after toggle - excludes Faaa", 
                     venue_count == 3 and not has_faaa,
                     f"venues={venue_count}, has_faaa={has_faaa}, ids={venue_ids}")
            
            # Re-toggle Faaa back to true to not break other tests
            status3, data3 = make_request("POST", "/venues/venue-faaa/set-exposant-visible", 
                                        headers=ADMIN_HEADERS,
                                        data={"exposant_visible": True})
            if status3 == 200:
                print("   ✓ Re-toggled Faaa back to exposant_visible=true")
            else:
                print(f"   ⚠️ Failed to re-toggle Faaa: {status3}")
        else:
            log_test("GET /venues?only_active=1 after toggle - excludes Faaa", False, f"Status {status2}")
    else:
        log_test("Toggle Faaa exposant_visible=false", False, f"Status {status}, data: {data}")

def test_non_regression():
    """Tests 13-15: Non-regression checks"""
    print("\n=== TESTS 13-15: Non-Regression Checks ===")
    
    # Test 13: GET /api/admin/validation-queue
    status, data = make_request("GET", "/admin/validation-queue", headers=ADMIN_HEADERS)
    
    if status == 200:
        items = data.get("items", [])
        log_test("GET /admin/validation-queue - non-regression", 
                 isinstance(items, list),
                 f"Status 200, items array present with {len(items)} items")
    else:
        log_test("GET /admin/validation-queue - non-regression", False, f"Status {status}")
    
    # Test 14: GET /api/menu-badges
    status, data = make_request("GET", "/menu-badges", headers=ADMIN_HEADERS)
    
    if status == 200:
        pending_validations = data.get("pending_validations")
        log_test("GET /api/menu-badges - non-regression", 
                 isinstance(pending_validations, int) or isinstance(pending_validations, float),
                 f"Status 200, pending_validations={pending_validations}")
    else:
        log_test("GET /api/menu-badges - non-regression", False, f"Status {status}")
    
    # Test 15: GET /api/wizard/availability?venue_id=venue-faaa
    status, data = make_request("GET", "/wizard/availability?venue_id=venue-faaa")
    
    if status == 200:
        venue = data.get("venue")
        stands = data.get("stands", [])
        log_test("GET /api/wizard/availability - non-regression", 
                 venue is not None and isinstance(stands, list),
                 f"Status 200, venue present, {len(stands)} stands")
    else:
        log_test("GET /api/wizard/availability - non-regression", False, f"Status {status}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY - SESSION 47.16 Waitlist Max 3 + Venue Filters + Anonymous Waitlist")
    print("="*80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Success Rate: {(test_results['passed']/test_results['total']*100):.1f}%")
    print("="*80)
    
    if test_results['failed'] > 0:
        print("\nFailed Tests:")
        for detail in test_results['details']:
            if not detail['passed']:
                print(f"  ❌ {detail['test']}")
                if detail['details']:
                    print(f"     {detail['details']}")

def main():
    """Main test execution"""
    print("="*80)
    print("SESSION 47.16 - Backend Testing for Waitlist Max 3 + Venue Filters")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Test 1: Seed
    if not test_seed():
        print("\n❌ CRITICAL: Seed failed, cannot continue tests")
        print_summary()
        return
    
    # Tests 2-7: Waitlist max 3 on /api/wizard/stand
    test_data = test_waitlist_max_3_wizard_stand()
    
    # Test 8: Waitlist max 3 on /api/registrations/:id/pre-reserve-stand
    test_waitlist_max_3_pre_reserve_stand(test_data)
    
    # Tests 9-12: Venue filter only_active with exposant_visible
    test_venue_filter_only_active()
    
    # Tests 13-15: Non-regression checks
    test_non_regression()
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
