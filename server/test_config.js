const config = require('./src/config/env');
console.log('--- Config Diagnostics ---');
console.log('PORT:', config.port);
console.log('CLIENT_URL:', config.clientUrl);
console.log('GITHUB:', JSON.stringify(config.github, null, 2));

try {
    const url = new URL(config.clientUrl);
    console.log('✅ CLIENT_URL is a valid URL:', url.href);
} catch (err) {
    console.error('❌ CLIENT_URL is INVALID:', err.message);
}

try {
    const cb = new URL(config.github.callbackUrl);
    console.log('✅ CALLBACK_URL is a valid URL:', cb.href);
} catch (err) {
    console.error('❌ CALLBACK_URL is INVALID:', err.message);
}
