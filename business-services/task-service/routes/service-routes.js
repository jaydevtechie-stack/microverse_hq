// business-services/task-service/routes/service-routes.js

const express = require('express');
const router = express.Router();
const { listServices, getServiceByKey, createService, updateService } = require('../models/service');
const { requireRealmRole } = require('../middleware/auth');

// No role check — the Dashboard and the public per-subdomain "coming
// soon" page (ServiceInProgressPage, unauthenticated) both need this.
router.get('/services', async (req, res) => {
  try {
    const services = await listServices();
    res.status(200).json(services);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching services', error: err.message });
  }
});

router.post('/services', requireRealmRole('platform:admin'), async (req, res) => {
  const { key, name, tech, title, description, status } = req.body;
  if (!key?.trim() || !name?.trim()) {
    return res.status(400).json({ message: '"key" and "name" are required' });
  }

  try {
    if (await getServiceByKey(key.trim())) {
      return res.status(409).json({ message: `A service with key "${key}" already exists` });
    }
    const service = await createService({ key: key.trim(), name: name.trim(), tech, title, description, status });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Error creating service', error: err.message });
  }
});

router.put('/services/:id', requireRealmRole('platform:admin'), async (req, res) => {
  const { name, tech, title, description, status } = req.body;

  try {
    const service = await updateService(req.params.id, { name, tech, title, description, status });
    if (!service) return res.status(404).json({ message: 'Service not found' });
    res.status(200).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Error updating service', error: err.message });
  }
});

module.exports = router;
