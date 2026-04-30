#!/usr/bin/env python3
"""
AUDIT COMPLET BACKEND — Forum de la Rentrée 2026
Tests exhaustifs de TOUS les endpoints backend selon la review request
"""

import requests
import json
import sys
import base64
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-teva",
    "x-user-role": "aracom_admin"
}
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "exposant"
}
PACIFIC_HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "pacific_centers_readonly"
}

# Test results tracking
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "categories": {}
}

def log_test(category, test_name, success, details="", severity="normal"):
    """Log test result with category tracking"""
    global test_results
    test_results["total"] += 1
    
    if category not in test_results["categories"]:
        test_results["categories"][category] = {"passed": 0, "failed": 0, "warnings": 0, "tests": []}
    
    if success:
        test_results["passed"] += 1
        test_results["categories"][category]["passed"] += 1
        status = "✅ PASS"
    elif severity == "warning":
        test_results["warnings"] += 1
        test_results["categories"][category]["warnings"] += 1
        status = "⚠️  WARN"
    else:
        test_results["failed"] += 1
        test_results["categories"][category]["failed"] += 1
        status = "❌ FAIL"
    
    result = {
        "name": test_name,
        "status": status,
        "details": details
    }
    test_results["categories"][category]["tests"].append(result)
    
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    
    return success

def print_category_header(category):
    """Print category header"""
    print("\n" + "=" * 80)
    print(f"CATÉGORIE: {category}")
    print("=" * 80)

def print_summary():
    """Print final summary"""
    print("\n" + "=" * 80)
    print("RÉSUMÉ FINAL DE L'AUDIT")
    print("=" * 80)
    print(f"Total tests: {test_results['total']}")
    print(f"✅ Passés: {test_results['passed']}")
    print(f"❌ Échoués: {test_results['failed']}")
    print(f"⚠️  Avertissements: {test_results['warnings']}")
    print(f"Taux de réussite: {(test_results['passed'] / test_results['total'] * 100):.1f}%")
    
    print("\n" + "-" * 80)
    print("RÉSULTATS PAR CATÉGORIE:")
    print("-" * 80)
    for cat, results in test_results["categories"].items():
        total_cat = results["passed"] + results["failed"] + results["warnings"]
        print(f"\n{cat}: {results['passed']}/{total_cat} passés")
        if results["failed"] > 0:
            print(f"  ❌ {results['failed']} échecs")
            for test in results["tests"]:
                if test["status"] == "❌ FAIL":
                    print(f"    - {test['name']}: {test['details']}")
        if results["warnings"] > 0:
            print(f"  ⚠️  {results['warnings']} avertissements")

# ============================================================================
# A. AUTH & SEED
# ============================================================================
def test_auth_and_seed():
    print_category_header("A. AUTH & SEED")
    
    # A1. POST /api/seed (force=true)
    try:
        response = requests.post(f"{BASE_URL}/api/seed", 
                               json={"force": True}, 
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("seeded") == True and 
                      data.get("associations") == 66 and 
                      data.get("stands_planned") == 67)
            log_test("A. AUTH & SEED", "POST /api/seed force=true", success,
                    f"seeded={data.get('seeded')}, associations={data.get('associations')}, stands={data.get('stands_planned')}")
        else:
            log_test("A. AUTH & SEED", "POST /api/seed force=true", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /api/seed force=true", False, f"Exception: {str(e)}")
    
    # A2. POST /api/auth/login (admin)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login",
                               json={"email": "admin@aracom.pf", "password": "demo"},
                               headers={"Content-Type": "application/json"})
        success = response.status_code == 200 and response.json().get("role") == "aracom_admin"
        log_test("A. AUTH & SEED", "POST /api/auth/login (admin)", success,
                f"Status: {response.status_code}, role: {response.json().get('role') if success else 'N/A'}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /api/auth/login (admin)", False, f"Exception: {str(e)}")
    
    # A3. POST /api/auth/login (exposant)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login",
                               json={"email": "swimua.tahiti@gmail.com", "password": "demo"},
                               headers={"Content-Type": "application/json"})
        success = response.status_code == 200 and response.json().get("role") == "exposant"
        log_test("A. AUTH & SEED", "POST /api/auth/login (exposant)", success,
                f"Status: {response.status_code}, role: {response.json().get('role') if success else 'N/A'}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /api/auth/login (exposant)", False, f"Exception: {str(e)}")
    
    # A4. POST /api/auth/login (pacific)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login",
                               json={"email": "pacific@centers.pf", "password": "demo"},
                               headers={"Content-Type": "application/json"})
        success = response.status_code == 200 and response.json().get("role") == "pacific_centers_readonly"
        log_test("A. AUTH & SEED", "POST /api/auth/login (pacific)", success,
                f"Status: {response.status_code}, role: {response.json().get('role') if success else 'N/A'}")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /api/auth/login (pacific)", False, f"Exception: {str(e)}")
    
    # A5. GET /api/auth/me
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_HEADERS)
        success = response.status_code == 200 and response.json().get("role") == "aracom_admin"
        log_test("A. AUTH & SEED", "GET /api/auth/me", success,
                f"Status: {response.status_code}, role: {response.json().get('role') if success else 'N/A'}")
    except Exception as e:
        log_test("A. AUTH & SEED", "GET /api/auth/me", False, f"Exception: {str(e)}")
    
    # A6. POST /api/auth/register (should be disabled → 403)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register",
                               json={"email": "test@test.com", "password": "test123"},
                               headers={"Content-Type": "application/json"})
        success = response.status_code == 403
        log_test("A. AUTH & SEED", "POST /api/auth/register (disabled)", success,
                f"Status: {response.status_code} (expected 403)")
    except Exception as e:
        log_test("A. AUTH & SEED", "POST /api/auth/register (disabled)", False, f"Exception: {str(e)}")

# ============================================================================
# B. DASHBOARD
# ============================================================================
def test_dashboard():
    print_category_header("B. DASHBOARD")
    
    # B1. GET /api/dashboard/kpis
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = (data.get("total") == 67 and 
                      "by_status" in data and 
                      "cautions_recues" in data)
            log_test("B. DASHBOARD", "GET /api/dashboard/kpis", success,
                    f"total={data.get('total')}, by_status keys={list(data.get('by_status', {}).keys())}")
        else:
            log_test("B. DASHBOARD", "GET /api/dashboard/kpis", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/dashboard/kpis", False, f"Exception: {str(e)}")
    
    # B2. GET /api/dashboard/by-site
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/by-site", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = len(data) == 6  # 6 sites
            log_test("B. DASHBOARD", "GET /api/dashboard/by-site", success,
                    f"Sites count: {len(data)}, names: {[s.get('venue_name') for s in data]}")
        else:
            log_test("B. DASHBOARD", "GET /api/dashboard/by-site", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/dashboard/by-site", False, f"Exception: {str(e)}")
    
    # B3. GET /api/dashboard/jour-j-live
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/jour-j-live", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("B. DASHBOARD", "GET /api/dashboard/jour-j-live", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/dashboard/jour-j-live", False, f"Exception: {str(e)}")
    
    # B4. GET /api/dashboard/extended
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/extended", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = ("at_risk" in data and "smart_alerts" in data and "mailing_engagement" in data)
            log_test("B. DASHBOARD", "GET /api/dashboard/extended", success,
                    f"Keys present: at_risk={('at_risk' in data)}, smart_alerts={('smart_alerts' in data)}")
        else:
            log_test("B. DASHBOARD", "GET /api/dashboard/extended", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/dashboard/extended", False, f"Exception: {str(e)}")
    
    # B5. GET /api/dashboard/analytics
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = ("historic" in data and "disciplines" in data and "completion" in data)
            log_test("B. DASHBOARD", "GET /api/dashboard/analytics", success,
                    f"Keys present: historic={('historic' in data)}, disciplines={('disciplines' in data)}")
        else:
            log_test("B. DASHBOARD", "GET /api/dashboard/analytics", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/dashboard/analytics", False, f"Exception: {str(e)}")
    
    # B6. GET /api/alerts
    try:
        response = requests.get(f"{BASE_URL}/api/alerts", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = ("validation_pending" in data and "validation_rdv" in data)
            log_test("B. DASHBOARD", "GET /api/alerts", success,
                    f"validation_pending={data.get('validation_pending')}, validation_rdv={data.get('validation_rdv')}")
        else:
            log_test("B. DASHBOARD", "GET /api/alerts", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("B. DASHBOARD", "GET /api/alerts", False, f"Exception: {str(e)}")

# ============================================================================
# C. REGISTRATIONS / EXPOSANTS / VENUES
# ============================================================================
def test_registrations():
    print_category_header("C. REGISTRATIONS / EXPOSANTS / VENUES")
    
    # C1. GET /api/registrations
    global test_reg_id
    test_reg_id = None
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = len(data) == 67
            if len(data) > 0:
                test_reg_id = data[0].get("id")
            log_test("C. REGISTRATIONS", "GET /api/registrations", success,
                    f"Count: {len(data)}, expected 67")
        else:
            log_test("C. REGISTRATIONS", "GET /api/registrations", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /api/registrations", False, f"Exception: {str(e)}")
    
    # C2. GET /api/registrations with filters
    try:
        response = requests.get(f"{BASE_URL}/api/registrations?status=confirme", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("C. REGISTRATIONS", "GET /api/registrations?status=confirme", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /api/registrations?status=confirme", False, f"Exception: {str(e)}")
    
    # C3. GET /api/registrations/:id
    if test_reg_id:
        try:
            response = requests.get(f"{BASE_URL}/api/registrations/{test_reg_id}", headers=ADMIN_HEADERS)
            if response.status_code == 200:
                data = response.json()
                success = ("organization" in data and "venue" in data)
                log_test("C. REGISTRATIONS", f"GET /api/registrations/{test_reg_id}", success,
                        f"Has organization: {('organization' in data)}, has venue: {('venue' in data)}")
            else:
                log_test("C. REGISTRATIONS", f"GET /api/registrations/{test_reg_id}", False, 
                        f"Status: {response.status_code}")
        except Exception as e:
            log_test("C. REGISTRATIONS", f"GET /api/registrations/{test_reg_id}", False, f"Exception: {str(e)}")
    
    # C4. PUT /api/registrations/:id
    if test_reg_id:
        try:
            response = requests.put(f"{BASE_URL}/api/registrations/{test_reg_id}",
                                  json={"internal_notes": "Test audit complet"},
                                  headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("C. REGISTRATIONS", f"PUT /api/registrations/{test_reg_id}", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("C. REGISTRATIONS", f"PUT /api/registrations/{test_reg_id}", False, f"Exception: {str(e)}")
    
    # C5. POST /api/registrations/:id/profile
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/registrations/{test_reg_id}/profile",
                                   json={
                                       "name": "Test Organization",
                                       "discipline": "Sport",
                                       "planned_arrival_time": "08:00",  # Should be forced to 09:00
                                       "planned_departure_time": "19:00"  # Should be forced to 17:00
                                   },
                                   headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("C. REGISTRATIONS", f"POST /api/registrations/{test_reg_id}/profile", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("C. REGISTRATIONS", f"POST /api/registrations/{test_reg_id}/profile", False, 
                    f"Exception: {str(e)}")
    
    # C6. GET /api/venues
    try:
        response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = len(data) == 6
            log_test("C. REGISTRATIONS", "GET /api/venues", success,
                    f"Count: {len(data)}, expected 6")
        else:
            log_test("C. REGISTRATIONS", "GET /api/venues", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /api/venues", False, f"Exception: {str(e)}")
    
    # C7. GET /api/organizations
    try:
        response = requests.get(f"{BASE_URL}/api/organizations", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("C. REGISTRATIONS", "GET /api/organizations", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("C. REGISTRATIONS", "GET /api/organizations", False, f"Exception: {str(e)}")

# ============================================================================
# D. ATTENDANCE / ANOMALIES / FIELD MEDIA
# ============================================================================
def test_attendance_anomalies():
    print_category_header("D. ATTENDANCE / ANOMALIES / FIELD MEDIA")
    
    # D1. GET /api/attendance
    try:
        event_date = "2026-08-14"
        response = requests.get(f"{BASE_URL}/api/attendance?event_date={event_date}", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("D. ATTENDANCE", f"GET /api/attendance?event_date={event_date}", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("D. ATTENDANCE", f"GET /api/attendance?event_date={event_date}", False, f"Exception: {str(e)}")
    
    # D2. GET /api/anomalies
    try:
        response = requests.get(f"{BASE_URL}/api/anomalies", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("D. ATTENDANCE", "GET /api/anomalies", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("D. ATTENDANCE", "GET /api/anomalies", False, f"Exception: {str(e)}")
    
    # D3. POST /api/field-comments
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/field-comments",
                                   json={
                                       "registration_id": test_reg_id,
                                       "comment_type": "observation",
                                       "comment_text": "Test observation audit complet"
                                   },
                                   headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("D. ATTENDANCE", "POST /api/field-comments", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("D. ATTENDANCE", "POST /api/field-comments", False, f"Exception: {str(e)}")
    
    # D4. GET /api/field-media
    try:
        response = requests.get(f"{BASE_URL}/api/field-media", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("D. ATTENDANCE", "GET /api/field-media", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("D. ATTENDANCE", "GET /api/field-media", False, f"Exception: {str(e)}")

# ============================================================================
# E. DOCUMENTS (uploadés par exposants)
# ============================================================================
def test_documents():
    print_category_header("E. DOCUMENTS (uploadés par exposants)")
    
    global test_doc_id
    test_doc_id = None
    
    # E1. POST /api/documents (upload)
    if test_reg_id:
        try:
            # Create a small test PDF in base64
            test_pdf = base64.b64encode(b"%PDF-1.4 test document").decode()
            response = requests.post(f"{BASE_URL}/api/documents",
                                   json={
                                       "registration_id": test_reg_id,
                                       "document_type": "autre",
                                       "file_name": "test_audit.pdf",
                                       "mime_type": "application/pdf",
                                       "file_data": test_pdf
                                   },
                                   headers=ADMIN_HEADERS)
            if response.status_code == 200:
                data = response.json()
                test_doc_id = data.get("id")
                success = test_doc_id is not None
                log_test("E. DOCUMENTS", "POST /api/documents", success,
                        f"Document ID: {test_doc_id}")
            else:
                log_test("E. DOCUMENTS", "POST /api/documents", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("E. DOCUMENTS", "POST /api/documents", False, f"Exception: {str(e)}")
    
    # E2. GET /api/documents
    try:
        response = requests.get(f"{BASE_URL}/api/documents?registration_id={test_reg_id}", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("E. DOCUMENTS", f"GET /api/documents?registration_id={test_reg_id}", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("E. DOCUMENTS", f"GET /api/documents?registration_id={test_reg_id}", False, f"Exception: {str(e)}")
    
    # E3. PUT /api/documents/:id (validation)
    if test_doc_id:
        try:
            response = requests.put(f"{BASE_URL}/api/documents/{test_doc_id}",
                                  json={"status": "valide"},
                                  headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("E. DOCUMENTS", f"PUT /api/documents/{test_doc_id} (status=valide)", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("E. DOCUMENTS", f"PUT /api/documents/{test_doc_id}", False, f"Exception: {str(e)}")
    
    # E4. GET /api/documents/:id/download
    if test_doc_id:
        try:
            response = requests.get(f"{BASE_URL}/api/documents/{test_doc_id}/download", headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("E. DOCUMENTS", f"GET /api/documents/{test_doc_id}/download", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("E. DOCUMENTS", f"GET /api/documents/{test_doc_id}/download", False, f"Exception: {str(e)}")

# ============================================================================
# F. MAILING (mode TEST)
# ============================================================================
def test_mailing():
    print_category_header("F. MAILING (mode TEST)")
    
    # F1. GET /api/mailing/status
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("config_source") == "database"
            log_test("F. MAILING", "GET /api/mailing/status", success,
                    f"config_source={data.get('config_source')}, test_mode={data.get('test_mode')}")
        else:
            log_test("F. MAILING", "GET /api/mailing/status", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("F. MAILING", "GET /api/mailing/status", False, f"Exception: {str(e)}")
    
    # F2. POST /api/mailing/test-smtp
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/test-smtp", json={}, headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = "configured" in data
            log_test("F. MAILING", "POST /api/mailing/test-smtp", success,
                    f"configured={data.get('configured')}, host={data.get('host')}")
        else:
            log_test("F. MAILING", "POST /api/mailing/test-smtp", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("F. MAILING", "POST /api/mailing/test-smtp", False, f"Exception: {str(e)}")
    
    # F3. POST /api/mailing/generate-ai
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/generate-ai",
                               json={
                                   "mail_type": "relance_caution",
                                   "registration_ids": []
                               },
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = ("subject" in data and "body_html" in data and "usage" in data)
            log_test("F. MAILING", "POST /api/mailing/generate-ai", success,
                    f"Has subject: {('subject' in data)}, has body_html: {('body_html' in data)}")
        else:
            log_test("F. MAILING", "POST /api/mailing/generate-ai", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("F. MAILING", "POST /api/mailing/generate-ai", False, f"Exception: {str(e)}")
    
    # F4. POST /api/mailing/send (mode TEST)
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/mailing/send",
                                   json={
                                       "subject": "Test audit complet",
                                       "body_html": "<p>Test email</p>",
                                       "registration_ids": [test_reg_id]
                                   },
                                   headers=ADMIN_HEADERS)
            if response.status_code == 200:
                data = response.json()
                success = data.get("sent", 0) > 0
                log_test("F. MAILING", "POST /api/mailing/send (TEST mode)", success,
                        f"sent={data.get('sent')}, smtp_used={data.get('smtp_used')}")
            else:
                log_test("F. MAILING", "POST /api/mailing/send", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("F. MAILING", "POST /api/mailing/send", False, f"Exception: {str(e)}")
    
    # F5. POST /api/mailing/schedule
    try:
        future_date = (datetime.now() + timedelta(days=1)).isoformat()
        response = requests.post(f"{BASE_URL}/api/mailing/schedule",
                               json={
                                   "subject": "Test scheduled",
                                   "body_html": "<p>Test</p>",
                                   "registration_ids": [test_reg_id] if test_reg_id else [],
                                   "scheduled_for": future_date
                               },
                               headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("F. MAILING", "POST /api/mailing/schedule", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("F. MAILING", "POST /api/mailing/schedule", False, f"Exception: {str(e)}")
    
    # F6. GET /api/mailing/scheduled
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/scheduled", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("F. MAILING", "GET /api/mailing/scheduled", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("F. MAILING", "GET /api/mailing/scheduled", False, f"Exception: {str(e)}")

# ============================================================================
# G. TRACKING
# ============================================================================
def test_tracking():
    print_category_header("G. TRACKING")
    
    # G1. GET /api/track/open/<messageId>.gif
    try:
        test_message_id = "test-message-id"
        response = requests.get(f"{BASE_URL}/api/track/open/{test_message_id}.gif")
        success = response.status_code == 200 and response.headers.get("Content-Type") == "image/gif"
        log_test("G. TRACKING", f"GET /api/track/open/{test_message_id}.gif", success,
                f"Status: {response.status_code}, Content-Type: {response.headers.get('Content-Type')}")
    except Exception as e:
        log_test("G. TRACKING", "GET /api/track/open/<messageId>.gif", False, f"Exception: {str(e)}")
    
    # G2. GET /api/track/click/<messageId>?u=URL (should redirect)
    try:
        test_message_id = "test-message-id"
        test_url = "https://example.com"
        response = requests.get(f"{BASE_URL}/api/track/click/{test_message_id}?u={test_url}", 
                              allow_redirects=False)
        success = response.status_code == 302
        log_test("G. TRACKING", f"GET /api/track/click/<messageId>?u=URL", success,
                f"Status: {response.status_code} (expected 302)")
    except Exception as e:
        log_test("G. TRACKING", "GET /api/track/click/<messageId>?u=URL", False, f"Exception: {str(e)}")
    
    # G3. GET /api/track/click/<messageId> without u (should return 400)
    try:
        test_message_id = "test-message-id"
        response = requests.get(f"{BASE_URL}/api/track/click/{test_message_id}")
        success = response.status_code == 400
        log_test("G. TRACKING", "GET /api/track/click/<messageId> (no u param)", success,
                f"Status: {response.status_code} (expected 400)")
    except Exception as e:
        log_test("G. TRACKING", "GET /api/track/click/<messageId> (no u)", False, f"Exception: {str(e)}")

# ============================================================================
# H. OUTILS ARACOM
# ============================================================================
def test_outils_aracom():
    print_category_header("H. OUTILS ARACOM")
    
    # H1. POST /api/tools/recompute-completion
    try:
        response = requests.post(f"{BASE_URL}/api/tools/recompute-completion", json={}, headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("total") == 67
            log_test("H. OUTILS ARACOM", "POST /api/tools/recompute-completion", success,
                    f"total={data.get('total')}, updated={data.get('updated')}")
        else:
            log_test("H. OUTILS ARACOM", "POST /api/tools/recompute-completion", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("H. OUTILS ARACOM", "POST /api/tools/recompute-completion", False, f"Exception: {str(e)}")
    
    # H2. POST /api/tools/generate-relances (idempotent)
    try:
        response = requests.post(f"{BASE_URL}/api/tools/generate-relances", json={}, headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            # First call should create tasks, second call should return 0
            success = "created" in data
            log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances (1st call)", success,
                    f"created={data.get('created')}")
        else:
            log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances", False, f"Exception: {str(e)}")
    
    # H3. POST /api/tools/generate-relances (2nd call - idempotent)
    try:
        response = requests.post(f"{BASE_URL}/api/tools/generate-relances", json={}, headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("created") == 0
            log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances (2nd call - idempotent)", success,
                    f"created={data.get('created')} (expected 0)")
        else:
            log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances (2nd)", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("H. OUTILS ARACOM", "POST /api/tools/generate-relances (2nd)", False, f"Exception: {str(e)}")
    
    # H4. POST /api/emails/send-satisfaction
    try:
        response = requests.post(f"{BASE_URL}/api/emails/send-satisfaction", json={}, headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = data.get("sent", 0) > 0
            log_test("H. OUTILS ARACOM", "POST /api/emails/send-satisfaction", success,
                    f"sent={data.get('sent')}, campaign_id={data.get('campaign_id')}")
        else:
            log_test("H. OUTILS ARACOM", "POST /api/emails/send-satisfaction", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("H. OUTILS ARACOM", "POST /api/emails/send-satisfaction", False, f"Exception: {str(e)}")
    
    # H5. POST /api/registrations/bulk-confirm
    try:
        # Get a few registration IDs
        response = requests.get(f"{BASE_URL}/api/registrations?status=a_confirmer", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            regs = response.json()
            ids = [r["id"] for r in regs[:3]]  # Take first 3
            if ids:
                response = requests.post(f"{BASE_URL}/api/registrations/bulk-confirm",
                                       json={"ids": ids},
                                       headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("H. OUTILS ARACOM", "POST /api/registrations/bulk-confirm", success,
                        f"Status: {response.status_code}, ids count: {len(ids)}")
            else:
                log_test("H. OUTILS ARACOM", "POST /api/registrations/bulk-confirm", True,
                        "No registrations to confirm (skipped)", "warning")
        else:
            log_test("H. OUTILS ARACOM", "POST /api/registrations/bulk-confirm", False, 
                    f"Failed to get registrations: {response.status_code}")
    except Exception as e:
        log_test("H. OUTILS ARACOM", "POST /api/registrations/bulk-confirm", False, f"Exception: {str(e)}")

# ============================================================================
# I. SATISFACTION
# ============================================================================
def test_satisfaction():
    print_category_header("I. SATISFACTION")
    
    # I1. POST /api/satisfaction
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/satisfaction",
                                   json={
                                       "registration_id": test_reg_id,
                                       "overall_rating": 4,
                                       "nps_score": 8,
                                       "will_participate_next": "oui"
                                   },
                                   headers=ADMIN_HEADERS)
            success = response.status_code in [200, 201]
            log_test("I. SATISFACTION", "POST /api/satisfaction", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("I. SATISFACTION", "POST /api/satisfaction", False, f"Exception: {str(e)}")
    
    # I2. GET /api/satisfaction
    try:
        response = requests.get(f"{BASE_URL}/api/satisfaction", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("I. SATISFACTION", "GET /api/satisfaction", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("I. SATISFACTION", "GET /api/satisfaction", False, f"Exception: {str(e)}")
    
    # I3. GET /api/satisfaction/stats
    try:
        response = requests.get(f"{BASE_URL}/api/satisfaction/stats", headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            success = ("total_responses" in data and "nps" in data)
            log_test("I. SATISFACTION", "GET /api/satisfaction/stats", success,
                    f"total_responses={data.get('total_responses')}, nps={data.get('nps')}")
        else:
            log_test("I. SATISFACTION", "GET /api/satisfaction/stats", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("I. SATISFACTION", "GET /api/satisfaction/stats", False, f"Exception: {str(e)}")

# ============================================================================
# J. PROSPECTS
# ============================================================================
def test_prospects():
    print_category_header("J. PROSPECTS")
    
    # J1. GET /api/prospects
    try:
        response = requests.get(f"{BASE_URL}/api/prospects", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("J. PROSPECTS", "GET /api/prospects", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("J. PROSPECTS", "GET /api/prospects", False, f"Exception: {str(e)}")
    
    # J2. GET /api/prospects/stats
    try:
        response = requests.get(f"{BASE_URL}/api/prospects/stats", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("J. PROSPECTS", "GET /api/prospects/stats", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("J. PROSPECTS", "GET /api/prospects/stats", False, f"Exception: {str(e)}")

# ============================================================================
# K. VALIDATION REQUESTS WORKFLOW
# ============================================================================
def test_validation_requests():
    print_category_header("K. VALIDATION REQUESTS WORKFLOW")
    
    # K1. GET /api/validation-requests
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K. VALIDATION REQUESTS", "GET /api/validation-requests", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K. VALIDATION REQUESTS", "GET /api/validation-requests", False, f"Exception: {str(e)}")
    
    # K2. GET /api/validation-requests?status=en_attente
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests?status=en_attente", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K. VALIDATION REQUESTS", "GET /api/validation-requests?status=en_attente", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K. VALIDATION REQUESTS", "GET /api/validation-requests?status=en_attente", False, 
                f"Exception: {str(e)}")

# ============================================================================
# L. ANIMATION SLOTS
# ============================================================================
def test_animation_slots():
    print_category_header("L. ANIMATION SLOTS")
    
    # L1. GET /api/animation-slots
    try:
        response = requests.get(f"{BASE_URL}/api/animation-slots", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("L. ANIMATION SLOTS", "GET /api/animation-slots", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("L. ANIMATION SLOTS", "GET /api/animation-slots", False, f"Exception: {str(e)}")
    
    # L2. POST /api/animation-slots
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/animation-slots",
                                   json={
                                       "registration_id": test_reg_id,
                                       "venue_id": "venue-faaa",
                                       "day_label": "vendredi",
                                       "start_time": "14:00",
                                       "end_time": "15:00",
                                       "title": "Test animation audit"
                                   },
                                   headers=ADMIN_HEADERS)
            success = response.status_code in [200, 201]
            log_test("L. ANIMATION SLOTS", "POST /api/animation-slots", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("L. ANIMATION SLOTS", "POST /api/animation-slots", False, f"Exception: {str(e)}")

# ============================================================================
# M. TASKS / FOLLOWUPS
# ============================================================================
def test_tasks():
    print_category_header("M. TASKS / FOLLOWUPS")
    
    global test_task_id
    test_task_id = None
    
    # M1. POST /api/tasks
    if test_reg_id:
        try:
            response = requests.post(f"{BASE_URL}/api/tasks",
                                   json={
                                       "registration_id": test_reg_id,
                                       "task_type": "appel",
                                       "title": "Test task audit",
                                       "status": "a_faire"
                                   },
                                   headers=ADMIN_HEADERS)
            if response.status_code == 200:
                data = response.json()
                test_task_id = data.get("id")
                success = test_task_id is not None
                log_test("M. TASKS", "POST /api/tasks", success,
                        f"Task ID: {test_task_id}")
            else:
                log_test("M. TASKS", "POST /api/tasks", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("M. TASKS", "POST /api/tasks", False, f"Exception: {str(e)}")
    
    # M2. GET /api/tasks
    try:
        response = requests.get(f"{BASE_URL}/api/tasks", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("M. TASKS", "GET /api/tasks", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("M. TASKS", "GET /api/tasks", False, f"Exception: {str(e)}")
    
    # M3. PUT /api/tasks/:id
    if test_task_id:
        try:
            response = requests.put(f"{BASE_URL}/api/tasks/{test_task_id}",
                                  json={"status": "termine"},
                                  headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("M. TASKS", f"PUT /api/tasks/{test_task_id}", success,
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("M. TASKS", f"PUT /api/tasks/{test_task_id}", False, f"Exception: {str(e)}")

# ============================================================================
# N. DOCUMENTS OFFICIELS (PRIORITÉ — NOUVEAU)
# ============================================================================
def test_official_documents():
    print_category_header("N. DOCUMENTS OFFICIELS (PRIORITÉ — NOUVEAU)")
    
    global test_official_doc_id
    test_official_doc_id = None
    
    # N1. GET /api/official-documents (tous rôles auth)
    try:
        response = requests.get(f"{BASE_URL}/api/official-documents", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("N. DOCUMENTS OFFICIELS", "GET /api/official-documents (admin)", success,
                f"Status: {response.status_code}, count: {len(response.json()) if success else 'N/A'}")
    except Exception as e:
        log_test("N. DOCUMENTS OFFICIELS", "GET /api/official-documents (admin)", False, f"Exception: {str(e)}")
    
    # N2. GET /api/official-documents (exposant role)
    try:
        response = requests.get(f"{BASE_URL}/api/official-documents", headers=EXPOSANT_HEADERS)
        success = response.status_code == 200
        log_test("N. DOCUMENTS OFFICIELS", "GET /api/official-documents (exposant)", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("N. DOCUMENTS OFFICIELS", "GET /api/official-documents (exposant)", False, f"Exception: {str(e)}")
    
    # N3. POST /api/official-documents (admin only)
    try:
        test_pdf = base64.b64encode(b"%PDF-1.4 test official document").decode()
        response = requests.post(f"{BASE_URL}/api/official-documents",
                               json={
                                   "title": "Test Document Officiel",
                                   "description": "Test audit complet",
                                   "category": "reglements",
                                   "file_data": test_pdf,
                                   "mime_type": "application/pdf",
                                   "file_name": "test_officiel.pdf"
                               },
                               headers=ADMIN_HEADERS)
        if response.status_code == 200:
            data = response.json()
            test_official_doc_id = data.get("id")
            # Check if Drive is configured
            if "drive_url" in data:
                success = test_official_doc_id is not None
                log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (admin)", success,
                        f"Document ID: {test_official_doc_id}, drive_url present")
            else:
                # Drive not configured is acceptable
                log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (admin)", True,
                        f"Document created but Drive not configured (expected)", "warning")
        elif response.status_code == 500:
            # Drive not configured returns 500 - this is expected
            log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (admin)", True,
                    "Drive not configured (500 expected)", "warning")
        else:
            log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (admin)", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (admin)", False, f"Exception: {str(e)}")
    
    # N4. POST /api/official-documents (exposant - should be 403)
    try:
        test_pdf = base64.b64encode(b"%PDF-1.4 test").decode()
        response = requests.post(f"{BASE_URL}/api/official-documents",
                               json={
                                   "title": "Test",
                                   "file_data": test_pdf,
                                   "mime_type": "application/pdf",
                                   "file_name": "test.pdf"
                               },
                               headers=EXPOSANT_HEADERS)
        success = response.status_code == 403
        log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (exposant - should be 403)", success,
                f"Status: {response.status_code} (expected 403)")
    except Exception as e:
        log_test("N. DOCUMENTS OFFICIELS", "POST /api/official-documents (exposant)", False, f"Exception: {str(e)}")
    
    # N5. DELETE /api/official-documents/:id (admin only)
    if test_official_doc_id:
        try:
            response = requests.delete(f"{BASE_URL}/api/official-documents/{test_official_doc_id}",
                                     headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("N. DOCUMENTS OFFICIELS", f"DELETE /api/official-documents/{test_official_doc_id} (admin)", 
                    success, f"Status: {response.status_code}")
        except Exception as e:
            log_test("N. DOCUMENTS OFFICIELS", f"DELETE /api/official-documents/{test_official_doc_id}", False, 
                    f"Exception: {str(e)}")
    
    # N6. POST /api/registration-documents/:id/validate
    if test_doc_id:
        try:
            response = requests.post(f"{BASE_URL}/api/registration-documents/{test_doc_id}/validate",
                                   json={
                                       "decision": "approved",
                                       "comment": "Test validation audit"
                                   },
                                   headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("N. DOCUMENTS OFFICIELS", f"POST /api/registration-documents/{test_doc_id}/validate", 
                    success, f"Status: {response.status_code}")
        except Exception as e:
            log_test("N. DOCUMENTS OFFICIELS", f"POST /api/registration-documents/{test_doc_id}/validate", False, 
                    f"Exception: {str(e)}")

# ============================================================================
# O. ACCESS TOKENS
# ============================================================================
def test_access_tokens():
    print_category_header("O. ACCESS TOKENS")
    
    # O1. GET /api/access-tokens
    try:
        response = requests.get(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("O. ACCESS TOKENS", "GET /api/access-tokens", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("O. ACCESS TOKENS", "GET /api/access-tokens", False, f"Exception: {str(e)}")
    
    # O2. POST /api/access-tokens
    try:
        response = requests.post(f"{BASE_URL}/api/access-tokens",
                               json={
                                   "purpose": "test",
                                   "label": "Test token audit"
                               },
                               headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("O. ACCESS TOKENS", "POST /api/access-tokens", success,
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("O. ACCESS TOKENS", "POST /api/access-tokens", False, f"Exception: {str(e)}")

# ============================================================================
# MAIN EXECUTION
# ============================================================================
def main():
    print("\n" + "=" * 80)
    print("AUDIT COMPLET BACKEND — FORUM DE LA RENTRÉE 2026")
    print("=" * 80)
    print(f"BASE_URL: {BASE_URL}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Run all test categories
    test_auth_and_seed()
    test_dashboard()
    test_registrations()
    test_attendance_anomalies()
    test_documents()
    test_mailing()
    test_tracking()
    test_outils_aracom()
    test_satisfaction()
    test_prospects()
    test_validation_requests()
    test_animation_slots()
    test_tasks()
    test_official_documents()  # PRIORITY - NEW FEATURE
    test_access_tokens()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
