// A cognitive target: five concentric rings of 1 to 5 cm across, ring1 in the centre, each
// in one of five colours. Drawn by CSS on the pages and as circles on the server (PDFs, map images),
// all from here; there are no images of them.
(function (root) {
  // The colours of the printed targets
  var COLORS = { K: '#000000', R: '#ee0000', Y: '#ffff00', G: '#00b050', B: '#00b0f0' };

  // The colour codes from the centre outwards ('RGBKY'), from a target's rings or such a code;
  // '' for neither
  function code(rings) {
    if (typeof rings == 'string') return /^[KRYGB]{5}$/.test(rings) ? rings : '';
    if (!rings) return '';
    var c = '';
    for (var i = 1; i <= 5; i++) c += rings['ring' + i] || '';
    return /^[KRYGB]{5}$/.test(c) ? c : '';
  }

  // The CSS background of a round element showing the target. Each ring ends half a pixel either
  // side of its edge, so that the edges are smooth
  function background(rings) {
    var c = code(rings);
    if (!c) return 'none';
    var stops = [];
    for (var i = 0; i < 5; i++) {
      var color = COLORS[c[i]];
      stops.push(color + ' ' + (i ? 'calc(' + i * 20 + '% + 0.5px)' : '0'));
      stops.push(color + ' ' + (i < 4 ? 'calc(' + (i + 1) * 20 + '% - 0.5px)' : 'calc(100% - 0.5px)'));
    }
    stops.push('transparent 100%');
    return 'radial-gradient(circle closest-side, ' + stops.join(', ') + ')';
  }

  // The style of an element showing the target on its own (sized by the page)
  function style(rings) {
    return { 'border-radius': '50%', 'background-image': background(rings) };
  }

  // The rings as circles from the outside in, to draw one over the other (PDFs, map images): the
  // radius in parts of the target's and the colour; none for no target
  function circles(rings) {
    var c = code(rings);
    var out = [];
    for (var i = 4; c && i >= 0; i--) out.push({ radius: (i + 1) / 5, color: COLORS[c[i]] });
    return out;
  }

  // A target on a side of a tile is half the tile across, against the side's wall: its centre in
  // parts of the tile
  var SIDE_CENTRES = { top: [0.5, 0.25], right: [0.75, 0.5], bottom: [0.5, 0.75], left: [0.25, 0.5] };

  // The style of a target on a side of a tile, in a box over the whole tile
  function sideStyle(rings, side) {
    var s = style(rings);
    var centre = SIDE_CENTRES[side];
    s.position = 'absolute';
    s.width = '50%';
    s.height = '50%';
    s.left = (centre[0] - 0.25) * 100 + '%';
    s.top = (centre[1] - 0.25) * 100 + '%';
    return s;
  }

  var cognitiveTarget = {
    COLORS: COLORS, SIDE_CENTRES: SIDE_CENTRES,
    code: code, background: background, style: style, sideStyle: sideStyle, circles: circles,
  };
  if (typeof module != 'undefined' && module.exports) module.exports = cognitiveTarget;
  else root.cognitiveTarget = cognitiveTarget;
})(this);
