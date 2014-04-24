// Module dependencies
var http = require('http'),
    path = require('path'),
    express = require('express'),
    twilio = require('twilio'),
    sanitizer = require('sanitizer'),
    randomString = require('./random');

// Create an in-memory list of current conference rooms
var conferences = {};

// Create an authenticated Twilio REST API client using your Twilio account
// credentials - we'll pull these from the system environment
var twilioSid, twilioToken;

// Determine if we're running in the IBM BlueMix environment
var config = require('./loadConfig')();
var client = twilio(config.twilioSid, config.twilioToken);

// Create a simple Express 4 web app
var app = express();

// Serve static content (HTML, CSS, images, etc.) from the "public" directory
// using Express/Connect middleware
app.use(express.static(path.join(__dirname, 'public')));

// Parse incoming POST bodies
app.use(require('body-parser')());

// Render our app's home page
app.get('/', function(request, response) {
    response.render('index.ejs');
});

// Create a new conference room
app.post('/conference', function(request, response) {
    // Create a unique ID for this conference
    var conferenceId;
    while(!conferenceId) {
        var candidate = randomString();
        if (!conferences[candidate]) conferenceId = candidate;
    }

    // Render a response with a conference object
    function success(appSid) {
        // Save the name and ID of the conference, and redirect to the conference
        // home page
        var conferenceName = sanitizer.sanitize(request.param('conferenceName'));
        conferences[conferenceId] = {
            id: conferenceId,
            appSid: appSid,
            conferenceName: conferenceName,
            participants: []
        };
        response.redirect('/conference/'+conferenceId);
    }

    var conferenceRoute = '/conference/dial';
    var conferenceFullUrl = 'http://'+request.host+conferenceRoute;

    // Create a new "TwiML app" we can use for outbound VoIP calls
    var friendlyName = 'nodeconference-'+request.host;
    client.applications.get({
        friendlyName: friendlyName
    }).then(function(appsSearchResult) {
        if (appsSearchResult.applications.length === 0) {
            return client.applications.create({
                friendlyName: friendlyName,
                voiceUrl: conferenceFullUrl
            });
        } else {
            success(appsSearchResult.applications[0].sid);
        }
    }).then(function(app) {
        if (app) {
            success(app.sid);
        }
    }).fail(function(err) {
        response.send(500, 'Failed to create new conference call :(');
    });
});

// Render a page for Participants in the conference
app.get('/conference/:id', function(request, response) {
    // Get the requested conference by ID
    var conferenceId = request.param('id');
    var conference = conferences[conferenceId];

    if (!conference) {
        response.send(404, 'No conference found with that ID :(');
        return;
    }

    // On the server, generate a "capability token" that will let the browser
    // make outbound calls
    var capability = new twilio.Capability(config.twilioSid, config.twilioToken);
    capability.allowClientOutgoing(conference.appSid);
    conference.token = capability.generate();

    // Render conference page
    response.render('conference.ejs', conference);
});

// Render TwiML to be used for an outbound call from the browser
app.post('/conference/dial', function(request, response) {
    var confName = request.param('conference');

    // Create a TwiML response - this is just a JavaScript object that helps
    // you build XML in the "TwiML" format - http://twilio.github.io/twilio-node/#twimlResponse
    var twiml = new twilio.TwimlResponse();
    twiml.dial(function() {
        this.conference(confName);
    });

    // reply with XML
    response.type('text/xml');
    response.send(twiml.toString());
});

// Create and start an HTTP server for our application
var server = http.createServer(app);
server.listen(process.env.PORT || 3000, function() {
    console.log('Express server started...');
});