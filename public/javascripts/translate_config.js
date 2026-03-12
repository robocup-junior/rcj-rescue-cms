app.config(['$translateProvider', function ($translateProvider) {
    $translateProvider
        .useStaticFilesLoader({
            prefix: '/lang/',
            suffix: '.json'
        })

       .preferredLanguage(((navigator.language || navigator.userLanguage || 'en').split('-')[0] || 'en'))

        .fallbackLanguage('en')

        .useSanitizeValueStrategy('escape')
        .useMissingTranslationHandlerLog()
        .useLocalStorage();
}]);