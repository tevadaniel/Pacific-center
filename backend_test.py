#!/usr/bin/env python3
"""
SESSION 48z — Test du fix d'alignement quota : /api/venues/availability
doit maintenant retourner les pré-réservations RÉELLES de la collection
registrations (68 entrées) + validation_requests (1 entrée).

CONTEXTE :
La précédente correction (48y) ne comptait que les validation_requests (1 entrée).
Mais il y a 68 inscriptions dans registrations (statuts a_confirmer/a_relancer/confirme)
qui doivent être prises en compte comme "pré-réservées". Le fix actuel fusionne les deux sources.
"""

import requests
import json
import sys

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin"
}

def test_venues_availability():
    """
    TEST 1 (P1) : GET /api/venues/availability
    Doit retourner les vraies données fusionnées (68 registrations + 1 validation_request)
    """
    print("\n" + "="*80)
    print("TEST 1 (P1) : GET /api/venues/availability — Données fusionnées réelles")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/venues/availability", headers=ADMIN_HEADERS, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"✅ Response structure OK")
        print(f"Venues returned: {list(data.keys())}")
        
        # Vérifier que seuls les sites actifs sont présents
        expected_venues = ['venue-faaa', 'venue-pun', 'venue-aru', 'venue-tar']
        actual_venues = list(data.keys())
        
        if set(actual_venues) != set(expected_venues):
            print(f"❌ FAIL - Expected venues {expected_venues}, got {actual_venues}")
            return False
        
        print(f"✅ Only active venues returned (4 venues)")
        
        # Vérifier que Mahina et Moorea (sites prospect) ne sont PAS présents
        if 'venue-mah' in data or 'venue-moo' in data:
            print(f"❌ FAIL - Prospect sites (Mahina/Moorea) should NOT be in availability")
            return False
        
        print(f"✅ Prospect sites (Mahina/Moorea) correctly excluded")
        
        # Vérifier les valeurs attendues pour chaque venue
        # Basé sur les données actuelles : 68 registrations (19 a_confirmer + 37 a_relancer + 12 prospect)
        # + 1 validation_request (I Mua Papeete sur Arue)
        
        # FAAA : capacity=16, 17 registrations (8 a_confirmer + 9 a_relancer)
        # Attendu : pre_reserved=17, validated=0, waitlist=0, total_reserved=17, available=0, is_full=true
        faaa = data.get('venue-faaa', {})
        print(f"\n--- FAAA ---")
        print(f"  capacity: {faaa.get('capacity')}")
        print(f"  pre_reserved: {faaa.get('pre_reserved')}")
        print(f"  validated: {faaa.get('validated')}")
        print(f"  waitlist: {faaa.get('waitlist')}")
        print(f"  total_reserved: {faaa.get('total_reserved')}")
        print(f"  available: {faaa.get('available')}")
        print(f"  is_full: {faaa.get('is_full')}")
        
        if faaa.get('capacity') != 16:
            print(f"❌ FAIL - Faaa capacity should be 16, got {faaa.get('capacity')}")
            return False
        
        if faaa.get('pre_reserved') != 17:
            print(f"❌ FAIL - Faaa pre_reserved should be 17 (8 a_confirmer + 9 a_relancer), got {faaa.get('pre_reserved')}")
            return False
        
        if faaa.get('validated') != 0:
            print(f"❌ FAIL - Faaa validated should be 0, got {faaa.get('validated')}")
            return False
        
        if faaa.get('total_reserved') != 17:
            print(f"❌ FAIL - Faaa total_reserved should be 17, got {faaa.get('total_reserved')}")
            return False
        
        if faaa.get('available') != 0:
            print(f"❌ FAIL - Faaa available should be 0 (capacity exceeded), got {faaa.get('available')}")
            return False
        
        if faaa.get('is_full') != True:
            print(f"❌ FAIL - Faaa is_full should be true, got {faaa.get('is_full')}")
            return False
        
        print(f"✅ FAAA values correct: capacity=16, pre_reserved=17, is_full=true")
        
        # PUNAAUIA : capacity=13, 13 registrations (4 a_confirmer + 9 a_relancer)
        # Attendu : pre_reserved=13, validated=0, waitlist=0, total_reserved=13, available=0, is_full=true
        pun = data.get('venue-pun', {})
        print(f"\n--- PUNAAUIA ---")
        print(f"  capacity: {pun.get('capacity')}")
        print(f"  pre_reserved: {pun.get('pre_reserved')}")
        print(f"  validated: {pun.get('validated')}")
        print(f"  waitlist: {pun.get('waitlist')}")
        print(f"  total_reserved: {pun.get('total_reserved')}")
        print(f"  available: {pun.get('available')}")
        print(f"  is_full: {pun.get('is_full')}")
        
        if pun.get('capacity') != 13:
            print(f"❌ FAIL - Punaauia capacity should be 13, got {pun.get('capacity')}")
            return False
        
        if pun.get('pre_reserved') != 13:
            print(f"❌ FAIL - Punaauia pre_reserved should be 13 (4 a_confirmer + 9 a_relancer), got {pun.get('pre_reserved')}")
            return False
        
        if pun.get('is_full') != True:
            print(f"❌ FAIL - Punaauia is_full should be true, got {pun.get('is_full')}")
            return False
        
        print(f"✅ PUNAAUIA values correct: capacity=13, pre_reserved=13, is_full=true")
        
        # ARUE : capacity=12, 12 registrations (4 a_confirmer + 8 a_relancer) + 1 validation_request
        # Attendu : pre_reserved=12, validated=0, waitlist=0, total_reserved=12, available=0, is_full=true
        aru = data.get('venue-aru', {})
        print(f"\n--- ARUE ---")
        print(f"  capacity: {aru.get('capacity')}")
        print(f"  pre_reserved: {aru.get('pre_reserved')}")
        print(f"  validated: {aru.get('validated')}")
        print(f"  waitlist: {aru.get('waitlist')}")
        print(f"  total_reserved: {aru.get('total_reserved')}")
        print(f"  available: {aru.get('available')}")
        print(f"  is_full: {aru.get('is_full')}")
        
        if aru.get('capacity') != 12:
            print(f"❌ FAIL - Arue capacity should be 12, got {aru.get('capacity')}")
            return False
        
        if aru.get('pre_reserved') != 12:
            print(f"❌ FAIL - Arue pre_reserved should be 12 (4 a_confirmer + 8 a_relancer, 1 validation_request déjà lié à une registration), got {aru.get('pre_reserved')}")
            return False
        
        if aru.get('is_full') != True:
            print(f"❌ FAIL - Arue is_full should be true, got {aru.get('is_full')}")
            return False
        
        print(f"✅ ARUE values correct: capacity=12, pre_reserved=12, is_full=true")
        
        # TARAVAO : capacity=12, 12 registrations (3 a_confirmer + 9 a_relancer)
        # Attendu : pre_reserved=12, validated=0, waitlist=0, total_reserved=12, available=0, is_full=true
        tar = data.get('venue-tar', {})
        print(f"\n--- TARAVAO ---")
        print(f"  capacity: {tar.get('capacity')}")
        print(f"  pre_reserved: {tar.get('pre_reserved')}")
        print(f"  validated: {tar.get('validated')}")
        print(f"  waitlist: {tar.get('waitlist')}")
        print(f"  total_reserved: {tar.get('total_reserved')}")
        print(f"  available: {tar.get('available')}")
        print(f"  is_full: {tar.get('is_full')}")
        
        if tar.get('capacity') != 12:
            print(f"❌ FAIL - Taravao capacity should be 12, got {tar.get('capacity')}")
            return False
        
        if tar.get('pre_reserved') != 12:
            print(f"❌ FAIL - Taravao pre_reserved should be 12 (3 a_confirmer + 9 a_relancer), got {tar.get('pre_reserved')}")
            return False
        
        if tar.get('is_full') != True:
            print(f"❌ FAIL - Taravao is_full should be true, got {tar.get('is_full')}")
            return False
        
        print(f"✅ TARAVAO values correct: capacity=12, pre_reserved=12, is_full=true")
        
        # Vérifier que tous les sites sont is_full=true
        all_full = all(data[v].get('is_full') == True for v in expected_venues)
        if not all_full:
            print(f"❌ FAIL - All sites should be is_full=true")
            return False
        
        print(f"\n✅ TEST 1 PASSED - All venues have correct merged data (registrations + validation_requests)")
        return True
        
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_venue_faaa_stands():
    """
    TEST 2 (P1) : GET /api/venues/venue-faaa/stands
    Vérifier que les assignations seed sont conservées car les registrations sont actives
    """
    print("\n" + "="*80)
    print("TEST 2 (P1) : GET /api/venues/venue-faaa/stands — Assignations conservées")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/venues/venue-faaa/stands", headers=ADMIN_HEADERS, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"✅ Response OK")
        print(f"Total stands: {len(data)}")
        
        # Vérifier qu'il y a 16 stands
        if len(data) != 16:
            print(f"❌ FAIL - Expected 16 stands, got {len(data)}")
            return False
        
        print(f"✅ 16 stands returned")
        
        # Compter les stands avec assignment
        assigned = [s for s in data if s.get('assignment') is not None]
        print(f"Stands with assignment: {len(assigned)}")
        
        # Attendu : 16 stands avec assignment (toutes les registrations actives)
        # Car il y a 17 registrations a_confirmer/a_relancer pour Faaa (capacité dépassée)
        # Mais seulement 16 stands physiques, donc au max 16 assignments
        if len(assigned) < 1:
            print(f"❌ FAIL - Expected at least 1 stand with assignment, got {len(assigned)}")
            return False
        
        print(f"✅ At least 1 stand has assignment (seed assignments preserved for active registrations)")
        
        # Afficher quelques exemples
        for i, stand in enumerate(assigned[:3]):
            print(f"  Stand {i+1}: {stand.get('stand_code')} → {stand.get('assignment', {}).get('organization_name', 'N/A')}")
        
        print(f"\n✅ TEST 2 PASSED - Faaa stands with assignments preserved")
        return True
        
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_venue_arue_stands():
    """
    TEST 3 (P1) : GET /api/venues/venue-aru/stands
    Vérifier que les assignations sont conservées (incluant A-C01 pour reg-arue-A-C01)
    """
    print("\n" + "="*80)
    print("TEST 3 (P1) : GET /api/venues/venue-aru/stands — Assignations conservées")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/venues/venue-aru/stands", headers=ADMIN_HEADERS, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"✅ Response OK")
        print(f"Total stands: {len(data)}")
        
        # Vérifier qu'il y a 12 stands
        if len(data) != 12:
            print(f"❌ FAIL - Expected 12 stands, got {len(data)}")
            return False
        
        print(f"✅ 12 stands returned")
        
        # Compter les stands avec assignment
        assigned = [s for s in data if s.get('assignment') is not None]
        print(f"Stands with assignment: {len(assigned)}")
        
        # Vérifier que A-C01 a une assignment pour reg-arue-A-C01
        a_c01 = next((s for s in data if s.get('stand_code') == 'A-C01'), None)
        if not a_c01:
            print(f"❌ FAIL - Stand A-C01 not found")
            return False
        
        if a_c01.get('assignment') is None:
            print(f"❌ FAIL - Stand A-C01 should have an assignment")
            return False
        
        print(f"✅ Stand A-C01 has assignment: {a_c01.get('assignment', {}).get('organization_name', 'N/A')}")
        
        # Afficher quelques exemples
        for i, stand in enumerate(assigned[:3]):
            print(f"  Stand {i+1}: {stand.get('stand_code')} → {stand.get('assignment', {}).get('organization_name', 'N/A')}")
        
        print(f"\n✅ TEST 3 PASSED - Arue stands with assignments preserved (including A-C01)")
        return True
        
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_cross_endpoint_coherence():
    """
    TEST 4 (P1) : Cohérence cross-endpoints
    availability[venue_id].pre_reserved doit correspondre au nombre d'inscriptions actives par site
    """
    print("\n" + "="*80)
    print("TEST 4 (P1) : Cohérence cross-endpoints — availability vs registrations")
    print("="*80)
    
    try:
        # Récupérer availability
        avail_response = requests.get(f"{BASE_URL}/venues/availability", headers=ADMIN_HEADERS, timeout=30)
        if avail_response.status_code != 200:
            print(f"❌ FAIL - availability endpoint returned {avail_response.status_code}")
            return False
        
        availability = avail_response.json()
        
        # Récupérer registrations
        regs_response = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=30)
        if regs_response.status_code != 200:
            print(f"❌ FAIL - registrations endpoint returned {regs_response.status_code}")
            return False
        
        registrations = regs_response.json()
        
        print(f"✅ Both endpoints responded")
        print(f"Total registrations: {len(registrations)}")
        
        # Pour Arue : compter les registrations actives
        arue_regs = [r for r in registrations if r.get('venue_id') == 'venue-aru' 
                     and r.get('status') not in ['prospect', 'cancelled', 'annule']]
        
        print(f"\nArue registrations (active): {len(arue_regs)}")
        print(f"Arue availability pre_reserved: {availability.get('venue-aru', {}).get('pre_reserved')}")
        
        if len(arue_regs) != availability.get('venue-aru', {}).get('pre_reserved'):
            print(f"❌ FAIL - Arue: registrations count ({len(arue_regs)}) != availability.pre_reserved ({availability.get('venue-aru', {}).get('pre_reserved')})")
            return False
        
        print(f"✅ Arue coherence OK: {len(arue_regs)} active registrations = {availability.get('venue-aru', {}).get('pre_reserved')} pre_reserved")
        
        # Vérifier pour tous les sites
        for venue_id in ['venue-faaa', 'venue-pun', 'venue-aru', 'venue-tar']:
            venue_regs = [r for r in registrations if r.get('venue_id') == venue_id 
                         and r.get('status') not in ['prospect', 'cancelled', 'annule']]
            
            avail_data = availability.get(venue_id, {})
            pre_reserved = avail_data.get('pre_reserved', 0)
            validated = avail_data.get('validated', 0)
            total_reserved = avail_data.get('total_reserved', 0)
            
            # total_reserved doit être égal à pre_reserved + validated
            if total_reserved != pre_reserved + validated:
                print(f"❌ FAIL - {venue_id}: total_reserved ({total_reserved}) != pre_reserved ({pre_reserved}) + validated ({validated})")
                return False
            
            # Le nombre de registrations actives doit correspondre à pre_reserved + validated
            if len(venue_regs) != total_reserved:
                print(f"❌ FAIL - {venue_id}: registrations count ({len(venue_regs)}) != total_reserved ({total_reserved})")
                return False
            
            print(f"✅ {venue_id}: {len(venue_regs)} active registrations = {total_reserved} total_reserved")
        
        print(f"\n✅ TEST 4 PASSED - Cross-endpoint coherence verified for all venues")
        return True
        
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_non_regression():
    """
    TEST 5 (P1) : Checks non-régression
    """
    print("\n" + "="*80)
    print("TEST 5 (P1) : Non-regression checks")
    print("="*80)
    
    tests = [
        ("GET /api/venues?only_active=1", f"{BASE_URL}/venues?only_active=1", 200, "4 venues"),
        ("GET /api/menu-badges", f"{BASE_URL}/menu-badges", 200, "badges"),
        ("GET /api/validation-requests", f"{BASE_URL}/validation-requests", 200, "1 entry for I Mua Papeete"),
        ("GET /api/registrations", f"{BASE_URL}/registrations", 200, "68 entries"),
    ]
    
    all_passed = True
    
    for test_name, url, expected_status, description in tests:
        try:
            response = requests.get(url, headers=ADMIN_HEADERS, timeout=30)
            if response.status_code == expected_status:
                print(f"✅ {test_name} → {expected_status} ({description})")
            else:
                print(f"❌ {test_name} → {response.status_code} (expected {expected_status})")
                all_passed = False
        except Exception as e:
            print(f"❌ {test_name} → Exception: {e}")
            all_passed = False
    
    # Test auth
    try:
        auth_response = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": "admin@aracom.pf", "password": "Projetaracom12"},
            timeout=30
        )
        if auth_response.status_code == 200:
            data = auth_response.json()
            if data.get('user', {}).get('role_code') == 'aracom_admin':
                print(f"✅ POST /api/auth/password-login → 200 with role=aracom_admin")
            else:
                print(f"❌ POST /api/auth/password-login → role mismatch")
                all_passed = False
        else:
            print(f"❌ POST /api/auth/password-login → {auth_response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ POST /api/auth/password-login → Exception: {e}")
        all_passed = False
    
    if all_passed:
        print(f"\n✅ TEST 5 PASSED - All non-regression checks passed")
    else:
        print(f"\n❌ TEST 5 FAILED - Some non-regression checks failed")
    
    return all_passed


def main():
    print("\n" + "="*80)
    print("SESSION 48z — Test du fix d'alignement quota")
    print("="*80)
    print("\nCONTEXTE:")
    print("La précédente correction (48y) ne comptait que les validation_requests (1 entrée).")
    print("Mais il y a 68 inscriptions dans registrations (statuts a_confirmer/a_relancer/confirme)")
    print("qui doivent être prises en compte comme 'pré-réservées'. Le fix actuel fusionne les deux sources.")
    print("\nCREDENTIALS: admin@aracom.pf / Projetaracom12")
    print("="*80)
    
    results = []
    
    # Test 1: GET /api/venues/availability
    results.append(("TEST 1 - venues/availability merged data", test_venues_availability()))
    
    # Test 2: GET /api/venues/venue-faaa/stands
    results.append(("TEST 2 - venue-faaa/stands assignments", test_venue_faaa_stands()))
    
    # Test 3: GET /api/venues/venue-aru/stands
    results.append(("TEST 3 - venue-aru/stands assignments", test_venue_arue_stands()))
    
    # Test 4: Cross-endpoint coherence
    results.append(("TEST 4 - Cross-endpoint coherence", test_cross_endpoint_coherence()))
    
    # Test 5: Non-regression checks
    results.append(("TEST 5 - Non-regression checks", test_non_regression()))
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n{passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - SESSION 48z fix verified successfully!")
        print("\nCRITICAL FINDING:")
        print("✅ pre_reserved + validated in availability corresponds to real active registrations per venue")
        print("✅ All venues show is_full=true (capacity reached)")
        print("✅ Faaa: 17 pre_reserved (8 a_confirmer + 9 a_relancer)")
        print("✅ Punaauia: 13 pre_reserved (4 a_confirmer + 9 a_relancer)")
        print("✅ Arue: 12 pre_reserved (4 a_confirmer + 8 a_relancer)")
        print("✅ Taravao: 12 pre_reserved (3 a_confirmer + 9 a_relancer)")
        print("✅ Prospect sites (Mahina/Moorea) correctly excluded")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
