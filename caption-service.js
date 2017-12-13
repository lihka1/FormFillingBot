// The exported functions in this module makes a call to Microsoft Cognitive Service Computer Vision API and return caption
// description if found. Note: you can do more advanced functionalities like checking
// the confidence score of the caption. For more info checkout the API documentation:
// https://www.microsoft.com/cognitive-services/en-us/Computer-Vision-API/documentation/AnalyzeImage

var request = require('request').defaults({ encoding: null });

var VISION_URL = 'https://westcentralus.api.cognitive.microsoft.com/vision/v1.0/ocr';

/** 
 *  Gets the caption of the image from an image stream
 * @param {stream} stream The stream to an image.
 * @return {Promise} Promise with caption string if succeeded, error otherwise
 */
exports.getCaptionFromStream = function (stream) {
    return new Promise(
        function (resolve, reject) {
            var requestData = {
                url: VISION_URL,
                encoding: 'binary',
                json: true,
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.MICROSOFT_VISION_API_KEY,
                    'content-type': 'application/octet-stream'
                }
            };

            stream.pipe(request.post(requestData, function (error, response, body) {
                if (error) {
                    reject(error);
                } else if (response.statusCode !== 200) {
                    reject(body);
                } else {
                    console.log(body)
                    resolve(extractCaption((body)));
                }
            }));
        }
    );
};

/** 
 * Gets the caption of the image from an image URL
 * @param {string} url The URL to an image.
 * @return {Promise} Promise with caption string if succeeded, error otherwise
 */
exports.getCaptionFromUrl = function (url) {
    return new Promise(
        function (resolve, reject) {
            var requestData = {
                url: VISION_URL,
                json: { 'url': url }
            };

            request.post(requestData, function (error, response, body) {
                if (error) {
                    reject(error);
                }
                else if (response.statusCode !== 200) {
                    reject(body);
                }
                else {
                    resolve(extractCaption(body));
                }
            });
        }
    );
};

/**
 * Extract the specific key from the json object.
 * @param{Object}  json_input Inut json to be read.
 * @param{lookup_key} key to be searched in json. 
 * @return {list} list of the matching keys
 */
function item_generator(json_input,lookup_key){
    var names = []
    function item_generator_helper(json_input, lookup_key){
        if (json_input instanceof Object){
            for (var key in json_input){
                if (json_input.hasOwnProperty(key)){
                    if (key === lookup_key){
                        names.push( json_input[key])
                    } 
                    else{
                        for (child_val in item_generator_helper(json_input[key], lookup_key)){
                            names.push(child_val)
                        }
                    }
                }
            }
        }
       else if(json_input instanceof Array){
           for (item in json_input){
               for (item_val in item_generator_helper(item,lookup_key)){
                   names.push(item_val)
               }
           }
       }
    };
    item_generator_helper(json_input,lookup_key)
    return names
}



/**
 * Extracts the caption description from the response of the Vision API
 * @param {Object} body Response of the Vision API
 * @return {string} Description if caption found, null otherwise.
 */
function extractCaption(body) {

  
    
    console.log("detected text : ");
    console.log(item_generator(body,"text"))
    
    //console.log(JSON.stringify(body))



    var text_list = item_generator(body,"text")
    if (! text_list.length > 0){
        return ("Please upload a valid pan/aadhar card")
    }

    var regpan = /^([a-zA-Z]){5}([0-9]){4}([a-zA-Z]){1}?$/;
    
    for (var text_index in text_list){
        if (regpan.test(text_list[text_index])){
            return ("PAN No is: "+text_list[text_index])
        }
    }

    // if not found then this is aadhar card
    var aadhar_nos = []
    var regaadhar = /\d{4}/;
    for (var text_index in text_list){
        if (regaadhar.test(text_list[text_index])){
            console.log(text_list[text_index])
            aadhar_nos.push(text_list[text_index])
        }
    }  
    console.log("numbers are ")
    console.log(aadhar_nos)
    var lenOfAaadhar = aadhar_nos.length;
    if (! (lenOfAaadhar >= 3) ){
        return ("please upload a valid pan/aadhar");
    } 
    else{
        return ("Aadhar No is: "+aadhar_nos[lenOfAaadhar-3]+" "+aadhar_nos[lenOfAaadhar-2]+ " "+aadhar_nos[lenOfAaadhar-1]);
    }
    

    if (body && body.description && body.description.captions && body.description.captions.length) {
        return body.description.captions[0].text;
    }

    return ("please upload a valid pan/aadhar");
}
