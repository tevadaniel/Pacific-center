#!/usr/bin/env python3
"""
AUDIT BACKEND COMPLET — Forum de la Rentrée 2026
Tests exhaustifs de tous les endpoints critiques (session 13)
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "demo"

# Headers admin
admin_headers = {
    "x-user-id": "u-admin-aracom",
    "x-user-role": "aracom_admin",
    "Content-Type": "application/json"
}

# Compteurs de tests
tests_passed = 0
tests_failed = 0
test_results = {}

def log_test(category, test_name, passed, details=""):
    """Log un résultat de test"""
    global tests_passed, tests_failed
    if category not in test_results:
        test_results[category] = {"passed": 0, "failed": 0, "tests": []}
    
    if passed:
        tests_passed += 1
        test_results[category]["passed"] += 1
        status = "✅ PASS"
    else:
        tests_failed += 1
        test_results[category]["failed"] += 1
        status = "❌ FAIL"
    
    test_results[category]["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })
    print(f"{status} - {category} - {test_name}")
    if details and not passed:
        print(f"  └─ {details}")

def test_category_a_auth_seed():
    """A. AUTH & SEED"""
    print("\n" + "="*80)
    print("CATÉGORIE A : AUTH & SEED")
    print("="*80)
    
    # Test 1: POST /api/seed (force=false) → 200 idempotent
    try:
        r = requests.post(f"{BASE_URL}/seed", json={"force": False}, timeout=10)
        log_test("A. AUTH & SEED", "POST /seed force=false idempotent", 
                 r.status_code == 200 and "seeded" in r.json(),
                 f"Status: {r.status_code}, Response: {r.json()}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /seed force=false", False, str(e))
    
    # Test 2: POST /api/auth/login (admin) → 200
    try:
        r = requests.post(f"{BASE_URL}/auth/login", 
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, 
                         timeout=10)
        log_test("A. AUTH & SEED", "POST /auth/login admin OK", 
                 r.status_code == 200 and "user" in r.json(),
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /auth/login admin", False, str(e))
    
    # Test 3: POST /api/auth/login (mauvais password) → 401
    try:
        r = requests.post(f"{BASE_URL}/auth/login", 
                         json={"email": ADMIN_EMAIL, "password": "wrong"}, 
                         timeout=10)
        log_test("A. AUTH & SEED", "POST /auth/login mauvais password → 401", 
                 r.status_code == 401,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /auth/login mauvais password", False, str(e))
    
    # Test 4: GET /api/auth/me (avec headers admin) → 200
    try:
        r = requests.get(f"{BASE_URL}/auth/me", headers=admin_headers, timeout=10)
        log_test("A. AUTH & SEED", "GET /auth/me avec headers admin", 
                 r.status_code == 200 and "user" in r.json(),
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("A. AUTH & SEED", "GET /auth/me", False, str(e))
    
    # Test 5: POST /api/auth/register → 403 (inscription désactivée)
    try:
        r = requests.post(f"{BASE_URL}/auth/register", 
                         json={"email": "test@test.com", "password": "test123"}, 
                         timeout=10)
        log_test("A. AUTH & SEED", "POST /auth/register → 403 désactivé", 
                 r.status_code == 403,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /auth/register", False, str(e))

def test_category_b_dashboard():
    """B. DASHBOARD & ANALYTICS"""
    print("\n" + "="*80)
    print("CATÉGORIE B : DASHBOARD & ANALYTICS")
    print("="*80)
    
    # Test 1: GET /api/dashboard/kpis → 200
    try:
        r = requests.get(f"{BASE_URL}/dashboard/kpis", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /dashboard/kpis", 
                 r.status_code == 200 and "total" in data and data["total"] > 0,
                 f"Status: {r.status_code}, Total: {data.get('total', 0)}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /dashboard/kpis", False, str(e))
    
    # Test 2: GET /api/dashboard/by-site → 200 avec 6 sites
    try:
        r = requests.get(f"{BASE_URL}/dashboard/by-site", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /dashboard/by-site → 6 sites", 
                 r.status_code == 200 and isinstance(data, list) and len(data) == 6,
                 f"Status: {r.status_code}, Sites: {len(data)}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /dashboard/by-site", False, str(e))
    
    # Test 3: GET /api/dashboard/jour-j-live → 200
    try:
        r = requests.get(f"{BASE_URL}/dashboard/jour-j-live", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /dashboard/jour-j-live", 
                 r.status_code == 200 and "totals" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /dashboard/jour-j-live", False, str(e))
    
    # Test 4: GET /api/dashboard/extended → 200
    try:
        r = requests.get(f"{BASE_URL}/dashboard/extended", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /dashboard/extended", 
                 r.status_code == 200 and "at_risk" in data and "smart_alerts" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /dashboard/extended", False, str(e))
    
    # Test 5: GET /api/dashboard/analytics → 200
    try:
        r = requests.get(f"{BASE_URL}/dashboard/analytics", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /dashboard/analytics", 
                 r.status_code == 200 and "historic" in data and "disciplines" in data and "completion" in data and "days_to_event" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /dashboard/analytics", False, str(e))
    
    # Test 6: GET /api/alerts → 200
    try:
        r = requests.get(f"{BASE_URL}/alerts", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("B. DASHBOARD", "GET /alerts", 
                 r.status_code == 200 and "validation_pending" in data and "validation_rdv" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /alerts", False, str(e))

def test_category_c_registrations():
    """C. REGISTRATIONS & EXPOSANTS"""
    print("\n" + "="*80)
    print("CATÉGORIE C : REGISTRATIONS & EXPOSANTS")
    print("="*80)
    
    # Test 1: GET /api/registrations → 200 avec array
    try:
        r = requests.get(f"{BASE_URL}/registrations", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("C. REGISTRATIONS", "GET /registrations → array ≥50", 
                 r.status_code == 200 and isinstance(data, list) and len(data) >= 50,
                 f"Status: {r.status_code}, Count: {len(data)}")
        
        # Sauvegarder un ID pour les tests suivants
        if data:
            global test_registration_id
            test_registration_id = data[0]["id"]
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /registrations", False, str(e))
    
    # Test 2: GET /api/registrations?status=confirme → 200 filtré
    try:
        r = requests.get(f"{BASE_URL}/registrations?status=confirme", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("C. REGISTRATIONS", "GET /registrations?status=confirme", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /registrations?status=confirme", False, str(e))
    
    # Test 3: GET /api/registrations/{id} → 200 avec détails
    try:
        r = requests.get(f"{BASE_URL}/registrations/{test_registration_id}", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("C. REGISTRATIONS", "GET /registrations/:id détails complets", 
                 r.status_code == 200 and "registration" in data and "organization" in data and "venue" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /registrations/:id", False, str(e))
    
    # Test 4: PUT /api/registrations/{id} → 200
    try:
        r = requests.put(f"{BASE_URL}/registrations/{test_registration_id}", 
                        headers=admin_headers,
                        json={"internal_notes": "Test audit backend"}, 
                        timeout=10)
        log_test("C. REGISTRATIONS", "PUT /registrations/:id", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "PUT /registrations/:id", False, str(e))
    
    # Test 5: POST /api/registrations/{id}/confirm → 200
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/confirm", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        log_test("C. REGISTRATIONS", "POST /registrations/:id/confirm", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "POST /registrations/:id/confirm", False, str(e))
    
    # Test 6: POST /api/registrations/{id}/profile → 200
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/profile", 
                         headers=admin_headers,
                         json={"planned_arrival_time": "08:00", "planned_departure_time": "18:00"}, 
                         timeout=10)
        log_test("C. REGISTRATIONS", "POST /registrations/:id/profile (heures forcées)", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "POST /registrations/:id/profile", False, str(e))
    
    # Test 7: POST /api/registrations/{id}/generate-caution-receipt → 200
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/generate-caution-receipt", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        data = r.json()
        log_test("C. REGISTRATIONS", "POST /registrations/:id/generate-caution-receipt", 
                 r.status_code == 200 and "document_id" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "POST /registrations/:id/generate-caution-receipt", False, str(e))

def test_category_d_venues():
    """D. VENUES & RÉFÉRENTS (SESSION 13)"""
    print("\n" + "="*80)
    print("CATÉGORIE D : VENUES & RÉFÉRENTS (NEW SESSION 13)")
    print("="*80)
    
    # Test 1: GET /api/venues → 200 avec 6 venues
    try:
        r = requests.get(f"{BASE_URL}/venues", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("D. VENUES", "GET /venues → 6 venues", 
                 r.status_code == 200 and isinstance(data, list) and len(data) == 6,
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("D. VENUES", "GET /venues", False, str(e))
    
    # Test 2: POST /api/venues/venue-faaa/set-availability → 200
    try:
        r = requests.post(f"{BASE_URL}/venues/venue-faaa/set-availability", 
                         headers=admin_headers,
                         json={"is_available_2026": True}, 
                         timeout=10)
        log_test("D. VENUES", "POST /venues/:id/set-availability", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("D. VENUES", "POST /venues/:id/set-availability", False, str(e))
    
    # Test 3: POST /api/venues/venue-faaa/set-pacific-visible → 200
    try:
        r = requests.post(f"{BASE_URL}/venues/venue-faaa/set-pacific-visible", 
                         headers=admin_headers,
                         json={"pacific_visible": True}, 
                         timeout=10)
        log_test("D. VENUES", "POST /venues/:id/set-pacific-visible", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("D. VENUES", "POST /venues/:id/set-pacific-visible", False, str(e))
    
    # Test 4: POST /api/venues/venue-faaa/set-referent (admin) → 200
    try:
        r = requests.post(f"{BASE_URL}/venues/venue-faaa/set-referent", 
                         headers=admin_headers,
                         json={
                             "name": "Teva GEROS",
                             "email": "contact@aracom-conseil.fr",
                             "phone": "+(689) 87 210 444"
                         }, 
                         timeout=10)
        data = r.json()
        log_test("D. VENUES", "POST /venues/:id/set-referent (admin) → 200", 
                 r.status_code == 200 and "referent" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("D. VENUES", "POST /venues/:id/set-referent admin", False, str(e))
    
    # Test 5: GET /api/venues → vérifier referent_aracom persisté
    try:
        r = requests.get(f"{BASE_URL}/venues", headers=admin_headers, timeout=10)
        data = r.json()
        venue_faaa = next((v for v in data if v["id"] == "venue-faaa"), None)
        has_referent = venue_faaa and "referent_aracom" in venue_faaa and venue_faaa["referent_aracom"] is not None
        log_test("D. VENUES", "GET /venues → referent_aracom persisté", 
                 has_referent,
                 f"Status: {r.status_code}, Referent: {venue_faaa.get('referent_aracom') if venue_faaa else 'N/A'}")
    except Exception as e:
        log_test("D. VENUES", "GET /venues referent check", False, str(e))
    
    # Test 6: POST /api/venues/venue-faaa/set-referent (exposant) → 403
    try:
        exposant_headers = {
            "x-user-id": "u-exp-1",
            "x-user-role": "exposant",
            "Content-Type": "application/json"
        }
        r = requests.post(f"{BASE_URL}/venues/venue-faaa/set-referent", 
                         headers=exposant_headers,
                         json={"name": "Test", "email": "test@test.com", "phone": "123"}, 
                         timeout=10)
        log_test("D. VENUES", "POST /venues/:id/set-referent (exposant) → 403", 
                 r.status_code == 403,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("D. VENUES", "POST /venues/:id/set-referent exposant", False, str(e))
    
    # Test 7: GET /api/venues/venue-faaa/stands → 200
    try:
        r = requests.get(f"{BASE_URL}/venues/venue-faaa/stands", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("D. VENUES", "GET /venues/:id/stands", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Stands: {len(data)}")
    except Exception as e:
        log_test("D. VENUES", "GET /venues/:id/stands", False, str(e))

def test_category_e_jx_reminder():
    """E. AI EMAIL REMINDER J-X (SESSION 13)"""
    print("\n" + "="*80)
    print("CATÉGORIE E : AI EMAIL REMINDER J-X (NEW SESSION 13)")
    print("="*80)
    
    # Test 1: POST /api/registrations/{id}/generate-jx-reminder (step_key valide) → 200
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/generate-jx-reminder", 
                         headers=admin_headers,
                         json={"step_key": "documents"}, 
                         timeout=30)
        data = r.json()
        log_test("E. JX REMINDER", "POST /generate-jx-reminder step_key=documents → 200", 
                 r.status_code == 200 and "subject" in data and "body_html" in data and "days_remaining" in data and "referent" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("E. JX REMINDER", "POST /generate-jx-reminder documents", False, str(e))
    
    # Test 2-7: Tester les 6 step_keys valides
    step_keys = ["profile", "stand", "animation", "documents", "caution", "convention"]
    for step_key in step_keys:
        try:
            r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/generate-jx-reminder", 
                             headers=admin_headers,
                             json={"step_key": step_key}, 
                             timeout=30)
            data = r.json()
            log_test("E. JX REMINDER", f"POST /generate-jx-reminder step_key={step_key}", 
                     r.status_code == 200 and "subject" in data and "body_html" in data,
                     f"Status: {r.status_code}")
        except Exception as e:
            log_test("E. JX REMINDER", f"POST /generate-jx-reminder {step_key}", False, str(e))
    
    # Test 8: step_key invalide → 400
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/generate-jx-reminder", 
                         headers=admin_headers,
                         json={"step_key": "invalid_key"}, 
                         timeout=10)
        log_test("E. JX REMINDER", "POST /generate-jx-reminder step_key invalide → 400", 
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("E. JX REMINDER", "POST /generate-jx-reminder invalid", False, str(e))
    
    # Test 9: sans step_key → 400
    try:
        r = requests.post(f"{BASE_URL}/registrations/{test_registration_id}/generate-jx-reminder", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        log_test("E. JX REMINDER", "POST /generate-jx-reminder sans step_key → 400", 
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("E. JX REMINDER", "POST /generate-jx-reminder no step_key", False, str(e))
    
    # Test 10: id inexistant → 404
    try:
        r = requests.post(f"{BASE_URL}/registrations/reg-xxx-fake/generate-jx-reminder", 
                         headers=admin_headers,
                         json={"step_key": "documents"}, 
                         timeout=10)
        log_test("E. JX REMINDER", "POST /generate-jx-reminder id inexistant → 404", 
                 r.status_code == 404,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("E. JX REMINDER", "POST /generate-jx-reminder 404", False, str(e))

def test_category_f_animation():
    """F. ANIMATION SLOTS"""
    print("\n" + "="*80)
    print("CATÉGORIE F : ANIMATION SLOTS")
    print("="*80)
    
    # Test 1: GET /api/animation-slots?venue_id=venue-faaa → 200
    try:
        r = requests.get(f"{BASE_URL}/animation-slots?venue_id=venue-faaa", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("F. ANIMATION", "GET /animation-slots?venue_id", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("F. ANIMATION", "GET /animation-slots", False, str(e))
    
    # Test 2: POST /api/animation-slots (vendredi 11:00-12:00) → 201
    try:
        r = requests.post(f"{BASE_URL}/animation-slots", 
                         headers=admin_headers,
                         json={
                             "registration_id": test_registration_id,
                             "venue_id": "venue-faaa",
                             "day_label": "vendredi",
                             "event_date": "2026-08-14",
                             "start_time": "11:00",
                             "end_time": "12:00",
                             "title": "Test animation",
                             "slot_type": "animation"
                         }, 
                         timeout=10)
        data = r.json()
        log_test("F. ANIMATION", "POST /animation-slots vendredi 11:00-12:00", 
                 r.status_code == 201 and "id" in data,
                 f"Status: {r.status_code}")
        if r.status_code == 201:
            global test_slot_id
            test_slot_id = data["id"]
    except Exception as e:
        log_test("F. ANIMATION", "POST /animation-slots vendredi", False, str(e))
    
    # Test 3: POST /api/animation-slots (samedi 09:00-10:00) → 201
    try:
        r = requests.post(f"{BASE_URL}/animation-slots", 
                         headers=admin_headers,
                         json={
                             "registration_id": test_registration_id,
                             "venue_id": "venue-faaa",
                             "day_label": "samedi",
                             "event_date": "2026-08-15",
                             "start_time": "09:00",
                             "end_time": "10:00",
                             "title": "Test animation samedi",
                             "slot_type": "animation"
                         }, 
                         timeout=10)
        log_test("F. ANIMATION", "POST /animation-slots samedi 09:00-10:00", 
                 r.status_code == 201,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("F. ANIMATION", "POST /animation-slots samedi", False, str(e))
    
    # Test 4: DELETE /api/animation-slots/{id} → 200
    try:
        if 'test_slot_id' in globals():
            r = requests.delete(f"{BASE_URL}/animation-slots/{test_slot_id}", 
                              headers=admin_headers, 
                              timeout=10)
            log_test("F. ANIMATION", "DELETE /animation-slots/:id", 
                     r.status_code == 200,
                     f"Status: {r.status_code}")
        else:
            log_test("F. ANIMATION", "DELETE /animation-slots/:id", False, "No slot ID available")
    except Exception as e:
        log_test("F. ANIMATION", "DELETE /animation-slots", False, str(e))

def test_category_g_documents():
    """G. DOCUMENTS & DOCUMENTS OFFICIELS"""
    print("\n" + "="*80)
    print("CATÉGORIE G : DOCUMENTS & DOCUMENTS OFFICIELS")
    print("="*80)
    
    # Test 1: GET /api/documents?registration_id={id} → 200
    try:
        r = requests.get(f"{BASE_URL}/documents?registration_id={test_registration_id}", 
                        headers=admin_headers, timeout=10)
        data = r.json()
        log_test("G. DOCUMENTS", "GET /documents?registration_id", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("G. DOCUMENTS", "GET /documents", False, str(e))
    
    # Test 2: POST /api/documents (upload base64) → 201
    try:
        # Petit fichier base64 de test (1x1 pixel PNG)
        test_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        r = requests.post(f"{BASE_URL}/documents", 
                         headers=admin_headers,
                         json={
                             "registration_id": test_registration_id,
                             "document_type": "autre",
                             "file_name": "test_audit.png",
                             "file_data": test_base64,
                             "mime_type": "image/png"
                         }, 
                         timeout=10)
        data = r.json()
        log_test("G. DOCUMENTS", "POST /documents upload base64", 
                 r.status_code == 201 and "id" in data,
                 f"Status: {r.status_code}")
        if r.status_code == 201:
            global test_document_id
            test_document_id = data["id"]
    except Exception as e:
        log_test("G. DOCUMENTS", "POST /documents", False, str(e))
    
    # Test 3: PUT /api/documents/{id} (status: valide) → 200
    try:
        if 'test_document_id' in globals():
            r = requests.put(f"{BASE_URL}/documents/{test_document_id}", 
                           headers=admin_headers,
                           json={"status": "valide"}, 
                           timeout=10)
            log_test("G. DOCUMENTS", "PUT /documents/:id status=valide", 
                     r.status_code == 200,
                     f"Status: {r.status_code}")
        else:
            log_test("G. DOCUMENTS", "PUT /documents/:id", False, "No document ID available")
    except Exception as e:
        log_test("G. DOCUMENTS", "PUT /documents", False, str(e))
    
    # Test 4: GET /api/official-documents (admin) → 200
    try:
        r = requests.get(f"{BASE_URL}/official-documents", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("G. DOCUMENTS", "GET /official-documents (admin)", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("G. DOCUMENTS", "GET /official-documents admin", False, str(e))
    
    # Test 5: GET /api/official-documents (exposant) → 200
    try:
        exposant_headers = {
            "x-user-id": "u-exp-1",
            "x-user-role": "exposant",
            "Content-Type": "application/json"
        }
        r = requests.get(f"{BASE_URL}/official-documents", headers=exposant_headers, timeout=10)
        log_test("G. DOCUMENTS", "GET /official-documents (exposant) accessible", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("G. DOCUMENTS", "GET /official-documents exposant", False, str(e))
    
    # Test 6: POST /api/official-documents (exposant) → 403
    try:
        exposant_headers = {
            "x-user-id": "u-exp-1",
            "x-user-role": "exposant",
            "Content-Type": "application/json"
        }
        r = requests.post(f"{BASE_URL}/official-documents", 
                         headers=exposant_headers,
                         json={"title": "Test", "file_data": "test"}, 
                         timeout=10)
        log_test("G. DOCUMENTS", "POST /official-documents (exposant) → 403", 
                 r.status_code == 403,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("G. DOCUMENTS", "POST /official-documents exposant", False, str(e))
    
    # Test 7: DELETE /api/official-documents/{id} (admin, id inexistant) → 404
    try:
        r = requests.delete(f"{BASE_URL}/official-documents/doc-fake-id", 
                          headers=admin_headers, 
                          timeout=10)
        log_test("G. DOCUMENTS", "DELETE /official-documents/:id inexistant → 404", 
                 r.status_code == 404,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("G. DOCUMENTS", "DELETE /official-documents", False, str(e))

def test_category_h_mailing():
    """H. MAILING SYSTEM"""
    print("\n" + "="*80)
    print("CATÉGORIE H : MAILING SYSTEM")
    print("="*80)
    
    # Test 1: GET /api/mailing/status → 200
    try:
        r = requests.get(f"{BASE_URL}/mailing/status", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("H. MAILING", "GET /mailing/status", 
                 r.status_code == 200 and "config_source" in data,
                 f"Status: {r.status_code}, Config: {data.get('config_source')}")
    except Exception as e:
        log_test("H. MAILING", "GET /mailing/status", False, str(e))
    
    # Test 2: POST /api/mailing/test-smtp → 200
    try:
        r = requests.post(f"{BASE_URL}/mailing/test-smtp", headers=admin_headers, json={}, timeout=10)
        data = r.json()
        log_test("H. MAILING", "POST /mailing/test-smtp", 
                 r.status_code == 200 and "configured" in data,
                 f"Status: {r.status_code}, Configured: {data.get('configured')}")
    except Exception as e:
        log_test("H. MAILING", "POST /mailing/test-smtp", False, str(e))
    
    # Test 3: POST /api/mailing/generate-ai → 200
    try:
        r = requests.post(f"{BASE_URL}/mailing/generate-ai", 
                         headers=admin_headers,
                         json={
                             "mail_type": "relance_caution",
                             "registration_ids": []
                         }, 
                         timeout=30)
        data = r.json()
        log_test("H. MAILING", "POST /mailing/generate-ai", 
                 r.status_code == 200 and "subject" in data and "body_html" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("H. MAILING", "POST /mailing/generate-ai", False, str(e))
    
    # Test 4: POST /api/mailing/send (mode TEST) → 200
    try:
        r = requests.post(f"{BASE_URL}/mailing/send", 
                         headers=admin_headers,
                         json={
                             "subject": "Test audit backend",
                             "body_html": "<p>Test</p>",
                             "registration_ids": [test_registration_id],
                             "mail_type": "test"
                         }, 
                         timeout=10)
        data = r.json()
        log_test("H. MAILING", "POST /mailing/send (mode TEST)", 
                 r.status_code == 200 and "sent" in data,
                 f"Status: {r.status_code}, Sent: {data.get('sent', 0)}")
    except Exception as e:
        log_test("H. MAILING", "POST /mailing/send", False, str(e))
    
    # Test 5: GET /api/emails → 200
    try:
        r = requests.get(f"{BASE_URL}/emails", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("H. MAILING", "GET /emails", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("H. MAILING", "GET /emails", False, str(e))
    
    # Test 6: GET /api/mailing/scheduled → 200
    try:
        r = requests.get(f"{BASE_URL}/mailing/scheduled", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("H. MAILING", "GET /mailing/scheduled", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("H. MAILING", "GET /mailing/scheduled", False, str(e))

def test_category_i_deadlines():
    """I. STEP DEADLINES"""
    print("\n" + "="*80)
    print("CATÉGORIE I : STEP DEADLINES")
    print("="*80)
    
    # Test 1: GET /api/step-deadlines → 200
    try:
        r = requests.get(f"{BASE_URL}/step-deadlines", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("I. DEADLINES", "GET /step-deadlines", 
                 r.status_code == 200 and "deadlines" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("I. DEADLINES", "GET /step-deadlines", False, str(e))
    
    # Test 2: POST /api/step-deadlines (admin) → 200
    try:
        r = requests.post(f"{BASE_URL}/step-deadlines", 
                         headers=admin_headers,
                         json={
                             "deadlines": {
                                 "profile": "2026-07-01",
                                 "stand": "2026-07-15",
                                 "animation": "2026-07-20",
                                 "documents": "2026-08-01",
                                 "caution": "2026-08-05",
                                 "convention": "2026-08-10"
                             }
                         }, 
                         timeout=10)
        log_test("I. DEADLINES", "POST /step-deadlines (admin)", 
                 r.status_code == 200,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("I. DEADLINES", "POST /step-deadlines", False, str(e))
    
    # Test 3: POST /api/step-deadlines (exposant) → 403
    try:
        exposant_headers = {
            "x-user-id": "u-exp-1",
            "x-user-role": "exposant",
            "Content-Type": "application/json"
        }
        r = requests.post(f"{BASE_URL}/step-deadlines", 
                         headers=exposant_headers,
                         json={"deadlines": {"profile": "2026-07-01"}}, 
                         timeout=10)
        log_test("I. DEADLINES", "POST /step-deadlines (exposant) → 403", 
                 r.status_code == 403,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("I. DEADLINES", "POST /step-deadlines exposant", False, str(e))

def test_category_j_satisfaction():
    """J. SATISFACTION & POST-EVENT"""
    print("\n" + "="*80)
    print("CATÉGORIE J : SATISFACTION & POST-EVENT")
    print("="*80)
    
    # Test 1: GET /api/satisfaction → 200
    try:
        r = requests.get(f"{BASE_URL}/satisfaction", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("J. SATISFACTION", "GET /satisfaction", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("J. SATISFACTION", "GET /satisfaction", False, str(e))
    
    # Test 2: GET /api/satisfaction/stats → 200
    try:
        r = requests.get(f"{BASE_URL}/satisfaction/stats", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("J. SATISFACTION", "GET /satisfaction/stats", 
                 r.status_code == 200 and "total_responses" in data and "avg_overall" in data and "nps" in data,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("J. SATISFACTION", "GET /satisfaction/stats", False, str(e))
    
    # Test 3: POST /api/satisfaction → 200/201
    try:
        r = requests.post(f"{BASE_URL}/satisfaction", 
                         headers=admin_headers,
                         json={
                             "registration_id": test_registration_id,
                             "overall_rating": 5,
                             "organization_rating": 5,
                             "stand_rating": 4,
                             "visitors_rating": 5,
                             "communication_rating": 5,
                             "nps_score": 10,
                             "will_participate_next": "oui",
                             "positive_points": "Excellent événement",
                             "improvement_points": "RAS",
                             "free_comment": "Merci ARACOM"
                         }, 
                         timeout=10)
        log_test("J. SATISFACTION", "POST /satisfaction (upsert)", 
                 r.status_code in [200, 201],
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("J. SATISFACTION", "POST /satisfaction", False, str(e))
    
    # Test 4: GET /api/post-event-status → 200
    try:
        r = requests.get(f"{BASE_URL}/post-event-status", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("J. SATISFACTION", "GET /post-event-status", 
                 r.status_code == 200 and "unlocked" in data,
                 f"Status: {r.status_code}, Unlocked: {data.get('unlocked')}")
    except Exception as e:
        log_test("J. SATISFACTION", "GET /post-event-status", False, str(e))

def test_category_k_validation():
    """K. VALIDATION REQUESTS"""
    print("\n" + "="*80)
    print("CATÉGORIE K : VALIDATION REQUESTS")
    print("="*80)
    
    # Test 1: GET /api/validation-requests → 200
    try:
        r = requests.get(f"{BASE_URL}/validation-requests", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("K. VALIDATION", "GET /validation-requests", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("K. VALIDATION", "GET /validation-requests", False, str(e))
    
    # Test 2: GET /api/validation-requests?status=en_attente → 200
    try:
        r = requests.get(f"{BASE_URL}/validation-requests?status=en_attente", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("K. VALIDATION", "GET /validation-requests?status=en_attente", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("K. VALIDATION", "GET /validation-requests?status", False, str(e))

def test_category_l_tasks():
    """L. TASKS & ANOMALIES"""
    print("\n" + "="*80)
    print("CATÉGORIE L : TASKS & ANOMALIES")
    print("="*80)
    
    # Test 1: GET /api/tasks → 200
    try:
        r = requests.get(f"{BASE_URL}/tasks", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("L. TASKS", "GET /tasks", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("L. TASKS", "GET /tasks", False, str(e))
    
    # Test 2: POST /api/tasks → 201
    try:
        r = requests.post(f"{BASE_URL}/tasks", 
                         headers=admin_headers,
                         json={
                             "registration_id": test_registration_id,
                             "task_type": "appel",
                             "title": "Test audit backend"
                         }, 
                         timeout=10)
        log_test("L. TASKS", "POST /tasks", 
                 r.status_code == 201,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("L. TASKS", "POST /tasks", False, str(e))
    
    # Test 3: GET /api/anomalies → 200
    try:
        r = requests.get(f"{BASE_URL}/anomalies", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("L. TASKS", "GET /anomalies", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("L. TASKS", "GET /anomalies", False, str(e))
    
    # Test 4: GET /api/field-comments?registration_id={id} → 200
    try:
        r = requests.get(f"{BASE_URL}/field-comments?registration_id={test_registration_id}", 
                        headers=admin_headers, timeout=10)
        data = r.json()
        log_test("L. TASKS", "GET /field-comments?registration_id", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("L. TASKS", "GET /field-comments", False, str(e))

def test_category_m_tools():
    """M. TOOLS ARACOM"""
    print("\n" + "="*80)
    print("CATÉGORIE M : TOOLS ARACOM")
    print("="*80)
    
    # Test 1: POST /api/tools/recompute-completion → 200
    try:
        r = requests.post(f"{BASE_URL}/tools/recompute-completion", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        data = r.json()
        log_test("M. TOOLS", "POST /tools/recompute-completion", 
                 r.status_code == 200 and "total" in data and "updated" in data,
                 f"Status: {r.status_code}, Total: {data.get('total')}, Updated: {data.get('updated')}")
    except Exception as e:
        log_test("M. TOOLS", "POST /tools/recompute-completion", False, str(e))
    
    # Test 2: POST /api/tools/generate-relances → 200
    try:
        r = requests.post(f"{BASE_URL}/tools/generate-relances", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        data = r.json()
        log_test("M. TOOLS", "POST /tools/generate-relances", 
                 r.status_code == 200 and "created" in data,
                 f"Status: {r.status_code}, Created: {data.get('created')}")
    except Exception as e:
        log_test("M. TOOLS", "POST /tools/generate-relances", False, str(e))
    
    # Test 3: POST /api/emails/send-satisfaction → 200
    try:
        r = requests.post(f"{BASE_URL}/emails/send-satisfaction", 
                         headers=admin_headers,
                         json={}, 
                         timeout=10)
        data = r.json()
        log_test("M. TOOLS", "POST /emails/send-satisfaction", 
                 r.status_code == 200 and "sent" in data,
                 f"Status: {r.status_code}, Sent: {data.get('sent')}")
    except Exception as e:
        log_test("M. TOOLS", "POST /emails/send-satisfaction", False, str(e))

def test_category_n_tracking():
    """N. TRACKING (pixels)"""
    print("\n" + "="*80)
    print("CATÉGORIE N : TRACKING (pixels)")
    print("="*80)
    
    # Test 1: GET /api/track/open/<id>.gif → 200 image/gif
    try:
        r = requests.get(f"{BASE_URL}/track/open/test-message-id.gif", timeout=10)
        log_test("N. TRACKING", "GET /track/open/:id.gif → 200 image/gif", 
                 r.status_code == 200 and r.headers.get("Content-Type") == "image/gif",
                 f"Status: {r.status_code}, Content-Type: {r.headers.get('Content-Type')}")
    except Exception as e:
        log_test("N. TRACKING", "GET /track/open", False, str(e))
    
    # Test 2: GET /api/track/click/<id>?u=https://example.com → 302
    try:
        r = requests.get(f"{BASE_URL}/track/click/test-message-id?u=https://example.com", 
                        allow_redirects=False, timeout=10)
        log_test("N. TRACKING", "GET /track/click/:id?u=... → 302 redirect", 
                 r.status_code == 302,
                 f"Status: {r.status_code}, Location: {r.headers.get('Location')}")
    except Exception as e:
        log_test("N. TRACKING", "GET /track/click redirect", False, str(e))
    
    # Test 3: GET /api/track/click/<id> (sans u) → 400
    try:
        r = requests.get(f"{BASE_URL}/track/click/test-message-id", timeout=10)
        log_test("N. TRACKING", "GET /track/click/:id sans u → 400", 
                 r.status_code == 400,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("N. TRACKING", "GET /track/click no u", False, str(e))

def test_category_o_access_tokens():
    """O. ACCESS TOKENS (Magic Links)"""
    print("\n" + "="*80)
    print("CATÉGORIE O : ACCESS TOKENS (Magic Links)")
    print("="*80)
    
    # Test 1: GET /api/access-tokens → 200
    try:
        r = requests.get(f"{BASE_URL}/access-tokens", headers=admin_headers, timeout=10)
        data = r.json()
        log_test("O. ACCESS TOKENS", "GET /access-tokens", 
                 r.status_code == 200 and isinstance(data, list),
                 f"Status: {r.status_code}, Count: {len(data)}")
    except Exception as e:
        log_test("O. ACCESS TOKENS", "GET /access-tokens", False, str(e))
    
    # Test 2: POST /api/access-tokens → 201
    try:
        r = requests.post(f"{BASE_URL}/access-tokens", 
                         headers=admin_headers,
                         json={
                             "organization_id": "org-1",
                             "purpose": "exposant_access"
                         }, 
                         timeout=10)
        log_test("O. ACCESS TOKENS", "POST /access-tokens", 
                 r.status_code == 201,
                 f"Status: {r.status_code}")
    except Exception as e:
        log_test("O. ACCESS TOKENS", "POST /access-tokens", False, str(e))

def print_summary():
    """Affiche le résumé final"""
    print("\n" + "="*80)
    print("RÉSUMÉ FINAL — AUDIT BACKEND COMPLET")
    print("="*80)
    
    total_tests = tests_passed + tests_failed
    success_rate = (tests_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\n📊 SCORE GLOBAL : {tests_passed}/{total_tests} tests passés ({success_rate:.1f}%)")
    print(f"   ✅ Réussis : {tests_passed}")
    print(f"   ❌ Échoués : {tests_failed}")
    
    print("\n📋 DÉTAIL PAR CATÉGORIE :")
    for category, results in test_results.items():
        total = results["passed"] + results["failed"]
        rate = (results["passed"] / total * 100) if total > 0 else 0
        status = "✅" if results["failed"] == 0 else "⚠️" if rate >= 80 else "❌"
        print(f"\n{status} {category}")
        print(f"   {results['passed']}/{total} tests passés ({rate:.1f}%)")
        
        # Afficher les tests échoués
        failed_tests = [t for t in results["tests"] if not t["passed"]]
        if failed_tests:
            print(f"   Échecs :")
            for test in failed_tests:
                print(f"      • {test['name']}")
                if test['details']:
                    print(f"        └─ {test['details']}")
    
    # Vérifier le mode mail
    print("\n🛡️ MODE MAIL :")
    try:
        r = requests.get(f"{BASE_URL}/mailing/status", headers=admin_headers, timeout=10)
        data = r.json()
        if data.get("test_mode_active"):
            print("   ✅ Mode TEST actif (sécurisé)")
        else:
            print("   ⚠️ ATTENTION : Mode PRODUCTION actif !")
    except:
        print("   ⚠️ Impossible de vérifier le mode mail")
    
    # Conclusion
    print("\n🎯 CONCLUSION :")
    if success_rate >= 95:
        print("   ✅ API PRÊTE POUR PRODUCTION")
        print("   Tous les endpoints critiques fonctionnent correctement.")
    elif success_rate >= 80:
        print("   ⚠️ API FONCTIONNELLE AVEC POINTS D'ATTENTION")
        print("   Quelques endpoints nécessitent une vérification.")
    else:
        print("   ❌ API NÉCESSITE DES CORRECTIONS")
        print("   Plusieurs endpoints critiques sont défaillants.")
    
    print("\n" + "="*80)

def main():
    """Fonction principale"""
    print("="*80)
    print("🎯 AUDIT BACKEND COMPLET — Forum de la Rentrée 2026")
    print("="*80)
    print(f"Base URL : {BASE_URL}")
    print(f"Date : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Initialiser test_registration_id
    global test_registration_id
    test_registration_id = None
    
    # Exécuter tous les tests
    test_category_a_auth_seed()
    test_category_b_dashboard()
    test_category_c_registrations()
    test_category_d_venues()
    test_category_e_jx_reminder()
    test_category_f_animation()
    test_category_g_documents()
    test_category_h_mailing()
    test_category_i_deadlines()
    test_category_j_satisfaction()
    test_category_k_validation()
    test_category_l_tasks()
    test_category_m_tools()
    test_category_n_tracking()
    test_category_o_access_tokens()
    
    # Afficher le résumé
    print_summary()
    
    # Code de sortie
    sys.exit(0 if tests_failed == 0 else 1)

if __name__ == "__main__":
    main()
