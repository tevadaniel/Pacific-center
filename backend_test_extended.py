#!/usr/bin/env python3
"""
AUDIT ÉTENDU - Tests complémentaires pour catégories F, I et tests approfondis
"""

import requests
import json
import sys
import base64
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:3000"
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-admin",
    "x-user-role": "aracom_admin"
}

# Test results tracking
test_results = {
    "F_ATTENDANCE": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "I_TRACKING": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "EXTENDED": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
}

def log_test(category, test_name, success, details="", severity="minor"):
    """Log test result"""
    status = "✅" if success else "❌"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    
    test_results[category]["tested"] += 1
    if success:
        test_results[category]["ok"] += 1
    else:
        test_results[category]["ko"] += 1
        test_results[category]["anomalies"].append({
            "test": test_name,
            "details": details,
            "severity": severity
        })
    
    return success

def print_section(title):
    """Print section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

# ============================================================================
# F. ATTENDANCE / ANOMALIES / FIELD MEDIA
# ============================================================================
def test_attendance():
    print_section("F. ATTENDANCE / ANOMALIES / FIELD MEDIA")
    
    # Test 1: GET /api/attendance?event_date=2026-08-14 (vendredi)
    try:
        response = requests.get(f"{BASE_URL}/api/attendance?event_date=2026-08-14", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("F_ATTENDANCE", "GET /api/attendance?event_date=2026-08-14", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("F_ATTENDANCE", "GET /api/attendance?event_date=2026-08-14", False, str(e))
    
    # Test 2: GET /api/attendance?event_date=2026-08-15 (samedi)
    try:
        response = requests.get(f"{BASE_URL}/api/attendance?event_date=2026-08-15", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("F_ATTENDANCE", "GET /api/attendance?event_date=2026-08-15", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("F_ATTENDANCE", "GET /api/attendance?event_date=2026-08-15", False, str(e))
    
    # Test 3: POST /api/attendance/:regId/check-in
    try:
        # Get a registration first
        regs_response = requests.get(f"{BASE_URL}/api/registrations?status=confirme", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                payload = {
                    "event_date": "2026-08-14",
                    "actual_time": "11:30:00"
                }
                response = requests.post(f"{BASE_URL}/api/attendance/{reg_id}/check-in", 
                                       json=payload, headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("F_ATTENDANCE", "POST /api/attendance/:regId/check-in", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("F_ATTENDANCE", "POST /api/attendance/:regId/check-in", False, 
                        "No confirmed registrations found")
        else:
            log_test("F_ATTENDANCE", "POST /api/attendance/:regId/check-in", False, 
                    "Failed to get registrations")
    except Exception as e:
        log_test("F_ATTENDANCE", "POST /api/attendance/:regId/check-in", False, str(e))
    
    # Test 4: POST /api/anomalies
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                payload = {
                    "registration_id": reg_id,
                    "anomaly_type": "stand_non_conforme",
                    "severity": "moyenne",
                    "description": "Test anomalie",
                    "detected_at": datetime.now().isoformat()
                }
                response = requests.post(f"{BASE_URL}/api/anomalies", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("F_ATTENDANCE", "POST /api/anomalies", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("F_ATTENDANCE", "POST /api/anomalies", False, "No registrations found")
        else:
            log_test("F_ATTENDANCE", "POST /api/anomalies", False, "Failed to get registrations")
    except Exception as e:
        log_test("F_ATTENDANCE", "POST /api/anomalies", False, str(e))
    
    # Test 5: GET /api/anomalies
    try:
        response = requests.get(f"{BASE_URL}/api/anomalies", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("F_ATTENDANCE", "GET /api/anomalies", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("F_ATTENDANCE", "GET /api/anomalies", False, str(e))
    
    # Test 6: PUT /api/anomalies/:id
    try:
        # Get an anomaly first
        anomalies_response = requests.get(f"{BASE_URL}/api/anomalies", headers=ADMIN_HEADERS)
        if anomalies_response.status_code == 200:
            anomalies = anomalies_response.json()
            if len(anomalies) > 0:
                anomaly_id = anomalies[0]["id"]
                payload = {
                    "resolved_status": "resolu_ok",
                    "resolution_notes": "Test résolution"
                }
                response = requests.put(f"{BASE_URL}/api/anomalies/{anomaly_id}", 
                                      json=payload, headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("F_ATTENDANCE", "PUT /api/anomalies/:id", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("F_ATTENDANCE", "PUT /api/anomalies/:id", False, "No anomalies found")
        else:
            log_test("F_ATTENDANCE", "PUT /api/anomalies/:id", False, "Failed to get anomalies")
    except Exception as e:
        log_test("F_ATTENDANCE", "PUT /api/anomalies/:id", False, str(e))
    
    # Test 7: POST /api/field-comments
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                payload = {
                    "registration_id": reg_id,
                    "comment_type": "observation",
                    "comment_text": "Test commentaire terrain",
                    "created_at": datetime.now().isoformat()
                }
                response = requests.post(f"{BASE_URL}/api/field-comments", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("F_ATTENDANCE", "POST /api/field-comments", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("F_ATTENDANCE", "POST /api/field-comments", False, "No registrations found")
        else:
            log_test("F_ATTENDANCE", "POST /api/field-comments", False, "Failed to get registrations")
    except Exception as e:
        log_test("F_ATTENDANCE", "POST /api/field-comments", False, str(e))
    
    # Test 8: POST /api/field-media (simple test)
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                # Create a small test image (1x1 pixel PNG)
                test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                payload = {
                    "registration_id": reg_id,
                    "media_type": "photo_arrivee",
                    "file_data_base64": test_image,
                    "file_name": "test.png",
                    "mime_type": "image/png"
                }
                response = requests.post(f"{BASE_URL}/api/field-media", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("F_ATTENDANCE", "POST /api/field-media", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("F_ATTENDANCE", "POST /api/field-media", False, "No registrations found")
        else:
            log_test("F_ATTENDANCE", "POST /api/field-media", False, "Failed to get registrations")
    except Exception as e:
        log_test("F_ATTENDANCE", "POST /api/field-media", False, str(e))

# ============================================================================
# I. TRACKING
# ============================================================================
def test_tracking():
    print_section("I. TRACKING")
    
    # Test 1: GET /api/track/open/<id>.gif
    try:
        response = requests.get(f"{BASE_URL}/api/track/open/test-tracking-id.gif", headers=ADMIN_HEADERS)
        success = response.status_code == 200 and response.headers.get("Content-Type") == "image/gif"
        log_test("I_TRACKING", "GET /api/track/open/<id>.gif → 200 image/gif", success, 
                f"Status: {response.status_code}, Content-Type: {response.headers.get('Content-Type')}")
    except Exception as e:
        log_test("I_TRACKING", "GET /api/track/open/<id>.gif → 200 image/gif", False, str(e))
    
    # Test 2: GET /api/track/click/<id>?u=https://example.com → 302
    try:
        response = requests.get(f"{BASE_URL}/api/track/click/test-click-id?u=https://example.com", 
                              headers=ADMIN_HEADERS, allow_redirects=False)
        success = response.status_code == 302
        log_test("I_TRACKING", "GET /api/track/click/<id>?u=... → 302", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("I_TRACKING", "GET /api/track/click/<id>?u=... → 302", False, str(e))
    
    # Test 3: GET /api/track/click/<id> without u → 400
    try:
        response = requests.get(f"{BASE_URL}/api/track/click/test-click-id", headers=ADMIN_HEADERS)
        success = response.status_code == 400
        log_test("I_TRACKING", "GET /api/track/click/<id> (no u) → 400", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("I_TRACKING", "GET /api/track/click/<id> (no u) → 400", False, str(e))

# ============================================================================
# EXTENDED TESTS - Additional edge cases and validations
# ============================================================================
def test_extended():
    print_section("EXTENDED TESTS - Edge Cases & Validations")
    
    # Test 1: POST /api/documents (upload test)
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                # Create a small test PDF
                test_pdf = "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDMgM10+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMTAgMDAwMDAgbgowMDAwMDAwMDUzIDAwMDAwIG4KMDAwMDAwMDEwMiAwMDAwMCBuCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTQ5CiUlRU9G"
                payload = {
                    "registration_id": reg_id,
                    "document_type": "assurance",
                    "file_data_base64": test_pdf,
                    "file_name": "test_assurance.pdf",
                    "mime_type": "application/pdf"
                }
                response = requests.post(f"{BASE_URL}/api/documents", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("EXTENDED", "POST /api/documents (upload)", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("EXTENDED", "POST /api/documents (upload)", False, "No registrations found")
        else:
            log_test("EXTENDED", "POST /api/documents (upload)", False, "Failed to get registrations")
    except Exception as e:
        log_test("EXTENDED", "POST /api/documents (upload)", False, str(e))
    
    # Test 2: PUT /api/documents/:id (validation)
    try:
        # Get documents first
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                docs_response = requests.get(f"{BASE_URL}/api/documents?registration_id={reg_id}", 
                                            headers=ADMIN_HEADERS)
                if docs_response.status_code == 200:
                    docs = docs_response.json()
                    if len(docs) > 0:
                        doc_id = docs[0]["id"]
                        payload = {"status": "valide"}
                        response = requests.put(f"{BASE_URL}/api/documents/{doc_id}", 
                                              json=payload, headers=ADMIN_HEADERS)
                        success = response.status_code == 200
                        log_test("EXTENDED", "PUT /api/documents/:id (validate)", success, 
                                f"Status: {response.status_code}")
                    else:
                        log_test("EXTENDED", "PUT /api/documents/:id (validate)", False, "No documents found")
                else:
                    log_test("EXTENDED", "PUT /api/documents/:id (validate)", False, "Failed to get documents")
            else:
                log_test("EXTENDED", "PUT /api/documents/:id (validate)", False, "No registrations found")
        else:
            log_test("EXTENDED", "PUT /api/documents/:id (validate)", False, "Failed to get registrations")
    except Exception as e:
        log_test("EXTENDED", "PUT /api/documents/:id (validate)", False, str(e))
    
    # Test 3: POST /api/satisfaction (upsert)
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                payload = {
                    "registration_id": reg_id,
                    "overall_rating": 4,
                    "organization_rating": 5,
                    "stand_rating": 4,
                    "visitors_rating": 3,
                    "communication_rating": 5,
                    "nps_score": 9,
                    "will_participate_next": "oui",
                    "positive_points": "Test positif",
                    "improvement_points": "Test amélioration",
                    "additional_comments": "Test commentaire"
                }
                response = requests.post(f"{BASE_URL}/api/satisfaction", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("EXTENDED", "POST /api/satisfaction (upsert)", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("EXTENDED", "POST /api/satisfaction (upsert)", False, "No registrations found")
        else:
            log_test("EXTENDED", "POST /api/satisfaction (upsert)", False, "Failed to get registrations")
    except Exception as e:
        log_test("EXTENDED", "POST /api/satisfaction (upsert)", False, str(e))
    
    # Test 4: POST /api/prospects
    try:
        venues_response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        if venues_response.status_code == 200:
            venues = venues_response.json()
            if len(venues) > 0:
                venue_id = venues[0]["id"]
                payload = {
                    "venue_id": venue_id,
                    "organization_name": "Test Prospect",
                    "contact_name": "Test Contact",
                    "contact_email": "test@prospect.pf",
                    "contact_phone": "40123456",
                    "discipline": "Sport",
                    "status": "a_contacter"
                }
                response = requests.post(f"{BASE_URL}/api/prospects", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("EXTENDED", "POST /api/prospects", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("EXTENDED", "POST /api/prospects", False, "No venues found")
        else:
            log_test("EXTENDED", "POST /api/prospects", False, "Failed to get venues")
    except Exception as e:
        log_test("EXTENDED", "POST /api/prospects", False, str(e))
    
    # Test 5: POST /api/emails/send-satisfaction
    try:
        response = requests.post(f"{BASE_URL}/api/emails/send-satisfaction", json={}, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "sent" in data and "campaign_id" in data
        log_test("EXTENDED", "POST /api/emails/send-satisfaction", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("EXTENDED", "POST /api/emails/send-satisfaction", False, str(e))
    
    # Test 6: POST /api/registrations/:id/generate-caution-receipt
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations?status=confirme", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                response = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/generate-caution-receipt", 
                                       json={}, headers=ADMIN_HEADERS)
                success = response.status_code == 200
                if success:
                    data = response.json()
                    success = "receipt_number" in data and data.get("receipt_number", "").startswith("CAUT-2026-")
                log_test("EXTENDED", "POST /api/registrations/:id/generate-caution-receipt", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("EXTENDED", "POST /api/registrations/:id/generate-caution-receipt", False, 
                        "No confirmed registrations found")
        else:
            log_test("EXTENDED", "POST /api/registrations/:id/generate-caution-receipt", False, 
                    "Failed to get registrations")
    except Exception as e:
        log_test("EXTENDED", "POST /api/registrations/:id/generate-caution-receipt", False, str(e))
    
    # Test 7: POST /api/mailing/schedule
    try:
        payload = {
            "subject": "Test scheduled email",
            "body_html": "<p>Test</p>",
            "registration_ids": [],
            "scheduled_for": (datetime.now() + timedelta(hours=1)).isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/mailing/schedule", json=payload, headers=ADMIN_HEADERS)
        success = response.status_code in [200, 201]
        log_test("EXTENDED", "POST /api/mailing/schedule", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("EXTENDED", "POST /api/mailing/schedule", False, str(e))
    
    # Test 8: POST /api/registrations/bulk-generate-receipts
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations?status=confirme", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_ids = [reg["id"] for reg in regs[:2]]  # Take first 2
                payload = {"ids": reg_ids}
                response = requests.post(f"{BASE_URL}/api/registrations/bulk-generate-receipts", 
                                       json=payload, headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("EXTENDED", "POST /api/registrations/bulk-generate-receipts", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("EXTENDED", "POST /api/registrations/bulk-generate-receipts", False, 
                        "No confirmed registrations found")
        else:
            log_test("EXTENDED", "POST /api/registrations/bulk-generate-receipts", False, 
                    "Failed to get registrations")
    except Exception as e:
        log_test("EXTENDED", "POST /api/registrations/bulk-generate-receipts", False, str(e))

# ============================================================================
# MAIN EXECUTION
# ============================================================================
def print_summary():
    """Print final summary report"""
    print("\n" + "=" * 80)
    print("  RAPPORT FINAL - TESTS ÉTENDUS")
    print("=" * 80)
    
    print("\n| Catégorie | Endpoints testés | OK | KO | Anomalies |")
    print("|-----------|------------------|----|----|-----------|")
    
    total_tested = 0
    total_ok = 0
    total_ko = 0
    critical_anomalies = []
    minor_anomalies = []
    
    for category, results in test_results.items():
        tested = results["tested"]
        ok = results["ok"]
        ko = results["ko"]
        anomalies_count = len(results["anomalies"])
        
        total_tested += tested
        total_ok += ok
        total_ko += ko
        
        # Categorize anomalies
        for anomaly in results["anomalies"]:
            if anomaly["severity"] == "critical":
                critical_anomalies.append(f"{category}: {anomaly['test']} - {anomaly['details']}")
            else:
                minor_anomalies.append(f"{category}: {anomaly['test']} - {anomaly['details']}")
        
        print(f"| {category.replace('_', ' ')} | {tested} | {ok} | {ko} | {anomalies_count} |")
    
    print("|-----------|------------------|----|----|-----------|")
    print(f"| **TOTAL** | **{total_tested}** | **{total_ok}** | **{total_ko}** | **{len(critical_anomalies) + len(minor_anomalies)}** |")
    
    # Print critical anomalies
    if critical_anomalies:
        print("\n" + "=" * 80)
        print("  ANOMALIES CRITIQUES")
        print("=" * 80)
        for i, anomaly in enumerate(critical_anomalies, 1):
            print(f"{i}. {anomaly}")
    else:
        print("\n✅ Aucune anomalie critique détectée")
    
    # Print minor anomalies
    if minor_anomalies:
        print("\n" + "=" * 80)
        print("  ANOMALIES MINEURES")
        print("=" * 80)
        for i, anomaly in enumerate(minor_anomalies, 1):
            print(f"{i}. {anomaly}")
    else:
        print("\n✅ Aucune anomalie mineure détectée")
    
    # Success rate
    success_rate = (total_ok / total_tested * 100) if total_tested > 0 else 0
    print("\n" + "=" * 80)
    print(f"  TAUX DE RÉUSSITE: {success_rate:.1f}% ({total_ok}/{total_tested})")
    print("=" * 80)
    
    if total_ko == 0:
        print("\n🎉 TOUS LES TESTS ÉTENDUS SONT PASSÉS!")
        return 0
    else:
        print(f"\n⚠️  {total_ko} tests ont échoué - Voir détails ci-dessus")
        return 1

if __name__ == "__main__":
    print("=" * 80)
    print("  AUDIT ÉTENDU - Tests complémentaires")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    # Run all tests
    test_attendance()
    test_tracking()
    test_extended()
    
    # Print summary and exit
    exit_code = print_summary()
    sys.exit(exit_code)
