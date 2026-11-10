var app = angular.module("TemplateEditor", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'ngQuill', 'mailCompose']);
app.controller('TemplateEditorController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', '$timeout', function ($scope, $uibModal, $log, $http, $translate, $sce, $timeout) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
      
    let complete_mes;
    $translate('admin.mailTemplates.js.complete').then(function (val) {
        complete_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let completeMes_mes;
    $translate('admin.mailTemplates.js.completeMes').then(function (val) {
        completeMes_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.subject = subject;
    // A template of the mails to the teams, or to the staff: with their variables only
    $scope.kind = kind;
    const kindQuery = kind == 'staff' ? '?kind=staff' : '';

    $scope.go = function (path) {
        window.location = path
    }

    $scope.toTeam = kind == 'staff' ? [] : [
        {
            "name": "Team name here",
            "document":{
                "deadline": null
            },
            "_id": "XXXXXXXXXXXXXXXXX",
            "league": "League",
        }
    ];
    prepareVariable();

    function prepareVariable(){
        for(let i=0; i<$scope.toTeam.length; i++){
            let teamDeadline = $scope.toTeam[i].document.deadline;
            let deadline = 1800000000;
            if(teamDeadline != null) deadline = teamDeadline;

            let d = new Date(deadline * 1000);
            let options = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long" };
            let optionsUTC = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long", timeZone:"UTC"};
            $scope.toTeam[i].variable = {
                "teamName": $scope.toTeam[i].name,
                "teamId": $scope.toTeam[i]._id,
                "competitionName": "Competition name here",
                "competitionId": "YYYYYYYYYYYYYYYYYY",
                "leagueId": $scope.toTeam[i].league,
                "league": "League name here",
                "deadlineUNIX": deadline,
                "deadlineLocal": new Intl.DateTimeFormat(navigator.language, options).format(d),
                "deadlineUTC": new Intl.DateTimeFormat('en-US', optionsUTC).format(d),
                "documentUrl": `${location.protocol}//${location.host}/document/${$scope.toTeam[i]._id}/ZZZZZZZZZZZZZZZZZZZZZZZ`,
                "mypageUrl": `${location.protocol}//${location.host}/mypage/${$scope.toTeam[i]._id}/ZZZZZZZZZZZZZZZZZZZZZZZ`
            };
        }
        if (kind != 'staff') return;
        $scope.toTeam.push({
            "name": "Staff name here",
            "variable": {
                "userName": "Staff name here",
                "competitionName": "Competition name here",
                "competitionId": "YYYYYYYYYYYYYYYYYY",
                "accessLevel": "Judge",
                "role": "INTERVIEW",
                "loginUrl": `${location.protocol}//${location.host}/login`
            }
        });
    }

    // Saved as it was loaded: what is written since then is the template's unsaved changes
    let saved = {subject: $scope.subject, content: ""};
    let ready = false;
    $scope.mailContent = "";
    function loaded(){
        // Once the editor has read the content in (as it writes it again)
        $timeout(function(){
            saved = {subject: $scope.subject, content: $scope.mailContent};
            ready = true;
        }, 300);
    }
    if($scope.subject!=""){
        $http.get(`/api/mail/templates/${encodeURIComponent($scope.subject)}.html${kindQuery}`).then(function (response) {
            $scope.mailContent = MailCompose.clean(response.data);
            loaded();
        })
    } else {
        loaded();
    }

    $scope.dirty = function(){
        return ready && ($scope.subject !== saved.subject || $scope.mailContent !== saved.content);
    }

    // What may be wrong with the template, as it is written (the preview is beside it)
    $scope.$watchGroup(['subject', 'mailContent'], function(){
        const values = {};
        $scope.toTeam.forEach((r) => Object.assign(values, r.variable));
        $scope.checks = MailCompose.check($scope.subject, $scope.mailContent, values)
            .filter((c) => c.key != 'noSubject' && c.key != 'noContent');
    });

    // Saved where it is written: a subject changed is a template of its own (the one it was made from
    // is kept)
    $scope.save = function(){
        $scope.triedSave = true;
        if(!$scope.subject || !MailCompose.hasContent($scope.mailContent)) return;
        const name = $scope.subject;
        const copied = saved.subject != "" && name !== saved.subject;
        $scope.saving = true;
        $http.post(`/api/mail/templates/${encodeURIComponent(name)}.html${kindQuery}`, {content: $scope.mailContent}).then(function () {
            $scope.saving = false;
            saved = {subject: name, content: $scope.mailContent};
            history.replaceState(null, '', `/admin/mailTemplates/editor/${encodeURIComponent(name)}${kindQuery}`);
            Toast.fire({
                type: 'success',
                title: copied ? $translate.instant('admin.mailTemplates.js.savedAs', {name: name}) : complete_mes
            })
        }, function (error) {
            $scope.saving = false;
            Swal({
                type: 'error',
                title: "ERROR",
                text: error.data.msg || error.data.message
            })
        })
    }

    // ⌘/Ctrl+S saves
    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key == 's') {
            e.preventDefault();
            $scope.$apply($scope.save);
        }
    });

    // What is written is not lost by leaving the page unasked
    window.addEventListener('beforeunload', function (e) {
        if ($scope.dirty()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

}]);
