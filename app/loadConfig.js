module.exports = function() {
    var config;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        config = {};
        config.twilioSid = process.env.TWILIO_ACCOUNT_SID;
        config.twilioToken = process.env.TWILIO_AUTH_TOKEN;
    } else if (process.env.VCAP_SERVICES) {
        // Load from a CloudFoundry/IBM BlueMix environment user-provided service
        // named "twilio"
        config = {};
        var vcap = JSON.parse(process.env.VCAP_SERVICES);
        var services = vcap['user-provided'];
        services.forEach(function(service) {
            if (service.name === 'twilio') {
                config.twilioSid = service.credentials.accountSID;
                config.twilioToken = service.credentials.authToken;
            }
        });
    }
    return config;
};