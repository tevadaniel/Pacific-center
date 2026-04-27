#!/usr/bin/env python3
"""
Test final des endpoints avancés - Forum de la Rentrée 2026
Endpoints: BULK ACTIONS + SCHEDULED MAILING + TRACKING + DASHBOARD EXTENDED + NON-RÉGRESSION
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "admin"
}

def log_test(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")
    print()

def main():
    print("🧪 TEST FINAL - ENDPOINTS AVANCÉS FORUM DE LA RENTRÉE 2026")
    print("=" * 70)
    
    # 0. SEED OBLIGATOIRE
    print("=== 0. SEED AVEC FORCE=TRUE ===")
    response = requests.post(f"{BASE_URL}/api/seed", headers=HEADERS, json={"force": True})
    if response.status_code == 200:
        data = response.json()
        success = data.get("seeded") == True and data.get("associations") == 66
        log_test("POST /api/seed force=true", success, f"associations={data.get('associations')}, stands={data.get('stands_planned')}")
    else:
        log_test("POST /api/seed force=true", False, f"Status: {response.status_code}")
        return
    
    # Get test data
    reg_response = requests.get(f"{BASE_URL}/api/registrations", headers=HEADERS)
    registrations = reg_response.json() if reg_response.status_code == 200 else []
    reg_ids = [reg["id"] for reg in registrations[:5]]
    
    print("=== 1. BULK ACTIONS ===")
    
    # 1a) Bulk confirm
    if len(reg_ids) >= 3:
        test_ids = reg_ids[:3]
        response = requests.post(f"{BASE_URL}/api/registrations/bulk-confirm", 
                               headers=HEADERS, json={"ids": test_ids})
        if response.status_code == 200:
            data = response.json()
            log_test("POST /api/registrations/bulk-confirm", data.get("ok") == True, 
                    f"confirmed={data.get('confirmed')}")
            
            # Vérifier les statuts
            for reg_id in test_ids:
                detail_response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=HEADERS)
                if detail_response.status_code == 200:
                    detail_data = detail_response.json()
                    status = detail_data.get("status")
                    is_confirmed = status == "confirme"
                    log_test(f"Registration {reg_id} status", is_confirmed, f"status='{status}'")
        else:
            log_test("POST /api/registrations/bulk-confirm", False, f"Status: {response.status_code}")
    
    # 1b) Bulk generate receipts
    if len(reg_ids) >= 5:
        response = requests.post(f"{BASE_URL}/api/registrations/bulk-generate-receipts",
                               headers=HEADERS, json={"ids": reg_ids})
        if response.status_code == 200:
            data = response.json()
            log_test("POST /api/registrations/bulk-generate-receipts", data.get("ok") == True,
                    f"generated={data.get('generated')}")
            
            # Vérifier les documents
            for reg_id in reg_ids:
                doc_response = requests.get(f"{BASE_URL}/api/documents?registration_id={reg_id}", headers=HEADERS)
                if doc_response.status_code == 200:
                    documents = doc_response.json()
                    receipt_docs = [doc for doc in documents if doc.get("document_type") == "recu_caution"]
                    has_receipt = len(receipt_docs) > 0
                    log_test(f"Receipt for {reg_id}", has_receipt, f"Found {len(receipt_docs)} receipt(s)")
        else:
            log_test("POST /api/registrations/bulk-generate-receipts", False, f"Status: {response.status_code}")
    
    # 1c) Bulk update deposits - create test deposit IDs
    deposit_ids = [f"deposit-{reg_ids[0]}", f"deposit-{reg_ids[1]}"] if len(reg_ids) >= 2 else []
    if deposit_ids:
        response = requests.post(f"{BASE_URL}/api/deposits/bulk-update-status",
                               headers=HEADERS, json={"ids": deposit_ids, "status": "demandee"})
        if response.status_code == 200:
            data = response.json()
            log_test("POST /api/deposits/bulk-update-status", data.get("ok") == True,
                    f"modified={data.get('modified')}")
        else:
            log_test("POST /api/deposits/bulk-update-status", False, f"Status: {response.status_code}")
    
    # 1d) Bulk resolve anomalies - test with empty array (no anomalies exist)
    response = requests.post(f"{BASE_URL}/api/anomalies/bulk-resolve",
                           headers=HEADERS, json={"ids": [], "comment": "Test"})
    if response.status_code == 200:
        data = response.json()
        log_test("POST /api/anomalies/bulk-resolve", data.get("ok") == True,
                f"modified={data.get('modified')} (empty list)")
    else:
        log_test("POST /api/anomalies/bulk-resolve", False, f"Status: {response.status_code}")
    
    print("=== 2. SCHEDULED MAILING ===")
    
    # 2a) Schedule future email
    if reg_ids:
        future_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT10:00:00Z")
        response = requests.post(f"{BASE_URL}/api/mailing/schedule", headers=HEADERS, json={
            "subject": "Test prog", "body_html": "<p>Hello</p>",
            "registration_ids": [reg_ids[0]], "mail_type": "annonce",
            "scheduled_at": future_date
        })
        if response.status_code == 200:
            data = response.json()
            log_test("POST /api/mailing/schedule (future)", data.get("ok") == True,
                    f"campaign_id={data.get('campaign_id')}")
        else:
            log_test("POST /api/mailing/schedule (future)", False, f"Status: {response.status_code}")
    
    # 2b) Get scheduled campaigns
    response = requests.get(f"{BASE_URL}/api/mailing/scheduled", headers=HEADERS)
    if response.status_code == 200:
        campaigns = response.json()
        has_campaigns = len(campaigns) >= 1
        if has_campaigns:
            campaign = campaigns[0]
            valid_campaign = (campaign.get("status") == "programmee" and 
                            campaign.get("recipients_count", 0) >= 1)
            log_test("GET /api/mailing/scheduled", valid_campaign,
                    f"Found {len(campaigns)} campaigns, status={campaign.get('status')}")
        else:
            log_test("GET /api/mailing/scheduled", False, f"Found {len(campaigns)} campaigns")
    else:
        log_test("GET /api/mailing/scheduled", False, f"Status: {response.status_code}")
    
    # 2c) Schedule past date (should fail)
    if reg_ids:
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT10:00:00Z")
        response = requests.post(f"{BASE_URL}/api/mailing/schedule", headers=HEADERS, json={
            "subject": "Test passé", "body_html": "<p>Hello past</p>",
            "registration_ids": [reg_ids[0]], "mail_type": "annonce",
            "scheduled_at": past_date
        })
        success = response.status_code == 400
        error_msg = response.json().get("error", "") if response.status_code == 400 else ""
        log_test("POST /api/mailing/schedule (past date)", success,
                f"Status: {response.status_code}, Error: {error_msg}")
    
    # 2d) Process scheduled
    response = requests.post(f"{BASE_URL}/api/mailing/process-scheduled", headers=HEADERS, json={})
    if response.status_code == 200:
        data = response.json()
        log_test("POST /api/mailing/process-scheduled", data.get("ok") == True,
                f"processed={data.get('processed')}, sent={data.get('sent')}")
    else:
        log_test("POST /api/mailing/process-scheduled", False, f"Status: {response.status_code}")
    
    print("=== 3. TRACKING ===")
    
    # Send email first
    if reg_ids:
        response = requests.post(f"{BASE_URL}/api/mailing/send", headers=HEADERS, json={
            "subject": "Test tracking", 
            "body_html": "<p>Test <a href='https://example.com'>link</a></p>",
            "registration_ids": [reg_ids[0]]
        })
        if response.status_code == 200:
            log_test("Email sent for tracking", True, f"Campaign: {response.json().get('campaign_id')}")
        else:
            log_test("Email sent for tracking", False, f"Status: {response.status_code}")
    
    # Test tracking endpoints with test message ID
    message_id = "test-message-id-123"
    
    # 3a) Open tracking
    response = requests.get(f"{BASE_URL}/api/track/open/{message_id}.gif", headers=HEADERS)
    success = response.status_code == 200 and response.headers.get("content-type") == "image/gif"
    log_test("GET /api/track/open/<messageId>.gif", success,
            f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
    
    # 3b) Click tracking with URL
    response = requests.get(f"{BASE_URL}/api/track/click/{message_id}?u=https://example.com", 
                          headers=HEADERS, allow_redirects=False)
    success = response.status_code == 302 and response.headers.get("location") == "https://example.com"
    log_test("GET /api/track/click/<messageId>?u=URL", success,
            f"Status: {response.status_code}, Location: {response.headers.get('location')}")
    
    # 3c) Click tracking without URL (should fail)
    response = requests.get(f"{BASE_URL}/api/track/click/{message_id}", headers=HEADERS)
    success = response.status_code == 400
    log_test("GET /api/track/click/<messageId> (no u param)", success,
            f"Status: {response.status_code} (expected 400)")
    
    print("=== 4. DASHBOARD EXTENDED ===")
    
    response = requests.get(f"{BASE_URL}/api/dashboard/extended", headers=HEADERS)
    if response.status_code == 200:
        data = response.json()
        required_fields = ["days_to_event", "at_risk", "cadence", "mailing_engagement",
                          "avg_completion", "fully_complete_count", "smart_alerts"]
        
        all_present = all(field in data for field in required_fields)
        if all_present:
            # Check data types and values
            checks = []
            checks.append(f"days_to_event: {type(data.get('days_to_event')).__name__}")
            checks.append(f"at_risk: array[{len(data.get('at_risk', []))}]")
            checks.append(f"avg_completion: {data.get('avg_completion')}%")
            checks.append(f"fully_complete_count: {data.get('fully_complete_count')}")
            
            engagement = data.get("mailing_engagement", {})
            has_engagement_fields = all(field in engagement for field in 
                                      ["sent", "opened", "clicked", "open_rate_pct", "click_rate_pct"])
            checks.append(f"mailing_engagement: {'✓' if has_engagement_fields else '✗'}")
            
            log_test("GET /api/dashboard/extended", True, " | ".join(checks))
        else:
            missing = [f for f in required_fields if f not in data]
            log_test("GET /api/dashboard/extended", False, f"Missing fields: {missing}")
    else:
        log_test("GET /api/dashboard/extended", False, f"Status: {response.status_code}")
    
    print("=== 5. NON-RÉGRESSION ===")
    
    # Dashboard KPIs
    response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=HEADERS)
    success = response.status_code == 200 and "total" in response.json()
    log_test("GET /api/dashboard/kpis", success, f"Status: {response.status_code}")
    
    # Generate AI
    response = requests.post(f"{BASE_URL}/api/mailing/generate-ai", headers=HEADERS,
                           json={"mail_type": "relance_caution"})
    if response.status_code == 200:
        data = response.json()
        success = data.get("subject") and data.get("body_html")
        log_test("POST /api/mailing/generate-ai", success, "Subject and body_html generated")
    else:
        log_test("POST /api/mailing/generate-ai", False, f"Status: {response.status_code}")
    
    # Test SMTP
    response = requests.post(f"{BASE_URL}/api/mailing/test-smtp", headers=HEADERS, json={})
    if response.status_code == 200:
        data = response.json()
        log_test("POST /api/mailing/test-smtp", data.get("ok") == True,
                f"configured={data.get('configured')}")
    else:
        log_test("POST /api/mailing/test-smtp", False, f"Status: {response.status_code}")
    
    print("=" * 70)
    print("🏁 TESTS TERMINÉS")

if __name__ == "__main__":
    main()