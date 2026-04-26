var app = angular.module("MyPage", ['ngTouch','ngAnimate', 'pascalprecht.translate', 'ngCookies']);

app.controller("MyPageController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    const currentLang = $translate.proposedLanguage() || $translate.use();
    const availableLangs =  $translate.getAvailableLanguageKeys();
    
    $scope.competitionId = competitionId

    $scope.docEditable = false;

    $scope.go = function (path) {
        window.location = path
    }

    $scope.goResv = function (id) {
        window.open(`/mypage/${teamId}/${token}/reservation/${id}`, '_blank');
    }

    $scope.goSurv = function (id) {
        window.open(`/mypage/${teamId}/${token}/survey/${id}`, '_blank');
    }

    $scope.getLeagueName = function (id){
        return($scope.leagues.find(l => l.id === id).name)
    }
    
    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagueName = response.data.find(l => l.id === leagueId).name;
        $http.get("/api/competitions/" + competitionId).then(function (response) {
            $scope.competition = response.data
            let useDeadline = $scope.competition.documents.deadline;
            if(teamDocDeadline){
                useDeadline = teamDocDeadline;
            }
            if(new Date() < new Date(useDeadline * 1000)){
                $scope.docEditable = true;
            }
        })
    })

    $http.get(`/api/mail/my/${teamId}/${token}`).then(function (response) {
        $scope.mails = response.data;
    })

    $http.post(`/api/reservation/list/${competitionId}`,{
        team: teamId,
        league: leagueId
    }).then(function (response) {
        $scope.reservations = response.data;
        for(let resv of $scope.reservations){
            let name = resv.i18n.filter(i => i.language == currentLang && resv.languages.some( l => l.language == i.language && l.enable));
            if(name.length == 1){
                resv.name = name[0].name;
                resv.myDescription = name[0].myDescription;
            }else{
                let name = resv.i18n.filter(i => resv.languages.some( l => l.language == i.language && l.enable));
                if(name.length > 0){
                    resv.name = name[0].name;
                    resv.myDescription = name[0].myDescription;
                }
            }

            if(new Date(resv.deadline) < new Date()) resv.editable = false;
            else resv.editable = true;
        }
    })

    $http.get(`/api/survey/list/${competitionId}/${leagueId}/${teamId}`).then(function (response) {
        $scope.survey = response.data;
        for(let suvr of $scope.survey){
            let name = suvr.i18n.filter(i => i.language == currentLang && suvr.languages.some( l => l.language == i.language && l.enable));
            if(name.length == 1){
                suvr.name = name[0].name;
                suvr.myDescription = name[0].myDescription;
            }else{
                let name = suvr.i18n.filter(i => suvr.languages.some( l => l.language == i.language && l.enable));
                if(name.length > 0){
                    suvr.name = name[0].name;
                    suvr.myDescription = name[0].myDescription;
                }
            }

            suvr.editable = true;
            if(new Date(suvr.deadline) < new Date()) suvr.editable = false;
            else if(!suvr.reEdit && suvr.sent) suvr.editable = false;
        }
    })


    $scope.time = function(time){
        let options = {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"};
        return(new Intl.DateTimeFormat(navigator.language, options).format(time*1000));
    }

    $scope.mailView = function(mail){
        var mailUrl = "/api/mail/get/" + teamId + "/" + token + "/" + mail.mailId;
        $http.get(mailUrl).then(function (response) {
            var html = response.data.html || "";
            var subject = mail.subject || "";
            var time = $scope.time(mail.time);

            var modalHtml = 
                '<div class="mail-modal-header">' +
                    '<div class="mail-modal-subject">' + subject + '</div>' +
                    '<div class="mail-modal-meta">' +
                        '<i class="far fa-calendar-alt"></i> ' +
                        '<span>' + time + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="mail-content-area" style="text-align:left; max-height:calc(100vh - 250px); overflow:auto;">' + 
                    html + 
                '</div>';

            Swal.fire({
                html: modalHtml,
                width: "100%",
                height: "100%",
                showCloseButton: true,
                showConfirmButton: false
            })
        }, function (response) {
            Toast.fire({
                type: 'error',
                title: "Error: " + response.statusText,
                html: response.data.msg
            })
        })
    }

    function compositeColor(code, alpha) {
        const colorCode = parseInt(code, 16) * alpha + 255 * (1 - alpha);
        return Math.floor(colorCode).toString(16);
    }
      
    function convertToPaleColor(colorCode, alpha) {
        const codes = [colorCode.slice(0, 2), colorCode.slice(2, 4), colorCode.slice(4, 6)];
        return codes.map(code => compositeColor(code, alpha)).join("");
    }

    $scope.editableColour = function(colour, editable){
        if(editable) return {'background-color': `#${colour}`};
        return {'background-color': `#${convertToPaleColor(colour, 0.8)}`};
    }

    
}])
