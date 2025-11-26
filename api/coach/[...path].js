// Minimal serverless function to test basic functionality
module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pathArray = req.query.path || [];
  const pathString = pathArray.join('/');

  console.log('📨 Request:', req.method, pathString);

  // Simple test response
  if (pathString === 'health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Basic function works!'
    });
  }

  try {
    // Try to load Express
    const express = require('express');
    console.log('✓ Express loaded');

    // Try to load a context loader
    const { loadSchedules } = require('../../server/dist/server/src/context/schedules');
    console.log('✓ Context loader imported');

    // Try to load schedules
    const schedules = loadSchedules();
    console.log('✓ Schedules loaded:', schedules?.meta);

    return res.status(200).json({
      status: 'ok',
      schedulesLoaded: !!schedules,
      meta: schedules?.meta
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      code: error.code
    });
  }
};
