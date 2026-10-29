var app = angular.module("MailHome", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'ngQuill', 'mailCompose']);
app.controller('MailHomeController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

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

    let sending_mes;
    $translate('mail.home.js.sending').then(function (val) {
        sending_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let wait_mes;
    $translate('mail.home.js.wait').then(function (val) {
        wait_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let complete_mes;
    $translate('mail.home.js.complete').then(function (val) {
        complete_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let completeMes_mes;
    $translate('mail.home.js.completeMes').then(function (val) {
        completeMes_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.competitionId = competitionId;
    $scope.mailEnable = mailEnable;

    $scope.mode = "select";

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
        console.log($scope.competition)
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


    $http.get("/api/competitions/" + competitionId + "/adminTeams").then(function (response) {
        $scope.teams = response.data;

        $scope.showCode = false;
        for(let t of $scope.teams){
            if(t.teamCode != ""){
                $scope.showCode = true;
                break;
            }
        }
    })


    // The competition's staff: the users with a level or a role in it
    $http.get("/api/mail/staff/" + competitionId).then(function (response) {
        $scope.staff = response.data;
    })

    let levelName = {};
    for (let level of [0, 1, 5, 10]) {
        $translate('admin.authority.level' + level).then(function (val) {
            levelName[level] = val;
        }, function (translationId) {
            levelName[level] = translationId;
        });
    }
    $scope.levelName = function (accessLevel) {
        if (accessLevel >= 10) return levelName[10];
        if (accessLevel >= 5) return levelName[5];
        if (accessLevel >= 1) return levelName[1];
        return levelName[0];
    }

    // To the teams or to the staff
    $scope.target = "team";
    $scope.switchTarget = function (target) {
        if ($scope.target == target) return;
        angular.forEach($scope.teams, function (team) { team.checked = false; });
        angular.forEach($scope.staff, function (user) { user.checked = false; });
        $scope.selectedAll = false;
        $scope.target = target;
        loadTemplates();
    }

    // The templates of the mails to the teams, or of those to the staff (mails of their own): each a
    // card with the beginning of its text, to start a mail from
    $scope.templates = [];
    const templateQuery = () => $scope.target == "staff" ? "?kind=staff" : "";
    function loadTemplates(){
        const query = templateQuery();
        return $http.get("/api/mail/templates" + query).then(function (response) {
            // Not those of the other kind, switched from meanwhile
            if (query != templateQuery()) return;
            // The system's own (named _...) after the others
            $scope.templates = response.data.map((template) => Object.assign(template, {system: template.name.startsWith('_')}))
                .sort((a, b) => (a.system - b.system) || a.name.localeCompare(b.name));
            for (let template of $scope.templates) {
                $http.get(`/api/mail/templates/${encodeURIComponent(template.path)}${query}`).then(function (res) {
                    template.content = MailCompose.clean(res.data);
                    const html = String(res.data).replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, '$& ');
                    template.snippet = new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
                })
            }
        })
    }
    loadTemplates();

    $scope.templateQuery = "";
    $scope.showGallery = false;
    $scope.templateFilter = function (template) {
        const q = $scope.templateQuery.toLowerCase();
        return !q || template.name.toLowerCase().includes(q) || (template.snippet || "").toLowerCase().includes(q);
    }

    $scope.useTemplate = async function(template){
        if($scope.hasContent() || $scope.mailTitle){
            const result = await Swal({
                type: 'warning',
                title: $translate.instant('mail.home.js.overwrite'),
                showCancelButton: true,
            });
            if(!result.value) return;
        }
        $scope.$evalAsync(function(){
            $scope.mailContent = template.content || "";
            $scope.mailTitle = template.name;
            $scope.showGallery = false;
        });
    }

    // What is written kept as a template, named by the subject unless said otherwise
    $scope.saveAsTemplate = async function(){
        const result = await Swal({
            title: $translate.instant('mail.home.saveAsTemplate'),
            input: 'text',
            inputValue: $scope.mailTitle || "",
            inputPlaceholder: $translate.instant('admin.mailTemplates.subject'),
            showCancelButton: true,
            inputValidator: (value) => !value.trim() && $translate.instant('mail.home.js.templateName'),
        });
        if(!result.value) return;
        const name = result.value.trim();
        if($scope.templates.some((t) => t.name == name)){
            const overwrite = await Swal({
                type: 'warning',
                title: $translate.instant('mail.home.js.templateExists', {name: name}),
                showCancelButton: true,
            });
            if(!overwrite.value) return;
        }
        $http.post(`/api/mail/templates/${encodeURIComponent(name)}.html${templateQuery()}`, {content: $scope.mailContent}).then(function () {
            Toast.fire({type: 'success', title: $translate.instant('mail.home.js.templateSaved', {name: name})});
            loadTemplates();
        }, function (error) {
            Swal({type: 'error', title: "ERROR", text: error.data.msg});
        })
    }

    // The mail being written kept in the browser, offered again when a mail is next written
    const draftKey = () => `mailDraft:${competitionId}:${$scope.target}`;
    function readDraft(){
        try {
            const draft = JSON.parse(localStorage.getItem(draftKey()));
            return draft && (draft.title || MailCompose.hasContent(draft.content)) ? draft : null;
        } catch (e) {
            return null;
        }
    }
    function clearDraft(){
        try { localStorage.removeItem(draftKey()); } catch (e) { /* not kept */ }
        $scope.draft = null;
    }
    let draftTimer = null;
    $scope.$watchGroup(['mailTitle', 'mailContent'], function () {
        if ($scope.mode != "write" || $scope.draft) return;
        clearTimeout(draftTimer);
        draftTimer = setTimeout(function () {
            if (!$scope.mailTitle && !$scope.hasContent()) return;
            try {
                localStorage.setItem(draftKey(), JSON.stringify({title: $scope.mailTitle, content: $scope.mailContent, time: Date.now()}));
            } catch (e) { /* not kept */ }
        }, 800);
    });
    $scope.restoreDraft = function(){
        $scope.mailTitle = $scope.draft.title;
        $scope.mailContent = MailCompose.clean($scope.draft.content);
        $scope.draft = null;
    }
    $scope.discardDraft = clearDraft;

    $scope.go = function (path) {
        window.location = path
    }

    $scope.open = function (path){
        window.open(path, "_blank");
    }

    $scope.selectedCount = function () {
        let list = $scope.target == "staff" ? $scope.staff : $scope.teams;
        return (list || []).filter((r) => r.checked).length;
    }

    $scope.withoutEmail = function (list) {
        return (list || []).filter((r) => (r.hasEmail === undefined ? !$scope.validEmail(r.email) : !r.hasEmail)).length;
    }

    $scope.selectedAll = false;
    $scope.selectAll = function () {
        if($scope.target == "staff"){
            angular.forEach($scope.staff, function (user) {
                user.checked = !$scope.selectedAll && user.hasEmail && !!$scope.staff_filter(user);
            });
            $scope.selectedAll = !$scope.selectedAll;
            return;
        }
        if($scope.selectedAll){
            angular.forEach($scope.teams, function (team) {
                team.checked = false;
            });
            $scope.selectedAll = false;
        }else{
            angular.forEach($scope.teams, function (team) {
                if($scope.list_filter(team) && $scope.validEmail(team.email)){
                    team.checked = true;
                    $scope.selectedAll = true;
                }
            });
        }
        
    }

    $scope.newEmail2SelectedTeam = function () {
        let chk = [];
        angular.forEach($scope.target == "staff" ? $scope.staff : $scope.teams, function (team) {
            if (team.checked) chk.push(team);
        });
        $scope.toTeam = chk;
        prepareVariable();
    }

    function prepareVariable(){
        $scope.triedPreview = false;
        $scope.showAllRecipients = false;
        $scope.draft = !$scope.mailTitle && !$scope.hasContent() ? readDraft() : null;
        if($scope.target == "staff"){
            for(let user of $scope.toTeam){
                user.variable = {
                    "userName": user.username,
                    "competitionName": $scope.competition.name,
                    "competitionId": $scope.competition._id,
                    "accessLevel": $scope.levelName(user.accessLevel),
                    "role": user.role.join(", "),
                    "loginUrl": `${location.protocol}//${location.host}/login`
                };
            }
            $scope.mode = "write";
            window.scrollTo(0,0);
            return;
        }
        for(let i=0; i<$scope.toTeam.length; i++){
            let teamDeadline = $scope.toTeam[i].document.deadline;
            let deadline = $scope.competition.documents.deadline;
            if(teamDeadline != null) deadline = teamDeadline;

            let d = new Date(deadline * 1000);
            let options = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long" };
            let optionsUTC = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long", timeZone:"UTC"};
            $scope.toTeam[i].variable = {
                "teamName": $scope.toTeam[i].name,
                "teamId": $scope.toTeam[i]._id,
                "competitionName": $scope.competition.name,
                "competitionId": $scope.competition._id,
                "leagueId": $scope.toTeam[i].league,
                "league": $scope.leagueName[$scope.toTeam[i].league],
                "deadlineUNIX": deadline,
                "deadlineLocal": new Intl.DateTimeFormat(navigator.language, options).format(d),
                "deadlineUTC": new Intl.DateTimeFormat('en-US', optionsUTC).format(d),
                "documentUrl": `${location.protocol}//${location.host}/document/${$scope.toTeam[i]._id}/${$scope.toTeam[i].document.token}`,
                "mypageUrl": `${location.protocol}//${location.host}/mypage/${$scope.toTeam[i]._id}/${$scope.toTeam[i].document.token}`
            };
        }
        $scope.mode = "write";
        window.scrollTo(0,0);
    }

    $scope.validEmail = function(mail){
        function MailCheck(mail) {
            // Literals: in a string, \. was only . (any letter) and \[\] only []
            var mail_regex1 = /(?:[-!#-'*+\/-9=?A-Z^-~]+\.?(?:\.[-!#-'*+\/-9=?A-Z^-~]+)*|"(?:[!#-\[\]-~]|\\[\x09 -~])*")@[-!#-'*+\/-9=?A-Z^-~]+(?:\.[-!#-'*+\/-9=?A-Z^-~]+)*/;
            var mail_regex2 = /^[^@]+@[^@]+$/;
            if( mail.match( mail_regex1 ) && mail.match( mail_regex2 ) ) {
                if( mail.match( /[^a-zA-Z0-9\!\"\#\$\%\&\'\(\)\=\~\|\-\^\\\@\[\;\:\]\,\.\/\\\<\>\?\_\`\{\+\*\} ]/ ) ) { return false; }
                if( !mail.match( /\.[a-z]+$/ ) ) { return false; }
                return true;
            } else {
                return false;
            }
        }
        if(!mail || mail.length == 0) return false;
        for(let m of mail){
            if(MailCheck(m)) return true;
        }
    }

    $scope.newMail = function(team){
        $scope.toTeam = [team];
        prepareVariable();
        
    }

    $scope.back2TeamSelect = function(){
        $scope.toTeam = [];
        $scope.mode = "select";
        window.scrollTo(0,0);
    }

    $scope.mailContent = "";
    $scope.mailTitle = "";


    $scope.previewNo = 0;
    $scope.hasContent = function(){
        return MailCompose.hasContent($scope.mailContent);
    }

    $scope.preview = function(){
        $scope.triedPreview = true;
        if(!$scope.mailTitle || !$scope.hasContent()) return;
        $scope.previewNo = 0;
        for(let team of $scope.toTeam){
            team.mailData = MailCompose.renderMail($scope.mailTitle, $scope.mailContent, team.variable);
        }
        // What may be wrong with it, before it is sent
        $scope.checks = MailCompose.check($scope.mailTitle, $scope.mailContent, $scope.toTeam[0].variable);
        $scope.mode = "preview";
        window.scrollTo(0,0);
    }

    $scope.changePreviewNo = function(n){
        $scope.previewNo += n;
    }

    $scope.back2Edit = function(){
        $scope.mode = "write";
        window.scrollTo(0,0);
    }


    $scope.time = function(time){
        let options = {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"};
        return(new Intl.DateTimeFormat(navigator.language, options).format(time));
    }

    // The mail being previewed, sent to the user who writes it
    $scope.testSend = function(){
        const mail = $scope.toTeam[$scope.previewNo];
        $scope.sending = true;
        $http.post(`/api/mail/test/${competitionId}`, {mailData: mail.mailData}).then(function (response) {
            $scope.sending = false;
            Toast.fire({
                type: 'success',
                title: $translate.instant('mail.home.js.testSent', {to: response.data.to})
            })
        }, function (error) {
            $scope.sending = false;
            Swal({
                type: 'error',
                title: "ERROR",
                text: error.data.msg
            })
        })
    }

    $scope.sending = false;
    $scope.mailSend = async function(){
        const n = $scope.toTeam.length;
        const issues = ($scope.checks || []).filter((c) => c.level == 'danger').length;
        const confirmed = await Swal({
            type: issues ? 'warning' : 'question',
            title: $translate.instant($scope.reservation ? 'mail.home.js.confirmReserve' : 'mail.home.js.confirmSend', {n: n}),
            text: [$scope.reservation ? $scope.time($scope.reservation) : '', issues ? $translate.instant('mail.home.js.withIssues', {n: issues}) : ''].filter((x) => x).join(' / '),
            showCancelButton: true,
            confirmButtonText: $translate.instant($scope.reservation ? 'mail.home.reservation' : 'mail.home.send'),
        });
        if (!confirmed.value) return;
        $scope.$apply(function(){ send(); });
    }

    function send(){
        $scope.sending = true;
        Swal({
            title: sending_mes,
            html: wait_mes,
            onBeforeOpen: () => {
                Swal.showLoading()
                let url = $scope.target == "staff" ? `/api/mail/staff/${competitionId}` : `/api/mail/send`;
                $http.post(url, {data: $scope.toTeam, reservation: $scope.reservation}).then(function (response) {
                    Swal.close()
                    Swal({
                        type: 'success',
                        title: complete_mes,
                        text: completeMes_mes,
                        showCancelButton: true,
                        confirmButtonText: $translate.instant('mail.home.deliveryStatus'),
                        cancelButtonText: $translate.instant('mail.home.js.writeAnother'),
                    }).then(function (result) {
                        if (result.value) $scope.go('/admin/' + competitionId + '/mails/sent');
                    })
                    $scope.toTeam = [];
                    angular.forEach($scope.teams, function (team) { team.checked = false; });
                    angular.forEach($scope.staff, function (user) { user.checked = false; });
                    $scope.selectedAll = false;
                    $scope.mailContent = "";
                    $scope.mailTitle = "";
                    $scope.previewNo = 0;
                    $scope.mode = "select";
                    clearDraft();
                    $scope.sending = false;
                    $scope.reservation = undefined;
                    $scope.triedPreview = false;
                    
                }, function (error) {
                    console.log(error)
                    Swal.close()
                    $scope.sending = false;
                    Swal({
                        type: 'error',
                        title: "ERROR",
                        text: error.data.msg
                    })
                })
            }
        })
    }

    var showAllLeagues = true;
    $scope.refineName = "";
    $scope.refineCode = "";
    $scope.refineRegion = "";

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
        return (showAllLeagues || $scope.Rleagues[value.league])  && (~value.name.indexOf($scope.refineName)) && (~value.teamCode.indexOf($scope.refineCode)) && (~value.country.indexOf($scope.refineRegion))
    }

    $scope.refineUser = "";
    $scope.staff_filter = function (value, index, array) {
        return ~value.username.indexOf($scope.refineUser)
    }


    // What was written is not lost by leaving the page unasked
    window.addEventListener('beforeunload', function (e) {
        if ($scope.mode != "select" && ($scope.hasContent() || $scope.mailTitle) && !$scope.sending) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}]);
