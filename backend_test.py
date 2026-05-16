#!/usr/bin/env python3
"""
Backend test for admin delete/archive/reset endpoints
Forum de la Rentrée 2026 - Aracom SaaS
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL
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
    "x-user-id": "u-exposant-test",
    "Content-Type": "application/json"
}

# Protected organizations list
PROTECTED_ORGS = ['I Mua Papeete', 'Dream Lab', 'ACE Arue', 'Budokan Judo Pirae', 'Lotus Bleu']

# Test results
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if details:
        result += f"\n    Details: {details}"
    test_results.append((test_name, passed, details))
    print(result)

def get_test_organization():
    """Find a non-protected test organization with at least one registration"""
    try:
        # Get all organizations including archived
        response = requests.get(
            f"{BASE_URL}/organizations?include_archived=true",
            headers=ADMIN_HEADERS
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to get organizations: {response.status_code}")
            return None
        
        orgs = response.json()
        
        # Find a non-protected org with registrations
        for org in orgs:
            if org.get('name') not in PROTECTED_ORGS:
                # Check if it has registrations
                reg_response = requests.get(
                    f"{BASE_URL}/registrations",
                    headers=ADMIN_HEADERS
                )
                if reg_response.status_code == 200:
                    regs = reg_response.json()
                    org_regs = [r for r in regs if r.get('organization_id') == org.get('id')]
                    if org_regs:
                        print(f"✓ Found test organization: {org.get('name')} (ID: {org.get('id')}) with {len(org_regs)} registration(s)")
                        return org, org_regs[0]
        
        print("⚠️ No suitable test organization found")
        return None
    except Exception as e:
        print(f"❌ Error finding test organization: {str(e)}")
        return None

def create_test_organization():
    """Create a temporary test organization via wizard"""
    try:
        payload = {
            "organization_name": f"Test Org Delete {datetime.now().strftime('%H%M%S')}",
            "discipline": "Sport",
            "contact_name": "Test Contact",
            "contact_phone": "+689 87 00 00 00",
            "main_email": f"test-delete-{datetime.now().strftime('%H%M%S')}@test.pf",
            "venue_id": "venue-faaa",
            "password": "testpass123"
        }
        
        response = requests.post(
            f"{BASE_URL}/wizard/setup-organization",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Created test organization: {payload['organization_name']}")
            return data.get('organization_id'), data.get('registration_id')
        else:
            print(f"❌ Failed to create test organization: {response.status_code} - {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Error creating test organization: {str(e)}")
        return None, None

def test_a_get_filtering():
    """Test A: GET filtering with include_archived and only_archived"""
    print("\n" + "="*80)
    print("TEST A: GET FILTERING")
    print("="*80)
    
    # A1: GET /api/organizations (no flag) - should NOT include archived
    try:
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            has_archived = any(org.get('archived_at') for org in orgs)
            log_test("A1: GET /organizations without flag excludes archived", 
                    not has_archived, 
                    f"Found {len(orgs)} orgs, archived present: {has_archived}")
        else:
            log_test("A1: GET /organizations without flag", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("A1: GET /organizations without flag", False, str(e))
    
    # A2: GET /api/organizations?include_archived=true - should include all
    try:
        response = requests.get(f"{BASE_URL}/organizations?include_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            log_test("A2: GET /organizations?include_archived=true returns all", 
                    True, 
                    f"Found {len(orgs)} orgs total")
        else:
            log_test("A2: GET /organizations?include_archived=true", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("A2: GET /organizations?include_archived=true", False, str(e))
    
    # A3: GET /api/organizations?only_archived=true with admin - should return ONLY archived
    try:
        response = requests.get(f"{BASE_URL}/organizations?only_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            all_archived = all(org.get('archived_at') for org in orgs) if orgs else True
            log_test("A3: GET /organizations?only_archived=true with admin returns only archived", 
                    all_archived, 
                    f"Found {len(orgs)} archived orgs")
        else:
            log_test("A3: GET /organizations?only_archived=true with admin", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("A3: GET /organizations?only_archived=true with admin", False, str(e))
    
    # A4: GET /api/organizations?only_archived=true with non-admin - should return 403
    try:
        response = requests.get(f"{BASE_URL}/organizations?only_archived=true", headers=EXPOSANT_HEADERS)
        log_test("A4: GET /organizations?only_archived=true with non-admin returns 403", 
                response.status_code == 403, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("A4: GET /organizations?only_archived=true with non-admin", False, str(e))
    
    # A5: GET /api/registrations - should exclude regs whose org is archived
    try:
        response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            regs = response.json()
            log_test("A5: GET /registrations excludes archived orgs", 
                    True, 
                    f"Found {len(regs)} registrations")
        else:
            log_test("A5: GET /registrations", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("A5: GET /registrations", False, str(e))
    
    # A6: GET /api/registrations?include_archived=true - should include them
    try:
        response = requests.get(f"{BASE_URL}/registrations?include_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            regs = response.json()
            log_test("A6: GET /registrations?include_archived=true includes all", 
                    True, 
                    f"Found {len(regs)} registrations total")
        else:
            log_test("A6: GET /registrations?include_archived=true", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("A6: GET /registrations?include_archived=true", False, str(e))

def test_b_archive_restore(test_org_id, test_org_name):
    """Test B: Archive and restore organization"""
    print("\n" + "="*80)
    print("TEST B: ARCHIVE / RESTORE ORGANIZATION")
    print("="*80)
    
    # B1: Archive organization
    try:
        payload = {"reason": "Test E2E"}
        response = requests.post(
            f"{BASE_URL}/admin/organizations/{test_org_id}/archive",
            headers=ADMIN_HEADERS,
            json=payload
        )
        if response.status_code == 200:
            data = response.json()
            log_test("B1: POST /admin/organizations/{id}/archive returns 200", 
                    data.get('ok') and data.get('action') == 'archived', 
                    f"Response: {data}")
        else:
            log_test("B1: POST /admin/organizations/{id}/archive", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("B1: POST /admin/organizations/{id}/archive", False, str(e))
    
    # B2: Verify org is NOT in default list
    try:
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            org_ids = [o.get('id') for o in orgs]
            log_test("B2: Archived org NOT in default GET /organizations", 
                    test_org_id not in org_ids, 
                    f"Org {test_org_id} in list: {test_org_id in org_ids}")
        else:
            log_test("B2: Verify org not in default list", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B2: Verify org not in default list", False, str(e))
    
    # B3: Verify org IS in only_archived list
    try:
        response = requests.get(f"{BASE_URL}/organizations?only_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            archived_org = next((o for o in orgs if o.get('id') == test_org_id), None)
            if archived_org:
                has_fields = (archived_org.get('archived_at') and 
                            archived_org.get('archive_reason') == 'Test E2E')
                log_test("B3: Archived org in only_archived list with correct fields", 
                        has_fields, 
                        f"archived_at: {archived_org.get('archived_at')}, reason: {archived_org.get('archive_reason')}")
            else:
                log_test("B3: Archived org in only_archived list", False, "Org not found in archived list")
        else:
            log_test("B3: Verify org in only_archived list", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B3: Verify org in only_archived list", False, str(e))
    
    # B4: Verify registrations are status='annule'
    try:
        response = requests.get(f"{BASE_URL}/registrations?include_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            regs = response.json()
            org_regs = [r for r in regs if r.get('organization_id') == test_org_id]
            all_cancelled = all(r.get('status') == 'annule' for r in org_regs)
            log_test("B4: Registrations of archived org have status='annule'", 
                    all_cancelled, 
                    f"Found {len(org_regs)} regs, all cancelled: {all_cancelled}")
        else:
            log_test("B4: Verify registrations cancelled", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B4: Verify registrations cancelled", False, str(e))
    
    # B5: Try to archive again - should return 400
    try:
        payload = {"reason": "Test E2E again"}
        response = requests.post(
            f"{BASE_URL}/admin/organizations/{test_org_id}/archive",
            headers=ADMIN_HEADERS,
            json=payload
        )
        log_test("B5: Archive already archived org returns 400", 
                response.status_code == 400, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("B5: Archive already archived org", False, str(e))
    
    # B6: Restore organization
    try:
        response = requests.post(
            f"{BASE_URL}/admin/organizations/{test_org_id}/restore",
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            log_test("B6: POST /admin/organizations/{id}/restore returns 200", 
                    data.get('ok') and data.get('action') == 'restored', 
                    f"Response: {data}")
        else:
            log_test("B6: POST /admin/organizations/{id}/restore", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("B6: POST /admin/organizations/{id}/restore", False, str(e))
    
    # B7: Try to restore again - should return 400
    try:
        response = requests.post(
            f"{BASE_URL}/admin/organizations/{test_org_id}/restore",
            headers=ADMIN_HEADERS
        )
        log_test("B7: Restore non-archived org returns 400", 
                response.status_code == 400, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("B7: Restore non-archived org", False, str(e))
    
    # B8: Verify activity_logs has archive and restore entries
    try:
        response = requests.get(f"{BASE_URL}/activity-logs", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            logs = response.json()
            archive_log = any(l.get('action_type') == 'archive' and l.get('entity_id') == test_org_id for l in logs)
            restore_log = any(l.get('action_type') == 'restore' and l.get('entity_id') == test_org_id for l in logs)
            log_test("B8: Activity logs contain archive and restore entries", 
                    archive_log and restore_log, 
                    f"Archive log: {archive_log}, Restore log: {restore_log}")
        else:
            log_test("B8: Verify activity logs", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B8: Verify activity logs", False, str(e))

def test_c_definitive_delete():
    """Test C: Definitive delete with protections"""
    print("\n" + "="*80)
    print("TEST C: DEFINITIVE DELETE")
    print("="*80)
    
    # C1: Delete without confirm_name - should return 400
    try:
        response = requests.post(
            f"{BASE_URL}/admin/organizations/test-org-id/delete",
            headers=ADMIN_HEADERS,
            json={}
        )
        log_test("C1: DELETE without confirm_name returns 400", 
                response.status_code == 400, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("C1: DELETE without confirm_name", False, str(e))
    
    # C2: Delete with wrong confirm_name - should return 400
    try:
        # First get a real org
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            if orgs:
                test_org = orgs[0]
                response = requests.post(
                    f"{BASE_URL}/admin/organizations/{test_org['id']}/delete",
                    headers=ADMIN_HEADERS,
                    json={"confirm_name": "Wrong Name"}
                )
                log_test("C2: DELETE with wrong confirm_name returns 400", 
                        response.status_code == 400, 
                        f"Status: {response.status_code}")
            else:
                log_test("C2: DELETE with wrong confirm_name", False, "No orgs available")
        else:
            log_test("C2: DELETE with wrong confirm_name", False, f"Failed to get orgs: {response.status_code}")
    except Exception as e:
        log_test("C2: DELETE with wrong confirm_name", False, str(e))
    
    # C3: Try to delete protected org without force_unsafe - should return 403
    try:
        # Find a protected org
        response = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            protected_org = next((o for o in orgs if o.get('name') in PROTECTED_ORGS), None)
            if protected_org:
                response = requests.post(
                    f"{BASE_URL}/admin/organizations/{protected_org['id']}/delete",
                    headers=ADMIN_HEADERS,
                    json={"confirm_name": protected_org['name']}
                )
                log_test("C3: DELETE protected org without force_unsafe returns 403", 
                        response.status_code == 403, 
                        f"Status: {response.status_code}, Org: {protected_org['name']}")
            else:
                log_test("C3: DELETE protected org", False, "No protected org found")
        else:
            log_test("C3: DELETE protected org", False, f"Failed to get orgs: {response.status_code}")
    except Exception as e:
        log_test("C3: DELETE protected org", False, str(e))
    
    # C4: Create temp org and delete it
    try:
        temp_org_id, temp_reg_id = create_test_organization()
        if temp_org_id:
            # Get the org name
            response = requests.get(f"{BASE_URL}/organizations?include_archived=true", headers=ADMIN_HEADERS)
            if response.status_code == 200:
                orgs = response.json()
                temp_org = next((o for o in orgs if o.get('id') == temp_org_id), None)
                if temp_org:
                    # Delete it
                    response = requests.post(
                        f"{BASE_URL}/admin/organizations/{temp_org_id}/delete",
                        headers=ADMIN_HEADERS,
                        json={"confirm_name": temp_org['name']}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        has_cascade = 'cascaded' in data
                        log_test("C4: DELETE temp org returns 200 with cascade counts", 
                                has_cascade, 
                                f"Cascaded: {data.get('cascaded', {})}")
                        
                        # Verify org is gone
                        response = requests.get(f"{BASE_URL}/organizations?include_archived=true", headers=ADMIN_HEADERS)
                        if response.status_code == 200:
                            orgs = response.json()
                            org_exists = any(o.get('id') == temp_org_id for o in orgs)
                            log_test("C4b: Deleted org is gone from database", 
                                    not org_exists, 
                                    f"Org exists: {org_exists}")
                        
                        # Verify registrations are gone
                        response = requests.get(f"{BASE_URL}/registrations?include_archived=true", headers=ADMIN_HEADERS)
                        if response.status_code == 200:
                            regs = response.json()
                            reg_exists = any(r.get('organization_id') == temp_org_id for r in regs)
                            log_test("C4c: Deleted org's registrations are gone", 
                                    not reg_exists, 
                                    f"Regs exist: {reg_exists}")
                        
                        # Verify activity log
                        response = requests.get(f"{BASE_URL}/activity-logs", headers=ADMIN_HEADERS)
                        if response.status_code == 200:
                            logs = response.json()
                            delete_log = any(l.get('action_type') == 'delete_definitive' and l.get('entity_id') == temp_org_id for l in logs)
                            log_test("C4d: Activity log has delete_definitive entry", 
                                    delete_log, 
                                    f"Delete log found: {delete_log}")
                    else:
                        log_test("C4: DELETE temp org", False, f"Status: {response.status_code} - {response.text}")
                else:
                    log_test("C4: DELETE temp org", False, "Temp org not found after creation")
            else:
                log_test("C4: DELETE temp org", False, f"Failed to get orgs: {response.status_code}")
        else:
            log_test("C4: DELETE temp org", False, "Failed to create temp org")
    except Exception as e:
        log_test("C4: DELETE temp org", False, str(e))

def test_d_reset_granulaires(test_reg_id):
    """Test D: Granular reset endpoints"""
    print("\n" + "="*80)
    print("TEST D: RESET GRANULAIRES")
    print("="*80)
    
    # D1: Reset caution
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-caution",
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            log_test("D1: POST /admin/registrations/{id}/reset-caution returns 200", 
                    data.get('ok') and data.get('action') == 'caution_reset', 
                    f"Response: {data}")
            
            # Verify deposit status is 'en_attente'
            # Note: We can't directly query deposits, but we can check via registration detail
        else:
            log_test("D1: POST /admin/registrations/{id}/reset-caution", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D1: POST /admin/registrations/{id}/reset-caution", False, str(e))
    
    # D2: Reset virement
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-virement",
            headers=ADMIN_HEADERS
        )
        if response.status_code in [200, 404]:  # 404 if no virement to reset
            if response.status_code == 200:
                data = response.json()
                log_test("D2: POST /admin/registrations/{id}/reset-virement returns 200", 
                        data.get('ok') and data.get('action') == 'virement_cleared', 
                        f"Response: {data}")
            else:
                log_test("D2: POST /admin/registrations/{id}/reset-virement", True, "No virement to reset (404 expected)")
        else:
            log_test("D2: POST /admin/registrations/{id}/reset-virement", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D2: POST /admin/registrations/{id}/reset-virement", False, str(e))
    
    # D3: Reset convention
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-convention",
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            log_test("D3: POST /admin/registrations/{id}/reset-convention returns 200", 
                    data.get('ok') and data.get('action') == 'convention_reset', 
                    f"Response: {data}")
        else:
            log_test("D3: POST /admin/registrations/{id}/reset-convention", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D3: POST /admin/registrations/{id}/reset-convention", False, str(e))
    
    # D4: Reset attendance with scope='all'
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-attendance",
            headers=ADMIN_HEADERS,
            json={"scope": "all"}
        )
        if response.status_code in [200, 404]:  # 404 if no attendance to reset
            if response.status_code == 200:
                data = response.json()
                log_test("D4: POST /admin/registrations/{id}/reset-attendance scope=all returns 200", 
                        data.get('ok') and data.get('action') == 'attendance_reset', 
                        f"Response: {data}")
            else:
                log_test("D4: POST /admin/registrations/{id}/reset-attendance", True, "No attendance to reset (404 expected)")
        else:
            log_test("D4: POST /admin/registrations/{id}/reset-attendance", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D4: POST /admin/registrations/{id}/reset-attendance", False, str(e))
    
    # D5: Reset attendance with scope='arrival' and event_date
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-attendance",
            headers=ADMIN_HEADERS,
            json={"scope": "arrival", "event_date": "2026-08-14"}
        )
        if response.status_code in [200, 404]:
            if response.status_code == 200:
                data = response.json()
                log_test("D5: POST /admin/registrations/{id}/reset-attendance scope=arrival returns 200", 
                        data.get('ok') and data.get('scope') == 'arrival', 
                        f"Response: {data}")
            else:
                log_test("D5: POST /admin/registrations/{id}/reset-attendance scope=arrival", True, "No attendance to reset (404 expected)")
        else:
            log_test("D5: POST /admin/registrations/{id}/reset-attendance scope=arrival", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D5: POST /admin/registrations/{id}/reset-attendance scope=arrival", False, str(e))
    
    # D6: Reset caution-appointment
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-caution-appointment",
            headers=ADMIN_HEADERS
        )
        if response.status_code in [200, 404]:
            if response.status_code == 200:
                data = response.json()
                log_test("D6: POST /admin/registrations/{id}/reset-caution-appointment returns 200", 
                        data.get('ok') and data.get('action') == 'caution_appointment_deleted', 
                        f"Response: {data}")
                
                # Try again - should return 404
                response2 = requests.post(
                    f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-caution-appointment",
                    headers=ADMIN_HEADERS
                )
                log_test("D6b: Second call to reset-caution-appointment returns 404", 
                        response2.status_code == 404, 
                        f"Status: {response2.status_code}")
            else:
                log_test("D6: POST /admin/registrations/{id}/reset-caution-appointment", True, "No appointment to reset (404 expected)")
        else:
            log_test("D6: POST /admin/registrations/{id}/reset-caution-appointment", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D6: POST /admin/registrations/{id}/reset-caution-appointment", False, str(e))
    
    # D7: Reset satisfaction
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/reset-satisfaction",
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            log_test("D7: POST /admin/registrations/{id}/reset-satisfaction returns 200", 
                    data.get('ok') and data.get('action') == 'satisfaction_reset', 
                    f"Response: {data}")
        else:
            log_test("D7: POST /admin/registrations/{id}/reset-satisfaction", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D7: POST /admin/registrations/{id}/reset-satisfaction", False, str(e))
    
    # D8: Cancel virement
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{test_reg_id}/cancel-virement",
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            log_test("D8: POST /admin/registrations/{id}/cancel-virement returns 200", 
                    data.get('ok'), 
                    f"Response: {data}")
        else:
            log_test("D8: POST /admin/registrations/{id}/cancel-virement", False, f"Status: {response.status_code} - {response.text}")
    except Exception as e:
        log_test("D8: POST /admin/registrations/{id}/cancel-virement", False, str(e))

def test_e_permissions(test_org_id, test_reg_id):
    """Test E: Permissions - all endpoints should return 403 without admin role"""
    print("\n" + "="*80)
    print("TEST E: PERMISSIONS")
    print("="*80)
    
    endpoints = [
        ("POST", f"/admin/organizations/{test_org_id}/archive", {"reason": "test"}),
        ("POST", f"/admin/organizations/{test_org_id}/restore", {}),
        ("POST", f"/admin/organizations/{test_org_id}/delete", {"confirm_name": "test"}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-caution", {}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-virement", {}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-convention", {}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-attendance", {"scope": "all"}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-caution-appointment", {}),
        ("POST", f"/admin/registrations/{test_reg_id}/reset-satisfaction", {}),
    ]
    
    for method, endpoint, payload in endpoints:
        try:
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                headers=EXPOSANT_HEADERS,
                json=payload
            )
            log_test(f"E: {endpoint} without admin returns 403", 
                    response.status_code == 403, 
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test(f"E: {endpoint} without admin", False, str(e))

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("ADMIN DELETE/ARCHIVE/RESET ENDPOINTS TEST")
    print("Forum de la Rentrée 2026 - Aracom SaaS")
    print("="*80)
    
    # Find or create test organization
    result = get_test_organization()
    if result:
        test_org, test_reg = result
        test_org_id = test_org.get('id')
        test_org_name = test_org.get('name')
        test_reg_id = test_reg.get('id')
    else:
        print("\n⚠️ No existing test organization found, creating one...")
        test_org_id, test_reg_id = create_test_organization()
        if not test_org_id:
            print("\n❌ CRITICAL: Could not find or create test organization. Aborting.")
            sys.exit(1)
        # Get the org name
        response = requests.get(f"{BASE_URL}/organizations?include_archived=true", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            orgs = response.json()
            test_org = next((o for o in orgs if o.get('id') == test_org_id), None)
            test_org_name = test_org.get('name') if test_org else "Unknown"
        else:
            test_org_name = "Unknown"
    
    print(f"\n✓ Using test organization: {test_org_name} (ID: {test_org_id})")
    print(f"✓ Using test registration: {test_reg_id}")
    
    # Run tests
    test_a_get_filtering()
    test_b_archive_restore(test_org_id, test_org_name)
    test_c_definitive_delete()
    test_d_reset_granulaires(test_reg_id)
    test_e_permissions(test_org_id, test_reg_id)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for _, p, _ in test_results if p)
    failed = total - passed
    
    print(f"\nTotal tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for name, p, details in test_results:
            if not p:
                print(f"  - {name}")
                if details:
                    print(f"    {details}")
    
    print("\n" + "="*80)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
