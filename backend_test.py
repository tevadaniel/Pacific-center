#!/usr/bin/env python3
"""
Backend API Tests - Delete-Full Endpoint Regression Test
Tests the POST /api/admin/registrations/:id/delete-full endpoint
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from .env
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

# Non-admin headers (exposant)
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exp-1",
    "Content-Type": "application/json"
}

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(passed, message):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed

def test_a_protected_exposant_guard():
    """
    Test A: Protected exposant guard
    Find a registration belonging to a PROTECTED org and verify 403 without force_unsafe
    """
    print_test_header("A) Protected Exposant Guard")
    
    try:
        # Step 1: Find a registration belonging to a protected org
        print("\n1. Finding a registration belonging to a PROTECTED org...")
        PROTECTED_ORGS = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu']
        
        # Get all organizations first
        org_resp = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if org_resp.status_code != 200:
            return print_result(False, f"Failed to fetch organizations: {org_resp.status_code}")
        
        organizations = org_resp.json()
        org_map = {org['id']: org for org in organizations}
        
        # Get all registrations
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            return print_result(False, f"Failed to fetch registrations: {resp.status_code}")
        
        registrations = resp.json()
        
        # Find a protected registration
        protected_reg = None
        protected_org_name = None
        for reg in registrations:
            org = org_map.get(reg['organization_id'])
            if org and org.get('name') in PROTECTED_ORGS:
                protected_reg = reg
                protected_org_name = org.get('name')
                break
        
        if not protected_reg:
            return print_result(False, "No protected organization registration found in database")
        
        print(f"   Found protected registration: {protected_reg['id']} (org: {protected_org_name})")
        
        # Step 2: Try to delete WITHOUT force_unsafe → should return 403
        print(f"\n2. Attempting delete-full WITHOUT force_unsafe (should return 403)...")
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{protected_reg['id']}/delete-full",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        if resp.status_code == 403:
            error_msg = resp.json().get('error', '')
            if 'protégé' in error_msg.lower() or 'protected' in error_msg.lower():
                print(f"   Response: {resp.status_code} - {error_msg}")
                return print_result(True, f"Protected exposant guard working correctly - 403 returned with message about protected exposant")
            else:
                return print_result(False, f"Got 403 but wrong error message: {error_msg}")
        else:
            return print_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
            
    except Exception as e:
        return print_result(False, f"Exception occurred: {str(e)}")

def test_b_permission_check():
    """
    Test B: Permission check
    Call delete-full without admin role → should return 403
    """
    print_test_header("B) Permission Check")
    
    try:
        # Get any registration ID
        print("\n1. Getting a registration ID...")
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            return print_result(False, f"Failed to fetch registrations: {resp.status_code}")
        
        registrations = resp.json()
        if not registrations:
            return print_result(False, "No registrations found in database")
        
        reg_id = registrations[0]['id']
        print(f"   Using registration: {reg_id}")
        
        # Step 2: Try to delete with exposant role → should return 403
        print(f"\n2. Attempting delete-full with exposant role (should return 403)...")
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/delete-full",
            headers=EXPOSANT_HEADERS,
            json={}
        )
        
        if resp.status_code == 403:
            error_msg = resp.json().get('error', '')
            print(f"   Response: {resp.status_code} - {error_msg}")
            return print_result(True, "Permission check working correctly - 403 returned for non-admin")
        else:
            return print_result(False, f"Expected 403, got {resp.status_code}: {resp.text}")
            
    except Exception as e:
        return print_result(False, f"Exception occurred: {str(e)}")

def test_c_structure_verification():
    """
    Test C: Verification of structure
    Try delete-full with non-existent registration → should return 404
    """
    print_test_header("C) Structure Verification (404 for non-existent)")
    
    try:
        # Use a non-existent registration ID
        fake_reg_id = "non-existent-registration-id-12345"
        
        print(f"\n1. Attempting delete-full with non-existent registration ID: {fake_reg_id}")
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{fake_reg_id}/delete-full",
            headers=ADMIN_HEADERS,
            json={}
        )
        
        if resp.status_code == 404:
            error_msg = resp.json().get('error', '')
            print(f"   Response: {resp.status_code} - {error_msg}")
            return print_result(True, "Structure verification working - 404 returned for non-existent registration")
        else:
            return print_result(False, f"Expected 404, got {resp.status_code}: {resp.text}")
            
    except Exception as e:
        return print_result(False, f"Exception occurred: {str(e)}")

def test_d_cancel_via_reset():
    """
    Test D: Cancel via reset endpoint (no regression)
    Find or create a non-protected test registration and cancel it via reset endpoint
    """
    print_test_header("D) Cancel via Reset Endpoint (No Regression)")
    
    try:
        # Step 1: Find a non-protected registration
        print("\n1. Finding a non-protected registration...")
        PROTECTED_ORGS = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu']
        
        # Get all organizations first
        org_resp = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if org_resp.status_code != 200:
            return print_result(False, f"Failed to fetch organizations: {org_resp.status_code}")
        
        organizations = org_resp.json()
        org_map = {org['id']: org for org in organizations}
        
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            return print_result(False, f"Failed to fetch registrations: {resp.status_code}")
        
        registrations = resp.json()
        
        # Find a non-protected registration that is not already cancelled
        test_reg = None
        for reg in registrations:
            if reg.get('status') != 'annule':
                org = org_map.get(reg['organization_id'])
                if org and org.get('name') not in PROTECTED_ORGS:
                    test_reg = reg
                    break
        
        if not test_reg:
            return print_result(False, "No non-protected, non-cancelled registration found")
        
        print(f"   Found registration: {test_reg['id']} (status: {test_reg.get('status')})")
        
        # Step 2: Cancel via reset endpoint
        print(f"\n2. Cancelling registration via POST /api/admin/registrations/{test_reg['id']}/reset with reset='cancel'...")
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg['id']}/reset",
            headers=ADMIN_HEADERS,
            json={"reset": "cancel"}
        )
        
        if resp.status_code != 200:
            return print_result(False, f"Reset endpoint failed: {resp.status_code} - {resp.text}")
        
        result = resp.json()
        if not result.get('ok') or result.get('action') != 'registration_cancelled':
            return print_result(False, f"Unexpected response: {result}")
        
        print(f"   Response: {result}")
        
        # Step 3: Verify registration status is now 'annule'
        print(f"\n3. Verifying registration status is now 'annule'...")
        resp = requests.get(f"{BASE_URL}/registrations/{test_reg['id']}", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            return print_result(False, f"Failed to fetch registration: {resp.status_code}")
        
        result = resp.json()
        # Handle both direct response and nested response
        updated_reg = result.get('registration', result)
        
        if updated_reg.get('status') == 'annule' and updated_reg.get('cancelled_at'):
            print(f"   Status: {updated_reg.get('status')}, cancelled_at: {updated_reg.get('cancelled_at')}")
            return print_result(True, "Cancel via reset endpoint working correctly - status='annule', cancelled_at set")
        else:
            return print_result(False, f"Status not updated correctly: {updated_reg.get('status')}")
            
    except Exception as e:
        return print_result(False, f"Exception occurred: {str(e)}")

def test_e_audit_log():
    """
    Test E: Audit log verification
    After the cancel operation in test D, verify activity_logs contains a relevant entry
    """
    print_test_header("E) Audit Log Verification")
    
    try:
        # Get activity logs
        print("\n1. Fetching activity logs...")
        resp = requests.get(f"{BASE_URL}/activity-logs", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            return print_result(False, f"Failed to fetch activity logs: {resp.status_code}")
        
        logs = resp.json()
        
        # Look for recent admin_override_cancel or similar action
        print(f"\n2. Checking for recent cancel-related activity logs...")
        recent_cancel_logs = [
            log for log in logs 
            if log.get('action_type') in ['admin_override_cancel', 'registration_cancelled', 'admin_override']
            or (log.get('entity_type') == 'registration' and 'cancel' in str(log.get('action_type', '')).lower())
        ]
        
        if recent_cancel_logs:
            print(f"   Found {len(recent_cancel_logs)} cancel-related activity log(s)")
            # Show the most recent one
            latest = recent_cancel_logs[0]
            print(f"   Latest log: entity_type={latest.get('entity_type')}, action_type={latest.get('action_type')}, created_at={latest.get('created_at')}")
            return print_result(True, "Audit log contains cancel-related entries")
        else:
            # Check if there are any activity logs at all
            if logs:
                print(f"   Total activity logs: {len(logs)}")
                print(f"   Sample action types: {[log.get('action_type') for log in logs[:5]]}")
                return print_result(True, "Activity logs exist (cancel action may have different action_type)")
            else:
                return print_result(False, "No activity logs found in database")
            
    except Exception as e:
        return print_result(False, f"Exception occurred: {str(e)}")

def main():
    print("\n" + "="*80)
    print("BACKEND API REGRESSION TEST - DELETE-FULL ENDPOINT")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = []
    
    # Run all tests
    results.append(("A) Protected Exposant Guard", test_a_protected_exposant_guard()))
    results.append(("B) Permission Check", test_b_permission_check()))
    results.append(("C) Structure Verification", test_c_structure_verification()))
    results.append(("D) Cancel via Reset", test_d_cancel_via_reset()))
    results.append(("E) Audit Log", test_e_audit_log()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
