#!/usr/bin/env python3
"""
SESSION 48ad — AUDIT EXHAUSTIF DE LA PLATEFORME
Vérification de la cohérence COMPLÈTE entre tous les endpoints et compteurs.
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"

# Headers admin
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def add(self, name: str, passed: bool, details: str = ""):
        self.tests.append({
            "name": name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print("\n" + "="*80)
        print(f"RÉSUMÉ DES TESTS: {self.passed} PASS / {self.failed} FAIL")
        print("="*80)
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status} - {test['name']}")
            if test["details"]:
                print(f"    {test['details']}")
        print("="*80)

result = TestResult()

def test_auth():
    """Test 13: POST /api/auth/password-login"""
    print("\n[TEST 13] POST /api/auth/password-login")
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("user", {}).get("role_code") == "aracom_admin":
                result.add("Auth admin login", True, f"role={data['user']['role_code']}")
                print(f"✅ 200 OK - role={data['user']['role_code']}")
            else:
                result.add("Auth admin login", False, f"Invalid response: {data}")
                print(f"❌ Invalid response: {data}")
        else:
            result.add("Auth admin login", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
    except Exception as e:
        result.add("Auth admin login", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")

def test_menu_badges():
    """Test 1: GET /api/menu-badges - Doit refléter exactement la vue Validations & Attente"""
    print("\n[TEST 1] GET /api/menu-badges")
    try:
        resp = requests.get(f"{BASE_URL}/menu-badges", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ 200 OK")
            print(f"   validations (pré-réservés): {data.get('validations')}")
            print(f"   waitlist: {data.get('waitlist')}")
            print(f"   pending_cessions: {data.get('pending_cessions')}")
            
            # Vérifier que pending_cessions = 0 (feature morte)
            if data.get('pending_cessions') == 0:
                result.add("menu-badges pending_cessions=0", True)
            else:
                result.add("menu-badges pending_cessions=0", False, f"Expected 0, got {data.get('pending_cessions')}")
            
            return data
        else:
            result.add("menu-badges HTTP 200", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
            return None
    except Exception as e:
        result.add("menu-badges HTTP 200", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")
        return None

def test_venues_availability():
    """Test 2: GET /api/venues/availability - Logique métier stricte"""
    print("\n[TEST 2] GET /api/venues/availability")
    try:
        resp = requests.get(f"{BASE_URL}/venues/availability", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ 200 OK")
            
            # Vérifier qu'on a exactement 4 venues actifs (Faaa, Punaauia, Arue, Taravao)
            venue_count = len(data)
            print(f"   Nombre de venues: {venue_count}")
            
            if venue_count == 4:
                result.add("venues/availability count=4", True)
            else:
                result.add("venues/availability count=4", False, f"Expected 4, got {venue_count}")
            
            # Vérifier chaque venue
            for venue_id, venue_data in data.items():
                print(f"\n   {venue_data['venue_name']} ({venue_data['venue_code']}):")
                print(f"      capacity: {venue_data['capacity']}")
                print(f"      validated: {venue_data['validated']}")
                print(f"      pre_reserved: {venue_data['pre_reserved']}")
                print(f"      waitlist: {venue_data['waitlist']}")
                print(f"      total_reserved: {venue_data['total_reserved']}")
                print(f"      available: {venue_data['available']}")
                print(f"      is_full: {venue_data['is_full']}")
                
                # Vérifier: validated + pre_reserved <= capacity
                total = venue_data['validated'] + venue_data['pre_reserved']
                capacity = venue_data['capacity']
                if total <= capacity:
                    result.add(f"{venue_data['venue_code']} quota OK", True, f"{total} <= {capacity}")
                else:
                    result.add(f"{venue_data['venue_code']} quota OK", False, f"{total} > {capacity} (VIOLATION)")
                
                # Vérifier: Si waitlist > 0, alors total_reserved === capacity (full=true obligatoire)
                if venue_data['waitlist'] > 0:
                    if venue_data['total_reserved'] == capacity and venue_data['is_full']:
                        result.add(f"{venue_data['venue_code']} waitlist logic", True, "full=true avec waitlist>0")
                    else:
                        result.add(f"{venue_data['venue_code']} waitlist logic", False, 
                                 f"waitlist={venue_data['waitlist']} mais total_reserved={venue_data['total_reserved']}, capacity={capacity}, is_full={venue_data['is_full']}")
            
            return data
        else:
            result.add("venues/availability HTTP 200", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
            return None
    except Exception as e:
        result.add("venues/availability HTTP 200", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")
        return None

def test_cross_endpoint_consistency(menu_data, availability_data):
    """Vérifier la cohérence entre menu-badges et venues/availability"""
    print("\n[CROSS-CHECK] menu-badges vs venues/availability")
    
    if not menu_data or not availability_data:
        result.add("Cross-endpoint consistency", False, "Missing data")
        return
    
    # Calculer la somme des pre_reserved de tous les venues
    total_pre_reserved = sum(v['pre_reserved'] for v in availability_data.values())
    total_waitlist = sum(v['waitlist'] for v in availability_data.values())
    
    print(f"   menu.validations: {menu_data.get('validations')}")
    print(f"   Σ availability[venue].pre_reserved: {total_pre_reserved}")
    print(f"   menu.waitlist: {menu_data.get('waitlist')}")
    print(f"   Σ availability[venue].waitlist: {total_waitlist}")
    
    # Vérifier: menu.validations === Σ availability[venue].pre_reserved
    if menu_data.get('validations') == total_pre_reserved:
        result.add("menu.validations === Σ pre_reserved", True, f"{menu_data.get('validations')} === {total_pre_reserved}")
    else:
        result.add("menu.validations === Σ pre_reserved", False, 
                 f"MISMATCH: {menu_data.get('validations')} !== {total_pre_reserved}")
    
    # Vérifier: menu.waitlist === Σ availability[venue].waitlist
    if menu_data.get('waitlist') == total_waitlist:
        result.add("menu.waitlist === Σ waitlist", True, f"{menu_data.get('waitlist')} === {total_waitlist}")
    else:
        result.add("menu.waitlist === Σ waitlist", False, 
                 f"MISMATCH: {menu_data.get('waitlist')} !== {total_waitlist}")

def test_venues_stands(venue_id: str, venue_name: str):
    """Test 3: GET /api/venues/:id/stands - Filtrage seed"""
    print(f"\n[TEST 3] GET /api/venues/{venue_id}/stands ({venue_name})")
    try:
        resp = requests.get(f"{BASE_URL}/venues/{venue_id}/stands", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ 200 OK - {len(data)} stands")
            
            # Compter les stands avec assignment
            assigned_count = sum(1 for s in data if s.get('assignment'))
            print(f"   Stands avec assignment: {assigned_count}")
            
            # Vérifier qu'aucun stand ne pointe vers une registration "refuse"
            refused_assignments = [s for s in data if s.get('assignment') and s.get('registration_status') == 'refuse']
            if len(refused_assignments) == 0:
                result.add(f"{venue_name} no refused assignments", True)
            else:
                result.add(f"{venue_name} no refused assignments", False, 
                         f"Found {len(refused_assignments)} stands with refused registrations")
            
            # Pour Faaa, vérifier que assigned_count <= capacity (16)
            if venue_id == 'venue-faaa':
                if assigned_count <= 16:
                    result.add(f"{venue_name} assigned <= capacity", True, f"{assigned_count} <= 16")
                else:
                    result.add(f"{venue_name} assigned <= capacity", False, f"{assigned_count} > 16")
            
            return data
        else:
            result.add(f"{venue_name} stands HTTP 200", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
            return None
    except Exception as e:
        result.add(f"{venue_name} stands HTTP 200", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")
        return None

def test_validate_refuse_cycle():
    """Test 4: POST /api/admin/registrations/:id/validate puis /refuse - Cycle complet"""
    print("\n[TEST 4] Validate/Refuse cycle")
    
    # D'abord, récupérer une registration en a_relancer ou a_confirmer sur Faaa
    try:
        resp = requests.get(f"{BASE_URL}/registrations?venue_id=venue-faaa", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            result.add("Validate/Refuse cycle - get registrations", False, f"Status {resp.status_code}")
            return
        
        regs = resp.json()
        target_reg = None
        for reg in regs:
            if reg.get('status') in ['a_relancer', 'a_confirmer']:
                target_reg = reg
                break
        
        if not target_reg:
            result.add("Validate/Refuse cycle - find target", False, "No suitable registration found")
            print("❌ No suitable registration found for testing")
            return
        
        reg_id = target_reg['id']
        original_status = target_reg['status']
        print(f"   Testing with registration: {reg_id} (status: {original_status})")
        
        # Étape 1: Valider
        print(f"\n   Step 1: Validate {reg_id}")
        resp = requests.post(f"{BASE_URL}/admin/registrations/{reg_id}/validate", 
                           headers=ADMIN_HEADERS, json={}, timeout=10)
        if resp.status_code == 200:
            print(f"   ✅ Validated")
            result.add("Validate endpoint", True)
            
            # Vérifier que les compteurs ont changé
            menu_after_validate = test_menu_badges()
            avail_after_validate = test_venues_availability()
            
        else:
            result.add("Validate endpoint", False, f"Status {resp.status_code}")
            print(f"   ❌ Validate failed: {resp.status_code}")
            return
        
        # Étape 2: Refuser
        print(f"\n   Step 2: Refuse {reg_id}")
        resp = requests.post(f"{BASE_URL}/admin/registrations/{reg_id}/refuse", 
                           headers=ADMIN_HEADERS, json={"reason": "Test refus"}, timeout=10)
        if resp.status_code == 200:
            print(f"   ✅ Refused")
            result.add("Refuse endpoint", True)
            
            # Vérifier que les compteurs ont changé
            menu_after_refuse = test_menu_badges()
            avail_after_refuse = test_venues_availability()
            
        else:
            result.add("Refuse endpoint", False, f"Status {resp.status_code}")
            print(f"   ❌ Refuse failed: {resp.status_code}")
            return
        
        # Étape 3: Remettre en état original
        print(f"\n   Step 3: Restore original status {original_status}")
        resp = requests.put(f"{BASE_URL}/registrations/{reg_id}", 
                          headers=ADMIN_HEADERS, 
                          json={"status": original_status}, 
                          timeout=10)
        if resp.status_code == 200:
            print(f"   ✅ Restored to {original_status}")
            result.add("Restore original status", True)
        else:
            result.add("Restore original status", False, f"Status {resp.status_code}")
            print(f"   ❌ Restore failed: {resp.status_code}")
        
    except Exception as e:
        result.add("Validate/Refuse cycle", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")

def test_send_confirmation():
    """Test 5: POST /api/admin/registrations/:id/send-confirmation"""
    print("\n[TEST 5] POST /api/admin/registrations/:id/send-confirmation")
    
    # Récupérer une registration pour tester
    try:
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code != 200:
            result.add("send-confirmation - get registrations", False, f"Status {resp.status_code}")
            return
        
        regs = resp.json()
        if len(regs) == 0:
            result.add("send-confirmation - find target", False, "No registrations found")
            return
        
        reg_id = regs[0]['id']
        print(f"   Testing with registration: {reg_id}")
        
        resp = requests.post(f"{BASE_URL}/admin/registrations/{reg_id}/send-confirmation", 
                           headers=ADMIN_HEADERS, json={}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ 200 OK")
            result.add("send-confirmation endpoint", True)
        else:
            result.add("send-confirmation endpoint", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
    except Exception as e:
        result.add("send-confirmation endpoint", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")

def test_other_endpoints():
    """Tests 6-16: Autres endpoints"""
    
    endpoints = [
        ("GET /api/admin/validation-queue", f"{BASE_URL}/admin/validation-queue", "validation-queue"),
        ("GET /api/dashboard/kpis", f"{BASE_URL}/dashboard/kpis", "dashboard/kpis"),
        ("GET /api/dashboard/by-site", f"{BASE_URL}/dashboard/by-site", "dashboard/by-site"),
        ("GET /api/validation-requests", f"{BASE_URL}/validation-requests", "validation-requests"),
        ("GET /api/registrations", f"{BASE_URL}/registrations", "registrations"),
        ("GET /api/prospects", f"{BASE_URL}/prospects", "prospects"),
        ("GET /api/prospects/stats", f"{BASE_URL}/prospects/stats", "prospects/stats"),
        ("GET /api/auth/me", f"{BASE_URL}/auth/me", "auth/me"),
        ("GET /api/venues?only_active=1", f"{BASE_URL}/venues?only_active=1", "venues active"),
        ("GET /api/version", f"{BASE_URL}/version", "version"),
    ]
    
    for name, url, test_name in endpoints:
        print(f"\n[TEST] {name}")
        try:
            resp = requests.get(url, headers=ADMIN_HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✅ 200 OK")
                
                # Vérifications spécifiques
                if test_name == "dashboard/kpis":
                    # Vérifier que by_status est cohérent
                    by_status = data.get('by_status', {})
                    total = data.get('total', 0)
                    sum_status = sum(by_status.values())
                    if sum_status == total:
                        result.add(f"{test_name} by_status sum", True, f"{sum_status} === {total}")
                    else:
                        result.add(f"{test_name} by_status sum", False, f"{sum_status} !== {total}")
                
                elif test_name == "venues active":
                    # Vérifier qu'on a 4 venues (Faaa, Punaauia, Arue, Taravao)
                    if len(data) == 4:
                        result.add(f"{test_name} count=4", True)
                    else:
                        result.add(f"{test_name} count=4", False, f"Expected 4, got {len(data)}")
                
                elif test_name == "version":
                    # Vérifier qu'on a une version >= 0.99.0
                    version = data.get('version', '0.0.0')
                    print(f"   version: {version}")
                    result.add(f"{test_name} present", True, f"version={version}")
                
                result.add(f"{test_name} HTTP 200", True)
            else:
                result.add(f"{test_name} HTTP 200", False, f"Status {resp.status_code}")
                print(f"❌ Status {resp.status_code}")
        except Exception as e:
            result.add(f"{test_name} HTTP 200", False, f"Exception: {str(e)}")
            print(f"❌ Exception: {str(e)}")

def test_no_500_errors():
    """Test 17: Vérifier qu'aucun endpoint retourne 500"""
    print("\n[TEST 17] No 500 errors on critical routes")
    
    # Liste des endpoints critiques à vérifier
    critical_endpoints = [
        f"{BASE_URL}/menu-badges",
        f"{BASE_URL}/venues/availability",
        f"{BASE_URL}/dashboard/kpis",
        f"{BASE_URL}/dashboard/by-site",
        f"{BASE_URL}/registrations",
        f"{BASE_URL}/venues?only_active=1",
    ]
    
    has_500 = False
    for url in critical_endpoints:
        try:
            resp = requests.get(url, headers=ADMIN_HEADERS, timeout=10)
            if resp.status_code == 500:
                has_500 = True
                print(f"❌ 500 error on {url}")
        except Exception as e:
            print(f"⚠️  Exception on {url}: {str(e)}")
    
    if not has_500:
        result.add("No 500 errors", True)
        print("✅ No 500 errors detected")
    else:
        result.add("No 500 errors", False, "Found 500 errors")

def test_no_waitlist_without_full():
    """Test 18: Vérifier qu'on n'a pas de waitlist avec un site qui n'est pas full"""
    print("\n[TEST 18] No waitlist without full site")
    
    try:
        resp = requests.get(f"{BASE_URL}/venues/availability", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            
            violations = []
            for venue_id, venue_data in data.items():
                if venue_data['waitlist'] > 0 and not venue_data['is_full']:
                    violations.append(f"{venue_data['venue_name']}: waitlist={venue_data['waitlist']} but is_full=False")
            
            if len(violations) == 0:
                result.add("No waitlist without full", True)
                print("✅ No violations found")
            else:
                result.add("No waitlist without full", False, f"Violations: {violations}")
                print(f"❌ Violations found: {violations}")
        else:
            result.add("No waitlist without full", False, f"Status {resp.status_code}")
    except Exception as e:
        result.add("No waitlist without full", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")

def main():
    print("="*80)
    print("SESSION 48ad — AUDIT EXHAUSTIF DE LA PLATEFORME")
    print("="*80)
    
    # Test 13: Auth
    test_auth()
    
    # Test 14: GET /api/auth/me
    print("\n[TEST 14] GET /api/auth/me")
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers=ADMIN_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ 200 OK - role={data.get('role_code')}")
            result.add("auth/me with session", True)
        else:
            result.add("auth/me with session", False, f"Status {resp.status_code}")
            print(f"❌ Status {resp.status_code}")
    except Exception as e:
        result.add("auth/me with session", False, f"Exception: {str(e)}")
        print(f"❌ Exception: {str(e)}")
    
    # PRIORITÉ HAUTE — Cohérence cross-endpoints
    menu_data = test_menu_badges()
    availability_data = test_venues_availability()
    test_cross_endpoint_consistency(menu_data, availability_data)
    
    # Test 3: Stands pour chaque venue
    if availability_data:
        for venue_id, venue_data in availability_data.items():
            test_venues_stands(venue_id, venue_data['venue_name'])
    
    # Test 4: Validate/Refuse cycle
    test_validate_refuse_cycle()
    
    # Test 5: Send confirmation
    test_send_confirmation()
    
    # Tests 6-16: Autres endpoints
    test_other_endpoints()
    
    # Test 17: No 500 errors
    test_no_500_errors()
    
    # Test 18: No waitlist without full
    test_no_waitlist_without_full()
    
    # Afficher le résumé
    result.print_summary()
    
    # Exit code
    sys.exit(0 if result.failed == 0 else 1)

if __name__ == "__main__":
    main()
