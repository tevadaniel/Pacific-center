#!/usr/bin/env python3
"""
SESSION 52g.5 — Test attending_days field in /api/validation-requests endpoint
"""

import requests
import json
import sys

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin credentials
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

def test_validation_requests_attending_days():
    """
    Test GET /api/validation-requests returns attending_days field
    """
    print("\n" + "="*80)
    print("SESSION 52g.5 — Test attending_days in validation-requests endpoint")
    print("="*80)
    
    tests_passed = 0
    tests_failed = 0
    
    # Test 1: GET /api/validation-requests with admin auth
    print("\n[TEST 1] GET /api/validation-requests with admin auth")
    try:
        response = requests.get(
            f"{BASE_URL}/validation-requests",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ PASS - Got {len(data)} validation requests")
            
            # Check if attending_days field is present on each item
            if len(data) > 0:
                print(f"\n  Checking attending_days field on all items...")
                all_have_attending_days = True
                items_with_days = 0
                items_without_days = 0
                
                for i, item in enumerate(data):
                    if 'attending_days' not in item:
                        print(f"    ❌ Item {i} (id: {item.get('id', 'N/A')}) missing attending_days field")
                        all_have_attending_days = False
                    else:
                        attending_days = item['attending_days']
                        if isinstance(attending_days, list):
                            if len(attending_days) > 0:
                                items_with_days += 1
                                if i < 3:  # Show first 3 items
                                    org_name = item.get('organization', {}).get('name', 'N/A') if item.get('organization') else 'N/A'
                                    venue_name = item.get('venue', {}).get('name', 'N/A') if item.get('venue') else 'N/A'
                                    status = item.get('status', 'N/A')
                                    print(f"    ✅ Item {i}: {org_name} @ {venue_name} (status: {status}) - attending_days: {attending_days}")
                            else:
                                items_without_days += 1
                        else:
                            print(f"    ❌ Item {i} attending_days is not an array: {type(attending_days)}")
                            all_have_attending_days = False
                
                print(f"\n  Summary:")
                print(f"    - Total items: {len(data)}")
                print(f"    - Items with attending_days (non-empty): {items_with_days}")
                print(f"    - Items with attending_days (empty array): {items_without_days}")
                
                if all_have_attending_days:
                    print(f"  ✅ PASS - All items have attending_days field")
                    tests_passed += 1
                else:
                    print(f"  ❌ FAIL - Some items missing attending_days field")
                    tests_failed += 1
            else:
                print(f"  ℹ️  No validation requests found (empty array)")
                tests_passed += 1
        else:
            print(f"  ❌ FAIL - Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ FAIL - Exception: {e}")
        tests_failed += 1
    
    # Test 2: GET /api/validation-requests with status filter
    print("\n[TEST 2] GET /api/validation-requests?status=en_attente")
    try:
        response = requests.get(
            f"{BASE_URL}/validation-requests?status=en_attente",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ PASS - Got {len(data)} validation requests with status=en_attente")
            
            if len(data) > 0:
                # Check first item
                item = data[0]
                if 'attending_days' in item:
                    org_name = item.get('organization', {}).get('name', 'N/A') if item.get('organization') else 'N/A'
                    venue_name = item.get('venue', {}).get('name', 'N/A') if item.get('venue') else 'N/A'
                    print(f"  ✅ PASS - First item has attending_days: {item['attending_days']}")
                    print(f"    Organization: {org_name}")
                    print(f"    Venue: {venue_name}")
                    tests_passed += 1
                else:
                    print(f"  ❌ FAIL - First item missing attending_days field")
                    tests_failed += 1
            else:
                print(f"  ℹ️  No validation requests with status=en_attente")
                tests_passed += 1
        else:
            print(f"  ❌ FAIL - Expected 200, got {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ FAIL - Exception: {e}")
        tests_failed += 1
    
    # Test 3: GET /api/validation-requests?status=waitlist
    print("\n[TEST 3] GET /api/validation-requests?status=waitlist")
    try:
        response = requests.get(
            f"{BASE_URL}/validation-requests?status=waitlist",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ PASS - Got {len(data)} validation requests with status=waitlist")
            
            if len(data) > 0:
                # Check first item
                item = data[0]
                if 'attending_days' in item:
                    org_name = item.get('organization', {}).get('name', 'N/A') if item.get('organization') else 'N/A'
                    venue_name = item.get('venue', {}).get('name', 'N/A') if item.get('venue') else 'N/A'
                    print(f"  ✅ PASS - First item has attending_days: {item['attending_days']}")
                    print(f"    Organization: {org_name}")
                    print(f"    Venue: {venue_name}")
                    tests_passed += 1
                else:
                    print(f"  ❌ FAIL - First item missing attending_days field")
                    tests_failed += 1
            else:
                print(f"  ℹ️  No validation requests with status=waitlist")
                tests_passed += 1
        else:
            print(f"  ❌ FAIL - Expected 200, got {response.status_code}")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ FAIL - Exception: {e}")
        tests_failed += 1
    
    # Test 4: Verify attending_days contains valid values
    print("\n[TEST 4] Verify attending_days contains valid values (vendredi/samedi)")
    try:
        response = requests.get(
            f"{BASE_URL}/validation-requests",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            valid_days = ['vendredi', 'samedi']
            all_valid = True
            invalid_items = []
            
            for i, item in enumerate(data):
                attending_days = item.get('attending_days', [])
                if isinstance(attending_days, list) and len(attending_days) > 0:
                    for day in attending_days:
                        if day not in valid_days:
                            all_valid = False
                            invalid_items.append({
                                'index': i,
                                'id': item.get('id', 'N/A'),
                                'invalid_day': day,
                                'attending_days': attending_days
                            })
            
            if all_valid:
                print(f"  ✅ PASS - All attending_days contain only valid values (vendredi/samedi)")
                tests_passed += 1
            else:
                print(f"  ❌ FAIL - Found invalid values in attending_days:")
                for inv in invalid_items[:5]:  # Show first 5
                    print(f"    Item {inv['index']} (id: {inv['id']}): invalid day '{inv['invalid_day']}' in {inv['attending_days']}")
                tests_failed += 1
        else:
            print(f"  ❌ FAIL - Could not fetch validation requests")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ FAIL - Exception: {e}")
        tests_failed += 1
    
    # Test 5: Verify no regression on other fields
    print("\n[TEST 5] Verify no regression on other fields (organization, venue, status)")
    try:
        response = requests.get(
            f"{BASE_URL}/validation-requests",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if len(data) > 0:
                item = data[0]
                required_fields = ['id', 'status', 'organization', 'venue']
                missing_fields = [f for f in required_fields if f not in item]
                
                if len(missing_fields) == 0:
                    print(f"  ✅ PASS - All required fields present: {required_fields}")
                    
                    # Check organization structure
                    org = item.get('organization')
                    if org and isinstance(org, dict):
                        org_fields = ['id', 'name']
                        org_missing = [f for f in org_fields if f not in org]
                        if len(org_missing) == 0:
                            print(f"    ✅ Organization structure OK: {org_fields}")
                        else:
                            print(f"    ⚠️  Organization missing fields: {org_missing}")
                    
                    # Check venue structure
                    venue = item.get('venue')
                    if venue and isinstance(venue, dict):
                        venue_fields = ['id', 'name', 'code']
                        venue_missing = [f for f in venue_fields if f not in venue]
                        if len(venue_missing) == 0:
                            print(f"    ✅ Venue structure OK: {venue_fields}")
                        else:
                            print(f"    ⚠️  Venue missing fields: {venue_missing}")
                    
                    tests_passed += 1
                else:
                    print(f"  ❌ FAIL - Missing required fields: {missing_fields}")
                    tests_failed += 1
            else:
                print(f"  ℹ️  No validation requests to check")
                tests_passed += 1
        else:
            print(f"  ❌ FAIL - Could not fetch validation requests")
            tests_failed += 1
    except Exception as e:
        print(f"  ❌ FAIL - Exception: {e}")
        tests_failed += 1
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    total_tests = tests_passed + tests_failed
    success_rate = (tests_passed / total_tests * 100) if total_tests > 0 else 0
    print(f"Tests passed: {tests_passed}/{total_tests} ({success_rate:.1f}%)")
    print(f"Tests failed: {tests_failed}/{total_tests}")
    
    if tests_failed == 0:
        print("\n✅ ALL TESTS PASSED - attending_days field is correctly returned in /api/validation-requests")
        return 0
    else:
        print(f"\n❌ {tests_failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(test_validation_requests_attending_days())
