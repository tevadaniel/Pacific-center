#!/usr/bin/env python3
"""
Focused Backend Test for VALIDATION CRITIQUE
Tests the 1 animation OBLIGATOIRE par jour de présence rule
"""

import requests
import json

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

def log_test(num, status, msg=""):
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"\n{symbol} TEST {num}: {status}")
    if msg:
        print(f"   {msg}")

print("=" * 80)
print("VALIDATION CRITIQUE — Focused Backend Test")
print("=" * 80)

# Get the stand assignment ID
print("\n1. Getting stand assignment from validation queue...")
queue_resp = requests.get(
    f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
    headers=ADMIN_HEADERS,
    timeout=30
)

if queue_resp.status_code != 200:
    print(f"❌ Failed to get queue: {queue_resp.status_code}")
    exit(1)

queue_data = queue_resp.json()
items = queue_data.get('items', [])

if not items:
    print("❌ No pending stands in queue")
    exit(1)

stand_item = items[0]
stand_asn_id = stand_item.get('id')
reg_id = stand_item.get('registration_id')

print(f"✅ Found stand assignment: {stand_asn_id}")
print(f"   Registration: {reg_id}")
print(f"   Organization: {stand_item.get('organization', {}).get('name')}")
print(f"   Attending days: {stand_item.get('attending_days')}")
print(f"   Animations count: {stand_item.get('animations_count')}")
print(f"   Animations complete: {stand_item.get('animations_complete')}")
print(f"   Missing days: {stand_item.get('missing_animation_days')}")

# TEST 1: Validation blocked with no animations
print("\n" + "=" * 80)
print("TEST 1: Validation BLOCKED (no animations)")
print("=" * 80)

# Delete all animations first
print("Deleting existing animations...")
anims_resp = requests.get(f"{BASE_URL}/animation-slots", headers=ADMIN_HEADERS, timeout=30)
if anims_resp.status_code == 200:
    all_anims = anims_resp.json()
    for anim in all_anims:
        if anim.get('registration_id') == reg_id:
            anim_id = anim.get('id')
            print(f"  Deleting {anim_id}...")
            requests.delete(f"{BASE_URL}/animation-slots/{anim_id}", headers=ADMIN_HEADERS, timeout=30)

# Try to validate
print(f"\nAttempting to validate stand {stand_asn_id}...")
val_resp = requests.post(
    f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
    json={},
    headers=ADMIN_HEADERS,
    timeout=30
)

print(f"Response: {val_resp.status_code}")
print(f"Body: {val_resp.text[:400]}")

if val_resp.status_code == 422:
    error = val_resp.json().get('error', '')
    if "Validation impossible" in error and "animation" in error.lower() and "OBLIGATOIRE" in error:
        log_test("1", "PASS", "Validation correctly blocked with proper error message")
    else:
        log_test("1", "FAIL", f"Wrong error: {error}")
else:
    log_test("1", "FAIL", f"Expected 422, got {val_resp.status_code}")

# TEST 2: Validation blocked with only 1 animation (vendredi)
print("\n" + "=" * 80)
print("TEST 2: Validation BLOCKED (only vendredi animation)")
print("=" * 80)

print("Creating animation for vendredi...")
anim_data = {
    "registration_id": reg_id,
    "venue_id": stand_item.get('venue', {}).get('id'),
    "day_label": "vendredi",
    "event_date": "2026-08-14",
    "start_time": "10:00",
    "end_time": "11:00",
    "location_type": "sur_stand",
    "slot_type": "stand_1h",
    "title": "Test animation vendredi",
    "description": "Test"
}

anim_resp = requests.post(
    f"{BASE_URL}/animation-slots",
    json=anim_data,
    headers=ADMIN_HEADERS,
    timeout=30
)

if anim_resp.status_code in [200, 201]:
    print("✅ Animation created")
else:
    print(f"⚠️ Animation creation: {anim_resp.status_code} - {anim_resp.text[:200]}")

# Try to validate
print(f"\nAttempting to validate stand {stand_asn_id}...")
val_resp2 = requests.post(
    f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
    json={},
    headers=ADMIN_HEADERS,
    timeout=30
)

print(f"Response: {val_resp2.status_code}")
print(f"Body: {val_resp2.text[:400]}")

if val_resp2.status_code == 422:
    error = val_resp2.json().get('error', '')
    if "samedi" in error.lower():
        log_test("2", "PASS", "Validation correctly blocked for missing samedi")
    else:
        log_test("2", "FAIL", f"Error doesn't mention samedi: {error}")
else:
    log_test("2", "FAIL", f"Expected 422, got {val_resp2.status_code}")

# TEST 3: Validation OK with both animations
print("\n" + "=" * 80)
print("TEST 3: Validation OK (both animations present)")
print("=" * 80)

print("Creating animation for samedi...")
anim_data2 = {
    "registration_id": reg_id,
    "venue_id": stand_item.get('venue', {}).get('id'),
    "day_label": "samedi",
    "event_date": "2026-08-15",
    "start_time": "14:00",
    "end_time": "15:00",
    "location_type": "sur_stand",
    "slot_type": "stand_1h",
    "title": "Test animation samedi",
    "description": "Test"
}

anim_resp2 = requests.post(
    f"{BASE_URL}/animation-slots",
    json=anim_data2,
    headers=ADMIN_HEADERS,
    timeout=30
)

if anim_resp2.status_code in [200, 201]:
    print("✅ Animation created")
else:
    print(f"⚠️ Animation creation: {anim_resp2.status_code} - {anim_resp2.text[:200]}")

# Try to validate
print(f"\nAttempting to validate stand {stand_asn_id}...")
val_resp3 = requests.post(
    f"{BASE_URL}/admin/validation/{stand_asn_id}/validate",
    json={},
    headers=ADMIN_HEADERS,
    timeout=30
)

print(f"Response: {val_resp3.status_code}")
print(f"Body: {val_resp3.text[:400]}")

if val_resp3.status_code == 200:
    data = val_resp3.json()
    if data.get('ok') and data.get('request_status') == 'validated':
        log_test("3", "PASS", "Stand validated successfully with all animations")
    else:
        log_test("3", "FAIL", f"Unexpected response: {data}")
else:
    log_test("3", "FAIL", f"Expected 200, got {val_resp3.status_code}")

# TEST 4: Force validate (create another stand assignment for this test)
print("\n" + "=" * 80)
print("TEST 4: Force validate bypasses animation check")
print("=" * 80)

# Get another registration
print("Finding another registration for force validate test...")
regs_resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
if regs_resp.status_code == 200:
    all_regs = regs_resp.json()
    test_reg_2 = None
    for r in all_regs[1:5]:  # Skip first, try next few
        if r.get('id') != reg_id:
            test_reg_2 = r
            break
    
    if test_reg_2:
        reg_id_2 = test_reg_2.get('id')
        print(f"Using registration: {reg_id_2}")
        
        # Update this registration to have attending_days and a stand_assignment with request_status
        import subprocess
        subprocess.run([
            "mongosh", "mongodb://localhost:27017/your_database_name", "--quiet", "--eval",
            f"""
            db.registrations.updateOne(
              {{id: '{reg_id_2}'}},
              {{$set: {{attending_days: ['vendredi', 'samedi']}}}}
            );
            
            var existing = db.stand_assignments.findOne({{registration_id: '{reg_id_2}'}});
            if (existing) {{
              db.stand_assignments.updateOne(
                {{registration_id: '{reg_id_2}'}},
                {{$set: {{request_status: 'pending', request_submitted_at: new Date()}}}}
              );
              print('Updated existing stand_assignment');
            }} else {{
              db.stand_assignments.insertOne({{
                id: '{reg_id_2}-stand-test',
                registration_id: '{reg_id_2}',
                venue_stand_id: 'stand-test',
                status: 'provisoire',
                request_status: 'pending',
                request_submitted_at: new Date(),
                created_at: new Date(),
                updated_at: new Date()
              }});
              print('Created new stand_assignment');
            }}
            """
        ], capture_output=True)
        
        # Delete animations for this registration
        anims_resp = requests.get(f"{BASE_URL}/animation-slots", headers=ADMIN_HEADERS, timeout=30)
        if anims_resp.status_code == 200:
            for anim in anims_resp.json():
                if anim.get('registration_id') == reg_id_2:
                    requests.delete(f"{BASE_URL}/animation-slots/{anim.get('id')}", headers=ADMIN_HEADERS, timeout=30)
        
        # Get the stand assignment from queue
        queue_resp2 = requests.get(
            f"{BASE_URL}/admin/validation-queue?type=stand&status=pending",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if queue_resp2.status_code == 200:
            items2 = queue_resp2.json().get('items', [])
            stand_asn_2 = None
            for item in items2:
                if item.get('registration_id') == reg_id_2:
                    stand_asn_2 = item
                    break
            
            if stand_asn_2:
                stand_asn_id_2 = stand_asn_2.get('id')
                print(f"Found stand assignment: {stand_asn_id_2}")
                
                # Try force validate
                print(f"\nAttempting force validate...")
                val_resp4 = requests.post(
                    f"{BASE_URL}/admin/validation/{stand_asn_id_2}/validate",
                    json={"force_validate": True},
                    headers=ADMIN_HEADERS,
                    timeout=30
                )
                
                print(f"Response: {val_resp4.status_code}")
                print(f"Body: {val_resp4.text[:400]}")
                
                if val_resp4.status_code == 200:
                    data = val_resp4.json()
                    if data.get('ok'):
                        log_test("4", "PASS", "Force validate bypassed animation check")
                    else:
                        log_test("4", "FAIL", f"Unexpected response: {data}")
                else:
                    log_test("4", "FAIL", f"Expected 200, got {val_resp4.status_code}")
            else:
                log_test("4", "SKIP", "Could not find stand assignment in queue")
        else:
            log_test("4", "SKIP", "Could not get queue")
    else:
        log_test("4", "SKIP", "No second registration found")
else:
    log_test("4", "SKIP", "Could not get registrations")

# TEST 6: Queue enrichment
print("\n" + "=" * 80)
print("TEST 6: Validation queue enrichment")
print("=" * 80)

queue_resp3 = requests.get(
    f"{BASE_URL}/admin/validation-queue?type=stand",
    headers=ADMIN_HEADERS,
    timeout=30
)

if queue_resp3.status_code == 200:
    data = queue_resp3.json()
    items = data.get('items', [])
    stand_items = [i for i in items if i.get('type') == 'stand']
    
    if stand_items:
        sample = stand_items[0]
        print(f"Sample stand item:")
        print(f"  ID: {sample.get('id')}")
        print(f"  Animations count: {sample.get('animations_count')}")
        print(f"  Animations complete: {sample.get('animations_complete')}")
        print(f"  Missing days: {sample.get('missing_animation_days')}")
        
        required_fields = ['animations_count', 'animations_complete', 'missing_animation_days']
        if all(f in sample for f in required_fields):
            log_test("6", "PASS", "Queue enrichment fields present")
        else:
            missing = [f for f in required_fields if f not in sample]
            log_test("6", "FAIL", f"Missing fields: {missing}")
    else:
        log_test("6", "SKIP", "No stand items in queue")
else:
    log_test("6", "FAIL", f"Queue request failed: {queue_resp3.status_code}")

print("\n" + "=" * 80)
print("TEST SUITE COMPLETE")
print("=" * 80)
