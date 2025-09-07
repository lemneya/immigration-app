#!/usr/bin/env node

/**
 * Quick API Test Script
 * Tests mail service endpoints without requiring database
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const MAIL_SERVICE_URL = 'http://localhost:3005';

console.log('🧪 Testing Mail Service API\n');
console.log('=' .repeat(60));

async function testEndpoints() {
  try {
    // Test 1: Health Check
    console.log('\n🏥 Test 1: Health Check');
    try {
      const health = await axios.get(`${MAIL_SERVICE_URL}/health`);
      console.log('✅ Health check:', health.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      console.log('   Is the mail service running on port 3005?');
    }

    // Test 2: Integration Service Health
    console.log('\n🔗 Test 2: Integration Service Health');
    try {
      const integrationHealth = await axios.get(`${MAIL_SERVICE_URL}/api/actions/health`);
      console.log('✅ Integration health:', integrationHealth.data);
    } catch (error) {
      console.log('❌ Integration health failed:', error.code, error.response?.status || error.message);
    }

    // Test 3: Test Action Execution (using our integration test hook)
    console.log('\n⚡ Test 3: Action Hook Execution');
    try {
      const actionResult = await axios.post(`${MAIL_SERVICE_URL}/api/actions/execute`, {
        hookId: 'track_case_MSC2290123456',
        payload: {
          receiptNumber: 'MSC2290123456',
          service: 'case-status',
          action: 'track'
        },
        userId: 'test-user'
      });
      console.log('✅ Action execution result:', actionResult.data);
    } catch (error) {
      console.log('❌ Action execution failed:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Error details:', error.response.data);
      }
    }

    // Test 4: Stats endpoint (might fail without database)
    console.log('\n📊 Test 4: Stats Endpoint');
    try {
      const stats = await axios.get(`${MAIL_SERVICE_URL}/api/mail/stats`);
      console.log('✅ Stats:', stats.data);
    } catch (error) {
      console.log('❌ Stats failed:', error.response?.status || error.message);
    }

    // Test 5: Check if we can create a test file upload (will fail without DB but tests the endpoint)
    console.log('\n📄 Test 5: File Upload Endpoint (without actual file)');
    try {
      const formData = new FormData();
      formData.append('applicant_id', '550e8400-e29b-41d4-a716-446655440000');
      formData.append('source', 'upload');
      
      // Create a simple test file
      const testFile = Buffer.from('Test document content');
      formData.append('file', testFile, {
        filename: 'test-document.txt',
        contentType: 'text/plain'
      });

      const uploadResult = await axios.post(`${MAIL_SERVICE_URL}/api/mail/ingest`, formData, {
        headers: formData.getHeaders(),
        timeout: 10000
      });
      console.log('✅ Upload test passed:', uploadResult.data);
    } catch (error) {
      console.log('❌ Upload test failed:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Expected failure due to database connection');
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🏁 API Test Summary Complete');
    console.log('\nNext Steps:');
    console.log('1. Fix database connection to enable full functionality');
    console.log('2. Test with real document uploads');
    console.log('3. Test web interface integration');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run tests
testEndpoints().catch(console.error);