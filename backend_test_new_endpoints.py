#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-teva",
    "x-user-role": "aracom_admin"
}
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-exposant",
    "x-user-role": "exposant"
}

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    return success

def ensure_admin_credentials():
    """Ensure admin credentials are created/reset"""
    print("=" * 80)
    print("ENSURING ADMIN CREDENTIALS")
    print("=" * 80)
    
    try:
        response = requests.post(f"{BASE_URL}/api/tools/ensure-admins", 
                               json={}, 
                               headers={"Content-Type": "application/json"})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin credentials ensured: {data}")
            return True
        else:
            print(f"❌ Failed to ensure admin credentials: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception ensuring admin credentials: {str(e)}")
        return False

def test_mailing_toggle_mode():
    """Test POST /api/mailing/toggle-test-mode endpoint"""
    print("\n" + "=" * 80)
    print("TESTING MAILING TOGGLE TEST/PRODUCTION MODE")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test 1.1: Sans confirm_password → 400
    print("\n1.1. Test without confirm_password")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "production"},
                               headers=ADMIN_HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'mot de passe' in error_msg.lower() or 'password' in error_msg.lower()
            passed_tests += log_test("Sans confirm_password → 400", success, f"Error: {error_msg}")
        else:
            log_test("Sans confirm_password → 400", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Sans confirm_password → 400", False, f"Exception: {str(e)}")
    
    # Test 1.2: Avec mauvais password → 401
    print("\n1.2. Test with wrong password")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "production", "confirm_password": "wrongpassword"},
                               headers=ADMIN_HEADERS)
        if response.status_code == 401:
            error_msg = response.json().get('error', '')
            success = 'incorrect' in error_msg.lower() or 'wrong' in error_msg.lower()
            passed_tests += log_test("Mauvais password → 401", success, f"Error: {error_msg}")
        else:
            log_test("Mauvais password → 401", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("Mauvais password → 401", False, f"Exception: {str(e)}")
    
    # Test 1.3: Sans header x-user-id → 401
    print("\n1.3. Test without x-user-id header")
    total_tests += 1
    try:
        headers_no_user = {"Content-Type": "application/json", "x-user-role": "aracom_admin"}
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "production", "confirm_password": "Projetaracom12"},
                               headers=headers_no_user)
        if response.status_code == 401:
            error_msg = response.json().get('error', '')
            success = 'session' in error_msg.lower() or 'admin' in error_msg.lower()
            passed_tests += log_test("Sans x-user-id → 401", success, f"Error: {error_msg}")
        else:
            log_test("Sans x-user-id → 401", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("Sans x-user-id → 401", False, f"Exception: {str(e)}")
    
    # Test 1.4: Avec rôle non-admin → 403
    print("\n1.4. Test with non-admin role")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "production", "confirm_password": "Projetaracom12"},
                               headers=EXPOSANT_HEADERS)
        if response.status_code in [401, 403]:
            error_msg = response.json().get('error', '')
            success = True  # Either 401 (user not found) or 403 (forbidden) is acceptable
            passed_tests += log_test("Rôle non-admin → 401/403", success, f"Status: {response.status_code}, Error: {error_msg}")
        else:
            log_test("Rôle non-admin → 401/403", False, f"Expected 401/403, got {response.status_code}")
    except Exception as e:
        log_test("Rôle non-admin → 401/403", False, f"Exception: {str(e)}")
    
    # Test 1.5: Mode invalide → 400
    print("\n1.5. Test with invalid mode")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "foo", "confirm_password": "Projetaracom12"},
                               headers=ADMIN_HEADERS)
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'mode' in error_msg.lower() or 'invalid' in error_msg.lower()
            passed_tests += log_test("Mode invalide → 400", success, f"Error: {error_msg}")
        else:
            log_test("Mode invalide → 400", False, f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("Mode invalide → 400", False, f"Exception: {str(e)}")
    
    # Test 1.6: Bascule légitime vers production
    print("\n1.6. Test legitimate switch to production")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "production", "confirm_password": "Projetaracom12"},
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("ok") == True and 
                      data.get("test_mode_active") == False and
                      "PRODUCTION" in data.get("message", ""))
            passed_tests += log_test("Bascule vers production", success, f"Response: {data}")
        else:
            log_test("Bascule vers production", False, f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("Bascule vers production", False, f"Exception: {str(e)}")
    
    # Test 1.7: Vérifier status après bascule production
    print("\n1.7. Verify status after production switch")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("config_source") == "database" and
                      data.get("test_mode_active") == False and
                      data.get("updated_by") is not None and
                      data.get("updated_at") is not None)
            passed_tests += log_test("Status après production", success, f"config_source: {data.get('config_source')}, test_mode_active: {data.get('test_mode_active')}")
        else:
            log_test("Status après production", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Status après production", False, f"Exception: {str(e)}")
    
    # Test 1.8: Bascule retour vers test
    print("\n1.8. Test switch back to test mode")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                               json={"mode": "test", "confirm_password": "Projetaracom12"},
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("test_mode_active") == True
            passed_tests += log_test("Bascule vers test", success, f"test_mode_active: {data.get('test_mode_active')}")
        else:
            log_test("Bascule vers test", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Bascule vers test", False, f"Exception: {str(e)}")
    
    # Test 1.9: Vérifier audit_log créé
    print("\n1.9. Verify audit log created")
    total_tests += 1
    try:
        # We can't directly access audit_logs collection, but we can verify the toggle worked
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("config_source") == "database" and
                      data.get("updated_by") is not None)
            passed_tests += log_test("Audit log (inferred)", success, f"updated_by: {data.get('updated_by')}")
        else:
            log_test("Audit log (inferred)", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Audit log (inferred)", False, f"Exception: {str(e)}")
    
    print(f"\nMAILING TOGGLE MODE SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

def test_mailing_status():
    """Test GET /api/mailing/status endpoint"""
    print("\n" + "=" * 80)
    print("TESTING MAILING STATUS ENDPOINT")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test 2.1: Retourne tous les champs requis
    print("\n2.1. Test all required fields")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            required_fields = ['test_mode_active', 'redirect_to', 'allowed_recipients', 
                             'smtp_configured', 'config_source', 'updated_at', 'updated_by']
            has_all_fields = all(field in data for field in required_fields)
            passed_tests += log_test("Tous les champs requis", has_all_fields, f"Fields: {list(data.keys())}")
        else:
            log_test("Tous les champs requis", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Tous les champs requis", False, f"Exception: {str(e)}")
    
    # Test 2.2: config_source="database" quand DB doc existe
    print("\n2.2. Test config_source=database")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("config_source") == "database"
            passed_tests += log_test("config_source=database", success, f"config_source: {data.get('config_source')}")
        else:
            log_test("config_source=database", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("config_source=database", False, f"Exception: {str(e)}")
    
    # Test 2.3: Aucune auth requise (endpoint public)
    print("\n2.3. Test public endpoint (no auth)")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", 
                               headers={"Content-Type": "application/json"})
        if response.status_code == 200:
            data = response.json()
            success = 'test_mode_active' in data
            passed_tests += log_test("Endpoint public", success, f"Accessible sans auth")
        else:
            log_test("Endpoint public", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Endpoint public", False, f"Exception: {str(e)}")
    
    print(f"\nMAILING STATUS SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

def test_dashboard_analytics():
    """Test GET /api/dashboard/analytics endpoint"""
    print("\n" + "=" * 80)
    print("TESTING DASHBOARD ANALYTICS ENDPOINT")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test 3.1: Retourne tous les champs requis
    print("\n3.1. Test all required fields")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            required_fields = ['historic', 'disciplines', 'completion', 'cautions_status', 
                             'mailing_funnel', 'registrations_timeline', 'days_to_event',
                             'total_organizations', 'total_registrations', 'total_campaigns']
            has_all_fields = all(field in data for field in required_fields)
            passed_tests += log_test("Tous les champs analytics", has_all_fields, f"Fields: {list(data.keys())}")
        else:
            log_test("Tous les champs analytics", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Tous les champs analytics", False, f"Exception: {str(e)}")
    
    # Test 3.2: historic contient 8 années (2019-2026)
    print("\n3.2. Test historic years")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            historic = data.get('historic', [])
            years = [item.get('year') for item in historic]
            expected_years = list(range(2019, 2027))  # 2019 to 2026
            success = len(historic) == 8 and all(year in years for year in expected_years)
            passed_tests += log_test("Historic 8 années", success, f"Years: {years}")
        else:
            log_test("Historic 8 années", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Historic 8 années", False, f"Exception: {str(e)}")
    
    # Test 3.3: completion somme = total_registrations
    print("\n3.3. Test completion sum")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            completion = data.get('completion', [])
            total_registrations = data.get('total_registrations', 0)
            completion_sum = sum(bucket.get('count', 0) for bucket in completion)
            success = completion_sum == total_registrations
            passed_tests += log_test("Completion sum = total", success, f"Sum: {completion_sum}, Total: {total_registrations}")
        else:
            log_test("Completion sum = total", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Completion sum = total", False, f"Exception: {str(e)}")
    
    # Test 3.4: registrations_timeline a 31 entrées
    print("\n3.4. Test timeline entries")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            timeline = data.get('registrations_timeline', [])
            success = len(timeline) == 31
            passed_tests += log_test("Timeline 31 entrées", success, f"Entries: {len(timeline)}")
        else:
            log_test("Timeline 31 entrées", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Timeline 31 entrées", False, f"Exception: {str(e)}")
    
    # Test 3.5: days_to_event est positif
    print("\n3.5. Test days to event")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            days_to_event = data.get('days_to_event', 0)
            success = isinstance(days_to_event, (int, float)) and days_to_event > 0
            passed_tests += log_test("Days to event positif", success, f"Days: {days_to_event}")
        else:
            log_test("Days to event positif", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Days to event positif", False, f"Exception: {str(e)}")
    
    print(f"\nDASHBOARD ANALYTICS SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

def test_auth_register_disabled():
    """Test POST /api/auth/register should be disabled"""
    print("\n" + "=" * 80)
    print("TESTING AUTH REGISTER DISABLED")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test 4.1: Inscription publique désactivée
    print("\n4.1. Test public registration disabled")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register",
                               json={
                                   "email": "test@example.com",
                                   "password": "testpass",
                                   "name": "Test User"
                               },
                               headers={"Content-Type": "application/json"})
        if response.status_code == 403:
            error_msg = response.json().get('error', '')
            success = 'désactivée' in error_msg.lower() or 'disabled' in error_msg.lower()
            passed_tests += log_test("Inscription désactivée → 403", success, f"Error: {error_msg}")
        else:
            log_test("Inscription désactivée → 403", False, f"Expected 403, got {response.status_code}")
    except Exception as e:
        log_test("Inscription désactivée → 403", False, f"Exception: {str(e)}")
    
    print(f"\nAUTH REGISTER SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

def test_non_regression():
    """Test non-regression endpoints"""
    print("\n" + "=" * 80)
    print("TESTING NON-REGRESSION ENDPOINTS")
    print("=" * 80)
    
    passed_tests = 0
    total_tests = 0
    
    # Test 5.1: POST /api/mailing/send-test utilise config DB
    print("\n5.1. Test send-test uses DB config")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/send-test",
                               json={"to": "test@example.com"},
                               headers=ADMIN_HEADERS)
        if response.status_code in [200, 400]:  # 400 if SMTP not configured is OK
            data = response.json()
            # Check if test_mode_active is in response (indicating DB config usage)
            success = 'test_mode_active' in data or response.status_code == 400
            passed_tests += log_test("Send-test utilise DB config", success, f"Response includes test_mode or SMTP error")
        else:
            log_test("Send-test utilise DB config", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Send-test utilise DB config", False, f"Exception: {str(e)}")
    
    # Test 5.2: POST /api/mailing/send utilise config DB
    print("\n5.2. Test send uses DB config")
    total_tests += 1
    try:
        # Get some registration IDs first
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            registrations = regs_response.json()
            if registrations:
                reg_ids = [reg['id'] for reg in registrations[:2]]  # Take first 2
                
                response = requests.post(f"{BASE_URL}/api/mailing/send",
                                       json={
                                           "subject": "Test mailing",
                                           "body_html": "<p>Test message</p>",
                                           "registration_ids": reg_ids
                                       },
                                       headers=ADMIN_HEADERS)
                if response.status_code == 200:
                    data = response.json()
                    has_test_mode = 'test_mode_active' in data
                    has_redirect_to = 'redirect_to' in data
                    has_redirected_count = 'redirected_count' in data
                    success = has_test_mode and has_redirect_to and has_redirected_count
                    passed_tests += log_test("Send utilise DB config", success, f"Has test_mode_active: {has_test_mode}")
                else:
                    log_test("Send utilise DB config", False, f"Status: {response.status_code}")
            else:
                log_test("Send utilise DB config", False, "No registrations found")
        else:
            log_test("Send utilise DB config", False, "Failed to get registrations")
    except Exception as e:
        log_test("Send utilise DB config", False, f"Exception: {str(e)}")
    
    # Test 5.3: POST /api/seed avec force: false
    print("\n5.3. Test seed idempotent")
    total_tests += 1
    try:
        response = requests.post(f"{BASE_URL}/api/seed",
                               json={"force": False},
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("seeded") == False  # Should be idempotent
            passed_tests += log_test("Seed idempotent", success, f"Seeded: {data.get('seeded')}")
        else:
            log_test("Seed idempotent", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Seed idempotent", False, f"Exception: {str(e)}")
    
    # Test 5.4: GET /api/dashboard/kpis fonctionne
    print("\n5.4. Test dashboard KPIs")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = 'total' in data
            passed_tests += log_test("Dashboard KPIs", success, f"Total: {data.get('total')}")
        else:
            log_test("Dashboard KPIs", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Dashboard KPIs", False, f"Exception: {str(e)}")
    
    # Test 5.5: GET /api/dashboard/extended fonctionne
    print("\n5.5. Test dashboard extended")
    total_tests += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/extended", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = 'days_to_event' in data
            passed_tests += log_test("Dashboard extended", success, f"Days to event: {data.get('days_to_event')}")
        else:
            log_test("Dashboard extended", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("Dashboard extended", False, f"Exception: {str(e)}")
    
    print(f"\nNON-REGRESSION SUMMARY: {passed_tests}/{total_tests} tests passed")
    return passed_tests, total_tests

def ensure_test_mode_at_end():
    """Ensure system is left in TEST mode"""
    print("\n" + "=" * 80)
    print("ENSURING SYSTEM IS IN TEST MODE")
    print("=" * 80)
    
    try:
        # Check current status
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            if data.get("test_mode_active") == False:
                # Switch back to test mode
                toggle_response = requests.post(f"{BASE_URL}/api/mailing/toggle-test-mode",
                                              json={"mode": "test", "confirm_password": "Projetaracom12"},
                                              headers=ADMIN_HEADERS)
                if toggle_response.status_code == 200:
                    print("✅ System switched back to TEST mode")
                    return True
                else:
                    print("❌ Failed to switch back to TEST mode")
                    return False
            else:
                print("✅ System already in TEST mode")
                return True
        else:
            print("❌ Failed to check mailing status")
            return False
    except Exception as e:
        print(f"❌ Exception ensuring test mode: {str(e)}")
        return False

if __name__ == "__main__":
    print("🧪 BACKEND TESTING - NEW ENDPOINTS FORUM DE LA RENTRÉE 2026")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Headers: {ADMIN_HEADERS}")
    
    # Ensure admin credentials
    if not ensure_admin_credentials():
        print("❌ Failed to ensure admin credentials. Exiting.")
        sys.exit(1)
    
    # Run all tests
    toggle_passed, toggle_total = test_mailing_toggle_mode()
    status_passed, status_total = test_mailing_status()
    analytics_passed, analytics_total = test_dashboard_analytics()
    register_passed, register_total = test_auth_register_disabled()
    regression_passed, regression_total = test_non_regression()
    
    # Ensure system is in test mode at the end
    test_mode_ensured = ensure_test_mode_at_end()
    
    # Final summary
    total_passed = toggle_passed + status_passed + analytics_passed + register_passed + regression_passed
    total_tests = toggle_total + status_total + analytics_total + register_total + regression_total
    
    print("\n" + "=" * 80)
    print("FINAL TEST SUMMARY")
    print("=" * 80)
    print(f"Mailing Toggle Mode: {toggle_passed}/{toggle_total} passed")
    print(f"Mailing Status: {status_passed}/{status_total} passed")
    print(f"Dashboard Analytics: {analytics_passed}/{analytics_total} passed")
    print(f"Auth Register Disabled: {register_passed}/{register_total} passed")
    print(f"Non-Regression: {regression_passed}/{regression_total} passed")
    print(f"OVERALL: {total_passed}/{total_tests} tests passed ({(total_passed/total_tests)*100:.1f}%)")
    print(f"Test mode ensured: {'✅' if test_mode_ensured else '❌'}")
    
    if total_passed == total_tests and test_mode_ensured:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"❌ {total_tests - total_passed} tests failed or test mode not ensured")
        sys.exit(1)