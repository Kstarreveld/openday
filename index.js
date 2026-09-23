const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const fsp = require('fs/promises');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const apiKey = process.env.APIKEY;
const apiSecret = process.env.APISECRET;
const apiEndpoint = process.env.APIENDPOINT;

function apiUrl(operation) {
  const url = new URL(apiEndpoint);
  url.pathname = url.pathname.replace(/\/[^/]+$/, `/${operation}`);
  return url.toString();
}

async function removeUploads(files) {
  const fileList = Array.isArray(files) ? files : Object.values(files || {}).flat();
  await Promise.all(fileList.map((file) => fsp.unlink(file.path).catch(() => {})));
}

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
    formData.append(
      'return_attributes',
      'gender,age,smiling,headpose,facequality,blur,eyestatus,emotion,beauty,mouthstatus,eyegaze,skinstatus'
    );
    formData.append('return_landmark', 1);

    const response = await axios.post(apiEndpoint, formData, {
      headers: formData.getHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error calling Face++ API:', error.message);
    const providerMessage = error.response?.data?.error_message;
    res.status(502).json({ error: providerMessage || 'Failed to analyze face' });
  } finally {
    await fsp.unlink(imagePath).catch(() => {});
  }
});

router.post(
  '/compare-faces',
  upload.fields([
    { name: 'image_file1', maxCount: 1 },
    { name: 'image_file2', maxCount: 1 },
  ]),
  async (req, res) => {
    const firstImage = req.files?.image_file1?.[0];
    const secondImage = req.files?.image_file2?.[0];

    if (!firstImage || !secondImage) {
      await removeUploads(req.files);
      return res.status(400).json({ error: 'Two face images are required' });
    }

    try {
      const formData = new FormData();
      formData.append('api_key', apiKey);
      formData.append('api_secret', apiSecret);
      formData.append('image_file1', fs.createReadStream(firstImage.path));
      formData.append('image_file2', fs.createReadStream(secondImage.path));

      const response = await axios.post(apiUrl('compare'), formData, {
        headers: formData.getHeaders(),
      });

      res.json(response.data);
    } catch (error) {
      console.error('Error calling Face++ Compare API:', error.message);
      const providerMessage = error.response?.data?.error_message;
      res.status(502).json({
        error: providerMessage || 'Failed to compare faces',
      });
    } finally {
      await removeUploads([firstImage, secondImage]);
    }
  }
);

module.exports = router;
