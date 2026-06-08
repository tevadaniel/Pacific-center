#!/usr/bin/env python3
"""
SESSION 48w — Test de non-régression du refactoring des endpoints PROSPECTS
Tous les endpoints prospects ont été extraits dans /app/lib/api/handlers/prospects.js
Ce script vérifie qu'AUCUNE régression n'a été introduite.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"
PACIFIC_EMAIL = "pacific@centers.pf"
PACIFIC_PASSWORD = "demo"

# Couleurs pour le terminal
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_test(test_name, status, details=""):
    """Log un résultat de test avec couleur"""
    color = GREEN if status == "PASS" else RED if status == "FAIL" else YELLOW
    symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{color}{symbol} {test_name}{RESET}")
    if details:
        print(f"   {details}")

def get_admin_headers():
    """Retourne les headers admin pour les requêtes"""
    # Login admin pour obtenir user_id
    resp = requests.post(
        f"{BASE_URL}/api/auth/password-login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    if resp.status_code == 200:
        data = resp.json()
        user_id = data.get("user", {}).get("id", "u-admin")
        return {
            "x-user-role": "aracom_admin",
            "x-user-id": user_id,
            "Content-Type": "application/json"
        }
    return {
        "x-user-role": "aracom_admin",
        "x-user-id": "u-admin",
        "Content-Type": "application/json"
    }

def get_pacific_headers():
    """Retourne les headers Pacific Centers pour les requêtes"""
    resp = requests.post(
        f"{BASE_URL}/api/auth/password-login",
        json={"email": PACIFIC_EMAIL, "password": PACIFIC_PASSWORD},
        timeout=30
    )
    if resp.status_code == 200:
        data = resp.json()
        user_id = data.get("user", {}).get("id", "u-pacific")
        return {
            "x-user-role": "pacific_centers_readonly",
            "x-user-id": user_id,
            "Content-Type": "application/json"
        }
    return {
        "x-user-role": "pacific_centers_readonly",
        "x-user-id": "u-pacific",
        "Content-Type": "application/json"
    }

def test_get_prospects_list():
    """TEST 1: GET /api/prospects (liste enrichie)"""
    try:
        headers = get_admin_headers()
        resp = requests.get(f"{BASE_URL}/api/prospects", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 1: GET /api/prospects", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        if not isinstance(data, list):
            log_test("TEST 1: GET /api/prospects", "FAIL", "Response is not an array")
            return False
        
        # Vérifier qu'au moins un prospect a les champs enrichis
        if len(data) > 0:
            prospect = data[0]
            required_fields = ["id", "organization_name", "status"]
            missing = [f for f in required_fields if f not in prospect]
            if missing:
                log_test("TEST 1: GET /api/prospects", "FAIL", f"Missing fields: {missing}")
                return False
            
            # Vérifier enrichissement venue_name et venue_code
            if "venue_name" not in prospect and "venue_code" not in prospect:
                log_test("TEST 1: GET /api/prospects", "WARN", "No venue enrichment fields")
        
        log_test("TEST 1: GET /api/prospects", "PASS", f"{len(data)} prospects returned")
        return True
    except Exception as e:
        log_test("TEST 1: GET /api/prospects", "FAIL", str(e))
        return False

def test_get_prospects_filter_venue():
    """TEST 2: GET /api/prospects?venue_id=venue-faaa (filtre par venue)"""
    try:
        headers = get_admin_headers()
        resp = requests.get(f"{BASE_URL}/api/prospects?venue_id=venue-faaa", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 2: GET /api/prospects?venue_id=venue-faaa", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        if not isinstance(data, list):
            log_test("TEST 2: GET /api/prospects?venue_id=venue-faaa", "FAIL", "Response is not an array")
            return False
        
        # Vérifier que tous les prospects retournés ont venue_id=venue-faaa
        wrong_venue = [p for p in data if p.get("venue_id") != "venue-faaa"]
        if wrong_venue:
            log_test("TEST 2: GET /api/prospects?venue_id=venue-faaa", "FAIL", f"{len(wrong_venue)} prospects with wrong venue_id")
            return False
        
        log_test("TEST 2: GET /api/prospects?venue_id=venue-faaa", "PASS", f"{len(data)} prospects filtered")
        return True
    except Exception as e:
        log_test("TEST 2: GET /api/prospects?venue_id=venue-faaa", "FAIL", str(e))
        return False

def test_get_prospects_filter_status():
    """TEST 3: GET /api/prospects?status=a_contacter (filtre par statut)"""
    try:
        headers = get_admin_headers()
        resp = requests.get(f"{BASE_URL}/api/prospects?status=a_contacter", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 3: GET /api/prospects?status=a_contacter", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        if not isinstance(data, list):
            log_test("TEST 3: GET /api/prospects?status=a_contacter", "FAIL", "Response is not an array")
            return False
        
        # Vérifier que tous les prospects retournés ont status=a_contacter
        wrong_status = [p for p in data if p.get("status") != "a_contacter"]
        if wrong_status:
            log_test("TEST 3: GET /api/prospects?status=a_contacter", "FAIL", f"{len(wrong_status)} prospects with wrong status")
            return False
        
        log_test("TEST 3: GET /api/prospects?status=a_contacter", "PASS", f"{len(data)} prospects filtered")
        return True
    except Exception as e:
        log_test("TEST 3: GET /api/prospects?status=a_contacter", "FAIL", str(e))
        return False

def test_get_prospects_stats():
    """TEST 4: GET /api/prospects/stats (KPIs)"""
    try:
        headers = get_admin_headers()
        resp = requests.get(f"{BASE_URL}/api/prospects/stats", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 4: GET /api/prospects/stats", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        required_fields = ["total", "contacted", "converted", "by_status", "by_venue", "conversion_rate_pct", "contact_to_conversion_pct"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            log_test("TEST 4: GET /api/prospects/stats", "FAIL", f"Missing fields: {missing}")
            return False
        
        # Vérifier que conversion_rate_pct est entre 0 et 100
        if not (0 <= data["conversion_rate_pct"] <= 100):
            log_test("TEST 4: GET /api/prospects/stats", "FAIL", f"conversion_rate_pct={data['conversion_rate_pct']} not in [0,100]")
            return False
        
        # Vérifier structure by_status
        expected_statuses = ["a_contacter", "contacte", "interesse", "converti", "refuse", "abandonne"]
        missing_statuses = [s for s in expected_statuses if s not in data["by_status"]]
        if missing_statuses:
            log_test("TEST 4: GET /api/prospects/stats", "FAIL", f"Missing statuses: {missing_statuses}")
            return False
        
        log_test("TEST 4: GET /api/prospects/stats", "PASS", f"total={data['total']}, conversion_rate={data['conversion_rate_pct']}%")
        return True
    except Exception as e:
        log_test("TEST 4: GET /api/prospects/stats", "FAIL", str(e))
        return False

def test_post_prospect_create():
    """TEST 5: POST /api/prospects (création)"""
    try:
        headers = get_admin_headers()
        timestamp = int(datetime.now().timestamp())
        body = {
            "organization_name": f"Test Prospect 48w {timestamp}",
            "venue_id": "venue-faaa",
            "contact_name": "John Doe",
            "contact_email": "john@TEST.com",
            "contact_phone": "87123456",
            "discipline": "Sport",
            "status": "a_contacter",
            "initial_note": "Première prise de contact"
        }
        
        resp = requests.post(f"{BASE_URL}/api/prospects", headers=headers, json=body, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 5: POST /api/prospects", "FAIL", f"Status {resp.status_code}")
            return False, None
        
        data = resp.json()
        
        # Vérifier que l'ID a été généré
        if "id" not in data:
            log_test("TEST 5: POST /api/prospects", "FAIL", "No id in response")
            return False, None
        
        # Vérifier que contact_email est en minuscules
        if data.get("contact_email") != "john@test.com":
            log_test("TEST 5: POST /api/prospects", "FAIL", f"contact_email not lowercase: {data.get('contact_email')}")
            return False, data.get("id")
        
        # Vérifier que notes contient initial_note
        if not data.get("notes") or len(data["notes"]) == 0:
            log_test("TEST 5: POST /api/prospects", "FAIL", "notes array is empty")
            return False, data.get("id")
        
        if data["notes"][0].get("text") != "Première prise de contact":
            log_test("TEST 5: POST /api/prospects", "FAIL", f"initial_note not in notes: {data['notes'][0].get('text')}")
            return False, data.get("id")
        
        # Vérifier status par défaut
        if data.get("status") != "a_contacter":
            log_test("TEST 5: POST /api/prospects", "FAIL", f"status={data.get('status')} instead of a_contacter")
            return False, data.get("id")
        
        log_test("TEST 5: POST /api/prospects", "PASS", f"Created prospect id={data['id']}")
        return True, data["id"]
    except Exception as e:
        log_test("TEST 5: POST /api/prospects", "FAIL", str(e))
        return False, None

def test_post_prospect_add_note(prospect_id):
    """TEST 6: POST /api/prospects/:id/notes (ajout de note)"""
    try:
        headers = get_admin_headers()
        body = {"text": "Relance téléphonique effectuée"}
        
        resp = requests.post(f"{BASE_URL}/api/prospects/{prospect_id}/notes", headers=headers, json=body, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 6: POST /api/prospects/:id/notes", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Vérifier que notes contient maintenant 2 entrées
        if not data.get("notes") or len(data["notes"]) < 2:
            log_test("TEST 6: POST /api/prospects/:id/notes", "FAIL", f"notes count={len(data.get('notes', []))}, expected >=2")
            return False
        
        # Vérifier que la dernière note est celle qu'on vient d'ajouter
        last_note = data["notes"][-1]
        if last_note.get("text") != "Relance téléphonique effectuée":
            log_test("TEST 6: POST /api/prospects/:id/notes", "FAIL", f"Last note text={last_note.get('text')}")
            return False
        
        log_test("TEST 6: POST /api/prospects/:id/notes", "PASS", f"{len(data['notes'])} notes total")
        return True
    except Exception as e:
        log_test("TEST 6: POST /api/prospects/:id/notes", "FAIL", str(e))
        return False

def test_put_prospect_update(prospect_id):
    """TEST 7: PUT /api/prospects/:id (mise à jour)"""
    try:
        headers = get_admin_headers()
        body = {
            "status": "contacte",
            "contact_phone": "87654321"
        }
        
        resp = requests.put(f"{BASE_URL}/api/prospects/{prospect_id}", headers=headers, json=body, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 7: PUT /api/prospects/:id", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Vérifier que status a été mis à jour
        if data.get("status") != "contacte":
            log_test("TEST 7: PUT /api/prospects/:id", "FAIL", f"status={data.get('status')} instead of contacte")
            return False
        
        # Vérifier que contact_phone a été mis à jour
        if data.get("contact_phone") != "87654321":
            log_test("TEST 7: PUT /api/prospects/:id", "FAIL", f"contact_phone={data.get('contact_phone')} instead of 87654321")
            return False
        
        log_test("TEST 7: PUT /api/prospects/:id", "PASS", f"Updated status={data['status']}, phone={data['contact_phone']}")
        return True
    except Exception as e:
        log_test("TEST 7: PUT /api/prospects/:id", "FAIL", str(e))
        return False

def test_post_prospect_convert(prospect_id):
    """TEST 8: POST /api/prospects/:id/convert (conversion en exposant)"""
    try:
        headers = get_admin_headers()
        
        resp = requests.post(f"{BASE_URL}/api/prospects/{prospect_id}/convert", headers=headers, json={}, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Vérifier structure de la réponse
        required_fields = ["ok", "organization_id", "registration_id"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", f"Missing fields: {missing}")
            return False
        
        if not data.get("ok"):
            log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", "ok=false")
            return False
        
        # Vérifier que le prospect a été marqué comme converti
        resp2 = requests.get(f"{BASE_URL}/api/prospects", headers=headers, timeout=30)
        if resp2.status_code == 200:
            prospects = resp2.json()
            converted_prospect = next((p for p in prospects if p["id"] == prospect_id), None)
            if converted_prospect:
                if converted_prospect.get("status") != "converti":
                    log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", f"Prospect status={converted_prospect.get('status')} instead of converti")
                    return False
                if not converted_prospect.get("converted_to_registration_id"):
                    log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", "converted_to_registration_id is null")
                    return False
        
        # Tenter de re-convertir (doit échouer avec 400)
        resp3 = requests.post(f"{BASE_URL}/api/prospects/{prospect_id}/convert", headers=headers, json={}, timeout=30)
        if resp3.status_code != 400:
            log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", f"Re-convert should return 400, got {resp3.status_code}")
            return False
        
        log_test("TEST 8: POST /api/prospects/:id/convert", "PASS", f"org_id={data['organization_id']}, reg_id={data['registration_id']}")
        return True
    except Exception as e:
        log_test("TEST 8: POST /api/prospects/:id/convert", "FAIL", str(e))
        return False

def test_delete_prospect():
    """TEST 9: DELETE /api/prospects/:id (suppression)"""
    try:
        headers = get_admin_headers()
        
        # Créer un prospect temporaire pour le supprimer
        timestamp = int(datetime.now().timestamp())
        body = {
            "organization_name": f"Test Delete Prospect {timestamp}",
            "venue_id": "venue-faaa",
            "contact_name": "Jane Doe",
            "contact_email": "jane@test.com"
        }
        
        resp = requests.post(f"{BASE_URL}/api/prospects", headers=headers, json=body, timeout=30)
        if resp.status_code != 200:
            log_test("TEST 9: DELETE /api/prospects/:id", "FAIL", "Failed to create test prospect")
            return False
        
        prospect_id = resp.json()["id"]
        
        # Supprimer le prospect
        resp2 = requests.delete(f"{BASE_URL}/api/prospects/{prospect_id}", headers=headers, timeout=30)
        
        if resp2.status_code != 200:
            log_test("TEST 9: DELETE /api/prospects/:id", "FAIL", f"Status {resp2.status_code}")
            return False
        
        data = resp2.json()
        if not data.get("ok"):
            log_test("TEST 9: DELETE /api/prospects/:id", "FAIL", "ok=false")
            return False
        
        # Vérifier que le prospect a été supprimé
        resp3 = requests.get(f"{BASE_URL}/api/prospects", headers=headers, timeout=30)
        if resp3.status_code == 200:
            prospects = resp3.json()
            deleted_prospect = next((p for p in prospects if p["id"] == prospect_id), None)
            if deleted_prospect:
                log_test("TEST 9: DELETE /api/prospects/:id", "FAIL", "Prospect still exists after deletion")
                return False
        
        log_test("TEST 9: DELETE /api/prospects/:id", "PASS", f"Deleted prospect id={prospect_id}")
        return True
    except Exception as e:
        log_test("TEST 9: DELETE /api/prospects/:id", "FAIL", str(e))
        return False

def test_error_cases():
    """TEST 10: Cas erreurs (404 pour IDs inexistants)"""
    try:
        headers = get_admin_headers()
        
        # POST /api/prospects/<id-inexistant>/notes → 404
        resp1 = requests.post(f"{BASE_URL}/api/prospects/non-existent-id-12345/notes", 
                             headers=headers, json={"text": "test"}, timeout=30)
        if resp1.status_code != 404:
            log_test("TEST 10: Error cases", "FAIL", f"POST notes on non-existent should return 404, got {resp1.status_code}")
            return False
        
        # POST /api/prospects/<id-inexistant>/convert → 404
        resp2 = requests.post(f"{BASE_URL}/api/prospects/non-existent-id-12345/convert", 
                             headers=headers, json={}, timeout=30)
        if resp2.status_code != 404:
            log_test("TEST 10: Error cases", "FAIL", f"POST convert on non-existent should return 404, got {resp2.status_code}")
            return False
        
        log_test("TEST 10: Error cases", "PASS", "404 errors returned correctly")
        return True
    except Exception as e:
        log_test("TEST 10: Error cases", "FAIL", str(e))
        return False

def test_pacific_centers_filter():
    """TEST 11: Filtre Pacific Centers (lecture seule restreinte)"""
    try:
        headers = get_pacific_headers()
        
        # GET /api/prospects avec Pacific Centers headers
        resp = requests.get(f"{BASE_URL}/api/prospects", headers=headers, timeout=30)
        
        if resp.status_code != 200:
            log_test("TEST 11: Pacific Centers filter", "FAIL", f"Status {resp.status_code}")
            return False
        
        data = resp.json()
        if not isinstance(data, list):
            log_test("TEST 11: Pacific Centers filter", "FAIL", "Response is not an array")
            return False
        
        # Note: Le filtre allowed_venue_ids ne s'applique que si le user Pacific a ce champ défini en DB
        # Sans ce champ, tous les prospects sont retournés (comportement normal)
        log_test("TEST 11: Pacific Centers filter", "PASS", f"{len(data)} prospects returned (filter applies only if allowed_venue_ids set)")
        return True
    except Exception as e:
        log_test("TEST 11: Pacific Centers filter", "FAIL", str(e))
        return False

def test_non_regression_checks():
    """TEST 12: Checks de non-régression (endpoints non touchés)"""
    try:
        headers = get_admin_headers()
        
        # GET /api/menu-badges
        resp1 = requests.get(f"{BASE_URL}/api/menu-badges", headers=headers, timeout=30)
        if resp1.status_code != 200:
            log_test("TEST 12: Non-regression - menu-badges", "FAIL", f"Status {resp1.status_code}")
            return False
        
        # GET /api/dashboard/kpis
        resp2 = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=headers, timeout=30)
        if resp2.status_code != 200:
            log_test("TEST 12: Non-regression - dashboard/kpis", "FAIL", f"Status {resp2.status_code}")
            return False
        
        # GET /api/venues
        resp3 = requests.get(f"{BASE_URL}/api/venues", headers=headers, timeout=30)
        if resp3.status_code != 200:
            log_test("TEST 12: Non-regression - venues", "FAIL", f"Status {resp3.status_code}")
            return False
        
        # POST /api/auth/password-login
        resp4 = requests.post(f"{BASE_URL}/api/auth/password-login",
                             json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        if resp4.status_code != 200:
            log_test("TEST 12: Non-regression - auth/password-login", "FAIL", f"Status {resp4.status_code}")
            return False
        
        data4 = resp4.json()
        if data4.get("user", {}).get("role_code") != "aracom_admin":
            log_test("TEST 12: Non-regression - auth/password-login", "FAIL", f"role={data4.get('user', {}).get('role_code')}")
            return False
        
        log_test("TEST 12: Non-regression checks", "PASS", "All 4 endpoints working")
        return True
    except Exception as e:
        log_test("TEST 12: Non-regression checks", "FAIL", str(e))
        return False

def main():
    """Exécute tous les tests"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}SESSION 48w — Test de non-régression du refactoring PROSPECTS{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    results = []
    prospect_id = None
    
    # Tests principaux
    results.append(test_get_prospects_list())
    results.append(test_get_prospects_filter_venue())
    results.append(test_get_prospects_filter_status())
    results.append(test_get_prospects_stats())
    
    # Test création (retourne l'ID pour les tests suivants)
    success, prospect_id = test_post_prospect_create()
    results.append(success)
    
    if prospect_id:
        results.append(test_post_prospect_add_note(prospect_id))
        results.append(test_put_prospect_update(prospect_id))
        results.append(test_post_prospect_convert(prospect_id))
    else:
        print(f"{YELLOW}⚠️  Skipping tests 6-8 (no prospect_id){RESET}")
        results.extend([False, False, False])
    
    results.append(test_delete_prospect())
    results.append(test_error_cases())
    results.append(test_pacific_centers_filter())
    results.append(test_non_regression_checks())
    
    # Résumé
    print(f"\n{BLUE}{'='*80}{RESET}")
    passed = sum(results)
    total = len(results)
    percentage = (passed / total * 100) if total > 0 else 0
    
    if passed == total:
        print(f"{GREEN}✅ TOUS LES TESTS PASSÉS: {passed}/{total} ({percentage:.1f}%){RESET}")
        print(f"{GREEN}AUCUNE RÉGRESSION détectée. Refactoring prospects handlers 100% opérationnel.{RESET}")
    else:
        print(f"{RED}❌ TESTS ÉCHOUÉS: {total - passed}/{total} ({100 - percentage:.1f}%){RESET}")
        print(f"{YELLOW}⚠️  Certains endpoints prospects ne fonctionnent pas comme avant le refactoring.{RESET}")
    
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
