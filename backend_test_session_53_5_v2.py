#!/usr/bin/env python3
"""
SESSION 53.5 — RULE 6 RÉVISÉE : Exposant peut CHOISIR/CHANGER son stand
Tests the revised RULE 6 where exposants can select/change their stand with waitlist fallback.
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

def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {message}")

def get_registration_by_id(reg_id):
    """Get registration by ID"""
    try:
        response = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            if 'registration' in data:
                return data['registration']
            return data
        return None
    except Exception as e:
        print(f"Error getting registration: {e}")
        return None

def get_venue_stands(venue_id):
    """Get all stands for a venue"""
    try:
        response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error getting venue stands: {e}")
        return []

def main():
    print("\n" + "="*80)
    print("SESSION 53.5 — RULE 6 RÉVISÉE : EXPOSANT PEUT CHOISIR/CHANGER SON STAND")
    print("="*80)
    
    # ========================================================================
    # SETUP: Prepare test environment
    # ========================================================================
    print_test("SETUP", "Preparing test environment")
    
    try:
        # Use a known registration and temporarily release its stand
        test_reg_id = "reg-fusion-ace-arue-aru"
        
        # Get original state
        original_reg = get_registration_by_id(test_reg_id)
        if not original_reg:
            print_result(False, f"Test registration {test_reg_id} not found")
            return
        
        original_state = {
            'stand_code': original_reg.get('stand_code'),
            'venue_id': original_reg.get('venue_id'),
            'is_pre_reserved': original_reg.get('is_pre_reserved', False),
            'is_waitlist': original_reg.get('is_waitlist', False),
            'status': original_reg.get('status', 'a_confirmer')
        }
        
        print(f"✓ Using test registration: {test_reg_id}")
        print(f"  Original state: venue={original_state['venue_id']}, stand={original_state['stand_code']}")
        
        # Release the stand temporarily
        release_response = requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/release-stand",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if release_response.status_code != 200:
            print_result(False, f"Failed to release stand: {release_response.status_code}")
            return
        
        print("✓ Stand released for testing")
        
        # Get venue stands (use Mahina which has free stands)
        venue_id = 'venue-mah'
        stands = get_venue_stands(venue_id)
        print(f"✓ Venue {venue_id} has {len(stands)} stands")
        
        # Find free stands
        free_stands = [s for s in stands if not s.get('status') or s.get('status') == 'libre']
        print(f"✓ Found {len(free_stands)} free stands")
        
        if len(free_stands) < 2:
            print_result(False, f"Need at least 2 free stands for testing, found {len(free_stands)}")
            return
        
    except Exception as e:
        print_result(False, f"Setup failed: {e}")
        return
    
    # ========================================================================
    # TEST 1: Pré-réservation simple (stand libre)
    # ========================================================================
    print_test(1, "Pré-réservation simple (stand libre)")
    
    try:
        free_stand = free_stands[0]
        print(f"Attempting to reserve stand: {free_stand['stand_code']} (id: {free_stand['id']})")
        
        response = requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
            headers=ADMIN_HEADERS,
            json={"stand_id": free_stand['id']},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response
            if data.get('ok') == True and data.get('stand_code') == free_stand['stand_code']:
                # Verify registration was updated
                updated_reg = get_registration_by_id(test_reg_id)
                if updated_reg and updated_reg.get('stand_code') == free_stand['stand_code']:
                    # Verify stand status in venue_stands
                    updated_stands = get_venue_stands(venue_id)
                    updated_stand = next((s for s in updated_stands if s['id'] == free_stand['id']), None)
                    
                    if updated_stand and updated_stand.get('status') == 'reserved':
                        print_result(True, f"Stand {free_stand['stand_code']} successfully reserved, status='reserved'")
                    else:
                        print_result(False, f"Stand status not updated correctly: {updated_stand.get('status') if updated_stand else 'not found'}")
                else:
                    print_result(False, f"Registration not updated correctly: stand_code={updated_reg.get('stand_code') if updated_reg else 'not found'}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 2: Changement de stand (entre 2 stands libres)
    # ========================================================================
    print_test(2, "Changement de stand (entre 2 stands libres)")
    
    try:
        # Now the registration should have stand A (from TEST 1)
        stand_a = free_stands[0]
        stand_b = free_stands[1]
        
        print(f"Changing from stand A ({stand_a['stand_code']}) to stand B ({stand_b['stand_code']})")
        
        response = requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
            headers=ADMIN_HEADERS,
            json={"stand_id": stand_b['id']},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('ok') == True and data.get('stand_code') == stand_b['stand_code']:
                # Verify old stand A is now libre
                updated_stands = get_venue_stands(venue_id)
                stand_a_updated = next((s for s in updated_stands if s['id'] == stand_a['id']), None)
                stand_b_updated = next((s for s in updated_stands if s['id'] == stand_b['id']), None)
                
                if stand_a_updated and stand_a_updated.get('status') == 'libre':
                    if stand_b_updated and stand_b_updated.get('status') == 'reserved':
                        print_result(True, f"Stand changed successfully: A={stand_a_updated.get('status')}, B={stand_b_updated.get('status')}")
                    else:
                        print_result(False, f"Stand B status incorrect: {stand_b_updated.get('status') if stand_b_updated else 'not found'}")
                else:
                    print_result(False, f"Stand A not freed: {stand_a_updated.get('status') if stand_a_updated else 'not found'}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 3: Conflit (stand déjà pris) - using stand B which is now occupied
    # ========================================================================
    print_test(3, "Conflit (stand déjà pris)")
    
    try:
        # Use another venue with occupied stands (Arue)
        arue_stands = get_venue_stands('venue-aru')
        occupied_stands = [s for s in arue_stands if s.get('status') in ['reserved', 'occupied', 'confirmed']]
        
        if len(occupied_stands) == 0:
            print_result(False, "No occupied stands available for conflict test")
        else:
            occupied_stand = occupied_stands[0]
            print(f"Attempting to reserve occupied stand: {occupied_stand['stand_code']} on venue-aru")
            
            # Find another registration without stand for this test
            regs_response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
            registrations = regs_response.json()
            
            test_reg_2 = None
            for reg in registrations:
                if reg['id'] != test_reg_id and not reg.get('stand_code'):
                    test_reg_2 = reg
                    break
            
            if not test_reg_2:
                # Create a temporary scenario by releasing another stand
                print("No registration without stand found, using current test registration")
                # Release current stand first
                requests.post(f"{BASE_URL}/registrations/{test_reg_id}/release-stand", headers=ADMIN_HEADERS, json={}, timeout=30)
                test_reg_2 = {'id': test_reg_id}
            
            response = requests.post(
                f"{BASE_URL}/registrations/{test_reg_2['id']}/pre-reserve-stand",
                headers=ADMIN_HEADERS,
                json={"stand_id": occupied_stand['id']},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if data.get('ok') == False and data.get('conflict') == True:
                    if 'waitlist_count' in data and 'waitlist_position' in data:
                        print_result(True, f"Conflict detected correctly: waitlist_count={data['waitlist_count']}, waitlist_position={data['waitlist_position']}")
                    else:
                        print_result(False, f"Conflict detected but missing waitlist info: {data}")
                else:
                    print_result(False, f"Expected conflict response, got: {data}")
            else:
                print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 4: Force waitlist
    # ========================================================================
    print_test(4, "Force waitlist")
    
    try:
        # Use the same occupied stand from TEST 3
        arue_stands = get_venue_stands('venue-aru')
        occupied_stands = [s for s in arue_stands if s.get('status') in ['reserved', 'occupied', 'confirmed']]
        
        if len(occupied_stands) == 0:
            print_result(False, "No occupied stands available for waitlist test")
        else:
            occupied_stand = occupied_stands[0]
            print(f"Forcing waitlist on occupied stand: {occupied_stand['stand_code']}")
            
            # Ensure test_reg_id has no stand
            requests.post(f"{BASE_URL}/registrations/{test_reg_id}/release-stand", headers=ADMIN_HEADERS, json={}, timeout=30)
            
            response = requests.post(
                f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
                headers=ADMIN_HEADERS,
                json={"stand_id": occupied_stand['id'], "force_waitlist": True},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if data.get('ok') == True and data.get('request_status') == 'waitlist':
                    if 'waitlist_position' in data and data['waitlist_position'] >= 1:
                        # Verify registration
                        updated_reg = get_registration_by_id(test_reg_id)
                        if updated_reg and updated_reg.get('is_waitlist') == True:
                            print_result(True, f"Waitlist joined successfully: position={data['waitlist_position']}, is_waitlist=True")
                        else:
                            print_result(False, f"Registration not updated correctly: is_waitlist={updated_reg.get('is_waitlist') if updated_reg else 'not found'}")
                    else:
                        print_result(False, f"Invalid waitlist_position: {data.get('waitlist_position')}")
                else:
                    print_result(False, f"Expected waitlist response, got: {data}")
            else:
                print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 5: Candidature verrouillée par admin
    # ========================================================================
    print_test(5, "Candidature verrouillée par admin")
    
    try:
        # First, give the test registration a stand
        free_stand = free_stands[0]
        requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
            headers=ADMIN_HEADERS,
            json={"stand_id": free_stand['id']},
            timeout=30
        )
        
        # Lock the registration via admin validation
        lock_response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/validate",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if lock_response.status_code == 200:
            print("✓ Registration locked via admin validation")
            
            # Try to change stand
            another_free_stand = free_stands[1]
            response = requests.post(
                f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
                headers=ADMIN_HEADERS,
                json={"stand_id": another_free_stand['id']},
                timeout=30
            )
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'verrouillée' in data['error'].lower():
                    print_result(True, f"Correctly blocked with 400: {data['error']}")
                else:
                    print_result(False, f"Got 400 but wrong error message: {data}")
            else:
                print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
            
            # CLEANUP: Unlock the registration
            print("Cleaning up locked registration...")
            unlock_response = requests.post(
                f"{BASE_URL}/admin/registrations/{test_reg_id}/unlock-candidature",
                headers=ADMIN_HEADERS,
                json={},
                timeout=30
            )
            if unlock_response.status_code == 200:
                print("✓ Registration unlocked")
        else:
            print_result(False, f"Failed to lock registration: {lock_response.status_code}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 6: Idempotence (même stand 2 fois)
    # ========================================================================
    print_test(6, "Idempotence (même stand 2 fois)")
    
    try:
        # Ensure registration is unlocked and status is not 'confirme'
        unlock_response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/unlock-candidature",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        # Also update status to a_confirmer
        requests.put(
            f"{BASE_URL}/registrations/{test_reg_id}",
            headers=ADMIN_HEADERS,
            json={"status": "a_confirmer"},
            timeout=30
        )
        print("✓ Ensured registration is unlocked and status=a_confirmer")
        
        # Give the registration a stand first
        free_stand = free_stands[0]
        requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
            headers=ADMIN_HEADERS,
            json={"stand_id": free_stand['id']},
            timeout=30
        )
        
        print(f"Calling pre-reserve-stand with same stand: {free_stand['stand_code']}")
        
        response = requests.post(
            f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
            headers=ADMIN_HEADERS,
            json={"stand_id": free_stand['id']},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('ok') == True:
                print_result(True, "Idempotence handled correctly (no error)")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # TEST 7: Régression auto-rebalance
    # ========================================================================
    print_test(7, "Régression auto-rebalance")
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/rebalance-all-waitlists",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') == True and 'total_promoted' in data:
                print_result(True, f"Auto-rebalance endpoint working: promoted={data['total_promoted']}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    
    except Exception as e:
        print_result(False, f"Exception: {e}")
    
    # ========================================================================
    # CLEANUP
    # ========================================================================
    print_test("CLEANUP", "Restoring original state")
    
    try:
        # Unlock first if locked and reset status
        unlock_response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/unlock-candidature",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        requests.put(
            f"{BASE_URL}/registrations/{test_reg_id}",
            headers=ADMIN_HEADERS,
            json={"status": "a_confirmer"},
            timeout=30
        )
        print("✓ Ensured registration is unlocked for cleanup")
        
        # Restore original stand
        if original_state['stand_code']:
            # Find the original stand
            original_venue_stands = get_venue_stands(original_state['venue_id'])
            original_stand = next((s for s in original_venue_stands if s['stand_code'] == original_state['stand_code']), None)
            
            if original_stand:
                response = requests.post(
                    f"{BASE_URL}/registrations/{test_reg_id}/pre-reserve-stand",
                    headers=ADMIN_HEADERS,
                    json={"stand_id": original_stand['id']},
                    timeout=30
                )
                if response.status_code == 200:
                    print(f"✓ Restored original stand: {original_state['stand_code']}")
                else:
                    print(f"⚠ Failed to restore original stand: {response.status_code} - {response.text}")
        
        print_result(True, "Cleanup completed")
    except Exception as e:
        print_result(False, f"Cleanup failed: {e}")
    
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
