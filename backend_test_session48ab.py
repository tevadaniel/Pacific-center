#!/usr/bin/env python3
"""
SESSION 48ab — Test des nouveaux endpoints validation/refus + check de non-régression complet
Backend testing script for validation/refusal endpoints and full regression check
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exp-test",
    "Content-Type": "application/json"
}

# Test results
results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    results["total"] += 1
    if passed:
        results["passed"] += 1
        print(f"✅ PASS: {name}")
    else:
        results["failed"] += 1
        print(f"❌ FAIL: {name}")
    if details:
        print(f"   {details}")
    results["tests"].append({"name": name, "passed": passed, "details": details})

def test_validate_endpoint():
    """Test POST /api/admin/registrations/:id/validate"""
    print("\n" + "="*80)
    print("TEST GROUP 1: POST /api/admin/registrations/:id/validate")
    print("="*80)
    
    # Test 1.1: Validation directe avec admin
    try:
        reg_id = "reg-faaa-F-A03"
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/validate",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("status") == "confirme" and data.get("locked_at"):
                log_test(
                    "1.1 POST /api/admin/registrations/reg-faaa-F-A03/validate (admin)",
                    True,
                    f"Status: {response.status_code}, Response: {json.dumps(data, indent=2)}"
                )
                
                # Vérifier après validation
                verify_response = requests.get(
                    f"{BASE_URL}/registrations/{reg_id}",
                    headers=ADMIN_HEADERS,
                    timeout=30
                )
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    reg = verify_data.get("registration", verify_data)
                    if reg.get("status") == "confirme" and reg.get("locked_at") and reg.get("locked_by"):
                        log_test(
                            "1.1.1 Vérification GET /api/registrations/reg-faaa-F-A03 après validation",
                            True,
                            f"Status: confirme, locked_at: {reg.get('locked_at')}, locked_by: {reg.get('locked_by')}"
                        )
                    else:
                        log_test(
                            "1.1.1 Vérification GET /api/registrations/reg-faaa-F-A03 après validation",
                            False,
                            f"Status: {reg.get('status')}, locked_at: {reg.get('locked_at')}"
                        )
            else:
                log_test(
                    "1.1 POST /api/admin/registrations/reg-faaa-F-A03/validate (admin)",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:500]}"
                )
        else:
            log_test(
                "1.1 POST /api/admin/registrations/reg-faaa-F-A03/validate (admin)",
                False,
                f"Status: {response.status_code}, Response: {response.text[:500]}"
            )
    except Exception as e:
        log_test("1.1 POST /api/admin/registrations/reg-faaa-F-A03/validate (admin)", False, f"Exception: {str(e)}")
    
    # Test 1.2: Vérifier venues/availability après validation
    try:
        response = requests.get(
            f"{BASE_URL}/venues/availability",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            faaa_venue = next((v for v in data if v.get("venue_id") == "venue-faaa"), None)
            if faaa_venue:
                validated = faaa_venue.get("validated", 0)
                pre_reserved = faaa_venue.get("pre_reserved", 0)
                log_test(
                    "1.2 GET /api/venues/availability après validation (Faaa)",
                    True,
                    f"Faaa: validated={validated}, pre_reserved={pre_reserved}, is_full={faaa_venue.get('is_full')}"
                )
            else:
                log_test("1.2 GET /api/venues/availability après validation (Faaa)", False, "Faaa venue not found")
        else:
            log_test(
                "1.2 GET /api/venues/availability après validation (Faaa)",
                False,
                f"Status: {response.status_code}"
            )
    except Exception as e:
        log_test("1.2 GET /api/venues/availability après validation (Faaa)", False, f"Exception: {str(e)}")

def test_permission_checks():
    """Test permission checks for validation/refusal endpoints"""
    print("\n" + "="*80)
    print("TEST GROUP 2: Permission Checks")
    print("="*80)
    
    # Test 2.1: Validation sans rôle admin → 403
    try:
        reg_id = "reg-faaa-F-A04"
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/validate",
            headers=EXPOSANT_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 403:
            log_test(
                "2.1 POST /api/admin/registrations/reg-faaa-F-A04/validate sans admin → 403",
                True,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
        else:
            log_test(
                "2.1 POST /api/admin/registrations/reg-faaa-F-A04/validate sans admin → 403",
                False,
                f"Expected 403, got {response.status_code}"
            )
    except Exception as e:
        log_test("2.1 POST /api/admin/registrations/reg-faaa-F-A04/validate sans admin → 403", False, f"Exception: {str(e)}")
    
    # Test 2.2: Refus sans rôle admin → 403
    try:
        reg_id = "reg-faaa-F-A04"
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/refuse",
            headers=EXPOSANT_HEADERS,
            json={"reason": "Test refus"},
            timeout=30
        )
        
        if response.status_code == 403:
            log_test(
                "2.2 POST /api/admin/registrations/reg-faaa-F-A04/refuse sans admin → 403",
                True,
                f"Status: {response.status_code}"
            )
        else:
            log_test(
                "2.2 POST /api/admin/registrations/reg-faaa-F-A04/refuse sans admin → 403",
                False,
                f"Expected 403, got {response.status_code}"
            )
    except Exception as e:
        log_test("2.2 POST /api/admin/registrations/reg-faaa-F-A04/refuse sans admin → 403", False, f"Exception: {str(e)}")

def test_404_checks():
    """Test 404 checks for non-existent registrations"""
    print("\n" + "="*80)
    print("TEST GROUP 3: 404 Checks")
    print("="*80)
    
    # Test 3.1: Validation ID inexistant → 404
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/non-existent-id/validate",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 404:
            log_test(
                "3.1 POST /api/admin/registrations/non-existent-id/validate → 404",
                True,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
        else:
            log_test(
                "3.1 POST /api/admin/registrations/non-existent-id/validate → 404",
                False,
                f"Expected 404, got {response.status_code}"
            )
    except Exception as e:
        log_test("3.1 POST /api/admin/registrations/non-existent-id/validate → 404", False, f"Exception: {str(e)}")
    
    # Test 3.2: Refus ID inexistant → 404
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/non-existent-id/refuse",
            headers=ADMIN_HEADERS,
            json={"reason": "Test"},
            timeout=30
        )
        
        if response.status_code == 404:
            log_test(
                "3.2 POST /api/admin/registrations/non-existent-id/refuse → 404",
                True,
                f"Status: {response.status_code}"
            )
        else:
            log_test(
                "3.2 POST /api/admin/registrations/non-existent-id/refuse → 404",
                False,
                f"Expected 404, got {response.status_code}"
            )
    except Exception as e:
        log_test("3.2 POST /api/admin/registrations/non-existent-id/refuse → 404", False, f"Exception: {str(e)}")

def test_refuse_endpoint():
    """Test POST /api/admin/registrations/:id/refuse"""
    print("\n" + "="*80)
    print("TEST GROUP 4: POST /api/admin/registrations/:id/refuse")
    print("="*80)
    
    # Test 4.1: Refus direct avec admin
    try:
        reg_id = "reg-faaa-F-A04"
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/refuse",
            headers=ADMIN_HEADERS,
            json={"reason": "Test refus"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("status") == "refuse":
                log_test(
                    "4.1 POST /api/admin/registrations/reg-faaa-F-A04/refuse (admin)",
                    True,
                    f"Status: {response.status_code}, Response: {json.dumps(data, indent=2)}"
                )
                
                # Vérifier après refus
                verify_response = requests.get(
                    f"{BASE_URL}/registrations/{reg_id}",
                    headers=ADMIN_HEADERS,
                    timeout=30
                )
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    reg = verify_data.get("registration", verify_data)
                    if reg.get("status") == "refuse" and reg.get("refused_at") and reg.get("refused_reason"):
                        log_test(
                            "4.1.1 Vérification GET /api/registrations/reg-faaa-F-A04 après refus",
                            True,
                            f"Status: refuse, refused_at: {reg.get('refused_at')}, reason: {reg.get('refused_reason')}"
                        )
                    else:
                        log_test(
                            "4.1.1 Vérification GET /api/registrations/reg-faaa-F-A04 après refus",
                            False,
                            f"Status: {reg.get('status')}, refused_at: {reg.get('refused_at')}"
                        )
            else:
                log_test(
                    "4.1 POST /api/admin/registrations/reg-faaa-F-A04/refuse (admin)",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:500]}"
                )
        else:
            log_test(
                "4.1 POST /api/admin/registrations/reg-faaa-F-A04/refuse (admin)",
                False,
                f"Status: {response.status_code}, Response: {response.text[:500]}"
            )
    except Exception as e:
        log_test("4.1 POST /api/admin/registrations/reg-faaa-F-A04/refuse (admin)", False, f"Exception: {str(e)}")

def test_send_confirmation():
    """Test POST /api/admin/registrations/:id/send-confirmation"""
    print("\n" + "="*80)
    print("TEST GROUP 5: POST /api/admin/registrations/:id/send-confirmation")
    print("="*80)
    
    # Test 5.1: Envoi confirmation avec admin
    try:
        reg_id = "reg-faaa-F-A05"
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_id}/send-confirmation",
            headers=ADMIN_HEADERS,
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("recipient") and data.get("sent_at"):
                log_test(
                    "5.1 POST /api/admin/registrations/reg-faaa-F-A05/send-confirmation (admin)",
                    True,
                    f"Status: {response.status_code}, Recipient: {data.get('recipient')}, Sent at: {data.get('sent_at')} (SMTP TEST mode: redirect to tevageros@me.com)"
                )
            else:
                log_test(
                    "5.1 POST /api/admin/registrations/reg-faaa-F-A05/send-confirmation (admin)",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:500]}"
                )
        else:
            log_test(
                "5.1 POST /api/admin/registrations/reg-faaa-F-A05/send-confirmation (admin)",
                False,
                f"Status: {response.status_code}, Response: {response.text[:500]}"
            )
    except Exception as e:
        log_test("5.1 POST /api/admin/registrations/reg-faaa-F-A05/send-confirmation (admin)", False, f"Exception: {str(e)}")

def test_venues_availability():
    """Test GET /api/venues/availability for consistency"""
    print("\n" + "="*80)
    print("TEST GROUP 6: GET /api/venues/availability (cohérence)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/venues/availability",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) == 4:
                log_test(
                    "6.1 GET /api/venues/availability structure",
                    True,
                    f"Status: {response.status_code}, Venues count: {len(data)}"
                )
                
                # Vérifier Faaa
                faaa = next((v for v in data if v.get("venue_id") == "venue-faaa"), None)
                if faaa:
                    validated = faaa.get("validated", 0)
                    pre_reserved = faaa.get("pre_reserved", 0)
                    total_reserved = faaa.get("total_reserved", 0)
                    is_full = faaa.get("is_full", False)
                    
                    log_test(
                        "6.2 Faaa venue availability",
                        True,
                        f"Faaa: validated={validated}, pre_reserved={pre_reserved}, total_reserved={total_reserved}, is_full={is_full}"
                    )
                else:
                    log_test("6.2 Faaa venue availability", False, "Faaa venue not found")
            else:
                log_test(
                    "6.1 GET /api/venues/availability structure",
                    False,
                    f"Expected 4 venues, got {len(data) if isinstance(data, list) else 'not a list'}"
                )
        else:
            log_test(
                "6.1 GET /api/venues/availability structure",
                False,
                f"Status: {response.status_code}"
            )
    except Exception as e:
        log_test("6.1 GET /api/venues/availability structure", False, f"Exception: {str(e)}")

def test_non_regression():
    """Test non-regression on critical endpoints"""
    print("\n" + "="*80)
    print("TEST GROUP 7: Non-Regression Checks (P1)")
    print("="*80)
    
    endpoints = [
        ("GET /api/menu-badges", f"{BASE_URL}/menu-badges", "GET", None),
        ("GET /api/dashboard/kpis", f"{BASE_URL}/dashboard/kpis", "GET", None),
        ("GET /api/venues?only_active=1", f"{BASE_URL}/venues?only_active=1", "GET", None),
        ("GET /api/venues/availability", f"{BASE_URL}/venues/availability", "GET", None),
        ("GET /api/validation-requests", f"{BASE_URL}/validation-requests", "GET", None),
        ("GET /api/registrations", f"{BASE_URL}/registrations", "GET", None),
        ("GET /api/admin/validation-queue", f"{BASE_URL}/admin/validation-queue", "GET", None),
        ("GET /api/prospects", f"{BASE_URL}/prospects", "GET", None),
        ("GET /api/prospects/stats", f"{BASE_URL}/prospects/stats", "GET", None),
    ]
    
    for name, url, method, body in endpoints:
        try:
            if method == "GET":
                response = requests.get(url, headers=ADMIN_HEADERS, timeout=30)
            else:
                response = requests.post(url, headers=ADMIN_HEADERS, json=body or {}, timeout=30)
            
            if response.status_code == 200:
                log_test(f"7.x {name}", True, f"Status: {response.status_code}")
            else:
                log_test(f"7.x {name}", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
        except Exception as e:
            log_test(f"7.x {name}", False, f"Exception: {str(e)}")

def test_auth_endpoints():
    """Test authentication endpoints"""
    print("\n" + "="*80)
    print("TEST GROUP 8: Authentication Endpoints")
    print("="*80)
    
    # Test 8.1: Admin login
    try:
        response = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("user", {}).get("role_code") == "aracom_admin":
                log_test(
                    "8.1 POST /api/auth/password-login (admin@aracom.pf / Projetaracom12)",
                    True,
                    f"Status: {response.status_code}, Role: {data.get('user', {}).get('role_code')}"
                )
            else:
                log_test(
                    "8.1 POST /api/auth/password-login (admin@aracom.pf / Projetaracom12)",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:500]}"
                )
        else:
            log_test(
                "8.1 POST /api/auth/password-login (admin@aracom.pf / Projetaracom12)",
                False,
                f"Status: {response.status_code}, Response: {response.text[:500]}"
            )
    except Exception as e:
        log_test("8.1 POST /api/auth/password-login (admin@aracom.pf / Projetaracom12)", False, f"Exception: {str(e)}")
    
    # Test 8.2: GET /api/auth/me
    try:
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("user"):
                log_test(
                    "8.2 GET /api/auth/me (avec admin headers)",
                    True,
                    f"Status: {response.status_code}, User ID: {data.get('user', {}).get('id')}"
                )
            else:
                log_test(
                    "8.2 GET /api/auth/me (avec admin headers)",
                    False,
                    f"Status: {response.status_code}, Response: {response.text[:500]}"
                )
        else:
            log_test(
                "8.2 GET /api/auth/me (avec admin headers)",
                False,
                f"Status: {response.status_code}"
            )
    except Exception as e:
        log_test("8.2 GET /api/auth/me (avec admin headers)", False, f"Exception: {str(e)}")

def test_exposant_briefing():
    """Test exposant briefing endpoint"""
    print("\n" + "="*80)
    print("TEST GROUP 9: Exposant Briefing")
    print("="*80)
    
    # Test 9.1: GET /api/exposant/briefing
    try:
        # Use a valid exposant user_id from registrations
        exposant_headers = {
            "x-user-role": "exposant",
            "x-user-id": "u-exp-org-3",  # I Mua Papeete
            "Content-Type": "application/json"
        }
        response = requests.get(
            f"{BASE_URL}/exposant/briefing",
            headers=exposant_headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test(
                "9.1 GET /api/exposant/briefing (avec x-user-role: exposant)",
                True,
                f"Status: {response.status_code}"
            )
        else:
            log_test(
                "9.1 GET /api/exposant/briefing (avec x-user-role: exposant)",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
    except Exception as e:
        log_test("9.1 GET /api/exposant/briefing (avec x-user-role: exposant)", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {results['total']}")
    print(f"Passed: {results['passed']} ({results['passed']/results['total']*100:.1f}%)")
    print(f"Failed: {results['failed']} ({results['failed']/results['total']*100:.1f}%)")
    print("="*80)
    
    if results['failed'] > 0:
        print("\nFailed tests:")
        for test in results['tests']:
            if not test['passed']:
                print(f"  ❌ {test['name']}")
                if test['details']:
                    print(f"     {test['details']}")

def main():
    """Main test execution"""
    print("="*80)
    print("SESSION 48ab — Backend Testing")
    print("Test des nouveaux endpoints validation/refus + check de non-régression complet")
    print("="*80)
    print(f"BASE_URL: {BASE_URL}")
    print(f"Admin credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    # Run all test groups
    test_validate_endpoint()
    test_permission_checks()
    test_404_checks()
    test_refuse_endpoint()
    test_send_confirmation()
    test_venues_availability()
    test_non_regression()
    test_auth_endpoints()
    test_exposant_briefing()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)

if __name__ == "__main__":
    main()
