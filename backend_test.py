#!/usr/bin/env python3
"""
Backend testing script for Forum de la Rentrée 2026 - Mailing Module
Tests the new mailing endpoints with AI generation and SMTP integration.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "admin"
}

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    return success

def test_mailing_generate_ai():
    """Test POST /api/mailing/generate-ai endpoint"""
    print("\n=== Testing POST /api/mailing/generate-ai ===")
    
    # Test 1: Basic AI generation with empty registration_ids
    try:
        payload = {
            "mail_type": "relance_caution",
            "registration_ids": [],
            "tone": "professionnel chaleureux"
        }
        response = requests.post(f"{BASE_URL}/mailing/generate-ai", 
                               headers=HEADERS, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is True and
                isinstance(data.get("subject"), str) and len(data.get("subject", "")) > 0 and
                isinstance(data.get("body_html"), str) and "<p>" in data.get("body_html", "") and
                data.get("target_count") == 0 and
                "usage" in data and
                "prompt_tokens" in data.get("usage", {}) and
                "completion_tokens" in data.get("usage", {})
            )
            log_test("AI generation with empty registration_ids", success, 
                    f"Subject: {data.get('subject', '')[:50]}..., Usage: {data.get('usage')}")
        else:
            log_test("AI generation with empty registration_ids", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("AI generation with empty registration_ids", False, f"Exception: {str(e)}")
    
    # Test 2: Get a valid registration_id first
    try:
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS, timeout=10)
        if reg_response.status_code == 200:
            registrations = reg_response.json()
            if registrations:
                valid_reg_id = registrations[0]["id"]
                org_name = registrations[0].get("organization", {}).get("name", "")
                
                # Test with valid registration_id
                payload = {
                    "mail_type": "relance_assurance",
                    "registration_ids": [valid_reg_id],
                    "tone": "professionnel chaleureux"
                }
                response = requests.post(f"{BASE_URL}/mailing/generate-ai", 
                                       headers=HEADERS, json=payload, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    success = (
                        data.get("ok") is True and
                        data.get("target_count") == 1 and
                        org_name.lower() in data.get("body_html", "").lower() if org_name else True
                    )
                    log_test("AI generation with valid registration_id", success,
                            f"Target count: {data.get('target_count')}, Organization mentioned: {org_name in data.get('body_html', '') if org_name else 'N/A'}")
                else:
                    log_test("AI generation with valid registration_id", False,
                            f"Status: {response.status_code}")
            else:
                log_test("AI generation with valid registration_id", False, "No registrations found")
        else:
            log_test("AI generation with valid registration_id", False, "Could not fetch registrations")
    except Exception as e:
        log_test("AI generation with valid registration_id", False, f"Exception: {str(e)}")
    
    # Test 3: Missing mail_type should return 400
    try:
        payload = {"registration_ids": []}
        response = requests.post(f"{BASE_URL}/mailing/generate-ai", 
                               headers=HEADERS, json=payload, timeout=10)
        success = response.status_code == 400 and "mail_type requis" in response.text
        log_test("AI generation without mail_type (400 expected)", success,
                f"Status: {response.status_code}, Message: {response.text[:100]}")
    except Exception as e:
        log_test("AI generation without mail_type (400 expected)", False, f"Exception: {str(e)}")

def test_mailing_test_smtp():
    """Test POST /api/mailing/test-smtp endpoint"""
    print("\n=== Testing POST /api/mailing/test-smtp ===")
    
    try:
        response = requests.post(f"{BASE_URL}/mailing/test-smtp", 
                               headers=HEADERS, json={}, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is False and  # Should be false since SMTP_PASSWORD is empty
                data.get("configured") is False and
                data.get("host") == "smtp.gmail.com" and
                data.get("user") == "agence@aracom-conseil.fr" and
                data.get("from_email") == "agence@aracom-conseil.fr" and
                "SMTP non configuré" in data.get("error", "")
            )
            log_test("SMTP test (unconfigured)", success,
                    f"OK: {data.get('ok')}, Configured: {data.get('configured')}, Error: {data.get('error')}")
        else:
            log_test("SMTP test (unconfigured)", False,
                    f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("SMTP test (unconfigured)", False, f"Exception: {str(e)}")

def test_mailing_send_test():
    """Test POST /api/mailing/send-test endpoint"""
    print("\n=== Testing POST /api/mailing/send-test ===")
    
    # Test 1: With valid email but SMTP not configured (should return 400)
    try:
        payload = {"to": "test@example.com"}
        response = requests.post(f"{BASE_URL}/mailing/send-test", 
                               headers=HEADERS, json=payload, timeout=10)
        success = response.status_code == 400 and "SMTP non configuré" in response.text
        log_test("Send test email (SMTP unconfigured, 400 expected)", success,
                f"Status: {response.status_code}, Message: {response.text[:100]}")
    except Exception as e:
        log_test("Send test email (SMTP unconfigured, 400 expected)", False, f"Exception: {str(e)}")
    
    # Test 2: Missing 'to' field should return 400
    try:
        payload = {}
        response = requests.post(f"{BASE_URL}/mailing/send-test", 
                               headers=HEADERS, json=payload, timeout=10)
        success = response.status_code == 400 and "to requis" in response.text
        log_test("Send test email without 'to' (400 expected)", success,
                f"Status: {response.status_code}, Message: {response.text[:100]}")
    except Exception as e:
        log_test("Send test email without 'to' (400 expected)", False, f"Exception: {str(e)}")

def test_mailing_send():
    """Test POST /api/mailing/send endpoint"""
    print("\n=== Testing POST /api/mailing/send ===")
    
    # First get some valid registration IDs
    try:
        reg_response = requests.get(f"{BASE_URL}/registrations", headers=HEADERS, timeout=10)
        if reg_response.status_code == 200:
            registrations = reg_response.json()
            if len(registrations) >= 3:
                reg_ids = [reg["id"] for reg in registrations[:3]]
                
                payload = {
                    "subject": "Test mailing",
                    "body_html": "<p>Hello [[NOM_EXPOSANT]]</p>",
                    "registration_ids": reg_ids,
                    "mail_type": "annonce"
                }
                
                response = requests.post(f"{BASE_URL}/mailing/send", 
                                       headers=HEADERS, json=payload, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    success = (
                        data.get("ok") is True and
                        data.get("smtp_used") is False and  # Should be false (mock mode)
                        data.get("sent", 0) >= 0 and
                        data.get("failed", 0) == 0 and
                        "campaign_id" in data
                    )
                    log_test("Send composed email (mock mode)", success,
                            f"Sent: {data.get('sent')}, Failed: {data.get('failed')}, SMTP used: {data.get('smtp_used')}")
                    
                    # Verify campaign was created
                    if success and data.get("campaign_id"):
                        emails_response = requests.get(f"{BASE_URL}/emails", headers=HEADERS, timeout=10)
                        if emails_response.status_code == 200:
                            emails = emails_response.json()
                            recent_campaign = next((e for e in emails if e.get("subject") == "Test mailing"), None)
                            if recent_campaign:
                                log_test("Campaign created in database", True,
                                        f"Found campaign with subject: {recent_campaign.get('subject')}")
                            else:
                                log_test("Campaign created in database", False, "Campaign not found in emails")
                else:
                    log_test("Send composed email (mock mode)", False,
                            f"Status: {response.status_code}, Response: {response.text[:200]}")
            else:
                log_test("Send composed email (mock mode)", False, "Not enough registrations found")
        else:
            log_test("Send composed email (mock mode)", False, "Could not fetch registrations")
    except Exception as e:
        log_test("Send composed email (mock mode)", False, f"Exception: {str(e)}")

def test_non_regression():
    """Test that existing endpoints still work (non-regression)"""
    print("\n=== Testing Non-Regression Endpoints ===")
    
    # Test satisfaction stats
    try:
        response = requests.get(f"{BASE_URL}/satisfaction/stats", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            success = (
                "total_responses" in data and
                "avg_overall" in data and
                "nps_score" in data and
                "by_site" in data
            )
            log_test("GET /api/satisfaction/stats", success,
                    f"Total responses: {data.get('total_responses')}, NPS: {data.get('nps_score')}")
        else:
            log_test("GET /api/satisfaction/stats", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/satisfaction/stats", False, f"Exception: {str(e)}")
    
    # Test recompute completion
    try:
        response = requests.post(f"{BASE_URL}/tools/recompute-completion", 
                               headers=HEADERS, json={}, timeout=15)
        if response.status_code == 200:
            data = response.json()
            success = (
                data.get("ok") is True and
                "total" in data and
                "updated" in data
            )
            log_test("POST /api/tools/recompute-completion", success,
                    f"Total: {data.get('total')}, Updated: {data.get('updated')}")
        else:
            log_test("POST /api/tools/recompute-completion", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/tools/recompute-completion", False, f"Exception: {str(e)}")
    
    # Test dashboard KPIs
    try:
        response = requests.get(f"{BASE_URL}/dashboard/kpis", headers=HEADERS, timeout=10)
        if response.status_code == 200:
            data = response.json()
            success = (
                "total" in data and
                "by_status" in data and
                "cautions_recues" in data
            )
            log_test("GET /api/dashboard/kpis", success,
                    f"Total: {data.get('total')}, Cautions reçues: {data.get('cautions_recues')}")
        else:
            log_test("GET /api/dashboard/kpis", False,
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/kpis", False, f"Exception: {str(e)}")

def main():
    """Run all mailing tests"""
    print("🧪 TESTING MAILING MODULE - Forum de la Rentrée 2026")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    test_mailing_generate_ai()
    test_mailing_test_smtp()
    test_mailing_send_test()
    test_mailing_send()
    test_non_regression()
    
    print("\n" + "=" * 60)
    print("🏁 MAILING TESTS COMPLETED")
    print(f"Test finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()