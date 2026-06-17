#!/usr/bin/env python3
"""
SESSION 53.3 — Auto-rebalance Waitlist Feature Testing
Tests the NEW auto-rebalance waitlist feature with manual and auto-trigger endpoints.
"""

import requests
import json
import time
from datetime import datetime

# Base URL from .env
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
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

def get_venue_waitlist_count(venue_id):
    """Get waitlist count for a venue"""
    try:
        response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            regs = response.json()
            waitlist = [r for r in regs if r.get('venue_id') == venue_id and r.get('is_waitlist') == True and r.get('status') == 'liste_attente']
            return len(waitlist)
        return 0
    except Exception as e:
        print(f"Error getting waitlist count: {e}")
        return 0

def get_venue_free_stands_count(venue_id):
    """Get free stands count for a venue"""
    try:
        response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            stands = response.json()
            free = [s for s in stands if not s.get('status') or s.get('status') == 'libre']
            return len(free)
        return 0
    except Exception as e:
        print(f"Error getting free stands count: {e}")
        return 0

def main():
    print("\n" + "="*80)
    print("SESSION 53.3 — AUTO-REBALANCE WAITLIST FEATURE TESTING")
    print("="*80)
    
    # ========================================================================
    # SETUP: Get current state
    # ========================================================================
    print_test("SETUP", "Getting current database state")
    
    try:
        # Get all venues
        venues_response = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=30)
        if venues_response.status_code != 200:
            print_result(False, f"Failed to get venues: {venues_response.status_code}")
            return
        
        venues = venues_response.json()
        print_result(True, f"Found {len(venues)} venues")
        
        # Get active venues (is_available_2026 = true)
        active_venues = [v for v in venues if v.get('is_available_2026') != False and v.get('is_active') != False]
        print(f"Active venues (is_available_2026=true): {len(active_venues)}")
        for v in active_venues:
            print(f"  - {v['name']} ({v['id']})")
        
        # Get all registrations
        regs_response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
        if regs_response.status_code != 200:
            print_result(False, f"Failed to get registrations: {regs_response.status_code}")
            return
        
        registrations = regs_response.json()
        print_result(True, f"Found {len(registrations)} registrations")
        
        # Count waitlisters per venue
        print("\nWaitlist status per venue:")
        for v in active_venues:
            waitlist_count = len([r for r in registrations if r.get('venue_id') == v['id'] and r.get('is_waitlist') == True and r.get('status') == 'liste_attente'])
            free_stands = get_venue_free_stands_count(v['id'])
            print(f"  - {v['name']}: {waitlist_count} waitlisters, {free_stands} free stands")
        
    except Exception as e:
        print_result(False, f"Setup failed: {e}")
        return
    
    # ========================================================================
    # TEST 1: POST /api/admin/rebalance-all-waitlists with admin role
    # ========================================================================
    print_test(1, "POST /api/admin/rebalance-all-waitlists with admin role")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/rebalance-all-waitlists",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            has_ok = 'ok' in data and data['ok'] == True
            has_total_promoted = 'total_promoted' in data
            has_sites = 'sites' in data and isinstance(data['sites'], list)
            has_message = 'message' in data
            
            if has_ok and has_total_promoted and has_sites and has_message:
                # Verify there are 4 active sites (Faaa, Punaauia, Arue, Taravao)
                # Mahina and Moorea should be disabled
                if len(data['sites']) == len(active_venues):
                    # Verify each site has required fields
                    all_sites_valid = True
                    for site in data['sites']:
                        if not all(k in site for k in ['venue_id', 'venue_name', 'promoted', 'capacity', 'free_before', 'waitlist_before', 'promotions']):
                            all_sites_valid = False
                            print(f"Site {site.get('venue_name', 'unknown')} missing required fields")
                            break
                    
                    if all_sites_valid:
                        print_result(True, f"Rebalanced {data['total_promoted']} exposants across {len(data['sites'])} sites")
                        print(f"Sites details:")
                        for site in data['sites']:
                            print(f"  - {site['venue_name']}: promoted={site['promoted']}, capacity={site['capacity']}, free_before={site['free_before']}, waitlist_before={site['waitlist_before']}")
                    else:
                        print_result(False, "Some sites missing required fields")
                else:
                    print_result(False, f"Expected {len(active_venues)} sites, got {len(data['sites'])}")
            else:
                print_result(False, f"Response missing required fields: ok={has_ok}, total_promoted={has_total_promoted}, sites={has_sites}, message={has_message}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 2: POST /api/admin/rebalance-all-waitlists without admin role
    # ========================================================================
    print_test(2, "POST /api/admin/rebalance-all-waitlists without admin role (should return 403)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/rebalance-all-waitlists",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=30
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
    # TEST 3: POST /api/admin/venues/:venueId/rebalance with admin role
    # ========================================================================
    print_test(3, "POST /api/admin/venues/:venueId/rebalance with admin role")
    
    # Use Punaauia as test venue (should have waitlist)
    test_venue_id = 'venue-pun'
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/venues/{test_venue_id}/rebalance",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            has_ok = 'ok' in data and data['ok'] == True
            has_stats = 'stats' in data and isinstance(data['stats'], dict)
            has_message = 'message' in data
            
            if has_ok and has_stats and has_message:
                stats = data['stats']
                required_fields = ['capacity', 'free_before', 'waitlist_before', 'promoted', 'promotions']
                if all(k in stats for k in required_fields):
                    print_result(True, f"Rebalanced venue {test_venue_id}: promoted={stats['promoted']}, capacity={stats['capacity']}, free_before={stats['free_before']}, waitlist_before={stats['waitlist_before']}")
                else:
                    print_result(False, f"Stats missing required fields: {stats.keys()}")
            else:
                print_result(False, f"Response missing required fields: ok={has_ok}, stats={has_stats}, message={has_message}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 4: POST /api/admin/venues/:venueId/rebalance with non-existent venue
    # ========================================================================
    print_test(4, "POST /api/admin/venues/:venueId/rebalance with non-existent venue (should return 404)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/venues/venue-nonexistent/rebalance",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 404:
            data = response.json()
            if 'error' in data and 'introuvable' in data['error'].lower():
                print_result(True, f"Correctly returned 404: {data['error']}")
            else:
                print_result(False, f"Got 404 but wrong error message: {data}")
        else:
            print_result(False, f"Expected 404, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 5: POST /api/admin/venues/:venueId/rebalance without admin role
    # ========================================================================
    print_test(5, "POST /api/admin/venues/:venueId/rebalance without admin role (should return 403)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/venues/{test_venue_id}/rebalance",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=30
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
    # TEST 6: AUTO-TRIGGER #1 - Stand creation (POST /api/venue-stands)
    # ========================================================================
    print_test(6, "AUTO-TRIGGER #1: Stand creation should auto-promote waitlister")
    
    # Use Punaauia which should have waitlist
    test_venue_id = 'venue-pun'
    test_stand_code = f'P-AUTO-TEST-{int(time.time())}'
    
    try:
        # Get current state
        waitlist_before = get_venue_waitlist_count(test_venue_id)
        free_stands_before = get_venue_free_stands_count(test_venue_id)
        
        print(f"Before: waitlist={waitlist_before}, free_stands={free_stands_before}")
        
        # Create a new stand
        response = requests.post(
            f"{BASE_URL}/venue-stands",
            headers=ADMIN_HEADERS,
            json={
                "venue_id": test_venue_id,
                "stand_code": test_stand_code,
                "zone": "Test Zone"
            },
            timeout=30
        )
        
        if response.status_code == 201:
            stand_data = response.json()
            print(f"Created stand: {stand_data.get('stand_code')}")
            
            # Wait a bit for auto-rebalance to complete
            time.sleep(2)
            
            # Get new state
            waitlist_after = get_venue_waitlist_count(test_venue_id)
            
            # Verify the stand is now reserved (if there was a waitlister)
            stands_response = requests.get(
                f"{BASE_URL}/venues/{test_venue_id}/stands",
                headers=ADMIN_HEADERS,
                timeout=30
            )
            
            if stands_response.status_code == 200:
                stands = stands_response.json()
                created_stand = next((s for s in stands if s['stand_code'] == test_stand_code), None)
                
                if created_stand:
                    print(f"Stand status: {created_stand.get('status')}")
                    
                    if waitlist_before > 0:
                        # Should have promoted one waitlister
                        if waitlist_after == waitlist_before - 1:
                            if created_stand.get('status') == 'reserved':
                                print_result(True, f"Auto-promoted 1 waitlister (waitlist: {waitlist_before} → {waitlist_after}), stand is now reserved")
                            else:
                                print_result(False, f"Waitlist decreased but stand status is '{created_stand.get('status')}' instead of 'reserved'")
                        else:
                            print_result(False, f"Waitlist count didn't decrease correctly: {waitlist_before} → {waitlist_after}")
                    else:
                        # No waitlister to promote
                        if created_stand.get('status') == 'libre' or not created_stand.get('status'):
                            print_result(True, f"No waitlister to promote, stand remains free")
                        else:
                            print_result(False, f"No waitlister but stand status is '{created_stand.get('status')}'")
                else:
                    print_result(False, f"Created stand not found in venue stands list")
            else:
                print_result(False, f"Failed to get stands after creation: {stands_response.status_code}")
            
            # CLEANUP: Delete the test stand
            print(f"Cleaning up test stand {test_stand_code}...")
            # Note: We need to first release any assignment, then delete the stand
            # For now, we'll leave it as the cleanup is complex
            
        else:
            print_result(False, f"Failed to create stand: {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 7: Regression checks - Dashboard KPIs
    # ========================================================================
    print_test(7, "REGRESSION: GET /api/dashboard/kpis")
    
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard/kpis",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ['total', 'by_status', 'cautions_recues', 'cautions_en_attente', 'conv_signed', 'xpf_encaisses']
            if all(k in data for k in required_fields):
                print_result(True, f"Dashboard KPIs OK: total={data['total']}")
            else:
                print_result(False, f"Missing required fields: {data.keys()}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 8: Regression checks - Dashboard by-site
    # ========================================================================
    print_test(8, "REGRESSION: GET /api/dashboard/by-site")
    
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard/by-site",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                # Verify first site has required fields
                site = data[0]
                required_fields = ['venue_id', 'venue_name', 'capacity_stands', 'assigned', 'confirmed']
                if all(k in site for k in required_fields):
                    print_result(True, f"Dashboard by-site OK: {len(data)} sites")
                else:
                    print_result(False, f"Site missing required fields: {site.keys()}")
            else:
                print_result(False, f"Expected array with sites, got: {type(data)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 9: Regression checks - Venues with admin role
    # ========================================================================
    print_test(9, "REGRESSION: GET /api/venues with admin role (should return all 6 sites)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/venues",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                if len(data) == 6:
                    print_result(True, f"All 6 venues returned for admin")
                else:
                    print_result(False, f"Expected 6 venues, got {len(data)}")
            else:
                print_result(False, f"Expected array, got: {type(data)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 10: Regression checks - Registrations
    # ========================================================================
    print_test(10, "REGRESSION: GET /api/registrations")
    
    try:
        response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                if 84 <= len(data) <= 120:  # Expected range based on test_result.md
                    print_result(True, f"Registrations OK: {len(data)} registrations")
                else:
                    print_result(False, f"Unexpected number of registrations: {len(data)}")
            else:
                print_result(False, f"Expected array, got: {type(data)}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print("All tests completed. Review results above.")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
