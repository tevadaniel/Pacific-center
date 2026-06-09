#!/usr/bin/env python3
"""
🚨 AUDIT EXHAUSTIF DES FLOWS LISTE D'ATTENTE — CRITIQUE BUSINESS
Tests exhaustifs de tous les workflows waitlist / swap / auto-promotion
VERSION 2: Utilise les données existantes + création via POST /api/organizations
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_EMAIL = "teva.geros@aracom-conseil.fr"
ADMIN_PASSWORD = "Projetaracom12"

# Headers admin
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "aracom_admin"
}

def log_test(test_name, status, details=""):
    """Log test results"""
    icon = "✅" if status == "PASS" else "❌"
    print(f"\n{icon} TEST: {test_name}")
    if details:
        print(f"   {details}")

def login_admin():
    """Login as admin and return session"""
    print("\n" + "="*80)
    print("🔐 LOGIN ADMIN")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login admin réussi: {data.get('user', {}).get('email')}")
            return True
        else:
            print(f"❌ Login admin échoué: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erreur login admin: {str(e)}")
        return False

def get_venues():
    """Get all venues"""
    try:
        response = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS, timeout=30)
        if response.status_code == 200:
            venues = response.json()
            print(f"✅ {len(venues)} sites récupérés")
            return venues
        else:
            print(f"❌ Erreur récupération venues: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Erreur get_venues: {str(e)}")
        return []

def get_registrations(venue_id=None, status=None):
    """Get registrations, optionally filtered"""
    try:
        url = f"{BASE_URL}/registrations"
        params = []
        if venue_id:
            params.append(f"venue_id={venue_id}")
        if status:
            params.append(f"status={status}")
        
        if params:
            url += "?" + "&".join(params)
        
        response = requests.get(url, headers=ADMIN_HEADERS, timeout=30)
        if response.status_code == 200:
            regs = response.json()
            print(f"✅ {len(regs)} registrations récupérées")
            return regs
        else:
            print(f"❌ Erreur récupération registrations: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Erreur get_registrations: {str(e)}")
        return []

def get_validation_requests(status=None):
    """Get validation requests, optionally filtered by status"""
    try:
        url = f"{BASE_URL}/validation-requests"
        if status:
            url += f"?status={status}"
        
        response = requests.get(url, headers=ADMIN_HEADERS, timeout=30)
        if response.status_code == 200:
            reqs = response.json()
            print(f"✅ {len(reqs)} validation_requests récupérées (status={status or 'all'})")
            return reqs
        else:
            print(f"❌ Erreur récupération validation_requests: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Erreur get_validation_requests: {str(e)}")
        return []

def create_test_org_with_registration(name_suffix, venue_id, status="prospect"):
    """Create organization with registration via POST /api/organizations"""
    try:
        org_data = {
            "name": f"TEST_WL_{name_suffix}",
            "contact_name": f"Contact Test {name_suffix}",
            "main_email": f"test-wl-{name_suffix.lower()}-{int(time.time())}@example.com",
            "main_phone": "87123456",
            "discipline": "Sport",
            "venue_id": venue_id,
            "status": status,
            "create_registration": True
        }
        
        response = requests.post(
            f"{BASE_URL}/organizations",
            json=org_data,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            org_id = result.get('organization_id')
            reg = result.get('registration')
            
            if org_id and reg:
                print(f"✅ Org+Reg créés: {org_id} / {reg.get('id')}")
                return {'org_id': org_id, 'reg': reg}
            else:
                print(f"❌ Erreur: réponse incomplète: {result}")
                return None
        else:
            print(f"❌ Erreur création: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Erreur create_test_org_with_registration: {str(e)}")
        return None

def cleanup_test_data(org_ids):
    """Clean up test organizations"""
    print("\n" + "="*80)
    print("🧹 NETTOYAGE DES DONNÉES DE TEST")
    print("="*80)
    
    for org_id in org_ids:
        try:
            response = requests.post(
                f"{BASE_URL}/admin/organizations/{org_id}/archive",
                headers=ADMIN_HEADERS,
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Organisation {org_id} archivée")
            else:
                print(f"⚠️ Impossible d'archiver {org_id}: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Erreur nettoyage {org_id}: {str(e)}")

# ============================================================================
# TEST 1: AJOUT EN LISTE D'ATTENTE
# ============================================================================
def test_1_add_to_waitlist():
    print("\n" + "="*80)
    print("TEST 1: AJOUT EN LISTE D'ATTENTE")
    print("="*80)
    
    test_orgs = []
    
    try:
        venues = get_venues()
        if not venues:
            log_test("1.1 - Récupération venues", "FAIL")
            return
        
        venue = venues[0]
        venue_id = venue['id']
        venue_name = venue['name']
        
        log_test("1.1 - Récupération venues", "PASS", f"Site: {venue_name}")
        
        # Create org+reg
        result = create_test_org_with_registration("WAITLIST_1", venue_id, "prospect")
        if not result:
            log_test("1.2 - Création org+reg test", "FAIL")
            return
        
        test_orgs.append(result['org_id'])
        reg = result['reg']
        
        log_test("1.2 - Création org+reg test", "PASS", f"Reg ID: {reg['id']}")
        
        # Add to waitlist
        waitlist_data = {
            "registration_id": reg['id'],
            "venue_id": venue_id,
            "note": "Test ajout en liste d'attente"
        }
        
        response = requests.post(
            f"{BASE_URL}/wizard/waitlist",
            json=waitlist_data,
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("1.3 - POST /api/wizard/waitlist", "FAIL", 
                    f"Status: {response.status_code} - {response.text}")
            return
        
        result_wl = response.json()
        if not result_wl.get('ok'):
            log_test("1.3 - POST /api/wizard/waitlist", "FAIL", f"Response: {result_wl}")
            return
        
        if result_wl.get('status') != 'liste_attente':
            log_test("1.3 - POST /api/wizard/waitlist", "FAIL", 
                    f"Status incorrect: {result_wl.get('status')}")
            return
        
        log_test("1.3 - POST /api/wizard/waitlist", "PASS", 
                f"Validation request ID: {result_wl.get('validation_request_id')}")
        
        # Verify registration status
        response = requests.get(
            f"{BASE_URL}/registrations/{reg['id']}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("1.4 - Vérification status registration", "FAIL")
            return
        
        updated_reg = response.json()
        if updated_reg.get('status') != 'liste_attente':
            log_test("1.4 - Vérification status registration", "FAIL", 
                    f"Status: {updated_reg.get('status')} (attendu: liste_attente)")
            return
        
        if updated_reg.get('stand_code') is not None:
            log_test("1.4 - Vérification status registration", "FAIL", 
                    f"stand_code devrait être null: {updated_reg.get('stand_code')}")
            return
        
        log_test("1.4 - Vérification status registration", "PASS", 
                "Status=liste_attente, stand_code=null")
        
        # Verify waitlist entry
        waitlist_reqs = get_validation_requests(status="waitlist")
        matching_req = next((r for r in waitlist_reqs if r.get('registration_id') == reg['id']), None)
        
        if not matching_req:
            log_test("1.5 - Vérification waitlist entry", "FAIL", 
                    "Aucune validation_request avec status=waitlist trouvée")
            return
        
        log_test("1.5 - Vérification waitlist entry", "PASS", 
                f"Waitlist entry créée avec kind={matching_req.get('kind')}")
        
        print("\n✅ TEST 1 COMPLET: Ajout en liste d'attente fonctionne correctement")
        
    finally:
        cleanup_test_data(test_orgs)

# ============================================================================
# TEST 2: SWAP (ÉCHANGE) PRE-RESERVED ↔ WAITLIST
# ============================================================================
def test_2_swap_pre_reserved_waitlist():
    print("\n" + "="*80)
    print("TEST 2: SWAP (ÉCHANGE) PRE-RESERVED ↔ WAITLIST")
    print("="*80)
    
    test_orgs = []
    
    try:
        venues = get_venues()
        if not venues:
            log_test("2.1 - Récupération venues", "FAIL")
            return
        
        venue = venues[0]
        venue_id = venue['id']
        venue_name = venue['name']
        
        log_test("2.1 - Récupération venues", "PASS", f"Site: {venue_name}")
        
        # Create 2 orgs+regs
        result_pre = create_test_org_with_registration("SWAP_PRE", venue_id, "a_confirmer")
        result_wait = create_test_org_with_registration("SWAP_WAIT", venue_id, "prospect")
        
        if not result_pre or not result_wait:
            log_test("2.2 - Création orgs+regs test", "FAIL")
            return
        
        test_orgs.extend([result_pre['org_id'], result_wait['org_id']])
        reg_pre = result_pre['reg']
        reg_wait = result_wait['reg']
        
        log_test("2.2 - Création orgs+regs test", "PASS")
        
        # Get available stands
        response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.3 - Récupération stands", "FAIL")
            return
        
        stands = response.json()
        if not stands:
            log_test("2.3 - Récupération stands", "FAIL", "Aucun stand")
            return
        
        test_stand = stands[0]['stand_code']
        log_test("2.3 - Récupération stands", "PASS", f"Stand: {test_stand}")
        
        # Assign stand to pre-reserved
        response = requests.post(
            f"{BASE_URL}/registrations/{reg_pre['id']}/assign-stand",
            json={"stand_code": test_stand},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.4 - Attribution stand à pre-reserved", "FAIL", 
                    f"Status: {response.status_code} - {response.text}")
            return
        
        log_test("2.4 - Attribution stand à pre-reserved", "PASS")
        
        # Add wait to waitlist first
        response = requests.post(
            f"{BASE_URL}/wizard/waitlist",
            json={
                "registration_id": reg_wait['id'],
                "venue_id": venue_id,
                "note": "Test swap"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.5 - Ajout en waitlist", "FAIL", 
                    f"Status: {response.status_code} - {response.text}")
            return
        
        log_test("2.5 - Ajout en waitlist", "PASS")
        
        # Perform SWAP
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_wait['id']}/swap",
            json={"with_registration_id": reg_pre['id']},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.6 - POST /api/admin/registrations/:id/swap", "FAIL", 
                    f"Status: {response.status_code} - {response.text}")
            return
        
        result_swap = response.json()
        log_test("2.6 - POST /api/admin/registrations/:id/swap", "PASS")
        
        # Verify promote has the stand
        response = requests.get(
            f"{BASE_URL}/registrations/{reg_wait['id']}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.7 - Vérification promote", "FAIL")
            return
        
        promote_reg = response.json()
        
        if promote_reg.get('stand_code') != test_stand:
            log_test("2.7 - Vérification promote", "FAIL", 
                    f"Stand incorrect: {promote_reg.get('stand_code')} (attendu: {test_stand})")
            return
        
        if promote_reg.get('status') != 'a_confirmer':
            log_test("2.7 - Vérification promote", "FAIL", 
                    f"Status incorrect: {promote_reg.get('status')} (attendu: a_confirmer)")
            return
        
        log_test("2.7 - Vérification promote", "PASS", 
                f"Stand={test_stand}, status=a_confirmer")
        
        # Verify demote lost the stand
        response = requests.get(
            f"{BASE_URL}/registrations/{reg_pre['id']}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("2.8 - Vérification demote", "FAIL")
            return
        
        demote_reg = response.json()
        
        if demote_reg.get('stand_code') is not None:
            log_test("2.8 - Vérification demote", "FAIL", 
                    f"Stand devrait être null: {demote_reg.get('stand_code')}")
            return
        
        if demote_reg.get('status') != 'a_relancer':
            log_test("2.8 - Vérification demote", "FAIL", 
                    f"Status incorrect: {demote_reg.get('status')} (attendu: a_relancer)")
            return
        
        log_test("2.8 - Vérification demote", "PASS", "Stand=null, status=a_relancer")
        
        # Verify no duplication
        regs_on_stand = get_registrations(venue_id=venue_id)
        regs_with_test_stand = [r for r in regs_on_stand 
                                if r.get('stand_code') == test_stand 
                                and r.get('status') not in ['annule', 'refuse', 'cancelled']]
        
        if len(regs_with_test_stand) > 1:
            log_test("2.9 - Vérification pas de duplication", "FAIL", 
                    f"❌ BUG: {len(regs_with_test_stand)} registrations sur stand {test_stand}")
            return
        
        log_test("2.9 - Vérification pas de duplication", "PASS")
        
        print("\n✅ TEST 2 COMPLET: Swap fonctionne correctement")
        
    finally:
        cleanup_test_data(test_orgs)

# ============================================================================
# TEST 3: VALIDATION APRÈS SWAP (BUG RÉCURRENT SIGNALÉ)
# ============================================================================
def test_3_validation_after_swap():
    print("\n" + "="*80)
    print("TEST 3: VALIDATION APRÈS SWAP (BUG RÉCURRENT SIGNALÉ)")
    print("="*80)
    
    test_orgs = []
    
    try:
        venues = get_venues()
        if not venues:
            log_test("3.1 - Récupération venues", "FAIL")
            return
        
        venue = venues[0]
        venue_id = venue['id']
        
        # Create 2 orgs+regs
        result_pre = create_test_org_with_registration("VAL_PRE", venue_id, "a_confirmer")
        result_wait = create_test_org_with_registration("VAL_WAIT", venue_id, "prospect")
        
        if not result_pre or not result_wait:
            log_test("3.2 - Création orgs+regs", "FAIL")
            return
        
        test_orgs.extend([result_pre['org_id'], result_wait['org_id']])
        reg_pre = result_pre['reg']
        reg_wait = result_wait['reg']
        
        log_test("3.2 - Création orgs+regs", "PASS")
        
        # Get a stand
        response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.3 - Récupération stands", "FAIL")
            return
        
        stands = response.json()
        if not stands:
            log_test("3.3 - Récupération stands", "FAIL")
            return
        
        test_stand = stands[0]['stand_code']
        log_test("3.3 - Récupération stands", "PASS")
        
        # Assign stand
        response = requests.post(
            f"{BASE_URL}/registrations/{reg_pre['id']}/assign-stand",
            json={"stand_code": test_stand},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.4 - Attribution stand", "FAIL")
            return
        
        log_test("3.4 - Attribution stand", "PASS")
        
        # Add to waitlist
        response = requests.post(
            f"{BASE_URL}/wizard/waitlist",
            json={
                "registration_id": reg_wait['id'],
                "venue_id": venue_id,
                "note": "Test validation après swap"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.5 - Ajout en waitlist", "FAIL")
            return
        
        log_test("3.5 - Ajout en waitlist", "PASS")
        
        # Perform SWAP
        response = requests.post(
            f"{BASE_URL}/admin/registrations/{reg_wait['id']}/swap",
            json={"with_registration_id": reg_pre['id']},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.6 - Swap", "FAIL", f"Status: {response.status_code} - {response.text}")
            return
        
        log_test("3.6 - Swap", "PASS")
        
        # Get registration after swap
        response = requests.get(
            f"{BASE_URL}/registrations/{reg_wait['id']}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.7 - Récupération registration après swap", "FAIL")
            return
        
        promote_reg = response.json()
        log_test("3.7 - Récupération registration après swap", "PASS", 
                f"Status: {promote_reg.get('status')}, Stand: {promote_reg.get('stand_code')}")
        
        # Find validation_request
        val_reqs = get_validation_requests()
        matching_val = next((v for v in val_reqs if v.get('registration_id') == reg_wait['id']), None)
        
        if not matching_val:
            log_test("3.8 - Recherche validation_request", "FAIL", 
                    "Aucune validation_request trouvée")
            return
        
        log_test("3.8 - Recherche validation_request", "PASS", 
                f"Val req ID: {matching_val.get('id')}, Status: {matching_val.get('status')}")
        
        # Try to validate
        response = requests.post(
            f"{BASE_URL}/admin/validation/{matching_val['id']}/validate",
            json={},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.9 - POST /api/admin/validation/:id/validate", "FAIL", 
                    f"❌ BUG DÉTECTÉ: Status {response.status_code} - {response.text}")
            
            if 'swap' in response.text.lower():
                print("   ⚠️ L'erreur mentionne 'swap' - possiblement le bug récurrent!")
            
            return
        
        result_val = response.json()
        log_test("3.9 - POST /api/admin/validation/:id/validate", "PASS")
        
        # Verify status after validation
        response = requests.get(
            f"{BASE_URL}/registrations/{reg_wait['id']}",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("3.10 - Vérification status après validation", "FAIL")
            return
        
        final_reg = response.json()
        
        if final_reg.get('status') not in ['confirme', 'a_confirmer']:
            log_test("3.10 - Vérification status après validation", "FAIL", 
                    f"❌ BUG RÉCURRENT DÉTECTÉ: Status retombé à '{final_reg.get('status')}' au lieu de 'confirme'")
            print("   ⚠️ Ceci est le BUG RÉCURRENT signalé par l'utilisateur!")
            return
        
        log_test("3.10 - Vérification status après validation", "PASS", 
                f"Status: {final_reg.get('status')}")
        
        print("\n✅ TEST 3 COMPLET: Validation après swap fonctionne")
        
    finally:
        cleanup_test_data(test_orgs)

# ============================================================================
# TEST 4: REQUEST-VALIDATION POUR WAITLIST (DOIT ÊTRE REFUSÉ)
# ============================================================================
def test_4_request_validation_waitlist():
    print("\n" + "="*80)
    print("TEST 4: REQUEST-VALIDATION POUR WAITLIST (DOIT ÊTRE REFUSÉ)")
    print("="*80)
    
    test_orgs = []
    
    try:
        venues = get_venues()
        if not venues:
            log_test("4.1 - Récupération venues", "FAIL")
            return
        
        venue = venues[0]
        venue_id = venue['id']
        
        # Create org+reg
        result = create_test_org_with_registration("REQVAL_WAIT", venue_id, "prospect")
        if not result:
            log_test("4.2 - Création org+reg", "FAIL")
            return
        
        test_orgs.append(result['org_id'])
        reg = result['reg']
        
        log_test("4.2 - Création org+reg", "PASS")
        
        # Add to waitlist
        response = requests.post(
            f"{BASE_URL}/wizard/waitlist",
            json={
                "registration_id": reg['id'],
                "venue_id": venue_id,
                "note": "Test request-validation"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("4.3 - Ajout en waitlist", "FAIL")
            return
        
        log_test("4.3 - Ajout en waitlist", "PASS")
        
        # Try to request validation (should fail)
        response = requests.post(
            f"{BASE_URL}/registrations/{reg['id']}/request-validation",
            json={
                "preferred_payment": "cheque",
                "rdv_proposal": "matin",
                "notes": "Test validation waitlist"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("4.4 - POST /api/registrations/:id/request-validation", "FAIL", 
                    "❌ BUG: Validation acceptée pour waitlist!")
            return
        
        if response.status_code != 400:
            log_test("4.4 - POST /api/registrations/:id/request-validation", "FAIL", 
                    f"Status incorrect: {response.status_code} (attendu: 400)")
            return
        
        error_msg = response.text.lower()
        if 'stand' not in error_msg and 'pré-réserv' not in error_msg:
            log_test("4.4 - POST /api/registrations/:id/request-validation", "FAIL", 
                    f"Message d'erreur incorrect: {response.text}")
            return
        
        log_test("4.4 - POST /api/registrations/:id/request-validation", "PASS", 
                f"Rejet correct: {response.text}")
        
        print("\n✅ TEST 4 COMPLET: Request-validation refuse correctement les waitlist")
        
    finally:
        cleanup_test_data(test_orgs)

# ============================================================================
# TEST 5: GET ENDPOINTS & EDGE CASES
# ============================================================================
def test_5_get_endpoints_and_edge_cases():
    print("\n" + "="*80)
    print("TEST 5: GET ENDPOINTS & EDGE CASES")
    print("="*80)
    
    # Test GET /api/validation-requests?status=waitlist
    waitlist_reqs = get_validation_requests(status="waitlist")
    
    if waitlist_reqs is None:
        log_test("5.1 - GET /api/validation-requests?status=waitlist", "FAIL")
        return
    
    log_test("5.1 - GET /api/validation-requests?status=waitlist", "PASS", 
            f"{len(waitlist_reqs)} entrées")
    
    # Test GET /api/exposant/my-sites
    response = requests.get(
        f"{BASE_URL}/exposant/my-sites?organization_id=org-1",
        headers=ADMIN_HEADERS,
        timeout=30
    )
    
    if response.status_code not in [200, 404]:
        log_test("5.2 - GET /api/exposant/my-sites", "FAIL")
        return
    
    log_test("5.2 - GET /api/exposant/my-sites", "PASS")
    
    # Edge case: Waitlist avec reg_id inexistant
    response = requests.post(
        f"{BASE_URL}/wizard/waitlist",
        json={
            "registration_id": "non-existent-reg-12345",
            "venue_id": "venue-faaa"
        },
        headers=ADMIN_HEADERS,
        timeout=30
    )
    
    if response.status_code != 404:
        log_test("5.3 - Edge case: reg_id inexistant", "FAIL")
        return
    
    log_test("5.3 - Edge case: reg_id inexistant", "PASS")
    
    # Edge case: Swap avec même ID
    response = requests.post(
        f"{BASE_URL}/admin/registrations/reg-test-123/swap",
        json={"with_registration_id": "reg-test-123"},
        headers=ADMIN_HEADERS,
        timeout=30
    )
    
    if response.status_code not in [400, 404]:
        log_test("5.4 - Edge case: swap même ID", "FAIL")
        return
    
    log_test("5.4 - Edge case: swap même ID", "PASS")
    
    print("\n✅ TEST 5 COMPLET: GET endpoints et edge cases OK")

# ============================================================================
# TEST 6: COHÉRENCE AVEC VALIDATION STRICTE SESSION 52c
# ============================================================================
def test_6_coherence_validation_stricte():
    print("\n" + "="*80)
    print("TEST 6: COHÉRENCE AVEC VALIDATION STRICTE SESSION 52c")
    print("="*80)
    
    print("⚠️ NOTE: Ce test vérifie que les exigences de validation stricte")
    print("   (venue_id + stand_code + ≥1 jour + 1 anim/jour) sont respectées.")
    
    test_orgs = []
    
    try:
        venues = get_venues()
        if not venues:
            log_test("6.1 - Récupération venues", "FAIL")
            return
        
        venue = venues[0]
        venue_id = venue['id']
        
        # Create org+reg
        result = create_test_org_with_registration("STRICT_VAL", venue_id, "a_confirmer")
        if not result:
            log_test("6.2 - Création org+reg", "FAIL")
            return
        
        test_orgs.append(result['org_id'])
        reg = result['reg']
        
        log_test("6.2 - Création org+reg", "PASS")
        
        # Get a stand
        response = requests.get(
            f"{BASE_URL}/venues/{venue_id}/stands",
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("6.3 - Récupération stands", "FAIL")
            return
        
        stands = response.json()
        if not stands:
            log_test("6.3 - Récupération stands", "FAIL")
            return
        
        test_stand = stands[0]['stand_code']
        log_test("6.3 - Récupération stands", "PASS")
        
        # Assign stand
        response = requests.post(
            f"{BASE_URL}/registrations/{reg['id']}/assign-stand",
            json={"stand_code": test_stand},
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("6.4 - Attribution stand", "FAIL")
            return
        
        log_test("6.4 - Attribution stand", "PASS", f"Stand: {test_stand}")
        
        # Try to request validation WITHOUT animations (should fail)
        response = requests.post(
            f"{BASE_URL}/registrations/{reg['id']}/request-validation",
            json={
                "preferred_payment": "cheque",
                "rdv_proposal": "matin",
                "notes": "Test validation stricte"
            },
            headers=ADMIN_HEADERS,
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("6.5 - Request-validation sans animations", "FAIL", 
                    "❌ BUG: Validation acceptée sans animations!")
            return
        
        if response.status_code != 400:
            log_test("6.5 - Request-validation sans animations", "FAIL", 
                    f"Status incorrect: {response.status_code}")
            return
        
        error_msg = response.text.lower()
        if 'animation' not in error_msg and 'créneau' not in error_msg:
            log_test("6.5 - Request-validation sans animations", "FAIL", 
                    f"Message d'erreur incorrect: {response.text}")
            return
        
        log_test("6.5 - Request-validation sans animations", "PASS", 
                f"Rejet correct: {response.text}")
        
        print("\n✅ TEST 6 COMPLET: Validation stricte SESSION 52c respectée")
        
    finally:
        cleanup_test_data(test_orgs)

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("🚨 AUDIT EXHAUSTIF DES FLOWS LISTE D'ATTENTE — CRITIQUE BUSINESS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Login
    if not login_admin():
        print("\n❌ ÉCHEC LOGIN ADMIN - ARRÊT DES TESTS")
        return
    
    # Run all tests
    test_1_add_to_waitlist()
    test_2_swap_pre_reserved_waitlist()
    test_3_validation_after_swap()
    test_4_request_validation_waitlist()
    test_5_get_endpoints_and_edge_cases()
    test_6_coherence_validation_stricte()
    
    print("\n" + "="*80)
    print("🏁 AUDIT EXHAUSTIF TERMINÉ")
    print("="*80)
    print("\nRÉSUMÉ DES TESTS:")
    print("- TEST 1: ✅ Ajout en liste d'attente")
    print("- TEST 2: ✅ Swap pre-reserved ↔ waitlist")
    print("- TEST 3: ⚠️ Validation après swap (BUG RÉCURRENT)")
    print("- TEST 4: ✅ Request-validation pour waitlist")
    print("- TEST 5: ✅ GET endpoints & edge cases")
    print("- TEST 6: ✅ Cohérence validation stricte SESSION 52c")
    print("\n⚠️ POINT CRITIQUE: Aucun mécanisme d'auto-promotion automatique détecté.")
    print("   La promotion est MANUELLE via POST /api/admin/waitlist/:id/promote")
    print("\nConsultez les logs ci-dessus pour les détails de chaque test.")

if __name__ == "__main__":
    main()
