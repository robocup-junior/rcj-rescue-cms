// Tell the browser which language the page is in. Without it, kanji may be drawn with
// Chinese glyph shapes. Set right away from the saved choice to avoid a flash, then kept
// in sync with angular-translate.
(function () {
    var lang;
    try {
        lang = window.localStorage.getItem('NG_TRANSLATE_LANG_KEY');
    } catch (e) {}
    if (lang !== 'en' && lang !== 'ja') {
        lang = /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
    }
    document.documentElement.lang = lang;
})();

app.config(['$translateProvider', function ($translateProvider) {
    $translateProvider
        .useStaticFilesLoader({
            prefix: '/lang/',
            suffix: '.json'
        })

        .registerAvailableLanguageKeys(['en', 'ja'], {
            'en_*': 'en',
            'ja_*': 'ja',
            '*': 'en'
        })
        .determinePreferredLanguage()
        .useSanitizeValueStrategy('escape')
        .useMissingTranslationHandlerLog()
        .useLocalStorage();

}]);

app.run(['$rootScope', function ($rootScope) {
    $rootScope.$on('$translateChangeSuccess', function (event, data) {
        if (data && data.language) document.documentElement.lang = data.language;
    });
}]);
