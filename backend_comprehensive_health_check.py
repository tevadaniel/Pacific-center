#!/usr/bin/env python3
"""
COMPREHENSIVE BACKEND HEALTH CHECK - Forum Rentrée 2026 SaaS
Tests ALL critical backend endpoints and identifies broken/buggy functionality.
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

# Exposant headers
EXPOSANT_HEADERS = {
    'x-user-role': 'exposant',
    'x-user-id': 'u-exposant-test',
    'Content-Type': 'application/json'
}

# Test results tracking
test_results = {
    'working': [],
    'broken': [],
    'degraded': []
}

def print_section(title):
    print(f"\n{'='*100}")
    print(f"  {title}")
    print(f"{'='*100}")

def print_test(endpoint, method="GET"):
    print(f"\n[{method}] {endpoint}")

def record_result(endpoint, status, message, response_excerpt=None):
    """Record test result"""
    result = {
        'endpoint': endpoint,
        'message': message,
        'response': response_excerpt
    }
    
    if status == 'working':
        test_results['working'].append(result)
        print(f"  ✅ WORKING: {message}")
        if response_excerpt:
            print(f"     Sample: {json.dumps(response_excerpt, indent=2)[:200]}...")
    elif status == 'broken':
        test_results['broken'].append(result)
        print(f"  ❌ BROKEN: {message}")
    elif status == 'degraded':
        test_results['degraded'].append(result)
        print(f"  ⚠️  DEGRADED: {message}")

def safe_request(method, url, **kwargs):
    """Make HTTP request with error handling"""
    try:
        kwargs.setdefault('timeout', 15)
        response = getattr(requests, method.lower())(url, **kwargs)
        return response
    except requests.exceptions.Timeout:
        return None
    except Exception as e:
        print(f"  ❌ Request exception: {str(e)}")
        return None

# ============================================================================
# 1. PUBLIC/HEALTH ENDPOINTS
# ============================================================================

def test_public_health():
    print_section("1. PUBLIC/HEALTH ENDPOINTS")
    
    # GET / (root health)
    print_test("/", "GET")
    response = safe_request('get', BASE_URL)
    if response and response.status_code == 200:
        record_result("GET /", "working", f"Status {response.status_code}", {"content_length": len(response.text)})
    else:
        record_result("GET /", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/stats/public
    print_test("/api/stats/public", "GET")
    response = safe_request('get', f"{API_URL}/stats/public")
    if response and response.status_code == 200:
        try:
            data = response.json()
            record_result("GET /api/stats/public", "working", f"Status {response.status_code}", data)
        except:
            record_result("GET /api/stats/public", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/stats/public", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 2. AUTH ENDPOINTS
# ============================================================================

def test_auth():
    print_section("2. AUTH ENDPOINTS")
    
    # POST /api/auth/login (admin)
    print_test("/api/auth/login", "POST")
    response = safe_request('post', f"{API_URL}/auth/login", 
                           json={"email": "admin@aracom.pf", "password": "Projetaracom12"})
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('ok') and data.get('user'):
                record_result("POST /api/auth/login", "working", "Admin login successful", 
                            {"role": data['user'].get('role_code'), "redirect": data.get('redirect')})
            else:
                record_result("POST /api/auth/login", "degraded", "200 but missing expected fields", data)
        except:
            record_result("POST /api/auth/login", "degraded", "200 but invalid JSON")
    else:
        record_result("POST /api/auth/login", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/auth/me (with admin headers)
    print_test("/api/auth/me", "GET")
    response = safe_request('get', f"{API_URL}/auth/me", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('user'):
                record_result("GET /api/auth/me", "working", "Auth check successful", 
                            {"user_id": data['user'].get('id'), "role": data['user'].get('role_code')})
            else:
                record_result("GET /api/auth/me", "degraded", "200 but missing user field", data)
        except:
            record_result("GET /api/auth/me", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/auth/me", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # POST /api/auth/logout
    print_test("/api/auth/logout", "POST")
    response = safe_request('post', f"{API_URL}/auth/logout", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        record_result("POST /api/auth/logout", "working", f"Status {response.status_code}")
    else:
        record_result("POST /api/auth/logout", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 3. DASHBOARD & ANALYTICS
# ============================================================================

def test_dashboard():
    print_section("3. DASHBOARD & ANALYTICS")
    
    # GET /api/dashboard/kpis
    print_test("/api/dashboard/kpis", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/kpis", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if 'total' in data and 'by_status' in data:
                record_result("GET /api/dashboard/kpis", "working", "KPIs retrieved", 
                            {"total": data.get('total'), "cautions_recues": data.get('cautions_recues')})
            else:
                record_result("GET /api/dashboard/kpis", "degraded", "200 but missing expected fields", data)
        except:
            record_result("GET /api/dashboard/kpis", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/dashboard/kpis", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/dashboard/by-site
    print_test("/api/dashboard/by-site", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/by-site", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                record_result("GET /api/dashboard/by-site", "working", f"{len(data)} sites retrieved", 
                            {"first_site": data[0].get('venue_name'), "capacity": data[0].get('capacity_stands')})
            else:
                record_result("GET /api/dashboard/by-site", "degraded", "200 but empty or invalid data", data)
        except:
            record_result("GET /api/dashboard/by-site", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/dashboard/by-site", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/dashboard/jour-j-live
    print_test("/api/dashboard/jour-j-live?event_date=2026-08-14", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/jour-j-live?event_date=2026-08-14", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if 'totals' in data and 'by_site' in data:
                record_result("GET /api/dashboard/jour-j-live", "working", "Jour J data retrieved", 
                            {"total": data['totals'].get('total'), "present": data['totals'].get('present')})
            else:
                record_result("GET /api/dashboard/jour-j-live", "degraded", "200 but missing expected fields", data)
        except:
            record_result("GET /api/dashboard/jour-j-live", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/dashboard/jour-j-live", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/dashboard/analytics
    print_test("/api/dashboard/analytics", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/analytics", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        record_result("GET /api/dashboard/analytics", "working", f"Status {response.status_code}")
    else:
        record_result("GET /api/dashboard/analytics", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/dashboard/extended
    print_test("/api/dashboard/extended", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/extended", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        record_result("GET /api/dashboard/extended", "working", f"Status {response.status_code}")
    else:
        record_result("GET /api/dashboard/extended", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/dashboard/briefing
    print_test("/api/dashboard/briefing", "GET")
    response = safe_request('get', f"{API_URL}/dashboard/briefing", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        record_result("GET /api/dashboard/briefing", "working", f"Status {response.status_code}")
    else:
        record_result("GET /api/dashboard/briefing", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/alerts
    print_test("/api/alerts", "GET")
    response = safe_request('get', f"{API_URL}/alerts", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if 'anomalies_open' in data:
                record_result("GET /api/alerts", "working", "Alerts retrieved", 
                            {"anomalies_open": data.get('anomalies_open'), "tasks_open": data.get('tasks_open')})
            else:
                record_result("GET /api/alerts", "degraded", "200 but missing expected fields", data)
        except:
            record_result("GET /api/alerts", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/alerts", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 4. ORGANIZATIONS & REGISTRATIONS
# ============================================================================

def test_organizations_registrations():
    print_section("4. ORGANIZATIONS & REGISTRATIONS")
    
    # GET /api/organizations
    print_test("/api/organizations", "GET")
    response = safe_request('get', f"{API_URL}/organizations", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/organizations", "working", f"{len(data)} organizations retrieved", 
                            {"first_org": data[0].get('name') if data else None})
            else:
                record_result("GET /api/organizations", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/organizations", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/organizations", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/organizations?include_archived=true
    print_test("/api/organizations?include_archived=true", "GET")
    response = safe_request('get', f"{API_URL}/organizations?include_archived=true", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            record_result("GET /api/organizations?include_archived=true", "working", f"{len(data)} orgs (with archived)")
        except:
            record_result("GET /api/organizations?include_archived=true", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/organizations?include_archived=true", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/registrations
    print_test("/api/registrations", "GET")
    response = safe_request('get', f"{API_URL}/registrations", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/registrations", "working", f"{len(data)} registrations retrieved", 
                            {"first_reg": data[0].get('id') if data else None})
            else:
                record_result("GET /api/registrations", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/registrations", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/registrations", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/registrations/reg-arue-A-C02 (specific reg)
    print_test("/api/registrations/reg-arue-A-C02", "GET")
    response = safe_request('get', f"{API_URL}/registrations/reg-arue-A-C02", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('id') == 'reg-arue-A-C02':
                record_result("GET /api/registrations/reg-arue-A-C02", "working", "Registration details retrieved", 
                            {"status": data.get('status'), "stand_code": data.get('stand_code')})
            else:
                record_result("GET /api/registrations/reg-arue-A-C02", "degraded", "200 but wrong registration", data)
        except:
            record_result("GET /api/registrations/reg-arue-A-C02", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/registrations/reg-arue-A-C02", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/venues
    print_test("/api/venues", "GET")
    response = safe_request('get', f"{API_URL}/venues", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/venues", "working", f"{len(data)} venues retrieved", 
                            {"first_venue": data[0].get('name') if data else None})
            else:
                record_result("GET /api/venues", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/venues", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/venues", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/venues/venue-aru/stands
    print_test("/api/venues/venue-aru/stands", "GET")
    response = safe_request('get', f"{API_URL}/venues/venue-aru/stands", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/venues/venue-aru/stands", "working", f"{len(data)} stands retrieved")
            else:
                record_result("GET /api/venues/venue-aru/stands", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/venues/venue-aru/stands", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/venues/venue-aru/stands", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 5. EXPOSANT PORTAL
# ============================================================================

def test_exposant_portal():
    print_section("5. EXPOSANT PORTAL")
    
    # GET /api/exposant/my-sites?organization_id=org-3
    print_test("/api/exposant/my-sites?organization_id=org-3", "GET")
    response = safe_request('get', f"{API_URL}/exposant/my-sites?organization_id=org-3", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                # Check for new fields: validation_request, can_submit
                has_new_fields = False
                if data:
                    first_site = data[0]
                    has_new_fields = 'validation_request' in first_site and 'can_submit' in first_site
                
                if has_new_fields:
                    record_result("GET /api/exposant/my-sites", "working", 
                                f"{len(data)} sites with validation_request and can_submit fields", 
                                {"validation_request": first_site.get('validation_request'), 
                                 "can_submit": first_site.get('can_submit')})
                else:
                    record_result("GET /api/exposant/my-sites", "degraded", 
                                f"{len(data)} sites but missing new fields (validation_request, can_submit)")
            else:
                record_result("GET /api/exposant/my-sites", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/exposant/my-sites", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/exposant/my-sites", "broken", f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 6. PDF GENERATION
# ============================================================================

def test_pdf_generation():
    print_section("6. PDF GENERATION")
    
    # GET /api/exposant/documents/convention/reg-arue-A-C02
    print_test("/api/exposant/documents/convention/reg-arue-A-C02", "GET")
    response = safe_request('get', f"{API_URL}/exposant/documents/convention/reg-arue-A-C02", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        content_type = response.headers.get('Content-Type', '')
        if 'application/pdf' in content_type:
            record_result("GET /api/exposant/documents/convention/reg-arue-A-C02", "working", 
                        f"PDF generated ({len(response.content)} bytes)", 
                        {"content_type": content_type})
        else:
            record_result("GET /api/exposant/documents/convention/reg-arue-A-C02", "degraded", 
                        f"200 but wrong content type: {content_type}")
    else:
        record_result("GET /api/exposant/documents/convention/reg-arue-A-C02", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/exposant/documents/guide/reg-arue-A-C02
    print_test("/api/exposant/documents/guide/reg-arue-A-C02", "GET")
    response = safe_request('get', f"{API_URL}/exposant/documents/guide/reg-arue-A-C02", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        content_type = response.headers.get('Content-Type', '')
        if 'application/pdf' in content_type:
            record_result("GET /api/exposant/documents/guide/reg-arue-A-C02", "working", 
                        f"PDF generated ({len(response.content)} bytes)")
        else:
            record_result("GET /api/exposant/documents/guide/reg-arue-A-C02", "degraded", 
                        f"200 but wrong content type: {content_type}")
    else:
        record_result("GET /api/exposant/documents/guide/reg-arue-A-C02", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/exposant/documents/questionnaire-blank
    print_test("/api/exposant/documents/questionnaire-blank", "GET")
    response = safe_request('get', f"{API_URL}/exposant/documents/questionnaire-blank", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        content_type = response.headers.get('Content-Type', '')
        if 'application/pdf' in content_type:
            record_result("GET /api/exposant/documents/questionnaire-blank", "working", 
                        f"PDF generated ({len(response.content)} bytes)")
        else:
            record_result("GET /api/exposant/documents/questionnaire-blank", "degraded", 
                        f"200 but wrong content type: {content_type}")
    else:
        record_result("GET /api/exposant/documents/questionnaire-blank", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 7. ADMIN OVERRIDE ENDPOINTS
# ============================================================================

def test_admin_override():
    print_section("7. ADMIN OVERRIDE ENDPOINTS")
    
    # POST /api/admin/registrations/reg-arue-A-C02/reset-caution
    print_test("/api/admin/registrations/reg-arue-A-C02/reset-caution", "POST")
    response = safe_request('post', f"{API_URL}/admin/registrations/reg-arue-A-C02/reset-caution", 
                           headers=ADMIN_HEADERS, json={})
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('ok'):
                record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-caution", "working", 
                            "Caution reset successful", {"action": data.get('action')})
            else:
                record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-caution", "degraded", 
                            "200 but ok=false", data)
        except:
            record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-caution", "degraded", 
                        "200 but invalid JSON")
    else:
        record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-caution", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # POST /api/admin/registrations/reg-arue-A-C02/reset-virement
    print_test("/api/admin/registrations/reg-arue-A-C02/reset-virement", "POST")
    response = safe_request('post', f"{API_URL}/admin/registrations/reg-arue-A-C02/reset-virement", 
                           headers=ADMIN_HEADERS, json={})
    if response and response.status_code == 200:
        try:
            data = response.json()
            record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-virement", "working", 
                        "Virement reset successful", {"action": data.get('action')})
        except:
            record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-virement", "degraded", 
                        "200 but invalid JSON")
    else:
        record_result("POST /api/admin/registrations/reg-arue-A-C02/reset-virement", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature
    print_test("/api/admin/registrations/reg-arue-A-C02/unlock-candidature", "POST")
    response = safe_request('post', f"{API_URL}/admin/registrations/reg-arue-A-C02/unlock-candidature", 
                           headers=ADMIN_HEADERS, json={})
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('ok') and data.get('action') == 'candidature_unlocked':
                record_result("POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature", "working", 
                            "Candidature unlocked successfully", data)
            else:
                record_result("POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature", "degraded", 
                            "200 but unexpected response", data)
        except:
            record_result("POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature", "degraded", 
                        "200 but invalid JSON")
    else:
        record_result("POST /api/admin/registrations/reg-arue-A-C02/unlock-candidature", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 8. USERS WITHOUT ORG
# ============================================================================

def test_users_without_org():
    print_section("8. USERS WITHOUT ORG")
    
    # GET /api/admin/users-without-org
    print_test("/api/admin/users-without-org", "GET")
    response = safe_request('get', f"{API_URL}/admin/users-without-org", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/admin/users-without-org", "working", 
                            f"{len(data)} users without organization", 
                            {"count": len(data)})
            else:
                record_result("GET /api/admin/users-without-org", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/admin/users-without-org", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/admin/users-without-org", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 9. NEW ENDPOINTS (SESSION 28)
# ============================================================================

def test_session_28_endpoints():
    print_section("9. NEW ENDPOINTS (SESSION 28)")
    
    # POST /api/admin/organizations/org-19/initialize-registration
    print_test("/api/admin/organizations/org-19/initialize-registration", "POST")
    response = safe_request('post', f"{API_URL}/admin/organizations/org-19/initialize-registration", 
                           headers=ADMIN_HEADERS, json={})
    if response and response.status_code in [200, 201, 409]:
        try:
            data = response.json()
            record_result("POST /api/admin/organizations/org-19/initialize-registration", "working", 
                        f"Status {response.status_code}", data)
        except:
            record_result("POST /api/admin/organizations/org-19/initialize-registration", "degraded", 
                        f"Status {response.status_code} but invalid JSON")
    else:
        record_result("POST /api/admin/organizations/org-19/initialize-registration", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # POST /api/admin/auto-repair/initialize-all-missing-registrations
    print_test("/api/admin/auto-repair/initialize-all-missing-registrations", "POST")
    response = safe_request('post', f"{API_URL}/admin/auto-repair/initialize-all-missing-registrations", 
                           headers=ADMIN_HEADERS, json={})
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data.get('ok') and 'created' in data:
                record_result("POST /api/admin/auto-repair/initialize-all-missing-registrations", "working", 
                            "Auto-repair completed (idempotent)", 
                            {"created": data.get('created'), "already_ok": data.get('already_ok')})
            else:
                record_result("POST /api/admin/auto-repair/initialize-all-missing-registrations", "degraded", 
                            "200 but unexpected response", data)
        except:
            record_result("POST /api/admin/auto-repair/initialize-all-missing-registrations", "degraded", 
                        "200 but invalid JSON")
    else:
        record_result("POST /api/admin/auto-repair/initialize-all-missing-registrations", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # POST /api/admin/users/{user-id}/link-organization
    print_test("/api/admin/users/non-existent-user/link-organization", "POST")
    response = safe_request('post', f"{API_URL}/admin/users/non-existent-user/link-organization", 
                           headers=ADMIN_HEADERS, json={"organization_id": "org-19"})
    if response and response.status_code == 404:
        try:
            data = response.json()
            if 'introuvable' in data.get('error', '').lower():
                record_result("POST /api/admin/users/:userId/link-organization", "working", 
                            "Endpoint exists (404 for non-existent user)", data)
            else:
                record_result("POST /api/admin/users/:userId/link-organization", "degraded", 
                            "404 but unexpected error message", data)
        except:
            record_result("POST /api/admin/users/:userId/link-organization", "degraded", 
                        "404 but invalid JSON")
    else:
        record_result("POST /api/admin/users/:userId/link-organization", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'} (expected 404 for test)")

# ============================================================================
# 10. MAILING & SCHEDULER
# ============================================================================

def test_mailing():
    print_section("10. MAILING & SCHEDULER")
    
    # GET /api/mailing/status
    print_test("/api/mailing/status", "GET")
    response = safe_request('get', f"{API_URL}/mailing/status", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            record_result("GET /api/mailing/status", "working", "Mailing status retrieved", data)
        except:
            record_result("GET /api/mailing/status", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/mailing/status", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")
    
    # GET /api/mailing/scheduled
    print_test("/api/mailing/scheduled", "GET")
    response = safe_request('get', f"{API_URL}/mailing/scheduled", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            record_result("GET /api/mailing/scheduled", "working", "Scheduled mailings retrieved", data)
        except:
            record_result("GET /api/mailing/scheduled", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/mailing/scheduled", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 11. VALIDATION FLOW
# ============================================================================

def test_validation_flow():
    print_section("11. VALIDATION FLOW")
    
    # First, get a registration to test with
    response = safe_request('get', f"{API_URL}/registrations", headers=ADMIN_HEADERS)
    test_reg_id = None
    if response and response.status_code == 200:
        try:
            data = response.json()
            if data and len(data) > 0:
                # Find a registration that's not locked
                for reg in data:
                    if not reg.get('candidature_locked'):
                        test_reg_id = reg.get('id')
                        break
        except:
            pass
    
    if test_reg_id:
        # POST /api/registrations/{id}/request-validation
        print_test(f"/api/registrations/{test_reg_id}/request-validation", "POST")
        response = safe_request('post', f"{API_URL}/registrations/{test_reg_id}/request-validation", 
                               headers=ADMIN_HEADERS, 
                               json={"preferred_payment": "cheque", "rdv_proposal": "", "notes": "Test validation"})
        if response and response.status_code == 200:
            try:
                data = response.json()
                if data.get('ok') and data.get('validation_request_id'):
                    record_result(f"POST /api/registrations/{test_reg_id}/request-validation", "working", 
                                "Validation request created (sets candidature_locked)", 
                                {"validation_request_id": data.get('validation_request_id')})
                else:
                    record_result(f"POST /api/registrations/{test_reg_id}/request-validation", "degraded", 
                                "200 but unexpected response", data)
            except:
                record_result(f"POST /api/registrations/{test_reg_id}/request-validation", "degraded", 
                            "200 but invalid JSON")
        else:
            record_result(f"POST /api/registrations/{test_reg_id}/request-validation", "broken", 
                        f"Status {response.status_code if response else 'TIMEOUT'}")
    else:
        record_result("POST /api/registrations/:id/request-validation", "broken", 
                    "No unlocked registration found for testing")

# ============================================================================
# 12. ATTENDANCE (JOUR J)
# ============================================================================

def test_attendance():
    print_section("12. ATTENDANCE (JOUR J)")
    
    # GET /api/attendance?event_date=2026-08-14
    print_test("/api/attendance?event_date=2026-08-14", "GET")
    response = safe_request('get', f"{API_URL}/attendance?event_date=2026-08-14", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/attendance?event_date=2026-08-14", "working", 
                            f"{len(data)} attendance sessions retrieved", 
                            {"count": len(data)})
            else:
                record_result("GET /api/attendance?event_date=2026-08-14", "degraded", 
                            "200 but not an array", data)
        except:
            record_result("GET /api/attendance?event_date=2026-08-14", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/attendance?event_date=2026-08-14", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# 13. ANIMATIONS
# ============================================================================

def test_animations():
    print_section("13. ANIMATIONS")
    
    # GET /api/animation-slots
    print_test("/api/animation-slots", "GET")
    response = safe_request('get', f"{API_URL}/animation-slots", headers=ADMIN_HEADERS)
    if response and response.status_code == 200:
        try:
            data = response.json()
            if isinstance(data, list):
                record_result("GET /api/animation-slots", "working", 
                            f"{len(data)} animation slots retrieved", 
                            {"count": len(data)})
            else:
                record_result("GET /api/animation-slots", "degraded", "200 but not an array", data)
        except:
            record_result("GET /api/animation-slots", "degraded", "200 but invalid JSON")
    else:
        record_result("GET /api/animation-slots", "broken", 
                    f"Status {response.status_code if response else 'TIMEOUT'}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def print_final_report():
    """Print comprehensive final report"""
    print_section("COMPREHENSIVE BACKEND HEALTH CHECK REPORT")
    
    total_tests = len(test_results['working']) + len(test_results['broken']) + len(test_results['degraded'])
    
    print(f"\n📊 SUMMARY:")
    print(f"   Total endpoints tested: {total_tests}")
    print(f"   ✅ Working: {len(test_results['working'])}")
    print(f"   ❌ Broken: {len(test_results['broken'])}")
    print(f"   ⚠️  Degraded: {len(test_results['degraded'])}")
    
    if test_results['working']:
        print(f"\n✅ WORKING ENDPOINTS ({len(test_results['working'])}):")
        for result in test_results['working']:
            print(f"   • {result['endpoint']}: {result['message']}")
    
    if test_results['degraded']:
        print(f"\n⚠️  DEGRADED ENDPOINTS ({len(test_results['degraded'])}):")
        for result in test_results['degraded']:
            print(f"   • {result['endpoint']}: {result['message']}")
    
    if test_results['broken']:
        print(f"\n❌ BROKEN ENDPOINTS ({len(test_results['broken'])}) - PRIORITY ORDER:")
        for i, result in enumerate(test_results['broken'], 1):
            print(f"   {i}. {result['endpoint']}: {result['message']}")
    
    print(f"\n{'='*100}")
    print(f"HEALTH CHECK COMPLETE")
    print(f"{'='*100}\n")

def main():
    print("\n" + "="*100)
    print("  COMPREHENSIVE BACKEND HEALTH CHECK - Forum Rentrée 2026")
    print("  Testing ALL critical backend endpoints")
    print("="*100)
    
    # Run all test suites
    test_public_health()
    test_auth()
    test_dashboard()
    test_organizations_registrations()
    test_exposant_portal()
    test_pdf_generation()
    test_admin_override()
    test_users_without_org()
    test_session_28_endpoints()
    test_mailing()
    test_validation_flow()
    test_attendance()
    test_animations()
    
    # Print final report
    print_final_report()

if __name__ == '__main__':
    main()
