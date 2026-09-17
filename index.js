const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const fs = require('fs');
const fsp = require('fs/promises');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const apiKey = process.env.APIKEY;
const apiSecret = process.env.APISECRET;
const apiEndpoint = process.env.APIENDPOINT;

router.post('/analyze-face', upload.single('image_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imagePath = req.file.path;

  try {
    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('api_secret', apiSecret);
    formData.append('image_file', fs.createReadStream(imagePath));
    formData.append('return_attributes', 'gender,age,emotion,facequality');
    formData.append('return_landmark', 1);

    const response = await axios.post(apiEndpoint, formData, {
      headers: formData.getHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error calling Face++ API:', error.message);
    res.status(500).json({ error: 'Failed to analyze face' });
  } finally {
    await fsp.unlink(imagePath).catch(() => {});
  }
});

module.exports = router;
