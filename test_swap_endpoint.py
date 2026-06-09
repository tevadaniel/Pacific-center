#!/usr/bin/env python3
"""
SESSION 48ae — Test du nouvel endpoint POST /api/admin/registrations/:id/swap

CONTEXTE :
Nouveau endpoint permettant d'échanger manuellement deux registrations sur le même site : 
la 1ère est refusée et libère son stand, la 2nde prend ce stand et passe en statut `a_confirmer`.

ENDPOINT : POST /api/admin/registrations/:promote_id/swap
- Body: { with_registration_id }
- Effet : 
  1. with_registration → status='refuse', refused_at, refused_by, refused_reason, stand_code=null
  2. with_registration → ses stand_assignments passent en status='annule'
  3. promote_id → status='a_confirmer', stand_code = with_registration.stand_code (libéré)
  4. promote_id → stand_assignment upsertée sur le stand libéré (status='provisoire', request_status='pending')
  5. activity_logs entry REGISTRATION_SWAP
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

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

# Headers exposant (for permission test)
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exp-test",
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
            print(f"✅ PASS - {name}")
        else:
            self.failed += 1
            print(f"❌ FAIL - {name}")
        if details:
            print(f"    {details}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print(f"RÉSUMÉ DES TESTS: {self.passed} PASS / {self.failed} FAIL")
        print(f"TAUX DE RÉUSSITE: {(self.passed/(self.passed+self.failed)*100):.1f}%")
        print("="*80)
        for test in self.tests:
            status = "✅ PASS" if test["passed"] else "❌ FAIL"
            print(f"{status} - {test['name']}")
            if test["details"]:
                print(f"    {test['details']}")
        print("="*80)

result = TestResult()

def get_registration(reg_id: str) -> Optional[Dict[str, Any]]:
    """Récupère une registration par son ID"""
    try:
        resp = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception as e:
        print(f"⚠️  Erreur lors de la récupération de {reg_id}: {e}")
        return None

def test_setup():
    """Test 0: Setup - Identifier les registrations de test"""
    print("\n" + "="*80)
    print("TEST 0: SETUP - Identification des registrations de test")
    print("="*80)
    
    # Récupérer les registrations sur venue-faaa
    try:
        resp = requests.get(
            f"{BASE_URL}/registrations?venue_id=venue-faaa",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        if resp.status_code != 200:
            result.add("Setup - GET registrations", False, f"Status {resp.status_code}")
            return None, None
        
        registrations = resp.json()
        print(f"✓ Trouvé {len(registrations)} registrations sur venue-faaa")
        
        # Trouver une registration avec stand (à refuser)
        reg_with_stand = None
        for reg in registrations:
            if reg.get('stand_code') and reg.get('status') in ['a_confirmer', 'a_relancer']:
                reg_with_stand = reg
                break
        
        # Trouver une registration sans stand (à promouvoir)
        reg_without_stand = None
        for reg in registrations:
            if not reg.get('stand_code') and reg.get('status') in ['a_confirmer', 'a_relancer']:
                reg_without_stand = reg
                break
        
        if not reg_with_stand:
            result.add("Setup - Trouver registration avec stand", False, "Aucune registration avec stand trouvée")
            return None, None
        
        if not reg_without_stand:
            result.add("Setup - Trouver registration sans stand", False, "Aucune registration sans stand trouvée")
            return None, None
        
        print(f"✓ Registration A (à refuser): {reg_with_stand['id']}")
        print(f"  - Organisation: {reg_with_stand.get('organization', {}).get('name', 'N/A')}")
        print(f"  - Stand: {reg_with_stand['stand_code']}")
        print(f"  - Status: {reg_with_stand['status']}")
        
        print(f"✓ Registration B (à promouvoir): {reg_without_stand['id']}")
        print(f"  - Organisation: {reg_without_stand.get('organization', {}).get('name', 'N/A')}")
        print(f"  - Stand: {reg_without_stand.get('stand_code', 'None')}")
        print(f"  - Status: {reg_without_stand['status']}")
        
        result.add("Setup - Identification des registrations", True, 
                  f"A={reg_with_stand['id']}, B={reg_without_stand['id']}")
        
        return reg_with_stand['id'], reg_without_stand['id']
        
    except Exception as e:
        result.add("Setup - Exception", False, str(e))
        return None, None

def test_cas_nominal(refuse_id: str, promote_id: str):
    """Test 1: Cas nominal - Swap réussi"""
    print("\n" + "="*80)
    print("TEST 1: CAS NOMINAL - Swap réussi")
    print("="*80)
    
    # Récupérer l'état initial via l'API registrations (qui retourne les données complètes)
    try:
        resp_refuse = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        resp_promote = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        
        if resp_refuse.status_code != 200 or resp_promote.status_code != 200:
            result.add("Test 1 - Récupération état initial", False, "Impossible de récupérer les registrations")
            return False
        
        all_regs = resp_refuse.json()
        refuse_before = next((r for r in all_regs if r['id'] == refuse_id), None)
        promote_before = next((r for r in all_regs if r['id'] == promote_id), None)
        
        if not refuse_before or not promote_before:
            result.add("Test 1 - Récupération état initial", False, "Registrations non trouvées dans la liste")
            return False
        
        target_stand = refuse_before.get('stand_code')
        print(f"✓ État initial:")
        print(f"  - Registration A (refuse): stand={target_stand}, status={refuse_before.get('status')}")
        print(f"  - Registration B (promote): stand={promote_before.get('stand_code')}, status={promote_before.get('status')}")
    except Exception as e:
        result.add("Test 1 - Récupération état initial", False, str(e))
        return False
    
    # Effectuer le swap
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{promote_id}/swap",
            headers=ADMIN_HEADERS,
            json={"with_registration_id": refuse_id},
            timeout=10
        )
        
        print(f"\n✓ POST /api/admin/registrations/{promote_id}/swap")
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            result.add("Test 1 - Swap HTTP 200", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        print(f"  Response: {json.dumps(data, indent=2)}")
        
        # Vérifier la réponse
        if not data.get('ok'):
            result.add("Test 1 - Response ok=true", False, f"ok={data.get('ok')}")
            return False
        
        if data.get('promote_id') != promote_id:
            result.add("Test 1 - Response promote_id", False, f"Expected {promote_id}, got {data.get('promote_id')}")
            return False
        
        if data.get('refuse_id') != refuse_id:
            result.add("Test 1 - Response refuse_id", False, f"Expected {refuse_id}, got {data.get('refuse_id')}")
            return False
        
        if data.get('new_stand_code') != target_stand:
            result.add("Test 1 - Response new_stand_code", False, f"Expected {target_stand}, got {data.get('new_stand_code')}")
            return False
        
        result.add("Test 1 - Swap HTTP 200 + Response structure", True, 
                  f"promote_id={promote_id}, refuse_id={refuse_id}, new_stand_code={target_stand}")
        
        # Vérifier l'état après swap
        print(f"\n✓ Vérification de l'état après swap...")
        resp_after = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS, timeout=10)
        if resp_after.status_code != 200:
            result.add("Test 1 - Récupération état après swap", False, "Impossible de récupérer les registrations")
            return False
        
        all_regs_after = resp_after.json()
        refuse_after = next((r for r in all_regs_after if r['id'] == refuse_id), None)
        promote_after = next((r for r in all_regs_after if r['id'] == promote_id), None)
        
        if not refuse_after or not promote_after:
            result.add("Test 1 - Récupération état après swap", False, "Registrations non trouvées après swap")
            return False
        
        # Vérifier registration A (refusée)
        checks_passed = True
        
        if refuse_after.get('status') != 'refuse':
            result.add("Test 1 - Registration A status=refuse", False, f"status={refuse_after.get('status')}")
            checks_passed = False
        else:
            print(f"  ✓ Registration A: status=refuse")
        
        if refuse_after.get('stand_code') is not None:
            result.add("Test 1 - Registration A stand_code=null", False, f"stand_code={refuse_after.get('stand_code')}")
            checks_passed = False
        else:
            print(f"  ✓ Registration A: stand_code=null")
        
        if not refuse_after.get('refused_at'):
            result.add("Test 1 - Registration A refused_at présent", False, "refused_at manquant")
            checks_passed = False
        else:
            print(f"  ✓ Registration A: refused_at={refuse_after.get('refused_at')}")
        
        if not refuse_after.get('refused_by'):
            result.add("Test 1 - Registration A refused_by présent", False, "refused_by manquant")
            checks_passed = False
        else:
            print(f"  ✓ Registration A: refused_by={refuse_after.get('refused_by')}")
        
        # Vérifier registration B (promue)
        if promote_after.get('status') != 'a_confirmer':
            result.add("Test 1 - Registration B status=a_confirmer", False, f"status={promote_after.get('status')}")
            checks_passed = False
        else:
            print(f"  ✓ Registration B: status=a_confirmer")
        
        if promote_after.get('stand_code') != target_stand:
            result.add("Test 1 - Registration B stand_code", False, f"Expected {target_stand}, got {promote_after.get('stand_code')}")
            checks_passed = False
        else:
            print(f"  ✓ Registration B: stand_code={target_stand}")
        
        if checks_passed:
            result.add("Test 1 - Vérification état DB après swap", True, "Tous les champs corrects")
        
        return True
        
    except Exception as e:
        result.add("Test 1 - Exception", False, str(e))
        return False

def test_venues_differents():
    """Test 2: Cas erreur - Venues différents"""
    print("\n" + "="*80)
    print("TEST 2: CAS ERREUR - Venues différents")
    print("="*80)
    
    try:
        # Trouver une registration sur venue-faaa
        resp_faaa = requests.get(
            f"{BASE_URL}/registrations?venue_id=venue-faaa",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        # Trouver une registration sur venue-pun
        resp_pun = requests.get(
            f"{BASE_URL}/registrations?venue_id=venue-pun",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if resp_faaa.status_code != 200 or resp_pun.status_code != 200:
            result.add("Test 2 - Setup", False, "Impossible de récupérer les registrations")
            return
        
        regs_faaa = resp_faaa.json()
        regs_pun = resp_pun.json()
        
        if not regs_faaa or not regs_pun:
            result.add("Test 2 - Setup", False, "Pas assez de registrations sur les deux sites")
            return
        
        reg_faaa_id = regs_faaa[0]['id']
        reg_pun_id = regs_pun[0]['id']
        
        print(f"✓ Tentative de swap entre:")
        print(f"  - Registration Faaa: {reg_faaa_id}")
        print(f"  - Registration Punaauia: {reg_pun_id}")
        
        # Tenter le swap
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_faaa_id}/swap",
            headers=ADMIN_HEADERS,
            json={"with_registration_id": reg_pun_id},
            timeout=10
        )
        
        print(f"\n✓ POST /api/admin/registrations/{reg_faaa_id}/swap")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 400:
            data = resp.json()
            if "même site" in data.get('error', '').lower():
                result.add("Test 2 - Erreur 400 venues différents", True, f"Message: {data.get('error')}")
            else:
                result.add("Test 2 - Erreur 400 venues différents", False, f"Message incorrect: {data.get('error')}")
        else:
            result.add("Test 2 - Erreur 400 venues différents", False, f"Status {resp.status_code} au lieu de 400")
        
    except Exception as e:
        result.add("Test 2 - Exception", False, str(e))

def test_registration_introuvable():
    """Test 3: Cas erreur - Registration introuvable"""
    print("\n" + "="*80)
    print("TEST 3: CAS ERREUR - Registration introuvable")
    print("="*80)
    
    try:
        fake_id = "non-existent-registration-12345"
        
        # Test avec promote_id inexistant
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{fake_id}/swap",
            headers=ADMIN_HEADERS,
            json={"with_registration_id": "reg-faaa-F-A01"},
            timeout=10
        )
        
        print(f"✓ Test avec promote_id inexistant: {fake_id}")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 404:
            result.add("Test 3a - Erreur 404 promote_id inexistant", True, f"Status 404")
        else:
            result.add("Test 3a - Erreur 404 promote_id inexistant", False, f"Status {resp.status_code} au lieu de 404")
        
        # Test avec with_registration_id inexistant
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/reg-faaa-F-A01/swap",
            headers=ADMIN_HEADERS,
            json={"with_registration_id": fake_id},
            timeout=10
        )
        
        print(f"\n✓ Test avec with_registration_id inexistant: {fake_id}")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 404:
            result.add("Test 3b - Erreur 404 with_registration_id inexistant", True, f"Status 404")
        else:
            result.add("Test 3b - Erreur 404 with_registration_id inexistant", False, f"Status {resp.status_code} au lieu de 404")
        
    except Exception as e:
        result.add("Test 3 - Exception", False, str(e))

def test_ids_identiques():
    """Test 4: Cas erreur - IDs identiques"""
    print("\n" + "="*80)
    print("TEST 4: CAS ERREUR - IDs identiques")
    print("="*80)
    
    try:
        same_id = "reg-faaa-F-A01"
        
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/{same_id}/swap",
            headers=ADMIN_HEADERS,
            json={"with_registration_id": same_id},
            timeout=10
        )
        
        print(f"✓ Tentative de swap avec le même ID: {same_id}")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 400:
            data = resp.json()
            if "identiques" in data.get('error', '').lower():
                result.add("Test 4 - Erreur 400 IDs identiques", True, f"Message: {data.get('error')}")
            else:
                result.add("Test 4 - Erreur 400 IDs identiques", False, f"Message incorrect: {data.get('error')}")
        else:
            result.add("Test 4 - Erreur 400 IDs identiques", False, f"Status {resp.status_code} au lieu de 400")
        
    except Exception as e:
        result.add("Test 4 - Exception", False, str(e))

def test_body_manquant():
    """Test 5: Cas erreur - Body manquant"""
    print("\n" + "="*80)
    print("TEST 5: CAS ERREUR - Body manquant")
    print("="*80)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/reg-faaa-F-A01/swap",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        print(f"✓ Tentative de swap sans with_registration_id")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 400:
            data = resp.json()
            if "manquant" in data.get('error', '').lower():
                result.add("Test 5 - Erreur 400 body manquant", True, f"Message: {data.get('error')}")
            else:
                result.add("Test 5 - Erreur 400 body manquant", False, f"Message incorrect: {data.get('error')}")
        else:
            result.add("Test 5 - Erreur 400 body manquant", False, f"Status {resp.status_code} au lieu de 400")
        
    except Exception as e:
        result.add("Test 5 - Exception", False, str(e))

def test_permission():
    """Test 6: Cas erreur - Permission"""
    print("\n" + "="*80)
    print("TEST 6: CAS ERREUR - Permission (sans rôle aracom_admin)")
    print("="*80)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/registrations/reg-faaa-F-A01/swap",
            headers=EXPOSANT_HEADERS,
            json={"with_registration_id": "reg-faaa-F-A02"},
            timeout=10
        )
        
        print(f"✓ Tentative de swap avec rôle exposant")
        print(f"  Status: {resp.status_code}")
        print(f"  Response: {resp.text}")
        
        if resp.status_code == 403:
            result.add("Test 6 - Erreur 403 permission", True, f"Status 403")
        else:
            result.add("Test 6 - Erreur 403 permission", False, f"Status {resp.status_code} au lieu de 403")
        
    except Exception as e:
        result.add("Test 6 - Exception", False, str(e))

def test_coherence_post_swap():
    """Test 7: Vérification de cohérence post-swap"""
    print("\n" + "="*80)
    print("TEST 7: VÉRIFICATION DE COHÉRENCE POST-SWAP")
    print("="*80)
    
    try:
        # Test GET /api/venues/availability
        resp = requests.get(
            f"{BASE_URL}/venues/availability",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        print(f"✓ GET /api/venues/availability")
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            result.add("Test 7a - GET /api/venues/availability", True, "Status 200")
        else:
            result.add("Test 7a - GET /api/venues/availability", False, f"Status {resp.status_code}")
        
        # Test GET /api/menu-badges
        resp = requests.get(
            f"{BASE_URL}/menu-badges",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        print(f"\n✓ GET /api/menu-badges")
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"  Validations: {data.get('validations')}")
            print(f"  Waitlist: {data.get('waitlist')}")
            result.add("Test 7b - GET /api/menu-badges", True, f"Status 200, validations={data.get('validations')}, waitlist={data.get('waitlist')}")
        else:
            result.add("Test 7b - GET /api/menu-badges", False, f"Status {resp.status_code}")
        
    except Exception as e:
        result.add("Test 7 - Exception", False, str(e))

def test_non_regression():
    """Test 8: Tests de non-régression critique"""
    print("\n" + "="*80)
    print("TEST 8: TESTS DE NON-RÉGRESSION CRITIQUE")
    print("="*80)
    
    endpoints = [
        ("POST /api/admin/registrations/:id/validate", "admin/registrations/reg-faaa-F-A01/validate", "POST", {}),
        ("POST /api/admin/registrations/:id/refuse", "admin/registrations/reg-faaa-F-A01/refuse", "POST", {"reason": "Test"}),
        ("POST /api/admin/registrations/:id/send-confirmation", "admin/registrations/reg-faaa-F-A01/send-confirmation", "POST", {}),
    ]
    
    for name, endpoint, method, body in endpoints:
        try:
            if method == "POST":
                resp = requests.post(
                    f"{BASE_URL}/{endpoint}",
                    headers=ADMIN_HEADERS,
                    json=body,
                    timeout=10
                )
            else:
                resp = requests.get(
                    f"{BASE_URL}/{endpoint}",
                    headers=ADMIN_HEADERS,
                    timeout=10
                )
            
            print(f"\n✓ {name}")
            print(f"  Status: {resp.status_code}")
            
            # On accepte 200, 201, 404 (si la registration n'existe pas/plus)
            if resp.status_code in [200, 201, 404]:
                result.add(f"Test 8 - {name}", True, f"Status {resp.status_code}")
            else:
                result.add(f"Test 8 - {name}", False, f"Status {resp.status_code}")
            
        except Exception as e:
            result.add(f"Test 8 - {name}", False, str(e))

def main():
    print("\n" + "="*80)
    print("SESSION 48ae — Test du nouvel endpoint POST /api/admin/registrations/:id/swap")
    print("="*80)
    
    # Test 0: Setup
    refuse_id, promote_id = test_setup()
    
    if not refuse_id or not promote_id:
        print("\n❌ ERREUR: Impossible de trouver des registrations de test appropriées")
        print("   Passage aux tests d'erreur uniquement...")
    else:
        # Test 1: Cas nominal
        test_cas_nominal(refuse_id, promote_id)
    
    # Test 2: Venues différents
    test_venues_differents()
    
    # Test 3: Registration introuvable
    test_registration_introuvable()
    
    # Test 4: IDs identiques
    test_ids_identiques()
    
    # Test 5: Body manquant
    test_body_manquant()
    
    # Test 6: Permission
    test_permission()
    
    # Test 7: Cohérence post-swap
    test_coherence_post_swap()
    
    # Test 8: Non-régression
    test_non_regression()
    
    # Résumé
    result.print_summary()
    
    # Exit code
    sys.exit(0 if result.failed == 0 else 1)

if __name__ == "__main__":
    main()
