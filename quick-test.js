// Quick test script for Shadow Market Tracker Extension
// Run this in the browser console to test basic functionality

console.log('🚀 Quick Extension Test Starting...');

// Test 1: Basic Chrome API availability
console.log('📋 Test 1: Chrome APIs available?', {
    'chrome.runtime': typeof chrome !== 'undefined' && !!chrome.runtime,
    'chrome.tabs': typeof chrome !== 'undefined' && !!chrome.tabs,
    'chrome.storage': typeof chrome !== 'undefined' && !!chrome.storage
});

// Test 2: Background script communication
async function quickTest() {
    try {
        console.log('🔗 Test 2: Testing background script communication...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'health_check'
        });
        
        console.log('✅ Background script responded:', response);
        
        if (response && !response.error) {
            console.log('🎉 SUCCESS: Extension is working!');
            return true;
        } else {
            console.log('⚠️ Background script has errors:', response?.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Communication failed:', error);
        return false;
    }
}

// Test 3: Content script test
async function testContentScript() {
    try {
        console.log('📜 Test 3: Testing content script...');
        
        const response = await chrome.runtime.sendMessage({
            action: 'extract_content'
        });
        
        console.log('✅ Content script responded:', response);
        return true;
        
    } catch (error) {
        console.error('❌ Content script test failed:', error);
        return false;
    }
}

// Run all tests
async function runQuickTests() {
    console.log('\n🧪 Running quick tests...\n');
    
    const test1 = typeof chrome !== 'undefined' && !!chrome.runtime;
    const test2 = await quickTest();
    const test3 = await testContentScript();
    
    console.log('\n📊 Quick Test Results:');
    console.log('Chrome APIs: ', test1 ? '✅' : '❌');
    console.log('Background Script: ', test2 ? '✅' : '❌');
    console.log('Content Script: ', test3 ? '✅' : '❌');
    
    const passed = [test1, test2, test3].filter(Boolean).length;
    console.log(`\n🎯 Overall: ${passed}/3 tests passed`);
    
    if (passed === 3) {
        console.log('🎉 All tests passed! Extension is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Check the console for details.');
    }
    
    return { test1, test2, test3 };
}

// Make functions available globally
window.quickTest = {
    runQuickTests,
    quickTest,
    testContentScript
};

console.log('✅ Quick test functions loaded. Run quickTest.runQuickTests() to start testing.');
console.log('🔧 Or run individual tests like quickTest.quickTest()');

// Auto-run the test
setTimeout(() => {
    console.log('\n🔄 Auto-running quick tests in 2 seconds...');
    setTimeout(runQuickTests, 2000);
}, 1000);
