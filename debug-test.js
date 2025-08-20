// Simple debug test for background script communication
console.log('🔍 Debug test loaded');

// Test function that can be run from console
window.testBackgroundScript = async function() {
    console.log('🧪 Testing background script communication...');
    
    try {
        // Test 1: Basic health check
        console.log('📡 Sending health_check message...');
        const response = await chrome.runtime.sendMessage({
            action: 'health_check'
        });
        
        console.log('✅ Response received:', response);
        
        if (response && !response.error) {
            console.log('🎉 SUCCESS: Background script is working!');
            return true;
        } else {
            console.log('⚠️ Background script returned error:', response?.error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
};

// Auto-run test after 1 second
setTimeout(() => {
    console.log('🔄 Auto-running background script test...');
    testBackgroundScript();
}, 1000);

console.log('✅ Debug test ready. Run testBackgroundScript() to test manually.');
