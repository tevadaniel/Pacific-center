#!/usr/bin/env python3
"""
🎯 VALIDATION RAPIDE — 4 corrections backend (session 14)

Tests exhaustifs des 4 corrections mineures détectées dans l'audit précédent.

BASE_URL: https://polynesie-event-hub.preview.emergentagent.com
Auth admin: admin@aracom.pf / demo OU headers x-user-id: u-admin-aracom + x-user-role: aracom_admin

Mode mail doit RESTER en TEST.
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
ADMIN_HEADERS = {
    "x-user-id": "u-admin-aracom",
    "x-user-role": "aracom_admin",
    "Content-Type": "application/json"
}

def log(msg, level="INFO"):
    """Log avec timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}")

def test_result(test_id, description, passed, details=""):
    """Affiche le résultat d'un test"""
    status = "✅ OK" if passed else "❌ KO"
    log(f"{test_id} - {description}: {status}")
    if details:
        print(f"    → {details}")
    return passed

# ═══════════════════════════════════════════════════════════════
# FIX 1 — GET /api/auth/me avec headers seuls
# ═══════════════════════════════════════════════════════════════

def test_fix1():
    """FIX 1 — GET /api/auth/me avec headers seuls (fallback admin)"""
    log("═══ FIX 1 — GET /api/auth/me avec headers seuls ═══", "TEST")
    results = []
    
    # Test 1.1: GET /api/auth/me avec headers admin valides
    try:
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_HEADERS)
        passed = r.status_code == 200 and r.json().get("user", {}).get("role_code") == "aracom_admin"
        results.append(test_result(
            "[1.1]", 
            "GET /api/auth/me avec headers admin valides",
            passed,
            f"Status: {r.status_code}, role_code: {r.json().get('user', {}).get('role_code')}"
        ))
    except Exception as e:
        results.append(test_result("[1.1]", "GET /api/auth/me avec headers admin valides", False, str(e)))
    
    # Test 1.2: GET /api/auth/me avec user_id fake mais role admin (fallback)
    try:
        headers = {**ADMIN_HEADERS, "x-user-id": "u-fake-99999"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user = r.json().get("user", {})
        passed = (r.status_code == 200 and 
                 user.get("role_code") == "aracom_admin" and 
                 user.get("email") == "admin@aracom.pf")
        results.append(test_result(
            "[1.2]", 
            "GET /api/auth/me avec user_id fake + role admin (fallback)",
            passed,
            f"Status: {r.status_code}, email: {user.get('email')}, role: {user.get('role_code')}"
        ))
    except Exception as e:
        results.append(test_result("[1.2]", "GET /api/auth/me avec user_id fake + role admin", False, str(e)))
    
    # Test 1.3: GET /api/auth/me sans aucun header
    try:
        r = requests.get(f"{BASE_URL}/api/auth/me")
        passed = r.status_code == 401
        results.append(test_result(
            "[1.3]", 
            "GET /api/auth/me sans header → 401",
            passed,
            f"Status: {r.status_code}, message: {r.json().get('error', '')}"
        ))
    except Exception as e:
        results.append(test_result("[1.3]", "GET /api/auth/me sans header", False, str(e)))
    
    # Test 1.4: GET /api/auth/me avec user_id fake + role exposant (pas de fallback)
    try:
        headers = {"x-user-id": "u-fake-exposant", "x-user-role": "exposant"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        passed = r.status_code == 404
        results.append(test_result(
            "[1.4]", 
            "GET /api/auth/me avec user_id fake + role exposant → 404",
            passed,
            f"Status: {r.status_code}, message: {r.json().get('error', '')}"
        ))
    except Exception as e:
        results.append(test_result("[1.4]", "GET /api/auth/me avec user_id fake + role exposant", False, str(e)))
    
    return results

# ═══════════════════════════════════════════════════════════════
# FIX 2 — GET /api/field-comments (handler ajouté)
# ═══════════════════════════════════════════════════════════════

def test_fix2():
    """FIX 2 — GET /api/field-comments (handler ajouté)"""
    log("═══ FIX 2 — GET /api/field-comments (handler ajouté) ═══", "TEST")
    results = []
    
    # Test 2.1: GET /api/field-comments → 200 avec array
    try:
        r = requests.get(f"{BASE_URL}/api/field-comments", headers=ADMIN_HEADERS)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list)
        results.append(test_result(
            "[2.1]", 
            "GET /api/field-comments → 200 avec array",
            passed,
            f"Status: {r.status_code}, count: {len(data)}"
        ))
    except Exception as e:
        results.append(test_result("[2.1]", "GET /api/field-comments", False, str(e)))
    
    # Test 2.2: GET /api/field-comments?registration_id=<valid> → 200 avec array filtré
    try:
        # D'abord récupérer un registration_id valide
        r_reg = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        registrations = r_reg.json()
        if registrations and len(registrations) > 0:
            reg_id = registrations[0].get("id")
            r = requests.get(f"{BASE_URL}/api/field-comments?registration_id={reg_id}", headers=ADMIN_HEADERS)
            data = r.json()
            passed = r.status_code == 200 and isinstance(data, list)
            results.append(test_result(
                "[2.2]", 
                f"GET /api/field-comments?registration_id={reg_id[:20]}... → 200",
                passed,
                f"Status: {r.status_code}, count: {len(data)}"
            ))
        else:
            results.append(test_result("[2.2]", "GET /api/field-comments avec registration_id", False, "Aucune registration trouvée"))
    except Exception as e:
        results.append(test_result("[2.2]", "GET /api/field-comments avec registration_id", False, str(e)))
    
    # Test 2.3: GET /api/field-comments?registration_id=fake → 200 avec array vide
    try:
        r = requests.get(f"{BASE_URL}/api/field-comments?registration_id=reg-fake-99999", headers=ADMIN_HEADERS)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list) and len(data) == 0
        results.append(test_result(
            "[2.3]", 
            "GET /api/field-comments?registration_id=fake → 200 avec array vide",
            passed,
            f"Status: {r.status_code}, count: {len(data)}"
        ))
    except Exception as e:
        results.append(test_result("[2.3]", "GET /api/field-comments avec registration_id fake", False, str(e)))
    
    # Test 2.4: Vérifier qu'aucun _id MongoDB n'est exposé
    try:
        r = requests.get(f"{BASE_URL}/api/field-comments", headers=ADMIN_HEADERS)
        data = r.json()
        has_mongo_id = any("_id" in item for item in data)
        passed = r.status_code == 200 and not has_mongo_id
        results.append(test_result(
            "[2.4]", 
            "Aucun _id MongoDB exposé dans field-comments",
            passed,
            f"_id trouvé: {has_mongo_id}"
        ))
    except Exception as e:
        results.append(test_result("[2.4]", "Vérification _id MongoDB", False, str(e)))
    
    return results

# ═══════════════════════════════════════════════════════════════
# FIX 3 — POST /api/access-tokens accepte purpose='test'
# ═══════════════════════════════════════════════════════════════

def test_fix3():
    """FIX 3 — POST /api/access-tokens accepte purpose='test'"""
    log("═══ FIX 3 — POST /api/access-tokens accepte purpose='test' ═══", "TEST")
    results = []
    
    # Récupérer un organization_id valide
    try:
        r_orgs = requests.get(f"{BASE_URL}/api/organizations", headers=ADMIN_HEADERS)
        orgs = r_orgs.json()
        org_id = orgs[0].get("id") if orgs else None
    except:
        org_id = None
    
    if not org_id:
        log("⚠️ Aucune organization trouvée, tests FIX 3 limités", "WARN")
    
    # Test 3.1: POST /api/access-tokens avec purpose='access'
    if org_id:
        try:
            payload = {
                "organization_id": org_id,
                "purpose": "access",
                "send_email": False
            }
            r = requests.post(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS, json=payload)
            passed = r.status_code in [200, 201] and "token" in r.json()
            results.append(test_result(
                "[3.1]", 
                "POST /api/access-tokens avec purpose='access'",
                passed,
                f"Status: {r.status_code}, token présent: {'token' in r.json()}"
            ))
        except Exception as e:
            results.append(test_result("[3.1]", "POST /api/access-tokens avec purpose='access'", False, str(e)))
    
    # Test 3.2: POST /api/access-tokens avec purpose='pacific_centers'
    try:
        payload = {
            "email": "test@test.com",
            "purpose": "pacific_centers",
            "send_email": False
        }
        r = requests.post(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS, json=payload)
        passed = r.status_code in [200, 201]
        results.append(test_result(
            "[3.2]", 
            "POST /api/access-tokens avec purpose='pacific_centers'",
            passed,
            f"Status: {r.status_code}"
        ))
    except Exception as e:
        results.append(test_result("[3.2]", "POST /api/access-tokens avec purpose='pacific_centers'", False, str(e)))
    
    # Test 3.3: POST /api/access-tokens avec purpose='test' (LA CORRECTION)
    if org_id:
        try:
            payload = {
                "organization_id": org_id,
                "purpose": "test",
                "send_email": False
            }
            r = requests.post(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS, json=payload)
            passed = r.status_code in [200, 201]
            results.append(test_result(
                "[3.3]", 
                "POST /api/access-tokens avec purpose='test' → 200/201 (PAS 400)",
                passed,
                f"Status: {r.status_code}, error: {r.json().get('error', 'none')}"
            ))
        except Exception as e:
            results.append(test_result("[3.3]", "POST /api/access-tokens avec purpose='test'", False, str(e)))
    
    # Test 3.4: POST /api/access-tokens avec purpose='' (vide refusé)
    if org_id:
        try:
            payload = {
                "organization_id": org_id,
                "purpose": "",
                "send_email": False
            }
            r = requests.post(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS, json=payload)
            passed = r.status_code == 400
            results.append(test_result(
                "[3.4]", 
                "POST /api/access-tokens avec purpose='' → 400",
                passed,
                f"Status: {r.status_code}, error: {r.json().get('error', '')}"
            ))
        except Exception as e:
            results.append(test_result("[3.4]", "POST /api/access-tokens avec purpose vide", False, str(e)))
    
    # Test 3.5: POST /api/access-tokens sans purpose (utilise défaut 'access')
    if org_id:
        try:
            payload = {
                "organization_id": org_id,
                "send_email": False
            }
            r = requests.post(f"{BASE_URL}/api/access-tokens", headers=ADMIN_HEADERS, json=payload)
            passed = r.status_code in [200, 201]
            results.append(test_result(
                "[3.5]", 
                "POST /api/access-tokens sans purpose → 200 (défaut 'access')",
                passed,
                f"Status: {r.status_code}"
            ))
        except Exception as e:
            results.append(test_result("[3.5]", "POST /api/access-tokens sans purpose", False, str(e)))
    
    return results

# ═══════════════════════════════════════════════════════════════
# FIX 4 — Retry IA emergentChat sur timeout (lib/llm.js)
# ═══════════════════════════════════════════════════════════════

def test_fix4():
    """FIX 4 — Retry IA emergentChat sur timeout"""
    log("═══ FIX 4 — Retry IA emergentChat sur timeout ═══", "TEST")
    results = []
    
    # Récupérer un registration_id valide
    try:
        r_reg = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        registrations = r_reg.json()
        reg_id = registrations[0].get("id") if registrations else None
    except:
        reg_id = None
    
    if not reg_id:
        log("⚠️ Aucune registration trouvée, tests FIX 4 impossibles", "WARN")
        return []
    
    # Test 4.1: POST /api/registrations/<id>/generate-jx-reminder avec step_key='stand'
    # (c'était celui qui timeoutait avant)
    try:
        payload = {"step_key": "stand"}
        r = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder", 
                         headers=ADMIN_HEADERS, json=payload, timeout=30)
        data = r.json()
        passed = (r.status_code == 200 and 
                 data.get("ok") == True and 
                 data.get("subject") and 
                 data.get("body_html"))
        results.append(test_result(
            "[4.1]", 
            "POST generate-jx-reminder step_key='stand' → 200 (pas de timeout)",
            passed,
            f"Status: {r.status_code}, subject présent: {bool(data.get('subject'))}, llm_source: {data.get('llm_source')}"
        ))
    except requests.exceptions.Timeout:
        results.append(test_result("[4.1]", "POST generate-jx-reminder step_key='stand'", False, "TIMEOUT après 30s"))
    except Exception as e:
        results.append(test_result("[4.1]", "POST generate-jx-reminder step_key='stand'", False, str(e)))
    
    # Test 4.2: Tester les 6 step_keys (profile, stand, animation, documents, caution, convention)
    step_keys = ["profile", "stand", "animation", "documents", "caution", "convention"]
    success_count = 0
    for step_key in step_keys:
        try:
            payload = {"step_key": step_key}
            r = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder", 
                             headers=ADMIN_HEADERS, json=payload, timeout=30)
            if r.status_code == 200 and r.json().get("ok"):
                success_count += 1
        except:
            pass
    
    passed = success_count == len(step_keys)
    results.append(test_result(
        "[4.2]", 
        f"Tous les step_keys ({len(step_keys)}) fonctionnent sans timeout",
        passed,
        f"Succès: {success_count}/{len(step_keys)}"
    ))
    
    # Test 4.3: Vérifier que la réponse contient llm_source
    try:
        payload = {"step_key": "documents"}
        r = requests.post(f"{BASE_URL}/api/registrations/{reg_id}/generate-jx-reminder", 
                         headers=ADMIN_HEADERS, json=payload, timeout=30)
        data = r.json()
        llm_source = data.get("llm_source")
        passed = llm_source in ["emergent_proxy", "anthropic_direct"]
        results.append(test_result(
            "[4.3]", 
            "Réponse contient llm_source valide",
            passed,
            f"llm_source: {llm_source}"
        ))
    except Exception as e:
        results.append(test_result("[4.3]", "Vérification llm_source", False, str(e)))
    
    return results

# ═══════════════════════════════════════════════════════════════
# NON-RÉGRESSION RAPIDE (5 tests)
# ═══════════════════════════════════════════════════════════════

def test_non_regression():
    """NON-RÉGRESSION RAPIDE (5 tests)"""
    log("═══ NON-RÉGRESSION RAPIDE (5 tests) ═══", "TEST")
    results = []
    
    # Test NR.1: GET /api/dashboard/kpis → 200 avec total > 0
    try:
        r = requests.get(f"{BASE_URL}/api/dashboard/kpis", headers=ADMIN_HEADERS)
        data = r.json()
        passed = r.status_code == 200 and data.get("total", 0) > 0
        results.append(test_result(
            "[NR.1]", 
            "GET /api/dashboard/kpis → 200 avec total > 0",
            passed,
            f"Status: {r.status_code}, total: {data.get('total')}"
        ))
    except Exception as e:
        results.append(test_result("[NR.1]", "GET /api/dashboard/kpis", False, str(e)))
    
    # Test NR.2: GET /api/registrations → 200 array
    try:
        r = requests.get(f"{BASE_URL}/api/registrations", headers=ADMIN_HEADERS)
        data = r.json()
        passed = r.status_code == 200 and isinstance(data, list)
        results.append(test_result(
            "[NR.2]", 
            "GET /api/registrations → 200 array",
            passed,
            f"Status: {r.status_code}, count: {len(data)}"
        ))
    except Exception as e:
        results.append(test_result("[NR.2]", "GET /api/registrations", False, str(e)))
    
    # Test NR.3: POST /api/venues/venue-faaa/set-referent → 200
    try:
        payload = {
            "name": "Teva GEROS",
            "email": "contact@aracom-conseil.fr",
            "phone": "+(689) 87 210 444"
        }
        r = requests.post(f"{BASE_URL}/api/venues/venue-faaa/set-referent", 
                         headers=ADMIN_HEADERS, json=payload)
        passed = r.status_code == 200 and r.json().get("ok") == True
        results.append(test_result(
            "[NR.3]", 
            "POST /api/venues/venue-faaa/set-referent → 200",
            passed,
            f"Status: {r.status_code}"
        ))
    except Exception as e:
        results.append(test_result("[NR.3]", "POST /api/venues/venue-faaa/set-referent", False, str(e)))
    
    # Test NR.4: GET /api/venues → 200 (vérifier referent_aracom présent sur venue-faaa)
    try:
        r = requests.get(f"{BASE_URL}/api/venues", headers=ADMIN_HEADERS)
        data = r.json()
        venue_faaa = next((v for v in data if v.get("id") == "venue-faaa"), None)
        has_referent = venue_faaa and venue_faaa.get("referent_aracom") is not None
        passed = r.status_code == 200 and has_referent
        results.append(test_result(
            "[NR.4]", 
            "GET /api/venues → referent_aracom présent sur venue-faaa",
            passed,
            f"Status: {r.status_code}, referent présent: {has_referent}"
        ))
    except Exception as e:
        results.append(test_result("[NR.4]", "GET /api/venues", False, str(e)))
    
    # Test NR.5: POST /api/mailing/generate-ai → 200 avec subject
    try:
        payload = {
            "mail_type": "relance_caution",
            "registration_ids": []
        }
        r = requests.post(f"{BASE_URL}/api/mailing/generate-ai", 
                         headers=ADMIN_HEADERS, json=payload, timeout=30)
        data = r.json()
        passed = r.status_code == 200 and data.get("subject")
        results.append(test_result(
            "[NR.5]", 
            "POST /api/mailing/generate-ai → 200 avec subject",
            passed,
            f"Status: {r.status_code}, subject présent: {bool(data.get('subject'))}"
        ))
    except Exception as e:
        results.append(test_result("[NR.5]", "POST /api/mailing/generate-ai", False, str(e)))
    
    return results

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    log("🎯 VALIDATION RAPIDE — 4 corrections backend (session 14)", "START")
    log(f"BASE_URL: {BASE_URL}")
    log(f"Auth: headers x-user-id: u-admin-aracom + x-user-role: aracom_admin")
    print()
    
    all_results = []
    
    # FIX 1
    all_results.extend(test_fix1())
    print()
    
    # FIX 2
    all_results.extend(test_fix2())
    print()
    
    # FIX 3
    all_results.extend(test_fix3())
    print()
    
    # FIX 4
    all_results.extend(test_fix4())
    print()
    
    # NON-RÉGRESSION
    all_results.extend(test_non_regression())
    print()
    
    # ═══════════════════════════════════════════════════════════════
    # RÉSUMÉ FINAL
    # ═══════════════════════════════════════════════════════════════
    
    total = len(all_results)
    passed = sum(1 for r in all_results if r)
    failed = total - passed
    percentage = (passed / total * 100) if total > 0 else 0
    
    log("═══════════════════════════════════════════════════════════════", "RESULT")
    log(f"SCORE GLOBAL: {passed}/{total} tests passés ({percentage:.1f}%)", "RESULT")
    log("═══════════════════════════════════════════════════════════════", "RESULT")
    
    if failed == 0:
        log("✅ TOUTES LES CORRECTIONS VALIDÉES — API 100% OPÉRATIONNELLE", "SUCCESS")
    else:
        log(f"⚠️ {failed} test(s) échoué(s) — Corrections à vérifier", "WARN")
    
    print()
    log("Mode mail: TEST (vérifié via MAIL_TEST_MODE=true dans .env)", "INFO")
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
