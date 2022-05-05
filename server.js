const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const request = require('request');
const fs = require('fs');


const port = 8081;


const app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Home
app.get('/', (req, res) => {
    res.render('pages/home', {
        message: "",
        info: "",
        showNext: false });
});

app.post('/', urlencodedParser, (req, res) => {

    if (!req.body.server || req.body.server == '' || !req.body.server.includes('.')) {
        res.render('pages/home', {
            message: "Server name is invalid!",
            info: "",
            showNext: false });
        return;
    }

    if (!req.body.app || req.body.app == '') {
        res.render('pages/home', {
            message: "App name is invalid!",
            info: "",
            showNext: false });
        return;
    }

    // Remove https, http
    var serverName = req.body.server.toLowerCase();
    serverName = serverName.replace("http://", "")
    serverName = serverName.replace("https://", "")

    var appName = req.body.app;


    var data = {
        "client_name": appName,
        "redirect_uris": "urn:ietf:wg:oauth:2.0:oob",
        "scopes": "read write",
        "website": "",
    }

    request.post({ url: `https://${serverName}/api/v1/apps`, form: data}, (error, response, body) => {

        if (error || response.statusCode !== 200) {
            res.render('pages/home', {
                message: "Error: Could not register the application!",
                info: `Status code: ${response.statusCode} <br> Error Message: ${error}`,
                showNext: false
            });
            return;
        }

        var json = JSON.parse(body);
        var client_id = json.client_id;
        var client_secret = json.client_secret;

        UpdateSettingsFile("instance", serverName);
        UpdateSettingsFile("client_id", client_id);
        UpdateSettingsFile("client_secret", client_secret);

        res.render('pages/home', {
            message: "Successfully registered application!",
            info: `Client Id: ${client_id} <br> Client Secret: ${client_secret} <br><br> Details saved to settings.json. <br> Continue to step 2.`,
            showNext: true
        });
    });
});


// Step 2
app.get('/step2', (req, res) => {

    var data = fs.readFileSync('settings.json');
    var settings = JSON.parse(data);

    var authorizationUrl = `https://${settings.instance}/oauth/authorize?client_id=${settings.client_id}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=read+write`;

    res.render('pages/step2', {
        message: "",
        info: "",
        showNext: false,
        authorizationUrl: authorizationUrl
     });
});

app.post('/step2', urlencodedParser, (req, res) => {

    if (!req.body.token || req.body.token == '') {
        res.render('pages/step2', {
            message: "Token is not valid!",
            info: "",
            showNext: false });
        return;
    }

    var data = fs.readFileSync('settings.json');
    var settings = JSON.parse(data);
    var authorizationUrl = `https://${settings.instance}/oauth/authorize?client_id=${settings.client_id}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=read+write`;

    var data = {
        "grant_type": "authorization_code",
        "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
        "client_id": settings.client_id,
        "client_secret": settings.client_secret,
        "code": req.body.token
    }

    request.post({ url: `https://${settings.instance}/oauth/token`, form: data}, (error, response, body) => {
        
        if (error || response.statusCode !== 200) {
            res.render('pages/step2', {
                message: "Error: Could not retrieve bearer token!",
                info: `Status code: ${response.statusCode} <br> Error Message: ${error}`,
                showNext: false,
                authorizationUrl: authorizationUrl
            });
            return;
        }
    
        var json = JSON.parse(body);
        var bearerToken = json.access_token;

        UpdateSettingsFile("bearerToken", bearerToken);
        
        res.render('pages/step2', {
            message: "Successfully retrieve bearer token!",
            info: `Bearer token: ${bearerToken} <br> Details saved to settings.json. <br> Continue to step 3.`,
            showNext: true,
            authorizationUrl: authorizationUrl
        });
    });
});


// Step 3
app.get('/step3', (req, res) => {
    res.render('pages/step3');
});

app.get('/shutdown', (req, res) => {
    res.send("Terminating program. You can close this window.");
    process.kill(process.pid, 'SIGTERM');
});


const server = app.listen(port, () => {
    console.log("Listening on port %s.", port);

    process.on('SIGTERM', () => {
        server.close(() => {
          console.log('Process terminated')
        });
    });

    CheckSettingsFile();
});



function UpdateSettingsFile(field, value) {
    var data = fs.readFileSync('settings.json');
    var settings = JSON.parse(data);
    settings[field] = value;

    fs.writeFileSync('settings.json', JSON.stringify(settings, null, "\t"));
}

function CheckSettingsFile() {
    fs.exists('settings.json', (exists) => {
        if (!exists) {
            console.log("'settings.json' file doesn't exits.");

            var settings = { post_delay: 3600000, visibility = "public", sensitive = false };
            fs.writeFile('settings.json', JSON.stringify(settings, null, "\t"), (err) => {
                if (err) {
                    console.log("Failed to create new 'settings.json' file.")
                    return;
                }
                else
                {
                    console.log("New 'settings.json' file created.")
                }
            });
        }
    });
}