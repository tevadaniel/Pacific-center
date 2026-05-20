#!/usr/bin/env python3
"""
SESSION 46 — Test des deux endpoints RESET avec préservation des plans de salles
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-test-exposant",
    "Content-Type": "application/json"
}

def print_test(test_name: str):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_result(success: bool, message: str):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {message}")

def seed_database():
    """Seed the database with test data"""
    print_test("PRE-TEST: Seeding database")
    try:
        response = requests.post(
            f"{BASE_URL}/seed",
            json={"force": True},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Database seeded: {data.get('associations', 0)} associations, {data.get('stands_planned', 0)} stands")
            return True
        else:
            print_result(False, f"Seed failed: {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print_result(False, f"Seed error: {str(e)}")
        return False

def get_counts() -> Dict[str, int]:
    """Get current counts of all collections"""
    counts = {}
    try:
        # Organizations
        resp = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            counts['organizations'] = len(resp.json())
        
        # Registrations
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            counts['registrations'] = len(resp.json())
        
        # Animation slots
        resp = requests.get(f"{BASE_URL}/animation-slots", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            counts['animation_slots'] = len(resp.json())
        
        # Documents
        resp = requests.get(f"{BASE_URL}/documents", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            counts['documents'] = len(resp.json())
        
        # Venues
        resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            venues = resp.json()
            counts['venues'] = len(venues)
            
            # Count venue stands with positions
            venue_stands_with_positions = 0
            for venue in venues:
                venue_id = venue.get('id') or venue.get('venue_id')
                if venue_id:
                    stands_resp = requests.get(f"{BASE_URL}/venues/{venue_id}/stands", headers=ADMIN_HEADERS, timeout=10)
                    if stands_resp.status_code == 200:
                        stands = stands_resp.json()
                        for stand in stands:
                            if stand.get('pos_x') is not None and stand.get('pos_y') is not None:
                                venue_stands_with_positions += 1
            counts['venue_stands_with_positions'] = venue_stands_with_positions
        
        # Users (non-admin)
        resp = requests.get(f"{BASE_URL}/admin/users-without-org", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            counts['users_non_admin'] = len(resp.json())
        
        print(f"Current counts: {counts}")
        return counts
    except Exception as e:
        print(f"Error getting counts: {str(e)}")
        return counts

def test_1_authentication():
    """TEST 1 — Authentication (both endpoints should return 403 without admin role)"""
    print_test("TEST 1 — Authentication")
    
    # Test reset-for-new-edition without admin
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-for-new-edition",
            json={"confirm": "RESET-NOUVELLE-EDITION-2026"},
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        if response.status_code == 403:
            print_result(True, "reset-for-new-edition returns 403 without admin role")
        else:
            print_result(False, f"reset-for-new-edition returned {response.status_code} instead of 403")
    except Exception as e:
        print_result(False, f"reset-for-new-edition auth test error: {str(e)}")
    
    # Test reset-total without admin
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-total",
            json={"confirm": "RESET-TOTAL-DEFINITIF"},
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        if response.status_code == 403:
            print_result(True, "reset-total returns 403 without admin role")
        else:
            print_result(False, f"reset-total returned {response.status_code} instead of 403")
    except Exception as e:
        print_result(False, f"reset-total auth test error: {str(e)}")

def test_2_confirmation_validation():
    """TEST 2 — Confirmation string validation"""
    print_test("TEST 2 — Confirmation string validation")
    
    # Test reset-for-new-edition with missing confirm
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-for-new-edition",
            json={},
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, "reset-for-new-edition returns 400 with missing confirm")
        else:
            print_result(False, f"reset-for-new-edition returned {response.status_code} instead of 400 (missing confirm)")
    except Exception as e:
        print_result(False, f"reset-for-new-edition missing confirm test error: {str(e)}")
    
    # Test reset-for-new-edition with wrong confirm
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-for-new-edition",
            json={"confirm": "WRONG"},
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, "reset-for-new-edition returns 400 with wrong confirm")
        else:
            print_result(False, f"reset-for-new-edition returned {response.status_code} instead of 400 (wrong confirm)")
    except Exception as e:
        print_result(False, f"reset-for-new-edition wrong confirm test error: {str(e)}")
    
    # Test reset-total with missing confirm
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-total",
            json={},
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, "reset-total returns 400 with missing confirm")
        else:
            print_result(False, f"reset-total returned {response.status_code} instead of 400 (missing confirm)")
    except Exception as e:
        print_result(False, f"reset-total missing confirm test error: {str(e)}")
    
    # Test reset-total with wrong confirm
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-total",
            json={"confirm": "WRONG"},
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, "reset-total returns 400 with wrong confirm")
        else:
            print_result(False, f"reset-total returned {response.status_code} instead of 400 (wrong confirm)")
    except Exception as e:
        print_result(False, f"reset-total wrong confirm test error: {str(e)}")

def test_3_reset_for_new_edition():
    """TEST 3 — Reset for new edition (SOFT reset)"""
    print_test("TEST 3 — Reset for new edition (SOFT reset)")
    
    # Seed database first
    if not seed_database():
        print_result(False, "Failed to seed database before SOFT reset test")
        return
    
    time.sleep(2)  # Wait for seed to complete
    
    # Get counts BEFORE
    print("\n📊 Snapshot BEFORE reset-for-new-edition:")
    before = get_counts()
    
    # Execute reset-for-new-edition
    print("\n🔄 Executing reset-for-new-edition...")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-for-new-edition",
            json={"confirm": "RESET-NOUVELLE-EDITION-2026"},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"reset-for-new-edition returned 200")
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response fields
            required_fields = ['ok', 'registrations_reset', 'documents_archived', 'stand_assignments_cancelled', 'animations_archived', 'layouts_restored', 'message']
            missing_fields = [f for f in required_fields if f not in data]
            if missing_fields:
                print_result(False, f"Missing response fields: {missing_fields}")
            else:
                print_result(True, "All required response fields present")
        else:
            print_result(False, f"reset-for-new-edition returned {response.status_code}: {response.text[:500]}")
            return
    except Exception as e:
        print_result(False, f"reset-for-new-edition execution error: {str(e)}")
        return
    
    time.sleep(2)  # Wait for reset to complete
    
    # Get counts AFTER
    print("\n📊 Snapshot AFTER reset-for-new-edition:")
    after = get_counts()
    
    # Verify AFTER state
    print("\n🔍 Verifying AFTER state:")
    
    # Organizations count UNCHANGED
    if before.get('organizations') == after.get('organizations'):
        print_result(True, f"Organizations preserved: {after.get('organizations')}")
    else:
        print_result(False, f"Organizations changed: {before.get('organizations')} → {after.get('organizations')}")
    
    # Registrations count UNCHANGED (but status should be 'a_relancer')
    if before.get('registrations') == after.get('registrations'):
        print_result(True, f"Registrations count preserved: {after.get('registrations')}")
    else:
        print_result(False, f"Registrations count changed: {before.get('registrations')} → {after.get('registrations')}")
    
    # Documents should be EMPTY (archived)
    if after.get('documents', 0) == 0:
        print_result(True, "Documents archived (count = 0)")
    else:
        print_result(False, f"Documents not fully archived: {after.get('documents')} remaining")
    
    # Animation slots should be EMPTY (archived)
    if after.get('animation_slots', 0) == 0:
        print_result(True, "Animation slots archived (count = 0)")
    else:
        print_result(False, f"Animation slots not fully archived: {after.get('animation_slots')} remaining")
    
    # CRITICAL: Venue stands with positions should be preserved
    if after.get('venue_stands_with_positions', 0) > 0:
        print_result(True, f"✨ CRITICAL: Venue stands positions preserved: {after.get('venue_stands_with_positions')} stands with pos_x/pos_y")
    else:
        print_result(False, f"❌ CRITICAL: Venue stands positions LOST: {after.get('venue_stands_with_positions')} stands with positions")
    
    # Venues count should be UNCHANGED
    if before.get('venues') == after.get('venues'):
        print_result(True, f"Venues preserved: {after.get('venues')}")
    else:
        print_result(False, f"Venues changed: {before.get('venues')} → {after.get('venues')}")

def test_4_reset_total():
    """TEST 4 — Reset total (HARD reset)"""
    print_test("TEST 4 — Reset total (HARD reset)")
    
    # Seed database first
    if not seed_database():
        print_result(False, "Failed to seed database before HARD reset test")
        return
    
    time.sleep(2)  # Wait for seed to complete
    
    # Get counts BEFORE
    print("\n📊 Snapshot BEFORE reset-total:")
    before = get_counts()
    
    # Execute reset-total
    print("\n🔄 Executing reset-total...")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-total",
            json={"confirm": "RESET-TOTAL-DEFINITIF"},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"reset-total returned 200")
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response fields
            required_fields = ['ok', 'deleted', 'layouts_restored', 'message']
            missing_fields = [f for f in required_fields if f not in data]
            if missing_fields:
                print_result(False, f"Missing response fields: {missing_fields}")
            else:
                print_result(True, "All required response fields present")
                
            # Verify deleted object has expected fields
            if 'deleted' in data:
                deleted_fields = ['organizations', 'registrations', 'animations', 'documents', 'stand_assignments', 'deposits', 'users', 'access_tokens']
                missing_deleted = [f for f in deleted_fields if f not in data['deleted']]
                if missing_deleted:
                    print_result(False, f"Missing deleted fields: {missing_deleted}")
                else:
                    print_result(True, "All deleted fields present")
        else:
            print_result(False, f"reset-total returned {response.status_code}: {response.text[:500]}")
            return
    except Exception as e:
        print_result(False, f"reset-total execution error: {str(e)}")
        return
    
    time.sleep(2)  # Wait for reset to complete
    
    # Get counts AFTER
    print("\n📊 Snapshot AFTER reset-total:")
    after = get_counts()
    
    # Verify AFTER state
    print("\n🔍 Verifying AFTER state:")
    
    # Organizations should be EMPTY
    if after.get('organizations', 0) == 0:
        print_result(True, "Organizations deleted (count = 0)")
    else:
        print_result(False, f"Organizations not fully deleted: {after.get('organizations')} remaining")
    
    # Registrations should be EMPTY
    if after.get('registrations', 0) == 0:
        print_result(True, "Registrations deleted (count = 0)")
    else:
        print_result(False, f"Registrations not fully deleted: {after.get('registrations')} remaining")
    
    # Animation slots should be EMPTY
    if after.get('animation_slots', 0) == 0:
        print_result(True, "Animation slots deleted (count = 0)")
    else:
        print_result(False, f"Animation slots not fully deleted: {after.get('animation_slots')} remaining")
    
    # Documents should be EMPTY
    if after.get('documents', 0) == 0:
        print_result(True, "Documents deleted (count = 0)")
    else:
        print_result(False, f"Documents not fully deleted: {after.get('documents')} remaining")
    
    # CRITICAL: Venues count should be UNCHANGED
    if before.get('venues') == after.get('venues'):
        print_result(True, f"✨ CRITICAL: Venues preserved: {after.get('venues')}")
    else:
        print_result(False, f"❌ CRITICAL: Venues changed: {before.get('venues')} → {after.get('venues')}")
    
    # CRITICAL: Venue stands with positions should be preserved
    if after.get('venue_stands_with_positions', 0) > 0:
        print_result(True, f"✨ CRITICAL: Venue stands positions preserved: {after.get('venue_stands_with_positions')} stands with pos_x/pos_y")
    else:
        print_result(False, f"❌ CRITICAL: Venue stands positions LOST: {after.get('venue_stands_with_positions')} stands with positions")

def test_5_layout_preservation():
    """TEST 5 — Layout preservation verification (the KEY requirement)"""
    print_test("TEST 5 — Layout preservation (KEY requirement)")
    
    # Seed database
    if not seed_database():
        print_result(False, "Failed to seed database before layout preservation test")
        return
    
    time.sleep(2)
    
    # First, call reset-for-new-edition to ensure layouts are restored
    print("\n🔄 First reset to ensure layouts are in place...")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-for-new-edition",
            json={"confirm": "RESET-NOUVELLE-EDITION-2026"},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if response.status_code != 200:
            print_result(False, f"Initial reset failed: {response.status_code}")
            return
        print_result(True, "Initial reset completed, layouts should now be in place")
    except Exception as e:
        print_result(False, f"Initial reset error: {str(e)}")
        return
    
    time.sleep(2)
    
    # Get a venue with stands BEFORE second reset
    print("\n📊 Getting venue layout BEFORE reset-total:")
    try:
        venues_resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=10)
        if venues_resp.status_code != 200:
            print_result(False, f"Failed to get venues: {venues_resp.status_code}")
            return
        
        venues = venues_resp.json()
        if not venues:
            print_result(False, "No venues found")
            return
        
        # Pick first venue
        venue = venues[0]
        venue_id = venue.get('id') or venue.get('venue_id')
        venue_name = venue.get('name') or venue.get('venue_name', 'Unknown')
        
        print(f"Testing with venue: {venue_name} ({venue_id})")
        
        # Get stands BEFORE
        stands_resp = requests.get(f"{BASE_URL}/venues/{venue_id}/stands", headers=ADMIN_HEADERS, timeout=10)
        if stands_resp.status_code != 200:
            print_result(False, f"Failed to get stands: {stands_resp.status_code}")
            return
        
        stands_before = stands_resp.json()
        stands_with_positions_before = [s for s in stands_before if s.get('pos_x') is not None and s.get('pos_y') is not None]
        
        print(f"Stands BEFORE: {len(stands_before)} total, {len(stands_with_positions_before)} with positions")
        
        if len(stands_with_positions_before) == 0:
            print_result(False, "No stands with positions found before reset (layouts not restored)")
            return
        
        # Store a sample stand for comparison
        sample_stand = stands_with_positions_before[0]
        sample_stand_code = sample_stand.get('stand_code')
        sample_x_before = sample_stand.get('pos_x')
        sample_y_before = sample_stand.get('pos_y')
        
        print(f"Sample stand BEFORE: {sample_stand_code} at ({sample_x_before}, {sample_y_before})")
        
    except Exception as e:
        print_result(False, f"Error getting layout before reset: {str(e)}")
        return
    
    # Execute reset-total
    print("\n🔄 Executing reset-total...")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/reset-total",
            json={"confirm": "RESET-TOTAL-DEFINITIF"},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            print_result(False, f"reset-total failed: {response.status_code}")
            return
        
        print_result(True, "reset-total executed successfully")
    except Exception as e:
        print_result(False, f"reset-total execution error: {str(e)}")
        return
    
    time.sleep(2)
    
    # Get stands AFTER
    print("\n📊 Getting venue layout AFTER reset-total:")
    try:
        stands_resp = requests.get(f"{BASE_URL}/venues/{venue_id}/stands", headers=ADMIN_HEADERS, timeout=10)
        if stands_resp.status_code != 200:
            print_result(False, f"Failed to get stands after reset: {stands_resp.status_code}")
            return
        
        stands_after = stands_resp.json()
        stands_with_positions_after = [s for s in stands_after if s.get('pos_x') is not None and s.get('pos_y') is not None]
        
        print(f"Stands AFTER: {len(stands_after)} total, {len(stands_with_positions_after)} with positions")
        
        # Find the sample stand
        sample_stand_after = next((s for s in stands_after if s.get('stand_code') == sample_stand_code), None)
        
        if sample_stand_after:
            sample_x_after = sample_stand_after.get('pos_x')
            sample_y_after = sample_stand_after.get('pos_y')
            print(f"Sample stand AFTER: {sample_stand_code} at ({sample_x_after}, {sample_y_after})")
            
            # Verify positions match
            if sample_x_before == sample_x_after and sample_y_before == sample_y_after:
                print_result(True, f"✨ CRITICAL: Stand positions PRESERVED ({sample_stand_code}: {sample_x_before},{sample_y_before})")
            else:
                print_result(False, f"❌ CRITICAL: Stand positions CHANGED ({sample_stand_code}: {sample_x_before},{sample_y_before} → {sample_x_after},{sample_y_after})")
        else:
            print_result(False, f"Sample stand {sample_stand_code} not found after reset")
        
        # Verify count matches
        if len(stands_with_positions_before) == len(stands_with_positions_after):
            print_result(True, f"✨ CRITICAL: Stand count with positions PRESERVED ({len(stands_with_positions_after)} stands)")
        else:
            print_result(False, f"❌ CRITICAL: Stand count with positions CHANGED ({len(stands_with_positions_before)} → {len(stands_with_positions_after)})")
        
    except Exception as e:
        print_result(False, f"Error getting layout after reset: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SESSION 46 — RESET ENDPOINTS TEST SUITE")
    print("Testing two RESET endpoints with venue layout preservation")
    print("="*80)
    
    # Run tests
    test_1_authentication()
    test_2_confirmation_validation()
    test_3_reset_for_new_edition()
    test_4_reset_total()
    test_5_layout_preservation()
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
