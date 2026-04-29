const express = require('express');
const router  = express.Router();
const { getDestinationSuggestions, chatWithAssistant } = require('../controllers/aiController');
const { requireRider, requireAuth } = require('../middleware/requireAuth');

router.post('/destination-suggestions', requireRider, getDestinationSuggestions);
router.post('/chat', requireAuth, chatWithAssistant);

module.exports = router;