// The writing of mails, shared by the mail page and the mail template editor (module mailCompose):
// the editor (Quill) made for mails, with links, buttons and variables; the mail as each recipient
// gets it, shown beside it; and what is checked before the mails are sent.
(function () {
    // Kept in mails as they are written: the button's look is in its own style, as mail readers
    // take no style sheets
    const BUTTON_STYLE = 'display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;' +
        'border-radius:6px;text-decoration:none;font-weight:bold;';

    // The formats a mail reader shows (no video, fonts or sub/superscripts)
    const TOOLBAR = [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }, { align: [] }],
        ['link', 'mailButton', 'image'],
        ['clean'],
    ];

    // The names of the toolbar's buttons, shown on them
    const TOOLBAR_TITLES = {
        '.ql-header': 'mail.editor.heading',
        '.ql-bold': 'mail.editor.bold',
        '.ql-italic': 'mail.editor.italic',
        '.ql-underline': 'mail.editor.underline',
        '.ql-strike': 'mail.editor.strike',
        '.ql-color': 'mail.editor.color',
        '.ql-background': 'mail.editor.background',
        '.ql-list[value="ordered"]': 'mail.editor.orderedList',
        '.ql-list[value="bullet"]': 'mail.editor.bulletList',
        '.ql-align': 'mail.editor.align',
        '.ql-link': 'mail.editor.link',
        '.ql-mailButton': 'mail.editor.button',
        '.ql-image': 'mail.editor.image',
        '.ql-clean': 'mail.editor.clean',
    };

    const MailCompose = window.MailCompose = {
        translate: (key) => key,
        // The translations once they are loaded (an editor is made before)
        translations: (keys) => Promise.resolve(Object.fromEntries(keys.map((k) => [k, k]))),
        // The variables of the recipients being written to (for the URLs offered in the dialogs)
        variables: () => ({}),
    };
    const t = (key, params) => MailCompose.translate(key, params);

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    MailCompose.escapeHtml = escapeHtml;

    // The variables (${name}) put in: in HTML (html), the values as text, escaped, not taken as HTML
    // (a team's name, which the team may have given)
    function render(string, values, html) {
        return (string || '').replace(/\$\{(.*?)\}/g, function (all, key) {
            if (!Object.prototype.hasOwnProperty.call(values, key)) return '';
            return html ? escapeHtml(values[key]) : values[key];
        });
    }
    MailCompose.render = render;

    // The mail as a recipient gets it
    MailCompose.renderMail = function (subject, content, values) {
        return {
            title: render(subject, values),
            content: render(content, values, true).replace(/<p><br><\/p>/g, '<br>').replace(/<\/p><p>/g, '<br>'),
        };
    };

    // HTML given to the editor (a template, a draft) without what would run in the page: Quill puts
    // it in the page once to read it, where the handlers of its elements (onerror...) would run.
    // Read here in a document of its own, where nothing of it runs or loads.
    MailCompose.clean = function (html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        doc.querySelectorAll('script, iframe, object, embed, style, link, meta, form').forEach((el) => el.remove());
        doc.querySelectorAll('*').forEach((el) => {
            for (const attr of Array.from(el.attributes)) {
                if (/^on/i.test(attr.name) || (/^(href|src|action|formaction|xlink:href)$/i.test(attr.name) && /^\s*(javascript|vbscript):/i.test(attr.value))) {
                    el.removeAttribute(attr.name);
                }
            }
        });
        return doc.body.innerHTML;
    };

    MailCompose.hasContent = function (content) {
        return !!content && (content.replace(/<[^>]*>/g, '').trim() != '' || /<img|mail-button/.test(content));
    };

    // A URL as it is linked: a variable (${documentUrl}), http(s) or mailto; an address taken as
    // mailto, and a domain (example.com/...) as https; anything else none
    function normalizeUrl(url) {
        url = (url || '').trim();
        if (url === '') return null;
        if (/^\$\{\w+\}$/.test(url)) return url;
        if (/^(https?:\/\/\S+|mailto:\S+)$/i.test(url)) return url;
        if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(url)) return 'mailto:' + url;
        if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(url)) return 'https://' + url;
        return null;
    }
    MailCompose.normalizeUrl = normalizeUrl;

    // The variables that are URLs, offered to be linked
    function urlVariables() {
        return Object.keys(MailCompose.variables() || {}).filter((key) => /Url$/.test(key));
    }

    function varLabel(key) {
        const label = t('mail.var.' + key);
        return label == 'mail.var.' + key ? key : label;
    }
    MailCompose.varLabel = varLabel;

    // A dialog asking for a text and a URL (with the URL variables a click away); its values, or
    // {remove: true}, or null when cancelled
    async function urlDialog({ title, text, url, textShown, removable }) {
        let remove = false;
        const vars = urlVariables().map((key) =>
            `<button type="button" class="var-chip mc-url-var" data-url="\${${key}}">${escapeHtml(varLabel(key))}</button>`).join('');
        const html =
            '<div class="text-left mc-dialog">' +
            (textShown ? `<label class="small text-muted mb-1">${escapeHtml(t('mail.editor.text'))}</label>` +
                `<input id="mc-text" class="form-control mb-3" value="${escapeHtml(text || '')}">` : '') +
            `<label class="small text-muted mb-1">URL</label>` +
            `<input id="mc-url" class="form-control" placeholder="https://" value="${escapeHtml(url || '')}">` +
            (vars ? `<div class="small text-muted mt-3 mb-1">${escapeHtml(t('mail.editor.urlVariables'))}</div><div>${vars}</div>` : '') +
            (removable ? `<div class="mt-3"><button type="button" id="mc-remove" class="btn btn-sm btn-link text-danger p-0">${escapeHtml(t('mail.editor.removeLink'))}</button></div>` : '') +
            '</div>';
        const result = await Swal({
            title,
            html,
            showCancelButton: true,
            focusConfirm: false,
            onOpen: (popup) => {
                popup.querySelectorAll('.mc-url-var').forEach((b) => b.addEventListener('click', () => {
                    popup.querySelector('#mc-url').value = b.dataset.url;
                }));
                const removeButton = popup.querySelector('#mc-remove');
                if (removeButton) removeButton.addEventListener('click', () => { remove = true; Swal.clickConfirm(); });
                (popup.querySelector(text ? '#mc-url' : '#mc-text') || popup.querySelector('#mc-url')).focus();
            },
            preConfirm: () => {
                if (remove) return { remove: true };
                const popup = Swal.getPopup();
                const value = normalizeUrl(popup.querySelector('#mc-url').value);
                if (!value) {
                    Swal.showValidationMessage(t('mail.editor.badUrl'));
                    return false;
                }
                const textInput = popup.querySelector('#mc-text');
                return { url: value, text: textInput ? textInput.value.trim() : null };
            },
        });
        return result.value || null;
    }

    // The link where the cursor is (its whole extent), or the selection
    function linkAt(quill, range) {
        let index = range.index;
        let length = range.length;
        const url = quill.getFormat(range).link || '';
        if (length === 0 && url) {
            let [blot] = quill.getLeaf(index);
            while (blot && blot.statics.blotName !== 'link') blot = blot.parent;
            if (blot) {
                index = quill.getIndex(blot);
                length = blot.length();
            }
        }
        return { index, length, url };
    }

    MailCompose.linkDialog = async function (quill) {
        const range = quill.getSelection(true);
        const { index, length, url } = linkAt(quill, range);
        const text = quill.getText(index, length);
        // A selection over lines is linked as it is: its text is not one to be written again
        const textShown = !text.includes('\n');
        const value = await urlDialog({
            title: t(url ? 'mail.editor.editLink' : 'mail.editor.link'),
            text, url, textShown, removable: !!url,
        });
        if (!value) return;
        if (value.remove) {
            quill.formatText(index, length, 'link', false, 'user');
            return;
        }
        const newText = textShown ? (value.text || text || value.url) : text;
        if (length > 0 && newText === text) {
            quill.formatText(index, length, 'link', value.url, 'user');
        } else {
            if (length > 0) quill.deleteText(index, length, 'user');
            quill.insertText(index, newText, 'link', value.url, 'user');
            quill.setSelection(index + newText.length, 0, 'user');
        }
    };

    // A button (a link that looks like one) put at the cursor, or the one clicked written again
    MailCompose.buttonDialog = async function (quill, blot) {
        const old = blot ? blot.constructor.value(blot.domNode) : null;
        const value = await urlDialog({
            title: t('mail.editor.button'),
            text: old ? old.text : '', url: old ? old.url : '', textShown: true, removable: false,
        });
        if (!value) return;
        const button = { text: value.text || t('mail.editor.buttonDefault'), url: value.url };
        let index;
        if (blot) {
            index = quill.getIndex(blot);
            quill.deleteText(index, 1, 'user');
        } else {
            index = (quill.getSelection(true) || { index: quill.getLength() }).index;
        }
        quill.insertEmbed(index, 'mailButton', button, 'user');
        quill.setSelection(index + 1, 0, 'user');
    };

    // The button: a block of its own, kept in the HTML as a link with its style
    let registered = false;
    MailCompose.register = function () {
        if (registered) return;
        registered = true;
        const BlockEmbed = Quill.import('blots/block/embed');
        class MailButton extends BlockEmbed {
            static create(value) {
                const node = super.create();
                node.setAttribute('style', 'margin:16px 0;');
                const a = document.createElement('a');
                a.setAttribute('href', value.url);
                a.setAttribute('target', '_blank');
                a.setAttribute('style', BUTTON_STYLE);
                a.textContent = value.text;
                node.appendChild(a);
                return node;
            }

            static value(node) {
                const a = node.querySelector('a');
                return { url: a ? a.getAttribute('href') : '', text: a ? a.textContent : '' };
            }
        }
        MailButton.blotName = 'mailButton';
        MailButton.tagName = 'div';
        MailButton.className = 'mail-button';
        Quill.register(MailButton);

        Quill.import('ui/icons').mailButton =
            '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="1.5" y="5" width="15" height="8" rx="2.5"></rect>' +
            '<line class="ql-stroke" x1="6" x2="12" y1="9" y2="9"></line></svg>';
    };

    MailCompose.quillConfig = function () {
        return {
            modules: {
                toolbar: {
                    container: TOOLBAR,
                    handlers: {
                        link: function () { MailCompose.linkDialog(this.quill); },
                        mailButton: function () { MailCompose.buttonDialog(this.quill); },
                    },
                },
                imageResize: {},
                imageDropAndPaste: {},
            },
            theme: 'snow',
            debug: 'warn',
            placeholder: '',
            readOnly: false,
            bounds: document.body,
            scrollContainer: null,
        };
    };

    // An editor made: the toolbar's names, ⌘/Ctrl+K for a link, a button written again when clicked
    MailCompose.attach = function (quill) {
        const toolbar = quill.getModule('toolbar').container;
        MailCompose.translations(Object.values(TOOLBAR_TITLES).concat('mail.editor.placeholder')).then((names) => {
            Object.keys(TOOLBAR_TITLES).forEach((selector) => {
                toolbar.querySelectorAll(selector).forEach((el) => el.setAttribute('title', names[TOOLBAR_TITLES[selector]]));
            });
            quill.root.setAttribute('data-placeholder', names['mail.editor.placeholder']);
        });
        quill.keyboard.addBinding({ key: 'K', shortKey: true }, function () {
            MailCompose.linkDialog(quill);
            return false;
        });
        quill.root.addEventListener('click', (e) => {
            const node = e.target.closest('.mail-button');
            if (!node) return;
            e.preventDefault();
            MailCompose.buttonDialog(quill, Quill.find(node));
        });
    };

    // What is wrong (danger) or may be (warning) with a mail before it is sent, each as {level, key,
    // params} for the translations at mail.check
    MailCompose.check = function (subject, content, values) {
        const issues = [];
        if (!subject) issues.push({ level: 'danger', key: 'noSubject' });
        if (!MailCompose.hasContent(content)) issues.push({ level: 'danger', key: 'noContent' });

        const unknown = new Set();
        ((subject || '') + (content || '')).replace(/\$\{(.*?)\}/g, function (all, key) {
            if (!Object.prototype.hasOwnProperty.call(values, key)) unknown.add(key);
        });
        if (unknown.size) issues.push({ level: 'danger', key: 'unknownVariable', params: { names: [...unknown].map((k) => '${' + k + '}').join(', ') } });

        const doc = new DOMParser().parseFromString(content || '', 'text/html');
        const bad = [], insecure = [], local = [];
        doc.querySelectorAll('a').forEach((a) => {
            const href = (a.getAttribute('href') || '').trim();
            const label = (a.textContent || href).trim().slice(0, 40);
            if (/^\$\{\w+\}$/.test(href) && Object.prototype.hasOwnProperty.call(values, href.slice(2, -1))) return;
            if (!normalizeUrl(href) || /^\$\{/.test(href)) bad.push(label);
            else if (/^http:\/\//i.test(href)) insecure.push(label);
            if (/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(href)) local.push(label);
        });
        if (bad.length) issues.push({ level: 'danger', key: 'badLink', params: { links: bad.join(', ') } });
        if (insecure.length) issues.push({ level: 'warning', key: 'insecureLink', params: { links: insecure.join(', ') } });
        if (local.length) issues.push({ level: 'warning', key: 'localLink', params: { links: local.join(', ') } });

        // The pictures put in the mail are sent with it
        let size = 0;
        doc.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src') || '';
            if (/^data:/i.test(src)) size += src.length * 3 / 4;
        });
        if (size > 2 * 1024 * 1024) issues.push({ level: 'warning', key: 'largeImages', params: { size: (size / 1024 / 1024).toFixed(1) } });

        if ((subject || '').length > 60) issues.push({ level: 'warning', key: 'longSubject' });
        return issues;
    };

    // No script runs in a mail shown (its content's own policy); its links open apart from the page
    const FRAME_HEAD = '<!doctype html><html><head><meta charset="utf-8">' +
        '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'"><base target="_blank">' +
        '<style>body{margin:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Hiragino Sans","Noto Sans JP",sans-serif;' +
        'font-size:14px;line-height:1.6;color:#1e293b;word-wrap:break-word}p{margin:0;padding:0}img{max-width:100%;height:auto}' +
        '.ql-align-center{text-align:center}.ql-align-right{text-align:right}.ql-align-justify{text-align:justify}</style></head><body>';

    angular.module('mailCompose', ['ngQuill', 'pascalprecht.translate'])
        .config(['ngQuillConfigProvider', function (ngQuillConfigProvider) {
            MailCompose.register();
            ngQuillConfigProvider.set(MailCompose.quillConfig());
        }])
        .run(['$translate', function ($translate) {
            MailCompose.translate = (key, params) => $translate.instant(key, params);
            MailCompose.translations = (keys) => $translate(keys).catch((names) => names);
        }])

        // A mail shown as a mail reader would: in a frame of its own (the page's styles do not reach
        // it), as wide as a phone's screen with mobile
        .directive('mailFrame', ['$timeout', function ($timeout) {
            return {
                restrict: 'E',
                scope: { html: '<', mobile: '<' },
                template: '<iframe class="mail-frame" title="preview"></iframe>',
                link: function (scope, element) {
                    const frame = element.find('iframe')[0];
                    let pending = null;
                    function fit() {
                        try {
                            frame.style.height = (frame.contentDocument.documentElement.scrollHeight + 4) + 'px';
                        } catch (e) { /* not shown yet */ }
                    }
                    function update() {
                        $timeout.cancel(pending);
                        pending = $timeout(() => { frame.srcdoc = FRAME_HEAD + (scope.html || '') + '</body></html>'; }, 150, false);
                    }
                    frame.addEventListener('load', fit);
                    scope.$watch('html', update);
                    scope.$watch('mobile', (mobile) => {
                        frame.style.width = mobile ? '375px' : '100%';
                        $timeout(fit, 0, false);
                    });
                },
            };
        }])

        // The subject and the content of a mail written, its variables a click away, and the mail as
        // each recipient (with its variables) gets it beside them
        .component('mailComposer', {
            bindings: { subject: '=', content: '=', recipients: '<', showErrors: '<' },
            template: `
<div class="row">
  <div class="col-xl-7 mb-3">
    <div class="form-group mb-2">
      <div class="d-flex justify-content-between align-items-end">
        <label class="small text-muted mb-1" for="mailTitle">{{'mail.home.subject' | translate}}</label>
        <small class="text-muted" ng-class="{'text-warning': ($ctrl.subject || '').length > 60}">{{($ctrl.subject || '').length}}</small>
      </div>
      <input class="form-control" id="mailTitle" type="text" ng-model="$ctrl.subject" ng-trim="false"
        ng-focus="$ctrl.field = 'subject'" placeholder="{{'mail.editor.subjectPlaceholder' | translate}}"
        ng-class="{'is-invalid': $ctrl.showErrors && !$ctrl.subject}">
      <div class="invalid-feedback">{{'mail.home.subjectRequired' | translate}}</div>
    </div>
    <div class="mb-2">
      <label class="small text-muted d-block mb-1">{{'mail.home.variable' | translate}} — {{'mail.home.variableHint' | translate}}</label>
      <span class="var-chip" ng-repeat="key in $ctrl.variableKeys()" ng-mousedown="$event.preventDefault()" ng-click="$ctrl.insertVariable(key)"
        uib-tooltip="{{'$' + '{' + key + '}'}}: {{$ctrl.sample(key)}}" tooltip-append-to-body="true" data-var="{{key}}">{{$ctrl.label(key)}}</span>
    </div>
    <ng-quill-editor ng-model="$ctrl.content" on-editor-created="$ctrl.editorCreated(editor)" on-selection-changed="$ctrl.selected(range)"></ng-quill-editor>
    <div class="invalid-feedback d-block" ng-if="$ctrl.showErrors && !$ctrl.hasContent()">{{'mail.home.contentRequired' | translate}}</div>
    <small class="text-muted d-block mt-1"><i class="fas fa-keyboard mr-1"></i>{{'mail.editor.shortcuts' | translate}}</small>
  </div>
  <div class="col-xl-5">
    <div class="mail-live-preview">
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap" style="gap:0.5rem;">
        <span class="small font-weight-bold text-muted"><i class="fas fa-eye mr-1"></i>{{'mail.editor.livePreview' | translate}}</span>
        <div class="segmented segmented-sm">
          <button type="button" ng-class="{'active': !$ctrl.mobile}" ng-click="$ctrl.mobile = false" title="{{'mail.editor.desktop' | translate}}"><i class="fas fa-desktop"></i></button>
          <button type="button" ng-class="{'active': $ctrl.mobile}" ng-click="$ctrl.mobile = true" title="{{'mail.editor.mobile' | translate}}"><i class="fas fa-mobile-alt"></i></button>
        </div>
      </div>
      <select class="custom-select custom-select-sm mb-2" ng-if="$ctrl.recipients.length > 1" ng-model="$ctrl.index"
        ng-options="i as $ctrl.recipientLabel(r) for (i, r) in $ctrl.recipients"></select>
      <div class="mail-preview-subject">{{$ctrl.rendered.title || ('mail.editor.noSubject' | translate)}}</div>
      <div class="mail-preview-frame" ng-class="{'mobile': $ctrl.mobile}">
        <mail-frame html="$ctrl.rendered.content" mobile="$ctrl.mobile"></mail-frame>
      </div>
    </div>
  </div>
</div>`,
            controller: ['$scope', function ($scope) {
                const ctrl = this;
                let quill = null;
                ctrl.field = 'content';
                ctrl.index = '0';
                ctrl.mobile = false;

                ctrl.current = () => (ctrl.recipients || [])[ctrl.index] || (ctrl.recipients || [])[0] || { variable: {} };
                ctrl.hasContent = () => MailCompose.hasContent(ctrl.content);
                ctrl.label = varLabel;
                ctrl.sample = (key) => ctrl.current().variable[key];
                ctrl.recipientLabel = (r) => r.variable.teamName || r.variable.userName || '';

                // The variables of the recipients (of each kind, for a template)
                ctrl.variableKeys = function () {
                    const keys = [];
                    (ctrl.recipients || []).forEach((r) => Object.keys(r.variable || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
                    return keys;
                };
                MailCompose.variables = () => {
                    const all = {};
                    (ctrl.recipients || []).forEach((r) => Object.assign(all, r.variable));
                    return all;
                };

                $scope.$watchGroup([() => ctrl.subject, () => ctrl.content, () => ctrl.index, () => ctrl.recipients], function () {
                    ctrl.rendered = MailCompose.renderMail(ctrl.subject, ctrl.content, ctrl.current().variable || {});
                });

                ctrl.editorCreated = function (editor) {
                    editor.container.style.height = '380px';
                    quill = editor;
                    MailCompose.attach(editor);
                };

                ctrl.selected = function (range) {
                    if (range) ctrl.field = 'content';
                };

                // At the cursor (the editor keeps where it was), in the subject or the content
                ctrl.insertVariable = function (key) {
                    const text = '${' + key + '}';
                    if (ctrl.field == 'subject') {
                        const input = document.getElementById('mailTitle');
                        const subject = ctrl.subject || '';
                        const start = input.selectionStart == null ? subject.length : input.selectionStart;
                        const end = input.selectionEnd == null ? subject.length : input.selectionEnd;
                        ctrl.subject = subject.slice(0, start) + text + subject.slice(end);
                        setTimeout(function () {
                            input.focus();
                            input.setSelectionRange(start + text.length, start + text.length);
                        });
                        return;
                    }
                    if (!quill) return;
                    const range = quill.getSelection(true);
                    const index = range ? range.index : Math.max(quill.getLength() - 1, 0);
                    quill.insertText(index, text, 'user');
                    quill.setSelection(index + text.length, 0, 'user');
                };
            }],
        });
})();
