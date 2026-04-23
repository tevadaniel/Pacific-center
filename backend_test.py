#!/usr/bin/env python3
"""
Test des nouveaux endpoints satisfaction pour Forum Rentrée 2026
Focus uniquement sur les 3 nouveaux endpoints satisfaction
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com/api"

def test_satisfaction_endpoints():
    """Test complet des endpoints satisfaction selon les scénarios requis"""
    
    print("=== TESTS ENDPOINTS SATISFACTION ===\n")
    
    try:
        # 1. Seed force pour avoir des registrations valides
        print("1. Seed force...")
        response = requests.post(f"{BASE_URL}/seed", json={"force": True})
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Seed réussi: {data.get('associations', 0)} associations, {data.get('stands_planned', 0)} stands")
        else:
            print(f"❌ Erreur seed: {response.status_code} - {response.text}")
            return False
        
        # 2. POST un survey complet pour reg-arue-A-C01 → vérifier 201 et données retournées
        print("\n2. POST survey complet pour reg-arue-A-C01...")
        survey_data = {
            "registration_id": "reg-arue-A-C01",
            "nps_score": 8,
            "overall_rating": 4,
            "organization_rating": 5,
            "stand_rating": 3,
            "visitors_rating": 4,
            "communication_rating": 4,
            "will_participate_next": "oui",
            "positive_points": "Excellente organisation, bon accueil",
            "improvement_points": "Plus de signalétique",
            "free_comment": "Très satisfait de cette édition"
        }
        
        response = requests.post(f"{BASE_URL}/satisfaction", json=survey_data)
        if response.status_code in [200, 201]:
            data = response.json()
            status_msg = "créé" if response.status_code == 201 else "mis à jour"
            print(f"✅ Survey {status_msg} ({response.status_code}): ID={data.get('id')}, registration_id={data.get('registration_id')}")
            survey1_id = data.get('id')
        else:
            print(f"❌ Erreur création survey: {response.status_code} - {response.text}")
            return False
        
        # 3. GET /api/satisfaction → vérifier la liste contient le survey
        print("\n3. GET /api/satisfaction (liste complète)...")
        response = requests.get(f"{BASE_URL}/satisfaction")
        if response.status_code == 200:
            data = response.json()
            if len(data) >= 1 and any(s.get('registration_id') == 'reg-arue-A-C01' for s in data):
                print(f"✅ Liste satisfaction OK: {len(data)} survey(s), contient reg-arue-A-C01")
                # Vérifier enrichissement
                survey = next(s for s in data if s.get('registration_id') == 'reg-arue-A-C01')
                if survey.get('organization_name') and survey.get('venue_name') and survey.get('stand_code'):
                    print(f"✅ Enrichissement OK: {survey.get('organization_name')}, {survey.get('venue_name')}, {survey.get('stand_code')}")
                else:
                    print(f"❌ Enrichissement manquant: org={survey.get('organization_name')}, venue={survey.get('venue_name')}, stand={survey.get('stand_code')}")
            else:
                print(f"❌ Survey reg-arue-A-C01 non trouvé dans la liste")
                return False
        else:
            print(f"❌ Erreur GET satisfaction: {response.status_code} - {response.text}")
            return False
        
        # 4. GET /api/satisfaction?registration_id=reg-arue-A-C01 → vérifier filtre OK, 1 résultat
        print("\n4. GET /api/satisfaction avec filtre registration_id...")
        response = requests.get(f"{BASE_URL}/satisfaction?registration_id=reg-arue-A-C01")
        if response.status_code == 200:
            data = response.json()
            if len(data) == 1 and data[0].get('registration_id') == 'reg-arue-A-C01':
                print(f"✅ Filtre registration_id OK: 1 résultat pour reg-arue-A-C01")
            else:
                print(f"❌ Filtre registration_id incorrect: {len(data)} résultats")
                return False
        else:
            print(f"❌ Erreur GET satisfaction filtré: {response.status_code} - {response.text}")
            return False
        
        # 5. POST encore pour reg-arue-A-C01 avec nouveaux scores → vérifier c'est un UPDATE (pas de doublon)
        print("\n5. POST update pour reg-arue-A-C01 (test upsert)...")
        updated_survey = {
            "registration_id": "reg-arue-A-C01",
            "nps_score": 9,
            "overall_rating": 5,
            "organization_rating": 5,
            "stand_rating": 4,
            "visitors_rating": 5,
            "communication_rating": 5,
            "will_participate_next": "oui",
            "positive_points": "Organisation parfaite cette fois",
            "improvement_points": "Rien à redire",
            "free_comment": "Parfait !"
        }
        
        response = requests.post(f"{BASE_URL}/satisfaction", json=updated_survey)
        if response.status_code == 200:  # Update = 200, pas 201
            data = response.json()
            print(f"✅ Survey mis à jour (200): NPS passé de 8 à {data.get('nps_score')}")
            
            # Vérifier qu'il n'y a toujours qu'un seul survey pour cette registration
            response = requests.get(f"{BASE_URL}/satisfaction?registration_id=reg-arue-A-C01")
            if response.status_code == 200:
                data = response.json()
                if len(data) == 1:
                    print(f"✅ Pas de doublon: toujours 1 seul survey pour reg-arue-A-C01")
                else:
                    print(f"❌ Doublon détecté: {len(data)} surveys pour reg-arue-A-C01")
                    return False
        else:
            print(f"❌ Erreur update survey: {response.status_code} - {response.text}")
            return False
        
        # 6. POST un survey pour reg-arue-A-C02 avec scores différents
        print("\n6. POST survey pour reg-arue-A-C02...")
        survey2_data = {
            "registration_id": "reg-arue-A-C02",
            "nps_score": 6,
            "overall_rating": 3,
            "organization_rating": 3,
            "stand_rating": 2,
            "visitors_rating": 3,
            "communication_rating": 3,
            "will_participate_next": "peut_etre",
            "positive_points": "Bonne ambiance",
            "improvement_points": "Améliorer la logistique",
            "free_comment": "Mitigé sur cette édition"
        }
        
        response = requests.post(f"{BASE_URL}/satisfaction", json=survey2_data)
        if response.status_code in [200, 201]:
            data = response.json()
            status_msg = "créé" if response.status_code == 201 else "mis à jour"
            print(f"✅ Survey 2 {status_msg} ({response.status_code}): registration_id={data.get('registration_id')}")
        else:
            print(f"❌ Erreur création survey 2: {response.status_code} - {response.text}")
            return False
        
        # 7. GET /api/satisfaction/stats → vérifier total_responses=2, avg_overall correct, NPS correct, will_participate correct, by_site correct
        print("\n7. GET /api/satisfaction/stats...")
        response = requests.get(f"{BASE_URL}/satisfaction/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Stats récupérées:")
            print(f"   - total_responses: {stats.get('total_responses')} (attendu: 2)")
            print(f"   - total_eligible: {stats.get('total_eligible')}")
            print(f"   - response_rate: {stats.get('response_rate')}%")
            print(f"   - avg_overall: {stats.get('avg_overall')} (attendu: 4.0 = (5+3)/2)")
            print(f"   - NPS: {stats.get('nps')} (attendu: 50 = ((1-1)/2)*100, promoter=9, detractor=6)")
            
            # Vérifications
            if stats.get('total_responses') == 2:
                print(f"✅ total_responses correct: 2")
            else:
                print(f"❌ total_responses incorrect: {stats.get('total_responses')} au lieu de 2")
            
            expected_avg_overall = 4.0  # (5+3)/2
            if abs(stats.get('avg_overall', 0) - expected_avg_overall) < 0.01:
                print(f"✅ avg_overall correct: {stats.get('avg_overall')}")
            else:
                print(f"❌ avg_overall incorrect: {stats.get('avg_overall')} au lieu de {expected_avg_overall}")
            
            # NPS: promoters (≥9) = 1 (score 9), detractors (≤6) = 1 (score 6), total = 2
            # NPS = ((1-1)/2)*100 = 0
            expected_nps = 0
            if stats.get('nps') == expected_nps:
                print(f"✅ NPS correct: {stats.get('nps')}")
            else:
                print(f"❌ NPS incorrect: {stats.get('nps')} au lieu de {expected_nps}")
            
            # will_participate
            will_participate = stats.get('will_participate', {})
            if will_participate.get('oui') == 1 and will_participate.get('peut_etre') == 1:
                print(f"✅ will_participate correct: oui=1, peut_etre=1")
            else:
                print(f"❌ will_participate incorrect: {will_participate}")
            
            # by_site
            by_site = stats.get('by_site', [])
            if len(by_site) >= 1:
                print(f"✅ by_site présent: {len(by_site)} site(s)")
                for site in by_site:
                    print(f"   - {site.get('venue_name')}: {site.get('count')} réponses, avg_overall={site.get('avg_overall')}, avg_nps={site.get('avg_nps')}")
            else:
                print(f"❌ by_site vide")
        else:
            print(f"❌ Erreur GET stats: {response.status_code} - {response.text}")
            return False
        
        # 8. POST sans registration_id → 400
        print("\n8. POST sans registration_id (test erreur 400)...")
        response = requests.post(f"{BASE_URL}/satisfaction", json={"nps_score": 5})
        if response.status_code == 400:
            print(f"✅ Erreur 400 correcte pour registration_id manquant")
        else:
            print(f"❌ Erreur 400 attendue, reçu: {response.status_code}")
            return False
        
        # 9. POST avec registration_id="reg-inexistant" → 404
        print("\n9. POST avec registration_id inexistant (test erreur 404)...")
        response = requests.post(f"{BASE_URL}/satisfaction", json={
            "registration_id": "reg-inexistant",
            "nps_score": 5
        })
        if response.status_code == 404:
            print(f"✅ Erreur 404 correcte pour registration_id inexistant")
        else:
            print(f"❌ Erreur 404 attendue, reçu: {response.status_code}")
            return False
        
        print(f"\n🎉 TOUS LES TESTS SATISFACTION PASSÉS AVEC SUCCÈS!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors des tests: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_satisfaction_endpoints()
    sys.exit(0 if success else 1)