// -*- tab-width: 2 -*-
const { ObjectId } = require('mongoose').Types;
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  res.render('service_home', { user: req.user });
});

// The editors there are, by the views of admin/mapEditor (maze_2026...): the rule of the URL may
// be anything (../ too, as %2F)
const EDITORS = fs.readdirSync(path.join(__dirname, '../views/admin/mapEditor')).map((file) => path.parse(file).name);

router.get('/editor/maze/:rule', async function (req, res, next) {
  const editor = `maze_${req.params.rule}`;
  if (!EDITORS.includes(editor)) return next();
  res.render(`admin/mapEditor/${editor}`, { user: req.user, pubService: true, leagueId: "Maze" });
});

// The public Simulation world editor still supports the 2025 rules, unlike the rest of the CMS
router.get('/editor/simulation/2025', async function (req, res, next) {
  res.render('sim_editor/sim_editor_2025', { user: req.user, pubService: true });
});

// Erebus Editor 2026 (the canvas editor) has a site of its own now; the classic editor stays here
const EREBUS_EDITOR_2026 = 'https://world.erebus.rcj.cloud/';
router.get('/editor/simulation/2026', function (req, res) {
  res.redirect(302, EREBUS_EDITOR_2026);
});

router.get('/editor/simulation/2026/classic', async function (req, res, next) {
  res.render('sim_editor/sim_editor_2026', { user: req.user, pubService: true });
});

router.get('/editor/line/:rule', function (req, res, next) {
  const editor = `line_${req.params.rule}`;
  if (!EDITORS.includes(editor)) return next();
  res.render(`admin/mapEditor/${editor}`, { user: req.user, pubService: true, leagueId: "Line" });
});

module.exports = router;
