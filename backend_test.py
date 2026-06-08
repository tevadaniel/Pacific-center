#!/usr/bin/env python3
"""
SESSION 48y — Backend Test Suite
Tests for new /api/venues/availability endpoint and modified /api/venues/:id/stands filtering
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@aracom.pf"
ADMIN_PASSWORD = "Projetaracom12"

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(name, passed, details=""):
    """Print test result with color"""
    status = f"{GREEN}✅ PASS{RESET}" if passed else f"{RED}❌ FAIL{RESET}"
    print(f"{status} - {name}")
    if details:
        print(f"  {details}")

def print_section(title):
    """Print section header"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

# Test counter
tests_run = 0
tests_passed = 0

def run_test(name, test_func):
    """Run a test and track results"""
    global tests_run, tests_passed
    tests_run += 1
    try:
        result, details = test_func()
        if result:
            tests_passed += 1
        print_test(name, result, details)
        return result
    except Exception as e:
        print_test(name, False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 1: GET /api/venues/availability - Structure and Active Venues Only
# ============================================================================

def test_venues_availability_structure():
    """Test that /api/venues/availability returns correct structure with 4 active venues only"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should be an object (dict), not an array
        if not isinstance(data, dict):
            return False, f"Expected object, got {type(data).__name__}"
        
        # Should have exactly 4 active venues (not 6)
        venue_ids = list(data.keys())
        if len(venue_ids) != 4:
            return False, f"Expected 4 venues, got {len(venue_ids)}: {venue_ids}"
        
        # Check that we have the correct 4 venues
        expected_venues = {'venue-faaa', 'venue-pun', 'venue-aru', 'venue-tar'}
        actual_venues = set(venue_ids)
        
        if actual_venues != expected_venues:
            missing = expected_venues - actual_venues
            extra = actual_venues - expected_venues
            return False, f"Venue mismatch. Missing: {missing}, Extra: {extra}"
        
        # Verify structure of each venue
        required_fields = ['venue_id', 'venue_code', 'venue_name', 'capacity', 'validated', 
                          'pre_reserved', 'waitlist', 'total_reserved', 'available', 'is_full']
        
        for venue_id, venue_data in data.items():
            for field in required_fields:
                if field not in venue_data:
                    return False, f"Missing field '{field}' in {venue_id}"
        
        return True, f"4 active venues with complete structure: {', '.join(venue_ids)}"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 2: GET /api/venues/availability - Faaa Venue Values
# ============================================================================

def test_venues_availability_faaa():
    """Test Faaa venue availability values"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        data = response.json()
        
        faaa = data.get('venue-faaa')
        if not faaa:
            return False, "venue-faaa not found in response"
        
        # Expected values for Faaa
        expected = {
            'capacity': 16,
            'validated': 0,
            'pre_reserved': 0,
            'waitlist': 0,
            'total_reserved': 0,
            'available': 16,
            'is_full': False
        }
        
        errors = []
        for key, expected_val in expected.items():
            actual_val = faaa.get(key)
            if actual_val != expected_val:
                errors.append(f"{key}: expected {expected_val}, got {actual_val}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, f"Faaa: {faaa['capacity']} capacity, {faaa['available']} available, is_full={faaa['is_full']}"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 3: GET /api/venues/availability - Punaauia Venue Values
# ============================================================================

def test_venues_availability_punaauia():
    """Test Punaauia venue availability values"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        data = response.json()
        
        pun = data.get('venue-pun')
        if not pun:
            return False, "venue-pun not found in response"
        
        # Expected values for Punaauia
        expected = {
            'capacity': 13,
            'validated': 0,
            'pre_reserved': 0,
            'waitlist': 0,
            'total_reserved': 0,
            'available': 13,
            'is_full': False
        }
        
        errors = []
        for key, expected_val in expected.items():
            actual_val = pun.get(key)
            if actual_val != expected_val:
                errors.append(f"{key}: expected {expected_val}, got {actual_val}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, f"Punaauia: {pun['capacity']} capacity, {pun['available']} available, is_full={pun['is_full']}"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 4: GET /api/venues/availability - Arue Venue Values (with pre-reserved)
# ============================================================================

def test_venues_availability_arue():
    """Test Arue venue availability values (should have 1 pre-reserved)"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        data = response.json()
        
        aru = data.get('venue-aru')
        if not aru:
            return False, "venue-aru not found in response"
        
        # Expected values for Arue (has 1 pre-reserved for I Mua Papeete)
        expected = {
            'capacity': 12,
            'validated': 0,
            'pre_reserved': 1,
            'waitlist': 0,
            'total_reserved': 1,
            'available': 11,
            'is_full': False
        }
        
        errors = []
        for key, expected_val in expected.items():
            actual_val = aru.get(key)
            if actual_val != expected_val:
                errors.append(f"{key}: expected {expected_val}, got {actual_val}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, f"Arue: {aru['capacity']} capacity, {aru['pre_reserved']} pre-reserved, {aru['available']} available"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 5: GET /api/venues/availability - Taravao Venue Values
# ============================================================================

def test_venues_availability_taravao():
    """Test Taravao venue availability values"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        data = response.json()
        
        tar = data.get('venue-tar')
        if not tar:
            return False, "venue-tar not found in response"
        
        # Expected values for Taravao
        expected = {
            'capacity': 12,
            'validated': 0,
            'pre_reserved': 0,
            'waitlist': 0,
            'total_reserved': 0,
            'available': 12,
            'is_full': False
        }
        
        errors = []
        for key, expected_val in expected.items():
            actual_val = tar.get(key)
            if actual_val != expected_val:
                errors.append(f"{key}: expected {expected_val}, got {actual_val}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, f"Taravao: {tar['capacity']} capacity, {tar['available']} available, is_full={tar['is_full']}"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 6: GET /api/venues/availability - Calculation Coherence
# ============================================================================

def test_venues_availability_calculations():
    """Test that total_reserved = validated + pre_reserved and available = capacity - total_reserved"""
    try:
        response = requests.get(f"{API_BASE}/venues/availability", timeout=10)
        data = response.json()
        
        errors = []
        for venue_id, venue_data in data.items():
            # Check total_reserved calculation
            expected_total = venue_data['validated'] + venue_data['pre_reserved']
            if venue_data['total_reserved'] != expected_total:
                errors.append(f"{venue_id}: total_reserved={venue_data['total_reserved']}, expected {expected_total}")
            
            # Check available calculation
            expected_available = max(0, venue_data['capacity'] - venue_data['total_reserved'])
            if venue_data['available'] != expected_available:
                errors.append(f"{venue_id}: available={venue_data['available']}, expected {expected_available}")
            
            # Check is_full logic
            expected_full = venue_data['capacity'] > 0 and venue_data['total_reserved'] >= venue_data['capacity']
            if venue_data['is_full'] != expected_full:
                errors.append(f"{venue_id}: is_full={venue_data['is_full']}, expected {expected_full}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, "All calculations coherent across 4 venues"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 7: GET /api/venues/venue-faaa/stands - No Assignments (seed filtered)
# ============================================================================

def test_faaa_stands_no_assignments():
    """Test that Faaa stands have NO assignments (all seed assignments filtered)"""
    try:
        headers = {'x-user-role': 'aracom_admin'}
        response = requests.get(f"{API_BASE}/venues/venue-faaa/stands", headers=headers, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not isinstance(data, list):
            return False, f"Expected array, got {type(data).__name__}"
        
        # Should have 16 stands
        if len(data) != 16:
            return False, f"Expected 16 stands, got {len(data)}"
        
        # Count stands with assignments
        assigned_stands = [s for s in data if s.get('assignment') is not None]
        
        if len(assigned_stands) > 0:
            stand_codes = [s.get('stand_code') for s in assigned_stands]
            return False, f"Expected 0 assignments, got {len(assigned_stands)}: {stand_codes}"
        
        return True, f"16 stands, 0 with assignments (seed filtered correctly)"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 8: GET /api/venues/venue-aru/stands - Exactly 1 Assignment (A-C01)
# ============================================================================

def test_arue_stands_one_assignment():
    """Test that Arue stands have EXACTLY 1 assignment (A-C01 for I Mua Papeete)"""
    try:
        headers = {'x-user-role': 'aracom_admin'}
        response = requests.get(f"{API_BASE}/venues/venue-aru/stands", headers=headers, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not isinstance(data, list):
            return False, f"Expected array, got {type(data).__name__}"
        
        # Should have 12 stands
        if len(data) != 12:
            return False, f"Expected 12 stands, got {len(data)}"
        
        # Count stands with assignments
        assigned_stands = [s for s in data if s.get('assignment') is not None]
        
        if len(assigned_stands) != 1:
            stand_codes = [s.get('stand_code') for s in assigned_stands]
            return False, f"Expected 1 assignment, got {len(assigned_stands)}: {stand_codes}"
        
        # Verify it's A-C01
        assigned_stand = assigned_stands[0]
        if assigned_stand.get('stand_code') != 'A-C01':
            return False, f"Expected A-C01, got {assigned_stand.get('stand_code')}"
        
        # Verify organization name contains "I Mua Papeete"
        org_name = assigned_stand.get('organization', {}).get('name', '')
        if 'I Mua Papeete' not in org_name:
            return False, f"Expected 'I Mua Papeete', got '{org_name}'"
        
        return True, f"12 stands, 1 assignment: {assigned_stand.get('stand_code')} ({org_name})"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 9: GET /api/venues/venue-pun/stands - No Assignments
# ============================================================================

def test_punaauia_stands_no_assignments():
    """Test that Punaauia stands have NO assignments"""
    try:
        headers = {'x-user-role': 'aracom_admin'}
        response = requests.get(f"{API_BASE}/venues/venue-pun/stands", headers=headers, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not isinstance(data, list):
            return False, f"Expected array, got {type(data).__name__}"
        
        # Should have 13 stands
        if len(data) != 13:
            return False, f"Expected 13 stands, got {len(data)}"
        
        # Count stands with assignments
        assigned_stands = [s for s in data if s.get('assignment') is not None]
        
        if len(assigned_stands) > 0:
            stand_codes = [s.get('stand_code') for s in assigned_stands]
            return False, f"Expected 0 assignments, got {len(assigned_stands)}: {stand_codes}"
        
        return True, f"13 stands, 0 with assignments"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# TEST 10: GET /api/venues/venue-tar/stands - No Assignments
# ============================================================================

def test_taravao_stands_no_assignments():
    """Test that Taravao stands have NO assignments"""
    try:
        headers = {'x-user-role': 'aracom_admin'}
        response = requests.get(f"{API_BASE}/venues/venue-tar/stands", headers=headers, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not isinstance(data, list):
            return False, f"Expected array, got {type(data).__name__}"
        
        # Should have 12 stands
        if len(data) != 12:
            return False, f"Expected 12 stands, got {len(data)}"
        
        # Count stands with assignments
        assigned_stands = [s for s in data if s.get('assignment') is not None]
        
        if len(assigned_stands) > 0:
            stand_codes = [s.get('stand_code') for s in assigned_stands]
            return False, f"Expected 0 assignments, got {len(assigned_stands)}: {stand_codes}"
        
        return True, f"12 stands, 0 with assignments"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# NON-REGRESSION TESTS
# ============================================================================

def test_venues_only_active():
    """Test GET /api/venues?only_active=1 returns 4 venues"""
    try:
        response = requests.get(f"{API_BASE}/venues?only_active=1", timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not isinstance(data, list):
            return False, f"Expected array, got {type(data).__name__}"
        
        if len(data) != 4:
            venue_names = [v.get('name') for v in data]
            return False, f"Expected 4 venues, got {len(data)}: {venue_names}"
        
        return True, f"4 active venues returned"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_menu_badges():
    """Test GET /api/menu-badges returns 200"""
    try:
        response = requests.get(f"{API_BASE}/menu-badges", timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        return True, "Menu badges endpoint working"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_validation_queue():
    """Test GET /api/admin/validation-queue returns 200"""
    try:
        headers = {'x-user-role': 'aracom_admin'}
        response = requests.get(f"{API_BASE}/admin/validation-queue", headers=headers, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        return True, "Validation queue endpoint working"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_validation_requests():
    """Test GET /api/validation-requests returns 200 and includes I Mua Papeete"""
    try:
        response = requests.get(f"{API_BASE}/validation-requests", timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check if I Mua Papeete appears in the list
        found = False
        for item in data:
            org_name = item.get('organization', {}).get('name', '')
            venue_name = item.get('venue', {}).get('name', '')
            if 'I Mua Papeete' in org_name and 'Arue' in venue_name:
                found = True
                break
        
        if not found:
            return False, "I Mua Papeete on Arue not found in validation requests"
        
        return True, "Validation requests includes I Mua Papeete on Arue"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_registrations():
    """Test GET /api/registrations returns 200"""
    try:
        response = requests.get(f"{API_BASE}/registrations", timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        return True, "Registrations endpoint working"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

def test_admin_login():
    """Test POST /api/auth/password-login with admin credentials"""
    try:
        payload = {
            'email': ADMIN_EMAIL,
            'password': ADMIN_PASSWORD
        }
        response = requests.post(f"{API_BASE}/auth/password-login", json=payload, timeout=10)
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not data.get('ok'):
            return False, f"Login failed: {data.get('error')}"
        
        if data.get('user', {}).get('role_code') != 'aracom_admin':
            return False, f"Expected role aracom_admin, got {data.get('user', {}).get('role_code')}"
        
        return True, f"Admin login successful, role={data.get('user', {}).get('role_code')}"
    
    except Exception as e:
        return False, f"Exception: {str(e)}"

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all tests"""
    print(f"\n{BLUE}SESSION 48y — Backend Test Suite{RESET}")
    print(f"{BLUE}Testing: {API_BASE}{RESET}\n")
    
    # Test 1: New endpoint /api/venues/availability
    print_section("TEST GROUP 1: GET /api/venues/availability - New Endpoint")
    run_test("1.1 Structure and Active Venues Only (4 venues)", test_venues_availability_structure)
    run_test("1.2 Faaa Venue Values", test_venues_availability_faaa)
    run_test("1.3 Punaauia Venue Values", test_venues_availability_punaauia)
    run_test("1.4 Arue Venue Values (with pre-reserved)", test_venues_availability_arue)
    run_test("1.5 Taravao Venue Values", test_venues_availability_taravao)
    run_test("1.6 Calculation Coherence", test_venues_availability_calculations)
    
    # Test 2: Modified endpoint /api/venues/:id/stands
    print_section("TEST GROUP 2: GET /api/venues/:id/stands - Seed Filtering")
    run_test("2.1 Faaa Stands - No Assignments (seed filtered)", test_faaa_stands_no_assignments)
    run_test("2.2 Arue Stands - Exactly 1 Assignment (A-C01)", test_arue_stands_one_assignment)
    run_test("2.3 Punaauia Stands - No Assignments", test_punaauia_stands_no_assignments)
    run_test("2.4 Taravao Stands - No Assignments", test_taravao_stands_no_assignments)
    
    # Test 3: Non-regression
    print_section("TEST GROUP 3: Non-Regression Checks")
    run_test("3.1 GET /api/venues?only_active=1", test_venues_only_active)
    run_test("3.2 GET /api/menu-badges", test_menu_badges)
    run_test("3.3 GET /api/admin/validation-queue", test_validation_queue)
    run_test("3.4 GET /api/validation-requests", test_validation_requests)
    run_test("3.5 GET /api/registrations", test_registrations)
    run_test("3.6 POST /api/auth/password-login (admin)", test_admin_login)
    
    # Summary
    print_section("TEST SUMMARY")
    pass_rate = (tests_passed / tests_run * 100) if tests_run > 0 else 0
    print(f"Total Tests: {tests_run}")
    print(f"Passed: {GREEN}{tests_passed}{RESET}")
    print(f"Failed: {RED}{tests_run - tests_passed}{RESET}")
    print(f"Pass Rate: {GREEN if pass_rate == 100 else YELLOW}{pass_rate:.1f}%{RESET}\n")
    
    if tests_passed == tests_run:
        print(f"{GREEN}{'='*80}{RESET}")
        print(f"{GREEN}ALL TESTS PASSED ✅{RESET}")
        print(f"{GREEN}{'='*80}{RESET}\n")
        return 0
    else:
        print(f"{RED}{'='*80}{RESET}")
        print(f"{RED}SOME TESTS FAILED ❌{RESET}")
        print(f"{RED}{'='*80}{RESET}\n")
        return 1

if __name__ == "__main__":
    exit(main())
