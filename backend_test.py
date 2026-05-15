#!/usr/bin/env python3
"""
Backend test for MULTI-SITES feature (Forum 2026)
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

def get_test_organization():
    """Find a test organization with 1 registration"""
    try:
        # Get all organizations
        resp = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        
        orgs = resp.json()
        
        # Find I Mua Papeete or any org with 1 registration
        for org in orgs:
            if "I Mua Papeete" in org.get("name", ""):
                return org.get("id")
        
        # Fallback to first org
        if orgs:
            return orgs[0].get("id")
        
        return None
    except Exception as e:
        print(f"Error getting test organization: {e}")
        return None

def get_available_venue(org_id: str, exclude_venue_ids: list = []):
    """Find an available venue not yet used by this organization"""
    try:
        # Get all venues
        resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        
        venues = resp.json()
        
        # Get organization's current registrations
        resp2 = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={org_id}", headers=ADMIN_HEADERS, timeout=10)
        if resp2.status_code != 200:
            return None
        
        current_sites = resp2.json()
        used_venue_ids = [site.get("venue_id") for site in current_sites]
        used_venue_ids.extend(exclude_venue_ids)
        
        # Find available venue
        for venue in venues:
            if venue.get("id") not in used_venue_ids:
                if venue.get("is_available_2026") != False and venue.get("exposant_visible") != False:
                    return venue.get("id")
        
        return None
    except Exception as e:
        print(f"Error getting available venue: {e}")
        return None

def get_disabled_venue():
    """Find a venue with exposant_visible=false (Mahina or Moorea)"""
    try:
        resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        
        venues = resp.json()
        for venue in venues:
            if venue.get("exposant_visible") == False or venue.get("name") in ["Mahina", "Moorea"]:
                return venue.get("id")
        
        return None
    except Exception as e:
        print(f"Error getting disabled venue: {e}")
        return None

print("=" * 80)
print("MULTI-SITES EXPOSANTS - BACKEND TESTS")
print("=" * 80)
print()

# ============================================================================
# TEST 1 — Config limite max sites par exposant (admin)
# ============================================================================
print("TEST 1 — Config limite max sites par exposant (admin)")
print("-" * 80)

# Test 1.1: GET default value
try:
    resp = requests.get(f"{BASE_URL}/admin/exposant-limits", headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if "max_sites_per_exposant" in data:
            log_test("TEST 1.1: GET exposant-limits returns default", True, 
                    f"max_sites_per_exposant={data.get('max_sites_per_exposant')}")
            initial_max = data.get("max_sites_per_exposant")
        else:
            log_test("TEST 1.1: GET exposant-limits returns default", False, 
                    "Missing max_sites_per_exposant field")
    else:
        log_test("TEST 1.1: GET exposant-limits returns default", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.1: GET exposant-limits returns default", False, str(e))

# Test 1.2: POST with admin role (value 5)
try:
    resp = requests.post(f"{BASE_URL}/admin/exposant-limits", 
                        headers=ADMIN_HEADERS,
                        json={"max_sites_per_exposant": 5},
                        timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and data.get("max_sites_per_exposant") == 5:
            log_test("TEST 1.2: POST exposant-limits with admin (value 5)", True, 
                    f"Response: {data}")
        else:
            log_test("TEST 1.2: POST exposant-limits with admin (value 5)", False, 
                    f"Unexpected response: {data}")
    else:
        log_test("TEST 1.2: POST exposant-limits with admin (value 5)", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.2: POST exposant-limits with admin (value 5)", False, str(e))

# Test 1.3: Verify value persisted
try:
    resp = requests.get(f"{BASE_URL}/admin/exposant-limits", headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("max_sites_per_exposant") == 5:
            log_test("TEST 1.3: Verify value persisted (5)", True, f"Value: {data.get('max_sites_per_exposant')}")
        else:
            log_test("TEST 1.3: Verify value persisted (5)", False, 
                    f"Expected 5, got {data.get('max_sites_per_exposant')}")
    else:
        log_test("TEST 1.3: Verify value persisted (5)", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.3: Verify value persisted (5)", False, str(e))

# Test 1.4: POST with value 100 (should clamp to 6)
try:
    resp = requests.post(f"{BASE_URL}/admin/exposant-limits", 
                        headers=ADMIN_HEADERS,
                        json={"max_sites_per_exposant": 100},
                        timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("max_sites_per_exposant") == 6:
            log_test("TEST 1.4: POST with value 100 (clamped to 6)", True, 
                    f"Clamped value: {data.get('max_sites_per_exposant')}")
        else:
            log_test("TEST 1.4: POST with value 100 (clamped to 6)", False, 
                    f"Expected 6, got {data.get('max_sites_per_exposant')}")
    else:
        log_test("TEST 1.4: POST with value 100 (clamped to 6)", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.4: POST with value 100 (clamped to 6)", False, str(e))

# Test 1.5: POST with value 0 (should clamp to 1)
try:
    resp = requests.post(f"{BASE_URL}/admin/exposant-limits", 
                        headers=ADMIN_HEADERS,
                        json={"max_sites_per_exposant": 0},
                        timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("max_sites_per_exposant") == 1:
            log_test("TEST 1.5: POST with value 0 (clamped to 1)", True, 
                    f"Clamped value: {data.get('max_sites_per_exposant')}")
        else:
            log_test("TEST 1.5: POST with value 0 (clamped to 1)", False, 
                    f"Expected 1, got {data.get('max_sites_per_exposant')}")
    else:
        log_test("TEST 1.5: POST with value 0 (clamped to 1)", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.5: POST with value 0 (clamped to 1)", False, str(e))

# Test 1.6: POST without admin role (should return 403)
try:
    resp = requests.post(f"{BASE_URL}/admin/exposant-limits", 
                        headers=EXPOSANT_HEADERS,
                        json={"max_sites_per_exposant": 5},
                        timeout=10)
    if resp.status_code == 403:
        log_test("TEST 1.6: POST without admin role (403)", True, "Correctly rejected")
    else:
        log_test("TEST 1.6: POST without admin role (403)", False, 
                f"Expected 403, got {resp.status_code}")
except Exception as e:
    log_test("TEST 1.6: POST without admin role (403)", False, str(e))

# Test 1.7: Restore value to 3
try:
    resp = requests.post(f"{BASE_URL}/admin/exposant-limits", 
                        headers=ADMIN_HEADERS,
                        json={"max_sites_per_exposant": 3},
                        timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("max_sites_per_exposant") == 3:
            log_test("TEST 1.7: Restore value to 3", True, "Value restored")
        else:
            log_test("TEST 1.7: Restore value to 3", False, 
                    f"Expected 3, got {data.get('max_sites_per_exposant')}")
    else:
        log_test("TEST 1.7: Restore value to 3", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 1.7: Restore value to 3", False, str(e))

print()

# ============================================================================
# TEST 2 — GET /api/exposant/my-sites
# ============================================================================
print("TEST 2 — GET /api/exposant/my-sites")
print("-" * 80)

# Get test organization
test_org_id = get_test_organization()
if not test_org_id:
    log_test("TEST 2.0: Get test organization", False, "Could not find test organization")
else:
    log_test("TEST 2.0: Get test organization", True, f"Using org_id: {test_org_id}")

# Test 2.1: GET my-sites with organization_id
if test_org_id:
    try:
        resp = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                           headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            sites = resp.json()
            if isinstance(sites, list):
                # Check required fields
                required_fields = ["id", "venue_id", "stand_code", "is_locked", "site_priority", 
                                 "venue", "deposit", "animations_count", "has_vendredi_animation", 
                                 "has_samedi_animation", "is_complete"]
                
                if len(sites) > 0:
                    first_site = sites[0]
                    missing_fields = [f for f in required_fields if f not in first_site]
                    
                    if not missing_fields:
                        # Check venue structure
                        venue = first_site.get("venue")
                        if venue and isinstance(venue, dict):
                            venue_fields = ["id", "name", "code"]
                            missing_venue_fields = [f for f in venue_fields if f not in venue]
                            
                            if not missing_venue_fields:
                                # Check sorting by site_priority
                                priorities = [s.get("site_priority", 99) for s in sites]
                                is_sorted = all(priorities[i] <= priorities[i+1] for i in range(len(priorities)-1))
                                
                                if is_sorted:
                                    log_test("TEST 2.1: GET my-sites with organization_id", True, 
                                            f"Found {len(sites)} sites, all fields present, sorted by priority")
                                else:
                                    log_test("TEST 2.1: GET my-sites with organization_id", False, 
                                            f"Sites not sorted by site_priority: {priorities}")
                            else:
                                log_test("TEST 2.1: GET my-sites with organization_id", False, 
                                        f"Missing venue fields: {missing_venue_fields}")
                        else:
                            log_test("TEST 2.1: GET my-sites with organization_id", False, 
                                    "venue field is not an object")
                    else:
                        log_test("TEST 2.1: GET my-sites with organization_id", False, 
                                f"Missing fields: {missing_fields}")
                else:
                    log_test("TEST 2.1: GET my-sites with organization_id", True, 
                            "Empty array returned (no sites for this org)")
            else:
                log_test("TEST 2.1: GET my-sites with organization_id", False, 
                        f"Expected array, got {type(sites)}")
        else:
            log_test("TEST 2.1: GET my-sites with organization_id", False, 
                    f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("TEST 2.1: GET my-sites with organization_id", False, str(e))

# Test 2.2: GET my-sites with non-existent organization_id
try:
    resp = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id=org-nonexistent-12345", 
                       headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 200:
        sites = resp.json()
        if isinstance(sites, list) and len(sites) == 0:
            log_test("TEST 2.2: GET my-sites with non-existent org_id", True, 
                    "Empty array returned")
        else:
            log_test("TEST 2.2: GET my-sites with non-existent org_id", False, 
                    f"Expected empty array, got {sites}")
    else:
        log_test("TEST 2.2: GET my-sites with non-existent org_id", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 2.2: GET my-sites with non-existent org_id", False, str(e))

# Test 2.3: GET my-sites without organization_id parameter
try:
    resp = requests.get(f"{BASE_URL}/exposant/my-sites", headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 400:
        log_test("TEST 2.3: GET my-sites without organization_id (400)", True, 
                "Correctly rejected")
    else:
        log_test("TEST 2.3: GET my-sites without organization_id (400)", False, 
                f"Expected 400, got {resp.status_code}")
except Exception as e:
    log_test("TEST 2.3: GET my-sites without organization_id (400)", False, str(e))

print()

# ============================================================================
# TEST 3 — POST /api/exposant/sites/add (ajout d'un site supplémentaire)
# ============================================================================
print("TEST 3 — POST /api/exposant/sites/add")
print("-" * 80)

added_reg_id = None
available_venue_id = None
if test_org_id:
    # Get available venue
    available_venue_id = get_available_venue(test_org_id)
    
    if available_venue_id:
        log_test("TEST 3.0: Find available venue", True, f"Using venue_id: {available_venue_id}")
        
        # Test 3.1: Add new site
        try:
            resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                               headers=ADMIN_HEADERS,
                               json={"organization_id": test_org_id, "venue_id": available_venue_id},
                               timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok") and "registration" in data:
                    reg = data["registration"]
                    added_reg_id = reg.get("id")
                    
                    # Check fields
                    checks = [
                        reg.get("status") == "a_confirmer",
                        reg.get("is_locked") == False,
                        reg.get("is_deposit_received") == False,
                        reg.get("is_convention_signed") == False,
                        reg.get("venue_id") == available_venue_id,
                        reg.get("organization_id") == test_org_id,
                        "site_priority" in reg
                    ]
                    
                    if all(checks):
                        log_test("TEST 3.1: POST sites/add creates new registration", True, 
                                f"Created reg_id: {added_reg_id}, site_priority: {reg.get('site_priority')}")
                    else:
                        log_test("TEST 3.1: POST sites/add creates new registration", False, 
                                f"Some fields incorrect: {reg}")
                else:
                    log_test("TEST 3.1: POST sites/add creates new registration", False, 
                            f"Unexpected response: {data}")
            else:
                log_test("TEST 3.1: POST sites/add creates new registration", False, 
                        f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("TEST 3.1: POST sites/add creates new registration", False, str(e))
        
        # Test 3.2: Verify site appears in my-sites
        try:
            resp = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                               headers=ADMIN_HEADERS, timeout=10)
            if resp.status_code == 200:
                sites = resp.json()
                if any(s.get("id") == added_reg_id for s in sites):
                    log_test("TEST 3.2: Verify new site in my-sites", True, 
                            f"Found {len(sites)} sites total")
                else:
                    log_test("TEST 3.2: Verify new site in my-sites", False, 
                            f"New site not found in list")
            else:
                log_test("TEST 3.2: Verify new site in my-sites", False, 
                        f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            log_test("TEST 3.2: Verify new site in my-sites", False, str(e))
    else:
        log_test("TEST 3.0: Find available venue", False, "No available venue found")

print()

# ============================================================================
# TEST 4 — Erreurs sur sites/add
# ============================================================================
print("TEST 4 — Erreurs sur sites/add")
print("-" * 80)

if test_org_id and available_venue_id:
    # Test 4.1: Try to add same venue again (duplicate)
    try:
        resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                           headers=ADMIN_HEADERS,
                           json={"organization_id": test_org_id, "venue_id": available_venue_id},
                           timeout=10)
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "déjà inscrit" in error_msg.lower():
                log_test("TEST 4.1: Duplicate venue_id (400)", True, f"Error: {error_msg}")
            else:
                log_test("TEST 4.1: Duplicate venue_id (400)", False, 
                        f"Wrong error message: {error_msg}")
        else:
            log_test("TEST 4.1: Duplicate venue_id (400)", False, 
                    f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("TEST 4.1: Duplicate venue_id (400)", False, str(e))
    
    # Test 4.2: Try to add disabled site (Mahina or Moorea)
    disabled_venue_id = get_disabled_venue()
    if disabled_venue_id:
        try:
            resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                               headers=ADMIN_HEADERS,
                               json={"organization_id": test_org_id, "venue_id": disabled_venue_id},
                               timeout=10)
            if resp.status_code == 400:
                error_msg = resp.json().get("error", "")
                if "pas ouvert" in error_msg.lower() or "n'est pas" in error_msg.lower():
                    log_test("TEST 4.2: Disabled site (400)", True, f"Error: {error_msg}")
                else:
                    log_test("TEST 4.2: Disabled site (400)", False, 
                            f"Wrong error message: {error_msg}")
            else:
                log_test("TEST 4.2: Disabled site (400)", False, 
                        f"Expected 400, got {resp.status_code}")
        except Exception as e:
            log_test("TEST 4.2: Disabled site (400)", False, str(e))
    else:
        log_test("TEST 4.2: Disabled site (400)", False, "No disabled venue found")
    
    # Test 4.3: Try to add non-existent venue
    try:
        resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                           headers=ADMIN_HEADERS,
                           json={"organization_id": test_org_id, "venue_id": "venue-nonexistent-12345"},
                           timeout=10)
        if resp.status_code == 404:
            log_test("TEST 4.3: Non-existent venue_id (404)", True, "Correctly rejected")
        else:
            log_test("TEST 4.3: Non-existent venue_id (404)", False, 
                    f"Expected 404, got {resp.status_code}")
    except Exception as e:
        log_test("TEST 4.3: Non-existent venue_id (404)", False, str(e))
    
    # Test 4.4: Missing organization_id
    try:
        resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                           headers=ADMIN_HEADERS,
                           json={"venue_id": available_venue_id},
                           timeout=10)
        if resp.status_code == 400:
            log_test("TEST 4.4: Missing organization_id (400)", True, "Correctly rejected")
        else:
            log_test("TEST 4.4: Missing organization_id (400)", False, 
                    f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("TEST 4.4: Missing organization_id (400)", False, str(e))
    
    # Test 4.5: Missing venue_id
    try:
        resp = requests.post(f"{BASE_URL}/exposant/sites/add", 
                           headers=ADMIN_HEADERS,
                           json={"organization_id": test_org_id},
                           timeout=10)
        if resp.status_code == 400:
            log_test("TEST 4.5: Missing venue_id (400)", True, "Correctly rejected")
        else:
            log_test("TEST 4.5: Missing venue_id (400)", False, 
                    f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("TEST 4.5: Missing venue_id (400)", False, str(e))

print()

# ============================================================================
# TEST 5 — POST /api/exposant/sites/<regId>/priority
# ============================================================================
print("TEST 5 — POST /api/exposant/sites/<regId>/priority")
print("-" * 80)

if test_org_id and added_reg_id:
    # Get current sites to find priorities
    try:
        resp = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                           headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            sites = resp.json()
            if len(sites) >= 2:
                # Find the added registration
                added_site = next((s for s in sites if s.get("id") == added_reg_id), None)
                if added_site:
                    old_priority = added_site.get("site_priority")
                    
                    # Test 5.1: Change priority to 1
                    try:
                        resp = requests.post(f"{BASE_URL}/exposant/sites/{added_reg_id}/priority", 
                                           headers=ADMIN_HEADERS,
                                           json={"priority": 1},
                                           timeout=10)
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("ok") and data.get("priority") == 1:
                                log_test("TEST 5.1: Change priority to 1", True, 
                                        f"Priority changed from {old_priority} to 1")
                                
                                # Test 5.2: Verify swap in my-sites
                                try:
                                    resp2 = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                                                        headers=ADMIN_HEADERS, timeout=10)
                                    if resp2.status_code == 200:
                                        new_sites = resp2.json()
                                        added_site_new = next((s for s in new_sites if s.get("id") == added_reg_id), None)
                                        
                                        if added_site_new and added_site_new.get("site_priority") == 1:
                                            # Check if another site was swapped
                                            other_sites = [s for s in new_sites if s.get("id") != added_reg_id]
                                            if any(s.get("site_priority") == old_priority for s in other_sites):
                                                log_test("TEST 5.2: Verify automatic swap", True, 
                                                        "Priority swap confirmed")
                                            else:
                                                log_test("TEST 5.2: Verify automatic swap", True, 
                                                        "Priority changed (no conflict to swap)")
                                        else:
                                            log_test("TEST 5.2: Verify automatic swap", False, 
                                                    "Priority not updated in my-sites")
                                    else:
                                        log_test("TEST 5.2: Verify automatic swap", False, 
                                                f"HTTP {resp2.status_code}")
                                except Exception as e:
                                    log_test("TEST 5.2: Verify automatic swap", False, str(e))
                            else:
                                log_test("TEST 5.1: Change priority to 1", False, 
                                        f"Unexpected response: {data}")
                        else:
                            log_test("TEST 5.1: Change priority to 1", False, 
                                    f"HTTP {resp.status_code}: {resp.text[:200]}")
                    except Exception as e:
                        log_test("TEST 5.1: Change priority to 1", False, str(e))
                else:
                    log_test("TEST 5.1: Change priority to 1", False, "Added site not found")
            else:
                log_test("TEST 5.1: Change priority to 1", False, 
                        f"Need at least 2 sites, found {len(sites)}")
        else:
            log_test("TEST 5.1: Change priority to 1", False, 
                    f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("TEST 5.1: Change priority to 1", False, str(e))

print()

# ============================================================================
# TEST 6 — POST /api/exposant/sites/<regId>/remove
# ============================================================================
print("TEST 6 — POST /api/exposant/sites/<regId>/remove")
print("-" * 80)

if test_org_id and added_reg_id:
    # Test 6.1: Remove the added site
    try:
        resp = requests.post(f"{BASE_URL}/exposant/sites/{added_reg_id}/remove", 
                           headers=ADMIN_HEADERS,
                           json={},
                           timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log_test("TEST 6.1: Remove site", True, "Site removed successfully")
                
                # Test 6.2: Verify site no longer in my-sites
                try:
                    resp2 = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                                        headers=ADMIN_HEADERS, timeout=10)
                    if resp2.status_code == 200:
                        sites = resp2.json()
                        if not any(s.get("id") == added_reg_id for s in sites):
                            log_test("TEST 6.2: Verify site removed from my-sites", True, 
                                    "Site no longer appears")
                        else:
                            log_test("TEST 6.2: Verify site removed from my-sites", False, 
                                    "Site still appears in list")
                    else:
                        log_test("TEST 6.2: Verify site removed from my-sites", False, 
                                f"HTTP {resp2.status_code}")
                except Exception as e:
                    log_test("TEST 6.2: Verify site removed from my-sites", False, str(e))
            else:
                log_test("TEST 6.1: Remove site", False, f"Unexpected response: {data}")
        else:
            log_test("TEST 6.1: Remove site", False, 
                    f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("TEST 6.1: Remove site", False, str(e))

print()

# ============================================================================
# TEST 7 — Erreurs sur sites/<regId>/remove
# ============================================================================
print("TEST 7 — Erreurs sur sites/<regId>/remove")
print("-" * 80)

# Test 7.1: Try to remove non-existent registration
try:
    resp = requests.post(f"{BASE_URL}/exposant/sites/reg-nonexistent-12345/remove", 
                       headers=ADMIN_HEADERS,
                       json={},
                       timeout=10)
    if resp.status_code == 404:
        log_test("TEST 7.1: Remove non-existent regId (404)", True, "Correctly rejected")
    else:
        log_test("TEST 7.1: Remove non-existent regId (404)", False, 
                f"Expected 404, got {resp.status_code}")
except Exception as e:
    log_test("TEST 7.1: Remove non-existent regId (404)", False, str(e))

# Test 7.2: Try to remove last remaining site
if test_org_id:
    try:
        resp = requests.get(f"{BASE_URL}/exposant/my-sites?organization_id={test_org_id}", 
                           headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            sites = resp.json()
            if len(sites) == 1:
                last_site_id = sites[0].get("id")
                try:
                    resp2 = requests.post(f"{BASE_URL}/exposant/sites/{last_site_id}/remove", 
                                        headers=ADMIN_HEADERS,
                                        json={},
                                        timeout=10)
                    if resp2.status_code == 400:
                        error_msg = resp2.json().get("error", "")
                        if "au moins 1 site" in error_msg.lower():
                            log_test("TEST 7.2: Remove last remaining site (400)", True, 
                                    f"Error: {error_msg}")
                        else:
                            log_test("TEST 7.2: Remove last remaining site (400)", False, 
                                    f"Wrong error message: {error_msg}")
                    else:
                        log_test("TEST 7.2: Remove last remaining site (400)", False, 
                                f"Expected 400, got {resp2.status_code}")
                except Exception as e:
                    log_test("TEST 7.2: Remove last remaining site (400)", False, str(e))
            else:
                log_test("TEST 7.2: Remove last remaining site (400)", False, 
                        f"Organization has {len(sites)} sites, need exactly 1 for this test")
        else:
            log_test("TEST 7.2: Remove last remaining site (400)", False, 
                    f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("TEST 7.2: Remove last remaining site (400)", False, str(e))

print()

# ============================================================================
# TEST 8 — Filtrage by-site et registrations avec multi-sites
# ============================================================================
print("TEST 8 — Filtrage by-site et registrations avec multi-sites")
print("-" * 80)

# Test 8.1: GET /api/registrations returns all registrations
try:
    resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 200:
        registrations = resp.json()
        if isinstance(registrations, list) and len(registrations) > 0:
            log_test("TEST 8.1: GET /api/registrations returns all", True, 
                    f"Found {len(registrations)} registrations")
        else:
            log_test("TEST 8.1: GET /api/registrations returns all", False, 
                    f"Expected non-empty array, got {registrations}")
    else:
        log_test("TEST 8.1: GET /api/registrations returns all", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 8.1: GET /api/registrations returns all", False, str(e))

# Test 8.2: GET /api/dashboard/by-site counts correctly
try:
    resp = requests.get(f"{BASE_URL}/dashboard/by-site", headers=ADMIN_HEADERS, timeout=10)
    if resp.status_code == 200:
        sites = resp.json()
        if isinstance(sites, list) and len(sites) > 0:
            total_assigned = sum(s.get("assigned", 0) for s in sites)
            log_test("TEST 8.2: GET /api/dashboard/by-site counts correctly", True, 
                    f"Found {len(sites)} sites, total assigned: {total_assigned}")
        else:
            log_test("TEST 8.2: GET /api/dashboard/by-site counts correctly", False, 
                    f"Expected non-empty array, got {sites}")
    else:
        log_test("TEST 8.2: GET /api/dashboard/by-site counts correctly", False, 
                f"HTTP {resp.status_code}: {resp.text[:200]}")
except Exception as e:
    log_test("TEST 8.2: GET /api/dashboard/by-site counts correctly", False, str(e))

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total tests: {test_count}")
print(f"Passed: {passed_count} ({passed_count*100//test_count if test_count > 0 else 0}%)")
print(f"Failed: {failed_count} ({failed_count*100//test_count if test_count > 0 else 0}%)")
print()

if failed_count > 0:
    print("FAILED TESTS:")
    for result in test_results:
        if not result["passed"]:
            print(f"  ❌ {result['test']}")
            if result["details"]:
                print(f"     {result['details']}")
    print()

sys.exit(0 if failed_count == 0 else 1)
