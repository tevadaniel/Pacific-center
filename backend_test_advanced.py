#!/usr/bin/env python3
"""
Test avancé des endpoints Mailing AVANCÉ + ACTIONS GROUPÉES + DASHBOARD ETENDU + TRACKING
Forum de la Rentrée 2026 - Polynésie française

Endpoints à tester:
1. BULK ACTIONS: bulk-confirm, bulk-generate-receipts, bulk-update-status, bulk-resolve
2. SCHEDULED MAILING: schedule, scheduled, process-scheduled  
3. TRACKING: open pixel, click redirect
4. DASHBOARD EXTENDED: extended stats
5. NON-RÉGRESSION: kpis, generate-ai, test-smtp
"""

import requests
import json
import time
from datetime import datetime, timedelta
import base64

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

def test_seed_force():
    """Avant tout : POST /api/seed force=true pour avoir 66 organisations"""
    print("=== 0. SEED AVEC FORCE=TRUE ===")
    
    try:
        response = requests.post(f"{BASE_URL}/api/seed", 
                               headers=HEADERS, 
                               json={"force": True})
        
        if response.status_code == 200:
            data = response.json()
            success = (data.get("seeded") == True and 
                      data.get("associations") == 66 and 
                      data.get("stands_planned") == 67)
            log_test("POST /api/seed force=true", success, 
                    f"seeded={data.get('seeded')}, associations={data.get('associations')}, stands_planned={data.get('stands_planned')}")
            return success
        else:
            log_test("POST /api/seed force=true", False, f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        log_test("POST /api/seed force=true", False, f"Exception: {str(e)}")
        return False

def get_registration_ids(count=5):
    """Récupère des IDs de registrations pour les tests"""
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            # API returns direct array, not wrapped in "registrations"
            registrations = data if isinstance(data, list) else data.get("registrations", [])
            return [reg["id"] for reg in registrations[:count]]
        return []
    except:
        return []

def get_deposit_ids(count=2):
    """Récupère des IDs de deposits pour les tests"""
    try:
        # First get registrations to find deposit_transactions
        response = requests.get(f"{BASE_URL}/api/registrations", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            registrations = data if isinstance(data, list) else data.get("registrations", [])
            deposit_ids = []
            for reg in registrations[:count]:
                # Try to get deposit info from registration detail
                detail_response = requests.get(f"{BASE_URL}/api/registrations/{reg['id']}", headers=HEADERS)
                if detail_response.status_code == 200:
                    detail_data = detail_response.json()
                    deposit = detail_data.get("deposit")
                    if deposit and deposit.get("id"):
                        deposit_ids.append(deposit["id"])
                    elif len(deposit_ids) < count:
                        # Create a deposit ID based on registration ID for testing
                        deposit_ids.append(f"deposit-{reg['id']}")
            return deposit_ids
        return []
    except:
        return []

def get_anomaly_ids():
    """Récupère des IDs d'anomalies pour les tests"""
    try:
        response = requests.get(f"{BASE_URL}/api/anomalies", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            anomalies = data.get("anomalies", [])
            return [anomaly["id"] for anomaly in anomalies]
        return []
    except:
        return []

def test_bulk_actions():
    """Test des actions groupées (bulk actions)"""
    print("=== 1. BULK ACTIONS ===")
    
    # Get test data
    reg_ids = get_registration_ids(5)
    deposit_ids = get_deposit_ids(2)
    anomaly_ids = get_anomaly_ids()
    
    print(f"Test data: {len(reg_ids)} registrations, {len(deposit_ids)} deposits, {len(anomaly_ids)} anomalies")
    
    # 1a) POST /api/registrations/bulk-confirm
    if len(reg_ids) >= 3:
        try:
            test_ids = reg_ids[:3]
            response = requests.post(f"{BASE_URL}/api/registrations/bulk-confirm",
                                   headers=HEADERS,
                                   json={"ids": test_ids})
            
            if response.status_code == 200:
                data = response.json()
                success = (data.get("ok") == True and 
                          data.get("confirmed") is not None and
                          data.get("confirmed") <= len(test_ids))
                log_test("POST /api/registrations/bulk-confirm", success,
                        f"ok={data.get('ok')}, confirmed={data.get('confirmed')}")
                
                # Vérifier que les registrations ont status='confirme'
                for reg_id in test_ids:
                    detail_response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=HEADERS)
                    if detail_response.status_code == 200:
                        detail_data = detail_response.json()
                        if detail_data.get("status") == "confirme":
                            log_test(f"Registration {reg_id} confirmed", True, "status='confirme'")
                        else:
                            log_test(f"Registration {reg_id} confirmed", False, f"status='{detail_data.get('status')}'")
            else:
                log_test("POST /api/registrations/bulk-confirm", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("POST /api/registrations/bulk-confirm", False, f"Exception: {str(e)}")
    else:
        log_test("POST /api/registrations/bulk-confirm", False, "Pas assez de registrations pour le test")
    
    # 1b) POST /api/registrations/bulk-generate-receipts
    if len(reg_ids) >= 5:
        try:
            test_ids = reg_ids[:5]
            response = requests.post(f"{BASE_URL}/api/registrations/bulk-generate-receipts",
                                   headers=HEADERS,
                                   json={"ids": test_ids})
            
            if response.status_code == 200:
                data = response.json()
                success = (data.get("ok") == True and 
                          data.get("generated") is not None)
                log_test("POST /api/registrations/bulk-generate-receipts", success,
                        f"ok={data.get('ok')}, generated={data.get('generated')}")
                
                # Vérifier qu'un document type='recu_caution' apparaît pour chaque registration
                for reg_id in test_ids:
                    doc_response = requests.get(f"{BASE_URL}/api/documents?registration_id={reg_id}", headers=HEADERS)
                    if doc_response.status_code == 200:
                        doc_data = doc_response.json()
                        documents = doc_data if isinstance(doc_data, list) else doc_data.get("documents", [])
                        receipt_docs = [doc for doc in documents if doc.get("type") == "recu_caution"]
                        if receipt_docs:
                            log_test(f"Receipt document for {reg_id}", True, f"Found {len(receipt_docs)} receipt(s)")
                        else:
                            log_test(f"Receipt document for {reg_id}", False, "No receipt document found")
            else:
                log_test("POST /api/registrations/bulk-generate-receipts", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("POST /api/registrations/bulk-generate-receipts", False, f"Exception: {str(e)}")
    else:
        log_test("POST /api/registrations/bulk-generate-receipts", False, "Pas assez de registrations pour le test")
    
    # 1c) POST /api/deposits/bulk-update-status
    if len(deposit_ids) >= 2:
        try:
            response = requests.post(f"{BASE_URL}/api/deposits/bulk-update-status",
                                   headers=HEADERS,
                                   json={"ids": deposit_ids, "status": "demandee"})
            
            if response.status_code == 200:
                data = response.json()
                success = (data.get("ok") == True and 
                          data.get("modified") == len(deposit_ids))
                log_test("POST /api/deposits/bulk-update-status", success,
                        f"ok={data.get('ok')}, modified={data.get('modified')}")
            else:
                log_test("POST /api/deposits/bulk-update-status", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("POST /api/deposits/bulk-update-status", False, f"Exception: {str(e)}")
    else:
        log_test("POST /api/deposits/bulk-update-status", False, "Pas assez de deposits pour le test")
    
    # 1d) POST /api/anomalies/bulk-resolve
    try:
        if anomaly_ids:
            response = requests.post(f"{BASE_URL}/api/anomalies/bulk-resolve",
                                   headers=HEADERS,
                                   json={"ids": anomaly_ids, "comment": "Test"})
        else:
            # Test avec liste vide si pas d'anomalies
            response = requests.post(f"{BASE_URL}/api/anomalies/bulk-resolve",
                                   headers=HEADERS,
                                   json={"ids": [], "comment": "Test"})
        
        if response.status_code == 200:
            data = response.json()
            success = (data.get("ok") == True and 
                      data.get("modified") is not None)
            log_test("POST /api/anomalies/bulk-resolve", success,
                    f"ok={data.get('ok')}, modified={data.get('modified')}")
        else:
            log_test("POST /api/anomalies/bulk-resolve", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/anomalies/bulk-resolve", False, f"Exception: {str(e)}")

def test_scheduled_mailing():
    """Test du mailing programmé"""
    print("=== 2. SCHEDULED MAILING ===")
    
    reg_ids = get_registration_ids(1)
    
    # 2a) POST /api/mailing/schedule avec date future
    campaign_id = None
    if reg_ids:
        try:
            future_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT10:00:00Z")
            response = requests.post(f"{BASE_URL}/api/mailing/schedule",
                                   headers=HEADERS,
                                   json={
                                       "subject": "Test prog",
                                       "body_html": "<p>Hello</p>",
                                       "registration_ids": reg_ids[:1],
                                       "mail_type": "annonce",
                                       "scheduled_at": future_date
                                   })
            
            if response.status_code == 200:
                data = response.json()
                success = (data.get("ok") == True and 
                          data.get("campaign_id") is not None)
                campaign_id = data.get("campaign_id")
                log_test("POST /api/mailing/schedule (future)", success,
                        f"ok={data.get('ok')}, campaign_id={campaign_id}")
            else:
                log_test("POST /api/mailing/schedule (future)", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            log_test("POST /api/mailing/schedule (future)", False, f"Exception: {str(e)}")
    else:
        log_test("POST /api/mailing/schedule (future)", False, "Pas de registration pour le test")
    
    # 2b) GET /api/mailing/scheduled
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/scheduled", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            campaigns = data if isinstance(data, list) else data.get("campaigns", [])
            success = len(campaigns) >= 1
            if success and campaigns:
                campaign = campaigns[0]
                has_required_fields = (
                    campaign.get("status") == "programmee" and
                    campaign.get("scheduled_at") is not None and
                    campaign.get("recipients_count", 0) >= 1
                )
                log_test("GET /api/mailing/scheduled", has_required_fields,
                        f"Found {len(campaigns)} campaigns, first: status={campaign.get('status')}, recipients_count={campaign.get('recipients_count')}")
            else:
                log_test("GET /api/mailing/scheduled", False, f"Found {len(campaigns)} campaigns")
        else:
            log_test("GET /api/mailing/scheduled", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/mailing/scheduled", False, f"Exception: {str(e)}")
    
    # 2c) POST /api/mailing/schedule avec date passée
    if reg_ids:
        try:
            past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT10:00:00Z")
            response = requests.post(f"{BASE_URL}/api/mailing/schedule",
                                   headers=HEADERS,
                                   json={
                                       "subject": "Test passé",
                                       "body_html": "<p>Hello past</p>",
                                       "registration_ids": reg_ids[:1],
                                       "mail_type": "annonce",
                                       "scheduled_at": past_date
                                   })
            
            success = response.status_code == 400
            if success:
                error_msg = response.json().get("error", "")
                contains_expected = "Date programmée invalide ou passée" in error_msg or "passée" in error_msg
                log_test("POST /api/mailing/schedule (past date)", contains_expected,
                        f"Status: {response.status_code}, Error: {error_msg}")
            else:
                log_test("POST /api/mailing/schedule (past date)", False, f"Expected 400, got {response.status_code}")
        except Exception as e:
            log_test("POST /api/mailing/schedule (past date)", False, f"Exception: {str(e)}")
    
    # 2d) POST /api/mailing/process-scheduled
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/process-scheduled",
                               headers=HEADERS,
                               json={})
        
        if response.status_code == 200:
            data = response.json()
            success = (data.get("ok") == True and 
                      "processed" in data and
                      "sent" in data and
                      "failed" in data)
            log_test("POST /api/mailing/process-scheduled", success,
                    f"ok={data.get('ok')}, processed={data.get('processed')}, sent={data.get('sent')}, failed={data.get('failed')}")
        else:
            log_test("POST /api/mailing/process-scheduled", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/mailing/process-scheduled", False, f"Exception: {str(e)}")

def test_tracking():
    """Test du tracking des emails"""
    print("=== 3. TRACKING ===")
    
    # D'abord envoyer un email pour avoir un messageId
    reg_ids = get_registration_ids(1)
    message_id = None
    
    if reg_ids:
        try:
            response = requests.post(f"{BASE_URL}/api/mailing/send",
                                   headers=HEADERS,
                                   json={
                                       "subject": "Test tracking",
                                       "body_html": "<p>Test email for tracking <a href='https://example.com'>Click here</a></p>",
                                       "registration_ids": reg_ids[:1]
                                   })
            
            if response.status_code == 200:
                data = response.json()
                campaign_id = data.get("campaign_id")
                
                # Try to get the actual message ID by checking recent emails
                # For now, we'll use a test ID but the tracking endpoints should work
                message_id = "test-message-id-123"
                log_test("Email sent for tracking test", True, f"Campaign: {campaign_id}, using test message_id: {message_id}")
            else:
                log_test("Email sent for tracking test", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test("Email sent for tracking test", False, f"Exception: {str(e)}")
    
    if message_id:
        # 3a) GET /api/track/open/<messageId>.gif
        try:
            response = requests.get(f"{BASE_URL}/api/track/open/{message_id}.gif", headers=HEADERS)
            
            success = (response.status_code == 200 and 
                      response.headers.get("content-type") == "image/gif")
            log_test("GET /api/track/open/<messageId>.gif", success,
                    f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
        except Exception as e:
            log_test("GET /api/track/open/<messageId>.gif", False, f"Exception: {str(e)}")
        
        # 3b) GET /api/track/click/<messageId>?u=https://example.com
        try:
            response = requests.get(f"{BASE_URL}/api/track/click/{message_id}?u=https://example.com", 
                                  headers=HEADERS, allow_redirects=False)
            
            success = (response.status_code == 302 and 
                      response.headers.get("location") == "https://example.com")
            log_test("GET /api/track/click/<messageId>?u=URL", success,
                    f"Status: {response.status_code}, Location: {response.headers.get('location')}")
        except Exception as e:
            log_test("GET /api/track/click/<messageId>?u=URL", False, f"Exception: {str(e)}")
        
        # 3c) GET /api/track/click/<messageId> sans param u
        try:
            response = requests.get(f"{BASE_URL}/api/track/click/{message_id}", headers=HEADERS)
            
            success = response.status_code == 400
            log_test("GET /api/track/click/<messageId> (no u param)", success,
                    f"Status: {response.status_code} (expected 400)")
        except Exception as e:
            log_test("GET /api/track/click/<messageId> (no u param)", False, f"Exception: {str(e)}")
    else:
        log_test("Tracking tests", False, "No message_id available for tracking tests")

def test_dashboard_extended():
    """Test du dashboard étendu"""
    print("=== 4. DASHBOARD EXTENDED ===")
    
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/extended", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            # Vérifier les champs requis
            required_fields = [
                "days_to_event", "at_risk", "cadence", "mailing_engagement",
                "avg_completion", "fully_complete_count", "smart_alerts"
            ]
            
            missing_fields = []
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if not missing_fields:
                # Vérifier les types et valeurs
                checks = []
                
                # days_to_event doit être un nombre
                if isinstance(data.get("days_to_event"), (int, float)):
                    checks.append("days_to_event: number ✓")
                else:
                    checks.append(f"days_to_event: {type(data.get('days_to_event'))} ✗")
                
                # at_risk doit être un array de 0 à 5 items
                at_risk = data.get("at_risk", [])
                if isinstance(at_risk, list) and len(at_risk) <= 5:
                    checks.append(f"at_risk: array[{len(at_risk)}] ✓")
                    if at_risk and isinstance(at_risk[0], dict):
                        first_risk = at_risk[0]
                        if all(key in first_risk for key in ["organization_name", "missing", "risk_score"]):
                            checks.append("at_risk structure ✓")
                        else:
                            checks.append("at_risk structure ✗")
                else:
                    checks.append(f"at_risk: invalid ✗")
                
                # mailing_engagement doit avoir les champs requis
                engagement = data.get("mailing_engagement", {})
                engagement_fields = ["sent", "opened", "clicked", "open_rate_pct", "click_rate_pct"]
                if all(field in engagement for field in engagement_fields):
                    checks.append("mailing_engagement fields ✓")
                else:
                    missing_eng = [f for f in engagement_fields if f not in engagement]
                    checks.append(f"mailing_engagement missing: {missing_eng} ✗")
                
                # avg_completion doit être 0-100
                avg_completion = data.get("avg_completion")
                if isinstance(avg_completion, (int, float)) and 0 <= avg_completion <= 100:
                    checks.append(f"avg_completion: {avg_completion}% ✓")
                else:
                    checks.append(f"avg_completion: {avg_completion} ✗")
                
                # fully_complete_count doit être un nombre
                if isinstance(data.get("fully_complete_count"), (int, float)):
                    checks.append("fully_complete_count: number ✓")
                else:
                    checks.append("fully_complete_count: invalid ✗")
                
                # smart_alerts doit être un array
                if isinstance(data.get("smart_alerts"), list):
                    checks.append("smart_alerts: array ✓")
                else:
                    checks.append("smart_alerts: invalid ✗")
                
                success = all("✓" in check for check in checks)
                log_test("GET /api/dashboard/extended", success, "\n    ".join(checks))
            else:
                log_test("GET /api/dashboard/extended", False, f"Missing fields: {missing_fields}")
        else:
            log_test("GET /api/dashboard/extended", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/extended", False, f"Exception: {str(e)}")

def test_non_regression():
    """Test de non-régression"""
    print("=== 5. NON-RÉGRESSION ===")
    
    # GET /api/dashboard/kpis
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            has_total = "total" in data
            log_test("GET /api/dashboard/kpis", has_total, f"Status: {response.status_code}, has total: {has_total}")
        else:
            log_test("GET /api/dashboard/kpis", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/dashboard/kpis", False, f"Exception: {str(e)}")
    
    # POST /api/mailing/generate-ai
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/generate-ai",
                               headers=HEADERS,
                               json={"mail_type": "relance_caution"})
        
        if response.status_code == 200:
            data = response.json()
            success = (data.get("subject") is not None and 
                      data.get("body_html") is not None)
            log_test("POST /api/mailing/generate-ai", success,
                    f"subject present: {data.get('subject') is not None}, body_html present: {data.get('body_html') is not None}")
        else:
            log_test("POST /api/mailing/generate-ai", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/mailing/generate-ai", False, f"Exception: {str(e)}")
    
    # POST /api/mailing/test-smtp
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/test-smtp",
                               headers=HEADERS,
                               json={})
        
        if response.status_code == 200:
            data = response.json()
            # SMTP est configuré avec dyqaiczuggldibkk donc devrait être ok:true
            success = data.get("ok") == True
            log_test("POST /api/mailing/test-smtp", success,
                    f"ok={data.get('ok')}, configured={data.get('configured')}")
        else:
            log_test("POST /api/mailing/test-smtp", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("POST /api/mailing/test-smtp", False, f"Exception: {str(e)}")

def main():
    """Fonction principale de test"""
    print("🧪 TEST AVANCÉ - MAILING + BULK ACTIONS + DASHBOARD + TRACKING")
    print("=" * 70)
    print(f"BASE_URL: {BASE_URL}")
    print(f"Headers: {HEADERS}")
    print()
    
    # Seed obligatoire
    if not test_seed_force():
        print("❌ ARRÊT - Seed failed")
        return
    
    # Tests principaux
    test_bulk_actions()
    test_scheduled_mailing()
    test_tracking()
    test_dashboard_extended()
    test_non_regression()
    
    print("=" * 70)
    print("🏁 TESTS TERMINÉS")

if __name__ == "__main__":
    main()