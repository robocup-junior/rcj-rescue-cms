var app = angular.module("TeamAdmin", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("TeamAdminController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
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
    
    $scope.competitionId = competitionId;
    $scope.email = [""];
    $scope.showFilter = true;
    $scope.showAddTeam = false;
    updateTeamList();

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    $scope.Rleagues = {};
    $http.get("/api/teams/leagues").then(function (response) {
        $scope.leagues = response.data;
        
        for(let l of $scope.leagues){
            $scope.Rleagues[l] = false;
        }
    })

    $scope.teamCode = "";

    $scope.addTeam = function () {
        var team = {
            teamCode: $scope.teamCode,
            name: $scope.teamName,
            league: $scope.teamLeague,
            competition: competitionId,
            country: $scope.country,
            email : $scope.email.filter(function (email) { return email; })
        };

        $http.post("/api/teams", team).then(function (response) {
            console.log(response)
            updateTeamList()
            Toast.fire({
                type: 'success',
                title: saved_mes
            })
        }, function (error) {
            console.log(error)
            Toast.fire({
                type: 'error',
                title: "ERROR",
                html: error.data.msg
            })
        })
    };

    $scope.addEmail = function(){
        $scope.email.push("");
    }

    $scope.removeEmail = function(index){
        $scope.email.splice(index, 1);
        if (!$scope.email.length) $scope.email.push("");
    }

    $scope.addTeamEmail = function(team){
        if (!Array.isArray(team.email)) team.email = [];
        team.email.push("");
    }

    $scope.removeTeamEmail = function(team, index){
        if (!Array.isArray(team.email)) {
            team.email = [];
            return;
        }
        team.email.splice(index, 1);
    }


    $scope.edit = function (team) {
        if (!Array.isArray(team.email)) team.email = [];
        team.email = team.email.filter(function (email) { return email; });
        team.edit = true;
    }

    $scope.update = function (team) {
        if (!Array.isArray(team.email)) team.email = [];
        team.email = team.email.filter(function (email) { return email; });
        $http.put("/api/teams/" + team.competition + "/" + team._id, team).then(function (response) {
            updateTeamList()
            Toast.fire({
                type: 'success',
                title: saved_mes
            })
            team.edit = false;
        }, function (error) {
            console.log(error)
            Toast.fire({
                type: 'error',
                title: "ERROR",
                html: error.data.message
            })
        })   
    }

    $scope.allVisibleChecked = function () {
        let hasVisibleTeam = false;
        let allChecked = true;
        angular.forEach($scope.teams, function (team) {
            if ($scope.list_filter(team)) {
                hasVisibleTeam = true;
                allChecked = allChecked && !!team.checked;
            }
        });
        return hasVisibleTeam && allChecked;
    }

    $scope.toggleAll = function () {
        const shouldCheck = !$scope.allVisibleChecked();
        angular.forEach($scope.teams, function (team) {
            if($scope.list_filter(team)) team.checked = shouldCheck;
        });
    }

    $scope.hasSelectedTeams = function () {
        let hasSelected = false;
        angular.forEach($scope.teams, function (team) {
            hasSelected = hasSelected || !!team.checked;
        });
        return hasSelected;
    }


    $scope.removeSelectedTeam = function () {
        var chk = [];
        angular.forEach($scope.teams, function (team) {
            if (team.checked) chk.push(team._id);
        });
        if (!chk.length) return;
        $scope.removeTeam(chk.join(","));
    }
    
    $scope.removeTeam = async function (teamId) {
            const {
                value: operation
            } = await swal({
                title: "Remove team?",
                text: "Are you sure you want to remove?",
                type: "warning",
                showCancelButton: true,
                confirmButtonText: "Remove it!",
                confirmButtonColor: "#ec6c62",
                input: 'text',
                inputPlaceholder: 'Enter "DELETE" here',
                inputValidator: (value) => {
                    return value != 'DELETE' && 'You need to write "DELETE" !'
                }
            })

            if (operation) {
                $http.delete("/api/teams/" + teamId).then(function (response) {
                    console.log(response)
                    updateTeamList()
                }, function (error) {
                    console.log(error)
                })
            }


        }


    function updateTeamList() {
        $http.get("/api/competitions/" + competitionId +
            "/adminTeams").then(function (response) {
            $scope.teams = response.data;

            $scope.showCode = false;
            for(let t of $scope.teams){
                if (!Array.isArray(t.email)) t.email = [];
                t.email = t.email.filter(function (email) { return email; });
                if(t.teamCode != ""){
                    $scope.showCode = true;
                }
            }
        })
    }
    $scope.go = function (path) {
        window.location = path
    }

    $scope.goMyPage = function (team){
        window.open(`/mypage/${team._id}/${team.document.token}`, '_blank');
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
}])
