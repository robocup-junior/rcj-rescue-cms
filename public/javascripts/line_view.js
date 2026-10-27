// Shared by the Rescue Line and Maze view and sign pages (views/view/common/line_2026.pug, maze_2026.pug)

// The chips of the score equation jump to their cards. Scrolled from here, since Angular
// would take the #hash links for its own routes
document.querySelectorAll('[data-jump]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    event.preventDefault();
    document.querySelector(link.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
  });
});

// The score and time in the bar would repeat the summary, so show them only once it has scrolled away
(function () {
  var bar = document.querySelector('.rv-topbar');
  var summary = document.querySelector('.rv-summary');
  if (!bar || !summary || !('IntersectionObserver' in window)) return;
  bar.classList.add('stats-follow-summary');
  new IntersectionObserver(function (entries) {
    bar.classList.toggle('show-stats', !entries[0].isIntersecting);
  }, { rootMargin: '-' + bar.offsetHeight + 'px 0px 0px 0px' }).observe(summary);
})();

// Takes the loading screen away once the map is complete: its tiles drawn (they come from
// templates of their own, a moment after the data), their images loaded and decoded, so they are
// painted at once, and the tiles sized (resize is the page's sizing function). Called by the
// controller when the run and its map are in; a slow or broken image does not hold the page for
// more than 15 seconds.
function revealRunPage(resize) {
  if (!document.body.classList.contains('rv-is-loading') || revealRunPage.waiting) return;
  revealRunPage.waiting = true;
  var started = Date.now();
  var lastCount = -1;
  var revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    resize();
    // One frame for the new sizes to be drawn
    requestAnimationFrame(function () {
      document.body.classList.remove('rv-is-loading');
    });
  }
  setTimeout(reveal, 15000);

  (function check() {
    var images = Array.prototype.slice.call(document.querySelectorAll('.tilearea img[src]'));
    var complete = images.every(function (img) {
      return img.complete;
    });
    // A maze map shows only the images its tiles need, so it may have none
    var drawn = images.length || document.querySelector('.tilearea .rv-mz-tile');
    // Loaded when the map is drawn, its images complete, and no more came since the last look
    if (!(drawn && complete && images.length == lastCount)) {
      lastCount = images.length;
      return setTimeout(check, 100);
    }
    // Then decoded; a broken image (its decode fails) does not count
    Promise.all(images.map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : null;
    })).then(reveal);
  })();
}

// The maze map as the view and sign pages draw it (views/view/common/maze_map.pug): its tiles and
// the walls between them, placed in % of the map, so that it scales with the card by itself. cells
// are the map's cells by "x,y,z", in half tiles (odd x and y a tile, one of them even a wall);
// rotate turns the map clockwise by 0, 90, 180 or 270 degrees.
function buildMazeMap(cells, width, length, z, rotate) {
  var quarter = rotate == 90 || rotate == 270;
  var across = quarter ? length : width;
  var down = quarter ? width : length;
  // Where a cell is on the screen, in the same half tiles
  function place(x, y) {
    if (rotate == 90) return [2 * length - y, x];
    if (rotate == 180) return [2 * width - x, 2 * length - y];
    if (rotate == 270) return [y, 2 * width - x];
    return [x, y];
  }
  function box(left, top, w, h) {
    return {
      left: left / across * 100 + '%',
      top: top / down * 100 + '%',
      width: w / across * 100 + '%',
      height: h / down * 100 + '%'
    };
  }
  // A wall is this part of a tile thick, and runs over the corners into the next one
  var thick = 0.1;
  var tiles = [];
  var walls = [];
  for (var x = 0; x <= 2 * width; x++) {
    for (var y = 0; y <= 2 * length; y++) {
      var cell = cells[x + ',' + y + ',' + z];
      var at = place(x, y);
      if (x % 2 && y % 2) {
        var tile = cell && cell.tile || {};
        tiles.push({
          x: x,
          y: y,
          key: x + ',' + y,
          cell: cell,
          cls: {
            'is-void': !cell,
            'is-checkpoint': tile.checkpoint,
            'is-black': tile.black,
            'is-blue': tile.blue,
            'is-red': tile.red,
            'is-linear': tile.reachable && cell.isLinear,
            'is-floating': tile.reachable && !cell.isLinear
          },
          style: box((at[0] - 1) / 2, (at[1] - 1) / 2, 1, 1)
        });
      } else if ((x + y) % 2 && cell && cell.isWall) {
        walls.push({
          key: x + ',' + y,
          kind: cell.isLinear ? 'linear' : (cell.ignoreWall ? 'ignored' : 'floating'),
          // Across the screen when its column is that of a tile
          style: at[0] % 2 ?
            box((at[0] - 1 - thick) / 2, (at[1] - thick) / 2, 1 + thick, thick) :
            box((at[0] - thick) / 2, (at[1] - 1 - thick) / 2, thick, 1 + thick)
        });
      }
    }
  }
  return {
    tiles: tiles,
    walls: walls,
    // Not taller than most of the window, so that a whole floor is in view
    style: {
      'aspect-ratio': across + ' / ' + down,
      'max-width': 'min(100%, calc(70vh * ' + across + ' / ' + down + '))'
    }
  };
}

// The image of the victim on a side of a tile ('top', 'right', 'bottom', 'left' or 'floor'), which
// the map turns with the tile; none for no victim, or a cognitive target, which is drawn from its rings
function mazeVictimImage(cell, side) {
  var type = cell && cell.tile && cell.tile.victims && cell.tile.victims[side];
  if (!type || type == 'None' || type == 'Cognitive') return null;
  return '/images/' + type.toLowerCase() + '_' + side + '.png';
}

// The evacuation zone on the Line map of the view and sign pages: the box around its tiles (marked
// is-evac by the tile directive), for the rescues shown over it. Called when the tiles are sized.
function placeEvacZone() {
  var wrap = document.getElementById('wrapTile');
  var area = wrap && wrap.querySelector('.rv-evac-area');
  if (!area) return;
  var tiles = wrap.querySelectorAll('tile.is-evac');
  area.classList.toggle('is-off', !tiles.length);
  if (!tiles.length) return;
  var origin = wrap.getBoundingClientRect();
  var box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  Array.prototype.forEach.call(tiles, function (tile) {
    var r = tile.getBoundingClientRect();
    box.left = Math.min(box.left, r.left);
    box.top = Math.min(box.top, r.top);
    box.right = Math.max(box.right, r.right);
    box.bottom = Math.max(box.bottom, r.bottom);
  });
  area.style.left = (box.left - origin.left) + 'px';
  area.style.top = (box.top - origin.top) + 'px';
  area.style.width = (box.right - box.left) + 'px';
  area.style.height = (box.bottom - box.top) + 'px';
}
