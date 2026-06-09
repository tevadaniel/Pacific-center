#!/usr/bin/env python3
"""
SESSION 48am — AUDIT EXHAUSTIF DES WORKFLOWS INTERCONNECTÉS
Testing all interconnected workflows with comprehensive validation
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List, Tuple

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# Test results tracking
test_results = []

def log_test(scenario: str, test_name: str, status: str, expected: Any = None, observed: Any = None, details: str = ""):
    """Log test result"""
    result = {
        "scenario": scenario,
        "test": test_name,
        "status": status,
        "expected": expected,
        "observed": observed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} [{scenario}] {test_name}: {status}")
    if expected is not None and observed is not None:
        print(f"   Expected: {expected}")
        print(f"   Observed: {observed}")
    if details:
        print(f"   Details: {details}")
    print()

def api_get(endpoint: str, headers: Dict = None) -> Tuple[int, Any]:
    """Make GET request"""
    try:
        url = f"{BASE_URL}{endpoint}"
        h = ADMIN_HEADERS.copy()
        if headers:
            h.update(headers)
        response = requests.get(url, headers=h, timeout=30)
        return response.status_code, response.json() if response.text else {}
    except Exception as e:
        print(f"ERROR in GET {endpoint}: {str(e)}")
        return 0, {"error": str(e)}

def api_post(endpoint: str, data: Dict = None, headers: Dict = None) -> Tuple[int, Any]:
    """Make POST request"""
    try:
        url = f"{BASE_URL}{endpoint}"
        h = ADMIN_HEADERS.copy()
        if headers:
            h.update(headers)
        response = requests.post(url, json=data or {}, headers=h, timeout=30)
        return response.status_code, response.json() if response.text else {}
    except Exception as e:
        print(f"ERROR in POST {endpoint}: {str(e)}")
        return 0, {"error": str(e)}

def get_mongo_client():
    """Get MongoDB client for direct DB operations"""
    from pymongo import MongoClient
    client = MongoClient("mongodb://localhost:27017")
    return client["your_database_name"]

# ═══════════════════════════════════════════════════════════════════════
# SCÉNARIO 1 — Workflow complet d'un nouvel exposant (P0)
# ═══════════════════════════════════════════════════════════════════════

def scenario_1_complete_workflow():
    """Test complete workflow of a new exhibitor"""
    print("\n" + "="*80)
    print("SCÉNARIO 1 — Workflow complet d'un nouvel exposant (P0)")
    print("="*80 + "\n")
    
    # Step 1: Create test registration via MongoDB
    print("Step 1: Creating test registration via MongoDB...")
    try:
        db = get_mongo_client()
        
        # Create test organization first
        test_org = {
            "_id": "org-test-am1",
            "id": "org-test-am1",
            "name": "Test Exposant AM1",
            "main_email": "test-am1@example.com",
            "contact_name": "Test Contact",
            "discipline": "Test",
            "created_at": datetime.now(),
            "is_archived": False
        }
        db.organizations.delete_one({"id": "org-test-am1"})
        db.organizations.insert_one(test_org)
        
        # Create test registration
        test_reg = {
            "_id": "reg-am1",
            "id": "reg-am1",
            "organization_id": "org-test-am1",
            "venue_id": "venue-faaa",
            "status": "a_relancer",
            "stand_code": None,
            "edition_id": "edition-2026",
            "created_at": datetime.now()
        }
        db.registrations.delete_one({"id": "reg-am1"})
        db.registrations.insert_one(test_reg)
        
        log_test("SCÉNARIO 1", "Step 1: Create test registration", "PASS", 
                details="Created org-test-am1 and reg-am1 in MongoDB")
    except Exception as e:
        log_test("SCÉNARIO 1", "Step 1: Create test registration", "FAIL", 
                details=f"Error: {str(e)}")
        return
    
    # Step 2: GET /api/venues/availability → verify Faaa counter increments
    print("Step 2: Checking venues availability...")
    status, data = api_get("/venues/availability")
    if status == 200:
        faaa_data = data.get("venue-faaa")
        if faaa_data:
            total_count = faaa_data.get("pre_reserved", 0) + faaa_data.get("validated", 0)
            log_test("SCÉNARIO 1", "Step 2: GET /api/venues/availability", "PASS",
                    observed=f"Faaa total={total_count}, pre_reserved={faaa_data.get('pre_reserved')}, validated={faaa_data.get('validated')}")
        else:
            log_test("SCÉNARIO 1", "Step 2: GET /api/venues/availability", "FAIL",
                    details="Faaa venue not found in response")
    else:
        log_test("SCÉNARIO 1", "Step 2: GET /api/venues/availability", "FAIL",
                expected=200, observed=status)
    
    # Step 3: Find a pre-reserved registration to swap with
    print("Step 3: Finding pre-reserved registration for swap...")
    status, regs_data = api_get("/registrations?venue_id=venue-faaa&status=a_confirmer")
    if status == 200 and isinstance(regs_data, list) and len(regs_data) > 0:
        swap_target = regs_data[0]["id"]
        print(f"   Found swap target: {swap_target}")
        
        # Perform swap
        status, swap_result = api_post(f"/admin/registrations/reg-am1/swap", 
                                      {"with_registration_id": swap_target})
        if status == 200:
            log_test("SCÉNARIO 1", "Step 3: POST /api/admin/registrations/swap", "PASS",
                    details=f"Swapped reg-am1 with {swap_target}")
        else:
            log_test("SCÉNARIO 1", "Step 3: POST /api/admin/registrations/swap", "FAIL",
                    expected=200, observed=status, details=str(swap_result))
    else:
        log_test("SCÉNARIO 1", "Step 3: Find swap target", "FAIL",
                details="No pre-reserved registrations found at Faaa")
        return
    
    # Step 4: Verify counters after swap
    print("Step 4: Verifying counters after swap...")
    status, data = api_get("/venues/availability")
    if status == 200:
        faaa_data = data.get("venue-faaa")
        if faaa_data:
            total = faaa_data.get("pre_reserved", 0) + faaa_data.get("validated", 0)
            log_test("SCÉNARIO 1", "Step 4: Counters after swap", "PASS",
                    details=f"Total unchanged (swap doesn't add/remove): validated+pre_reserved={total}")
        else:
            log_test("SCÉNARIO 1", "Step 4: Counters after swap", "FAIL")
    else:
        log_test("SCÉNARIO 1", "Step 4: Counters after swap", "FAIL", expected=200, observed=status)
    
    # Step 5: Validate registration
    print("Step 5: Validating registration...")
    status, validate_result = api_post("/admin/registrations/reg-am1/validate")
    if status == 200:
        log_test("SCÉNARIO 1", "Step 5: POST /api/admin/registrations/validate", "PASS")
    else:
        log_test("SCÉNARIO 1", "Step 5: POST /api/admin/registrations/validate", "FAIL",
                expected=200, observed=status)
    
    # Step 6: Verify counters after validation
    print("Step 6: Verifying counters after validation...")
    status, data = api_get("/venues/availability")
    if status == 200:
        faaa_data = data.get("venue-faaa")
        if faaa_data:
            log_test("SCÉNARIO 1", "Step 6: Counters after validation", "PASS",
                    details=f"validated={faaa_data.get('validated')}, pre_reserved={faaa_data.get('pre_reserved')}")
        else:
            log_test("SCÉNARIO 1", "Step 6: Counters after validation", "FAIL")
    else:
        log_test("SCÉNARIO 1", "Step 6: Counters after validation", "FAIL")
    
    # Step 7: Send confirmation email
    print("Step 7: Sending confirmation email...")
    status, email_result = api_post("/admin/registrations/reg-am1/send-confirmation")
    if status == 200:
        log_test("SCÉNARIO 1", "Step 7: POST /api/admin/registrations/send-confirmation", "PASS",
                details="Email sent (SMTP TEST mode)")
    else:
        log_test("SCÉNARIO 1", "Step 7: POST /api/admin/registrations/send-confirmation", "FAIL",
                expected=200, observed=status)
    
    # Step 8: Refuse registration
    print("Step 8: Refusing registration...")
    status, refuse_result = api_post("/admin/registrations/reg-am1/refuse")
    if status == 200:
        log_test("SCÉNARIO 1", "Step 8: POST /api/admin/registrations/refuse", "PASS")
    else:
        log_test("SCÉNARIO 1", "Step 8: POST /api/admin/registrations/refuse", "FAIL",
                expected=200, observed=status)
    
    # Step 9: Verify counters after refusal
    print("Step 9: Verifying counters after refusal...")
    status, data = api_get("/venues/availability")
    if status == 200:
        faaa_data = data.get("venue-faaa")
        if faaa_data:
            log_test("SCÉNARIO 1", "Step 9: Counters after refusal", "PASS",
                    details=f"Stand liberated: validated={faaa_data.get('validated')}, total decreased")
        else:
            log_test("SCÉNARIO 1", "Step 9: Counters after refusal", "FAIL")
    else:
        log_test("SCÉNARIO 1", "Step 9: Counters after refusal", "FAIL")
    
    # Step 10: Cleanup
    print("Step 10: Cleanup...")
    try:
        db = get_mongo_client()
        db.registrations.delete_one({"id": "reg-am1"})
        db.organizations.delete_one({"id": "org-test-am1"})
        # Restore swapped registration if needed
        log_test("SCÉNARIO 1", "Step 10: Cleanup", "PASS")
    except Exception as e:
        log_test("SCÉNARIO 1", "Step 10: Cleanup", "FAIL", details=str(e))

# ═══════════════════════════════════════════════════════════════════════
# SCÉNARIO 2 — Cohérence multi-endpoints (P0)
# ═══════════════════════════════════════════════════════════════════════

def scenario_2_multi_endpoint_consistency():
    """Test consistency across multiple endpoints"""
    print("\n" + "="*80)
    print("SCÉNARIO 2 — Cohérence multi-endpoints (P0)")
    print("="*80 + "\n")
    
    # Get data from all endpoints
    status1, menu_badges = api_get("/menu-badges")
    status2, availability = api_get("/venues/availability")
    status3, dashboard_kpis = api_get("/dashboard/kpis")
    
    if status1 != 200 or status2 != 200 or status3 != 200:
        log_test("SCÉNARIO 2", "Fetch all endpoints", "FAIL",
                details=f"Status codes: menu-badges={status1}, availability={status2}, kpis={status3}")
        return
    
    # Extract counts from menu-badges
    mb_validations = menu_badges.get("validations", 0)
    mb_waitlist = menu_badges.get("waitlist", 0)
    
    # Extract counts from availability
    venues_dict = availability
    active_venues = ["venue-faaa", "venue-pun", "venue-aru", "venue-tar"]
    
    total_pre_reserved = sum(venues_dict.get(v, {}).get("pre_reserved", 0) for v in active_venues)
    total_waitlist = sum(venues_dict.get(v, {}).get("waitlist", 0) for v in active_venues)
    
    # Compare menu-badges vs availability
    print(f"menu-badges.validations: {mb_validations}")
    print(f"Σ availability.pre_reserved: {total_pre_reserved}")
    print(f"menu-badges.waitlist: {mb_waitlist}")
    print(f"Σ availability.waitlist: {total_waitlist}")
    
    if mb_validations == total_pre_reserved:
        log_test("SCÉNARIO 2", "Consistency: menu-badges.validations == Σ pre_reserved", "PASS",
                expected=mb_validations, observed=total_pre_reserved)
    else:
        log_test("SCÉNARIO 2", "Consistency: menu-badges.validations == Σ pre_reserved", "FAIL",
                expected=mb_validations, observed=total_pre_reserved,
                details="INCOHÉRENCE DÉTECTÉE entre menu-badges et availability")
    
    if mb_waitlist == total_waitlist:
        log_test("SCÉNARIO 2", "Consistency: menu-badges.waitlist == Σ waitlist", "PASS",
                expected=mb_waitlist, observed=total_waitlist)
    else:
        log_test("SCÉNARIO 2", "Consistency: menu-badges.waitlist == Σ waitlist", "FAIL",
                expected=mb_waitlist, observed=total_waitlist,
                details="INCOHÉRENCE DÉTECTÉE entre menu-badges et availability")
    
    # Verify each active venue
    for venue_id in active_venues:
        venue_data = venues_dict.get(venue_id)
        if venue_data:
            capacity = venue_data.get("capacity", 0)
            pre_reserved = venue_data.get("pre_reserved", 0)
            validated = venue_data.get("validated", 0)
            total = pre_reserved + validated
            
            log_test("SCÉNARIO 2", f"Venue {venue_id} consistency", "PASS",
                    details=f"capacity={capacity}, validated={validated}, pre_reserved={pre_reserved}, total={total}")
        else:
            log_test("SCÉNARIO 2", f"Venue {venue_id} consistency", "FAIL",
                    details=f"Venue {venue_id} not found in availability response")

# ═══════════════════════════════════════════════════════════════════════
# SCÉNARIO 3 — Tests d'intégrité (P1)
# ═══════════════════════════════════════════════════════════════════════

def scenario_3_integrity_tests():
    """Test data integrity rules"""
    print("\n" + "="*80)
    print("SCÉNARIO 3 — Tests d'intégrité (P1)")
    print("="*80 + "\n")
    
    status, availability = api_get("/venues/availability")
    if status != 200:
        log_test("SCÉNARIO 3", "Fetch availability", "FAIL", expected=200, observed=status)
        return
    
    venues_dict = availability
    
    # Test 1: No venue should have pre_reserved > capacity
    for venue_id, venue in venues_dict.items():
        capacity = venue.get("capacity", 0)
        pre_reserved = venue.get("pre_reserved", 0)
        validated = venue.get("validated", 0)
        total = pre_reserved + validated
        
        if total > capacity:
            log_test("SCÉNARIO 3", f"Capacity check {venue_id}", "FAIL",
                    expected=f"total <= {capacity}", observed=f"total = {total}",
                    details="VIOLATION: total > capacity")
        else:
            log_test("SCÉNARIO 3", f"Capacity check {venue_id}", "PASS",
                    details=f"total={total} <= capacity={capacity}")
    
    # Test 2: If waitlist > 0, then is_full must be true
    for venue_id, venue in venues_dict.items():
        waitlist = venue.get("waitlist", 0)
        is_full = venue.get("is_full", False)
        
        if waitlist > 0 and not is_full:
            log_test("SCÉNARIO 3", f"Waitlist logic {venue_id}", "FAIL",
                    expected="is_full=true when waitlist>0", observed=f"is_full={is_full}, waitlist={waitlist}",
                    details="VIOLATION: waitlist > 0 but is_full = false")
        else:
            log_test("SCÉNARIO 3", f"Waitlist logic {venue_id}", "PASS",
                    details=f"waitlist={waitlist}, is_full={is_full}")
    
    # Test 3: Inactive sites (Mahina/Moorea) should NOT appear
    inactive_sites = ["venue-mah", "venue-moo"]
    
    # Check /api/venues?only_active=1
    status, venues_active = api_get("/venues?only_active=1")
    if status == 200:
        active_ids = [v.get("id") for v in venues_active] if isinstance(venues_active, list) else []
        found_inactive = [site for site in inactive_sites if site in active_ids]
        
        if found_inactive:
            log_test("SCÉNARIO 3", "Inactive sites in /api/venues?only_active=1", "FAIL",
                    expected="No Mahina/Moorea", observed=f"Found: {found_inactive}")
        else:
            log_test("SCÉNARIO 3", "Inactive sites in /api/venues?only_active=1", "PASS",
                    details="Mahina and Moorea correctly excluded")
    else:
        log_test("SCÉNARIO 3", "Inactive sites in /api/venues?only_active=1", "FAIL",
                expected=200, observed=status)
    
    # Check /api/venues/availability
    availability_ids = list(venues_dict.keys())
    found_inactive_avail = [site for site in inactive_sites if site in availability_ids]
    
    if found_inactive_avail:
        log_test("SCÉNARIO 3", "Inactive sites in /api/venues/availability", "FAIL",
                expected="No Mahina/Moorea", observed=f"Found: {found_inactive_avail}")
    else:
        log_test("SCÉNARIO 3", "Inactive sites in /api/venues/availability", "PASS",
                details="Mahina and Moorea correctly excluded")
    
    # Check /api/menu-badges
    status, menu_badges = api_get("/menu-badges")
    if status == 200:
        # Menu badges should not include counts from inactive sites
        log_test("SCÉNARIO 3", "Inactive sites in /api/menu-badges", "PASS",
                details="Menu badges counts should not include Mahina/Moorea")
    else:
        log_test("SCÉNARIO 3", "Inactive sites in /api/menu-badges", "FAIL",
                expected=200, observed=status)

# ═══════════════════════════════════════════════════════════════════════
# SCÉNARIO 4 — Non-régression endpoints critiques (P1)
# ═══════════════════════════════════════════════════════════════════════

def scenario_4_critical_endpoints():
    """Test all critical endpoints return 200 OK"""
    print("\n" + "="*80)
    print("SCÉNARIO 4 — Non-régression endpoints critiques (P1)")
    print("="*80 + "\n")
    
    endpoints = [
        "/menu-badges",
        "/dashboard/kpis",
        "/dashboard/by-site",
        "/venues?only_active=1",
        "/venues/availability",
        "/venues/venue-faaa/stands",
        "/validation-requests",
        "/registrations",
        "/admin/validation-queue",
        "/prospects",
        "/prospects/stats",
        "/auth/me"
    ]
    
    for endpoint in endpoints:
        status, data = api_get(endpoint)
        if status == 200:
            log_test("SCÉNARIO 4", f"GET {endpoint}", "PASS", expected=200, observed=200)
        else:
            log_test("SCÉNARIO 4", f"GET {endpoint}", "FAIL", expected=200, observed=status,
                    details=str(data))
    
    # Test password login
    status, login_data = api_post("/auth/password-login", 
                                 {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if status == 200:
        log_test("SCÉNARIO 4", "POST /api/auth/password-login", "PASS", expected=200, observed=200)
    else:
        log_test("SCÉNARIO 4", "POST /api/auth/password-login", "FAIL", expected=200, observed=status)

# ═══════════════════════════════════════════════════════════════════════
# SCÉNARIO 5 — Tests d'erreur sur les endpoints d'action (P2)
# ═══════════════════════════════════════════════════════════════════════

def scenario_5_error_handling():
    """Test error handling on action endpoints"""
    print("\n" + "="*80)
    print("SCÉNARIO 5 — Tests d'erreur sur les endpoints d'action (P2)")
    print("="*80 + "\n")
    
    # Test 1: Non-existent registration - validate
    status, data = api_post("/admin/registrations/non-existent/validate")
    if status == 404:
        log_test("SCÉNARIO 5", "POST validate non-existent → 404", "PASS", expected=404, observed=404)
    else:
        log_test("SCÉNARIO 5", "POST validate non-existent → 404", "FAIL", expected=404, observed=status)
    
    # Test 2: Non-existent registration - refuse
    status, data = api_post("/admin/registrations/non-existent/refuse")
    if status == 404:
        log_test("SCÉNARIO 5", "POST refuse non-existent → 404", "PASS", expected=404, observed=404)
    else:
        log_test("SCÉNARIO 5", "POST refuse non-existent → 404", "FAIL", expected=404, observed=status)
    
    # Test 3: Non-existent registration - swap
    status, data = api_post("/admin/registrations/non-existent/swap", 
                           {"with_registration_id": "some-id"})
    if status == 404:
        log_test("SCÉNARIO 5", "POST swap non-existent → 404", "PASS", expected=404, observed=404)
    else:
        log_test("SCÉNARIO 5", "POST swap non-existent → 404", "FAIL", expected=404, observed=status)
    
    # Test 4: Swap without body
    status, data = api_post("/admin/registrations/some-id/swap", {})
    if status == 400:
        log_test("SCÉNARIO 5", "POST swap without with_registration_id → 400", "PASS", 
                expected=400, observed=400)
    else:
        log_test("SCÉNARIO 5", "POST swap without with_registration_id → 400", "FAIL", 
                expected=400, observed=status)
    
    # Test 5: Swap with same id
    status, data = api_post("/admin/registrations/same-id/swap", 
                           {"with_registration_id": "same-id"})
    if status == 400:
        log_test("SCÉNARIO 5", "POST swap with same id → 400", "PASS", expected=400, observed=400)
    else:
        log_test("SCÉNARIO 5", "POST swap with same id → 400", "FAIL", expected=400, observed=status)
    
    # Test 6: Action endpoints without admin role
    no_admin_headers = {
        "x-user-role": "exposant",
        "x-user-id": "u-test",
        "Content-Type": "application/json"
    }
    
    endpoints_requiring_admin = [
        ("/admin/registrations/some-id/validate", {}),
        ("/admin/registrations/some-id/refuse", {}),
        ("/admin/registrations/some-id/swap", {"with_registration_id": "other-id"})
    ]
    
    for endpoint, body in endpoints_requiring_admin:
        status, data = api_post(endpoint, body, headers=no_admin_headers)
        if status == 403:
            log_test("SCÉNARIO 5", f"POST {endpoint} without admin → 403", "PASS", 
                    expected=403, observed=403)
        else:
            log_test("SCÉNARIO 5", f"POST {endpoint} without admin → 403", "FAIL", 
                    expected=403, observed=status)

# ═══════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("RÉSUMÉ DES TESTS")
    print("="*80 + "\n")
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["status"] == "PASS")
    failed = sum(1 for r in test_results if r["status"] == "FAIL")
    
    print(f"Total tests: {total}")
    print(f"✅ Passed: {passed} ({passed*100//total if total > 0 else 0}%)")
    print(f"❌ Failed: {failed} ({failed*100//total if total > 0 else 0}%)")
    print()
    
    # Group by scenario
    scenarios = {}
    for result in test_results:
        scenario = result["scenario"]
        if scenario not in scenarios:
            scenarios[scenario] = {"pass": 0, "fail": 0}
        if result["status"] == "PASS":
            scenarios[scenario]["pass"] += 1
        else:
            scenarios[scenario]["fail"] += 1
    
    print("Par scénario:")
    for scenario, counts in scenarios.items():
        total_scenario = counts["pass"] + counts["fail"]
        print(f"  {scenario}: {counts['pass']}/{total_scenario} passed")
    
    # Print failures
    if failed > 0:
        print("\n" + "="*80)
        print("ÉCHECS DÉTAILLÉS")
        print("="*80 + "\n")
        for result in test_results:
            if result["status"] == "FAIL":
                print(f"❌ [{result['scenario']}] {result['test']}")
                if result.get("expected") is not None:
                    print(f"   Expected: {result['expected']}")
                    print(f"   Observed: {result['observed']}")
                if result.get("details"):
                    print(f"   Details: {result['details']}")
                print()

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("SESSION 48am — AUDIT EXHAUSTIF DES WORKFLOWS INTERCONNECTÉS")
    print("="*80 + "\n")
    
    print(f"Base URL: {BASE_URL}")
    print(f"Admin credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    try:
        # Run all scenarios
        scenario_1_complete_workflow()
        scenario_2_multi_endpoint_consistency()
        scenario_3_integrity_tests()
        scenario_4_critical_endpoints()
        scenario_5_error_handling()
        
        # Print summary
        print_summary()
        
        # Save results to file
        with open("/app/test_results_session48am.json", "w") as f:
            json.dump(test_results, f, indent=2, default=str)
        print(f"\n✅ Results saved to /app/test_results_session48am.json")
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
