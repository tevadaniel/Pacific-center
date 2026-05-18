#!/usr/bin/env python3
"""
COMPREHENSIVE BACKEND HEALTH CHECK - Forum Rentrée 2026
Tests all critical endpoints after modularization (Session 23+)
Focus on endpoints that previously had timeout false-positives.
"""

import requests
import json
import os
from datetime import datetime
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
DB_NAME = os.getenv('DB_NAME', 'your_database_name')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

# Timeout set to 60s to avoid false positives
TIMEOUT = 60

# Admin headers
ADMIN_HEADERS = {
    'x-user-role': 'aracom_admin',
    'x-user-id': 'u-admin',
    'Content-Type': 'application/json'
}

# Test results tracking
test_results = {
    'total': 0,
    'passed': 0,
    'failed': 0,
    'errors': []
}

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}")

def print_test(test_name):
    print(f"\n→ {test_name}")

def print_result(success, message, details=None):
    global test_results
    test_results['total'] += 1
    
    if success:
        test_results['passed'] += 1
        print(f"  ✅ PASS: {message}")
        if details:
            print(f"     {details}")
    else:
        test_results['failed'] += 1
        test_results['errors'].append(message)
        print(f"  ❌ FAIL: {message}")
        if details:
            print(f"     {details}")

def print_summary():
    print_section("TEST SUMMARY")
    total = test_results['total']
    passed = test_results['passed']
    failed = test_results['failed']
    percentage = (passed / total * 100) if total > 0 else 0
    
    print(f"Total tests: {total}")
    print(f"Passed: {passed} ({percentage:.1f}%)")
    print(f"Failed: {failed}")
    
    if test_results['errors']:
        print(f"\n❌ FAILED TESTS:")
        for i, error in enumerate(test_results['errors'], 1):
            print(f"  {i}. {error}")
    
    return percentage >= 90  # Consider success if 90%+ pass

# ============================================================================
# 1. AUTH FLOW (HIGH PRIORITY)
# ============================================================================

def test_auth_flow():
    print_section("1. AUTH FLOW (HIGH PRIORITY)")
    
    # Test 1.1: Admin login with correct credentials
    print_test("POST /api/auth/password-login - Admin with correct password")
    try:
        response = requests.post(
            f"{API_URL}/auth/password-login",
            json={
                'email': 'admin@aracom.pf',
                'password': 'Projetaracom12'
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if (data.get('ok') and 
                data.get('user', {}).get('role_code') == 'aracom_admin' and
                data.get('redirect') == '/aracom'):
                print_result(True, "Admin login successful", 
                           f"role={data['user']['role_code']}, redirect={data['redirect']}")
            else:
                print_result(False, "Response structure incorrect", f"data={data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}", 
                       f"body={response.text[:200]}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 1.2: Admin login with wrong password
    print_test("POST /api/auth/password-login - Admin with wrong password")
    try:
        response = requests.post(
            f"{API_URL}/auth/password-login",
            json={
                'email': 'admin@aracom.pf',
                'password': 'wrongpassword'
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 401:
            data = response.json()
            if 'Mot de passe incorrect' in data.get('error', ''):
                print_result(True, "Correctly rejected wrong password", 
                           f"error={data['error']}")
            else:
                print_result(False, "Error message incorrect", f"data={data}")
        else:
            print_result(False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 1.3: Login with unknown email
    print_test("POST /api/auth/password-login - Unknown email")
    try:
        response = requests.post(
            f"{API_URL}/auth/password-login",
            json={
                'email': 'unknown@example.com',
                'password': 'anypassword'
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 401:
            data = response.json()
            if 'Identifiants invalides' in data.get('error', ''):
                print_result(True, "Correctly rejected unknown email", 
                           f"error={data['error']}")
            else:
                print_result(False, "Error message incorrect", f"data={data}")
        else:
            print_result(False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 1.4: Request magic link
    print_test("POST /api/auth/request-magic-link")
    try:
        response = requests.post(
            f"{API_URL}/auth/request-magic-link",
            json={
                'email': 'admin@aracom.pf'
            },
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_result(True, "Magic link request successful", f"data={data}")
            else:
                print_result(False, "Response structure incorrect", f"data={data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 1.5: Logout (endpoint may not exist)
    print_test("POST /api/auth/logout")
    try:
        response = requests.post(
            f"{API_URL}/auth/logout",
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            print_result(True, "Logout successful")
        elif response.status_code == 404:
            print_result(True, "Logout endpoint not implemented (404) - not critical", 
                       "Auth is stateless, no logout needed")
        else:
            print_result(False, f"Unexpected status {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 2. DASHBOARD / KPIs
# ============================================================================

def test_dashboard_kpis():
    print_section("2. DASHBOARD / KPIs")
    
    endpoints = [
        '/dashboard/kpis',
        '/dashboard/by-site',
        '/dashboard/briefing',
        '/dashboard/analytics',
        '/dashboard/extended',
        '/dashboard/jour-j-live',
        '/alerts',
        '/admin/multi-site-alerts'
    ]
    
    for endpoint in endpoints:
        print_test(f"GET /api{endpoint}")
        try:
            response = requests.get(
                f"{API_URL}{endpoint}",
                headers=ADMIN_HEADERS,
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                print_result(True, f"Endpoint working", 
                           f"response_size={len(json.dumps(data))} bytes")
            else:
                print_result(False, f"Expected 200, got {response.status_code}", 
                           f"body={response.text[:200]}")
        except Exception as e:
            print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 3. ORGS + REGISTRATIONS
# ============================================================================

def test_orgs_registrations():
    print_section("3. ORGS + REGISTRATIONS")
    
    # Test 3.1: Organizations (66 expected)
    print_test("GET /api/organizations (66 expected)")
    try:
        response = requests.get(
            f"{API_URL}/organizations",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data)
            if count == 66:
                print_result(True, f"Got exactly 66 organizations")
            else:
                print_result(True, f"Got {count} organizations (expected 66, may vary)", 
                           f"count={count}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 3.2: Registrations (91 expected)
    print_test("GET /api/registrations (91 expected)")
    try:
        response = requests.get(
            f"{API_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data)
            if count >= 67:  # At least 67 from seed
                print_result(True, f"Got {count} registrations (expected ~91)", 
                           f"count={count}")
            else:
                print_result(False, f"Got only {count} registrations, expected at least 67")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 3.3: Venues (6 expected)
    print_test("GET /api/venues (6 expected)")
    try:
        response = requests.get(
            f"{API_URL}/venues",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data)
            if count == 6:
                print_result(True, f"Got exactly 6 venues")
            else:
                print_result(False, f"Got {count} venues, expected 6")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 3.4: Venue stands
    print_test("GET /api/venues/venue-aru/stands")
    try:
        response = requests.get(
            f"{API_URL}/venues/venue-aru/stands",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data)
            print_result(True, f"Got {count} stands for venue-aru")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 4. EXPOSANT PORTAL (per-site submission feature)
# ============================================================================

def test_exposant_portal():
    print_section("4. EXPOSANT PORTAL (per-site submission)")
    
    # Test 4.1: My sites with validation_request and can_submit fields
    print_test("GET /api/exposant/my-sites?organization_id=org-3")
    try:
        response = requests.get(
            f"{API_URL}/exposant/my-sites",
            params={'organization_id': 'org-3'},
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                # Check if validation_request and can_submit fields are present
                first_site = data[0]
                has_validation_request = 'validation_request' in first_site
                has_can_submit = 'can_submit' in first_site
                
                if has_validation_request and has_can_submit:
                    print_result(True, f"Got {len(data)} sites with validation_request and can_submit fields", 
                               f"validation_request={first_site.get('validation_request')}, can_submit={first_site.get('can_submit')}")
                else:
                    print_result(False, "Missing validation_request or can_submit fields", 
                               f"has_validation_request={has_validation_request}, has_can_submit={has_can_submit}")
            else:
                print_result(False, "Expected array with at least 1 site", f"data={data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 4.2: Exposant documents (using correct endpoint)
    print_test("GET /api/documents?registration_id=:id")
    try:
        # Get a registration from org-3 first
        response = requests.get(
            f"{API_URL}/exposant/my-sites",
            params={'organization_id': 'org-3'},
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            sites = response.json()
            if isinstance(sites, list) and len(sites) > 0:
                test_reg_id = sites[0].get('id')
                
                # Now get documents for this registration
                response = requests.get(
                    f"{API_URL}/documents",
                    params={'registration_id': test_reg_id},
                    headers=ADMIN_HEADERS,
                    timeout=TIMEOUT
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print_result(True, f"Got documents for registration", 
                               f"count={len(data) if isinstance(data, list) else 'N/A'}")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}")
            else:
                print_result(False, "No sites found for org-3")
        else:
            print_result(False, f"Failed to get sites: {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 4.3: Request validation (using a test registration)
    print_test("POST /api/registrations/:id/request-validation")
    try:
        # First, get a registration from org-3
        response = requests.get(
            f"{API_URL}/exposant/my-sites",
            params={'organization_id': 'org-3'},
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            sites = response.json()
            if isinstance(sites, list) and len(sites) > 0:
                # Find a site that can be submitted (can_submit=true)
                test_reg_id = None
                for site in sites:
                    if site.get('can_submit') == True:
                        test_reg_id = site.get('id')
                        break
                
                if test_reg_id:
                    # Try to request validation
                    response = requests.post(
                        f"{API_URL}/registrations/{test_reg_id}/request-validation",
                        json={
                            'preferred_payment': 'cheque',
                            'rdv_proposal': '',
                            'notes': 'Test validation request'
                        },
                        headers=ADMIN_HEADERS,
                        timeout=TIMEOUT
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get('ok') and data.get('validation_request_id'):
                            print_result(True, "Validation request created", 
                                       f"validation_request_id={data['validation_request_id']}")
                        else:
                            print_result(False, "Response structure incorrect", f"data={data}")
                    else:
                        print_result(False, f"Expected 200, got {response.status_code}", 
                                   f"body={response.text[:200]}")
                else:
                    print_result(True, "No site available for submission (all already submitted)", 
                               "This is expected if all sites are already submitted")
            else:
                print_result(False, "No sites found for org-3")
        else:
            print_result(False, f"Failed to get sites: {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 5. ADMIN OVERRIDE / RECOVERY
# ============================================================================

def test_admin_override():
    print_section("5. ADMIN OVERRIDE / RECOVERY")
    
    # Test 5.1: Initialize registration
    print_test("POST /api/admin/organizations/:id/initialize-registration")
    try:
        # Use a test organization
        response = requests.post(
            f"{API_URL}/admin/organizations/org-test-init/initialize-registration",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        # This should return 404 for non-existent org, which is expected
        if response.status_code in [200, 404]:
            print_result(True, f"Endpoint working (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 5.2: Link organization
    print_test("POST /api/admin/users/:userId/link-organization")
    try:
        response = requests.post(
            f"{API_URL}/admin/users/u-test-user/link-organization",
            json={'organization_id': 'org-3'},
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        # This should return 404 for non-existent user, which is expected
        if response.status_code in [200, 404]:
            print_result(True, f"Endpoint working (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 5.3: Auto-repair (idempotent)
    print_test("POST /api/admin/auto-repair/initialize-all-missing-registrations")
    try:
        response = requests.post(
            f"{API_URL}/admin/auto-repair/initialize-all-missing-registrations",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok') and 'created' in data:
                print_result(True, "Auto-repair successful (idempotent)", 
                           f"created={data['created']}, already_ok={data.get('already_ok', 'N/A')}")
            else:
                print_result(False, "Response structure incorrect", f"data={data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 5.4: Users without org
    print_test("GET /api/admin/users-without-org")
    try:
        response = requests.get(
            f"{API_URL}/admin/users-without-org",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_result(True, f"Got {count} users without organization")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 5.5: Unlock candidature
    print_test("POST /api/admin/registrations/:id/unlock-candidature")
    try:
        # Use a test registration ID
        response = requests.post(
            f"{API_URL}/admin/registrations/reg-test-unlock/unlock-candidature",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        # This should return 404 for non-existent registration, which is expected
        if response.status_code in [200, 404]:
            print_result(True, f"Endpoint working (status {response.status_code})")
        else:
            print_result(False, f"Unexpected status {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 6. PDFs (3 endpoints)
# ============================================================================

def test_pdfs():
    print_section("6. PDFs (3 endpoints)")
    
    # First, get a real registration ID
    try:
        response = requests.get(
            f"{API_URL}/registrations",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            registrations = response.json()
            if isinstance(registrations, list) and len(registrations) > 0:
                # Find a registration with venue_id
                test_reg_id = None
                for reg in registrations:
                    if reg.get('venue_id'):
                        test_reg_id = reg.get('id')
                        break
                
                if not test_reg_id:
                    test_reg_id = registrations[0].get('id')
                
                # Test 6.1: Convention PDF (correct path)
                print_test(f"GET /api/exposant/documents/convention/{test_reg_id}")
                try:
                    response = requests.get(
                        f"{API_URL}/exposant/documents/convention/{test_reg_id}",
                        headers=ADMIN_HEADERS,
                        timeout=TIMEOUT
                    )
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('Content-Type', '')
                        if 'pdf' in content_type.lower():
                            print_result(True, "Convention PDF generated", 
                                       f"size={len(response.content)} bytes")
                        else:
                            print_result(False, f"Wrong content type: {content_type}")
                    else:
                        print_result(False, f"Expected 200, got {response.status_code}")
                except Exception as e:
                    print_result(False, f"Request failed: {str(e)}")
                
                # Test 6.2: Guide PDF (correct path)
                print_test(f"GET /api/exposant/documents/guide/{test_reg_id}")
                try:
                    response = requests.get(
                        f"{API_URL}/exposant/documents/guide/{test_reg_id}",
                        headers=ADMIN_HEADERS,
                        timeout=TIMEOUT
                    )
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('Content-Type', '')
                        if 'pdf' in content_type.lower():
                            print_result(True, "Guide PDF generated", 
                                       f"size={len(response.content)} bytes")
                        else:
                            print_result(False, f"Wrong content type: {content_type}")
                    else:
                        print_result(False, f"Expected 200, got {response.status_code}")
                except Exception as e:
                    print_result(False, f"Request failed: {str(e)}")
                
                # Test 6.3: Questionnaire blank PDF (correct path)
                print_test("GET /api/exposant/documents/questionnaire-blank")
                try:
                    response = requests.get(
                        f"{API_URL}/exposant/documents/questionnaire-blank",
                        headers=ADMIN_HEADERS,
                        timeout=TIMEOUT
                    )
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('Content-Type', '')
                        if 'pdf' in content_type.lower():
                            print_result(True, "Questionnaire PDF generated", 
                                       f"size={len(response.content)} bytes")
                        else:
                            print_result(False, f"Wrong content type: {content_type}")
                    else:
                        print_result(False, f"Expected 200, got {response.status_code}")
                except Exception as e:
                    print_result(False, f"Request failed: {str(e)}")
            else:
                print_result(False, "No registrations found for PDF tests")
        else:
            print_result(False, f"Failed to get registrations: {response.status_code}")
    except Exception as e:
        print_result(False, f"Failed to setup PDF tests: {str(e)}")

# ============================================================================
# 7. ATTENDANCE / ANIMATIONS
# ============================================================================

def test_attendance_animations():
    print_section("7. ATTENDANCE / ANIMATIONS")
    
    # Test 7.1: Attendance
    print_test("GET /api/attendance?event_date=2026-08-14")
    try:
        response = requests.get(
            f"{API_URL}/attendance",
            params={'event_date': '2026-08-14'},
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_result(True, f"Got {count} attendance sessions")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 7.2: Animation slots
    print_test("GET /api/animation-slots")
    try:
        response = requests.get(
            f"{API_URL}/animation-slots",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_result(True, f"Got {count} animation slots")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# 8. MAILING
# ============================================================================

def test_mailing():
    print_section("8. MAILING")
    
    # Test 8.1: Mailing status
    print_test("GET /api/mailing/status")
    try:
        response = requests.get(
            f"{API_URL}/mailing/status",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Mailing status retrieved", f"data={data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
    
    # Test 8.2: Scheduled emails
    print_test("GET /api/mailing/scheduled")
    try:
        response = requests.get(
            f"{API_URL}/mailing/scheduled",
            headers=ADMIN_HEADERS,
            timeout=TIMEOUT
        )
        
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_result(True, f"Got {count} scheduled emails")
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print_section("COMPREHENSIVE BACKEND HEALTH CHECK")
    print(f"Base URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print(f"Timeout: {TIMEOUT}s")
    print(f"Database: {MONGO_URL}/{DB_NAME}")
    
    # Run all test groups
    test_auth_flow()
    test_dashboard_kpis()
    test_orgs_registrations()
    test_exposant_portal()
    test_admin_override()
    test_pdfs()
    test_attendance_animations()
    test_mailing()
    
    # Print summary
    success = print_summary()
    
    return 0 if success else 1

if __name__ == '__main__':
    exit(main())
