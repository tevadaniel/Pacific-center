#!/usr/bin/env python3
"""
Backend test for NEW password-login endpoint (POST /api/auth/password-login)
Tests all 9 scenarios as specified in the review request.
"""

import requests
import os
import sys

# Read base URL from .env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

print(f"🧪 Testing password-login endpoint at: {API_BASE}")
print("=" * 80)

# Test results tracking
results = []

def test_scenario(name, method, endpoint, payload=None, expected_status=200, checks=None):
    """Run a test scenario and validate response"""
    print(f"\n📋 TEST: {name}")
    print(f"   → {method} {endpoint}")
    if payload:
        print(f"   → Payload: {payload}")
    
    try:
        if method == 'POST':
            resp = requests.post(f"{API_BASE}/{endpoint}", json=payload, timeout=10)
        else:
            resp = requests.get(f"{API_BASE}/{endpoint}", timeout=10)
        
        print(f"   ✓ Status: {resp.status_code} (expected: {expected_status})")
        
        # Check status code
        if resp.status_code != expected_status:
            print(f"   ❌ FAIL: Expected status {expected_status}, got {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            results.append({'test': name, 'status': 'FAIL', 'reason': f'Status {resp.status_code} != {expected_status}'})
            return False
        
        # Parse JSON
        try:
            data = resp.json()
        except:
            print(f"   ❌ FAIL: Response is not valid JSON")
            print(f"   Response: {resp.text[:500]}")
            results.append({'test': name, 'status': 'FAIL', 'reason': 'Invalid JSON response'})
            return False
        
        # Run custom checks
        if checks:
            for check_name, check_fn in checks.items():
                try:
                    result = check_fn(data)
                    if result:
                        print(f"   ✓ {check_name}: PASS")
                    else:
                        print(f"   ❌ {check_name}: FAIL")
                        print(f"   Response data: {data}")
                        results.append({'test': name, 'status': 'FAIL', 'reason': f'Check failed: {check_name}'})
                        return False
                except Exception as e:
                    print(f"   ❌ {check_name}: ERROR - {e}")
                    print(f"   Response data: {data}")
                    results.append({'test': name, 'status': 'FAIL', 'reason': f'Check error: {check_name} - {e}'})
                    return False
        
        print(f"   ✅ PASS")
        results.append({'test': name, 'status': 'PASS'})
        return True
        
    except Exception as e:
        print(f"   ❌ FAIL: Exception - {e}")
        results.append({'test': name, 'status': 'FAIL', 'reason': str(e)})
        return False


# ============================================================================
# TEST SCENARIOS
# ============================================================================

print("\n" + "=" * 80)
print("🎯 SCENARIO 1: Admin login OK (admin@aracom.pf / Projetaracom12)")
print("=" * 80)
test_scenario(
    "1. Admin login OK",
    "POST",
    "auth/password-login",
    {"email": "admin@aracom.pf", "password": "Projetaracom12"},
    200,
    {
        "ok is true": lambda d: d.get('ok') == True,
        "user.role_code is aracom_admin": lambda d: d.get('user', {}).get('role_code') == 'aracom_admin',
        "redirect is /aracom": lambda d: d.get('redirect') == '/aracom',
        "method is admin_password": lambda d: d.get('method') == 'admin_password',
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 2: Admin wrong password")
print("=" * 80)
test_scenario(
    "2. Admin wrong password",
    "POST",
    "auth/password-login",
    {"email": "admin@aracom.pf", "password": "wrong-password"},
    401,
    {
        "ok is false": lambda d: d.get('ok') == False,
        "error mentions incorrect": lambda d: 'incorrect' in d.get('error', '').lower(),
        "fallback_magic_link is false": lambda d: d.get('fallback_magic_link') == False,
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 3: Admin alternative email (teva.geros@aracom-conseil.fr)")
print("=" * 80)
test_scenario(
    "3. Admin alternative email",
    "POST",
    "auth/password-login",
    {"email": "teva.geros@aracom-conseil.fr", "password": "Projetaracom12"},
    200,
    {
        "ok is true": lambda d: d.get('ok') == True,
        "user.role_code is aracom_admin": lambda d: d.get('user', {}).get('role_code') == 'aracom_admin',
        "redirect is /aracom": lambda d: d.get('redirect') == '/aracom',
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 4: Pacific Centers refused (even with correct password)")
print("=" * 80)
test_scenario(
    "4. Pacific Centers refused",
    "POST",
    "auth/password-login",
    {"email": "pacific@centers.pf", "password": "Projetaracom12"},
    403,
    {
        "ok is false": lambda d: d.get('ok') == False,
        "requires_magic_link is true": lambda d: d.get('requires_magic_link') == True,
        "fallback_magic_link is true": lambda d: d.get('fallback_magic_link') == True,
        "error mentions magic link": lambda d: 'lien' in d.get('error', '').lower() or 'magic' in d.get('error', '').lower(),
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 5: Exposant with no password configured")
print("=" * 80)
# First, get a real exposant email from registrations
print("   → Fetching exposant email from registrations...")
try:
    resp = requests.get(f"{API_BASE}/registrations", timeout=10)
    if resp.status_code == 200:
        regs = resp.json()
        exposant_email = None
        for reg in regs[:10]:  # Check first 10
            if reg.get('organization', {}).get('main_email'):
                exposant_email = reg['organization']['main_email']
                print(f"   → Found exposant email: {exposant_email}")
                break
        
        if exposant_email:
            test_scenario(
                "5. Exposant no password",
                "POST",
                "auth/password-login",
                {"email": exposant_email, "password": "anything"},
                404,
                {
                    "ok is false": lambda d: d.get('ok') == False,
                    "no_password_set is true": lambda d: d.get('no_password_set') == True,
                    "fallback_magic_link is true": lambda d: d.get('fallback_magic_link') == True,
                }
            )
        else:
            print("   ⚠️ SKIP: No exposant email found in registrations")
            results.append({'test': '5. Exposant no password', 'status': 'SKIP', 'reason': 'No exposant email found'})
    else:
        print(f"   ⚠️ SKIP: Could not fetch registrations (status {resp.status_code})")
        results.append({'test': '5. Exposant no password', 'status': 'SKIP', 'reason': 'Could not fetch registrations'})
except Exception as e:
    print(f"   ⚠️ SKIP: Error fetching registrations - {e}")
    results.append({'test': '5. Exposant no password', 'status': 'SKIP', 'reason': str(e)})

print("\n" + "=" * 80)
print("🎯 SCENARIO 6: Unknown email")
print("=" * 80)
test_scenario(
    "6. Unknown email",
    "POST",
    "auth/password-login",
    {"email": "ghost-no-account-12345@example.com", "password": "anything"},
    401,
    {
        "ok is false": lambda d: d.get('ok') == False,
        "error is generic": lambda d: d.get('error') == 'Identifiants invalides',
        "no leak of existence": lambda d: 'no_password_set' not in d and 'requires_magic_link' not in d,
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 7: Invalid email format")
print("=" * 80)
test_scenario(
    "7. Invalid email format",
    "POST",
    "auth/password-login",
    {"email": "not-an-email", "password": "pwd"},
    400,
    {
        "error mentions invalid email": lambda d: 'email' in d.get('error', '').lower() and 'invalide' in d.get('error', '').lower(),
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 8: Missing password")
print("=" * 80)
test_scenario(
    "8. Missing password",
    "POST",
    "auth/password-login",
    {"email": "admin@aracom.pf", "password": ""},
    400,
    {
        "error mentions password required": lambda d: 'mot de passe' in d.get('error', '').lower() and 'requis' in d.get('error', '').lower(),
    }
)

print("\n" + "=" * 80)
print("🎯 SCENARIO 9: Magic link non-regression (still works)")
print("=" * 80)
test_scenario(
    "9. Magic link non-regression",
    "POST",
    "auth/request-magic-link",
    {"email": "admin@aracom.pf"},
    200,
    {
        "ok is true": lambda d: d.get('ok') == True,
        "sent is true": lambda d: d.get('sent') == True,
        "role is aracom_admin": lambda d: d.get('role') == 'aracom_admin',
    }
)

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "=" * 80)
print("📊 TEST SUMMARY")
print("=" * 80)

passed = sum(1 for r in results if r['status'] == 'PASS')
failed = sum(1 for r in results if r['status'] == 'FAIL')
skipped = sum(1 for r in results if r['status'] == 'SKIP')
total = len(results)

print(f"\n✅ PASSED: {passed}/{total}")
print(f"❌ FAILED: {failed}/{total}")
print(f"⚠️ SKIPPED: {skipped}/{total}")

print("\nDetailed results:")
for r in results:
    status_icon = "✅" if r['status'] == 'PASS' else "❌" if r['status'] == 'FAIL' else "⚠️"
    print(f"  {status_icon} {r['test']}: {r['status']}")
    if 'reason' in r:
        print(f"     → {r['reason']}")

print("\n" + "=" * 80)

# Exit with appropriate code
if failed > 0:
    print("❌ TESTS FAILED")
    sys.exit(1)
else:
    print("✅ ALL TESTS PASSED")
    sys.exit(0)
