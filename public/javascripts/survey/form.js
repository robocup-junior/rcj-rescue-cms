// register the directive with your app module
var app = angular.module('SurveyForm', ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'ngQuill', 'ngSanitize', 'ngFileUpload']);
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
  
        ['link']                         // link and image, video
      ]
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
app.controller('SurveyFormController', ['$scope', '$uibModal', '$log', '$http', '$translate','$sce', '$timeout', 'Upload', function ($scope, $uibModal, $log, $http, $translate, $sce, $timeout, Upload) {

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

    let upload_mes;
    $translate('document.uploaded').then(function (val) {
        upload_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let trans = [];
    function loadTranslation(tag){
        $translate(`survey.js.${tag}`).then(function (val) {
            trans[tag] = val;
        }, function (translationId) {
        // = translationId;
        });
    }

    loadTranslation("multiple");
    loadTranslation("onlyOnce");
    loadTranslation("submit");
    loadTranslation("submitButton");
    loadTranslation("cancelButton");
    loadTranslation("complete");

    const currentLang = $translate.proposedLanguage() || $translate.use();
    const availableLangs =  $translate.getAvailableLanguageKeys();

    $scope.token = token;
    $scope.teamId = teamId;

    $scope.currentLang = currentLang;
    $scope.displayLang = currentLang;
    $scope.editable = editable;

    $scope.rangeS =  (start, end) => [...Array((end - start) + 1)].map((_, i) => start + i);
    
    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $http.get("/api/teams/" + teamId).then(function (response) {
        $scope.team = response.data;
        $http.get(`/api/survey/question/${teamId}/${token}/${survId}`).then(function (response) {
            $scope.survey = response.data;

            $http.get(`/api/survey/teamList/${teamId}/${token}`).then(function (response) {
                let teamList = response.data
                console.log(teamList)
                for (let q of $scope.survey.questions) {
                    if (q.type == "teamVote") {
                        q.teamVote.teamList = teamList
                            .filter(t => t._id != teamId && q.teamVote.league.includes(t.league))
                            .map(t => `${t.teamCode} ${t.name}`);
                        console.log(q)
                    }
                }
            })
            

            $http.get(`/api/survey/answer/${teamId}/${token}/${survId}`).then(function (response) {
                let ans = response.data;
                $scope.answers = [];
                for(let a of ans){
                    $scope.answers[a.questionId] = a.answer;
                }
            })
            
            //Check 1st lang
            for(let l of $scope.survey.languages){
                if(l.language == $scope.displayLang && l.enable) return;
            }
    
            //Set alternative lang
            for(let l of $scope.survey.languages){
                if(l.enable){
                    $scope.displayLang = l.language;
                    return;
                }
            }
        })
    })


    $scope.int = function(n){
        return parseInt(n);
    }

    $scope.submit = async function () {
        let sendAns = [];
        for (let key in $scope.answers) {
            let tmp = {
                questionId: key,
                answer: $scope.answers[key]
            };
            sendAns.push(tmp);
        }
        
        let confirmMes = '';
        if($scope.survey.reEdit){
            confirmMes = trans["multiple"];
        }else{
            confirmMes = trans["onlyOnce"];
        }

        const {
            value: operation
        } = await swal({
            title: trans["submit"],
            text: confirmMes,
            type: "warning",
            showCancelButton: true,
            confirmButtonText: trans["submitButton"],
            cancelButtonText: trans["cancelButton"],
            confirmButtonColor: "#2ecc71",
        })

        if (operation) {
            $http.put(`/api/survey/answer/${teamId}/${token}/${survId}`, sendAns).then(function (response) {
                Swal.fire({
                    title: trans["complete"],
                    type: "success",
                    confirmButtonText: `OK`,
                  }).then((result) => {
                    window.location = `/mypage/${teamId}/${token}`;
                  })
                
            }, function (response) {
                Swal.fire(
                    'Oops!',
                    response.data.msg,
                    'error'
                )
            });
        }
    }


    $scope.deadline = function(time){
        if(!time) return;
        let d = new Date(time);
        let options = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long" };
        return(new Intl.DateTimeFormat(navigator.language, options).format(d));
    }

    $scope.isPastDeadline = function () {
        if (!$scope.survey || !$scope.survey.deadline) {
            return false;
        }
        const deadline = new Date($scope.survey.deadline);
        const now = new Date();
        return now > deadline;
    };

    $scope.langContent = function(data, target){
        if(!data) return;
        if(data[target]) return data[target];
        data[target] = $sce.trustAsHtml(data.filter( function( value ) {
            return value.language == $scope.displayLang;        
        })[0][target]);

        return(data[target]);
    }

    $scope.langArray = function(data, target){
        if(data[target]) return data[target];
        data[target] = data.filter( function( value ) {
            return value.language == $scope.displayLang;        
        })[0][target];
        return(data[target]);
    }

    
    $scope.changeLocale = function(){
        $scope.go('/locales');
    }

    $scope.go = function (path) {
        window.location = path
    }

    $scope.uploadFiles = function(question, file, errFiles) {
        question.f = file;
        question.errFile = errFiles && errFiles[0];
        if(question.errFile){
            Toast.fire({
                type: 'error',
                title: "Error",
                html: question.errFile.$error + ' : ' + question.errFile.$errorParam
            })
        }
        if (file) {            
            question.uploading = true;
            file.upload = Upload.upload({
                url: `/api/survey/answer/${$scope.team._id}/${token}/${survId}/file/${question.questionId}`,
                data: {file: file}
            });

            file.upload.then(function (response) {
                $timeout(function () {
                    $scope.answers[question.questionId] = response.data.fileName;
                    file.result = response.data;
                    Toast.fire({
                        type: 'success',
                        title: upload_mes
                    })
                    delete question.f;
                    question.uploading = false;
                });
            }, function (response) {
                if (response.status > 0){
                     question.errorMsg = response.status + ': ' + response.data.msg;
                     Toast.fire({
                        type: 'error',
                        title: "Error: " + response.statusText,
                        html: response.data.msg
                    })
                }
            }, function (evt) {
                file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
            });
        }   
    }

}]);
