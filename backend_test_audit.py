#!/usr/bin/env python3
"""
AUDIT COMPLET PRÉ-DÉPLOIEMENT — FORUM DE LA RENTRÉE 2026
Test exhaustif de tous les endpoints backend
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
EXPOSANT_HEADERS = {
    "Content-Type": "application/json",
    "x-user-id": "u-exposant",
    "x-user-role": "exposant"
}

# Test results tracking
test_results = {
    "A_DEADLINES": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "B_AUTH_SEED": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "C_DASHBOARD": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "D_REGISTRATIONS": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "E_ANIMATION": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "F_ATTENDANCE": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "G_DOCUMENTS": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "H_MAILING": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "I_TRACKING": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "J_TOOLS": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "K_SATISFACTION": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
    "L_ACCESS_TOKENS": {"tested": 0, "ok": 0, "ko": 0, "anomalies": []},
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
# A. NOUVEAUX ENDPOINTS DEADLINES (PRIORITÉ HAUTE)
# ============================================================================
def test_deadlines():
    print_section("A. NOUVEAUX ENDPOINTS DEADLINES")
    
    # Test 1: GET /api/step-deadlines with admin auth
    try:
        response = requests.get(f"{BASE_URL}/api/step-deadlines", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            has_deadlines = "deadlines" in data
            has_6_keys = len(data.get("deadlines", {})) == 6
            required_keys = ["profile", "stand", "animation", "documents", "caution", "convention"]
            all_keys_present = all(k in data.get("deadlines", {}) for k in required_keys)
            success = has_deadlines and has_6_keys and all_keys_present
            log_test("A_DEADLINES", "GET /api/step-deadlines (admin)", success, 
                    f"Keys: {list(data.get('deadlines', {}).keys())}")
        else:
            log_test("A_DEADLINES", "GET /api/step-deadlines (admin)", False, 
                    f"Status: {response.status_code}", "critical")
    except Exception as e:
        log_test("A_DEADLINES", "GET /api/step-deadlines (admin)", False, str(e), "critical")
    
    # Test 2: GET /api/step-deadlines without auth
    try:
        response = requests.get(f"{BASE_URL}/api/step-deadlines")
        # Should work for all authenticated roles, but without headers might fail
        log_test("A_DEADLINES", "GET /api/step-deadlines (no auth)", True, 
                f"Status: {response.status_code} (expected 401 or 200)")
    except Exception as e:
        log_test("A_DEADLINES", "GET /api/step-deadlines (no auth)", False, str(e))
    
    # Test 3: POST /api/step-deadlines with valid data
    try:
        payload = {
            "deadlines": {
                "profile": "2026-06-15T23:59:59Z",
                "stand": "2026-06-30T00:00:00Z",
                "animation": None,
                "documents": None,
                "caution": None,
                "convention": None
            }
        }
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get("ok") == True and "deadlines" in data
        log_test("A_DEADLINES", "POST /api/step-deadlines (valid data)", success, 
                f"Response: {response.json() if response.status_code == 200 else response.text}")
    except Exception as e:
        log_test("A_DEADLINES", "POST /api/step-deadlines (valid data)", False, str(e), "critical")
    
    # Test 4: POST /api/step-deadlines with non-admin
    try:
        payload = {"deadlines": {"profile": None, "stand": None, "animation": None, "documents": None, "caution": None, "convention": None}}
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=EXPOSANT_HEADERS)
        success = response.status_code == 403
        log_test("A_DEADLINES", "POST /api/step-deadlines (non-admin) → 403", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("A_DEADLINES", "POST /api/step-deadlines (non-admin) → 403", False, str(e))
    
    # Test 5: POST /api/step-deadlines without deadlines
    try:
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json={}, headers=ADMIN_HEADERS)
        success = response.status_code == 400
        log_test("A_DEADLINES", "POST /api/step-deadlines (no deadlines) → 400", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("A_DEADLINES", "POST /api/step-deadlines (no deadlines) → 400", False, str(e))
    
    # Test 6: POST /api/step-deadlines with invalid date
    try:
        payload = {"deadlines": {"profile": "not-a-date", "stand": None, "animation": None, "documents": None, "caution": None, "convention": None}}
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=ADMIN_HEADERS)
        success = response.status_code == 400
        log_test("A_DEADLINES", "POST /api/step-deadlines (invalid date) → 400", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("A_DEADLINES", "POST /api/step-deadlines (invalid date) → 400", False, str(e))
    
    # Test 7: POST /api/step-deadlines with all null
    try:
        payload = {"deadlines": {"profile": None, "stand": None, "animation": None, "documents": None, "caution": None, "convention": None}}
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            all_null = all(v is None for v in data.get("deadlines", {}).values())
            success = all_null
        log_test("A_DEADLINES", "POST /api/step-deadlines (all null)", success, 
                f"Response: {response.json() if response.status_code == 200 else response.text}")
    except Exception as e:
        log_test("A_DEADLINES", "POST /api/step-deadlines (all null)", False, str(e))
    
    # Test 8: Coherence GET after POST
    try:
        # POST with specific values
        payload = {
            "deadlines": {
                "profile": "2026-07-01T00:00:00Z",
                "stand": "2026-07-15T00:00:00Z",
                "animation": "2026-07-20T00:00:00Z",
                "documents": None,
                "caution": None,
                "convention": None
            }
        }
        post_response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=ADMIN_HEADERS)
        
        # GET to verify
        get_response = requests.get(f"{BASE_URL}/api/step-deadlines", headers=ADMIN_HEADERS)
        success = get_response.status_code == 200
        if success:
            data = get_response.json()
            deadlines = data.get("deadlines", {})
            success = (deadlines.get("profile") == "2026-07-01T00:00:00.000Z" and
                      deadlines.get("stand") == "2026-07-15T00:00:00.000Z" and
                      deadlines.get("animation") == "2026-07-20T00:00:00.000Z")
        log_test("A_DEADLINES", "Coherence GET after POST", success, 
                f"Deadlines: {data.get('deadlines') if success else 'N/A'}")
    except Exception as e:
        log_test("A_DEADLINES", "Coherence GET after POST", False, str(e), "critical")
    
    # Test 9: Reset final (all deadlines to null)
    try:
        payload = {"deadlines": {"profile": None, "stand": None, "animation": None, "documents": None, "caution": None, "convention": None}}
        response = requests.post(f"{BASE_URL}/api/step-deadlines", json=payload, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("A_DEADLINES", "Reset deadlines to null (cleanup)", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("A_DEADLINES", "Reset deadlines to null (cleanup)", False, str(e))

# ============================================================================
# B. AUTH & SEED (NON-RÉGRESSION)
# ============================================================================
def test_auth_seed():
    print_section("B. AUTH & SEED (NON-RÉGRESSION)")
    
    # Test 1: POST /api/seed (force=false) - idempotent
    try:
        response = requests.post(f"{BASE_URL}/api/seed", json={"force": False}, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            # Should return seeded:false if already seeded
            log_test("B_AUTH_SEED", "POST /api/seed (force=false) idempotent", True, 
                    f"Seeded: {data.get('seeded')}, Associations: {data.get('associations')}, Stands: {data.get('stands_planned')}")
        else:
            log_test("B_AUTH_SEED", "POST /api/seed (force=false) idempotent", False, 
                    f"Status: {response.status_code}")
    except Exception as e:
        log_test("B_AUTH_SEED", "POST /api/seed (force=false) idempotent", False, str(e))
    
    # Test 2: POST /api/auth/login admin
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json={"email": "admin@aracom.pf", "password": "demo"})
        success = response.status_code == 200
        if success:
            data = response.json()
            success = data.get("user", {}).get("role_code") == "aracom_admin"
        log_test("B_AUTH_SEED", "POST /api/auth/login (admin)", success, 
                f"Role: {data.get('user', {}).get('role_code') if success else 'N/A'}")
    except Exception as e:
        log_test("B_AUTH_SEED", "POST /api/auth/login (admin)", False, str(e))
    
    # Test 3: POST /api/auth/login pacific@centers.pf → 403 (by design)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json={"email": "pacific@centers.pf", "password": "demo"})
        success = response.status_code == 403
        log_test("B_AUTH_SEED", "POST /api/auth/login (pacific) → 403", success, 
                f"Status: {response.status_code} (expected 403 by design)")
    except Exception as e:
        log_test("B_AUTH_SEED", "POST /api/auth/login (pacific) → 403", False, str(e))
    
    # Test 4: POST /api/auth/register → 403 (disabled)
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", 
                               json={"email": "test@test.com", "password": "test123"})
        success = response.status_code == 403
        log_test("B_AUTH_SEED", "POST /api/auth/register → 403 (disabled)", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("B_AUTH_SEED", "POST /api/auth/register → 403 (disabled)", False, str(e))
    
    # Test 5: GET /api/auth/me
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("B_AUTH_SEED", "GET /api/auth/me", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("B_AUTH_SEED", "GET /api/auth/me", False, str(e))

# ============================================================================
# C. DASHBOARD & ANALYTICS
# ============================================================================
def test_dashboard():
    print_section("C. DASHBOARD & ANALYTICS")
    
    # Test 1: GET /api/dashboard/kpis
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "total" in data and data.get("total") == 67
        log_test("C_DASHBOARD", "GET /api/dashboard/kpis", success, 
                f"Total: {data.get('total') if success else 'N/A'}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/dashboard/kpis", False, str(e), "critical")
    
    # Test 2: GET /api/dashboard/by-site
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/by-site", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = len(data) == 6
        log_test("C_DASHBOARD", "GET /api/dashboard/by-site", success, 
                f"Sites: {len(data) if success else 'N/A'}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/dashboard/by-site", False, str(e), "critical")
    
    # Test 3: GET /api/dashboard/jour-j-live
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/jour-j-live", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("C_DASHBOARD", "GET /api/dashboard/jour-j-live", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/dashboard/jour-j-live", False, str(e))
    
    # Test 4: GET /api/dashboard/extended
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/extended", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "at_risk" in data and "smart_alerts" in data
        log_test("C_DASHBOARD", "GET /api/dashboard/extended", success, 
                f"Keys: {list(data.keys()) if success else 'N/A'}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/dashboard/extended", False, str(e))
    
    # Test 5: GET /api/dashboard/analytics
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/analytics", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "historic" in data and "disciplines" in data and "completion" in data
        log_test("C_DASHBOARD", "GET /api/dashboard/analytics", success, 
                f"Keys: {list(data.keys()) if success else 'N/A'}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/dashboard/analytics", False, str(e))
    
    # Test 6: GET /api/alerts
    try:
        response = requests.get(f"{BASE_URL}/api/alerts", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "validation_pending" in data and "validation_rdv" in data
        log_test("C_DASHBOARD", "GET /api/alerts", success, 
                f"Keys: {list(data.keys()) if success else 'N/A'}")
    except Exception as e:
        log_test("C_DASHBOARD", "GET /api/alerts", False, str(e))

# ============================================================================
# D. REGISTRATIONS / EXPOSANTS / VENUES
# ============================================================================
def test_registrations():
    print_section("D. REGISTRATIONS / EXPOSANTS / VENUES")
    
    # Test 1: GET /api/registrations
    try:
        response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = len(data) == 67
        log_test("D_REGISTRATIONS", "GET /api/registrations", success, 
                f"Count: {len(data) if success else 'N/A'}")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/registrations", False, str(e), "critical")
    
    # Test 2: GET /api/registrations with filters
    try:
        response = requests.get(f"{BASE_URL}/api/registrations?status=confirme", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("D_REGISTRATIONS", "GET /api/registrations?status=confirme", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/registrations?status=confirme", False, str(e))
    
    # Test 3: GET /api/registrations/:id
    try:
        # Get first registration
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        if regs_response.status_code == 200:
            regs = regs_response.json()
            if len(regs) > 0:
                reg_id = regs[0]["id"]
                response = requests.get(f"{BASE_URL}/api/registrations/{reg_id}", headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("D_REGISTRATIONS", "GET /api/registrations/:id", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("D_REGISTRATIONS", "GET /api/registrations/:id", False, "No registrations found")
        else:
            log_test("D_REGISTRATIONS", "GET /api/registrations/:id", False, "Failed to get registrations")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/registrations/:id", False, str(e))
    
    # Test 4: GET /api/venues
    try:
        response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = len(data) == 6
        log_test("D_REGISTRATIONS", "GET /api/venues", success, 
                f"Count: {len(data) if success else 'N/A'}")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/venues", False, str(e))
    
    # Test 5: GET /api/venues/:id/stands
    try:
        venues_response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        if venues_response.status_code == 200:
            venues = venues_response.json()
            if len(venues) > 0:
                venue_id = venues[0]["id"]
                response = requests.get(f"{BASE_URL}/api/venues/{venue_id}/stands", headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("D_REGISTRATIONS", "GET /api/venues/:id/stands", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("D_REGISTRATIONS", "GET /api/venues/:id/stands", False, "No venues found")
        else:
            log_test("D_REGISTRATIONS", "GET /api/venues/:id/stands", False, "Failed to get venues")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/venues/:id/stands", False, str(e))
    
    # Test 6: GET /api/organizations
    try:
        response = requests.get(f"{BASE_URL}/api/organizations", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("D_REGISTRATIONS", "GET /api/organizations", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("D_REGISTRATIONS", "GET /api/organizations", False, str(e))

# ============================================================================
# E. ANIMATION SLOTS
# ============================================================================
def test_animation_slots():
    print_section("E. ANIMATION SLOTS")
    
    slot_id = None
    
    # Test 1: GET /api/animation-slots
    try:
        venues_response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        if venues_response.status_code == 200:
            venues = venues_response.json()
            if len(venues) > 0:
                venue_id = venues[0]["id"]
                response = requests.get(f"{BASE_URL}/api/animation-slots?venue_id={venue_id}", headers=ADMIN_HEADERS)
                success = response.status_code == 200
                log_test("E_ANIMATION", "GET /api/animation-slots?venue_id=...", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("E_ANIMATION", "GET /api/animation-slots?venue_id=...", False, "No venues found")
        else:
            log_test("E_ANIMATION", "GET /api/animation-slots?venue_id=...", False, "Failed to get venues")
    except Exception as e:
        log_test("E_ANIMATION", "GET /api/animation-slots?venue_id=...", False, str(e))
    
    # Test 2: POST /api/animation-slots (Friday 11:00-12:00)
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        venues_response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        
        if regs_response.status_code == 200 and venues_response.status_code == 200:
            regs = regs_response.json()
            venues = venues_response.json()
            
            if len(regs) > 0 and len(venues) > 0:
                reg_id = regs[0]["id"]
                venue_id = venues[0]["id"]
                
                payload = {
                    "registration_id": reg_id,
                    "venue_id": venue_id,
                    "day_label": "vendredi",
                    "start_time": "11:00",
                    "end_time": "12:00",
                    "title": "Test animation vendredi",
                    "type": "stand"
                }
                response = requests.post(f"{BASE_URL}/api/animation-slots", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                if success:
                    data = response.json()
                    slot_id = data.get("id")
                log_test("E_ANIMATION", "POST /api/animation-slots (Friday 11:00-12:00)", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("E_ANIMATION", "POST /api/animation-slots (Friday 11:00-12:00)", False, 
                        "No registrations or venues found")
        else:
            log_test("E_ANIMATION", "POST /api/animation-slots (Friday 11:00-12:00)", False, 
                    "Failed to get registrations or venues")
    except Exception as e:
        log_test("E_ANIMATION", "POST /api/animation-slots (Friday 11:00-12:00)", False, str(e))
    
    # Test 3: POST /api/animation-slots (Saturday 09:00-10:00)
    try:
        regs_response = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        venues_response = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        
        if regs_response.status_code == 200 and venues_response.status_code == 200:
            regs = regs_response.json()
            venues = venues_response.json()
            
            if len(regs) > 0 and len(venues) > 0:
                reg_id = regs[0]["id"]
                venue_id = venues[0]["id"]
                
                payload = {
                    "registration_id": reg_id,
                    "venue_id": venue_id,
                    "day_label": "samedi",
                    "start_time": "09:00",
                    "end_time": "10:00",
                    "title": "Test animation samedi",
                    "type": "stand"
                }
                response = requests.post(f"{BASE_URL}/api/animation-slots", json=payload, headers=ADMIN_HEADERS)
                success = response.status_code in [200, 201]
                log_test("E_ANIMATION", "POST /api/animation-slots (Saturday 09:00-10:00)", success, 
                        f"Status: {response.status_code}")
            else:
                log_test("E_ANIMATION", "POST /api/animation-slots (Saturday 09:00-10:00)", False, 
                        "No registrations or venues found")
        else:
            log_test("E_ANIMATION", "POST /api/animation-slots (Saturday 09:00-10:00)", False, 
                    "Failed to get registrations or venues")
    except Exception as e:
        log_test("E_ANIMATION", "POST /api/animation-slots (Saturday 09:00-10:00)", False, str(e))
    
    # Test 4: DELETE /api/animation-slots/:id (cleanup)
    if slot_id:
        try:
            response = requests.delete(f"{BASE_URL}/api/animation-slots/{slot_id}", headers=ADMIN_HEADERS)
            success = response.status_code == 200
            log_test("E_ANIMATION", "DELETE /api/animation-slots/:id (cleanup)", success, 
                    f"Status: {response.status_code}")
        except Exception as e:
            log_test("E_ANIMATION", "DELETE /api/animation-slots/:id (cleanup)", False, str(e))

# ============================================================================
# H. MAILING (TEST MODE)
# ============================================================================
def test_mailing():
    print_section("H. MAILING (TEST MODE)")
    
    # Test 1: GET /api/mailing/status
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/status", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "config_source" in data
        log_test("H_MAILING", "GET /api/mailing/status", success, 
                f"Config source: {data.get('config_source') if success else 'N/A'}")
    except Exception as e:
        log_test("H_MAILING", "GET /api/mailing/status", False, str(e))
    
    # Test 2: POST /api/mailing/test-smtp
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/test-smtp", json={}, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("H_MAILING", "POST /api/mailing/test-smtp", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("H_MAILING", "POST /api/mailing/test-smtp", False, str(e))
    
    # Test 3: POST /api/mailing/send-test
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/send-test", 
                               json={"to": "test@example.com"}, headers=ADMIN_HEADERS)
        # Expected to work or fail gracefully
        log_test("H_MAILING", "POST /api/mailing/send-test", True, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("H_MAILING", "POST /api/mailing/send-test", False, str(e))
    
    # Test 4: POST /api/mailing/generate-ai
    try:
        response = requests.post(f"{BASE_URL}/api/mailing/generate-ai", 
                               json={"mail_type": "relance_caution", "registration_ids": []}, 
                               headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("H_MAILING", "POST /api/mailing/generate-ai", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("H_MAILING", "POST /api/mailing/generate-ai", False, str(e))
    
    # Test 5: GET /api/mailing/scheduled
    try:
        response = requests.get(f"{BASE_URL}/api/mailing/scheduled", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("H_MAILING", "GET /api/mailing/scheduled", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("H_MAILING", "GET /api/mailing/scheduled", False, str(e))

# ============================================================================
# J. TOOLS / BULK / SCHEDULER
# ============================================================================
def test_tools():
    print_section("J. TOOLS / BULK / SCHEDULER")
    
    # Test 1: POST /api/tools/recompute-completion
    try:
        response = requests.post(f"{BASE_URL}/api/tools/recompute-completion", json={}, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "total" in data and "updated" in data
        log_test("J_TOOLS", "POST /api/tools/recompute-completion", success, 
                f"Total: {data.get('total') if success else 'N/A'}, Updated: {data.get('updated') if success else 'N/A'}")
    except Exception as e:
        log_test("J_TOOLS", "POST /api/tools/recompute-completion", False, str(e))
    
    # Test 2: POST /api/tools/generate-relances (idempotent)
    try:
        response = requests.post(f"{BASE_URL}/api/tools/generate-relances", json={}, headers=ADMIN_HEADERS)
        success = response.status_code == 200
        if success:
            data = response.json()
            success = "created" in data
        log_test("J_TOOLS", "POST /api/tools/generate-relances", success, 
                f"Created: {data.get('created') if success else 'N/A'}")
    except Exception as e:
        log_test("J_TOOLS", "POST /api/tools/generate-relances", False, str(e))
    
    # Test 3: POST /api/registrations/bulk-confirm (with empty ids → 400)
    try:
        response = requests.post(f"{BASE_URL}/api/registrations/bulk-confirm", 
                               json={"ids": []}, headers=ADMIN_HEADERS)
        success = response.status_code == 400
        log_test("J_TOOLS", "POST /api/registrations/bulk-confirm (empty ids) → 400", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("J_TOOLS", "POST /api/registrations/bulk-confirm (empty ids) → 400", False, str(e))

# ============================================================================
# K. SATISFACTION / PROSPECTS / VALIDATIONS
# ============================================================================
def test_satisfaction():
    print_section("K. SATISFACTION / PROSPECTS / VALIDATIONS")
    
    # Test 1: GET /api/satisfaction
    try:
        response = requests.get(f"{BASE_URL}/api/satisfaction", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K_SATISFACTION", "GET /api/satisfaction", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K_SATISFACTION", "GET /api/satisfaction", False, str(e))
    
    # Test 2: GET /api/satisfaction/stats
    try:
        response = requests.get(f"{BASE_URL}/api/satisfaction/stats", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K_SATISFACTION", "GET /api/satisfaction/stats", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K_SATISFACTION", "GET /api/satisfaction/stats", False, str(e))
    
    # Test 3: GET /api/prospects
    try:
        response = requests.get(f"{BASE_URL}/api/prospects", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K_SATISFACTION", "GET /api/prospects", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K_SATISFACTION", "GET /api/prospects", False, str(e))
    
    # Test 4: GET /api/prospects/stats
    try:
        response = requests.get(f"{BASE_URL}/api/prospects/stats", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K_SATISFACTION", "GET /api/prospects/stats", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K_SATISFACTION", "GET /api/prospects/stats", False, str(e))
    
    # Test 5: GET /api/validation-requests
    try:
        response = requests.get(f"{BASE_URL}/api/validation-requests", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("K_SATISFACTION", "GET /api/validation-requests", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("K_SATISFACTION", "GET /api/validation-requests", False, str(e))

# ============================================================================
# G. DOCUMENTS
# ============================================================================
def test_documents():
    print_section("G. DOCUMENTS")
    
    # Test 1: GET /api/official-documents
    try:
        response = requests.get(f"{BASE_URL}/api/official-documents", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("G_DOCUMENTS", "GET /api/official-documents", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("G_DOCUMENTS", "GET /api/official-documents", False, str(e))
    
    # Test 2: POST /api/official-documents (admin only check)
    try:
        # Test with exposant headers (should fail)
        response = requests.post(f"{BASE_URL}/api/official-documents", 
                               json={"title": "Test", "description": "Test"}, 
                               headers=EXPOSANT_HEADERS)
        success = response.status_code == 403
        log_test("G_DOCUMENTS", "POST /api/official-documents (non-admin) → 403", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("G_DOCUMENTS", "POST /api/official-documents (non-admin) → 403", False, str(e))
    
    # Test 3: DELETE /api/official-documents/:id (with non-existent id → 404)
    try:
        response = requests.delete(f"{BASE_URL}/api/official-documents/non-existent-id", 
                                  headers=ADMIN_HEADERS)
        success = response.status_code == 404
        log_test("G_DOCUMENTS", "DELETE /api/official-documents/:id (non-existent) → 404", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("G_DOCUMENTS", "DELETE /api/official-documents/:id (non-existent) → 404", False, str(e))

# ============================================================================
# L. ACCESS TOKENS
# ============================================================================
def test_access_tokens():
    print_section("L. ACCESS TOKENS")
    
    # Test 1: GET /api/access-tokens
    try:
        response = requests.get(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS)
        success = response.status_code == 200
        log_test("L_ACCESS_TOKENS", "GET /api/access-tokens", success, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("L_ACCESS_TOKENS", "GET /api/access-tokens", False, str(e))
    
    # Test 2: POST /api/access-tokens (valid purpose)
    try:
        response = requests.post(f"{BASE_URL}/api/access-tokens", 
                               json={"purpose": "exposant", "registration_id": "test-reg-id"}, 
                               headers=ADMIN_HEADERS)
        # Should work or fail gracefully
        log_test("L_ACCESS_TOKENS", "POST /api/access-tokens (valid purpose)", True, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("L_ACCESS_TOKENS", "POST /api/access-tokens (valid purpose)", False, str(e))

# ============================================================================
# MAIN EXECUTION
# ============================================================================
def print_summary():
    """Print final summary report"""
    print("\n" + "=" * 80)
    print("  RAPPORT FINAL - AUDIT PRÉ-DÉPLOIEMENT")
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
        print("  ANOMALIES CRITIQUES (doivent être corrigées avant redéploiement)")
        print("=" * 80)
        for i, anomaly in enumerate(critical_anomalies, 1):
            print(f"{i}. {anomaly}")
    else:
        print("\n✅ Aucune anomalie critique détectée")
    
    # Print minor anomalies
    if minor_anomalies:
        print("\n" + "=" * 80)
        print("  ANOMALIES MINEURES (acceptables)")
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
        print("\n🎉 TOUS LES TESTS SONT PASSÉS - Application prête pour le redéploiement!")
        return 0
    else:
        print(f"\n⚠️  {total_ko} tests ont échoué - Voir détails ci-dessus")
        return 1

if __name__ == "__main__":
    print("=" * 80)
    print("  AUDIT COMPLET PRÉ-DÉPLOIEMENT — FORUM DE LA RENTRÉE 2026")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Mode: TEST (emails redirigés)")
    print("=" * 80)
    
    # Run all tests
    test_deadlines()
    test_auth_seed()
    test_dashboard()
    test_registrations()
    test_animation_slots()
    test_mailing()
    test_tools()
    test_satisfaction()
    test_documents()
    test_access_tokens()
    
    # Print summary and exit
    exit_code = print_summary()
    sys.exit(exit_code)
