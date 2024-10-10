const express = require('express');
var router = express.Router();
const multer = require('multer');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv').config();
const FormData = require('form-data');
const fs = require('fs');
const fsExtra = require('fs-extra')


// Replace these with your Face++ API details
const apiKey    =  process.env.APIKEY;
const apiSecret = process.env.APISECRET;
const apiEndpoint = process.env.APIENDPOINT;
//console.log( " API : " + apiKey + " secr: " + apiSecret + "endpoint: " + apiEndpoint);
       
// Use body-parser to parse incoming requests
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());


// Set up multer for file uploads (handling image uploads)
const upload = multer({ dest: 'uploads/' });


/* GET home page. */
router.get('/', function(req, res, next) {
    res.sendFile(path.join(__dirname, '/index-enhanced.html'));
});

// POST route to handle image upload and Face++ API call
router.post('/analyze-face', upload.single('image_file'), async (req, res) => {
    const imagePath = req.file.path; // Get the uploaded image file path

    try {
       // console.log( " API : " + apiKey + " secr: " + apiSecret + "endpoint: " + apiEndpoint);
        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append('api_secret', apiSecret);
        formData.append('image_file', fs.createReadStream(imagePath)); // Send the image
        formData.append('return_attributes', 'gender,age,emotion,facequality');
        formData.append('return_landmark', 1);

        // Send the request to Face++ API
        const response = await axios.post(apiEndpoint, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });
        // Return the result from the Face++ API to the client
        res.json(response.data);

        let dir = "./uploads";
        await fsExtra.emptyDir(dir);
       

    } catch (error) {
        console.error('Error calling Face++ API:', error);
        res.status(500).json({ error: 'Failed to analyze face' });
    }
});







module.exports = router;
