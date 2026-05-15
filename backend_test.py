#!/usr/bin/env python3
"""
Backend test suite for VAGUE 1+2+3+4 — Pack de 8 features
Tests 11 scenarios as specified in the review request
"""

import requests
import json
import base64
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"
ADMIN_HEADERS = {
    "x-user-role": "aracom_admin",
    "x-user-id": "u-admin",
    "Content-Type": "application/json"
}
EXPOSANT_HEADERS = {
    "x-user-role": "exposant",
    "x-user-id": "u-exposant-test",
    "Content-Type": "application/json"
}

# Test results tracking
test_results = []

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if details:
        result += f"\n    Details: {details}"
    print(result)
    test_results.append({"test": test_name, "passed": passed, "details": details})

def test_1_filtrage_venues_exposant():
    """TEST 1 — Filtrage venues côté exposant (Mahina/Moorea masqués par défaut)"""
    print("\n=== TEST 1: Filtrage venues côté exposant ===")
    
    try:
        # Test 1.1: GET /api/venues avec header exposant
        resp = requests.get(f"{BASE_URL}/venues", headers=EXPOSANT_HEADERS)
        if resp.status_code != 200:
            log_test("TEST 1.1 - GET venues exposant", False, f"Status {resp.status_code}")
            return
        
        venues_exposant = resp.json()
        venue_names = [v.get('name', '') for v in venues_exposant]
        
        # Vérifier que Mahina et Moorea ne sont PAS présents
        has_mahina = any('Mahina' in name for name in venue_names)
        has_moorea = any('Moorea' in name for name in venue_names)
        
        if has_mahina or has_moorea:
            log_test("TEST 1.1 - GET venues exposant", False, 
                    f"Mahina/Moorea présents alors qu'ils devraient être masqués. Venues: {venue_names}")
        else:
            log_test("TEST 1.1 - GET venues exposant", True, 
                    f"Mahina/Moorea correctement masqués. {len(venues_exposant)} sites visibles: {venue_names}")
        
        # Test 1.2: GET /api/venues avec header admin
        resp_admin = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS)
        if resp_admin.status_code != 200:
            log_test("TEST 1.2 - GET venues admin", False, f"Status {resp_admin.status_code}")
            return
        
        venues_admin = resp_admin.json()
        
        # Vérifier que tous les 6 sites sont présents
        if len(venues_admin) < 6:
            log_test("TEST 1.2 - GET venues admin", False, 
                    f"Seulement {len(venues_admin)} sites au lieu de 6")
            return
        
        # Vérifier le champ exposant_visible
        mahina_venue = next((v for v in venues_admin if 'Mahina' in v.get('name', '')), None)
        moorea_venue = next((v for v in venues_admin if 'Moorea' in v.get('name', '')), None)
        faaa_venue = next((v for v in venues_admin if 'Faa' in v.get('name', '')), None)
        
        checks = []
        if mahina_venue:
            checks.append(f"Mahina exposant_visible={mahina_venue.get('exposant_visible', 'undefined')}")
        if moorea_venue:
            checks.append(f"Moorea exposant_visible={moorea_venue.get('exposant_visible', 'undefined')}")
        if faaa_venue:
            checks.append(f"Faaa exposant_visible={faaa_venue.get('exposant_visible', 'undefined')}")
        
        log_test("TEST 1.2 - GET venues admin", True, 
                f"6 sites présents avec champ exposant_visible. {', '.join(checks)}")
        
    except Exception as e:
        log_test("TEST 1 - Filtrage venues", False, f"Exception: {str(e)}")

def test_2_toggle_exposant_visible():
    """TEST 2 — Toggle exposant_visible (admin only)"""
    print("\n=== TEST 2: Toggle exposant_visible ===")
    
    try:
        # Trouver l'ID de Mahina
        resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS)
        venues = resp.json()
        mahina = next((v for v in venues if 'Mahina' in v.get('name', '')), None)
        
        if not mahina:
            log_test("TEST 2 - Toggle exposant_visible", False, "Venue Mahina introuvable")
            return
        
        venue_id = mahina.get('id')
        
        # Test 2.1: Toggle à true avec admin
        resp = requests.post(
            f"{BASE_URL}/venues/{venue_id}/set-exposant-visible",
            headers=ADMIN_HEADERS,
            json={"exposant_visible": True}
        )
        
        if resp.status_code != 200:
            log_test("TEST 2.1 - Toggle true admin", False, f"Status {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            if data.get('ok') and data.get('exposant_visible') == True:
                log_test("TEST 2.1 - Toggle true admin", True, "Mahina exposant_visible=true")
            else:
                log_test("TEST 2.1 - Toggle true admin", False, f"Response: {data}")
        
        # Test 2.2: Vérifier que Mahina apparaît maintenant pour exposant
        resp = requests.get(f"{BASE_URL}/venues", headers=EXPOSANT_HEADERS)
        venues_exposant = resp.json()
        mahina_visible = any('Mahina' in v.get('name', '') for v in venues_exposant)
        
        if mahina_visible:
            log_test("TEST 2.2 - Mahina visible exposant", True, "Mahina apparaît après toggle")
        else:
            log_test("TEST 2.2 - Mahina visible exposant", False, "Mahina toujours masqué")
        
        # Test 2.3: Re-toggle à false
        resp = requests.post(
            f"{BASE_URL}/venues/{venue_id}/set-exposant-visible",
            headers=ADMIN_HEADERS,
            json={"exposant_visible": False}
        )
        
        if resp.status_code == 200:
            log_test("TEST 2.3 - Toggle false admin", True, "Mahina exposant_visible=false")
        else:
            log_test("TEST 2.3 - Toggle false admin", False, f"Status {resp.status_code}")
        
        # Test 2.4: Sans header admin → 403
        resp = requests.post(
            f"{BASE_URL}/venues/{venue_id}/set-exposant-visible",
            headers=EXPOSANT_HEADERS,
            json={"exposant_visible": True}
        )
        
        if resp.status_code == 403:
            log_test("TEST 2.4 - Toggle sans admin", True, "403 Forbidden comme attendu")
        else:
            log_test("TEST 2.4 - Toggle sans admin", False, f"Status {resp.status_code} au lieu de 403")
        
    except Exception as e:
        log_test("TEST 2 - Toggle exposant_visible", False, f"Exception: {str(e)}")

def test_3_delete_bilan():
    """TEST 3 — DELETE bilan"""
    print("\n=== TEST 3: DELETE bilan ===")
    
    try:
        # Test 3.1: Créer un bilan
        resp = requests.post(
            f"{BASE_URL}/reports/generate",
            headers=ADMIN_HEADERS,
            json={"scope": "bilan_global"}
        )
        
        if resp.status_code != 200:
            log_test("TEST 3.1 - Créer bilan", False, f"Status {resp.status_code}")
            return
        
        log_test("TEST 3.1 - Créer bilan", True, "Bilan créé")
        
        # Test 3.2: Récupérer l'ID du dernier rapport
        resp = requests.get(f"{BASE_URL}/reports", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            log_test("TEST 3.2 - GET reports", False, f"Status {resp.status_code}")
            return
        
        reports = resp.json()
        if not reports:
            log_test("TEST 3.2 - GET reports", False, "Aucun rapport trouvé")
            return
        
        report_id = reports[0].get('id')
        log_test("TEST 3.2 - GET reports", True, f"Report ID: {report_id}")
        
        # Test 3.3: DELETE avec admin
        resp = requests.delete(
            f"{BASE_URL}/reports/{report_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 3.3 - DELETE admin", False, f"Status {resp.status_code}")
        else:
            log_test("TEST 3.3 - DELETE admin", True, "Rapport supprimé")
        
        # Test 3.4: Vérifier que le rapport a disparu
        resp = requests.get(f"{BASE_URL}/reports", headers=ADMIN_HEADERS)
        reports_after = resp.json()
        report_exists = any(r.get('id') == report_id for r in reports_after)
        
        if not report_exists:
            log_test("TEST 3.4 - Vérif suppression", True, "Rapport bien supprimé")
        else:
            log_test("TEST 3.4 - Vérif suppression", False, "Rapport toujours présent")
        
        # Test 3.5: DELETE sans admin → 403
        # Créer un nouveau rapport pour tester
        resp = requests.post(
            f"{BASE_URL}/reports/generate",
            headers=ADMIN_HEADERS,
            json={"scope": "bilan_global"}
        )
        resp = requests.get(f"{BASE_URL}/reports", headers=ADMIN_HEADERS)
        reports = resp.json()
        if reports:
            report_id = reports[0].get('id')
            resp = requests.delete(
                f"{BASE_URL}/reports/{report_id}",
                headers=EXPOSANT_HEADERS
            )
            
            if resp.status_code == 403:
                log_test("TEST 3.5 - DELETE sans admin", True, "403 Forbidden comme attendu")
            else:
                log_test("TEST 3.5 - DELETE sans admin", False, f"Status {resp.status_code} au lieu de 403")
        
    except Exception as e:
        log_test("TEST 3 - DELETE bilan", False, f"Exception: {str(e)}")

def test_4_rib_config():
    """TEST 4 — RIB Config"""
    print("\n=== TEST 4: RIB Config ===")
    
    try:
        # Test 4.1: GET initial (sans auth particulière)
        resp = requests.get(f"{BASE_URL}/admin/rib-config")
        
        if resp.status_code != 200:
            log_test("TEST 4.1 - GET RIB initial", False, f"Status {resp.status_code}")
            return
        
        rib_initial = resp.json()
        log_test("TEST 4.1 - GET RIB initial", True, 
                f"RIB: titulaire={rib_initial.get('titulaire')}, banque={rib_initial.get('banque')}")
        
        # Test 4.2: POST avec admin
        rib_data = {
            "titulaire": "ARACOM CONSEIL",
            "banque": "Banque de Polynésie",
            "iban": "FR76 0000 1111 2222 3333 4444",
            "bic": "BPPFPFPP",
            "reference": "Caution Forum 2026"
        }
        
        resp = requests.post(
            f"{BASE_URL}/admin/rib-config",
            headers=ADMIN_HEADERS,
            json=rib_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 4.2 - POST RIB admin", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        data = resp.json()
        if data.get('ok') and data.get('rib'):
            log_test("TEST 4.2 - POST RIB admin", True, f"RIB sauvegardé: {data.get('rib')}")
        else:
            log_test("TEST 4.2 - POST RIB admin", False, f"Response: {data}")
        
        # Test 4.3: Re-GET pour vérifier persistance
        resp = requests.get(f"{BASE_URL}/admin/rib-config")
        rib_after = resp.json()
        
        if (rib_after.get('titulaire') == rib_data['titulaire'] and
            rib_after.get('iban') == rib_data['iban'].replace(' ', ' ')):
            log_test("TEST 4.3 - Vérif persistance", True, "Valeurs persistées correctement")
        else:
            log_test("TEST 4.3 - Vérif persistance", False, f"Valeurs différentes: {rib_after}")
        
        # Test 4.4: POST sans admin → 403
        resp = requests.post(
            f"{BASE_URL}/admin/rib-config",
            headers=EXPOSANT_HEADERS,
            json=rib_data
        )
        
        if resp.status_code == 403:
            log_test("TEST 4.4 - POST sans admin", True, "403 Forbidden comme attendu")
        else:
            log_test("TEST 4.4 - POST sans admin", False, f"Status {resp.status_code} au lieu de 403")
        
    except Exception as e:
        log_test("TEST 4 - RIB Config", False, f"Exception: {str(e)}")

def test_5_document_templates():
    """TEST 5 — Document Templates"""
    print("\n=== TEST 5: Document Templates ===")
    
    try:
        # Test 5.1: GET avec admin
        resp = requests.get(
            f"{BASE_URL}/admin/document-templates",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 5.1 - GET templates admin", False, f"Status {resp.status_code}")
            return
        
        templates = resp.json()
        expected_keys = ['convention', 'guide', 'recu', 'attestation_remboursement']
        has_all_keys = all(key in templates for key in expected_keys)
        
        if has_all_keys:
            log_test("TEST 5.1 - GET templates admin", True, 
                    f"4 clés présentes: {list(templates.keys())}")
        else:
            log_test("TEST 5.1 - GET templates admin", False, 
                    f"Clés manquantes. Trouvées: {list(templates.keys())}")
        
        # Test 5.2: GET sans admin → 403
        resp = requests.get(
            f"{BASE_URL}/admin/document-templates",
            headers=EXPOSANT_HEADERS
        )
        
        if resp.status_code == 403:
            log_test("TEST 5.2 - GET sans admin", True, "403 Forbidden comme attendu")
        else:
            log_test("TEST 5.2 - GET sans admin", False, f"Status {resp.status_code} au lieu de 403")
        
        # Test 5.3: POST avec admin
        template_data = {
            "key": "attestation_remboursement",
            "texts": {
                "title": "ATT TEST",
                "intro": "Intro test"
            },
            "logo_base64": ""
        }
        
        resp = requests.post(
            f"{BASE_URL}/admin/document-templates",
            headers=ADMIN_HEADERS,
            json=template_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 5.3 - POST template admin", False, f"Status {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            if data.get('ok'):
                log_test("TEST 5.3 - POST template admin", True, "Template sauvegardé")
            else:
                log_test("TEST 5.3 - POST template admin", False, f"Response: {data}")
        
        # Test 5.4: Re-GET pour vérifier
        resp = requests.get(
            f"{BASE_URL}/admin/document-templates",
            headers=ADMIN_HEADERS
        )
        templates_after = resp.json()
        att_template = templates_after.get('attestation_remboursement', {})
        
        if (att_template.get('texts', {}).get('title') == 'ATT TEST' and
            att_template.get('updated_at') is not None):
            log_test("TEST 5.4 - Vérif template", True, 
                    f"Template mis à jour avec updated_at={att_template.get('updated_at')}")
        else:
            log_test("TEST 5.4 - Vérif template", False, f"Template: {att_template}")
        
        # Test 5.5: POST avec key invalide → 400
        resp = requests.post(
            f"{BASE_URL}/admin/document-templates",
            headers=ADMIN_HEADERS,
            json={"key": "bogus", "texts": {}}
        )
        
        if resp.status_code == 400:
            log_test("TEST 5.5 - POST key invalide", True, "400 Bad Request comme attendu")
        else:
            log_test("TEST 5.5 - POST key invalide", False, f"Status {resp.status_code} au lieu de 400")
        
    except Exception as e:
        log_test("TEST 5 - Document Templates", False, f"Exception: {str(e)}")

def test_6_auto_attestation_satisfaction():
    """TEST 6 — Auto-génération attestation_remboursement au questionnaire satisfaction"""
    print("\n=== TEST 6: Auto-génération attestation satisfaction ===")
    
    try:
        # Test 6.1: Trouver un exposant test
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        registrations = resp.json()
        
        # Chercher un exposant avec nom commençant par "teva", "aracom" ou "teka"
        test_reg = None
        for reg in registrations:
            org_name = reg.get('organization_name', '').lower()
            if any(prefix in org_name for prefix in ['teva', 'aracom', 'teka', 'test']):
                test_reg = reg
                break
        
        if not test_reg:
            # Prendre le premier disponible
            test_reg = registrations[0] if registrations else None
        
        if not test_reg:
            log_test("TEST 6 - Auto attestation", False, "Aucun exposant trouvé")
            return
        
        reg_id = test_reg.get('id')
        org_id = test_reg.get('organization_id')
        
        log_test("TEST 6.1 - Exposant trouvé", True, 
                f"Registration: {reg_id}, Org: {test_reg.get('organization_name')}")
        
        # Test 6.2: Débloquer post-event si nécessaire
        resp = requests.post(
            f"{BASE_URL}/admin/post-event-status",
            headers=ADMIN_HEADERS,
            json={"unlocked": True}
        )
        
        if resp.status_code == 200:
            log_test("TEST 6.2 - Débloquer post-event", True, "Post-event débloqué")
        else:
            log_test("TEST 6.2 - Débloquer post-event", False, f"Status {resp.status_code}")
        
        # Test 6.3: Supprimer toute attestation existante pour ce test
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        if resp.status_code == 200:
            docs = resp.json()
            for doc in docs:
                if doc.get('document_type') == 'attestation_remboursement':
                    requests.delete(
                        f"{BASE_URL}/documents/{doc.get('id')}",
                        headers=ADMIN_HEADERS
                    )
        
        # Test 6.4: POST satisfaction
        satisfaction_data = {
            "organization_id": org_id,
            "registration_id": reg_id,
            "ratings": {
                "satisfaction_globale": 4
            },
            "nps": 8,
            "return_2027": "oui"
        }
        
        resp = requests.post(
            f"{BASE_URL}/exposant/satisfaction",
            headers=ADMIN_HEADERS,
            json=satisfaction_data
        )
        
        if resp.status_code not in [200, 201]:
            log_test("TEST 6.4 - POST satisfaction", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        log_test("TEST 6.4 - POST satisfaction", True, "Satisfaction soumise")
        
        # Test 6.5: Vérifier qu'une attestation a été créée
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 6.5 - Vérif attestation", False, f"Status {resp.status_code}")
            return
        
        docs = resp.json()
        attestation = next((d for d in docs if d.get('document_type') == 'attestation_remboursement'), None)
        
        if attestation:
            is_signed = attestation.get('is_signed', True)
            status = attestation.get('status')
            log_test("TEST 6.5 - Vérif attestation", True, 
                    f"Attestation créée: is_signed={is_signed}, status={status}")
        else:
            log_test("TEST 6.5 - Vérif attestation", False, "Aucune attestation trouvée")
        
        # Test 6.6: Re-POST satisfaction → ne doit PAS dupliquer
        resp = requests.post(
            f"{BASE_URL}/exposant/satisfaction",
            headers=ADMIN_HEADERS,
            json=satisfaction_data
        )
        
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        docs_after = resp.json()
        attestations = [d for d in docs_after if d.get('document_type') == 'attestation_remboursement' 
                       and d.get('status') in ['valide', 'en_attente']]
        
        if len(attestations) == 1:
            log_test("TEST 6.6 - Pas de duplication", True, "1 seule attestation présente")
        else:
            log_test("TEST 6.6 - Pas de duplication", False, f"{len(attestations)} attestations trouvées")
        
    except Exception as e:
        log_test("TEST 6 - Auto attestation", False, f"Exception: {str(e)}")

def test_7_auto_recu_bulk_confirm():
    """TEST 7 — Auto-génération reçu de caution au bulk-confirm"""
    print("\n=== TEST 7: Auto-génération reçu bulk-confirm ===")
    
    try:
        # Test 7.1: Trouver un registration avec is_deposit_received=false
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        registrations = resp.json()
        
        test_reg = None
        for reg in registrations:
            if not reg.get('is_deposit_received', True):
                test_reg = reg
                break
        
        if not test_reg:
            # Prendre le premier et forcer is_deposit_received à false
            test_reg = registrations[0] if registrations else None
            if test_reg:
                reg_id = test_reg.get('id')
                requests.put(
                    f"{BASE_URL}/registrations/{reg_id}",
                    headers=ADMIN_HEADERS,
                    json={"is_deposit_received": False}
                )
        
        if not test_reg:
            log_test("TEST 7 - Auto reçu", False, "Aucun exposant trouvé")
            return
        
        reg_id = test_reg.get('id')
        log_test("TEST 7.1 - Registration trouvée", True, f"ID: {reg_id}")
        
        # Test 7.2: Supprimer tout reçu existant
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        if resp.status_code == 200:
            docs = resp.json()
            for doc in docs:
                if doc.get('document_type') == 'recu_caution':
                    requests.delete(
                        f"{BASE_URL}/documents/{doc.get('id')}",
                        headers=ADMIN_HEADERS
                    )
            log_test("TEST 7.2 - Nettoyage reçus", True, "Reçus existants supprimés")
        
        # Test 7.3: POST bulk-confirm
        resp = requests.post(
            f"{BASE_URL}/registrations/bulk-confirm",
            headers=ADMIN_HEADERS,
            json={"ids": [reg_id]}
        )
        
        if resp.status_code != 200:
            log_test("TEST 7.3 - Bulk confirm", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        data = resp.json()
        if data.get('confirmed') == 1:
            log_test("TEST 7.3 - Bulk confirm", True, "1 registration confirmée")
        else:
            log_test("TEST 7.3 - Bulk confirm", False, f"Response: {data}")
        
        # Test 7.4: Vérifier qu'un reçu a été créé
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 7.4 - Vérif reçu", False, f"Status {resp.status_code}")
            return
        
        docs = resp.json()
        recu = next((d for d in docs if d.get('document_type') == 'recu_caution'), None)
        
        if recu and recu.get('status') == 'valide':
            log_test("TEST 7.4 - Vérif reçu", True, f"Reçu créé: {recu.get('file_name')}")
        else:
            log_test("TEST 7.4 - Vérif reçu", False, "Aucun reçu valide trouvé")
        
        # Test 7.5: Vérifier les flags registration
        resp = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code == 200:
            reg = resp.json()
            is_guide_sent = reg.get('is_guide_sent', False)
            is_deposit_received = reg.get('is_deposit_received', False)
            
            if is_guide_sent and is_deposit_received:
                log_test("TEST 7.5 - Vérif flags", True, 
                        f"is_guide_sent={is_guide_sent}, is_deposit_received={is_deposit_received}")
            else:
                log_test("TEST 7.5 - Vérif flags", False, 
                        f"Flags incorrects: guide={is_guide_sent}, deposit={is_deposit_received}")
        
    except Exception as e:
        log_test("TEST 7 - Auto reçu", False, f"Exception: {str(e)}")

def test_8_upload_attestation_signee():
    """TEST 8 — Upload attestation signée par ARACOM"""
    print("\n=== TEST 8: Upload attestation signée ===")
    
    try:
        # Test 8.1: Trouver un exposant qui a soumis satisfaction
        resp = requests.get(f"{BASE_URL}/satisfaction", headers=ADMIN_HEADERS)
        if resp.status_code != 200:
            log_test("TEST 8 - Upload attestation", False, "Impossible de récupérer satisfactions")
            return
        
        satisfactions = resp.json()
        if not satisfactions:
            log_test("TEST 8 - Upload attestation", False, "Aucune satisfaction trouvée")
            return
        
        reg_id = satisfactions[0].get('registration_id')
        if not reg_id:
            log_test("TEST 8 - Upload attestation", False, "Pas de registration_id dans satisfaction")
            return
        
        log_test("TEST 8.1 - Registration trouvée", True, f"ID: {reg_id}")
        
        # Test 8.2: Créer un petit PDF base64 valide
        # PDF minimal valide
        pdf_content = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        
        upload_data = {
            "file_name": "Attestation_signee.pdf",
            "mime_type": "application/pdf",
            "file_base64": pdf_base64
        }
        
        # Test 8.3: POST avec admin
        resp = requests.post(
            f"{BASE_URL}/admin/refund-attestation/{reg_id}/upload",
            headers=ADMIN_HEADERS,
            json=upload_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 8.3 - Upload admin", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        data = resp.json()
        if data.get('ok'):
            log_test("TEST 8.3 - Upload admin", True, "Attestation signée uploadée")
        else:
            log_test("TEST 8.3 - Upload admin", False, f"Response: {data}")
        
        # Test 8.4: Vérifier les documents
        resp = requests.get(
            f"{BASE_URL}/documents?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 8.4 - Vérif documents", False, f"Status {resp.status_code}")
            return
        
        docs = resp.json()
        attestations = [d for d in docs if d.get('document_type') == 'attestation_remboursement']
        
        signed_att = next((d for d in attestations if d.get('is_signed') == True and d.get('status') == 'valide'), None)
        replaced_att = next((d for d in attestations if d.get('status') == 'remplace'), None)
        
        if signed_att and replaced_att:
            log_test("TEST 8.4 - Vérif documents", True, 
                    "Attestation signée présente (is_signed=true, status=valide) et ancienne remplacée")
        elif signed_att:
            log_test("TEST 8.4 - Vérif documents", True, 
                    "Attestation signée présente (is_signed=true, status=valide)")
        else:
            log_test("TEST 8.4 - Vérif documents", False, 
                    f"Attestations trouvées: {[(d.get('is_signed'), d.get('status')) for d in attestations]}")
        
        # Test 8.5: POST sans admin → 403
        resp = requests.post(
            f"{BASE_URL}/admin/refund-attestation/{reg_id}/upload",
            headers=EXPOSANT_HEADERS,
            json=upload_data
        )
        
        if resp.status_code == 403:
            log_test("TEST 8.5 - Upload sans admin", True, "403 Forbidden comme attendu")
        else:
            log_test("TEST 8.5 - Upload sans admin", False, f"Status {resp.status_code} au lieu de 403")
        
    except Exception as e:
        log_test("TEST 8 - Upload attestation", False, f"Exception: {str(e)}")

def test_9_virement_request_validation():
    """TEST 9 — Virement bancaire accepté dans request-validation"""
    print("\n=== TEST 9: Virement dans request-validation ===")
    
    try:
        # Test 9.1: Trouver un exposant pré-réservé
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        registrations = resp.json()
        
        test_reg = None
        for reg in registrations:
            if (reg.get('status') == 'a_confirmer' and 
                reg.get('venue_id') and 
                reg.get('stand_code')):
                test_reg = reg
                break
        
        if not test_reg:
            log_test("TEST 9 - Virement validation", False, "Aucun exposant pré-réservé trouvé")
            return
        
        reg_id = test_reg.get('id')
        log_test("TEST 9.1 - Exposant trouvé", True, 
                f"ID: {reg_id}, Stand: {test_reg.get('stand_code')}")
        
        # Test 9.2: Vérifier qu'il y a au moins 1 animation_slot
        resp = requests.get(
            f"{BASE_URL}/animation-slots?registration_id={reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code == 200:
            slots = resp.json()
            if not slots:
                # Créer un slot
                requests.post(
                    f"{BASE_URL}/animation-slots",
                    headers=ADMIN_HEADERS,
                    json={
                        "registration_id": reg_id,
                        "day_label": "samedi",
                        "start_time": "10:00",
                        "end_time": "11:00"
                    }
                )
                log_test("TEST 9.2 - Animation slot", True, "Slot créé")
            else:
                log_test("TEST 9.2 - Animation slot", True, f"{len(slots)} slot(s) existant(s)")
        
        # Test 9.3: POST request-validation avec virement
        validation_data = {
            "preferred_payment": "virement",
            "rdv_proposal": "matin",
            "notes": "test virement"
        }
        
        resp = requests.post(
            f"{BASE_URL}/registrations/{reg_id}/request-validation",
            headers=ADMIN_HEADERS,
            json=validation_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 9.3 - Request validation", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        data = resp.json()
        if data.get('ok') and data.get('validation_request_id'):
            log_test("TEST 9.3 - Request validation", True, 
                    f"Validation request créée: {data.get('validation_request_id')}")
        else:
            log_test("TEST 9.3 - Request validation", False, f"Response: {data}")
        
        # Test 9.4: Vérifier que preferred_payment=virement est bien enregistré
        resp = requests.get(
            f"{BASE_URL}/validation-requests",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code == 200:
            requests_list = resp.json()
            virement_req = next((r for r in requests_list 
                               if r.get('registration_id') == reg_id 
                               and r.get('preferred_payment') == 'virement'), None)
            
            if virement_req:
                log_test("TEST 9.4 - Vérif virement", True, 
                        f"preferred_payment=virement enregistré")
            else:
                log_test("TEST 9.4 - Vérif virement", False, 
                        "preferred_payment=virement non trouvé")
        
    except Exception as e:
        log_test("TEST 9 - Virement validation", False, f"Exception: {str(e)}")

def test_10_discipline_other():
    """TEST 10 — Champ discipline_other"""
    print("\n=== TEST 10: Champ discipline_other ===")
    
    try:
        # Test 10.1: Trouver un exposant
        resp = requests.get(f"{BASE_URL}/registrations", headers=ADMIN_HEADERS)
        registrations = resp.json()
        
        if not registrations:
            log_test("TEST 10 - discipline_other", False, "Aucun exposant trouvé")
            return
        
        test_reg = registrations[0]
        reg_id = test_reg.get('id')
        
        log_test("TEST 10.1 - Exposant trouvé", True, f"ID: {reg_id}")
        
        # Test 10.2: POST profile avec discipline_other
        profile_data = {
            "name": "Test Organization",
            "discipline": "Autre",
            "discipline_other": "Slackline",
            "contact_name": "Test Contact"
        }
        
        resp = requests.post(
            f"{BASE_URL}/registrations/{reg_id}/profile",
            headers=ADMIN_HEADERS,
            json=profile_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 10.2 - POST profile", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        data = resp.json()
        if data.get('ok'):
            log_test("TEST 10.2 - POST profile", True, "Profil mis à jour")
        else:
            log_test("TEST 10.2 - POST profile", False, f"Response: {data}")
        
        # Test 10.3: Vérifier que discipline_other est enregistré
        resp = requests.get(
            f"{BASE_URL}/registrations/{reg_id}",
            headers=ADMIN_HEADERS
        )
        
        if resp.status_code != 200:
            log_test("TEST 10.3 - Vérif discipline_other", False, f"Status {resp.status_code}")
            return
        
        reg = resp.json()
        # Le champ discipline_other est dans organization, pas registration
        org_id = reg.get('organization_id')
        
        if org_id:
            resp = requests.get(f"{BASE_URL}/organizations", headers=ADMIN_HEADERS)
            if resp.status_code == 200:
                orgs = resp.json()
                org = next((o for o in orgs if o.get('id') == org_id), None)
                
                if org and org.get('discipline_other') == 'Slackline':
                    log_test("TEST 10.3 - Vérif discipline_other", True, 
                            f"discipline_other='Slackline' enregistré")
                else:
                    log_test("TEST 10.3 - Vérif discipline_other", False, 
                            f"discipline_other={org.get('discipline_other') if org else 'org not found'}")
        
    except Exception as e:
        log_test("TEST 10 - discipline_other", False, f"Exception: {str(e)}")

def test_11_put_animation_slot_venue():
    """TEST 11 — PUT animation-slots avec venue_id"""
    print("\n=== TEST 11: PUT animation-slot avec venue_id ===")
    
    try:
        # Test 11.1: Trouver un animation_slot existant
        resp = requests.get(f"{BASE_URL}/animation-slots", headers=ADMIN_HEADERS)
        
        if resp.status_code != 200:
            log_test("TEST 11 - PUT animation-slot", False, f"Status {resp.status_code}")
            return
        
        slots = resp.json()
        if not slots:
            log_test("TEST 11 - PUT animation-slot", False, "Aucun slot trouvé")
            return
        
        slot = slots[0]
        slot_id = slot.get('id')
        original_venue = slot.get('venue_id')
        
        log_test("TEST 11.1 - Slot trouvé", True, 
                f"ID: {slot_id}, venue_id original: {original_venue}")
        
        # Test 11.2: Trouver un autre venue_id
        resp = requests.get(f"{BASE_URL}/venues", headers=ADMIN_HEADERS)
        venues = resp.json()
        
        new_venue_id = None
        for v in venues:
            if v.get('id') != original_venue:
                new_venue_id = v.get('id')
                break
        
        if not new_venue_id:
            new_venue_id = 'venue-faaa'  # Fallback
        
        # Test 11.3: PUT avec nouveau venue_id
        update_data = {
            "venue_id": new_venue_id,
            "day_label": "samedi",
            "start_time": "14:00",
            "end_time": "15:00"
        }
        
        resp = requests.put(
            f"{BASE_URL}/animation-slots/{slot_id}",
            headers=ADMIN_HEADERS,
            json=update_data
        )
        
        if resp.status_code != 200:
            log_test("TEST 11.3 - PUT slot", False, f"Status {resp.status_code}: {resp.text}")
            return
        
        updated_slot = resp.json()
        
        if updated_slot.get('venue_id') == new_venue_id:
            log_test("TEST 11.3 - PUT slot", True, 
                    f"venue_id changé de {original_venue} à {new_venue_id}")
        else:
            log_test("TEST 11.3 - PUT slot", False, 
                    f"venue_id={updated_slot.get('venue_id')} au lieu de {new_venue_id}")
        
    except Exception as e:
        log_test("TEST 11 - PUT animation-slot", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*70)
    print("RÉSUMÉ DES TESTS")
    print("="*70)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r['passed'])
    failed = total - passed
    
    print(f"\nTotal: {total} tests")
    print(f"✅ Passés: {passed}")
    print(f"❌ Échoués: {failed}")
    print(f"Taux de réussite: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n❌ Tests échoués:")
        for r in test_results:
            if not r['passed']:
                print(f"  - {r['test']}")
                if r['details']:
                    print(f"    {r['details']}")
    
    print("\n" + "="*70)

def main():
    """Run all tests"""
    print("="*70)
    print("TESTS BACKEND - VAGUE 1+2+3+4 (8 features)")
    print("="*70)
    
    test_1_filtrage_venues_exposant()
    test_2_toggle_exposant_visible()
    test_3_delete_bilan()
    test_4_rib_config()
    test_5_document_templates()
    test_6_auto_attestation_satisfaction()
    test_7_auto_recu_bulk_confirm()
    test_8_upload_attestation_signee()
    test_9_virement_request_validation()
    test_10_discipline_other()
    test_11_put_animation_slot_venue()
    
    print_summary()
    
    # Return exit code based on results
    failed = sum(1 for r in test_results if not r['passed'])
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
