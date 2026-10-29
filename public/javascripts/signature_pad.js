// A signature pad for the sign pages (views/includes/line_sign_parts.pug).
// Pointer events take a finger, a pen or a mouse; the canvas follows the screen's pixel density so
// the strokes stay sharp; a second finger (a palm, a pinch) is ignored while one is drawing.
// The signature is saved as an SVG cropped to the strokes, like jSignature's "svgbase64" before.
function SignaturePad(canvas, onChange) {
    var LINE_WIDTH = 3;
    var COLOR = '#0f172a';
    var ctx = canvas.getContext('2d');
    var strokes = [];
    var current = null;
    var pointerId = null;

    function point(event) {
        var box = canvas.getBoundingClientRect();
        return { x: event.clientX - box.left, y: event.clientY - box.top };
    }

    // A smooth line through the points: quadratic curves between their midpoints
    function trace(path, stroke) {
        path.moveTo(stroke[0].x, stroke[0].y);
        if (stroke.length < 3) {
            var last = stroke[stroke.length - 1];
            // A tap is a dot
            path.lineTo(last.x + (stroke.length == 1 ? 0.01 : 0), last.y);
            return;
        }
        for (var i = 1; i < stroke.length - 1; i++) {
            var mid = { x: (stroke[i].x + stroke[i + 1].x) / 2, y: (stroke[i].y + stroke[i + 1].y) / 2 };
            path.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y);
        }
        var end = stroke[stroke.length - 1];
        path.lineTo(end.x, end.y);
    }

    function redraw() {
        var ratio = window.devicePixelRatio || 1;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = COLOR;
        strokes.forEach(function (stroke) {
            ctx.beginPath();
            trace(ctx, stroke);
            ctx.stroke();
        });
    }

    function changed() {
        if (onChange) onChange();
    }

    canvas.addEventListener('pointerdown', function (event) {
        if (pointerId !== null || event.button > 0) return;
        event.preventDefault();
        pointerId = event.pointerId;
        canvas.setPointerCapture(pointerId);
        current = [point(event)];
        strokes.push(current);
        redraw();
    });

    canvas.addEventListener('pointermove', function (event) {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();
        // All the points since the last frame, for smooth fast strokes
        var events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
        (events.length ? events : [event]).forEach(function (e) {
            current.push(point(e));
        });
        redraw();
    });

    function end(event) {
        if (event.pointerId !== pointerId) return;
        pointerId = null;
        current = null;
        changed();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // Fit the canvas to its box (after opening, turning the phone or resizing the window)
    this.resize = function () {
        var ratio = window.devicePixelRatio || 1;
        var box = canvas.getBoundingClientRect();
        canvas.width = Math.round(box.width * ratio);
        canvas.height = Math.round(box.height * ratio);
        redraw();
    };

    this.clear = function () {
        strokes = [];
        redraw();
        changed();
    };

    this.undo = function () {
        strokes.pop();
        redraw();
        changed();
    };

    this.isEmpty = function () {
        return strokes.length == 0;
    };

    this.toDataURL = function () {
        var pad = LINE_WIDTH * 2;
        var xs = [], ys = [];
        strokes.forEach(function (stroke) {
            stroke.forEach(function (p) { xs.push(p.x); ys.push(p.y); });
        });
        var left = Math.min.apply(null, xs) - pad, top = Math.min.apply(null, ys) - pad;
        var width = Math.max.apply(null, xs) + pad - left, height = Math.max.apply(null, ys) + pad - top;
        // The same curves as on the canvas, written as SVG path commands
        var d = '';
        var svgPath = {
            moveTo: function (x, y) { d += 'M' + r(x) + ' ' + r(y); },
            lineTo: function (x, y) { d += 'L' + r(x) + ' ' + r(y); },
            quadraticCurveTo: function (cx, cy, x, y) { d += 'Q' + r(cx) + ' ' + r(cy) + ' ' + r(x) + ' ' + r(y); }
        };
        function r(n) { return Math.round(n * 10) / 10; }
        strokes.forEach(function (stroke) { trace(svgPath, stroke); });
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + r(width) + '" height="' + r(height) +
            '" viewBox="' + r(left) + ' ' + r(top) + ' ' + r(width) + ' ' + r(height) + '">' +
            '<path d="' + d + '" fill="none" stroke="' + COLOR + '" stroke-width="' + LINE_WIDTH +
            '" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        return 'data:image/svg+xml;base64,' + btoa(svg);
    };

    var self = this;
    window.addEventListener('resize', function () {
        if (canvas.offsetParent) self.resize();
    });
}
