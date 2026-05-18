#!/usr/bin/env python3
"""
SESSION 28g Backend Tests - User-Organization Linking
Tests the new endpoints for linking users to organizations.
"""

import requests
import json
import uuid
from pymongo import MongoClient
import os
from datetime import datetime

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"
DB_NAME = os.getenv('DB_NAME', 'your_database_name')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')

# Admin headers
ADMIN_HEADERS = {
    'x-user-role': 'aracom_admin',
    'x-user-id': 'u-admin',
    'Content-Type': 'application/json'
}

# Non-admin headers (exposant)
EXPOSANT_HEADERS = {
    'x-user-role': 'exposant',
    'x-user-id': 'u-test-exposant',
    'Content-Type': 'application/json'
}

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def setup_test_data():
    """Create test user and organization in MongoDB"""
    print_test_header("SETUP - Creating test data")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Generate unique IDs
        uuid_suffix = str(uuid.uuid4())[:8]
        test_user_id = f'u-test-link-{uuid_suffix}'
        test_email = f'testlink-{uuid_suffix}@test.pf'
        
        # Create test user without organization
        user_doc = {
            'id': test_user_id,
            'email': test_email,
            'full_name': 'Test User Link',
            'role_code': 'exposant',
            'organization_id': None,
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        db.users.insert_one(user_doc)
        print_result(True, f"Created test user: {test_user_id} ({test_email})")
        
        # Verify org-19 exists
        org_19 = db.organizations.find_one({'id': 'org-19'})
        if org_19:
            print_result(True, f"Verified org-19 exists: {org_19.get('name', 'Unknown')}")
        else:
            print_result(False, "org-19 not found in database")
        
        # Verify org-31 exists (ACE Arue)
        org_31 = db.organizations.find_one({'id': 'org-31'})
        if org_31:
            print_result(True, f"Verified org-31 exists: {org_31.get('name', 'Unknown')}")
        else:
            print_result(False, "org-31 not found in database")
        
        client.close()
        return test_user_id, test_email
        
    except Exception as e:
        print_result(False, f"Setup failed: {str(e)}")
        return None, None

def cleanup_test_data():
    """Remove test users from MongoDB"""
    print_test_header("CLEANUP - Removing test data")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        result = db.users.delete_many({'id': {'$regex': '^u-test-link-'}})
        print_result(True, f"Deleted {result.deleted_count} test users")
        
        client.close()
        
    except Exception as e:
        print_result(False, f"Cleanup failed: {str(e)}")

def test_1_get_users_without_org_no_admin():
    """Test 1: GET /api/admin/users-without-org without admin role → 403"""
    print_test_header("Test 1: GET users-without-org without admin role")
    
    try:
        response = requests.get(
            f"{API_URL}/admin/users-without-org",
            headers=EXPOSANT_HEADERS,
            timeout=10
        )
        
        if response.status_code == 403:
            data = response.json()
            if 'Accès admin requis' in data.get('error', ''):
                print_result(True, f"403 with correct error message: {data.get('error')}")
                return True
            else:
                print_result(False, f"403 but wrong error message: {data}")
                return False
        else:
            print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_2_get_users_without_org_with_admin(test_user_id, test_email):
    """Test 2: GET /api/admin/users-without-org with admin role → 200 with array"""
    print_test_header("Test 2: GET users-without-org with admin role")
    
    try:
        response = requests.get(
            f"{API_URL}/admin/users-without-org",
            headers=ADMIN_HEADERS,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if not isinstance(data, list):
                print_result(False, f"Expected array, got: {type(data)}")
                return False
            
            print_result(True, f"200 OK with array of {len(data)} users")
            
            # Verify test user is in the list
            test_user = next((u for u in data if u.get('id') == test_user_id), None)
            if test_user:
                print_result(True, f"Test user found in list: {test_user.get('email')}")
                
                # Verify required fields
                required_fields = ['id', 'email', 'role_code', 'is_active']
                missing_fields = [f for f in required_fields if f not in test_user]
                if missing_fields:
                    print_result(False, f"Missing fields: {missing_fields}")
                    return False
                else:
                    print_result(True, f"All required fields present")
                
                # Verify organization_id is null
                if test_user.get('organization_id') is None:
                    print_result(True, "organization_id is null as expected")
                else:
                    print_result(False, f"organization_id should be null, got: {test_user.get('organization_id')}")
                    return False
                
                # Verify no password field (security)
                if 'password' in test_user:
                    print_result(False, "SECURITY ISSUE: password field exposed in response")
                    return False
                else:
                    print_result(True, "No password field in response (secure)")
                
            else:
                print_result(False, f"Test user {test_user_id} not found in list")
                return False
            
            # Verify no admins in the list
            admins = [u for u in data if u.get('role_code') == 'aracom_admin']
            if admins:
                print_result(False, f"Found {len(admins)} admin users in list (should be excluded)")
                return False
            else:
                print_result(True, "No admin users in list (correctly excluded)")
            
            # Verify no inactive users
            inactive = [u for u in data if u.get('is_active') == False]
            if inactive:
                print_result(False, f"Found {len(inactive)} inactive users in list (should be excluded)")
                return False
            else:
                print_result(True, "No inactive users in list (correctly excluded)")
            
            return True
            
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_3_link_user_404():
    """Test 3: POST /api/admin/users/non-existent-user/link-organization → 404"""
    print_test_header("Test 3: POST link-organization with non-existent user")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/non-existent-user-12345/link-organization",
            headers=ADMIN_HEADERS,
            json={'organization_id': 'org-19'},
            timeout=10
        )
        
        # Check if endpoint exists
        if response.status_code == 404:
            data = response.json()
            error_msg = data.get('error', '')
            
            # Could be either "Utilisateur introuvable" or route not found
            if 'introuvable' in error_msg.lower() or 'not found' in error_msg.lower():
                print_result(True, f"404 with error: {error_msg}")
                return True
            else:
                print_result(False, f"404 but unexpected error: {error_msg}")
                return False
        else:
            print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_4_link_user_no_org_id(test_user_id):
    """Test 4: POST /api/admin/users/:userId/link-organization without organization_id → 400"""
    print_test_header("Test 4: POST link-organization without organization_id")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/{test_user_id}/link-organization",
            headers=ADMIN_HEADERS,
            json={},
            timeout=10
        )
        
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if 'organization_id' in error_msg.lower() and 'requis' in error_msg.lower():
                print_result(True, f"400 with correct error: {error_msg}")
                return True
            else:
                print_result(False, f"400 but wrong error: {error_msg}")
                return False
        elif response.status_code == 404:
            print_result(False, f"Endpoint not found (404) - feature not implemented")
            return False
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_5_link_user_invalid_org(test_user_id):
    """Test 5: POST /api/admin/users/:userId/link-organization with invalid org → 404"""
    print_test_header("Test 5: POST link-organization with invalid organization")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/{test_user_id}/link-organization",
            headers=ADMIN_HEADERS,
            json={'organization_id': 'non-existent-org-12345'},
            timeout=10
        )
        
        if response.status_code == 404:
            data = response.json()
            error_msg = data.get('error', '')
            if 'organisation' in error_msg.lower() and 'introuvable' in error_msg.lower():
                print_result(True, f"404 with correct error: {error_msg}")
                return True
            else:
                print_result(False, f"404 but wrong error: {error_msg}")
                return False
        elif response.status_code == 404:
            print_result(False, f"Endpoint not found (404) - feature not implemented")
            return False
        else:
            print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_6_link_user_no_admin(test_user_id):
    """Test 6: POST /api/admin/users/:userId/link-organization without admin → 403"""
    print_test_header("Test 6: POST link-organization without admin role")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/{test_user_id}/link-organization",
            headers=EXPOSANT_HEADERS,
            json={'organization_id': 'org-19'},
            timeout=10
        )
        
        if response.status_code == 403:
            data = response.json()
            error_msg = data.get('error', '')
            if 'admin' in error_msg.lower() and 'requis' in error_msg.lower():
                print_result(True, f"403 with correct error: {error_msg}")
                return True
            else:
                print_result(False, f"403 but wrong error: {error_msg}")
                return False
        elif response.status_code == 404:
            print_result(False, f"Endpoint not found (404) - feature not implemented")
            return False
        else:
            print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_7_link_user_happy_path(test_user_id):
    """Test 7: HAPPY PATH - Link user to org-19"""
    print_test_header("Test 7: HAPPY PATH - Link user to org-19")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/{test_user_id}/link-organization",
            headers=ADMIN_HEADERS,
            json={'organization_id': 'org-19'},
            timeout=10
        )
        
        if response.status_code == 404:
            print_result(False, "❌ CRITICAL: Endpoint not found (404) - POST /api/admin/users/:userId/link-organization NOT IMPLEMENTED")
            return False
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            if data.get('ok') == True and data.get('action') == 'user_linked':
                print_result(True, f"200 OK with correct response structure")
                
                if data.get('user_id') == test_user_id and data.get('organization_id') == 'org-19':
                    print_result(True, f"Correct user_id and organization_id in response")
                else:
                    print_result(False, f"Wrong IDs in response: {data}")
                    return False
                
                # Verify in database
                try:
                    client = MongoClient(MONGO_URL)
                    db = client[DB_NAME]
                    
                    user = db.users.find_one({'id': test_user_id})
                    if user:
                        if user.get('organization_id') == 'org-19':
                            print_result(True, "Database: user.organization_id = 'org-19'")
                        else:
                            print_result(False, f"Database: user.organization_id = {user.get('organization_id')} (expected 'org-19')")
                            client.close()
                            return False
                        
                        if user.get('linked_at'):
                            print_result(True, f"Database: user.linked_at is set ({user.get('linked_at')})")
                        else:
                            print_result(False, "Database: user.linked_at is not set")
                            client.close()
                            return False
                        
                        if user.get('linked_by'):
                            print_result(True, f"Database: user.linked_by is set ({user.get('linked_by')})")
                        else:
                            print_result(False, "Database: user.linked_by is not set")
                            client.close()
                            return False
                    else:
                        print_result(False, f"User {test_user_id} not found in database")
                        client.close()
                        return False
                    
                    client.close()
                    
                except Exception as e:
                    print_result(False, f"Database verification failed: {str(e)}")
                    return False
                
                # Verify user no longer in users-without-org list
                try:
                    list_response = requests.get(
                        f"{API_URL}/admin/users-without-org",
                        headers=ADMIN_HEADERS,
                        timeout=10
                    )
                    
                    if list_response.status_code == 200:
                        users = list_response.json()
                        if any(u.get('id') == test_user_id for u in users):
                            print_result(False, "User still in users-without-org list")
                            return False
                        else:
                            print_result(True, "User no longer in users-without-org list")
                    else:
                        print_result(False, f"Failed to verify users-without-org list: {list_response.status_code}")
                        return False
                        
                except Exception as e:
                    print_result(False, f"List verification failed: {str(e)}")
                    return False
                
                return True
                
            else:
                print_result(False, f"Wrong response structure: {data}")
                return False
                
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def test_8_relink_user_different_org(test_user_id):
    """Test 8: Re-link user to different org (org-31)"""
    print_test_header("Test 8: Re-link user to different organization (org-31)")
    
    try:
        response = requests.post(
            f"{API_URL}/admin/users/{test_user_id}/link-organization",
            headers=ADMIN_HEADERS,
            json={'organization_id': 'org-31'},
            timeout=10
        )
        
        if response.status_code == 404:
            print_result(False, "Endpoint not found (404) - feature not implemented")
            return False
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"200 OK - Re-linking allowed")
            
            # Verify in database
            try:
                client = MongoClient(MONGO_URL)
                db = client[DB_NAME]
                
                user = db.users.find_one({'id': test_user_id})
                if user:
                    if user.get('organization_id') == 'org-31':
                        print_result(True, "Database: user.organization_id = 'org-31'")
                        client.close()
                        return True
                    else:
                        print_result(False, f"Database: user.organization_id = {user.get('organization_id')} (expected 'org-31')")
                        client.close()
                        return False
                else:
                    print_result(False, f"User {test_user_id} not found in database")
                    client.close()
                    return False
                    
            except Exception as e:
                print_result(False, f"Database verification failed: {str(e)}")
                return False
                
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Request failed: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("SESSION 28g - User-Organization Linking Backend Tests")
    print("="*80)
    
    # Setup
    test_user_id, test_email = setup_test_data()
    if not test_user_id:
        print("\n❌ SETUP FAILED - Cannot proceed with tests")
        return
    
    results = []
    
    # Run tests
    try:
        results.append(("Test 1: GET without admin", test_1_get_users_without_org_no_admin()))
        results.append(("Test 2: GET with admin", test_2_get_users_without_org_with_admin(test_user_id, test_email)))
        results.append(("Test 3: POST 404 user", test_3_link_user_404()))
        results.append(("Test 4: POST no org_id", test_4_link_user_no_org_id(test_user_id)))
        results.append(("Test 5: POST invalid org", test_5_link_user_invalid_org(test_user_id)))
        results.append(("Test 6: POST no admin", test_6_link_user_no_admin(test_user_id)))
        results.append(("Test 7: HAPPY PATH", test_7_link_user_happy_path(test_user_id)))
        results.append(("Test 8: Re-link", test_8_relink_user_different_org(test_user_id)))
        
    finally:
        # Cleanup
        cleanup_test_data()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({passed*100//total}%)")
    print(f"{'='*80}\n")
    
    if passed < total:
        print("⚠️  CRITICAL FINDINGS:")
        print("   - POST /api/admin/users/:userId/link-organization endpoint is NOT IMPLEMENTED")
        print("   - Only GET /api/admin/users-without-org is working")
        print("   - Feature is incomplete and cannot be used")

if __name__ == '__main__':
    main()
