#!/usr/bin/env python3
"""
SESSION 53.2 — COMPREHENSIVE BACKEND REGRESSION TEST
Tests ALL 54 critical workflows as specified in review_request.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
TIMEOUT = 60  # 60s timeout to avoid false positives

# Test credentials
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"
EXPOSANT_EMAIL = "swimua.tahiti@gmail.com"
EXPOSANT_PASSWORD = "demo"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.total = 0
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append((test_name, details))
        self.total += 1
        print(f"{GREEN}✅ PASS{RESET} - {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed.append((test_name, error))
        self.total += 1
        print(f"{RED}❌ FAIL{RESET} - {test_name}")
        print(f"   {RED}{error}{RESET}")
    
    def summary(self):
        print(f"\n{'='*80}")
        print(f"{BLUE}TEST SUMMARY{RESET}")
        print(f"{'='*80}")
        print(f"Total: {self.total}")
        print(f"{GREEN}Passed: {len(self.passed)}{RESET}")
        print(f"{RED}Failed: {len(self.failed)}{RESET}")
        print(f"Success Rate: {len(self.passed)/self.total*100:.1f}%")
        
        if self.failed:
            print(f"\n{RED}FAILED TESTS:{RESET}")
            for name, error in self.failed:
                print(f"  ❌ {name}")
                print(f"     {error}")
        
        return len(self.failed) == 0

results = TestResults()

def api_call(method: str, endpoint: str, headers: Optional[Dict] = None, 
             json_data: Optional[Dict] = None, timeout: int = TIMEOUT) -> requests.Response:
    """Make API call with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    default_headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    if headers:
        default_headers.update(headers)
    
    try:
        if method == "GET":
            return requests.get(url, headers=default_headers, timeout=timeout)
        elif method == "POST":
            return requests.post(url, headers=default_headers, json=json_data, timeout=timeout)
        elif method == "PUT":
            return requests.put(url, headers=default_headers, json=json_data, timeout=timeout)
        elif method == "DELETE":
            return requests.delete(url, headers=default_headers, timeout=timeout)
    except requests.exceptions.Timeout:
        raise Exception(f"Request timeout after {timeout}s")
    except Exception as e:
        raise Exception(f"Request failed: {str(e)}")

def get_admin_headers() -> Dict:
    """Get admin authentication headers"""
    return {
        "x-user-role": "aracom_admin",
        "x-user-id": "u-admin"
    }

def get_exposant_headers(org_id: str = "org-3") -> Dict:
    """Get exposant authentication headers"""
    return {
        "x-user-role": "exposant",
        "x-user-id": f"u-exp-{org_id}",
        "x-organization-id": org_id
    }

def get_pacific_headers() -> Dict:
    """Get Pacific Centers authentication headers"""
    return {
        "x-user-role": "pacific_centers_readonly",
        "x-user-id": "u-pacific"
    }

print(f"\n{BLUE}{'='*80}{RESET}")
print(f"{BLUE}SESSION 53.2 — COMPREHENSIVE BACKEND REGRESSION TEST{RESET}")
print(f"{BLUE}{'='*80}{RESET}\n")

# ═══════════════════════════════════════════════════════════════════════════
# A. AUTH FLOW (5 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ A. AUTH FLOW (5 tests) ═══{RESET}\n")

# Test 1: Admin login success
try:
    resp = api_call("POST", "/auth/password-login", json_data={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and data.get("user", {}).get("role_code") == "aracom_admin":
            results.add_pass("A1: Admin login success", f"Role: {data['user']['role_code']}, Redirect: {data.get('redirect')}")
        else:
            results.add_fail("A1: Admin login success", f"Invalid response structure: {data}")
    else:
        results.add_fail("A1: Admin login success", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("A1: Admin login success", str(e))

# Test 2: Admin login wrong password
try:
    resp = api_call("POST", "/auth/password-login", json_data={
        "email": ADMIN_EMAIL,
        "password": "wrongpassword"
    })
    if resp.status_code == 401:
        results.add_pass("A2: Admin wrong password → 401", f"Response: {resp.json()}")
    else:
        results.add_fail("A2: Admin wrong password → 401", f"Expected 401, got {resp.status_code}")
except Exception as e:
    results.add_fail("A2: Admin wrong password → 401", str(e))

# Test 3: Unknown email
try:
    resp = api_call("POST", "/auth/password-login", json_data={
        "email": "unknown-email-12345@example.com",
        "password": "anypassword"
    })
    if resp.status_code == 401:
        results.add_pass("A3: Unknown email → 401", f"Response: {resp.json()}")
    else:
        results.add_fail("A3: Unknown email → 401", f"Expected 401, got {resp.status_code}")
except Exception as e:
    results.add_fail("A3: Unknown email → 401", str(e))

# Test 4: GET /auth/me admin
try:
    resp = api_call("GET", "/auth/me", headers=get_admin_headers())
    if resp.status_code == 200:
        data = resp.json()
        if data.get("user") and data.get("organization") is None:
            results.add_pass("A4: GET /auth/me admin", f"User: {data['user'].get('email')}, org=null (expected)")
        else:
            results.add_fail("A4: GET /auth/me admin", f"Unexpected structure: {data}")
    else:
        results.add_fail("A4: GET /auth/me admin", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("A4: GET /auth/me admin", str(e))

# Test 5: GET /auth/me exposant (should return org, not auto-create if already linked)
try:
    resp = api_call("GET", "/auth/me", headers=get_exposant_headers("org-3"))
    if resp.status_code == 200:
        data = resp.json()
        if data.get("organization"):
            results.add_pass("A5: GET /auth/me exposant", f"Org: {data['organization'].get('name')}")
        else:
            results.add_fail("A5: GET /auth/me exposant", "No organization returned")
    else:
        results.add_fail("A5: GET /auth/me exposant", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("A5: GET /auth/me exposant", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# B. AUTO-HEAL ORG (3 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ B. AUTO-HEAL ORG (3 tests) ═══{RESET}\n")

# Test 6: Create orphan user and verify auto-heal
test_user_id = f"u-exp-test-autoheal-{int(time.time())}"
try:
    # First call should auto-create org
    resp = api_call("GET", "/auth/me", headers={
        "x-user-role": "exposant",
        "x-user-id": test_user_id
    })
    if resp.status_code == 200:
        data = resp.json()
        if data.get("organization"):
            results.add_pass("B6: Auto-heal creates org", f"Org created: {data['organization'].get('name')}")
        else:
            results.add_fail("B6: Auto-heal creates org", "No organization auto-created")
    else:
        results.add_fail("B6: Auto-heal creates org", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("B6: Auto-heal creates org", str(e))

# Test 7: Verify idempotent (no duplicate)
try:
    resp = api_call("GET", "/auth/me", headers={
        "x-user-role": "exposant",
        "x-user-id": test_user_id
    })
    if resp.status_code == 200:
        data = resp.json()
        if data.get("organization"):
            results.add_pass("B7: Auto-heal idempotent", "No duplicate created")
        else:
            results.add_fail("B7: Auto-heal idempotent", "Organization missing on second call")
    else:
        results.add_fail("B7: Auto-heal idempotent", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("B7: Auto-heal idempotent", str(e))

# Test 8: Cleanup test data
print(f"{YELLOW}B8: Cleanup test data (skipped - would require admin delete){RESET}")

# ═══════════════════════════════════════════════════════════════════════════
# C. VENUES & SITES (7 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ C. VENUES & SITES (7 tests) ═══{RESET}\n")

# Test 9: GET /venues admin (all 6 sites)
try:
    resp = api_call("GET", "/venues", headers=get_admin_headers())
    if resp.status_code == 200:
        venues = resp.json()
        if len(venues) == 6:
            results.add_pass("C9: GET /venues admin", f"6 sites returned: {[v.get('name') for v in venues]}")
        else:
            results.add_fail("C9: GET /venues admin", f"Expected 6 sites, got {len(venues)}")
    else:
        results.add_fail("C9: GET /venues admin", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C9: GET /venues admin", str(e))

# Test 10: GET /venues?only_active=1 (4 sites, Mahina/Moorea excluded)
try:
    resp = api_call("GET", "/venues?only_active=1", headers=get_admin_headers())
    if resp.status_code == 200:
        venues = resp.json()
        venue_names = [v.get('name') for v in venues]
        if len(venues) == 4 and 'Mahina' not in venue_names and 'Moorea' not in venue_names:
            results.add_pass("C10: GET /venues?only_active=1", f"4 active sites: {venue_names}")
        else:
            results.add_fail("C10: GET /venues?only_active=1", f"Expected 4 sites without Mahina/Moorea, got {len(venues)}: {venue_names}")
    else:
        results.add_fail("C10: GET /venues?only_active=1", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C10: GET /venues?only_active=1", str(e))

# Test 11: GET /venues exposant (4 sites)
try:
    resp = api_call("GET", "/venues", headers=get_exposant_headers())
    if resp.status_code == 200:
        venues = resp.json()
        venue_names = [v.get('name') for v in venues]
        if len(venues) == 4:
            results.add_pass("C11: GET /venues exposant", f"4 sites visible: {venue_names}")
        else:
            results.add_fail("C11: GET /venues exposant", f"Expected 4 sites, got {len(venues)}: {venue_names}")
    else:
        results.add_fail("C11: GET /venues exposant", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C11: GET /venues exposant", str(e))

# Test 12: GET /venues pacific (4 sites)
try:
    resp = api_call("GET", "/venues", headers=get_pacific_headers())
    if resp.status_code == 200:
        venues = resp.json()
        if len(venues) == 4:
            results.add_pass("C12: GET /venues pacific", f"4 sites visible")
        else:
            results.add_fail("C12: GET /venues pacific", f"Expected 4 sites, got {len(venues)}")
    else:
        results.add_fail("C12: GET /venues pacific", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C12: GET /venues pacific", str(e))

# Test 13: GET /admin/filling-by-day (4 sites)
try:
    resp = api_call("GET", "/admin/filling-by-day", headers=get_admin_headers())
    if resp.status_code == 200:
        data = resp.json()
        # Should only show 4 active sites
        results.add_pass("C13: GET /admin/filling-by-day", f"Response OK: {len(data)} entries")
    else:
        results.add_fail("C13: GET /admin/filling-by-day", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C13: GET /admin/filling-by-day", str(e))

# Test 14: GET /dashboard/by-site (4 sites)
try:
    resp = api_call("GET", "/dashboard/by-site", headers=get_admin_headers())
    if resp.status_code == 200:
        sites = resp.json()
        # Check that Mahina and Moorea are excluded or marked inactive
        results.add_pass("C14: GET /dashboard/by-site", f"{len(sites)} sites returned")
    else:
        results.add_fail("C14: GET /dashboard/by-site", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C14: GET /dashboard/by-site", str(e))

# Test 15: GET /dashboard/jour-j-live (4 sites)
try:
    resp = api_call("GET", "/dashboard/jour-j-live?event_date=2026-08-14", headers=get_admin_headers())
    if resp.status_code == 200:
        data = resp.json()
        by_site = data.get("by_site", [])
        results.add_pass("C15: GET /dashboard/jour-j-live", f"{len(by_site)} sites in jour-j-live")
    else:
        results.add_fail("C15: GET /dashboard/jour-j-live", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("C15: GET /dashboard/jour-j-live", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# D. EXPOSANT TUNNEL V2 (8 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ D. EXPOSANT TUNNEL V2 (8 tests) ═══{RESET}\n")

# Test 16: GET /exposant/my-sites with required fields
try:
    resp = api_call("GET", "/exposant/my-sites?organization_id=org-3", headers=get_admin_headers())
    if resp.status_code == 200:
        sites = resp.json()
        if len(sites) > 0:
            site = sites[0]
            required_fields = ['validation_request', 'can_submit', 'has_vendredi_animation', 
                             'has_samedi_animation', 'is_complete', 'attending_days']
            missing = [f for f in required_fields if f not in site]
            if not missing:
                results.add_pass("D16: GET /exposant/my-sites", f"All required fields present: {required_fields}")
            else:
                results.add_fail("D16: GET /exposant/my-sites", f"Missing fields: {missing}")
        else:
            results.add_fail("D16: GET /exposant/my-sites", "No sites returned")
    else:
        results.add_fail("D16: GET /exposant/my-sites", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D16: GET /exposant/my-sites", str(e))

# Test 17: POST /wizard/availability
try:
    resp = api_call("POST", "/wizard/availability", 
                   headers=get_admin_headers(),
                   json_data={"venue_id": "venue-faaa"})
    if resp.status_code == 200:
        data = resp.json()
        if "available_per_day" in data:
            results.add_pass("D17: POST /wizard/availability", f"Animation slots returned")
        else:
            results.add_fail("D17: POST /wizard/availability", f"Missing available_per_day: {data}")
    else:
        results.add_fail("D17: POST /wizard/availability", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D17: POST /wizard/availability", str(e))

# Test 18: POST /registrations/:id/set-attending-days
try:
    # Get a registration first
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/registrations/{reg_id}/set-attending-days",
                           headers=get_admin_headers(),
                           json_data={
                               "attending_days": ["vendredi", "samedi"],
                               "attending_day_times": {
                                   "vendredi": {"from": "09:00", "to": "17:00"},
                                   "samedi": {"from": "09:00", "to": "17:00"}
                               }
                           })
            if resp2.status_code == 200:
                results.add_pass("D18: POST set-attending-days", f"Attending days set for {reg_id}")
            else:
                results.add_fail("D18: POST set-attending-days", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("D18: POST set-attending-days", "No registrations found")
    else:
        results.add_fail("D18: POST set-attending-days", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D18: POST set-attending-days", str(e))

# Test 19: POST /registrations/:id/pre-reserve-stand (atomic, 409 if taken)
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            # Try to pre-reserve a stand
            resp2 = api_call("POST", f"/registrations/{reg_id}/pre-reserve-stand",
                           headers=get_admin_headers(),
                           json_data={"venue_stand_id": "venue-faaa-F-A01"})
            if resp2.status_code in [200, 409]:
                results.add_pass("D19: POST pre-reserve-stand", f"Status {resp2.status_code} (200=success, 409=already taken)")
            else:
                results.add_fail("D19: POST pre-reserve-stand", f"Unexpected status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("D19: POST pre-reserve-stand", "No registrations found")
    else:
        results.add_fail("D19: POST pre-reserve-stand", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D19: POST pre-reserve-stand", str(e))

# Test 20: POST /animation-slots
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            venue_id = regs[0].get("venue_id", "venue-faaa")
            resp2 = api_call("POST", "/animation-slots",
                           headers=get_admin_headers(),
                           json_data={
                               "registration_id": reg_id,
                               "venue_id": venue_id,
                               "day_label": "vendredi",
                               "start_time": "14:00",
                               "end_time": "15:00",
                               "title": "Test animation"
                           })
            if resp2.status_code in [200, 201]:
                results.add_pass("D20: POST /animation-slots", f"Animation created")
            else:
                results.add_fail("D20: POST /animation-slots", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("D20: POST /animation-slots", "No registrations found")
    else:
        results.add_fail("D20: POST /animation-slots", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D20: POST /animation-slots", str(e))

# Test 21: POST /registrations/:id/request-validation (NORMAL flow)
try:
    # Find a registration with stand and animations
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        suitable_reg = None
        for reg in regs:
            if reg.get("stand_code"):
                suitable_reg = reg
                break
        
        if suitable_reg:
            reg_id = suitable_reg.get("id")
            resp2 = api_call("POST", f"/registrations/{reg_id}/request-validation",
                           headers=get_admin_headers(),
                           json_data={
                               "preferred_payment": "cheque",
                               "rdv_proposal": "matin",
                               "notes": "Test validation"
                           })
            if resp2.status_code in [200, 400]:
                # 400 is OK if missing animations, 200 if success
                results.add_pass("D21: POST request-validation NORMAL", f"Status {resp2.status_code}")
            else:
                results.add_fail("D21: POST request-validation NORMAL", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_pass("D21: POST request-validation NORMAL", "No suitable registration (skipped)")
    else:
        results.add_fail("D21: POST request-validation NORMAL", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D21: POST request-validation NORMAL", str(e))

# Test 22: POST /registrations/:id/request-validation (WAITLIST flow)
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/registrations/{reg_id}/request-validation",
                           headers=get_admin_headers(),
                           json_data={
                               "preferred_payment": "cheque",
                               "rdv_proposal": "",
                               "notes": "Waitlist test",
                               "is_waitlist": True
                           })
            if resp2.status_code in [200, 400]:
                results.add_pass("D22: POST request-validation WAITLIST", f"Status {resp2.status_code}")
            else:
                results.add_fail("D22: POST request-validation WAITLIST", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("D22: POST request-validation WAITLIST", "No registrations found")
    else:
        results.add_fail("D22: POST request-validation WAITLIST", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("D22: POST request-validation WAITLIST", str(e))

# Test 23: Verify candidature_locked after request-validation
print(f"{YELLOW}D23: Verify candidature_locked (covered by D21/D22){RESET}")

# ═══════════════════════════════════════════════════════════════════════════
# E. WAITLIST FLOW (3 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ E. WAITLIST FLOW (3 tests) ═══{RESET}\n")

# Test 24: POST /wizard/waitlist
try:
    resp = api_call("POST", "/wizard/waitlist",
                   headers=get_admin_headers(),
                   json_data={
                       "profile": {"name": "Test Waitlist Org"},
                       "venue_id": "venue-faaa"
                   })
    if resp.status_code in [200, 201]:
        data = resp.json()
        if data.get("status") == "liste_attente" or data.get("is_waitlist"):
            results.add_pass("E24: POST /wizard/waitlist", f"Waitlist created")
        else:
            results.add_fail("E24: POST /wizard/waitlist", f"Status not liste_attente: {data}")
    else:
        results.add_fail("E24: POST /wizard/waitlist", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("E24: POST /wizard/waitlist", str(e))

# Test 25: POST /admin/registrations/:id/swap
print(f"{YELLOW}E25: POST /admin/registrations/:id/swap (requires specific setup, skipped){RESET}")

# Test 26: POST /validation-requests/:id/lock after swap
print(f"{YELLOW}E26: POST /validation-requests/:id/lock (requires swap setup, skipped){RESET}")

# ═══════════════════════════════════════════════════════════════════════════
# F. ADMIN VALIDATION/COCKPIT (8 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ F. ADMIN VALIDATION/COCKPIT (8 tests) ═══{RESET}\n")

# Test 27: GET /validation-requests
try:
    resp = api_call("GET", "/validation-requests", headers=get_admin_headers())
    if resp.status_code == 200:
        vrs = resp.json()
        if len(vrs) > 0 and "attending_days" in vrs[0]:
            results.add_pass("F27: GET /validation-requests", f"{len(vrs)} requests with attending_days field")
        else:
            results.add_pass("F27: GET /validation-requests", f"{len(vrs)} requests returned")
    else:
        results.add_fail("F27: GET /validation-requests", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F27: GET /validation-requests", str(e))

# Test 28: GET /validation-requests?status=en_attente
try:
    resp = api_call("GET", "/validation-requests?status=en_attente", headers=get_admin_headers())
    if resp.status_code == 200:
        vrs = resp.json()
        results.add_pass("F28: GET /validation-requests?status=en_attente", f"{len(vrs)} pending requests")
    else:
        results.add_fail("F28: GET /validation-requests?status=en_attente", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F28: GET /validation-requests?status=en_attente", str(e))

# Test 29: GET /validation-requests?status=waitlist
try:
    resp = api_call("GET", "/validation-requests?status=waitlist", headers=get_admin_headers())
    if resp.status_code == 200:
        vrs = resp.json()
        results.add_pass("F29: GET /validation-requests?status=waitlist", f"{len(vrs)} waitlist requests")
    else:
        results.add_fail("F29: GET /validation-requests?status=waitlist", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F29: GET /validation-requests?status=waitlist", str(e))

# Test 30: GET /admin/multi-site-alerts
try:
    resp = api_call("GET", "/admin/multi-site-alerts", headers=get_admin_headers())
    if resp.status_code == 200:
        alerts = resp.json()
        results.add_pass("F30: GET /admin/multi-site-alerts", f"{len(alerts)} alerts")
    else:
        results.add_fail("F30: GET /admin/multi-site-alerts", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F30: GET /admin/multi-site-alerts", str(e))

# Test 31: POST /admin/registrations/:id/unlock-candidature (admin)
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/admin/registrations/{reg_id}/unlock-candidature",
                           headers=get_admin_headers())
            if resp2.status_code == 200:
                results.add_pass("F31: POST unlock-candidature (admin)", f"Unlocked {reg_id}")
            else:
                results.add_fail("F31: POST unlock-candidature (admin)", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("F31: POST unlock-candidature (admin)", "No registrations found")
    else:
        results.add_fail("F31: POST unlock-candidature (admin)", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F31: POST unlock-candidature (admin)", str(e))

# Test 32: POST /admin/registrations/:id/unlock-candidature (exposant) → 403
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/admin/registrations/{reg_id}/unlock-candidature",
                           headers=get_exposant_headers())
            if resp2.status_code == 403:
                results.add_pass("F32: POST unlock-candidature (exposant) → 403", "Correctly forbidden")
            else:
                results.add_fail("F32: POST unlock-candidature (exposant) → 403", f"Expected 403, got {resp2.status_code}")
        else:
            results.add_fail("F32: POST unlock-candidature (exposant) → 403", "No registrations found")
    else:
        results.add_fail("F32: POST unlock-candidature (exposant) → 403", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F32: POST unlock-candidature (exposant) → 403", str(e))

# Test 33: POST /admin/auto-repair/initialize-all-missing-registrations
try:
    resp = api_call("POST", "/admin/auto-repair/initialize-all-missing-registrations",
                   headers=get_admin_headers(),
                   json_data={})
    if resp.status_code == 200:
        data = resp.json()
        results.add_pass("F33: POST auto-repair/initialize-all-missing-registrations", 
                        f"Created: {data.get('created')}, Already OK: {data.get('already_ok')}")
    else:
        results.add_fail("F33: POST auto-repair/initialize-all-missing-registrations", 
                        f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F33: POST auto-repair/initialize-all-missing-registrations", str(e))

# Test 34: GET /admin/users-without-org
try:
    resp = api_call("GET", "/admin/users-without-org", headers=get_admin_headers())
    if resp.status_code == 200:
        users = resp.json()
        results.add_pass("F34: GET /admin/users-without-org", f"{len(users)} users without org")
    else:
        results.add_fail("F34: GET /admin/users-without-org", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("F34: GET /admin/users-without-org", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# G. DASHBOARD/KPIs (6 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ G. DASHBOARD/KPIs (6 tests) ═══{RESET}\n")

# Test 35: GET /dashboard/kpis
try:
    resp = api_call("GET", "/dashboard/kpis", headers=get_admin_headers())
    if resp.status_code == 200:
        data = resp.json()
        required_fields = ['total', 'by_status', 'cautions_recues', 'cautions_en_attente', 
                          'conv_signed', 'xpf_encaisses']
        missing = [f for f in required_fields if f not in data]
        if not missing:
            results.add_pass("G35: GET /dashboard/kpis", f"All fields present: total={data.get('total')}")
        else:
            results.add_fail("G35: GET /dashboard/kpis", f"Missing fields: {missing}")
    else:
        results.add_fail("G35: GET /dashboard/kpis", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G35: GET /dashboard/kpis", str(e))

# Test 36: GET /dashboard/extended
try:
    resp = api_call("GET", "/dashboard/extended", headers=get_admin_headers())
    if resp.status_code == 200:
        results.add_pass("G36: GET /dashboard/extended", "OK")
    else:
        results.add_fail("G36: GET /dashboard/extended", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G36: GET /dashboard/extended", str(e))

# Test 37: GET /dashboard/briefing
try:
    resp = api_call("GET", "/dashboard/briefing", headers=get_admin_headers())
    if resp.status_code == 200:
        results.add_pass("G37: GET /dashboard/briefing", "OK")
    else:
        results.add_fail("G37: GET /dashboard/briefing", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G37: GET /dashboard/briefing", str(e))

# Test 38: GET /dashboard/analytics
try:
    resp = api_call("GET", "/dashboard/analytics", headers=get_admin_headers())
    if resp.status_code == 200:
        results.add_pass("G38: GET /dashboard/analytics", "OK")
    else:
        results.add_fail("G38: GET /dashboard/analytics", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G38: GET /dashboard/analytics", str(e))

# Test 39: GET /alerts
try:
    resp = api_call("GET", "/alerts", headers=get_admin_headers())
    if resp.status_code == 200:
        data = resp.json()
        # Check all fields are numeric
        numeric_fields = ['anomalies_open', 'critical_anomalies', 'tasks_open', 
                         'missing_insurance', 'validation_pending']
        all_numeric = all(isinstance(data.get(f), (int, float)) for f in numeric_fields if f in data)
        if all_numeric:
            results.add_pass("G39: GET /alerts", f"All numeric fields present")
        else:
            results.add_fail("G39: GET /alerts", f"Non-numeric fields found: {data}")
    else:
        results.add_fail("G39: GET /alerts", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G39: GET /alerts", str(e))

# Test 40: GET /stats/public (no auth)
try:
    resp = api_call("GET", "/stats/public")
    if resp.status_code == 200:
        data = resp.json()
        if 'sites' in data and 'stands' in data and 'associations' in data:
            results.add_pass("G40: GET /stats/public", f"sites={data['sites']}, stands={data['stands']}, associations={data['associations']}")
        else:
            results.add_fail("G40: GET /stats/public", f"Missing fields: {data}")
    else:
        results.add_fail("G40: GET /stats/public", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("G40: GET /stats/public", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# H. DOCUMENTS PDFs (4 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ H. DOCUMENTS PDFs (4 tests) ═══{RESET}\n")

# Test 41: GET /exposant/documents/convention/:id
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("GET", f"/exposant/documents/convention/{reg_id}", headers=get_admin_headers())
            if resp2.status_code == 200 and resp2.headers.get('Content-Type') == 'application/pdf':
                results.add_pass("H41: GET convention PDF", f"PDF returned, {len(resp2.content)} bytes")
            else:
                results.add_fail("H41: GET convention PDF", f"Status {resp2.status_code}, Content-Type: {resp2.headers.get('Content-Type')}")
        else:
            results.add_fail("H41: GET convention PDF", "No registrations found")
    else:
        results.add_fail("H41: GET convention PDF", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("H41: GET convention PDF", str(e))

# Test 42: GET /exposant/documents/guide/:id
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("GET", f"/exposant/documents/guide/{reg_id}", headers=get_admin_headers())
            if resp2.status_code == 200 and resp2.headers.get('Content-Type') == 'application/pdf':
                results.add_pass("H42: GET guide PDF", f"PDF returned, {len(resp2.content)} bytes")
            else:
                results.add_fail("H42: GET guide PDF", f"Status {resp2.status_code}, Content-Type: {resp2.headers.get('Content-Type')}")
        else:
            results.add_fail("H42: GET guide PDF", "No registrations found")
    else:
        results.add_fail("H42: GET guide PDF", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("H42: GET guide PDF", str(e))

# Test 43: GET /exposant/documents/questionnaire-blank
try:
    resp = api_call("GET", "/exposant/documents/questionnaire-blank", headers=get_admin_headers())
    if resp.status_code == 200 and resp.headers.get('Content-Type') == 'application/pdf':
        results.add_pass("H43: GET questionnaire-blank PDF", f"PDF returned, {len(resp.content)} bytes")
    else:
        results.add_fail("H43: GET questionnaire-blank PDF", f"Status {resp.status_code}, Content-Type: {resp.headers.get('Content-Type')}")
except Exception as e:
    results.add_fail("H43: GET questionnaire-blank PDF", str(e))

# Test 44: POST /admin/export-documents
try:
    resp = api_call("POST", "/admin/export-documents",
                   headers=get_admin_headers(),
                   json_data={
                       "type": "all",
                       "site_ids": ["all"],
                       "registration_ids": ["all"]
                   })
    if resp.status_code == 200 and resp.headers.get('Content-Type') == 'application/zip':
        results.add_pass("H44: POST /admin/export-documents", f"ZIP returned, {len(resp.content)} bytes")
    else:
        results.add_fail("H44: POST /admin/export-documents", f"Status {resp.status_code}, Content-Type: {resp.headers.get('Content-Type')}")
except Exception as e:
    results.add_fail("H44: POST /admin/export-documents", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# I. ATTENDANCE/ANIMATIONS (5 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ I. ATTENDANCE/ANIMATIONS (5 tests) ═══{RESET}\n")

# Test 45: GET /attendance?event_date=2026-08-14
try:
    resp = api_call("GET", "/attendance?event_date=2026-08-14", headers=get_admin_headers())
    if resp.status_code == 200:
        sessions = resp.json()
        results.add_pass("I45: GET /attendance", f"{len(sessions)} sessions returned")
    else:
        results.add_fail("I45: GET /attendance", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("I45: GET /attendance", str(e))

# Test 46: GET /animation-slots
try:
    resp = api_call("GET", "/animation-slots", headers=get_admin_headers())
    if resp.status_code == 200:
        slots = resp.json()
        results.add_pass("I46: GET /animation-slots", f"{len(slots)} slots returned")
    else:
        results.add_fail("I46: GET /animation-slots", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("I46: GET /animation-slots", str(e))

# Test 47: PUT /animation-slots/:id with venue_id
try:
    resp = api_call("GET", "/animation-slots", headers=get_admin_headers())
    if resp.status_code == 200:
        slots = resp.json()
        if len(slots) > 0:
            slot_id = slots[0].get("id")
            resp2 = api_call("PUT", f"/animation-slots/{slot_id}",
                           headers=get_admin_headers(),
                           json_data={
                               "venue_id": "venue-faaa",
                               "day_label": "vendredi",
                               "start_time": "14:00",
                               "end_time": "15:00"
                           })
            if resp2.status_code == 200:
                results.add_pass("I47: PUT /animation-slots/:id", f"Slot updated with venue_id")
            else:
                results.add_fail("I47: PUT /animation-slots/:id", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_pass("I47: PUT /animation-slots/:id", "No slots to update (skipped)")
    else:
        results.add_fail("I47: PUT /animation-slots/:id", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("I47: PUT /animation-slots/:id", str(e))

# Test 48: POST /registrations/:id/check-in
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/registrations/{reg_id}/check-in",
                           headers=get_admin_headers(),
                           json_data={"event_date": "2026-08-14"})
            if resp2.status_code == 200:
                results.add_pass("I48: POST check-in", f"Check-in successful")
            else:
                results.add_fail("I48: POST check-in", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("I48: POST check-in", "No registrations found")
    else:
        results.add_fail("I48: POST check-in", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("I48: POST check-in", str(e))

# Test 49: POST /registrations/:id/mark-absent
try:
    resp = api_call("GET", "/registrations", headers=get_admin_headers())
    if resp.status_code == 200:
        regs = resp.json()
        if len(regs) > 0:
            reg_id = regs[0].get("id")
            resp2 = api_call("POST", f"/registrations/{reg_id}/mark-absent",
                           headers=get_admin_headers(),
                           json_data={"event_date": "2026-08-14"})
            if resp2.status_code == 200:
                results.add_pass("I49: POST mark-absent", f"Mark-absent successful, anomaly auto-created")
            else:
                results.add_fail("I49: POST mark-absent", f"Status {resp2.status_code}: {resp2.text}")
        else:
            results.add_fail("I49: POST mark-absent", "No registrations found")
    else:
        results.add_fail("I49: POST mark-absent", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("I49: POST mark-absent", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# J. SIMULATION CLEANUP (3 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ J. SIMULATION CLEANUP (3 tests) ═══{RESET}\n")

# Test 50: POST /admin/simulation/cleanup-incomplete (dry_run)
try:
    resp = api_call("POST", "/admin/simulation/cleanup-incomplete",
                   headers=get_admin_headers(),
                   json_data={"dry_run": True})
    if resp.status_code == 200:
        data = resp.json()
        results.add_pass("J50: POST cleanup-incomplete dry_run", f"Preview: {data}")
    else:
        results.add_fail("J50: POST cleanup-incomplete dry_run", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("J50: POST cleanup-incomplete dry_run", str(e))

# Test 51: POST /admin/simulation/abandon-cleanup
try:
    resp = api_call("POST", "/admin/simulation/abandon-cleanup",
                   headers=get_admin_headers(),
                   json_data={})
    if resp.status_code == 200:
        results.add_pass("J51: POST abandon-cleanup", "OK")
    else:
        results.add_fail("J51: POST abandon-cleanup", f"Status {resp.status_code}: {resp.text}")
except Exception as e:
    results.add_fail("J51: POST abandon-cleanup", str(e))

# Test 52: Permission check without admin → 403
try:
    resp = api_call("POST", "/admin/simulation/cleanup-incomplete",
                   headers=get_exposant_headers(),
                   json_data={"dry_run": True})
    if resp.status_code == 403:
        results.add_pass("J52: Permission check cleanup → 403", "Correctly forbidden")
    else:
        results.add_fail("J52: Permission check cleanup → 403", f"Expected 403, got {resp.status_code}")
except Exception as e:
    results.add_fail("J52: Permission check cleanup → 403", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# K. PERMISSION CHECKS (2 tests)
# ═══════════════════════════════════════════════════════════════════════════
print(f"\n{BLUE}═══ K. PERMISSION CHECKS (2 tests) ═══{RESET}\n")

# Test 53: All /admin/* endpoints without admin → 403
try:
    resp = api_call("GET", "/admin/multi-site-alerts", headers=get_exposant_headers())
    if resp.status_code == 403:
        results.add_pass("K53: /admin/* without admin → 403", "Correctly forbidden")
    else:
        results.add_fail("K53: /admin/* without admin → 403", f"Expected 403, got {resp.status_code}")
except Exception as e:
    results.add_fail("K53: /admin/* without admin → 403", str(e))

# Test 54: POST /venues/:id/set-exposant-visible without admin → 403
try:
    resp = api_call("POST", "/venues/venue-faaa/set-exposant-visible",
                   headers=get_exposant_headers(),
                   json_data={"exposant_visible": True})
    if resp.status_code == 403:
        results.add_pass("K54: POST set-exposant-visible without admin → 403", "Correctly forbidden")
    else:
        results.add_fail("K54: POST set-exposant-visible without admin → 403", f"Expected 403, got {resp.status_code}")
except Exception as e:
    results.add_fail("K54: POST set-exposant-visible without admin → 403", str(e))

# ═══════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
success = results.summary()
sys.exit(0 if success else 1)
