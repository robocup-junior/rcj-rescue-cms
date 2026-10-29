// register the directive with your app module
var app = angular.module('FormEditor', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'color.picker', 'ngQuill']);

app.constant('NG_QUILL_CONFIG', {
    /*
     * @NOTE: this config/output is not localizable.
     */
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        ['blockquote', 'code-block'],
  
        [{ 'header': 1 }, { 'header': 2 }],               // custom button values
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'script': 'sub' }, { 'script': 'super' }],     // superscript/subscript
        [{ 'indent': '-1' }, { 'indent': '+1' }],         // outdent/indent
        [{ 'direction': 'rtl' }],                         // text direction
  
        [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  
        [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        [{ 'font': [] }],
        [{ 'align': [] }],
  
        ['clean'],                                         // remove formatting button
  
        ['link', 'image', 'video']                         // link and image, video
      ],
      imageResize: {
      },
      imageDropAndPaste: {
      }
    },
    theme: 'snow',
    debug: 'warn',
    placeholder: '',
    readOnly: false,
    bounds: document.body,
    scrollContainer: null
  })
  
  app.config([
    'ngQuillConfigProvider',
    'NG_QUILL_CONFIG',
  
    function (ngQuillConfigProvider, NG_QUILL_CONFIG) {
      ngQuillConfigProvider.set(NG_QUILL_CONFIG)
    }
  ])

// function referenced by the drop target
app.controller('FormEditorController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    let saved_mes;
    $translate('document.saved').then(function (val) {
        saved_mes = val;
    }, function (translationId) {
    // = translationId;
    });
    

    $translate('document.editor.import').then(function (val) {
        $("#select").fileinput({
            'showUpload': false,
            'showPreview': false,
            'showRemove': false,
            'showCancel': false,
            'msgPlaceholder': val,
            allowedFileExtensions: ['json'],
            msgValidationError: "ERROR"
        });
    }, function (translationId) {
        // = translationId;
    });    

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $http.get("/api/competitions/" + competitionId + "/documents/" + leagueId).then(function (response) {
        if(response.data.blocks) $scope.blocks = response.data.blocks;
        else $scope.blocks = []
        if(response.data.notifications) $scope.notifications = response.data.notifications;
        else $scope.notifications = []
        if(response.data.languages) $scope.languages = response.data.languages;
        else $scope.languages = []
        if($scope.languages == null || $scope.languages.length != availableLangs.length){
            $scope.languages = [];
            for(let l of availableLangs){
                $scope.languages.push({
                    'language': l,
                    'enable': true
                });
            }
        }
        if(response.data.maxLength) $scope.maxLength = response.data.maxLength;
        else $scope.maxLength = null;
    })

    $http.get("/api/competitions/leagues/"+leagueId).then(function (response) {
        $scope.league = response.data
    });

    const currentLang = $translate.proposedLanguage() || $translate.use();
    const availableLangs =  $translate.getAvailableLanguageKeys();

    $scope.blocks = [];
    
    $scope.addBlock = function (number){
        let i18n = [{
            language: currentLang,
            title: '',
        }];

        for(let l of availableLangs){
            if(l != currentLang){
                i18n.push({
                    language: l,
                    title: '',
                });
            }
        }
        
        let tmp = {
            i18n: i18n,
            color: '2980b9',
            questions: []
        };
        $scope.blocks.splice(number,0,tmp);
        $scope.save();
    }

    $scope.moveBlock = function (origin, destination) {
        let temp = $scope.blocks[destination];
        $scope.blocks[destination] = $scope.blocks[origin];
        $scope.blocks[origin] = temp;
        $scope.save();
    };

    $scope.removeBlock = function (number){
        $scope.blocks.splice(number,1);
        $scope.save();
    }

    $scope.addQuestion = function (block, number, type){

        let i18n = [{
            language: currentLang,
            question: '',
            detail: '',
            example: '',
            options: [{
                value: 'option0',
                text: ''
            }]
        }];

        for(let l of availableLangs){
            if(l != currentLang){
                i18n.push({
                    language: l,
                    question: '',
                    detail: '',
                    example: '',
                    options: [{
                        value: 'option0',
                        text: ''
                    }]
                });
            }
        }

        let tmp = {
            i18n: i18n,
            type: type,
            required: true,
            fileName: '',
            scale: {
                least: 1,
                most: 5
            },
            maxLength: null
        };
        $scope.blocks[block].questions.splice(number,0,tmp);
        $scope.save();
    }

    $scope.moveQuestion = function (blockNo, origin, destination) {
        let temp = $scope.blocks[blockNo].questions[destination];
        $scope.blocks[blockNo].questions[destination] = $scope.blocks[blockNo].questions[origin];
        $scope.blocks[blockNo].questions[origin] = temp;
        $scope.save();
    };

    $scope.removeQuestion = function (blockNo, number){
        $scope.blocks[blockNo].questions.splice(number,1);
        $scope.save();
    }

    $scope.addOption = function(blockNo, questionNo, i18nNo){
        let otmp = {
            value: 'option'+$scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options.length,
            text: ''
        };
        $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options.push(otmp);
        $scope.save();
    }

    $scope.moveOption = function (blockNo, questionNo, i18nNo, origin, destination) {
        let temp = $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options[destination].text;
        $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options[destination].text = $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options[origin].text;
        $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options[origin].text = temp;
        $scope.save();
    };
    
    $scope.removeOption = function (blockNo, questionNo, i18nNo, number){
        $scope.blocks[blockNo].questions[questionNo].i18n[i18nNo].options.splice(number,1);
        $scope.save();
    }

    $scope.notifications = [];

    $scope.addNotice = function (number){
        let i18n = [{
            language: currentLang,
            title: '',
            description: ''
        }];

        for(let l of availableLangs){
            if(l != currentLang){
                i18n.push({
                    language: l,
                    title: '',
                    description: ''
                });
            }
        }
        
        let tmp = {
            i18n: i18n,
            color: '273c75',
            bkColor: 'ccffff'
        };
        $scope.notifications.splice(number,0,tmp);
        $scope.save();
    }

    $scope.moveNotice = function (origin, destination) {
        let temp = $scope.notifications[destination];
        $scope.notifications[destination] = $scope.notifications[origin];
        $scope.notifications[origin] = temp;
        $scope.save();
    };

    $scope.removeNotice = function (number){
        $scope.notifications.splice(number,1);
        $scope.save();
    }

    $scope.selectedTemplate = null;
    $http.get("/api/document/templates/documentForm").then(function (response) {
        $scope.templates = response.data
    })

    $scope.changeTemplate = function(){
        if(!$scope.selectedTemplate) return;
        $http.get(`/api/document/templates/documentForm/${$scope.selectedTemplate}`).then(function (response) {
            $scope.notifications = response.data.notifications;
            $scope.blocks = response.data.blocks;
            $scope.languages = response.data.languages;
        })
    }
    
    
    $scope.go = function (path) {
        window.location = path
    }

    
    
    $scope.save = function () {
        let data = {
            documents: {
                league: leagueId,
                notifications: $scope.notifications,
                blocks: $scope.blocks,
                languages: $scope.languages,
                maxLength: $scope.maxLength
            }
        }
      
        $http.put("/api/competitions/" + competitionId, data).then(function (response) {
            Toast.fire({
                type: 'success',
                title: saved_mes
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        });
    }

    function remove_id(data){
        for (var key in data) {
            if(key =="_id") delete data[key];
            if(key == "$$hashKey") delete data[key];
            if (typeof data[key] === "object") {
                remove_id(data[key]);
            }
        }
    }
    
    $scope.preview = function () {
        window.open("/admin/" + competitionId + '/documents/' + leagueId + '/preview', "Preview");
    }
    

    $scope.export = function () {
        var data = {
            notifications: $scope.notifications,
            blocks: $scope.blocks,
            languages: $scope.languages,
            maxLength: $scope.maxLength
        };
        remove_id(data);

        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data))
        var downloadLink = document.createElement('a')
        document.body.appendChild(downloadLink);
        downloadLink.setAttribute("href", dataStr)
        downloadLink.setAttribute("download", $scope.competition.name + '-' + $scope.league.name + '.json')
        downloadLink.click()
        document.body.removeChild(downloadLink);
    }

    // File APIに対応しているか確認
    if (window.File) {
        var select = document.getElementById('select');

        // ファイルが選択されたとき
        select.addEventListener('change', function (e) {
            // 選択されたファイルの情報を取得
            var fileData = e.target.files[0];

            var reader = new FileReader();
            // ファイル読み取りに失敗したとき
            reader.onerror = function () {
                alert('ファイル読み取りに失敗しました')
            }
            // ファイル読み取りに成功したとき
            reader.onload = function () {
                var data = JSON.parse(reader.result);
                $scope.notifications = data.notifications;
                $scope.blocks = data.blocks;
                $scope.languages = data.languages;
                $scope.maxLength = data.maxLength;
                $scope.$apply();
            }

            // ファイル読み取りを実行
            reader.readAsText(fileData);
        }, false);
    }

}]);



