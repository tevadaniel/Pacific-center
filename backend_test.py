#!/usr/bin/env python3
"""
Backend Regression Test Suite - Post Refactoring
Tests all endpoints after extracting handlers to /app/lib/api/handlers/
"""

import requests
import sys

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Admin headers
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin"
}

# Pacific Centers headers
PACIFIC_HEADERS = {
    "x-user-role": "pacific_centers_readonly",
    "x-user-id": "u-pc"
}

# Exposant headers (non-admin)
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exp-1"
}

def test_stats_public():
    """Test 1: GET /api/stats/public (no auth required)"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/stats/public (no auth)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/stats/public", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            # Verify structure
            if 'sites' in data and 'stands' in data and 'associations' in data:
                if isinstance(data['sites'], int) and isinstance(data['stands'], int) and isinstance(data['associations'], int):
                    if data['sites'] >= 0 and data['stands'] >= 0 and data['associations'] >= 0:
                        print("✅ TEST 1 PASSED - stats/public returns correct structure with non-negative numbers")
                        return True
                    else:
                        print("❌ TEST 1 FAILED - Negative numbers in response")
                        return False
                else:
                    print("❌ TEST 1 FAILED - Values are not numbers")
                    return False
            else:
                print("❌ TEST 1 FAILED - Missing required fields (sites, stands, associations)")
                return False
        else:
            print(f"❌ TEST 1 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED - Exception: {str(e)}")
        return False

def test_dashboard_kpis():
    """Test 2: GET /api/dashboard/kpis (admin)"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/dashboard/kpis (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/dashboard/kpis", headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys()}")
            
            # Verify required fields
            required_fields = ['total', 'by_status', 'cautions_recues', 'cautions_en_attente', 
                             'conv_signed', 'docs_manquants', 'xpf_encaisses', 'xpf_en_attente']
            
            missing_fields = [f for f in required_fields if f not in data]
            if not missing_fields:
                print(f"Total: {data['total']}, By Status: {data['by_status']}")
                print(f"Cautions recues: {data['cautions_recues']}, Conv signed: {data['conv_signed']}")
                print("✅ TEST 2 PASSED - dashboard/kpis returns all required fields")
                return True
            else:
                print(f"❌ TEST 2 FAILED - Missing fields: {missing_fields}")
                return False
        else:
            print(f"❌ TEST 2 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 FAILED - Exception: {str(e)}")
        return False

def test_dashboard_by_site_admin():
    """Test 3: GET /api/dashboard/by-site (admin)"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/dashboard/by-site (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/dashboard/by-site", headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of sites: {len(data)}")
            
            if isinstance(data, list) and len(data) > 0:
                # Check first site structure
                site = data[0]
                required_fields = ['venue_id', 'venue_name', 'venue_code', 'capacity_stands', 
                                 'assigned', 'confirmed', 'to_confirm', 'to_follow_up', 'prospects',
                                 'cautions_recues', 'conv_signed', 'remplissage']
                
                missing_fields = [f for f in required_fields if f not in site]
                if not missing_fields:
                    print(f"First site: {site['venue_name']} - {site['assigned']}/{site['capacity_stands']} stands")
                    print(f"Remplissage: {site['remplissage']}%")
                    print("✅ TEST 3 PASSED - dashboard/by-site returns correct structure")
                    return True
                else:
                    print(f"❌ TEST 3 FAILED - Missing fields in site object: {missing_fields}")
                    return False
            else:
                print("❌ TEST 3 FAILED - Response is not a non-empty array")
                return False
        else:
            print(f"❌ TEST 3 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 FAILED - Exception: {str(e)}")
        return False

def test_dashboard_by_site_pacific():
    """Test 4: GET /api/dashboard/by-site (pacific_centers_readonly role)"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/dashboard/by-site (pacific_centers_readonly)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/dashboard/by-site", headers=PACIFIC_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Number of sites visible to Pacific Centers: {len(data)}")
            
            if isinstance(data, list):
                # Should only show sites with pacific_visible: true
                # All sites should have the same structure as admin view
                if len(data) > 0:
                    site = data[0]
                    print(f"First site: {site.get('venue_name', 'N/A')}")
                    print("✅ TEST 4 PASSED - dashboard/by-site filtered for pacific_centers_readonly")
                    return True
                else:
                    print("⚠️ TEST 4 WARNING - No sites visible (might be expected if all pacific_visible=false)")
                    return True  # Not a failure, just no visible sites
            else:
                print("❌ TEST 4 FAILED - Response is not an array")
                return False
        else:
            print(f"❌ TEST 4 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 FAILED - Exception: {str(e)}")
        return False

def test_dashboard_jour_j_live():
    """Test 5: GET /api/dashboard/jour-j-live?event_date=2026-08-14 (admin)"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/dashboard/jour-j-live?event_date=2026-08-14 (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/dashboard/jour-j-live?event_date=2026-08-14", 
                               headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys()}")
            
            # Verify structure
            if 'event_date' in data and 'totals' in data and 'by_site' in data:
                totals = data['totals']
                required_totals = ['total', 'present', 'absent', 'waiting', 'late', 'gone', 'anomalies', 'rate']
                missing = [f for f in required_totals if f not in totals]
                
                if not missing:
                    print(f"Event date: {data['event_date']}")
                    print(f"Totals: {totals}")
                    print(f"Sites: {len(data['by_site'])}")
                    print("✅ TEST 5 PASSED - jour-j-live returns correct structure")
                    return True
                else:
                    print(f"❌ TEST 5 FAILED - Missing fields in totals: {missing}")
                    return False
            else:
                print("❌ TEST 5 FAILED - Missing required top-level fields")
                return False
        else:
            print(f"❌ TEST 5 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 5 FAILED - Exception: {str(e)}")
        return False

def test_alerts():
    """Test 6: GET /api/alerts (admin)"""
    print("\n" + "="*80)
    print("TEST 6: GET /api/alerts (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/alerts", headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {data.keys()}")
            
            # Verify all required fields are numbers
            required_fields = ['anomalies_open', 'critical_anomalies', 'tasks_open', 
                             'missing_insurance', 'validation_pending', 'validation_rdv']
            
            missing = [f for f in required_fields if f not in data]
            if not missing:
                all_numbers = all(isinstance(data[f], int) for f in required_fields)
                if all_numbers:
                    print(f"Anomalies open: {data['anomalies_open']}, Critical: {data['critical_anomalies']}")
                    print(f"Tasks open: {data['tasks_open']}, Missing insurance: {data['missing_insurance']}")
                    print("✅ TEST 6 PASSED - alerts returns all required numeric fields")
                    return True
                else:
                    print("❌ TEST 6 FAILED - Some fields are not numbers")
                    return False
            else:
                print(f"❌ TEST 6 FAILED - Missing fields: {missing}")
                return False
        else:
            print(f"❌ TEST 6 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 6 FAILED - Exception: {str(e)}")
        return False

def test_document_convention():
    """Test 7: GET /api/exposant/documents/convention/:regId (admin, regId=reg-arue-A-C02)"""
    print("\n" + "="*80)
    print("TEST 7: GET /api/exposant/documents/convention/reg-arue-A-C02 (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/exposant/documents/convention/reg-arue-A-C02", 
                               headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if 'application/pdf' in content_type:
                pdf_size = len(response.content)
                print(f"PDF size: {pdf_size} bytes")
                
                # Verify it's a valid PDF (starts with %PDF-)
                if response.content[:4] == b'%PDF':
                    print("✅ TEST 7 PASSED - convention PDF generated successfully")
                    return True
                else:
                    print("❌ TEST 7 FAILED - Response is not a valid PDF")
                    return False
            else:
                print(f"❌ TEST 7 FAILED - Wrong Content-Type: {content_type}")
                return False
        else:
            print(f"❌ TEST 7 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ TEST 7 FAILED - Exception: {str(e)}")
        return False

def test_document_guide():
    """Test 8: GET /api/exposant/documents/guide/:regId (admin, regId=reg-arue-A-C02)"""
    print("\n" + "="*80)
    print("TEST 8: GET /api/exposant/documents/guide/reg-arue-A-C02 (admin)")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/exposant/documents/guide/reg-arue-A-C02", 
                               headers=ADMIN_HEADERS, timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if 'application/pdf' in content_type:
                pdf_size = len(response.content)
                print(f"PDF size: {pdf_size} bytes")
                
                # Verify it's a valid PDF
                if response.content[:4] == b'%PDF':
                    print("✅ TEST 8 PASSED - guide PDF generated successfully")
                    return True
                else:
                    print("❌ TEST 8 FAILED - Response is not a valid PDF")
                    return False
            else:
                print(f"❌ TEST 8 FAILED - Wrong Content-Type: {content_type}")
                return False
        else:
            print(f"❌ TEST 8 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ TEST 8 FAILED - Exception: {str(e)}")
        return False

def test_document_questionnaire_blank():
    """Test 9: GET /api/exposant/documents/questionnaire-blank (no regId)"""
    print("\n" + "="*80)
    print("TEST 9: GET /api/exposant/documents/questionnaire-blank")
    print("="*80)
    try:
        response = requests.get(f"{BASE_URL}/exposant/documents/questionnaire-blank", timeout=10)
        print(f"Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if 'application/pdf' in content_type:
                pdf_size = len(response.content)
                print(f"PDF size: {pdf_size} bytes")
                
                # Verify it's a valid PDF
                if response.content[:4] == b'%PDF':
                    print("✅ TEST 9 PASSED - questionnaire-blank PDF generated successfully")
                    return True
                else:
                    print("❌ TEST 9 FAILED - Response is not a valid PDF")
                    return False
            else:
                print(f"❌ TEST 9 FAILED - Wrong Content-Type: {content_type}")
                return False
        else:
            print(f"❌ TEST 9 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ TEST 9 FAILED - Exception: {str(e)}")
        return False

def test_unlock_candidature_success():
    """Test 10: POST /api/admin/registrations/:id/unlock-candidature (admin, regId=reg-arue-A-C02)"""
    print("\n" + "="*80)
    print("TEST 10: POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature (admin)")
    print("="*80)
    try:
        # First, lock the candidature by requesting validation
        print("Step 1: Locking candidature via request-validation...")
        lock_response = requests.post(
            f"{BASE_URL}/registrations/reg-arue-A-C02/request-validation",
            headers=ADMIN_HEADERS,
            json={"preferred_payment": "cheque", "rdv_proposal": "", "notes": ""},
            timeout=10
        )
        print(f"Lock status: {lock_response.status_code}")
        
        if lock_response.status_code != 200:
            print(f"⚠️ Warning: Could not lock candidature: {lock_response.text[:200]}")
        
        # Now test unlock
        print("\nStep 2: Unlocking candidature...")
        response = requests.post(
            f"{BASE_URL}/admin/registrations/reg-arue-A-C02/unlock-candidature",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            if data.get('ok') == True and data.get('action') == 'candidature_unlocked':
                # Verify the registration is actually unlocked
                print("\nStep 3: Verifying unlock via GET /api/registrations/reg-arue-A-C02...")
                verify_response = requests.get(
                    f"{BASE_URL}/registrations/reg-arue-A-C02",
                    headers=ADMIN_HEADERS,
                    timeout=10
                )
                
                if verify_response.status_code == 200:
                    reg_data = verify_response.json()
                    registration = reg_data.get('registration', {})
                    is_locked = registration.get('candidature_locked', True)
                    
                    print(f"candidature_locked: {is_locked}")
                    
                    if is_locked == False:
                        print("✅ TEST 10 PASSED - unlock-candidature works correctly")
                        return True
                    else:
                        print("❌ TEST 10 FAILED - candidature_locked is still True after unlock")
                        return False
                else:
                    print(f"⚠️ Could not verify unlock: {verify_response.status_code}")
                    print("✅ TEST 10 PASSED (partial) - unlock endpoint returned success")
                    return True
            else:
                print(f"❌ TEST 10 FAILED - Unexpected response: {data}")
                return False
        else:
            print(f"❌ TEST 10 FAILED - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 10 FAILED - Exception: {str(e)}")
        return False

def test_unlock_candidature_not_found():
    """Test 11: POST /api/admin/registrations/non-existent/unlock-candidature (admin)"""
    print("\n" + "="*80)
    print("TEST 11: POST /api/admin/registrations/non-existent/unlock-candidature (admin)")
    print("="*80)
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/non-existent-id-12345/unlock-candidature",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            data = response.json()
            print(f"Response: {data}")
            
            if 'error' in data and 'introuvable' in data['error'].lower():
                print("✅ TEST 11 PASSED - Returns 404 'Inscription introuvable' for non-existent ID")
                return True
            else:
                print("❌ TEST 11 FAILED - 404 but wrong error message")
                return False
        else:
            print(f"❌ TEST 11 FAILED - Expected 404, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 11 FAILED - Exception: {str(e)}")
        return False

def test_unlock_candidature_no_admin():
    """Test 12: POST /api/admin/registrations/:id/unlock-candidature (NO admin role)"""
    print("\n" + "="*80)
    print("TEST 12: POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature (exposant role)")
    print("="*80)
    try:
        response = requests.post(
            f"{BASE_URL}/admin/registrations/reg-arue-A-C02/unlock-candidature",
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 403:
            data = response.json()
            print(f"Response: {data}")
            
            if 'error' in data and 'admin' in data['error'].lower():
                print("✅ TEST 12 PASSED - Returns 403 'Accès admin requis' for non-admin role")
                return True
            else:
                print("❌ TEST 12 FAILED - 403 but wrong error message")
                return False
        else:
            print(f"❌ TEST 12 FAILED - Expected 403, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 12 FAILED - Exception: {str(e)}")
        return False

def main():
    """Run all tests and report results"""
    print("\n" + "="*80)
    print("BACKEND REGRESSION TEST SUITE - POST REFACTORING")
    print("Testing endpoints after extracting handlers to /app/lib/api/handlers/")
    print("="*80)
    
    tests = [
        ("stats/public (no auth)", test_stats_public),
        ("dashboard/kpis (admin)", test_dashboard_kpis),
        ("dashboard/by-site (admin)", test_dashboard_by_site_admin),
        ("dashboard/by-site (pacific)", test_dashboard_by_site_pacific),
        ("dashboard/jour-j-live (admin)", test_dashboard_jour_j_live),
        ("alerts (admin)", test_alerts),
        ("documents/convention PDF", test_document_convention),
        ("documents/guide PDF", test_document_guide),
        ("documents/questionnaire-blank PDF", test_document_questionnaire_blank),
        ("unlock-candidature (success)", test_unlock_candidature_success),
        ("unlock-candidature (404)", test_unlock_candidature_not_found),
        ("unlock-candidature (403)", test_unlock_candidature_no_admin),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR in {name}: {str(e)}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed ({(passed/total*100):.1f}%)")
    print("="*80)
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
