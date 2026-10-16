// Victim and cognitive target icons, shared by the Simulation editors (the new editor's map and the
// custom room 4 creator), so both show the same marks.
//   letter victims (Φ Ψ Ω): a filled disc with the letter (blue; fakes grey)
//   cognitive targets: a target - its five rings in the colours of its code (outside in), with an
//   outer rim in the colour of its type; a target without a code (a room 4 stamp of a type) shows
//   rings of the type colour
var SimIcons = (function () {
    const RING = { K: '#111827', R: '#dc2626', Y: '#facc15', G: '#16a34a', B: '#2563eb' };
    const TYPE = { F: '#d32f2f', P: '#6a1b9a', C: '#1565c0', O: '#e65100', X: '#6c757d' };
    const VICTIM = '#2563eb', FAKE = '#94a3b8';
    // the ring colours as the pickers list them: K R Y G B with their values
    const RING_LIST = [
        { id: 'K', color: RING.K, value: -2 }, { id: 'R', color: RING.R, value: -1 }, { id: 'Y', color: RING.Y, value: 0 },
        { id: 'G', color: RING.G, value: 1 }, { id: 'B', color: RING.B, value: 2 }
    ];

    // The letter's own ink centred on (x, y) (the font's middle line sits higher or lower than the
    // letter depending on the letter)
    function centredText(ctx, text, x, y) {
        const m = ctx.measureText(text);
        if (m && m.actualBoundingBoxAscent !== undefined) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, x - (m.actualBoundingBoxLeft !== undefined ? (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 : m.width / 2),
                y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
            return;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }

    function victim(ctx, x, y, r, symbol, color, outline) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color || VICTIM;
        ctx.fill();
        if (outline) {
            ctx.lineWidth = outline;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = '700 ' + (r * 1.35) + 'px system-ui, sans-serif';
        centredText(ctx, symbol, x, y);
        ctx.restore();
    }

    // code: the ring code (K R Y G B, outside in) or null; color: the type colour
    function target(ctx, x, y, r, code, color, outline) {
        const rings = code && /^[KRYGB]{5}$/.test(code)
            ? code.split('').map(function (c) { return RING[c]; })
            : [color, '#fff', color, '#fff', color];
        ctx.save();
        // rim in the type colour, then the rings
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        const inner = r * 0.82;
        rings.forEach(function (c, i) {
            ctx.beginPath();
            ctx.arc(x, y, inner * (1 - i / 5), 0, 2 * Math.PI);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.lineWidth = Math.max(r * 0.03, 0.02);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.stroke();
        });
        if (outline) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.lineWidth = outline;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
        ctx.restore();
    }

    // A cognitive target small enough that its rings would not show (the map): a disc in its type
    // colour with the type letter (× when the code is not valid) and a thin inner ring. Without a
    // code (a room 4 stamp of a type) `letter` gives the letter.
    function targetLetter(ctx, x, y, r, code, color, outline, letter) {
        const t = code ? typeOf(code) : null;
        letter = letter || (t ? (t === 'X' ? '×' : t) : '?');
        victim(ctx, x, y, r, letter, color || TYPE[t || 'X'], outline);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, 2 * Math.PI);
        ctx.lineWidth = Math.max(r * 0.07, 0.05);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.stroke();
        ctx.restore();
    }

    // For HTML: the target as a CSS background (same look as `target`)
    function targetBackground(code, color) {
        const rings = code && /^[KRYGB]{5}$/.test(code)
            ? code.split('').map(function (c) { return RING[c]; })
            : [color, '#fff', color, '#fff', color];
        const stops = [];
        for (let i = 4; i >= 0; i--) {
            const from = (4 - i) * 16.4, to = (5 - i) * 16.4;
            stops.push(rings[i] + ' ' + from + '% ' + to + '%');
        }
        stops.push(color + ' 82%');
        return 'radial-gradient(circle closest-side, ' + stops.join(', ') + ')';
    }

    // The type letter (F P C O) of a ring code, or X when it is not a valid one
    function ringSum(rings) {
        const v = { K: -2, R: -1, Y: 0, G: 1, B: 2 };
        return rings.reduce(function (sum, c) { return sum + (v[c] || 0); }, 0);
    }

    function typeOf(code) {
        if (!code || !/^[KRYGB]{5}$/.test(code)) return 'X';
        const v = { K: -2, R: -1, Y: 0, G: 1, B: 2 };
        const sum = code.split('').reduce(function (s, c) { return s + v[c]; }, 0);
        return ['F', 'P', 'C', 'O'][sum] || 'X';
    }

    return { RING: RING, RING_LIST: RING_LIST, ringSum: ringSum, TYPE: TYPE, VICTIM: VICTIM, FAKE: FAKE, victim: victim, target: target, targetLetter: targetLetter, targetBackground: targetBackground, typeOf: typeOf };
})();
