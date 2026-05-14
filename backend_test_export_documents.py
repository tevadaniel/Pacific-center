#!/usr/bin/env python3
"""
Test suite for bulk document export feature (POST /api/admin/export-documents)
Tests 8 scenarios as specified in the review request.
"""

import os
import sys
import requests
import zipfile
import io
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000')
API_BASE = f"{BASE_URL}/api"

# Test results tracking
test_results = []
total_tests = 0
passed_tests = 0

def log_test(scenario, status, details=""):
    """Log test result"""
    global total_tests, passed_tests
    total_tests += 1
    if status == "PASS":
        passed_tests += 1
    result = f"[{status}] Scenario {scenario}: {details}"
    test_results.append(result)
    print(result)

def test_scenario_1_conventions_only():
    """Scenario 1: Conventions only — all sites/exposants"""
    print("\n=== Scenario 1: Conventions only — all sites/exposants ===")
    try:
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "conventions",
                "site_ids": ["all"],
                "registration_ids": ["all"]
            },
            timeout=60
        )
        
        # Check status code
        if response.status_code != 200:
            log_test(1, "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        if content_type != 'application/zip':
            log_test(1, "FAIL", f"Expected application/zip, got {content_type}")
            return
        
        # Check ZIP signature (PK)
        content = response.content
        if not content.startswith(b'PK'):
            log_test(1, "FAIL", f"ZIP signature not found. First bytes: {content[:10].hex()}")
            return
        
        # Check headers
        conventions_count = int(response.headers.get('X-Documents-Conventions', '0'))
        receipts_count = int(response.headers.get('X-Documents-Receipts', '0'))
        
        if conventions_count == 0:
            log_test(1, "FAIL", f"Expected conventions_count > 0, got {conventions_count}")
            return
        
        if receipts_count != 0:
            log_test(1, "FAIL", f"Expected receipts_count = 0, got {receipts_count}")
            return
        
        log_test(1, "PASS", f"Conventions: {conventions_count}, Receipts: {receipts_count}, Size: {len(content)} bytes")
        
    except Exception as e:
        log_test(1, "FAIL", f"Exception: {str(e)}")

def test_scenario_2_receipts_only():
    """Scenario 2: Receipts only — all sites/exposants"""
    print("\n=== Scenario 2: Receipts only — all sites/exposants ===")
    try:
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "receipts",
                "site_ids": ["all"],
                "registration_ids": ["all"]
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_test(2, "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        if response.headers.get('Content-Type') != 'application/zip':
            log_test(2, "FAIL", f"Expected application/zip, got {response.headers.get('Content-Type')}")
            return
        
        conventions_count = int(response.headers.get('X-Documents-Conventions', '0'))
        receipts_count = int(response.headers.get('X-Documents-Receipts', '0'))
        
        if receipts_count == 0:
            log_test(2, "FAIL", f"Expected receipts_count > 0, got {receipts_count}")
            return
        
        if conventions_count != 0:
            log_test(2, "FAIL", f"Expected conventions_count = 0, got {conventions_count}")
            return
        
        log_test(2, "PASS", f"Conventions: {conventions_count}, Receipts: {receipts_count}, Size: {len(response.content)} bytes")
        
    except Exception as e:
        log_test(2, "FAIL", f"Exception: {str(e)}")

def test_scenario_3_both_types():
    """Scenario 3: Both types — all"""
    print("\n=== Scenario 3: Both types — all ===")
    try:
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "all",
                "site_ids": ["all"],
                "registration_ids": ["all"]
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_test(3, "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        conventions_count = int(response.headers.get('X-Documents-Conventions', '0'))
        receipts_count = int(response.headers.get('X-Documents-Receipts', '0'))
        
        if conventions_count == 0 or receipts_count == 0:
            log_test(3, "FAIL", f"Expected both counts > 0, got Conventions: {conventions_count}, Receipts: {receipts_count}")
            return
        
        if conventions_count != receipts_count:
            log_test(3, "FAIL", f"Expected equal counts, got Conventions: {conventions_count}, Receipts: {receipts_count}")
            return
        
        log_test(3, "PASS", f"Conventions: {conventions_count}, Receipts: {receipts_count} (equal)")
        
    except Exception as e:
        log_test(3, "FAIL", f"Exception: {str(e)}")

def test_scenario_4_filter_by_site():
    """Scenario 4: Filter by specific site"""
    print("\n=== Scenario 4: Filter by specific site ===")
    try:
        # First, get venues to pick one
        venues_response = requests.get(f"{API_BASE}/venues", timeout=10)
        if venues_response.status_code != 200:
            log_test(4, "FAIL", f"Failed to fetch venues: {venues_response.status_code}")
            return
        
        venues = venues_response.json()
        if not venues or len(venues) == 0:
            log_test(4, "FAIL", "No venues found")
            return
        
        # Pick the first venue
        venue_id = venues[0].get('id')
        venue_name = venues[0].get('name', 'unknown')
        
        # Now test export with this specific venue
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "all",
                "site_ids": [venue_id],
                "registration_ids": ["all"]
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_test(4, "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        conventions_count = int(response.headers.get('X-Documents-Conventions', '0'))
        receipts_count = int(response.headers.get('X-Documents-Receipts', '0'))
        
        # Get the count from scenario 3 for comparison (should be fewer)
        # For now, just verify we got some documents
        if conventions_count == 0 and receipts_count == 0:
            log_test(4, "FAIL", f"Expected some documents for venue {venue_name}, got 0")
            return
        
        log_test(4, "PASS", f"Venue: {venue_name}, Conventions: {conventions_count}, Receipts: {receipts_count}")
        
    except Exception as e:
        log_test(4, "FAIL", f"Exception: {str(e)}")

def test_scenario_5_filter_by_registration():
    """Scenario 5: Filter by specific registration ID"""
    print("\n=== Scenario 5: Filter by specific registration ID ===")
    try:
        # First, get registrations to pick one
        regs_response = requests.get(f"{API_BASE}/registrations", timeout=10)
        if regs_response.status_code != 200:
            log_test(5, "FAIL", f"Failed to fetch registrations: {regs_response.status_code}")
            return
        
        registrations = regs_response.json()
        if not registrations or len(registrations) == 0:
            log_test(5, "FAIL", "No registrations found")
            return
        
        # Pick the first registration
        reg_id = registrations[0].get('id')
        
        # Now test export with this specific registration
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "all",
                "site_ids": ["all"],
                "registration_ids": [reg_id]
            },
            timeout=60
        )
        
        if response.status_code != 200:
            log_test(5, "FAIL", f"Expected 200, got {response.status_code}")
            return
        
        conventions_count = int(response.headers.get('X-Documents-Conventions', '0'))
        receipts_count = int(response.headers.get('X-Documents-Receipts', '0'))
        
        # Should have exactly 1 of each
        if conventions_count != 1:
            log_test(5, "FAIL", f"Expected conventions_count = 1, got {conventions_count}")
            return
        
        if receipts_count != 1:
            log_test(5, "FAIL", f"Expected receipts_count = 1, got {receipts_count}")
            return
        
        log_test(5, "PASS", f"Registration: {reg_id}, Conventions: {conventions_count}, Receipts: {receipts_count}")
        
        # Store the response for scenario 8
        return response.content
        
    except Exception as e:
        log_test(5, "FAIL", f"Exception: {str(e)}")
        return None

def test_scenario_6_invalid_type():
    """Scenario 6: Invalid type"""
    print("\n=== Scenario 6: Invalid type ===")
    try:
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "bogus"
            },
            timeout=10
        )
        
        if response.status_code != 400:
            log_test(6, "FAIL", f"Expected 400, got {response.status_code}")
            return
        
        # Check for French error message
        try:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            if 'type' not in error_msg.lower():
                log_test(6, "FAIL", f"Expected error about 'type', got: {error_msg}")
                return
        except:
            log_test(6, "FAIL", "Expected JSON error response")
            return
        
        log_test(6, "PASS", f"Correctly rejected invalid type with 400")
        
    except Exception as e:
        log_test(6, "FAIL", f"Exception: {str(e)}")

def test_scenario_7_no_matching_exposants():
    """Scenario 7: No matching exposants"""
    print("\n=== Scenario 7: No matching exposants ===")
    try:
        response = requests.post(
            f"{API_BASE}/admin/export-documents",
            json={
                "type": "all",
                "registration_ids": ["nonexistent-id-12345"]
            },
            timeout=10
        )
        
        if response.status_code != 404:
            log_test(7, "FAIL", f"Expected 404, got {response.status_code}")
            return
        
        # Check for French error message
        try:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            if 'aucun' not in error_msg.lower() or 'exposant' not in error_msg.lower():
                log_test(7, "FAIL", f"Expected French error 'Aucun exposant...', got: {error_msg}")
                return
        except:
            log_test(7, "FAIL", "Expected JSON error response")
            return
        
        log_test(7, "PASS", f"Correctly returned 404 with French error message")
        
    except Exception as e:
        log_test(7, "FAIL", f"Exception: {str(e)}")

def test_scenario_8_zip_content_validation(zip_content):
    """Scenario 8: ZIP content validation (light)"""
    print("\n=== Scenario 8: ZIP content validation (light) ===")
    
    if not zip_content:
        log_test(8, "FAIL", "No ZIP content from scenario 5")
        return
    
    try:
        # Unzip and validate
        zip_buffer = io.BytesIO(zip_content)
        with zipfile.ZipFile(zip_buffer, 'r') as zf:
            file_list = zf.namelist()
            
            # Check for README.txt
            if 'README.txt' not in file_list:
                log_test(8, "FAIL", "README.txt not found in ZIP")
                return
            
            # Check for at least one Convention PDF
            convention_files = [f for f in file_list if f.startswith('Conventions/') and f.endswith('.pdf')]
            if len(convention_files) == 0:
                log_test(8, "FAIL", "No Convention PDF found in ZIP")
                return
            
            # Check for at least one Receipt PDF
            receipt_files = [f for f in file_list if f.startswith('Recus_Caution/') and f.endswith('.pdf')]
            if len(receipt_files) == 0:
                log_test(8, "FAIL", "No Receipt PDF found in ZIP")
                return
            
            # Verify PDF magic bytes for one convention
            conv_pdf_content = zf.read(convention_files[0])
            if not conv_pdf_content.startswith(b'%PDF-'):
                log_test(8, "FAIL", f"Convention PDF doesn't start with %PDF-. First bytes: {conv_pdf_content[:10]}")
                return
            
            # Verify PDF magic bytes for one receipt
            receipt_pdf_content = zf.read(receipt_files[0])
            if not receipt_pdf_content.startswith(b'%PDF-'):
                log_test(8, "FAIL", f"Receipt PDF doesn't start with %PDF-. First bytes: {receipt_pdf_content[:10]}")
                return
            
            # Read README
            readme_content = zf.read('README.txt').decode('utf-8')
            
            log_test(8, "PASS", f"ZIP structure valid. Files: {len(file_list)}, Conventions: {len(convention_files)}, Receipts: {len(receipt_files)}")
            print(f"\nSample ZIP listing:")
            for f in file_list[:10]:
                print(f"  - {f}")
            if len(file_list) > 10:
                print(f"  ... and {len(file_list) - 10} more files")
            
    except zipfile.BadZipFile:
        log_test(8, "FAIL", "Invalid ZIP file")
    except Exception as e:
        log_test(8, "FAIL", f"Exception: {str(e)}")

def main():
    """Run all test scenarios"""
    print(f"Testing bulk document export endpoint")
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("=" * 80)
    
    # Run all scenarios
    test_scenario_1_conventions_only()
    test_scenario_2_receipts_only()
    test_scenario_3_both_types()
    test_scenario_4_filter_by_site()
    zip_content = test_scenario_5_filter_by_registration()
    test_scenario_6_invalid_type()
    test_scenario_7_no_matching_exposants()
    test_scenario_8_zip_content_validation(zip_content)
    
    # Print summary
    print("\n" + "=" * 80)
    print(f"TEST SUMMARY: {passed_tests}/{total_tests} tests passed")
    print("=" * 80)
    
    if passed_tests == total_tests:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"❌ {total_tests - passed_tests} TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
