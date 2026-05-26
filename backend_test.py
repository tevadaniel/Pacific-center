#!/usr/bin/env python3
"""
SESSION 47.13 - Backend Testing for Pending/Waitlist Refactor
Tests wizard endpoints and admin validation queue
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
    """Get a free stand from a venue - for testing, we'll use any stand since we're testing conflicts"""
    status, data = make_request("GET", f"/venues/{venue_id}/stands", headers=ADMIN_HEADERS)
    
    if status == 200 and isinstance(data, list):
        # For testing conflict detection, we can use any stand
        # The wizard endpoint will handle the conflict detection
        if len(data) > 0:
            # Return the first stand's venue_stand_id (which is the 'id' field)
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

def test_wizard_stand_workflow():
    """Tests 2-6: Wizard stand workflow with conflicts and waitlist"""
    print("\n=== TESTS 2-6: Wizard Stand Workflow ===")
    
    # Get a free stand
    free_stand = get_free_stand("venue-faaa")
    if not free_stand:
        log_test("Get free stand", False, "No free stand found")
        return
    log_test("Get free stand", True, f"Found free stand: {free_stand}")
    
    # Test 2: Create exposant A and assign stand (should be pending)
    exp_a = create_exposant("expA47-13@test.local", "Org A", "Judo")
    if not exp_a:
        log_test("Create exposant A", False, "Failed to create exposant A")
        return
    log_test("Create exposant A", True, f"Created {exp_a['name']}")
    
    # Test 3: Assign stand to A (should be pending, no conflict)
    stand_data_a = {
        "registration_id": exp_a["registration_id"],
        "venue_stand_id": free_stand
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_a)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        waitlist_position = data.get("waitlist_position")
        log_test("Stand A (free) - pending", 
                 request_status == "pending" and waitlist_position is None,
                 f"request_status={request_status}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand A (free) - pending", False, f"Status {status}, data: {data}")
        return
    
    # Test 4: Create exposant B
    exp_b = create_exposant("expB47-13@test.local", "Org B", "Karate")
    if not exp_b:
        log_test("Create exposant B", False, "Failed to create exposant B")
        return
    log_test("Create exposant B", True, f"Created {exp_b['name']}")
    
    # Test 5: Assign same stand to B without force_waitlist (should conflict)
    stand_data_b = {
        "registration_id": exp_b["registration_id"],
        "venue_stand_id": free_stand
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_b)
    
    if status == 200 and data.get("ok") == False and data.get("conflict") == True:
        owner_name = data.get("owner_name")
        owner_status = data.get("owner_status")
        waitlist_count = data.get("waitlist_count")
        waitlist_position = data.get("waitlist_position")
        message = data.get("message", "")
        
        log_test("Stand B (conflict) - no force", 
                 owner_name == "Org A" and owner_status == "pending" and waitlist_count == 0 and waitlist_position == 1 and "déjà" in message.lower(),
                 f"conflict=true, owner_name={owner_name}, owner_status={owner_status}, waitlist_count={waitlist_count}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand B (conflict) - no force", False, f"Status {status}, data: {data}")
    
    # Test 6: Assign same stand to B with force_waitlist (should be waitlist)
    stand_data_b_force = {
        "registration_id": exp_b["registration_id"],
        "venue_stand_id": free_stand,
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/stand", data=stand_data_b_force)
    
    if status == 200 and data.get("ok") == True:
        request_status = data.get("request_status")
        waitlist_position = data.get("waitlist_position")
        log_test("Stand B (force_waitlist) - waitlist", 
                 request_status == "waitlist" and waitlist_position == 1,
                 f"request_status={request_status}, waitlist_position={waitlist_position}")
    else:
        log_test("Stand B (force_waitlist) - waitlist", False, f"Status {status}, data: {data}")
    
    # Test 7: Create exposant C and assign with force_waitlist (should be waitlist position 2)
    exp_c = create_exposant("expC47-13@test.local", "Org C", "Taekwondo")
    if not exp_c:
        log_test("Create exposant C", False, "Failed to create exposant C")
        return
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
    
    return exp_a, exp_b, exp_c

def test_wizard_animation_workflow(exp_a, exp_b):
    """Tests 8-11: Wizard animation workflow with conflicts and waitlist"""
    print("\n=== TESTS 8-11: Wizard Animation Workflow ===")
    
    # Test 8: Animation A (should be pending)
    anim_data_a = {
        "registration_id": exp_a["registration_id"],
        "animations": [{
            "day_label": "vendredi",
            "location_type": "sur_stand",
            "slot_type": "demo",
            "title": "Démo A",
            "description": "Démonstration de judo pour enfants",
            "target_audience": "enfants",
            "start_time": "10:00",
            "end_time": "11:00"
        }]
    }
    status, data = make_request("POST", "/wizard/animation", data=anim_data_a)
    
    if status == 200 and data.get("ok") == True:
        animations = data.get("animations", [])
        if animations and len(animations) > 0:
            request_status = animations[0].get("request_status")
            log_test("Animation A (free) - pending", 
                     request_status == "pending",
                     f"request_status={request_status}")
        else:
            log_test("Animation A (free) - pending", False, "No animations in response")
    else:
        log_test("Animation A (free) - pending", False, f"Status {status}, data: {data}")
    
    # Test 9: Animation B same slot without force (should conflict)
    anim_data_b = {
        "registration_id": exp_b["registration_id"],
        "animations": [{
            "day_label": "vendredi",
            "location_type": "sur_stand",
            "slot_type": "demo",
            "title": "Démo B",
            "description": "Démonstration de karate",
            "target_audience": "enfants",
            "start_time": "10:00",
            "end_time": "11:00"
        }]
    }
    status, data = make_request("POST", "/wizard/animation", data=anim_data_b)
    
    if status == 200 and data.get("ok") == False and data.get("conflict") == True:
        conflicts = data.get("conflicts", [])
        if conflicts and len(conflicts) > 0:
            owner_name = conflicts[0].get("owner_name")
            log_test("Animation B (conflict) - no force", 
                     owner_name == "Org A",
                     f"conflict=true, owner_name={owner_name}")
        else:
            log_test("Animation B (conflict) - no force", False, "No conflicts in response")
    else:
        log_test("Animation B (conflict) - no force", False, f"Status {status}, data: {data}")
    
    # Test 10: Animation B with force_waitlist (should be waitlist)
    anim_data_b_force = {
        "registration_id": exp_b["registration_id"],
        "animations": [{
            "day_label": "vendredi",
            "location_type": "sur_stand",
            "slot_type": "demo",
            "title": "Démo B",
            "description": "Démonstration de karate",
            "target_audience": "enfants",
            "start_time": "10:00",
            "end_time": "11:00"
        }],
        "force_waitlist": True
    }
    status, data = make_request("POST", "/wizard/animation", data=anim_data_b_force)
    
    if status == 200 and data.get("ok") == True:
        animations = data.get("animations", [])
        if animations and len(animations) > 0:
            request_status = animations[0].get("request_status")
            waitlist_position = animations[0].get("waitlist_position")
            log_test("Animation B (force_waitlist) - waitlist", 
                     request_status == "waitlist" and waitlist_position == 1,
                     f"request_status={request_status}, waitlist_position={waitlist_position}")
        else:
            log_test("Animation B (force_waitlist) - waitlist", False, "No animations in response")
    else:
        log_test("Animation B (force_waitlist) - waitlist", False, f"Status {status}, data: {data}")

def test_mandatory_animation_per_day():
    """Test 12: Mandatory animation per day rule"""
    print("\n=== TEST 12: Mandatory Animation Per Day ===")
    
    # Create exposant D with 2 days from the start
    exp_d_email = "expD47-13@test.local"
    exp_d_name = "Org D"
    
    print(f"\n--- Creating exposant: {exp_d_name} ({exp_d_email}) ---")
    
    # Step 1: Self-register
    status, data = make_request("POST", "/auth/self-register", data={"email": exp_d_email})
    if status != 200 or not data.get("ok"):
        log_test("Create exposant D", False, f"Self-register failed: {status}, {data}")
        return
    
    registration_id = data.get("registration_id")
    organization_id = data.get("organization_id")
    print(f"✓ Self-registered: reg_id={registration_id}, org_id={organization_id}")
    
    # Step 2: Profile
    profile_data = {
        "registration_id": registration_id,
        "profile": {
            "name": exp_d_name,
            "discipline": "Natation",
            "contact_name": exp_d_name,
            "main_email": exp_d_email,
            "representatives_count": 2
        }
    }
    status, data = make_request("POST", "/wizard/profile", data=profile_data)
    if status != 200 or not data.get("ok"):
        log_test("Create exposant D", False, f"Profile failed: {status}, {data}")
        return
    print(f"✓ Profile completed: next_step={data.get('next_step')}")
    
    # Step 3: Days - with BOTH vendredi and samedi
    days_data = {
        "registration_id": registration_id,
        "venue_id": "venue-faaa",
        "attending_days": ["vendredi", "samedi"],
        "attending_day_times": {
            "vendredi": {
                "start": "09:00",
                "end": "17:00"
            },
            "samedi": {
                "start": "09:00",
                "end": "17:00"
            }
        }
    }
    status, data = make_request("POST", "/wizard/days", data=days_data)
    if status != 200 or not data.get("ok"):
        log_test("Create exposant D", False, f"Days failed: {status}, {data}")
        return
    print(f"✓ Days completed with vendredi+samedi")
    
    log_test("Create exposant D", True, f"Created {exp_d_name}")
    
    # Try to submit animation with only vendredi (should fail with 400)
    anim_data_d = {
        "registration_id": registration_id,
        "animations": [{
            "day_label": "vendredi",
            "location_type": "sur_stand",
            "slot_type": "demo",
            "title": "Démo D",
            "description": "Démonstration de natation pour enfants",
            "target_audience": "enfants",
            "start_time": "11:00",
            "end_time": "12:00"
        }]
    }
    status, data = make_request("POST", "/wizard/animation", data=anim_data_d)
    
    if status == 400:
        message = data.get("error", "") or data.get("message", "")
        log_test("Mandatory animation per day - missing samedi", 
                 "créneau" in message.lower() and "manquant" in message.lower() and "samedi" in message.lower(),
                 f"Status 400, message contains 'Créneau d'animation manquant' and 'samedi': {message}")
    else:
        log_test("Mandatory animation per day - missing samedi", False, f"Status {status}, expected 400, data: {data}")

def test_admin_validation_queue():
    """Tests 13-24: Admin validation queue endpoints"""
    print("\n=== TESTS 13-24: Admin Validation Queue ===")
    
    # Test 13: GET queue without admin (should be 403)
    status, data = make_request("GET", "/admin/validation-queue")
    log_test("GET queue without admin - 403", 
             status == 403,
             f"Status {status}")
    
    # Test 14: GET queue with admin (should return items)
    status, data = make_request("GET", "/admin/validation-queue", headers=ADMIN_HEADERS)
    
    if status == 200:
        items = data.get("items", [])
        total = data.get("total", 0)
        counts = data.get("counts", {})
        deadline_at = data.get("deadline_at")
        
        # Check FIFO ordering (sorted by request_submitted_at ASC)
        is_fifo = True
        if len(items) > 1:
            for i in range(len(items) - 1):
                if items[i].get("request_submitted_at", "") > items[i+1].get("request_submitted_at", ""):
                    is_fifo = False
                    break
        
        log_test("GET queue with admin - structure and FIFO", 
                 len(items) > 0 and total >= 4 and counts.get("pending", 0) >= 1 and counts.get("waitlist", 0) >= 2 and is_fifo,
                 f"items={len(items)}, total={total}, counts={counts}, FIFO={is_fifo}")
    else:
        log_test("GET queue with admin - structure and FIFO", False, f"Status {status}, data: {data}")
    
    # Test 15: Filter status=pending
    status, data = make_request("GET", "/admin/validation-queue?status=pending", headers=ADMIN_HEADERS)
    
    if status == 200:
        items = data.get("items", [])
        all_pending = all(item.get("request_status") == "pending" for item in items)
        log_test("Filter status=pending", 
                 all_pending,
                 f"All {len(items)} items have request_status='pending'")
    else:
        log_test("Filter status=pending", False, f"Status {status}")
    
    # Test 16: Filter type=stand
    status, data = make_request("GET", "/admin/validation-queue?type=stand", headers=ADMIN_HEADERS)
    
    if status == 200:
        items = data.get("items", [])
        all_stand = all(item.get("type") == "stand" for item in items)
        log_test("Filter type=stand", 
                 all_stand,
                 f"All {len(items)} items have type='stand'")
    else:
        log_test("Filter type=stand", False, f"Status {status}")
    
    # Test 17: Filter site=venue-faaa
    status, data = make_request("GET", "/admin/validation-queue?site=venue-faaa", headers=ADMIN_HEADERS)
    
    if status == 200:
        items = data.get("items", [])
        all_faaa = all(item.get("venue", {}).get("id") == "venue-faaa" for item in items)
        log_test("Filter site=venue-faaa", 
                 all_faaa,
                 f"All {len(items)} items are from venue-faaa")
    else:
        log_test("Filter site=venue-faaa", False, f"Status {status}")
    
    # Get a pending stand assignment for validation tests
    status, data = make_request("GET", "/admin/validation-queue?status=pending&type=stand", headers=ADMIN_HEADERS)
    pending_stand_id = None
    if status == 200 and len(data.get("items", [])) > 0:
        pending_stand_id = data["items"][0].get("id")
    
    if not pending_stand_id:
        print("⚠️ No pending stand found for validation tests")
        return
    
    # Test 18: POST validate
    status, data = make_request("POST", f"/admin/validation/{pending_stand_id}/validate", headers=ADMIN_HEADERS)
    
    if status == 200:
        request_status = data.get("request_status")
        log_test("POST validate", 
                 request_status == "validated",
                 f"request_status={request_status}")
        
        # Verify in queue
        time.sleep(0.5)
        status2, data2 = make_request("GET", f"/admin/validation-queue?status=validated", headers=ADMIN_HEADERS)
        if status2 == 200:
            validated_items = [item for item in data2.get("items", []) if item.get("id") == pending_stand_id]
            print(f"   Verified in queue: {len(validated_items)} validated items found")
    else:
        log_test("POST validate", False, f"Status {status}, data: {data}")
    
    # Get another pending stand for refuse test
    status, data = make_request("GET", "/admin/validation-queue?status=pending&type=stand", headers=ADMIN_HEADERS)
    pending_stand_id_2 = None
    if status == 200 and len(data.get("items", [])) > 0:
        pending_stand_id_2 = data["items"][0].get("id")
    
    if pending_stand_id_2:
        # Test 19: POST refuse
        status, data = make_request("POST", f"/admin/validation/{pending_stand_id_2}/refuse", 
                                   headers=ADMIN_HEADERS, 
                                   data={"reason": "Doublon"})
        
        if status == 200:
            request_status = data.get("request_status")
            refused_reason = data.get("refused_reason")
            next_in_waitlist = data.get("next_in_waitlist")
            log_test("POST refuse", 
                     request_status == "refused" and refused_reason == "Doublon",
                     f"request_status={request_status}, refused_reason={refused_reason}, next_in_waitlist={next_in_waitlist}")
        else:
            log_test("POST refuse", False, f"Status {status}, data: {data}")
    else:
        print("⚠️ No second pending stand found for refuse test")
    
    # Test 20: POST bulk validate
    status, data = make_request("GET", "/admin/validation-queue?status=pending", headers=ADMIN_HEADERS)
    bulk_ids = []
    if status == 200 and len(data.get("items", [])) >= 2:
        bulk_ids = [data["items"][0].get("id"), data["items"][1].get("id")]
    
    if len(bulk_ids) >= 1:
        status, data = make_request("POST", "/admin/validation/bulk", 
                                   headers=ADMIN_HEADERS,
                                   data={"ids": bulk_ids, "type": "stand", "action": "validate"})
        
        if status == 200:
            modified = data.get("modified", 0)
            log_test("POST bulk validate", 
                     modified >= 1,
                     f"modified={modified}")
        else:
            log_test("POST bulk validate", False, f"Status {status}, data: {data}")
    else:
        print("⚠️ Not enough pending items for bulk test")
    
    # Test 21: POST bulk without admin (should be 403)
    status, data = make_request("POST", "/admin/validation/bulk", 
                               data={"ids": ["test"], "type": "stand", "action": "validate"})
    log_test("POST bulk without admin - 403", 
             status == 403,
             f"Status {status}")
    
    # Test 22: POST validation-deadline
    deadline = "2026-08-01T23:59:00.000Z"
    status, data = make_request("POST", "/admin/validation-deadline", 
                               headers=ADMIN_HEADERS,
                               data={"deadline": deadline})
    
    if status == 200:
        deadline_at = data.get("deadline_at")
        log_test("POST validation-deadline", 
                 deadline_at == deadline,
                 f"deadline_at={deadline_at}")
    else:
        log_test("POST validation-deadline", False, f"Status {status}, data: {data}")
    
    # Test 23: GET validation-deadline
    status, data = make_request("GET", "/admin/validation-deadline", headers=ADMIN_HEADERS)
    
    if status == 200:
        deadline_at = data.get("deadline_at")
        log_test("GET validation-deadline", 
                 deadline_at == deadline,
                 f"deadline_at={deadline_at}")
    else:
        log_test("GET validation-deadline", False, f"Status {status}, data: {data}")
    
    # Test 24: POST validate without admin (should be 403)
    status, data = make_request("POST", "/admin/validation/test-id/validate")
    log_test("POST validate without admin - 403", 
             status == 403,
             f"Status {status}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY - SESSION 47.13 Pending/Waitlist Backend")
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
    print("SESSION 47.13 - Backend Testing for Pending/Waitlist Refactor")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Test 1: Seed
    if not test_seed():
        print("\n❌ CRITICAL: Seed failed, cannot continue tests")
        print_summary()
        return
    
    # Tests 2-7: Wizard stand workflow
    exposants = test_wizard_stand_workflow()
    if not exposants:
        print("\n❌ CRITICAL: Stand workflow failed")
        print_summary()
        return
    
    exp_a, exp_b, exp_c = exposants
    
    # Tests 8-11: Wizard animation workflow
    test_wizard_animation_workflow(exp_a, exp_b)
    
    # Test 12: Mandatory animation per day
    test_mandatory_animation_per_day()
    
    # Tests 13-24: Admin validation queue
    test_admin_validation_queue()
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
