/*-----------------------------------------------------------------------------
An image caption bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

// This loads the environment variables from the .env file
require('dotenv-extended').load();


var builder = require('botbuilder'),
    needle = require('needle'),
    restify = require('restify'),
    url = require('url'),
    validUrl = require('valid-url'),
    captionService = require('./caption-service');
var fs = require('fs');
var json2xls = require('json2xls');



//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

server.post('/api/messages', connector.listen());


// Welcome  Dialog
var MainOptions = {
    Shop: 'Fill Form',
    Support: 'Exit'
};







var inMemoryStorage = new builder.MemoryBotStorage();

// Gets the caption by checking the type of the image (stream vs URL) and calling the appropriate caption service method.
var bot = new builder.UniversalBot(connector, [
    function (session) {
        if (localizedRegex(session, [MainOptions.Shop]).test(session.message.text)) {
            // Order Flowers
            return session.beginDialog('regionSelection');
        }
        var welcomeCard = new builder.HeroCard(session)
            .images([
                new builder.CardImage(session)
                    .url('https://travelvisabookings.com/wp-content/uploads/2016/02/visa-application-form.jpg')
                    .alt('FormImage')
            ])
            .buttons([
                builder.CardAction.postBack(session, session.gettext(MainOptions.Shop), MainOptions.Shop),
                builder.CardAction.postBack(session, session.gettext(MainOptions.Support), MainOptions.Support)
            ]);

        session.send(new builder.Message(session)
            .addAttachment(welcomeCard));
    }]);

// Enable Conversation Data persistence
bot.set('persistConversationData', true);

bot.set('storage', inMemoryStorage)

// Ask the user for their name and greet them by name.
bot.dialog('regionSelection', [
    function (session) {
        if (!session.message.value) {
            var msg = new builder.Message(session).addAttachment({
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    "type": "AdaptiveCard",
                    "version": "0.5",
                    "body": [
                        {
                            "type": "TextBlock",
                            "size": "medium",
                            "weight": "bolder",
                            "text": "Details",
                            "horizontalAlignment": "center"
                          },
                          {
                            "type": "Input.Text",
                            "placeholder": "Name",
                            "style": "text",
                            "maxLength": 0,
                            "id": "Name"
                          },
                                                  {
                            "type": "TextBlock",
                            "size": "medium",
                            "text": "Insured For",
                            "weight": "bolder"

                          },
                          {
                            "type": "Input.ChoiceSet",
                            "id": "InsuredFor",
                            "style": "compact",
                            "value": "Self",
                            "choices": [
                              {
                                "title": "Self",
                                "value": "Self"
                              },
                              {
                                "title": "Father",
                                "value": "Father"
                              },
                              {
                                "title": "Mother",
                                "value": "Mother"
                              },
                                                            {
                                "title": "Spouse",
                                "value": "Spouse"
                              },
                                                            {
                                "title": "Other",
                                "value": "Other"
                              }
                              
                            ]
                          },
                         
                          {
                            "type": "Input.Text",
                            "placeholder": "Email",
                            "style": "email",
                            "maxLength": 0,
                            "id": "Email"
                          },
                          
                          {
                            "type": "TextBlock",
                            "size": "medium",
                            "weight": "bolder",
                            "text": "Date of Birth"
                          },
                          {
                            "type": "Input.Date",
                            "placeholder": "Due Date",
                            "id": "Date",
                            "value": "Date"
                          },
                        
                         
                          {
                            "type": "TextBlock",
                            "size": "medium",
                            "weight": "bolder",
                            "text": "Region"
                          },
                          {
                            "type": "Input.ChoiceSet",
                            "id": "Region",
                            "style": "compact",
                            "value": "Bangalore",
                            "choices": [
                              {
                                "title": "Bangalore",
                                "value": "Bangalore"
                              },
                              {
                                "title": "Huzurnagar",
                                "value": "Huzurnagar"
                              },
                              {
                                "title": "WestBengal",
                                "value": "WestBengal"
                              }
                            ]
                          }
                    ],
                    "actions": [
                        {
                            "type": "Action.Submit",
                            "title": "Submit",
                            "data": {
                                "id": "1234567890"
                            }
                        }
                    ]
                }
            });

            session.send(msg)
        }
        if (session.message.value) {


            console.log(typeof (session.message.value))
            console.log(session.message.value)

            session.userData.details = session.message.value

        

            
            // fs.writeFileSync("./data/test.xlsx", json2xls(json), function (err) {
            //     if (err) {
            //         return console.log(err);
            //     }

            //     console.log("The file was saved!");
            // });

            session.save()
            session.beginDialog('imageDetect')
        }
    }
]);


bot.dialog('/phonePrompt', [
    function (session, args) {
        if (args && args.reprompt) {
            builder.Prompts.text(session, "Enter/Say a correct number")
        } else {
            builder.Prompts.text(session, "Please provide your contact number");
        }
    },
    function (session, results) {
        var matched = results.response.match(/\d+/g);
        var number = matched ? matched.join('') : '';
        if (number.length == 10 || number.length == 11) {
            session.endDialogWithResult({ response: number });
            session.userData.details['Contact No'] = results.response
        } else {
            session.replaceDialog('/phonePrompt', { reprompt: true });
        }
    }
]);




bot.dialog('imageDetect', [

    function(session){
        console.log("Image detect began")
        console.log(session.userData.details)
        session.beginDialog('/phonePrompt')
    },
    function (session) {
        session.send("Starting the EKYC process...")
        builder.Prompts.attachment(session, "Please upload a valid pan/aadhar card");

    },
    function (session) {
        if (hasImageAttachment(session)) {
            var stream = getImageStreamFromMessage(session.message);
            captionService
                .getCaptionFromStream(stream)
                .then(function (caption) { handleSuccessResponse(session, caption); })
                .catch(function (error) { handleErrorResponse(session, error); });
        } else {
            var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
            if (imageUrl) {
                captionService
                    .getCaptionFromUrl(imageUrl)
                    .then(function (caption) { handleSuccessResponse(session, caption); })
                    .catch(function (error) { handleErrorResponse(session, error); });
            } else {
                session.send('Did you upload an image? I\'m more of a visual person. Try sending me an image or an image URL');
            }
        }
    }
]);


bot.dialog('Exit', function (session, args, next) {

    //builder.Prompts.choice(session, "Are you sure you wish to restart?", "Yes|No", { listStyle: 3 });
    session.endDialog("Bye!");
})
    .triggerAction({
        matches: /^Exit$/i
    });




// bot.dialog('restart',function (session, args, next) {

//         //builder.Prompts.choice(session, "Are you sure you wish to restart?", "Yes|No", { listStyle: 3 });
//         session.endDialog("Bye!");
//     })
//     .triggerAction({
//         matches: /^Exit$/i
//     });
bot.dialog('restart', [function (session) {

    session.beginDialog('regionSelection')
}
])
    .triggerAction({
        matches: /^restart$/i
    });





//=========================================================
// Bots Events
//=========================================================
//Sends greeting message when the bot is first added to a conversation
// bot.on('conversationUpdate', function (message) {
//     if (message.membersAdded) {
//         message.membersAdded.forEach(function (identity) {
//             if (identity.id === message.address.bot.id) {
//                 var reply = new builder.Message()
//                     .address(message.address)
//                     .text('Please upload a pan/aadhar ');
//                 bot.send(reply);
//             }
//         });
//     }
// });


// Send welcome when conversation with bot is started, by initiating the root dialog
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/');
            }
        });
    }
});
//=========================================================
// Utilities
//=========================================================
function hasImageAttachment(session) {
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}
function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        // The Skype attachment URLs are secured by JwtToken,
        // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
        // https://github.com/Microsoft/BotBuilder/issues/662
        connector.getAccessToken(function (error, token) {
            var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}
function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}
/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

//=========================================================
// Response Handling
//=========================================================
function handleSuccessResponse(session, caption) {
    if ("Please upload a valid pan/aadhar card" == caption.toString()) {
        // session.send(caption);
        // session.beginDialog('imageDetect')
        session.beginDialog('imageDetect')
    }
    else {
        // session.send("OTHER")
        // session.send(caption.toString() ===  "please upload a valid pan/aadhar");
        session.send(caption);
        console.log("Adding the pan no: ")
        if (caption.slice(0,1)  === 'P'){
            session.userData.details['PAN'] = caption.slice(11,21);
        }
        else{
            session.userData.details['Aadhar'] = caption.slice(14);
        }
        // save the details
        var xls = json2xls(session.userData.details);
        fs.writeFileSync('./data/test.xlsx', xls, 'binary');
        console.log(session.userData.details)
        session.endDialog('Details saved.Thanks for the time!')
    }

}
function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }

    console.error(error);
    session.send(clientErrorMessage);
}
// Enable Conversation Data persistence
bot.set('persistConversationData', true);

// Cache of localized regex to match selection from main options
var LocalizedRegexCache = {};
function localizedRegex(session, localeKeys) {
    var locale = session.preferredLocale();
    var cacheKey = locale + ":" + localeKeys.join('|');
    if (LocalizedRegexCache.hasOwnProperty(cacheKey)) {
        return LocalizedRegexCache[cacheKey];
    }

    var localizedStrings = localeKeys.map(function (key) { return session.localizer.gettext(locale, key); });
    var regex = new RegExp('^(' + localizedStrings.join('|') + ')', 'i');
    LocalizedRegexCache[cacheKey] = regex;
    return regex;
}
