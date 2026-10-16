// Rotation dial of a victim / cognitive target token (<sim-rotation-dial ng-model="..." symbol="...">),
// shared by the Simulation 2026 editor and the new editor (beta). Needs `app` from the page's script.
app.directive('simRotationDial', function () {
    function normalize(value) {
        const n = Math.round(Number(value) || 0);
        return ((n % 360) + 360) % 360;
    }

    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            symbol: '<',
            image: '<?',
            isDisabled: '<?ngDisabled'
        },
        templateUrl: '/templates/sim_editor/rotation_dial.html',
        link: function (scope, element, attrs, ngModel) {
            scope.angle = 0;
            scope.angleInput = 0;

            ngModel.$render = function () {
                scope.angle = normalize(ngModel.$viewValue);
                scope.angleInput = scope.angle;
            };

            function set(value) {
                if (scope.isDisabled) return;
                scope.angle = normalize(value);
                scope.angleInput = scope.angle;
                ngModel.$setViewValue(scope.angle);
            }

            scope.set = set;
            scope.step = function (delta) {
                set(scope.angle + delta);
            };
            scope.random = function () {
                set(Math.floor(Math.random() * 360));
            };
            scope.typed = function () {
                if (scope.angleInput === null || scope.angleInput === undefined || scope.angleInput === '') return;
                set(scope.angleInput);
            };

            // Dragging on the dial: 0° at the top, clockwise. Snaps to 5°, or 1° with Shift.
            function angleFromEvent(dial, event) {
                const rect = dial.getBoundingClientRect();
                const dx = event.clientX - (rect.left + rect.width / 2);
                const dy = event.clientY - (rect.top + rect.height / 2);
                let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
                const snap = event.shiftKey ? 1 : 5;
                return Math.round(deg / snap) * snap;
            }

            const root = element[0];
            root.addEventListener('pointerdown', function (event) {
                const dial = event.target.closest('.sim-rot-dial');
                if (!dial || scope.isDisabled) return;
                event.preventDefault();
                dial.focus();
                dial.setPointerCapture(event.pointerId);
                scope.$apply(function () { set(angleFromEvent(dial, event)); });

                function move(e) {
                    scope.$apply(function () { set(angleFromEvent(dial, e)); });
                }
                function up() {
                    dial.removeEventListener('pointermove', move);
                    dial.removeEventListener('pointerup', up);
                    dial.removeEventListener('pointercancel', up);
                }
                dial.addEventListener('pointermove', move);
                dial.addEventListener('pointerup', up);
                dial.addEventListener('pointercancel', up);
            });

            // Arrow keys: 1° (15° with Shift)
            root.addEventListener('keydown', function (event) {
                if (!event.target.closest('.sim-rot-dial') || scope.isDisabled) return;
                const amount = event.shiftKey ? 15 : 1;
                let delta = 0;
                if (event.key === 'ArrowRight' || event.key === 'ArrowUp') delta = amount;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') delta = -amount;
                if (!delta) return;
                event.preventDefault();
                scope.$apply(function () { scope.step(delta); });
            });
        }
    };
});
