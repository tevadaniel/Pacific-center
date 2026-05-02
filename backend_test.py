#!/usr/bin/env python3
"""
🎯 AUDIT TOTAL BACKEND — Forum de la Rentrée 2026
Teste TOUS les endpoints critiques selon sections A-H
"""
import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

# Credentials
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PWD = "demo"
TEVA_EMAIL = "teva.geros@aracom-conseil.fr"
TEVA_PWD = "Projetaracom12"

# Test results tracking
results = {
    "A_AUTH_SEED": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "B_NEW_ENDPOINTS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "C_ROUTES_REDIRECTIONS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "D_CRUD_ESSENTIALS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "E_MAILING_COMMUNICATION": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "F_DOCUMENTS_VENUE_STANDS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "G_DEADLINES_SETTINGS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
    "H_ANOMALIES_TASKS": {"total": 0, "passed": 0, "failed": 0, "tests": []},
}

anomalies = []

def log_test(section, name, passed, details="", criticality="NORMAL"):
    """Log test result"""
    results[section]["total"] += 1
    if passed:
        results[section]["passed"] += 1
        status = "✅ PASS"
    else:
        results[section]["failed"] += 1
        status = "❌ FAIL"
        anomalies.append({
            "section": section,
            "test": name,
            "details": details,
            "criticality": criticality
        })
    
    results[section]["tests"].append({
        "name": name,
        "status": status,
        "details": details,
        "criticality": criticality
    })
    print(f"{status} [{section}] {name}")
    if details and not passed:
        print(f"    └─ {details}")

def test_endpoint(method, path, expected_status, headers=None, json_data=None, description="", section="D_CRUD_ESSENTIALS", criticality="NORMAL"):
    """Generic endpoint tester"""
    url = f"{BASE_URL}/{path}"
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            r = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PUT":
            r = requests.put(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            r = requests.delete(url, headers=headers, timeout=10)
        
        passed = r.status_code == expected_status
        details = f"Status: {r.status_code} (expected {expected_status})"
        if not passed:
            try:
                details += f" | Response: {r.json()}"
            except:
                details += f" | Response: {r.text[:200]}"
        
        log_test(section, description or f"{method} /{path}", passed, details, criticality)
        return r
    except Exception as e:
        log_test(section, description or f"{method} /{path}", False, f"Exception: {str(e)}", criticality)
        return None

print("=" * 80)
print("🎯 AUDIT TOTAL BACKEND — Forum de la Rentrée 2026")
print("=" * 80)
print()

# ═══════════════════════════════════════════════════════════════
# A. AUTH & SEED
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION A: AUTH & SEED")
print("-" * 80)

# A1. Login admin@aracom.pf
r = test_endpoint("POST", "auth/login", 200, 
    json_data={"email": ADMIN_EMAIL, "password": ADMIN_PWD},
    description="Login admin@aracom.pf / demo",
    section="A_AUTH_SEED",
    criticality="CRITIQUE")
admin_headers = None
if r and r.status_code == 200:
    data = r.json()
    if "user" in data:
        admin_headers = {
            "x-user-id": data["user"]["id"],
            "x-user-role": data["user"]["role_code"]
        }

# A2. Login teva.geros@aracom-conseil.fr
r = test_endpoint("POST", "auth/login", 200,
    json_data={"email": TEVA_EMAIL, "password": TEVA_PWD},
    description="Login teva.geros@aracom-conseil.fr / Projetaracom12",
    section="A_AUTH_SEED",
    criticality="CRITIQUE")

# A3. Login with wrong password
test_endpoint("POST", "auth/login", 401,
    json_data={"email": ADMIN_EMAIL, "password": "wrongpassword"},
    description="Login with wrong password → 401",
    section="A_AUTH_SEED",
    criticality="NORMAL")

# A4. GET /auth/me with admin headers
if admin_headers:
    test_endpoint("GET", "auth/me", 200,
        headers=admin_headers,
        description="GET /auth/me with admin headers",
        section="A_AUTH_SEED",
        criticality="CRITIQUE")

# ═══════════════════════════════════════════════════════════════
# B. NOUVEAUX ENDPOINTS (sessions 13-16)
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION B: NOUVEAUX ENDPOINTS (sessions 13-16)")
print("-" * 80)

if admin_headers:
    # B1. POST /venues/venue-faaa/set-referent
    test_endpoint("POST", "venues/venue-faaa/set-referent", 200,
        headers=admin_headers,
        json_data={"name": "Teva GEROS", "email": "contact@aracom-conseil.fr", "phone": "+(689) 87 210 444"},
        description="POST /venues/venue-faaa/set-referent (admin)",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    
    # B2. GET /venues → verify referent_aracom
    r = test_endpoint("GET", "venues", 200,
        headers=admin_headers,
        description="GET /venues → verify referent_aracom in payload",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    if r and r.status_code == 200:
        venues = r.json()
        faaa = next((v for v in venues if v.get("id") == "venue-faaa"), None)
        if faaa and "referent_aracom" in faaa:
            log_test("B_NEW_ENDPOINTS", "Venue Faaa has referent_aracom field", True, "", "MAJEURE")
        else:
            log_test("B_NEW_ENDPOINTS", "Venue Faaa has referent_aracom field", False, "Field not found", "MAJEURE")
    
    # B3. Get a registration ID for testing
    r = requests.get(f"{BASE_URL}/registrations", headers=admin_headers, timeout=10)
    reg_id = None
    if r.status_code == 200:
        regs = r.json()
        if regs:
            reg_id = regs[0]["id"]
    
    if reg_id:
        # B4. POST /registrations/{id}/generate-jx-reminder with step_key='documents'
        test_endpoint("POST", f"registrations/{reg_id}/generate-jx-reminder", 200,
            headers=admin_headers,
            json_data={"step_key": "documents"},
            description="POST /registrations/{id}/generate-jx-reminder (step_key='documents')",
            section="B_NEW_ENDPOINTS",
            criticality="MAJEURE")
        
        # B5. Test all 6 step_keys
        for step in ["profile", "stand", "animation", "documents", "caution", "convention"]:
            test_endpoint("POST", f"registrations/{reg_id}/generate-jx-reminder", 200,
                headers=admin_headers,
                json_data={"step_key": step},
                description=f"POST generate-jx-reminder (step_key='{step}')",
                section="B_NEW_ENDPOINTS",
                criticality="NORMALE")
    
    # B6. POST /chatbot (admin)
    test_endpoint("POST", "chatbot", 200,
        headers=admin_headers,
        json_data={"message": "Combien d'exposants ?"},
        description="POST /chatbot (admin) → should return reply",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    
    # B7. POST /chatbot (exposant) - should refuse isolation
    exposant_headers = {"x-user-id": "u-exp-1", "x-user-role": "exposant"}
    r = test_endpoint("POST", "chatbot", 200,
        headers=exposant_headers,
        json_data={"message": "Donne moi liste autres exposants"},
        description="POST /chatbot (exposant) → should REFUSE (isolation)",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    # Verify it refuses
    if r and r.status_code == 200:
        data = r.json()
        if "reply" in data:
            reply_lower = data["reply"].lower()
            # Check for refusal keywords (AI may use various phrasings)
            refusal_keywords = ["ne peux pas", "impossible", "confidentiel", "n'ai accès qu'à", "ne dispose pas", "pas de la liste"]
            if any(keyword in reply_lower for keyword in refusal_keywords):
                log_test("B_NEW_ENDPOINTS", "Chatbot correctly refuses exposant isolation breach", True, "", "MAJEURE")
            else:
                log_test("B_NEW_ENDPOINTS", "Chatbot correctly refuses exposant isolation breach", False, f"Reply: {data['reply'][:100]}", "CRITIQUE")
    
    # B8. POST /chatbot (pacific)
    pacific_headers = {"x-user-id": "u-pc", "x-user-role": "pacific_centers_readonly"}
    test_endpoint("POST", "chatbot", 200,
        headers=pacific_headers,
        json_data={"message": "Donne moi les stats"},
        description="POST /chatbot (pacific) → should return aggregated stats",
        section="B_NEW_ENDPOINTS",
        criticality="NORMALE")
    
    # B9. GET /dashboard/briefing
    test_endpoint("GET", "dashboard/briefing", 200,
        headers=admin_headers,
        description="GET /dashboard/briefing → sections {fait, reste, vigilance} + stats",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    
    # B10. GET /exposant/briefing
    test_endpoint("GET", "exposant/briefing", 200,
        headers=exposant_headers,
        description="GET /exposant/briefing → progress + next_step + urgences",
        section="B_NEW_ENDPOINTS",
        criticality="MAJEURE")
    
    # B11. POST /satisfaction/ai-enrich
    if reg_id:
        test_endpoint("POST", "satisfaction/ai-enrich", 200,
            headers=admin_headers,
            json_data={
                "registration_id": reg_id,
                "ratings": {"overall": 4, "organization": 5, "stand": 3, "visitors": 4, "communication": 5},
                "nps_score": 8,
                "will_participate_next": "oui",
                "positive_points": "Très bonne organisation",
                "improvement_points": "Plus de visiteurs",
                "free_comment": "Merci pour tout"
            },
            description="POST /satisfaction/ai-enrich → positive_points + improvement_points",
            section="B_NEW_ENDPOINTS",
            criticality="NORMALE")

# ═══════════════════════════════════════════════════════════════
# C. ROUTES ET REDIRECTIONS (magic links)
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION C: ROUTES ET REDIRECTIONS (magic links)")
print("-" * 80)

if admin_headers:
    # C1. GET /access-tokens
    r = test_endpoint("GET", "access-tokens", 200,
        headers=admin_headers,
        description="GET /access-tokens → list tokens",
        section="C_ROUTES_REDIRECTIONS",
        criticality="MAJEURE")
    
    exposant_token = None
    pacific_token = None
    if r and r.status_code == 200:
        tokens = r.json()
        for t in tokens:
            if t.get("purpose") == "exposant" and not exposant_token:
                exposant_token = t.get("token")
            if t.get("purpose") == "pacific" and not pacific_token:
                pacific_token = t.get("token")
    
    # C2. POST /auth/consume-token (exposant)
    if exposant_token:
        test_endpoint("POST", "auth/consume-token", 200,
            json_data={"token": exposant_token},
            description="POST /auth/consume-token (exposant token) → 200 with user",
            section="C_ROUTES_REDIRECTIONS",
            criticality="CRITIQUE")
    
    # C3. POST /auth/consume-token (invalid)
    test_endpoint("POST", "auth/consume-token", 404,
        json_data={"token": "invalid-token-xyz"},
        description="POST /auth/consume-token (invalid) → 404",
        section="C_ROUTES_REDIRECTIONS",
        criticality="NORMALE")
    
    # C4. POST /auth/consume-token (pacific)
    if pacific_token:
        test_endpoint("POST", "auth/consume-token", 200,
            json_data={"token": pacific_token},
            description="POST /auth/consume-token (pacific token) → 200 with role pacific",
            section="C_ROUTES_REDIRECTIONS",
            criticality="MAJEURE")

# ═══════════════════════════════════════════════════════════════
# D. CRUD ESSENTIELS (non-régression)
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION D: CRUD ESSENTIELS (non-régression)")
print("-" * 80)

if admin_headers:
    # D1. GET /dashboard/kpis
    r = test_endpoint("GET", "dashboard/kpis", 200,
        headers=admin_headers,
        description="GET /dashboard/kpis → total > 0",
        section="D_CRUD_ESSENTIALS",
        criticality="CRITIQUE")
    if r and r.status_code == 200:
        kpis = r.json()
        if kpis.get("total", 0) > 0:
            log_test("D_CRUD_ESSENTIALS", "KPIs total > 0", True, f"Total: {kpis.get('total')}", "CRITIQUE")
        else:
            log_test("D_CRUD_ESSENTIALS", "KPIs total > 0", False, "Total is 0", "CRITIQUE")
    
    # D2. GET /registrations
    r = test_endpoint("GET", "registrations", 200,
        headers=admin_headers,
        description="GET /registrations → array (≥50)",
        section="D_CRUD_ESSENTIALS",
        criticality="CRITIQUE")
    if r and r.status_code == 200:
        regs = r.json()
        if len(regs) >= 50:
            log_test("D_CRUD_ESSENTIALS", "Registrations count ≥ 50", True, f"Count: {len(regs)}", "CRITIQUE")
        else:
            log_test("D_CRUD_ESSENTIALS", "Registrations count ≥ 50", False, f"Count: {len(regs)}", "MAJEURE")
    
    # D3. GET /registrations/{id}
    if reg_id:
        r = test_endpoint("GET", f"registrations/{reg_id}", 200,
            headers=admin_headers,
            description="GET /registrations/{id} → with organization, venue, deposits",
            section="D_CRUD_ESSENTIALS",
            criticality="CRITIQUE")
        if r and r.status_code == 200:
            data = r.json()
            has_org = "organization" in data
            has_venue = "venue" in data
            has_deposit = "deposit" in data
            if has_org and has_venue and has_deposit:
                log_test("D_CRUD_ESSENTIALS", "Registration detail has org/venue/deposit", True, "", "CRITIQUE")
            else:
                log_test("D_CRUD_ESSENTIALS", "Registration detail has org/venue/deposit", False, 
                    f"Missing: org={has_org}, venue={has_venue}, deposit={has_deposit}", "CRITIQUE")
    
    # D4. GET /venues
    r = test_endpoint("GET", "venues", 200,
        headers=admin_headers,
        description="GET /venues → 6 venues",
        section="D_CRUD_ESSENTIALS",
        criticality="CRITIQUE")
    if r and r.status_code == 200:
        venues = r.json()
        if len(venues) >= 6:
            log_test("D_CRUD_ESSENTIALS", "Venues count ≥ 6", True, f"Count: {len(venues)}", "CRITIQUE")
        else:
            log_test("D_CRUD_ESSENTIALS", "Venues count ≥ 6", False, f"Count: {len(venues)}", "MAJEURE")
    
    # D5. GET /animation-slots?venue_id=venue-faaa
    test_endpoint("GET", "animation-slots?venue_id=venue-faaa", 200,
        headers=admin_headers,
        description="GET /animation-slots?venue_id=venue-faaa",
        section="D_CRUD_ESSENTIALS",
        criticality="NORMALE")
    
    # D6. POST /registrations/{id}/profile (update)
    if reg_id:
        test_endpoint("POST", f"registrations/{reg_id}/profile", 200,
            headers=admin_headers,
            json_data={"discipline": "Test Audit"},
            description="POST /registrations/{id}/profile → update discipline",
            section="D_CRUD_ESSENTIALS",
            criticality="NORMALE")
    
    # D7. GET /satisfaction
    test_endpoint("GET", "satisfaction", 200,
        headers=admin_headers,
        description="GET /satisfaction",
        section="D_CRUD_ESSENTIALS",
        criticality="NORMALE")
    
    # D8. GET /satisfaction/stats
    r = test_endpoint("GET", "satisfaction/stats", 200,
        headers=admin_headers,
        description="GET /satisfaction/stats → total_responses, NPS",
        section="D_CRUD_ESSENTIALS",
        criticality="NORMALE")
    if r and r.status_code == 200:
        stats = r.json()
        has_total = "total_responses" in stats
        has_nps = "nps" in stats
        if has_total and has_nps:
            log_test("D_CRUD_ESSENTIALS", "Satisfaction stats has total_responses + NPS", True, "", "NORMALE")
        else:
            log_test("D_CRUD_ESSENTIALS", "Satisfaction stats has total_responses + NPS", False, 
                f"Missing: total={has_total}, nps={has_nps}", "NORMALE")

# ═══════════════════════════════════════════════════════════════
# E. MAILING & COMMUNICATION
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION E: MAILING & COMMUNICATION")
print("-" * 80)

if admin_headers:
    # E1. GET /mailing/status
    r = test_endpoint("GET", "mailing/status", 200,
        headers=admin_headers,
        description="GET /mailing/status",
        section="E_MAILING_COMMUNICATION",
        criticality="MAJEURE")
    if r and r.status_code == 200:
        status = r.json()
        # Verify it's in TEST mode
        if status.get("test_mode_active") == True:
            log_test("E_MAILING_COMMUNICATION", "Mail mode is TEST (safe)", True, "", "CRITIQUE")
        else:
            log_test("E_MAILING_COMMUNICATION", "Mail mode is TEST (safe)", False, 
                "WARNING: Mail mode is PRODUCTION!", "CRITIQUE")
    
    # E2. POST /mailing/generate-ai
    test_endpoint("POST", "mailing/generate-ai", 200,
        headers=admin_headers,
        json_data={"mail_type": "relance_caution", "registration_ids": []},
        description="POST /mailing/generate-ai (relance_caution)",
        section="E_MAILING_COMMUNICATION",
        criticality="MAJEURE")
    
    # E3. POST /mailing/send (TEST mode)
    if reg_id:
        test_endpoint("POST", "mailing/send", 200,
            headers=admin_headers,
            json_data={
                "subject": "Test Audit Backend",
                "body_html": "<p>Test email</p>",
                "registration_ids": [reg_id],
                "mail_type": "test"
            },
            description="POST /mailing/send (TEST mode)",
            section="E_MAILING_COMMUNICATION",
            criticality="MAJEURE")
    
    # E4. GET /emails
    test_endpoint("GET", "emails", 200,
        headers=admin_headers,
        description="GET /emails",
        section="E_MAILING_COMMUNICATION",
        criticality="NORMALE")

# ═══════════════════════════════════════════════════════════════
# F. DOCUMENTS & VENUE STANDS
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION F: DOCUMENTS & VENUE STANDS")
print("-" * 80)

if admin_headers:
    # F1. GET /documents?registration_id={id}
    if reg_id:
        test_endpoint("GET", f"documents?registration_id={reg_id}", 200,
            headers=admin_headers,
            description="GET /documents?registration_id={id}",
            section="F_DOCUMENTS_VENUE_STANDS",
            criticality="NORMALE")
    
    # F2. GET /official-documents
    test_endpoint("GET", "official-documents", 200,
        headers=admin_headers,
        description="GET /official-documents",
        section="F_DOCUMENTS_VENUE_STANDS",
        criticality="MAJEURE")
    
    # F3. GET /venue-stands?venue_id=venue-faaa
    r = test_endpoint("GET", "venues/venue-faaa/stands", 200,
        headers=admin_headers,
        description="GET /venue-stands?venue_id=venue-faaa → verify pos_x/pos_y",
        section="F_DOCUMENTS_VENUE_STANDS",
        criticality="MAJEURE")
    if r and r.status_code == 200:
        stands = r.json()
        has_positions = any(s.get("pos_x") is not None for s in stands)
        if has_positions:
            log_test("F_DOCUMENTS_VENUE_STANDS", "Venue stands have positions (pos_x/pos_y)", True, "", "MAJEURE")
        else:
            log_test("F_DOCUMENTS_VENUE_STANDS", "Venue stands have positions (pos_x/pos_y)", False, 
                "No stands have positions", "MAJEURE")
    
    # F4. POST /venue-stands/clear-positions (should NOT erase visual positions)
    test_endpoint("POST", "venue-stands/clear-positions", 200,
        headers=admin_headers,
        json_data={"venue_id": "venue-faaa"},
        description="POST /venue-stands/clear-positions → should keep positions",
        section="F_DOCUMENTS_VENUE_STANDS",
        criticality="CRITIQUE")
    
    # F5. Verify positions are still there after clear
    r = test_endpoint("GET", "venues/venue-faaa/stands", 200,
        headers=admin_headers,
        description="GET venue-faaa stands after clear → positions should remain",
        section="F_DOCUMENTS_VENUE_STANDS",
        criticality="CRITIQUE")
    if r and r.status_code == 200:
        stands = r.json()
        has_positions = any(s.get("pos_x") is not None for s in stands)
        if has_positions:
            log_test("F_DOCUMENTS_VENUE_STANDS", "Positions preserved after clear-positions", True, "", "CRITIQUE")
        else:
            log_test("F_DOCUMENTS_VENUE_STANDS", "Positions preserved after clear-positions", False, 
                "REGRESSION: Positions were erased!", "CRITIQUE")

# ═══════════════════════════════════════════════════════════════
# G. DEADLINES & SETTINGS
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION G: DEADLINES & SETTINGS")
print("-" * 80)

if admin_headers:
    # G1. GET /step-deadlines
    r = test_endpoint("GET", "step-deadlines", 200,
        headers=admin_headers,
        description="GET /step-deadlines → 6 keys",
        section="G_DEADLINES_SETTINGS",
        criticality="MAJEURE")
    if r and r.status_code == 200:
        data = r.json()
        deadlines = data.get("deadlines", {})
        expected_keys = ["profile", "stand", "animation", "documents", "caution", "convention"]
        has_all = all(k in deadlines for k in expected_keys)
        if has_all:
            log_test("G_DEADLINES_SETTINGS", "Step deadlines has all 6 keys", True, "", "MAJEURE")
        else:
            missing = [k for k in expected_keys if k not in deadlines]
            log_test("G_DEADLINES_SETTINGS", "Step deadlines has all 6 keys", False, 
                f"Missing: {missing}", "MAJEURE")
    
    # G2. POST /step-deadlines (update)
    test_endpoint("POST", "step-deadlines", 200,
        headers=admin_headers,
        json_data={"deadlines": {"profile": "2026-07-01"}},
        description="POST /step-deadlines → update profile deadline",
        section="G_DEADLINES_SETTINGS",
        criticality="NORMALE")
    
    # G3. GET /post-event-status
    test_endpoint("GET", "post-event-status", 200,
        headers=admin_headers,
        description="GET /post-event-status → unlocked field",
        section="G_DEADLINES_SETTINGS",
        criticality="NORMALE")

# ═══════════════════════════════════════════════════════════════
# H. ANOMALIES & TASKS
# ═══════════════════════════════════════════════════════════════
print("\n📋 SECTION H: ANOMALIES & TASKS")
print("-" * 80)

if admin_headers:
    # H1. GET /anomalies
    test_endpoint("GET", "anomalies", 200,
        headers=admin_headers,
        description="GET /anomalies",
        section="H_ANOMALIES_TASKS",
        criticality="NORMALE")
    
    # H2. GET /tasks
    test_endpoint("GET", "tasks", 200,
        headers=admin_headers,
        description="GET /tasks",
        section="H_ANOMALIES_TASKS",
        criticality="NORMALE")
    
    # H3. GET /validation-requests
    test_endpoint("GET", "validation-requests", 200,
        headers=admin_headers,
        description="GET /validation-requests",
        section="H_ANOMALIES_TASKS",
        criticality="NORMALE")

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 80)
print("📊 RÉSULTATS DE L'AUDIT")
print("=" * 80)

total_tests = 0
total_passed = 0
total_failed = 0

for section, data in results.items():
    total_tests += data["total"]
    total_passed += data["passed"]
    total_failed += data["failed"]
    
    pct = (data["passed"] / data["total"] * 100) if data["total"] > 0 else 0
    status_icon = "✅" if pct == 100 else "⚠️" if pct >= 80 else "❌"
    
    print(f"\n{status_icon} {section}: {data['passed']}/{data['total']} ({pct:.1f}%)")

overall_pct = (total_passed / total_tests * 100) if total_tests > 0 else 0
print(f"\n{'=' * 80}")
print(f"🎯 SCORE GLOBAL: {total_passed}/{total_tests} ({overall_pct:.1f}%)")
print(f"{'=' * 80}")

# ═══════════════════════════════════════════════════════════════
# ANOMALIES DÉTAILLÉES
# ═══════════════════════════════════════════════════════════════
if anomalies:
    print(f"\n⚠️  ANOMALIES DÉTECTÉES: {len(anomalies)}")
    print("=" * 80)
    
    # Group by criticality
    critiques = [a for a in anomalies if a["criticality"] == "CRITIQUE"]
    majeures = [a for a in anomalies if a["criticality"] == "MAJEURE"]
    normales = [a for a in anomalies if a["criticality"] == "NORMALE"]
    
    if critiques:
        print(f"\n🔴 CRITIQUES ({len(critiques)}):")
        for a in critiques:
            print(f"  • [{a['section']}] {a['test']}")
            print(f"    └─ {a['details']}")
    
    if majeures:
        print(f"\n🟠 MAJEURES ({len(majeures)}):")
        for a in majeures:
            print(f"  • [{a['section']}] {a['test']}")
            print(f"    └─ {a['details']}")
    
    if normales:
        print(f"\n🟡 NORMALES ({len(normales)}):")
        for a in normales:
            print(f"  • [{a['section']}] {a['test']}")
            print(f"    └─ {a['details']}")
else:
    print("\n✅ AUCUNE ANOMALIE DÉTECTÉE!")

print("\n" + "=" * 80)
print("Mode mail: Vérifier que le système reste en TEST")
print("=" * 80)

# Exit with appropriate code
sys.exit(0 if total_failed == 0 else 1)
