#!/usr/bin/env python3
"""
Backend test for VALIDATION CRITIQUE — Règle métier "1 animation OBLIGATOIRE par jour de présence"

Tests the new validation rule that blocks stand validation if animations are missing for any attending day.
"""

import requests
import json
import sys
from datetime import datetime
import uuid

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

def log_test(test_name, status, message=""):
    """Log test results"""
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{symbol} TEST {test_name}: {status}")
    if message:
        print(f"   {message}")
    print()

def create_test_stand_assignment(reg_id, venue_stand_id, stand_code):
    """Create a test stand assignment via wizard endpoint"""
    try:
        # Use the wizard/finalize endpoint to create a stand assignment
        response = requests.post(
            f"{BASE_URL}/wizard/finalize",
            json={
                "registration_id": reg_id,
                "venue_stand_id": venue_stand_id,
                "stand_code": stand_code
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Stand assignment created via wizard/finalize")
            return True
        else:
            print(f"⚠️ wizard/finalize returned {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Failed to create stand assignment: {str(e)}")
        return False

def test_setup():
    """Setup: Seed database and prepare test data"""
    print("=" * 80)
    print("SETUP: Preparing test environment")
    print("=" * 80)
    
    try:
        # Seed database
        print("Step 1: Seeding database with force=true...")
        seed_response = requests.post(
            f"{BASE_URL}/seed",
            json={"force": True},
            headers=ADMIN_HEADERS,
            timeout=60
        )
        
        if seed_response.status_code == 200:
            seed_data = seed_response.json()
            print(f"✅ Seed successful: {seed_data.get('associations', 0)} associations, {seed_data.get('stands_planned', 0)} stands")
        else:
            print(f"⚠️ Seed returned {seed_response.status_code}")
        
        # Get a registration to work with
        print("\nStep 2: Getting a test registration...")
        regs_response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if regs_response.status_code != 200:
            print(f"❌ Failed to get registrations: {regs_response.status_code}")
            return None
        
        registrations = regs_response.json()
        
        # Find a registration with attending_days
        test_reg = None
        for reg in registrations[:10]:
            # Check if it has friday_slot_label and saturday_slot_label = "Oui"
            if reg.get('friday_slot_label') == 'Oui' and reg.get('saturday_slot_label') == 'Oui':
                test_reg = reg
                print(f"✅ Found test registration: {reg.get('id')}")
                print(f"   Organization: {reg.get('organization', {}).get('name', 'N/A')}")
                print(f"   Stand: {reg.get('stand_code', 'N/A')}")
                print(f"   Venue: {reg.get('venue', {}).get('name', 'N/A')}")
                break
        
        if not test_reg:
            print("⚠️ No suitable registration found")
            return None
        
        # Create a stand assignment for this registration using wizard
        print("\nStep 3: Creating stand assignment for testing...")
        
        # Get venue stands
        venue_id = test_reg.get('venue_id')
        stands_response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if stands_response.status_code == 200:
            stands = stands_response.json()
            if stands:
                # Use the first available stand
                test_stand = stands[0]
                venue_stand_id = test_stand.get('id')
                stand_code = test_stand.get('stand_code')
                
                print(f"   Using stand: {stand_code} (id: {venue_stand_id})")
                
                # Note: We'll work with the registration as-is since the seed already creates them
                # The validation queue will show them if they have stand_assignments
                
        return test_reg
        
    except Exception as e:
        print(f"❌ Setup failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_case_1_no_animations(reg):
    """Test Case 1: Validation blocked when no animations exist"""
    print("=" * 80)
    print("TEST CASE 1: Validation BLOCKED (no animations at all)")
    print("=" * 80)
    
    if not reg:
        log_test("1", "SKIP", "No test registration available")
        return
    
    try:
        reg_id = reg.get('id')
        
        # First, create a stand assignment by submitting a validation request
        print(f"Creating validation request for registration {reg_id}...")
        
        # Delete any existing animations first
        print("Deleting existing animations...")
        anims_response = requests.get(
            f"{BASE_URL}/animation-slots",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if anims_response.status_code == 200:
            all_anims = anims_response.json()
            for anim in all_anims:
                if anim.get('registration_id') == reg_id:
                    anim_id = anim.get('id')
                    print(f"  Deleting animation {anim_id}...")
                    requests.delete(
                        f"{BASE_URL}/animation-slots/{anim_id}",
                        headers=ADMIN_HEADERS,
                        timeout=30
                    )
        
        # Submit validation request to create stand_assignment
        print(f"\nSubmitting validation request...")
        submit_response = requests.post(
            f"{BASE_URL}/registrations/{reg_id}/request-validation",
            json={
                "preferred_payment": "cheque",
                "rdv_proposal": "",
                "notes": "Test validation request"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if submit_response.status_code in [200, 201]:
            print(f"✅ Validation request submitted")
        else:
            print(f"⚠️ Validation request returned {submit_response.status_code}: {submit_response.text[:200]}")
        
        # Now get the validation queue to find the stand_assignment
        print("\nGetting validation queue...")
        queue_response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if queue_response.status_code != 200:
            log_test("1", "FAIL", f"Could not get validation queue: {queue_response.status_code}")
            return
        
        queue_data = queue_response.json()
        items = queue_data.get('items', [])
        
        # Find our registration's stand assignment
        stand_asn = None
        for item in items:
            if item.get('registration_id') == reg_id and item.get('type') == 'stand':
                stand_asn = item
                break
        
        if not stand_asn:
            log_test("1", "SKIP", f"No stand assignment found in queue for {reg_id}")
            return
        
        stand_asn_id = stand_asn.get('id')
        print(f"Found stand assignment: {stand_asn_id}")
        print(f"  Animations count: {stand_asn.get('animations_count')}")
        print(f"  Animations complete: {stand_asn.get('animations_complete')}")
        print(f"  Missing days: {stand_asn.get('missing_animation_days')}")
        
        # Try to validate the stand (should fail)
        print(f"\nAttempting to validate stand {stand_asn_id}...")
        response = requests.post(
            f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
            json={},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 422:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            
            # Check if error message contains expected text
            if "Validation impossible" in error_msg and "animation" in error_msg.lower() and "OBLIGATOIRE" in error_msg:
                log_test("1", "PASS", f"Validation correctly blocked with proper error message")
            else:
                log_test("1", "FAIL", f"Wrong error message: {error_msg}")
        else:
            log_test("1", "FAIL", f"Expected 422, got {response.status_code}")
            
    except Exception as e:
        log_test("1", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def test_case_2_partial_animations(reg):
    """Test Case 2: Validation blocked when only 1 day has animation (out of 2)"""
    print("=" * 80)
    print("TEST CASE 2: Validation BLOCKED (1 day missing animation)")
    print("=" * 80)
    
    if not reg:
        log_test("2", "SKIP", "No test registration available")
        return
    
    try:
        reg_id = reg.get('id')
        venue_id = reg.get('venue_id')
        
        print(f"Registration: {reg_id}")
        print(f"Venue: {venue_id}")
        
        # Create animation for only Friday
        print(f"\nCreating animation for vendredi only...")
        animation_data = {
            "registration_id": reg_id,
            "venue_id": venue_id,
            "day_label": "vendredi",
            "event_date": "2026-08-14",
            "start_time": "10:00",
            "end_time": "11:00",
            "location_type": "sur_stand",
            "title": "Test animation vendredi",
            "description": "Test animation for validation rule"
        }
        
        anim_response = requests.post(
            f"{BASE_URL}/animation-slots",
            json=animation_data,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if anim_response.status_code in [200, 201]:
            print(f"✅ Animation created for vendredi")
        else:
            print(f"⚠️ Animation creation returned {anim_response.status_code}: {anim_response.text[:200]}")
        
        # Get the validation queue to find the stand_assignment
        print("\nGetting validation queue...")
        queue_response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if queue_response.status_code != 200:
            log_test("2", "FAIL", f"Could not get validation queue: {queue_response.status_code}")
            return
        
        queue_data = queue_response.json()
        items = queue_data.get('items', [])
        
        # Find our registration's stand assignment
        stand_asn = None
        for item in items:
            if item.get('registration_id') == reg_id and item.get('type') == 'stand':
                stand_asn = item
                break
        
        if not stand_asn:
            log_test("2", "SKIP", f"No stand assignment found in queue for {reg_id}")
            return
        
        stand_asn_id = stand_asn.get('id')
        print(f"Found stand assignment: {stand_asn_id}")
        print(f"  Animations count: {stand_asn.get('animations_count')}")
        print(f"  Animations complete: {stand_asn.get('animations_complete')}")
        print(f"  Missing days: {stand_asn.get('missing_animation_days')}")
        
        # Try to validate the stand (should fail because Saturday is missing)
        print(f"\nAttempting to validate stand {stand_asn_id}...")
        response = requests.post(
            f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
            json={},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 422:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            
            # Check if error mentions samedi
            if "Validation impossible" in error_msg and "samedi" in error_msg.lower():
                log_test("2", "PASS", f"Validation correctly blocked for missing samedi")
            else:
                log_test("2", "FAIL", f"Error message doesn't mention missing samedi: {error_msg}")
        else:
            log_test("2", "FAIL", f"Expected 422, got {response.status_code}")
            
    except Exception as e:
        log_test("2", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def test_case_3_complete_animations(reg):
    """Test Case 3: Validation OK when all days have animations"""
    print("=" * 80)
    print("TEST CASE 3: Validation OK (all animations present)")
    print("=" * 80)
    
    if not reg:
        log_test("3", "SKIP", "No test registration available")
        return
    
    try:
        reg_id = reg.get('id')
        venue_id = reg.get('venue_id')
        
        print(f"Registration: {reg_id}")
        
        # Create animation for Saturday (Friday already exists from test 2)
        print(f"\nCreating animation for samedi...")
        animation_data = {
            "registration_id": reg_id,
            "venue_id": venue_id,
            "day_label": "samedi",
            "event_date": "2026-08-15",
            "start_time": "14:00",
            "end_time": "15:00",
            "location_type": "sur_stand",
            "title": "Test animation samedi",
            "description": "Test animation for samedi"
        }
        
        anim_response = requests.post(
            f"{BASE_URL}/animation-slots",
            json=animation_data,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if anim_response.status_code in [200, 201]:
            print(f"✅ Animation created for samedi")
        else:
            print(f"⚠️ Animation creation returned {anim_response.status_code}: {anim_response.text[:200]}")
        
        # Get the validation queue
        print("\nGetting validation queue...")
        queue_response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if queue_response.status_code != 200:
            log_test("3", "FAIL", f"Could not get validation queue: {queue_response.status_code}")
            return
        
        queue_data = queue_response.json()
        items = queue_data.get('items', [])
        
        # Find our registration's stand assignment
        stand_asn = None
        for item in items:
            if item.get('registration_id') == reg_id and item.get('type') == 'stand':
                stand_asn = item
                break
        
        if not stand_asn:
            log_test("3", "SKIP", f"No stand assignment found in queue for {reg_id}")
            return
        
        stand_asn_id = stand_asn.get('id')
        print(f"Found stand assignment: {stand_asn_id}")
        print(f"  Animations count: {stand_asn.get('animations_count')}")
        print(f"  Animations complete: {stand_asn.get('animations_complete')}")
        print(f"  Missing days: {stand_asn.get('missing_animation_days')}")
        
        # Try to validate the stand (should succeed now)
        print(f"\nAttempting to validate stand {stand_asn_id}...")
        response = requests.post(
            f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
            json={},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and data.get('request_status') == 'validated':
                log_test("3", "PASS", "Stand validated successfully with all animations present")
            else:
                log_test("3", "FAIL", f"Unexpected response structure: {data}")
        else:
            log_test("3", "FAIL", f"Expected 200, got {response.status_code}: {response.text[:200]}")
            
    except Exception as e:
        log_test("3", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def test_case_4_force_validate(reg):
    """Test Case 4: Force validate bypasses animation check"""
    print("=" * 80)
    print("TEST CASE 4: Force validate (bypass animation check)")
    print("=" * 80)
    
    if not reg:
        log_test("4", "SKIP", "No test registration available")
        return
    
    try:
        # Create a new test registration for this test
        print("Creating a new test registration for force validate test...")
        
        # Get organizations
        orgs_response = requests.get(
            f"{BASE_URL}/organizations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if orgs_response.status_code != 200:
            log_test("4", "SKIP", "Could not get organizations")
            return
        
        orgs = orgs_response.json()
        if len(orgs) < 2:
            log_test("4", "SKIP", "Not enough organizations")
            return
        
        # Use a different organization
        test_org = orgs[1]
        org_id = test_org.get('id')
        
        # Create a registration
        print(f"Using organization: {test_org.get('name')}")
        
        # Get registrations for this org
        regs_response = requests.get(
            f"{BASE_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if regs_response.status_code != 200:
            log_test("4", "SKIP", "Could not get registrations")
            return
        
        all_regs = regs_response.json()
        test_reg_4 = None
        for r in all_regs:
            if r.get('organization_id') == org_id:
                test_reg_4 = r
                break
        
        if not test_reg_4:
            log_test("4", "SKIP", f"No registration found for org {org_id}")
            return
        
        reg_id = test_reg_4.get('id')
        
        # Delete all animations for this registration
        print(f"\nDeleting animations for {reg_id}...")
        anims_response = requests.get(
            f"{BASE_URL}/animation-slots",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if anims_response.status_code == 200:
            all_anims = anims_response.json()
            for anim in all_anims:
                if anim.get('registration_id') == reg_id:
                    anim_id = anim.get('id')
                    requests.delete(
                        f"{BASE_URL}/animation-slots/{anim_id}",
                        headers=ADMIN_HEADERS,
                        timeout=30
                    )
        
        # Submit validation request
        print(f"\nSubmitting validation request for {reg_id}...")
        submit_response = requests.post(
            f"{BASE_URL}/registrations/{reg_id}/request-validation",
            json={
                "preferred_payment": "cheque",
                "rdv_proposal": "",
                "notes": "Test force validate"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if submit_response.status_code not in [200, 201]:
            print(f"⚠️ Validation request returned {submit_response.status_code}")
        
        # Get the stand assignment from queue
        queue_response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if queue_response.status_code != 200:
            log_test("4", "FAIL", f"Could not get validation queue")
            return
        
        queue_data = queue_response.json()
        items = queue_data.get('items', [])
        
        stand_asn = None
        for item in items:
            if item.get('registration_id') == reg_id:
                stand_asn = item
                break
        
        if not stand_asn:
            log_test("4", "SKIP", f"No stand assignment found for {reg_id}")
            return
        
        stand_asn_id = stand_asn.get('id')
        print(f"Found stand assignment: {stand_asn_id}")
        
        # Try force validate
        print(f"\nAttempting force validate on stand {stand_asn_id}...")
        response = requests.post(
            f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
            json={"force_validate": True},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                log_test("4", "PASS", "Force validate bypassed animation check successfully")
            else:
                log_test("4", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("4", "FAIL", f"Expected 200, got {response.status_code}: {response.text[:200]}")
            
    except Exception as e:
        log_test("4", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def test_case_6_queue_enrichment():
    """Test Case 6: Validation queue enriched with animation status"""
    print("=" * 80)
    print("TEST CASE 6: Validation queue enrichment")
    print("=" * 80)
    
    try:
        print("Getting validation queue...")
        response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("6", "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        data = response.json()
        items = data.get('items', [])
        
        print(f"Found {len(items)} items in queue")
        
        # Check that stand items have the required fields
        stand_items = [item for item in items if item.get('type') == 'stand']
        
        if not stand_items:
            log_test("6", "SKIP", "No stand items in queue")
            return
        
        # Check first stand item for required fields
        first_stand = stand_items[0]
        
        required_fields = ['animations_count', 'animations_complete', 'missing_animation_days']
        missing_fields = [field for field in required_fields if field not in first_stand]
        
        if missing_fields:
            log_test("6", "FAIL", f"Missing fields in queue item: {missing_fields}")
            return
        
        print(f"\nSample stand item:")
        print(f"  ID: {first_stand.get('id')}")
        print(f"  Organization: {first_stand.get('organization', {}).get('name')}")
        print(f"  Attending days: {first_stand.get('attending_days')}")
        print(f"  Animations count: {first_stand.get('animations_count')}")
        print(f"  Animations complete: {first_stand.get('animations_complete')}")
        print(f"  Missing animation days: {first_stand.get('missing_animation_days')}")
        
        # Verify types
        animations_count = first_stand.get('animations_count')
        animations_complete = first_stand.get('animations_complete')
        missing_days = first_stand.get('missing_animation_days')
        
        if isinstance(animations_count, int) and isinstance(animations_complete, bool) and isinstance(missing_days, list):
            log_test("6", "PASS", "Queue enrichment fields present with correct types")
        else:
            log_test("6", "FAIL", f"Type error: animations_count={type(animations_count)}, animations_complete={type(animations_complete)}, missing_days={type(missing_days)}")
            
    except Exception as e:
        log_test("6", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def test_case_7_animation_validation():
    """Test Case 7: Animation validation (not a stand) should work without animation check"""
    print("=" * 80)
    print("TEST CASE 7: Animation validation (rule doesn't apply)")
    print("=" * 80)
    
    try:
        # Get validation queue for animations
        print("Getting animation validation queue...")
        response = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=animation&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("7", "SKIP", f"Could not get animation queue: {response.status_code}")
            return
        
        data = response.json()
        items = data.get('items', [])
        
        anim_items = [item for item in items if item.get('type') == 'animation']
        
        if not anim_items:
            log_test("7", "SKIP", "No pending animations in queue")
            return
        
        anim_id = anim_items[0].get('id')
        
        print(f"Attempting to validate animation {anim_id}...")
        validate_response = requests.post(
            f"{BASE_URL}/admin/validation/{anim_id}/validate",
            json={},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        print(f"Response status: {validate_response.status_code}")
        print(f"Response body: {validate_response.text[:300]}")
        
        if validate_response.status_code == 200:
            data = validate_response.json()
            if data.get('ok') and data.get('kind') == 'animation':
                log_test("7", "PASS", "Animation validated without animation check (as expected)")
            else:
                log_test("7", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("7", "FAIL", f"Expected 200, got {validate_response.status_code}")
            
    except Exception as e:
        log_test("7", "FAIL", f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    """Main test runner"""
    print("\n" + "=" * 80)
    print("VALIDATION CRITIQUE — Backend Test Suite")
    print("Testing: 1 animation OBLIGATOIRE par jour de présence")
    print("=" * 80 + "\n")
    
    # Setup
    test_reg = test_setup()
    
    if not test_reg:
        print("\n❌ Setup failed, cannot continue with tests")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("RUNNING TEST CASES")
    print("=" * 80 + "\n")
    
    # Run test cases in sequence
    test_case_1_no_animations(test_reg)
    test_case_2_partial_animations(test_reg)
    test_case_3_complete_animations(test_reg)
    test_case_4_force_validate(test_reg)
    # Skip test 5 (bulk) for now as it requires multiple stands
    test_case_6_queue_enrichment()
    test_case_7_animation_validation()
    
    print("\n" + "=" * 80)
    print("TEST SUITE COMPLETE")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
