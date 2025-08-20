// Test script for Shadow Market Tracker Extension
// Run this in the browser console to test basic functionality

console.log('🧪 Testing Shadow Market Tracker Extension...');

// Test 1: Check if chrome APIs are available
function testChromeAPIs() {
    console.log('📋 Testing Chrome APIs...');
    
    const apis = {
        'chrome.runtime': typeof chrome !== 'undefined' && chrome.runtime,
        'chrome.tabs': typeof chrome !== 'undefined' && chrome.tabs,
        'chrome.storage': typeof chrome !== 'undefined' && chrome.storage,
        'chrome.scripting': typeof chrome !== 'undefined' && chrome.scripting
    };
    
    console.table(apis);
    return Object.values(apis).every(api => api);
}

// Test 2: Test background script communication
async function testBackgroundCommunication() {
    console.log('🔗 Testing background script communication...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'health_check'
        });
        
        console.log('✅ Background script response:', response);
        return true;
    } catch (error) {
        console.error('❌ Background communication failed:', error);
        return false;
    }
}

// Test 3: Test content script injection
async function testContentScriptInjection() {
    console.log('📜 Testing content script injection...');
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'extract_content'
        });
        
        console.log('✅ Content script response:', response);
        return true;
    } catch (error) {
        console.error('❌ Content script test failed:', error);
        return false;
    }
}

// Test 4: Test page analysis
async function testPageAnalysis() {
    console.log('🔍 Testing page analysis...');
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab) {
            console.error('❌ No active tab found');
            return false;
        }
        
        console.log('📄 Current tab:', currentTab.title);
        
        const response = await chrome.runtime.sendMessage({
            action: 'scan',
            url: currentTab.url,
            title: currentTab.title,
            tabId: currentTab.id
        });
        
        console.log('✅ Analysis response:', response);
        return true;
    } catch (error) {
        console.error('❌ Page analysis failed:', error);
        return false;
    }
}

// Test 5: Test storage functionality
async function testStorage() {
    console.log('💾 Testing storage functionality...');
    
    try {
        const testData = { test: 'data', timestamp: Date.now() };
        await chrome.storage.local.set({ test_key: testData });
        
        const result = await chrome.storage.local.get(['test_key']);
        console.log('✅ Storage test result:', result);
        
        // Clean up
        await chrome.storage.local.remove(['test_key']);
        
        return true;
    } catch (error) {
        console.error('❌ Storage test failed:', error);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting comprehensive extension tests...\n');
    
    const results = {
        'Chrome APIs': testChromeAPIs(),
        'Background Communication': await testBackgroundCommunication(),
        'Content Script': await testContentScriptInjection(),
        'Page Analysis': await testPageAnalysis(),
        'Storage': await testStorage()
    };
    
    console.log('\n📊 Test Results:');
    console.table(results);
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Extension is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Check the console for details.');
    }
    
    return results;
}

// Make functions available globally for manual testing
window.testExtension = {
    testChromeAPIs,
    testBackgroundCommunication,
    testContentScriptInjection,
    testPageAnalysis,
    testStorage,
    runAllTests
};

console.log('✅ Test functions loaded. Run testExtension.runAllTests() to start testing.');
console.log('🔧 Or run individual tests like testExtension.testChromeAPIs()');

