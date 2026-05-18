#!/usr/bin/env python3
"""
SESSION 28l Backend Tests
Test per-site submission and my-sites endpoint enrichment
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def test_1_get_my_sites():
    """Test 1: GET /api/exposant/my-sites?organization_id=org-3 (Ecole Judo de Polynésie)"""
    print_test_header("Test 1: GET /api/exposant/my-sites?organization_id=org-3")
    
    try:
        url = f"{BASE_URL}/exposant/my-sites?organization_id=org-3"
        response = requests.get(url, headers=ADMIN_HEADERS)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, default=str)[:1000]}...")
        
        # Verify it's an array
        if not isinstance(data, list):
            print_result(False, f"Expected array, got {type(data)}")
            return False
        
        # Verify we have 2 sites for org-3
        if len(data) != 2:
            print_result(False, f"Expected 2 sites, got {len(data)}")
            return False
        
        print_result(True, f"Got {len(data)} sites for org-3")
        
        # Verify each site has the new fields
        all_valid = True
        for i, site in enumerate(data):
            print(f"\n--- Site {i+1}: {site.get('venue', {}).get('name', 'Unknown')} ---")
            print(f"  registration_id: {site.get('id')}")
            print(f"  stand_code: {site.get('stand_code')}")
            print(f"  has_vendredi_animation: {site.get('has_vendredi_animation')}")
            print(f"  has_samedi_animation: {site.get('has_samedi_animation')}")
            print(f"  is_complete: {site.get('is_complete')}")
            print(f"  candidature_locked: {site.get('candidature_locked')}")
            
            # Check validation_request field
            if 'validation_request' not in site:
                print_result(False, f"Site {i+1} missing 'validation_request' field")
                all_valid = False
            else:
                val_req = site['validation_request']
                print(f"  validation_request: {val_req}")
                if val_req is not None:
                    if not isinstance(val_req, dict):
                        print_result(False, f"Site {i+1} validation_request should be object or null")
                        all_valid = False
                    else:
                        required_fields = ['id', 'status', 'requested_at']
                        for field in required_fields:
                            if field not in val_req:
                                print_result(False, f"Site {i+1} validation_request missing '{field}'")
                                all_valid = False
            
            # Check can_submit field
            if 'can_submit' not in site:
                print_result(False, f"Site {i+1} missing 'can_submit' field")
                all_valid = False
            else:
                can_submit = site['can_submit']
                print(f"  can_submit: {can_submit}")
                if not isinstance(can_submit, bool):
                    print_result(False, f"Site {i+1} can_submit should be boolean")
                    all_valid = False
                
                # Verify logic: if validation_request exists, can_submit should be false
                if site.get('validation_request') is not None and can_submit:
                    print_result(False, f"Site {i+1} has validation_request but can_submit is true")
                    all_valid = False
        
        if all_valid:
            print_result(True, "All sites have correct validation_request and can_submit fields")
        
        return all_valid
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_2_submit_validation():
    """Test 2: POST /api/registrations/:id/request-validation"""
    print_test_header("Test 2: POST /api/registrations/:id/request-validation")
    
    # First, get my-sites to find a suitable registration
    try:
        url = f"{BASE_URL}/exposant/my-sites?organization_id=org-3"
        response = requests.get(url, headers=ADMIN_HEADERS)
        
        if response.status_code != 200:
            print_result(False, f"Failed to get my-sites: {response.status_code}")
            return False, None
        
        sites = response.json()
        
        # Find a site that can be submitted (has stand + 2 animations, not already submitted)
        target_reg_id = None
        for site in sites:
            if site.get('can_submit') and site.get('stand_code') and site.get('has_vendredi_animation') and site.get('has_samedi_animation'):
                target_reg_id = site['id']
                print(f"Found submittable site: {target_reg_id} at {site.get('venue', {}).get('name')}")
                break
        
        if not target_reg_id:
            # Try reg-arue-A-C08 as mentioned in the review request
            target_reg_id = "reg-arue-A-C08"
            print(f"No submittable site found in my-sites, trying {target_reg_id} as per review request")
        
        # Submit validation request
        url = f"{BASE_URL}/registrations/{target_reg_id}/request-validation"
        body = {
            "preferred_payment": "cheque",
            "rdv_proposal": "",
            "notes": ""
        }
        
        print(f"\nSubmitting validation request for {target_reg_id}...")
        response = requests.post(url, headers=ADMIN_HEADERS, json=body)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False, None
        
        data = response.json()
        
        # Verify response structure
        if not data.get('ok'):
            print_result(False, "Response 'ok' field is not true")
            return False, None
        
        if 'validation_request_id' not in data:
            print_result(False, "Response missing 'validation_request_id'")
            return False, None
        
        validation_request_id = data['validation_request_id']
        print_result(True, f"Validation request created: {validation_request_id}")
        
        # Verify my-sites now shows validation_request for this site
        print(f"\nVerifying my-sites after submission...")
        url = f"{BASE_URL}/exposant/my-sites?organization_id=org-3"
        response = requests.get(url, headers=ADMIN_HEADERS)
        
        if response.status_code != 200:
            print_result(False, f"Failed to get my-sites after submission: {response.status_code}")
            return False, target_reg_id
        
        sites = response.json()
        submitted_site = next((s for s in sites if s['id'] == target_reg_id), None)
        
        if not submitted_site:
            print_result(False, f"Site {target_reg_id} not found in my-sites")
            return False, target_reg_id
        
        print(f"Site after submission:")
        print(f"  validation_request: {submitted_site.get('validation_request')}")
        print(f"  can_submit: {submitted_site.get('can_submit')}")
        print(f"  candidature_locked: {submitted_site.get('candidature_locked')}")
        
        # Verify validation_request is set
        if submitted_site.get('validation_request') is None:
            print_result(False, "validation_request should be non-null after submission")
            return False, target_reg_id
        
        # Verify can_submit is false
        if submitted_site.get('can_submit') != False:
            print_result(False, "can_submit should be false after submission")
            return False, target_reg_id
        
        # Verify candidature_locked is true
        if submitted_site.get('candidature_locked') != True:
            print_result(False, "candidature_locked should be true after submission")
            return False, target_reg_id
        
        print_result(True, "Site correctly shows validation_request and can_submit=false after submission")
        
        # Verify other sites are unchanged
        other_sites = [s for s in sites if s['id'] != target_reg_id]
        if other_sites:
            print(f"\nVerifying other sites are unchanged...")
            for site in other_sites:
                print(f"  {site['id']}: validation_request={site.get('validation_request')}, can_submit={site.get('can_submit')}")
        
        return True, target_reg_id
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None

def test_3_unlock_candidature(reg_id):
    """Test 3: Cleanup - unlock the test registration"""
    print_test_header(f"Test 3: POST /api/admin/registrations/{reg_id}/unlock-candidature")
    
    if not reg_id:
        print_result(False, "No registration ID provided")
        return False
    
    try:
        url = f"{BASE_URL}/admin/registrations/{reg_id}/unlock-candidature"
        response = requests.post(url, headers=ADMIN_HEADERS, json={})
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not data.get('ok'):
            print_result(False, "Response 'ok' field is not true")
            return False
        
        if data.get('action') != 'candidature_unlocked':
            print_result(False, f"Expected action='candidature_unlocked', got {data.get('action')}")
            return False
        
        print_result(True, "Candidature unlocked successfully")
        
        # Verify candidature_locked is back to false
        print(f"\nVerifying registration after unlock...")
        url = f"{BASE_URL}/registrations/{reg_id}"
        response = requests.get(url, headers=ADMIN_HEADERS)
        
        if response.status_code != 200:
            print_result(False, f"Failed to get registration: {response.status_code}")
            return False
        
        reg = response.json()
        print(f"  candidature_locked: {reg.get('candidature_locked')}")
        
        # Accept None/null or False as valid (both are falsy)
        if reg.get('candidature_locked') not in [False, None]:
            print_result(False, f"candidature_locked should be false or null after unlock, got {reg.get('candidature_locked')}")
            return False
        
        print_result(True, "candidature_locked is back to false/null (unlocked)")
        
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*80)
    print("SESSION 28l Backend Tests - Per-site submission and my-sites enrichment")
    print("="*80)
    
    results = []
    
    # Test 1: GET my-sites
    test1_pass = test_1_get_my_sites()
    results.append(("Test 1: GET my-sites", test1_pass))
    
    # Test 2: POST request-validation
    test2_pass, reg_id = test_2_submit_validation()
    results.append(("Test 2: POST request-validation", test2_pass))
    
    # Test 3: Cleanup - unlock
    test3_pass = test_3_unlock_candidature(reg_id)
    results.append(("Test 3: Unlock candidature", test3_pass))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
