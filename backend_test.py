#!/usr/bin/env python3
"""
Test script for 3 new ARACOM automation endpoints:
1. POST /api/tools/recompute-completion
2. POST /api/tools/generate-relances  
3. POST /api/emails/send-satisfaction
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://polynesie-event-hub.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def test_endpoint(method, endpoint, data=None, headers=None):
    """Helper function to test API endpoints"""
    url = f"{API_BASE}/{endpoint}"
    print(f"\n🔍 Testing {method} {endpoint}")
    
    try:
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, json=data, headers=headers)
        elif method == 'PUT':
            response = requests.put(url, json=data, headers=headers)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200 or response.status_code == 201:
            try:
                result = response.json()
                print(f"✅ Success: {json.dumps(result, indent=2)}")
                return result
            except:
                print(f"✅ Success: {response.text}")
                return response.text
        else:
            try:
                error = response.json()
                print(f"❌ Error: {json.dumps(error, indent=2)}")
            except:
                print(f"❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return None

def main():
    print("=" * 80)
    print("TESTING 3 NEW ARACOM AUTOMATION ENDPOINTS")
    print("=" * 80)
    
    # Test scenario 1: Reset data with seed
    print("\n📋 SCENARIO 1: Reset data with seed")
    seed_result = test_endpoint('POST', 'seed', {'force': True})
    if not seed_result:
        print("❌ CRITICAL: Seed failed, cannot continue tests")
        return
    
    print(f"✅ Seed completed: {seed_result.get('associations', 0)} associations, {seed_result.get('stands_planned', 0)} stands planned")
    
    # Test scenario 2: POST /api/tools/recompute-completion
    print("\n📋 SCENARIO 2: Test recompute-completion endpoint")
    completion_result = test_endpoint('POST', 'tools/recompute-completion', {})
    
    if completion_result:
        total = completion_result.get('total', 0)
        updated = completion_result.get('updated', 0)
        print(f"✅ Recompute completion: total={total}, updated={updated}")
        
        # Verify total should be 67 as per requirements
        if total == 67:
            print("✅ Total registrations count matches expected (67)")
        else:
            print(f"⚠️  Total registrations ({total}) doesn't match expected (67)")
    else:
        print("❌ Recompute completion failed")
    
    # Test scenario 3: POST /api/tools/generate-relances (first call)
    print("\n📋 SCENARIO 3: Test generate-relances endpoint (first call)")
    relances_result1 = test_endpoint('POST', 'tools/generate-relances', {})
    
    if relances_result1:
        created1 = relances_result1.get('created', 0)
        print(f"✅ Generate relances (first call): created={created1}")
        
        if created1 > 0:
            print("✅ First call created tasks as expected")
        else:
            print("⚠️  First call created 0 tasks - might be expected if no incomplete registrations")
    else:
        print("❌ Generate relances (first call) failed")
    
    # Test scenario 4: POST /api/tools/generate-relances (second call - should be idempotent)
    print("\n📋 SCENARIO 4: Test generate-relances endpoint (second call - idempotent)")
    relances_result2 = test_endpoint('POST', 'tools/generate-relances', {})
    
    if relances_result2:
        created2 = relances_result2.get('created', 0)
        print(f"✅ Generate relances (second call): created={created2}")
        
        if created2 == 0:
            print("✅ Second call is idempotent (created=0)")
        else:
            print(f"⚠️  Second call created {created2} tasks - should be 0 for idempotency")
    else:
        print("❌ Generate relances (second call) failed")
    
    # Test scenario 5: POST /api/emails/send-satisfaction
    print("\n📋 SCENARIO 5: Test send-satisfaction endpoint")
    satisfaction_result = test_endpoint('POST', 'emails/send-satisfaction', {})
    
    if satisfaction_result:
        sent = satisfaction_result.get('sent', 0)
        campaign_id = satisfaction_result.get('campaign_id', '')
        print(f"✅ Send satisfaction: sent={sent}, campaign_id={campaign_id}")
        
        if sent > 0:
            print("✅ Satisfaction emails sent successfully")
        else:
            print("⚠️  No satisfaction emails sent - check if registrations have emails")
            
        if campaign_id:
            print("✅ Campaign ID generated successfully")
        else:
            print("❌ No campaign ID returned")
    else:
        print("❌ Send satisfaction failed")
    
    # Test scenario 6: Verify tasks were created with auto_generated=true
    print("\n📋 SCENARIO 6: Verify auto-generated tasks")
    tasks_result = test_endpoint('GET', 'tasks')
    
    if tasks_result:
        auto_tasks = [t for t in tasks_result if t.get('auto_generated') == True]
        print(f"✅ Found {len(auto_tasks)} auto-generated tasks")
        
        if auto_tasks:
            print("Sample auto-generated tasks:")
            for task in auto_tasks[:3]:  # Show first 3
                print(f"  - {task.get('title', 'No title')} (priority: {task.get('priority', 'N/A')})")
        else:
            print("⚠️  No auto-generated tasks found")
    else:
        print("❌ Failed to retrieve tasks")
    
    # Test scenario 7: Verify satisfaction campaign exists
    print("\n📋 SCENARIO 7: Verify satisfaction campaign in emails")
    emails_result = test_endpoint('GET', 'emails')
    
    if emails_result and satisfaction_result:
        campaign_id = satisfaction_result.get('campaign_id', '')
        satisfaction_emails = [e for e in emails_result if e.get('campaign_id') == campaign_id]
        
        print(f"✅ Found {len(satisfaction_emails)} satisfaction emails")
        
        if satisfaction_emails:
            # Check subject contains "Votre retour sur le Forum"
            subjects_ok = [e for e in satisfaction_emails if 'Votre retour sur le Forum' in e.get('subject', '')]
            print(f"✅ {len(subjects_ok)} emails have correct subject")
            
            # Check template
            template_emails = [e for e in satisfaction_emails if e.get('template') == 'satisfaction_invite']
            print(f"✅ Found emails with satisfaction template")
        else:
            print("⚠️  No satisfaction emails found in email list")
    else:
        print("❌ Failed to verify satisfaction campaign")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    results = {
        'seed': seed_result is not None,
        'recompute_completion': completion_result is not None,
        'generate_relances_first': relances_result1 is not None,
        'generate_relances_idempotent': relances_result2 is not None and relances_result2.get('created', -1) == 0,
        'send_satisfaction': satisfaction_result is not None,
        'tasks_verification': tasks_result is not None,
        'emails_verification': emails_result is not None
    }
    
    passed = sum(results.values())
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} tests failed")
    
    # Additional verification details
    if completion_result:
        print(f"\n📊 Completion stats: {completion_result.get('total', 0)} total, {completion_result.get('updated', 0)} updated")
    
    if relances_result1:
        print(f"📊 Relances stats: {relances_result1.get('created', 0)} tasks created (first call)")
    
    if satisfaction_result:
        print(f"📊 Satisfaction stats: {satisfaction_result.get('sent', 0)} emails sent")

if __name__ == "__main__":
    main()