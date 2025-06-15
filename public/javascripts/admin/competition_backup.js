var app = angular.module("AdminBackup", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("AdminBackupController", ['$scope', '$http', '$translate', function ($scope, $http, $translate) {
    $scope.competitionId = competitionId;
    $scope.job = null;
    let trans = [];
    function loadTranslation(tag){
        $translate(`admin.backup.js.${tag}`).then(function (val) {
            trans[tag] = val;
        }, function (translationId) {
        // = translationId;
        });
    }

    loadTranslation("complete");

    $http.get("/api/competitions/" + competitionId).then(function (response) {
        $scope.competition = response.data
    })

    function updateList(){
        $http.get("/api/backup/list/" + competitionId).then(function (response) {
            $scope.backedup = response.data
        })
    }
    updateList();
    
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

    $scope.exeBackup = function (fullBackup) {
        $http.post('/api/backup/'+$scope.competitionId, {fullBackup}).then(function (response) {
            updateJobStatus(response.data.jobId);
        }, function (error) {
            Swal.close()
            Swal({
                type: 'error',
                title: "ERROR",
                html: error.data.msg
            })
        })
    }

    function updateJobStatus(jobId){
        $http.get("/api/backup/job/" + jobId).then(function (response) {
            $scope.job = response.data
            if($scope.job.state == "completed"){
                Swal({
                    type: 'success',
                    html: trans["complete"]
                })
                updateList();
            }else if($scope.job.state == "failed"){
                Swal.fire({
                    type: 'error',
                    html: $scope.job.reason
                });
            }else{
                setTimeout(updateJobStatus, 1000, jobId);
            }
        })
    }

    $scope.statusIcon = function(status){
        switch(status){
            case 'completed':
                return "fa-check";
            case 'failed':
                return "fa-times";
            case 'delayed':
                return "fa-clock";
            case 'active':
                return "fa-spinner fa-pulse";
            case 'waiting':
                return "fa-hourglass-half";
            case 'paused':
                return "fa-pause";
            case 'stuck':
                return "fa-layer-group";
        }
        return "fa-ellipsis-h";
    }

    $scope.statusColour = function(status){
        switch(status){
            case 'completed':
                return "badge-success";
            case 'failed':
                return "badge-danger";
            case 'delayed':
                return "badge-warning";
            case 'active':
                return "badge-primary";
            case 'waiting':
                return "badge-secondary";
            case 'paused':
                return "badge-secondary";
            case 'stuck':
                return "badge-warning";
        }
        return "badge-secondary";
    }

    $scope.firstUpper = function(text){
        if(!text) return;
        return text.substring(0, 1).toUpperCase() + text.substring(1);
    }

    $scope.download = function(name){
        window.open(`/api/backup/archive/${$scope.competitionId}/${name}`)
    }

    $scope.delete = async function (name) {
        const {
            value: operation
        } = await swal({
            title: "Remove this back up?",
            text: "Are you sure you want to remove the back up: " + name + '?',
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete it!",
            confirmButtonColor: "#ec6c62",
            input: 'text',
            inputPlaceholder: 'Enter "DELETE" here',
            inputValidator: (value) => {
                return value != 'DELETE' && 'You need to type "DELETE" !'
            }
        })

        if (operation) {
            $http.delete(`/api/backup/archive/${$scope.competitionId}/${name}`).then(function (response) {
                updateList()
            }, function (error) {
                console.log(error)
            })
        }
    }

}])
