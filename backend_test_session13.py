#!/usr/bin/env python3
"""
Backend Testing - Session 13 (LOTS 2/4 Finalisation)
Tests for:
1. Référents ARACOM par site (POST /api/venues/:id/set-referent)
2. AI Email Reminder J-X (POST /api/registrations/:id/generate-jx-reminder)
3. Non-régression rapide sur endpoints critiques
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-admin-aracom",
    "x-user-role": "aracom_admin"
}
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "exposant"
}

def log_test(test_name, success, details=""):
    """Log test result with status"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    return success

def test_referents_par_site():
    """Test 1: Référents ARACOM par site - POST /api/venues/:id/set-referent"""
    print("\n" + "=" * 80)
    print("TEST 1: RÉFÉRENTS PAR SITE — POST /api/venues/:id/set-referent")
    print("=" * 80)
    
    passed = 0
    total = 0
    
    # Test 1.1: POST set-referent (admin, valid data)
    print("\n[Test 1.1] POST /api/venues/venue-faaa/set-referent (admin, valid data)")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/venues/venue-faaa/set-referent",
            json={
                "name": "Teva GEROS",
                "email": "contact@aracom-conseil.fr",
                "phone": "+(689) 87 210 444"
            },
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") == True and
                data.get("referent", {}).get("name") == "Teva GEROS" and
                data.get("referent", {}).get("email") == "contact@aracom-conseil.fr" and
                data.get("referent", {}).get("phone") == "+(689) 87 210 444"
            )
            if success:
                passed += 1
            log_test("POST set-referent (admin, valid)", success, 
                    f"Response: {json.dumps(data, ensure_ascii=False)}")
        else:
            log_test("POST set-referent (admin, valid)", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("POST set-referent (admin, valid)", False, f"Exception: {str(e)}")
    
    # Test 1.2: GET /api/venues - verify referent persisted
    print("\n[Test 1.2] GET /api/venues - verify referent_aracom persisted")
    total += 1
    try:
        response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            venues = response.json()
            faaa_venue = next((v for v in venues if v.get('id') == 'venue-faaa'), None)
            if faaa_venue:
                referent = faaa_venue.get('referent_aracom', {})
                success = (
                    referent.get('name') == "Teva GEROS" and
                    referent.get('email') == "contact@aracom-conseil.fr" and
                    referent.get('phone') == "+(689) 87 210 444"
                )
                if success:
                    passed += 1
                log_test("GET venues - referent persisted", success, 
                        f"Referent: {json.dumps(referent, ensure_ascii=False)}")
            else:
                log_test("GET venues - referent persisted", False, "venue-faaa not found")
        else:
            log_test("GET venues - referent persisted", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET venues - referent persisted", False, f"Exception: {str(e)}")
    
    # Test 1.3: POST set-referent (non-admin) → 403
    print("\n[Test 1.3] POST set-referent (exposant role) → 403")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/venues/venue-faaa/set-referent",
            json={"name": "Test", "email": "test@test.com", "phone": "123"},
            headers=EXPOSANT_HEADERS
        )
        if response.status_code == 403:
            error_msg = response.json().get('error', '')
            success = 'admin' in error_msg.lower()
            if success:
                passed += 1
            log_test("POST set-referent (non-admin) → 403", success, f"Error: {error_msg}")
        else:
            log_test("POST set-referent (non-admin) → 403", False, 
                    f"Expected 403, got {response.status_code}")
    except Exception as e:
        log_test("POST set-referent (non-admin) → 403", False, f"Exception: {str(e)}")
    
    # Test 1.4: POST set-referent with empty strings (should set to null)
    print("\n[Test 1.4] POST set-referent (empty strings → null)")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/venues/venue-faaa/set-referent",
            json={"name": "", "email": "", "phone": ""},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            referent = data.get("referent", {})
            success = (
                referent.get('name') is None and
                referent.get('email') is None and
                referent.get('phone') is None
            )
            if success:
                passed += 1
            log_test("POST set-referent (empty → null)", success, 
                    f"Referent: {json.dumps(referent, ensure_ascii=False)}")
        else:
            log_test("POST set-referent (empty → null)", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST set-referent (empty → null)", False, f"Exception: {str(e)}")
    
    # Test 1.5: POST set-referent on non-existent venue (silent success expected)
    print("\n[Test 1.5] POST set-referent (non-existent venue)")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/venues/venue-INEXISTANT/set-referent",
            json={"name": "Test", "email": "test@test.com", "phone": "123"},
            headers=ADMIN_HEADERS
        )
        # Mongo updateOne returns ok even if no document matched
        success = response.status_code == 200
        if success:
            passed += 1
        log_test("POST set-referent (non-existent venue)", success, 
                f"Status: {response.status_code} (silent success expected)")
    except Exception as e:
        log_test("POST set-referent (non-existent venue)", False, f"Exception: {str(e)}")
    
    print(f"\n📊 RÉFÉRENTS PAR SITE: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed, total


def test_ai_email_reminder_jx():
    """Test 2: AI Email Reminder J-X - POST /api/registrations/:id/generate-jx-reminder"""
    print("\n" + "=" * 80)
    print("TEST 2: AI EMAIL REMINDER J-X — POST /api/registrations/:id/generate-jx-reminder")
    print("=" * 80)
    
    passed = 0
    total = 0
    
    # First, get a valid registration ID
    print("\n[Setup] Getting a valid registration ID...")
    reg_id = None
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            registrations = response.json()
            if registrations:
                reg_id = registrations[0]['id']
                print(f"    Using registration ID: {reg_id}")
            else:
                print("    ❌ No registrations found")
                return 0, 0
        else:
            print(f"    ❌ Failed to get registrations: {response.status_code}")
            return 0, 0
    except Exception as e:
        print(f"    ❌ Exception: {str(e)}")
        return 0, 0
    
    if not reg_id:
        print("    ❌ Cannot continue without valid registration ID")
        return 0, 0
    
    # Test 2.1: POST generate-jx-reminder with valid step_key
    print("\n[Test 2.1] POST generate-jx-reminder (step_key='documents')")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder",
            json={"step_key": "documents", "custom_instruction": ""},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") == True and
                data.get("subject") and len(data.get("subject", "")) > 0 and
                data.get("body_html") and len(data.get("body_html", "")) > 0 and
                data.get("step_key") == "documents" and
                "usage" in data and
                "llm_source" in data
            )
            if success:
                passed += 1
            log_test("POST generate-jx-reminder (documents)", success, 
                    f"Subject: {data.get('subject', '')[:50]}..., Body length: {len(data.get('body_html', ''))}, LLM: {data.get('llm_source')}")
        else:
            log_test("POST generate-jx-reminder (documents)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("POST generate-jx-reminder (documents)", False, f"Exception: {str(e)}")
    
    # Test 2.2: POST with invalid step_key → 400
    print("\n[Test 2.2] POST generate-jx-reminder (invalid step_key) → 400")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder",
            json={"step_key": "foo"},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'step_key' in error_msg.lower() and 'invalide' in error_msg.lower()
            if success:
                passed += 1
            log_test("POST generate-jx-reminder (invalid step_key) → 400", success, 
                    f"Error: {error_msg}")
        else:
            log_test("POST generate-jx-reminder (invalid step_key) → 400", False, 
                    f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("POST generate-jx-reminder (invalid step_key) → 400", False, 
                f"Exception: {str(e)}")
    
    # Test 2.3: POST without step_key → 400
    print("\n[Test 2.3] POST generate-jx-reminder (no step_key) → 400")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder",
            json={},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 400:
            error_msg = response.json().get('error', '')
            success = 'step_key' in error_msg.lower() and 'invalide' in error_msg.lower()
            if success:
                passed += 1
            log_test("POST generate-jx-reminder (no step_key) → 400", success, 
                    f"Error: {error_msg}")
        else:
            log_test("POST generate-jx-reminder (no step_key) → 400", False, 
                    f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("POST generate-jx-reminder (no step_key) → 400", False, 
                f"Exception: {str(e)}")
    
    # Test 2.4: POST with non-existent registration → 404
    print("\n[Test 2.4] POST generate-jx-reminder (non-existent reg) → 404")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/registrations/reg-xxx-fake/generate-jx-reminder",
            json={"step_key": "documents"},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 404:
            error_msg = response.json().get('error', '')
            success = 'introuvable' in error_msg.lower() or 'not found' in error_msg.lower()
            if success:
                passed += 1
            log_test("POST generate-jx-reminder (non-existent) → 404", success, 
                    f"Error: {error_msg}")
        else:
            log_test("POST generate-jx-reminder (non-existent) → 404", False, 
                    f"Expected 404, got {response.status_code}")
    except Exception as e:
        log_test("POST generate-jx-reminder (non-existent) → 404", False, 
                f"Exception: {str(e)}")
    
    # Test 2.5: Test all valid step_keys (profile, stand, animation, documents, caution, convention)
    print("\n[Test 2.5] POST generate-jx-reminder (all valid step_keys)")
    valid_step_keys = ["profile", "stand", "animation", "documents", "caution", "convention"]
    for step_key in valid_step_keys:
        total += 1
        try:
            response = requests.post(
                f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder",
                json={"step_key": step_key},
                headers=ADMIN_HEADERS
            )
            if response.status_code == 200:
                data = response.json()
                success = (
                    data.get("ok") == True and
                    data.get("subject") and
                    data.get("body_html") and
                    data.get("step_key") == step_key
                )
                if success:
                    passed += 1
                log_test(f"POST generate-jx-reminder (step_key={step_key})", success, 
                        f"Subject: {data.get('subject', '')[:40]}...")
            else:
                log_test(f"POST generate-jx-reminder (step_key={step_key})", False, 
                        f"Status: {response.status_code}")
        except Exception as e:
            log_test(f"POST generate-jx-reminder (step_key={step_key})", False, 
                    f"Exception: {str(e)}")
    
    # Test 2.6: Verify body_html contains appropriate placeholder
    print("\n[Test 2.6] Verify body_html contains MON_ESPACE_* placeholder")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder",
            json={"step_key": "documents"},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            body_html = data.get("body_html", "")
            # Check for any MON_ESPACE placeholder
            success = "[[MON_ESPACE" in body_html
            if success:
                passed += 1
            log_test("Body contains MON_ESPACE_* placeholder", success, 
                    f"Found placeholder: {success}")
        else:
            log_test("Body contains MON_ESPACE_* placeholder", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("Body contains MON_ESPACE_* placeholder", False, f"Exception: {str(e)}")
    
    # Test 2.7: Test with referent defined on venue
    print("\n[Test 2.7] Test with referent defined on venue")
    total += 1
    try:
        # First, set a referent on venue-faaa
        requests.post(
            f"{BASE_URL}/api/venues/venue-faaa/set-referent",
            json={
                "name": "Teva GEROS",
                "email": "contact@aracom-conseil.fr",
                "phone": "+(689) 87 210 444"
            },
            headers=ADMIN_HEADERS
        )
        
        # Find a registration with venue-faaa
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            registrations = response.json()
            faaa_reg = next((r for r in registrations if r.get('venue_id') == 'venue-faaa'), None)
            
            if faaa_reg:
                # Generate reminder for this registration
                response = requests.post(
                    f"{BASE_URL}/api/registrations/{faaa_reg['id']}/generate-jx-reminder",
                    json={"step_key": "documents"},
                    headers=ADMIN_HEADERS
                )
                if response.status_code == 200:
                    data = response.json()
                    body_html = data.get("body_html", "")
                    referent = data.get("referent", {})
                    # Check if referent info is in the response and body
                    success = (
                        referent.get("name") == "Teva GEROS" and
                        ("Teva GEROS" in body_html or "contact@aracom-conseil.fr" in body_html)
                    )
                    if success:
                        passed += 1
                    log_test("Referent info in body_html", success, 
                            f"Referent: {referent.get('name')}, Found in body: {success}")
                else:
                    log_test("Referent info in body_html", False, 
                            f"Status: {response.status_code}")
            else:
                log_test("Referent info in body_html", False, 
                        "No registration found for venue-faaa")
        else:
            log_test("Referent info in body_html", False, 
                    f"Failed to get registrations: {response.status_code}")
    except Exception as e:
        log_test("Referent info in body_html", False, f"Exception: {str(e)}")
    
    print(f"\n📊 AI EMAIL REMINDER J-X: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed, total


def test_non_regression():
    """Test 3: Non-régression rapide sur endpoints critiques"""
    print("\n" + "=" * 80)
    print("TEST 3: NON-RÉGRESSION — ENDPOINTS CRITIQUES")
    print("=" * 80)
    
    passed = 0
    total = 0
    
    # Test 3.1: POST /api/auth/login (admin)
    print("\n[Test 3.1] POST /api/auth/login (admin)")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@aracom.pf", "password": "demo"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            success = data.get("user") and data.get("user", {}).get("role_code") == "aracom_admin"
            if success:
                passed += 1
            log_test("POST /api/auth/login (admin)", success, 
                    f"User: {data.get('user', {}).get('email')}, Role: {data.get('user', {}).get('role_code')}")
        else:
            log_test("POST /api/auth/login (admin)", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/auth/login (admin)", False, f"Exception: {str(e)}")
    
    # Test 3.2: GET /api/dashboard/kpis
    print("\n[Test 3.2] GET /api/dashboard/kpis")
    total += 1
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("total", 0) > 0
            if success:
                passed += 1
            log_test("GET /api/dashboard/kpis", success, 
                    f"Total: {data.get('total')}, By status: {data.get('by_status')}")
        else:
            log_test("GET /api/dashboard/kpis", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/kpis", False, f"Exception: {str(e)}")
    
    # Test 3.3: GET /api/registrations
    print("\n[Test 3.3] GET /api/registrations")
    total += 1
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = isinstance(data, list) and len(data) > 0
            if success:
                passed += 1
            log_test("GET /api/registrations", success, f"Count: {len(data)}")
        else:
            log_test("GET /api/registrations", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/registrations", False, f"Exception: {str(e)}")
    
    # Test 3.4: POST /api/mailing/generate-ai
    print("\n[Test 3.4] POST /api/mailing/generate-ai")
    total += 1
    try:
        response = requests.post(
            f"{BASE_URL}/api/mailing/generate-ai",
            json={"mail_type": "relance_caution", "registration_ids": []},
            headers=ADMIN_HEADERS
        )
        if response.status_code == 200:
            data = response.json()
            success = data.get("subject") and data.get("body_html")
            if success:
                passed += 1
            log_test("POST /api/mailing/generate-ai", success, 
                    f"Subject: {data.get('subject', '')[:40]}...")
        else:
            log_test("POST /api/mailing/generate-ai", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("POST /api/mailing/generate-ai", False, f"Exception: {str(e)}")
    
    # Test 3.5: POST /api/mailing/send (TEST mode)
    print("\n[Test 3.5] POST /api/mailing/send (TEST mode)")
    total += 1
    try:
        # Get a valid registration ID
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            registrations = response.json()
            if registrations:
                reg_id = registrations[0]['id']
                response = requests.post(
                    f"{BASE_URL}/api/mailing/send",
                    json={
                        "subject": "Test",
                        "body_html": "<p>Test</p>",
                        "registration_ids": [reg_id],
                        "mail_type": "test"
                    },
                    headers=ADMIN_HEADERS
                )
                if response.status_code == 200:
                    data = response.json()
                    success = "sent" in data and data.get("sent", 0) >= 0
                    if success:
                        passed += 1
                    log_test("POST /api/mailing/send", success, 
                            f"Sent: {data.get('sent')}, Failed: {data.get('failed', 0)}")
                else:
                    log_test("POST /api/mailing/send", False, f"Status: {response.status_code}")
            else:
                log_test("POST /api/mailing/send", False, "No registrations found")
        else:
            log_test("POST /api/mailing/send", False, "Failed to get registrations")
    except Exception as e:
        log_test("POST /api/mailing/send", False, f"Exception: {str(e)}")
    
    # Test 3.6: GET /api/satisfaction/stats
    print("\n[Test 3.6] GET /api/satisfaction/stats")
    total += 1
    try:
        response = requests.get(f"{BASE_URL}/api/satisfaction/stats", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = "total_responses" in data and "avg_overall" in data
            if success:
                passed += 1
            log_test("GET /api/satisfaction/stats", success, 
                    f"Total responses: {data.get('total_responses')}, Avg: {data.get('avg_overall')}")
        else:
            log_test("GET /api/satisfaction/stats", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/satisfaction/stats", False, f"Exception: {str(e)}")
    
    # Test 3.7: GET /api/step-deadlines
    print("\n[Test 3.7] GET /api/step-deadlines")
    total += 1
    try:
        response = requests.get(f"{BASE_URL}/api/step-deadlines", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = "deadlines" in data
            if success:
                passed += 1
            log_test("GET /api/step-deadlines", success, 
                    f"Deadlines: {list(data.get('deadlines', {}).keys())}")
        else:
            log_test("GET /api/step-deadlines", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/step-deadlines", False, f"Exception: {str(e)}")
    
    print(f"\n📊 NON-RÉGRESSION: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    return passed, total


if __name__ == "__main__":
    print("=" * 80)
    print("🧪 BACKEND TESTING - SESSION 13 (LOTS 2/4 FINALISATION)")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all test suites
    referents_passed, referents_total = test_referents_par_site()
    ai_reminder_passed, ai_reminder_total = test_ai_email_reminder_jx()
    regression_passed, regression_total = test_non_regression()
    
    # Final summary
    total_passed = referents_passed + ai_reminder_passed + regression_passed
    total_tests = referents_total + ai_reminder_total + regression_total
    
    print("\n" + "=" * 80)
    print("📊 FINAL TEST SUMMARY")
    print("=" * 80)
    print(f"1. Référents par site:     {referents_passed}/{referents_total} passed")
    print(f"2. AI Email Reminder J-X:  {ai_reminder_passed}/{ai_reminder_total} passed")
    print(f"3. Non-régression:         {regression_passed}/{regression_total} passed")
    print("-" * 80)
    print(f"OVERALL:                   {total_passed}/{total_tests} tests passed ({(total_passed/total_tests)*100:.1f}%)")
    
    if total_passed == total_tests:
        print("\n🎉 ALL TESTS PASSED - Ready for frontend testing!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_tests - total_passed} tests failed - See details above")
        sys.exit(1)
