#!/usr/bin/env python3
"""
Backend Regression Test - Admin Delete/Archive/Reset Endpoints
Session 23 - Refactoring verification

Tests all 10 admin endpoints that were refactored into admin-delete-reset.js
"""

import requests
import json
import sys

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin"
}

# Non-admin headers (exposant)
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "exposant",
    "x-user-id": "u-exposant-test"
}

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"   {details}")
    print()

def test_smoke_404_endpoints():
    """Test all 10 endpoints with non-existent IDs - should return 404"""
    print("=" * 80)
    print("SMOKE TESTS - Non-existent IDs (expecting 404)")
    print("=" * 80)
    
    tests = [
        {
            "name": "POST /api/admin/organizations/non-existent-id/archive",
            "url": f"{BASE_URL}/admin/organizations/non-existent-id/archive",
            "method": "POST",
            "body": {"reason": "refactor-test"},
            "expected_status": 404,
            "expected_message": "Organisation introuvable"
        },
        {
            "name": "POST /api/admin/organizations/non-existent-id/restore",
            "url": f"{BASE_URL}/admin/organizations/non-existent-id/restore",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Organisation introuvable"
        },
        {
            "name": "POST /api/admin/organizations/non-existent-id/delete",
            "url": f"{BASE_URL}/admin/organizations/non-existent-id/delete",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Organisation introuvable"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-caution",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-caution",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Inscription introuvable"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-virement",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-virement",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Inscription introuvable"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-convention",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-convention",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Inscription introuvable"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-attendance",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-attendance",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Aucune session à réinitialiser"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-caution-appointment",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-caution-appointment",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Aucun RDV à supprimer"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/reset-satisfaction",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/reset-satisfaction",
            "method": "POST",
            "body": {},
            "expected_status": 404,
            "expected_message": "Inscription introuvable"
        },
        {
            "name": "POST /api/admin/registrations/non-existent-id/cancel-virement",
            "url": f"{BASE_URL}/admin/registrations/non-existent-id/cancel-virement",
            "method": "POST",
            "body": {},
            "expected_status": 200,
            "expected_message": "virement_cancelled"
        }
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            response = requests.post(test["url"], headers=ADMIN_HEADERS, json=test["body"], timeout=10)
            
            if response.status_code == test["expected_status"]:
                data = response.json()
                
                # Special case for cancel-virement (returns 200 even for non-existent)
                if test["expected_status"] == 200:
                    if data.get("action") == test["expected_message"]:
                        print_test(test["name"], True, f"Status: {response.status_code}, Action: {data.get('action')}")
                        passed += 1
                    else:
                        print_test(test["name"], False, f"Expected action '{test['expected_message']}', got: {data}")
                        failed += 1
                else:
                    # Check for French error message
                    error_msg = data.get("error", "")
                    if test["expected_message"] in error_msg:
                        print_test(test["name"], True, f"Status: {response.status_code}, Message: {error_msg}")
                        passed += 1
                    else:
                        print_test(test["name"], False, f"Expected message '{test['expected_message']}', got: {error_msg}")
                        failed += 1
            else:
                print_test(test["name"], False, f"Expected status {test['expected_status']}, got {response.status_code}: {response.text[:200]}")
                failed += 1
                
        except Exception as e:
            print_test(test["name"], False, f"Exception: {str(e)}")
            failed += 1
    
    print(f"Smoke Tests Summary: {passed} passed, {failed} failed\n")
    return passed, failed

def test_permission_403_endpoints():
    """Test all 10 endpoints without admin role - should return 403"""
    print("=" * 80)
    print("PERMISSION TESTS - Non-admin role (expecting 403)")
    print("=" * 80)
    
    tests = [
        {
            "name": "POST /api/admin/organizations/test-id/archive (exposant)",
            "url": f"{BASE_URL}/admin/organizations/test-id/archive",
            "body": {"reason": "test"}
        },
        {
            "name": "POST /api/admin/organizations/test-id/restore (exposant)",
            "url": f"{BASE_URL}/admin/organizations/test-id/restore",
            "body": {}
        },
        {
            "name": "POST /api/admin/organizations/test-id/delete (exposant)",
            "url": f"{BASE_URL}/admin/organizations/test-id/delete",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-caution (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-caution",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-virement (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-virement",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-convention (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-convention",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-attendance (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-attendance",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-caution-appointment (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-caution-appointment",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/reset-satisfaction (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/reset-satisfaction",
            "body": {}
        },
        {
            "name": "POST /api/admin/registrations/test-id/cancel-virement (exposant)",
            "url": f"{BASE_URL}/admin/registrations/test-id/cancel-virement",
            "body": {}
        }
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            response = requests.post(test["url"], headers=EXPOSANT_HEADERS, json=test["body"], timeout=10)
            
            if response.status_code == 403:
                data = response.json()
                error_msg = data.get("error", "")
                if "admin" in error_msg.lower() or "accès" in error_msg.lower():
                    print_test(test["name"], True, f"Status: 403, Message: {error_msg}")
                    passed += 1
                else:
                    print_test(test["name"], False, f"Got 403 but unexpected message: {error_msg}")
                    failed += 1
            else:
                print_test(test["name"], False, f"Expected 403, got {response.status_code}: {response.text[:200]}")
                failed += 1
                
        except Exception as e:
            print_test(test["name"], False, f"Exception: {str(e)}")
            failed += 1
    
    print(f"Permission Tests Summary: {passed} passed, {failed} failed\n")
    return passed, failed

def test_functional_archive_restore():
    """Test functional flow: archive and restore an organization"""
    print("=" * 80)
    print("FUNCTIONAL TEST - Archive & Restore Flow")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    # First, get a non-protected organization to test with
    try:
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if response.status_code != 200:
            print_test("Get organizations for testing", False, f"Failed to get organizations: {response.status_code}")
            return 0, 1
        
        orgs = response.json()
        # Find a non-protected org (not in the protected list)
        PROTECTED = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu']
        test_org = None
        for org in orgs:
            if org.get("name") not in PROTECTED and not org.get("archived_at"):
                test_org = org
                break
        
        if not test_org:
            print_test("Find test organization", False, "No non-protected organization found for testing")
            return 0, 1
        
        org_id = test_org.get("id")
        org_name = test_org.get("name")
        print(f"Using test organization: {org_name} (ID: {org_id})\n")
        
        # Test 1: Archive the organization
        archive_response = requests.post(
            f"{BASE_URL}/admin/organizations/{org_id}/archive",
            headers=ADMIN_HEADERS,
            json={"reason": "refactor-test"},
            timeout=10
        )
        
        if archive_response.status_code == 200:
            data = archive_response.json()
            if data.get("ok") and data.get("action") == "archived":
                print_test(f"Archive organization {org_name}", True, f"Successfully archived: {data}")
                passed += 1
            else:
                print_test(f"Archive organization {org_name}", False, f"Unexpected response: {data}")
                failed += 1
                return passed, failed
        else:
            print_test(f"Archive organization {org_name}", False, f"Status {archive_response.status_code}: {archive_response.text[:200]}")
            failed += 1
            return passed, failed
        
        # Test 2: Verify organization is archived (should not appear in default list)
        orgs_response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if orgs_response.status_code == 200:
            orgs = orgs_response.json()
            archived_org = next((o for o in orgs if o.get("id") == org_id), None)
            if archived_org is None:
                print_test("Verify archived org not in default list", True, "Archived org correctly filtered out")
                passed += 1
            else:
                print_test("Verify archived org not in default list", False, f"Archived org still appears: {archived_org}")
                failed += 1
        else:
            print_test("Verify archived org not in default list", False, f"Failed to get organizations: {orgs_response.status_code}")
            failed += 1
        
        # Test 3: Restore the organization
        restore_response = requests.post(
            f"{BASE_URL}/admin/organizations/{org_id}/restore",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if restore_response.status_code == 200:
            data = restore_response.json()
            if data.get("ok") and data.get("action") == "restored":
                print_test(f"Restore organization {org_name}", True, f"Successfully restored: {data}")
                passed += 1
            else:
                print_test(f"Restore organization {org_name}", False, f"Unexpected response: {data}")
                failed += 1
                return passed, failed
        else:
            print_test(f"Restore organization {org_name}", False, f"Status {restore_response.status_code}: {restore_response.text[:200]}")
            failed += 1
            return passed, failed
        
        # Test 4: Verify organization is restored (should appear in default list)
        orgs_response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if orgs_response.status_code == 200:
            orgs = orgs_response.json()
            restored_org = next((o for o in orgs if o.get("id") == org_id), None)
            if restored_org and not restored_org.get("archived_at"):
                print_test("Verify restored org in default list", True, "Restored org correctly appears in active list")
                passed += 1
            else:
                print_test("Verify restored org in default list", False, f"Restored org not found or still archived: {restored_org}")
                failed += 1
        else:
            print_test("Verify restored org in default list", False, f"Failed to get organizations: {orgs_response.status_code}")
            failed += 1
        
    except Exception as e:
        print_test("Functional archive/restore test", False, f"Exception: {str(e)}")
        failed += 1
    
    print(f"Functional Tests Summary: {passed} passed, {failed} failed\n")
    return passed, failed

def test_filter_regression():
    """Test filter regression: GET /api/organizations with and without only_archived"""
    print("=" * 80)
    print("FILTER REGRESSION TEST - only_archived parameter")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    try:
        # Test 1: GET /api/organizations (default - should not include archived)
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS, timeout=10)
        if response.status_code == 200:
            orgs = response.json()
            has_archived = any(org.get("archived_at") for org in orgs)
            if not has_archived:
                print_test("GET /api/organizations (default)", True, f"No archived orgs in default list ({len(orgs)} orgs)")
                passed += 1
            else:
                archived_count = sum(1 for org in orgs if org.get("archived_at"))
                print_test("GET /api/organizations (default)", False, f"Found {archived_count} archived orgs in default list")
                failed += 1
        else:
            print_test("GET /api/organizations (default)", False, f"Status {response.status_code}: {response.text[:200]}")
            failed += 1
        
        # Test 2: GET /api/organizations?only_archived=true (should return only archived)
        response = requests.get(f"{BASE_URL}/organizations?only_archived=true", headers=ADMIN_HEADERS, timeout=10)
        if response.status_code == 200:
            orgs = response.json()
            all_archived = all(org.get("archived_at") for org in orgs) if orgs else True
            if all_archived:
                print_test("GET /api/organizations?only_archived=true", True, f"All {len(orgs)} orgs are archived")
                passed += 1
            else:
                non_archived_count = sum(1 for org in orgs if not org.get("archived_at"))
                print_test("GET /api/organizations?only_archived=true", False, f"Found {non_archived_count} non-archived orgs")
                failed += 1
        else:
            print_test("GET /api/organizations?only_archived=true", False, f"Status {response.status_code}: {response.text[:200]}")
            failed += 1
        
    except Exception as e:
        print_test("Filter regression test", False, f"Exception: {str(e)}")
        failed += 1
    
    print(f"Filter Regression Tests Summary: {passed} passed, {failed} failed\n")
    return passed, failed

def main():
    print("\n" + "=" * 80)
    print("BACKEND REGRESSION TEST - Admin Delete/Archive/Reset Endpoints")
    print("Session 23 - Refactoring Verification")
    print("=" * 80 + "\n")
    
    total_passed = 0
    total_failed = 0
    
    # Run all test suites
    p, f = test_smoke_404_endpoints()
    total_passed += p
    total_failed += f
    
    p, f = test_permission_403_endpoints()
    total_passed += p
    total_failed += f
    
    p, f = test_functional_archive_restore()
    total_passed += p
    total_failed += f
    
    p, f = test_filter_regression()
    total_passed += p
    total_failed += f
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {total_passed + total_failed}")
    print(f"✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"Success Rate: {(total_passed / (total_passed + total_failed) * 100):.1f}%")
    print("=" * 80 + "\n")
    
    # Exit with appropriate code
    sys.exit(0 if total_failed == 0 else 1)

if __name__ == "__main__":
    main()
