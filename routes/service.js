// -*- tab-width: 2 -*-
const { ObjectId } = require('mongoose').Types;
const express = require('express');

const router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  res.render('service_home', { user: req.user });
});

router.get('/editor/maze/:rule', async function (req, res, next) {
  const { rule } = req.params;
  res.render(`admin/mapEditor/maze_${rule}`, { user: req.user, pubService: true, leagueId: "Maze" });
});

router.get('/editor/simulation/2024', async function (req, res, next) {
  res.render('sim_editor/sim_editor_2024', { user: req.user, pubService: true });
});

router.get('/editor/simulation/2025', async function (req, res, next) {
  res.render('sim_editor/sim_editor_2025', { user: req.user, pubService: true });
});

router.get('/editor/simulation/2026', async function (req, res, next) {
  res.render('sim_editor/sim_editor_2026', { user: req.user, pubService: true });
});

router.get('/editor/line/:rule', function (req, res, next) {
  const { rule } = req.params;
  res.render(`admin/mapEditor/line_${rule}`, { user: req.user, pubService: true, leagueId: "Line" });
});

module.exports = router;
