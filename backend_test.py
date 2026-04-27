#!/usr/bin/env python3
"""
Backend Test Suite - Re-testing corrected workflow endpoints
Testing the corrected endpoints after bug fixes applied.
"""

import requests
import json
import sys
from typing import Dict, Any, List, Optional

# Configuration
BASE_URL = "https://polynesie-event-hub.preview.emergentagent.com"
HEADERS = {
    "Content-Type": "application/json",
    "x-user-role": "admin"
}

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method == "PUT":
                response = requests.put(url, headers=self.headers, json=data, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
                
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
                
            return response.status_code < 400, response_data, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_seed_setup(self) -> bool:
        """Setup: POST /api/seed with force=true"""
        print("\n=== SETUP: Seeding database ===")
        success, data, status = self.make_request("POST", "/api/seed", {"force": True})
        
        if success and data.get("seeded"):
            self.log_test("Seed setup", True, f"Seeded {data.get('associations', 0)} associations, {data.get('stands_planned', 0)} stands")
            return True
        else:
            self.log_test("Seed setup", False, f"Status: {status}, Data: {data}")
            return False

    def get_test_registration(self) -> Optional[str]:
        """Get a test registration ID"""
        success, data, status = self.make_request("GET", "/api/registrations")
        if success and isinstance(data, list) and len(data) > 0:
            reg_id = data[0]["id"]
            print(f"Using test registration ID: {reg_id}")
            return reg_id
        return None

    def get_free_stand(self) -> Optional[Dict]:
        """Get a free stand for testing"""
        # Try different venues to find a free stand
        venues = ["venue-pun", "venue-faaa", "venue-aru", "venue-tar", "venue-mah", "venue-moo"]
        
        for venue_id in venues:
            success, data, status = self.make_request("GET", f"/api/venues/{venue_id}/stands")
            if success and isinstance(data, list):
                for stand in data:
                    if not stand.get("organization"):  # Stand is free
                        print(f"Found free stand: {stand.get('code')} (ID: {stand.get('id')}) in {venue_id}")
                        return stand
        
        print("No free stands found in any venue")
        return None

    def test_generate_caution_receipt(self):
        """Test 1: POST /api/registrations/:id/generate-caution-receipt (corrected)"""
        print("\n=== TEST 1: Generate Caution Receipt (corrected) ===")
        
        # Get a registration
        reg_id = self.get_test_registration()
        if not reg_id:
            self.log_test("Generate caution receipt - get registration", False, "No registration found")
            return
            
        # Test generate receipt
        success, data, status = self.make_request("POST", f"/api/registrations/{reg_id}/generate-caution-receipt", {})
        
        if success and data.get("ok") and data.get("receipt_number", "").startswith("CAUT-2026-"):
            self.log_test("Generate caution receipt - creation", True, 
                         f"Receipt: {data.get('receipt_number')}, Document ID: {data.get('document_id')}")
            
            # Verify document was created via GET /api/documents?registration_id=<id>
            success2, data2, status2 = self.make_request("GET", f"/api/documents?registration_id={reg_id}")
            
            if success2 and isinstance(data2, list):
                # Look for recu_caution document
                caution_docs = [doc for doc in data2 if doc.get("document_type") == "recu_caution"]
                if caution_docs:
                    doc = caution_docs[0]
                    if (doc.get("status") == "valide" and 
                        data.get("receipt_number") in doc.get("file_name", "")):
                        self.log_test("Generate caution receipt - document verification", True,
                                     f"Document found: {doc.get('file_name')}, status: {doc.get('status')}")
                    else:
                        self.log_test("Generate caution receipt - document verification", False,
                                     f"Document status: {doc.get('status')}, filename: {doc.get('file_name')}")
                else:
                    self.log_test("Generate caution receipt - document verification", False,
                                 "No recu_caution document found in documents list")
            else:
                self.log_test("Generate caution receipt - document verification", False,
                             f"GET /api/documents failed: {status2}, {data2}")
                
            # Verify document appears in registration
            success3, data3, status3 = self.make_request("GET", f"/api/registrations/{reg_id}")
            if success3 and data3.get("registration", {}).get("documents"):
                caution_docs = [doc for doc in data3["registration"]["documents"] 
                               if doc.get("document_type") == "recu_caution"]
                if caution_docs:
                    self.log_test("Generate caution receipt - registration documents", True,
                                 "Document appears in registration.documents array")
                else:
                    self.log_test("Generate caution receipt - registration documents", False,
                                 "Document not found in registration.documents array")
            else:
                self.log_test("Generate caution receipt - registration documents", False,
                             "Failed to get registration or no documents array")
        else:
            self.log_test("Generate caution receipt - creation", False,
                         f"Status: {status}, Response: {data}")

    def test_pre_reserve_stand(self):
        """Test 2: POST /api/registrations/:id/pre-reserve-stand (corrected)"""
        print("\n=== TEST 2: Pre-reserve Stand (corrected) ===")
        
        # Get two registrations
        success, data, status = self.make_request("GET", "/api/registrations")
        if not success or not isinstance(data, list) or len(data) == 0:
            self.log_test("Pre-reserve stand - get registrations", False, "No registrations found")
            return
            
        # Filter registrations with status != 'confirme'
        available_regs = [reg for reg in data if reg.get("status") != "confirme"]
        if len(available_regs) < 2:
            self.log_test("Pre-reserve stand - get registrations", False, "Need at least 2 non-confirmed registrations")
            return
            
        reg_a_id = available_regs[0]["id"]
        reg_b_id = available_regs[1]["id"]
        print(f"Using registrations: {reg_a_id} and {reg_b_id}")
        
        # Get a free stand
        free_stand = self.get_free_stand()
        if not free_stand:
            self.log_test("Pre-reserve stand - get free stand", False, "No free stand found")
            return
            
        stand_id = free_stand["id"]
        stand_code = free_stand["code"]
        venue_id = free_stand["venue_id"]
        
        # Test 1: Pre-reserve stand for regA
        success, data, status = self.make_request("POST", f"/api/registrations/{reg_a_id}/pre-reserve-stand", 
                                                 {"stand_id": stand_id})
        
        if success and data.get("ok") and data.get("stand_code"):
            self.log_test("Pre-reserve stand - regA reservation", True,
                         f"Stand reserved: {data.get('stand_code')}")
            
            # Verify registration was updated
            success2, data2, status2 = self.make_request("GET", f"/api/registrations/{reg_a_id}")
            if success2 and data2.get("registration"):
                reg = data2["registration"]
                checks = []
                checks.append(("stand_code", reg.get("stand_code") == stand_code))
                checks.append(("venue_id", reg.get("venue_id") == venue_id))
                checks.append(("is_pre_reserved", reg.get("is_pre_reserved") == True))
                checks.append(("status", reg.get("status") == "a_confirmer" or reg.get("status") == "confirme"))
                
                all_good = all(check[1] for check in checks)
                details = ", ".join([f"{check[0]}={'✓' if check[1] else '✗'}" for check in checks])
                self.log_test("Pre-reserve stand - regA verification", all_good, details)
            else:
                self.log_test("Pre-reserve stand - regA verification", False, "Failed to get registration")
                
            # Verify stand is marked as assigned in venues endpoint
            success3, data3, status3 = self.make_request("GET", f"/api/venues/{venue_id}/stands")
            if success3 and isinstance(data3, list):
                target_stand = next((s for s in data3 if s.get("id") == stand_id), None)
                if target_stand:
                    is_assigned = (target_stand.get("organization") is not None or 
                                 target_stand.get("assignment", {}).get("status") == "pre_reserve")
                    self.log_test("Pre-reserve stand - stand assignment check", is_assigned,
                                 f"Stand organization: {target_stand.get('organization')}, assignment: {target_stand.get('assignment')}")
                else:
                    self.log_test("Pre-reserve stand - stand assignment check", False, "Stand not found in venue")
            else:
                self.log_test("Pre-reserve stand - stand assignment check", False, "Failed to get venue stands")
                
            # Test 2: Try to reserve same stand with regB (should fail)
            success4, data4, status4 = self.make_request("POST", f"/api/registrations/{reg_b_id}/pre-reserve-stand",
                                                        {"stand_id": stand_id})
            
            expected_conflict = status4 == 409 and ("déjà attribué" in str(data4) or "déjà pré-réservé" in str(data4))
            self.log_test("Pre-reserve stand - regB conflict", expected_conflict,
                         f"Status: {status4}, Response: {data4}")
        else:
            self.log_test("Pre-reserve stand - regA reservation", False,
                         f"Status: {status}, Response: {data}")
            
        # Test 3: Invalid stand ID
        success5, data5, status5 = self.make_request("POST", f"/api/registrations/{reg_a_id}/pre-reserve-stand",
                                                     {"stand_id": "fake-uuid-12345"})
        self.log_test("Pre-reserve stand - invalid stand", status5 == 404,
                     f"Status: {status5}, Response: {data5}")
        
        # Test 4: Missing stand_id
        success6, data6, status6 = self.make_request("POST", f"/api/registrations/{reg_a_id}/pre-reserve-stand", {})
        self.log_test("Pre-reserve stand - missing stand_id", status6 == 400,
                     f"Status: {status6}, Response: {data6}")

    def test_release_stand(self):
        """Test 3: POST /api/registrations/:id/release-stand (corrected)"""
        print("\n=== TEST 3: Release Stand (corrected) ===")
        
        # First, we need a registration with a pre-reserved stand
        # Let's find one from the previous test or create one
        success, data, status = self.make_request("GET", "/api/registrations")
        if not success or not isinstance(data, list) or len(data) == 0:
            self.log_test("Release stand - get registrations", False, "No registrations found")
            return
            
        # Find a registration with a pre-reserved stand
        pre_reserved_reg = None
        for reg in data:
            if reg.get("is_pre_reserved") and reg.get("stand_code") and reg.get("status") != "confirme":
                pre_reserved_reg = reg
                break
                
        if not pre_reserved_reg:
            self.log_test("Release stand - find pre-reserved", False, "No pre-reserved registration found")
            return
            
        reg_id = pre_reserved_reg["id"]
        original_stand_code = pre_reserved_reg["stand_code"]
        venue_id = pre_reserved_reg["venue_id"]
        
        print(f"Using pre-reserved registration: {reg_id}, stand: {original_stand_code}")
        
        # Test 1: Release the stand
        success, data, status = self.make_request("POST", f"/api/registrations/{reg_id}/release-stand", {})
        
        if success and data.get("ok"):
            self.log_test("Release stand - release action", True, "Stand released successfully")
            
            # Verify registration was updated
            success2, data2, status2 = self.make_request("GET", f"/api/registrations/{reg_id}")
            if success2 and data2.get("registration"):
                reg = data2["registration"]
                stand_cleared = reg.get("stand_code") is None or reg.get("stand_code") == ""
                pre_reserved_cleared = reg.get("is_pre_reserved") == False
                
                self.log_test("Release stand - registration verification", 
                             stand_cleared and pre_reserved_cleared,
                             f"stand_code: {reg.get('stand_code')}, is_pre_reserved: {reg.get('is_pre_reserved')}")
            else:
                self.log_test("Release stand - registration verification", False, "Failed to get registration")
                
            # Verify stand is free in venues endpoint
            if venue_id:
                success3, data3, status3 = self.make_request("GET", f"/api/venues/{venue_id}/stands")
                if success3 and isinstance(data3, list):
                    # Find the stand that was released
                    released_stand = next((s for s in data3 if s.get("code") == original_stand_code), None)
                    if released_stand:
                        is_free = (released_stand.get("organization") is None and 
                                 (not released_stand.get("assignment") or 
                                  released_stand.get("assignment", {}).get("status") != "pre_reserve"))
                        self.log_test("Release stand - stand freedom check", is_free,
                                     f"Stand organization: {released_stand.get('organization')}, assignment: {released_stand.get('assignment')}")
                    else:
                        self.log_test("Release stand - stand freedom check", False, "Released stand not found in venue")
                else:
                    self.log_test("Release stand - stand freedom check", False, "Failed to get venue stands")
        else:
            self.log_test("Release stand - release action", False,
                         f"Status: {status}, Response: {data}")
            
        # Test 2: Try to release a confirmed registration's stand
        confirmed_reg = None
        for reg in data if isinstance(data, list) else []:
            if reg.get("status") == "confirme" and reg.get("stand_code"):
                confirmed_reg = reg
                break
                
        if confirmed_reg:
            success4, data4, status4 = self.make_request("POST", f"/api/registrations/{confirmed_reg['id']}/release-stand", {})
            self.log_test("Release stand - confirmed registration", status4 == 400,
                         f"Status: {status4}, Response: {data4}")
        else:
            self.log_test("Release stand - confirmed registration", True, "No confirmed registration to test (acceptable)")

    def test_confirm_stand(self):
        """Test 4: POST /api/registrations/:id/confirm-stand (corrected)"""
        print("\n=== TEST 4: Confirm Stand (corrected) ===")
        
        # Get a registration with status != 'confirme'
        success, data, status = self.make_request("GET", "/api/registrations")
        if not success or not isinstance(data, list) or len(data) == 0:
            self.log_test("Confirm stand - get registrations", False, "No registrations found")
            return
            
        # Find a non-confirmed registration
        target_reg = None
        for reg in data:
            if reg.get("status") != "confirme":
                target_reg = reg
                break
                
        if not target_reg:
            self.log_test("Confirm stand - find non-confirmed", False, "No non-confirmed registration found")
            return
            
        reg_id = target_reg["id"]
        print(f"Using registration for confirmation: {reg_id}")
        
        # Optionally pre-reserve a stand first if not already done
        if not target_reg.get("stand_code"):
            free_stand = self.get_free_stand()
            if free_stand:
                self.make_request("POST", f"/api/registrations/{reg_id}/pre-reserve-stand", 
                                {"stand_id": free_stand["id"]})
                print(f"Pre-reserved stand {free_stand['code']} for testing")
        
        # Test 1: Confirm the stand
        success, data, status = self.make_request("POST", f"/api/registrations/{reg_id}/confirm-stand", {})
        
        if success and data.get("ok"):
            self.log_test("Confirm stand - confirmation action", True, "Stand confirmed successfully")
            
            # Verify registration was updated
            success2, data2, status2 = self.make_request("GET", f"/api/registrations/{reg_id}")
            if success2 and data2.get("registration"):
                reg = data2["registration"]
                checks = []
                checks.append(("status", reg.get("status") == "confirme"))
                checks.append(("is_pre_reserved", reg.get("is_pre_reserved") == False))
                checks.append(("is_deposit_received", reg.get("is_deposit_received") == True))
                checks.append(("confirmed_at", reg.get("confirmed_at") is not None))
                
                # Check deposit status (should be in deposit_transactions or enriched field)
                deposit_status_ok = False
                if reg.get("deposit", {}).get("status") == "recue":
                    deposit_status_ok = True
                elif "deposit" in reg and reg["deposit"].get("status") == "recue":
                    deposit_status_ok = True
                    
                checks.append(("deposit_status", deposit_status_ok))
                
                all_good = all(check[1] for check in checks)
                details = ", ".join([f"{check[0]}={'✓' if check[1] else '✗'}" for check in checks])
                self.log_test("Confirm stand - registration verification", all_good, details)
                
                if not deposit_status_ok:
                    print(f"    Deposit info: {reg.get('deposit', 'No deposit field')}")
            else:
                self.log_test("Confirm stand - registration verification", False, "Failed to get registration")
        else:
            self.log_test("Confirm stand - confirmation action", False,
                         f"Status: {status}, Response: {data}")
            
        # Test 2: Invalid registration ID
        success3, data3, status3 = self.make_request("POST", "/api/registrations/fake-id-12345/confirm-stand", {})
        self.log_test("Confirm stand - invalid ID", status3 == 404,
                     f"Status: {status3}, Response: {data3}")

    def test_non_regression(self):
        """Test 5: Non-regression tests"""
        print("\n=== TEST 5: Non-regression ===")
        
        # Test profile endpoint
        reg_id = self.get_test_registration()
        if reg_id:
            success, data, status = self.make_request("POST", f"/api/registrations/{reg_id}/profile", {
                "name": "Test Organization Updated",
                "discipline": "Sport",
                "contact_name": "Test Contact",
                "main_phone": "40123456",
                "description": "Test description"
            })
            self.log_test("Non-regression - profile endpoint", success and data.get("ok"),
                         f"Status: {status}, Response: {data}")
        else:
            self.log_test("Non-regression - profile endpoint", False, "No registration ID available")
            
        # Test dashboard KPIs
        success, data, status = self.make_request("GET", "/api/dashboard/kpis")
        self.log_test("Non-regression - dashboard KPIs", success and "total" in data,
                     f"Status: {status}, Total: {data.get('total', 'N/A')}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Backend Re-testing of Corrected Workflow Endpoints")
        print("=" * 70)
        
        # Setup
        if not self.test_seed_setup():
            print("❌ Setup failed, aborting tests")
            return
            
        # Run tests
        self.test_generate_caution_receipt()
        self.test_pre_reserve_stand()
        self.test_release_stand()
        self.test_confirm_stand()
        self.test_non_regression()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed, total

if __name__ == "__main__":
    tester = BackendTester()
    passed, total = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)