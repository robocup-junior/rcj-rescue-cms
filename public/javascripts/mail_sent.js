var app = angular.module("MailSent", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('MailSentController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

    let eventLog_mes;
    $translate('mail.sent.js.eventLog').then(function (val) {
        eventLog_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let event_mes;
    $translate('mail.sent.js.event').then(function (val) {
        event_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let user_mes;
    $translate('mail.sent.js.user').then(function (val) {
        user_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let time_mes;
    $translate('mail.sent.time').then(function (val) {
        time_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let deliveredTo_mes;
    $translate('mail.home.deliveredTo').then(function (val) {
        deliveredTo_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let mail_mes;
    $translate('common.mail').then(function (val) {
        mail_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.competitionId = competitionId;

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $scope.Rleagues = {};
    $scope.leagueName = [];
    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagues = response.data;
        
        for(let l of $scope.leagues){
            $scope.Rleagues[l.id] = false;
            $scope.leagueName[l.id] = l.name;
        }
    })


    $scope.mailEnable = mailEnable;
    $scope.loading = false;
    $scope.load = function () {
        $scope.loading = true;
        $http.get("/api/mail/sent/" + competitionId).then(function (response) {
            // To a team, or to a user of the staff
            $scope.mails = response.data.filter(m=>m.team != null || m.user != null);
            $scope.loading = false;
        }, function () {
            $scope.loading = false;
        })
    }
    $scope.load();

    // The states, each with the number of the mails in it, and the one the list is refined to
    $scope.STATUSES = [-1, 0, 1, 2, -2];
    $scope.refineStatus = null;
    $scope.countOf = function (status) {
        return ($scope.mails || []).filter((m) => m.status == status).length;
    }
    $scope.toggleStatus = function (status) {
        $scope.refineStatus = $scope.refineStatus === status ? null : status;
    }

    // To the teams, the staff, or both
    $scope.refineType = "all";


    $scope.go = function (path) {
        window.location = path
    }

    $scope.open = function (path){
        window.open(path, "_blank");
    }

    $scope.time = function(time){
        let options = {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"};
        return(new Intl.DateTimeFormat(navigator.language, options).format(time*1000));
    }

    $scope.mailView = function(mail){
        let mailUrl = `/api/mail/sent/${mail.competition}/${mail.mailId}`;
        $http.get(mailUrl).then(function (response) {
            let html = response.data.html;
            let plain = response.data.plain.replace(/\r?\n/g, '<br>');
            Swal.fire({
                html:'<ul class="nav nav-tabs" id="mailType" role="tablist"><li class="nav-item"><a class="nav-link active" id="html-tab" data-toggle="tab" href="#html" role="tab" aria-controls="html" aria-selected="true">HTML</a></li><li class="nav-item"><a class="nav-link" id="plain-tab" data-toggle="tab" href="#plain" role="tab" aria-controls="plain" aria-selected="false">Plain Text</a></li></ul>'+
                '<div class="tab-content" id="mailTypeContent">'+
                    '<div class="tab-pane fade show active" id="html" role="tabpanel" aria-labelledby="html-tab" style="text-align:left;max-height:calc(100vh - 200px);overflow:auto;">' + html +'</div>'+
                    '<div class="tab-pane fade" id="plain" role="tabpanel" aria-labelledby="plain-tab" style="text-align:left;max-height:calc(100vh - 200px);overflow:auto;">' + plain + '</div>'+
                '</div>',
                width: "100%",
                height: "100%",
                showCloseButton: true, 
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
        
    }

    $scope.statusColour = function(status){
        switch(status){
            case -2:
              return "#ffadad";
            case -1:
              return "#e2e8f0";
            case 0:
              return "#b2ffff";
            case 1:
              return "#ffffcc";
            case 2:
              return "#ccffe5";
            default:
              return "";
          }
    }

    $scope.detail = function(mail){
        let mailUrl = `/api/mail/event/${mail.competition}/${mail.mailId}`;
        let html = `<div style="max-height:calc(100vh - 200px);overflow:auto;">`;
        html += `<h3>${deliveredTo_mes}</h3><table class='custom'><tbody>`;
        for(let m of mail.to){
            html += `<tr><td>${m}</td></tr>`;
        }
        html += "</tbody></table><br>";
        $http.get(mailUrl).then(function (response) {
            html += `<h3>${eventLog_mes}</h3><table class='custom'><thead><tr><th>${time_mes}</th><th>${user_mes}</th><th>${event_mes}</th></tr></thead><tbody>`;
            for(let e of response.data){
                html += `<tr><td>${$scope.time(e.time)}</td><td>${e.user}</td><td>${e.event}</td></tr>`;
            }
                
            html += "</tbody></table></div>";
            Swal.fire({
                html: html,
                width: "100%",
                height: "100%",
                showCloseButton: true, 
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
        
    }

    var showAllLeagues = true;
    $scope.refineName = "";
    $scope.refineCode = "";
    $scope.refineRegion = "";
    $scope.refineSubject = "";

    $scope.$watch('Rleagues', function (newValue, oldValue) {
        showAllLeagues = true
        //console.log(newValue)
        for (let league in newValue) {
            if (newValue.hasOwnProperty(league)) {
                if (newValue[league]) {
                    showAllLeagues = false
                    return
                }
            }
        }
    }, true);

    $scope.list_filter = function (value, index, array) {
        if($scope.refineStatus !== null && value.status != $scope.refineStatus) return false;
        if($scope.refineType == "team" && value.team == null) return false;
        if($scope.refineType == "staff" && value.user == null) return false;
        if(value.team == null){
            // To the staff: of no team, nor league
            return value.user != null && showAllLeagues && (~value.subject.indexOf($scope.refineSubject)) && (~value.user.username.indexOf($scope.refineName)) && $scope.refineCode == "" && $scope.refineRegion == "";
        }
        return (showAllLeagues || $scope.Rleagues[value.team.league]) && (~value.subject.indexOf($scope.refineSubject))  && (~value.team.name.indexOf($scope.refineName)) && (~value.team.teamCode.indexOf($scope.refineCode)) && (~value.team.country.indexOf($scope.refineRegion))
    }

}]);

