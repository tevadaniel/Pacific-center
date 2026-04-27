#!/usr/bin/env python3
"""
Focused Backend Test - Re-testing corrected workflow endpoints
Testing specific scenarios for the corrected endpoints.
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "admin"
}

def make_request(method: str, endpoint: str, data: dict = None) -> tuple:
    """Make HTTP request and return (success, response_data, status_code)"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=HEADERS, timeout=30)
        elif method == "POST":
            response = requests.post(url, headers=HEADERS, json=data, timeout=30)
        else:
            return False, {"error": f"Unsupported method: {method}"}, 0
            
        try:
            response_data = response.json()
        except:
            response_data = {"raw_response": response.text}
            
        return response.status_code < 400, response_data, response.status_code
    except Exception as e:
        return False, {"error": str(e)}, 0

def test_workflow_sequence():
    """Test the complete workflow sequence"""
    print("🧪 Testing Corrected Workflow Endpoints - Focused Test")
    print("=" * 60)
    
    # 1. Setup - Seed database
    print("\n1. SETUP - Seeding database")
    success, data, status = make_request("POST", "/api/seed", {"force": True})
    if not success or not data.get("seeded"):
        print(f"❌ Seed failed: {status}, {data}")
        return False
    print(f"✅ Seeded: {data.get('associations', 0)} associations, {data.get('stands_planned', 0)} stands")
    
    # 2. Get a test registration
    print("\n2. Getting test registration")
    success, registrations, status = make_request("GET", "/api/registrations")
    if not success or not isinstance(registrations, list) or len(registrations) == 0:
        print(f"❌ Failed to get registrations: {status}")
        return False
    
    # Find a registration that's not confirmed
    test_reg = None
    for reg in registrations:
        if reg.get("status") != "confirme":
            test_reg = reg
            break
    
    if not test_reg:
        print("❌ No non-confirmed registration found")
        return False
        
    reg_id = test_reg["id"]
    print(f"✅ Using registration: {reg_id} ({test_reg.get('organization', {}).get('name', 'Unknown')})")
    
    # 3. Test generate-caution-receipt (corrected)
    print(f"\n3. Testing generate-caution-receipt (corrected)")
    success, data, status = make_request("POST", f"/api/registrations/{reg_id}/generate-caution-receipt", {})
    
    if success and data.get("ok") and data.get("receipt_number", "").startswith("CAUT-2026-"):
        print(f"✅ Receipt generated: {data.get('receipt_number')}")
        
        # Verify document was created
        success2, docs, status2 = make_request("GET", f"/api/documents?registration_id={reg_id}")
        if success2 and isinstance(docs, list):
            caution_docs = [doc for doc in docs if doc.get("document_type") == "recu_caution"]
            if caution_docs and caution_docs[0].get("status") == "valide":
                print(f"✅ Document created and validated: {caution_docs[0].get('file_name')}")
            else:
                print(f"❌ Document not found or not valid: {caution_docs}")
        else:
            print(f"❌ Failed to verify document: {status2}")
    else:
        print(f"❌ Receipt generation failed: {status}, {data}")
    
    # 4. Test release-stand to free up a stand
    print(f"\n4. Testing release-stand to free up a stand")
    if test_reg.get("stand_code"):
        success, data, status = make_request("POST", f"/api/registrations/{reg_id}/release-stand", {})
        if success and data.get("ok"):
            print(f"✅ Stand {test_reg.get('stand_code')} released")
            
            # Verify registration was updated
            success2, reg_data, status2 = make_request("GET", f"/api/registrations/{reg_id}")
            if success2 and isinstance(reg_data, dict) and reg_data.get("registration"):
                reg = reg_data["registration"]
                if not reg.get("stand_code") and not reg.get("is_pre_reserved"):
                    print("✅ Registration updated: stand_code cleared, is_pre_reserved=false")
                else:
                    print(f"❌ Registration not properly updated: stand_code={reg.get('stand_code')}, is_pre_reserved={reg.get('is_pre_reserved')}")
            else:
                print(f"❌ Failed to verify registration update: {status2}")
        else:
            print(f"❌ Stand release failed: {status}, {data}")
    else:
        print("ℹ️ Registration has no stand to release")
    
    # 5. Test pre-reserve-stand (corrected) - try to reserve the released stand
    print(f"\n5. Testing pre-reserve-stand (corrected)")
    
    # Find a stand that might be free now
    venue_id = test_reg.get("venue_id")
    if venue_id:
        success, stands, status = make_request("GET", f"/api/venues/{venue_id}/stands")
        if success and isinstance(stands, list):
            # Look for a stand without organization or with assignment status that allows pre-reservation
            free_stand = None
            for stand in stands:
                if not stand.get("organization") or stand.get("assignment", {}).get("status") != "provisoire":
                    free_stand = stand
                    break
            
            if free_stand:
                stand_id = free_stand["id"]
                print(f"Found potentially free stand: {free_stand.get('code')} (ID: {stand_id})")
                
                success, data, status = make_request("POST", f"/api/registrations/{reg_id}/pre-reserve-stand", 
                                                   {"stand_id": stand_id})
                if success and data.get("ok"):
                    print(f"✅ Stand pre-reserved: {data.get('stand_code')}")
                    
                    # Verify registration was updated
                    success2, reg_data, status2 = make_request("GET", f"/api/registrations/{reg_id}")
                    if success2 and isinstance(reg_data, dict) and reg_data.get("registration"):
                        reg = reg_data["registration"]
                        if reg.get("stand_code") and reg.get("is_pre_reserved"):
                            print("✅ Registration updated: stand assigned, is_pre_reserved=true")
                        else:
                            print(f"❌ Registration not properly updated: stand_code={reg.get('stand_code')}, is_pre_reserved={reg.get('is_pre_reserved')}")
                else:
                    print(f"❌ Pre-reservation failed: {status}, {data}")
            else:
                print("❌ No free stand found for pre-reservation")
        else:
            print(f"❌ Failed to get venue stands: {status}")
    else:
        print("❌ No venue_id in registration")
    
    # 6. Test confirm-stand (corrected)
    print(f"\n6. Testing confirm-stand (corrected)")
    success, data, status = make_request("POST", f"/api/registrations/{reg_id}/confirm-stand", {})
    
    if success and data.get("ok"):
        print("✅ Stand confirmed")
        
        # Verify registration was updated
        success2, reg_data, status2 = make_request("GET", f"/api/registrations/{reg_id}")
        if success2 and isinstance(reg_data, dict) and reg_data.get("registration"):
            reg = reg_data["registration"]
            checks = {
                "status": reg.get("status") == "confirme",
                "is_pre_reserved": reg.get("is_pre_reserved") == False,
                "is_deposit_received": reg.get("is_deposit_received") == True,
                "confirmed_at": reg.get("confirmed_at") is not None
            }
            
            # Check if deposit status is updated (might be in a separate field or enriched)
            deposit_ok = False
            if "deposit" in reg and reg["deposit"] and reg["deposit"].get("status") == "recue":
                deposit_ok = True
                checks["deposit_status"] = True
            else:
                checks["deposit_status"] = False
                print(f"ℹ️ Deposit info: {reg.get('deposit', 'No deposit field')}")
            
            passed_checks = sum(checks.values())
            total_checks = len(checks)
            
            if passed_checks == total_checks:
                print(f"✅ All registration checks passed ({passed_checks}/{total_checks})")
            else:
                print(f"⚠️ Some checks failed ({passed_checks}/{total_checks}): {checks}")
        else:
            print(f"❌ Failed to verify registration update: {status2}")
    else:
        print(f"❌ Stand confirmation failed: {status}, {data}")
    
    # 7. Test profile endpoint (non-regression)
    print(f"\n7. Testing profile endpoint (non-regression)")
    success, data, status = make_request("POST", f"/api/registrations/{reg_id}/profile", {
        "name": "Test Organization Updated",
        "discipline": "Sport",
        "contact_name": "Test Contact",
        "main_phone": "40123456",
        "description": "Test description"
    })
    
    if success and data.get("ok"):
        print("✅ Profile update successful")
    else:
        print(f"❌ Profile update failed: {status}, {data}")
    
    print("\n" + "=" * 60)
    print("✅ Focused workflow test completed")
    return True

if __name__ == "__main__":
    success = test_workflow_sequence()
    sys.exit(0 if success else 1)