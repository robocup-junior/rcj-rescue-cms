var app = angular.module("CabinetFile", ['ngTouch','ngAnimate', 'pascalprecht.translate', 'ngCookies', 'ngFileUpload']);

app.controller("CabinetFileController", ['$scope', '$http', '$translate', 'Upload', function ($scope, $http, $translate, Upload) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });

    let upload_mes;
    $translate('document.uploaded').then(function (val) {
        upload_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let trans = [];
    function loadTranslation(tag){
        $translate(`cabinet.js.${tag}`).then(function (val) {
            trans[tag] = val;
        }, function (translationId) {
        // = translationId;
        });
    }

    loadTranslation("delAsk");
    loadTranslation("delConfirm");
    loadTranslation("delComplete");
    loadTranslation("delCompleteMes");
    loadTranslation("delConfirmButton");
    loadTranslation("delCancelButton");


    
    $scope.competitionId = competitionId;
    $scope.teamId = teamId;
    $scope.token = token;
    $scope.files = [];
    $scope.loading = true;

    $scope.go = function (path) {
        window.location = path
    }

    $scope.getLeagueName = function (id){
        return($scope.leagues.find(l => l.id === id).name)
    }

    $http.get("/api/competitions/leagues").then(function (response) {
        $scope.leagues = response.data
        $http.get("/api/competitions/" + competitionId).then(function (response) {
            $scope.competition = response.data
        })
        if(isTeam){
            $http.get(`/api/teams/${leagueTeam}`).then(function (response) {
                $scope.team = response.data
                $scope.cabinetName = $scope.team.name;
                updateFiles();
            })
        }else{
            $scope.cabinetName = $scope.getLeagueName(leagueTeam);
            updateFiles();
        }
    })

    function updateFiles(){
        if(isMyPage){
            $http.get(`/api/cabinet/${competitionId}/files/${teamId}/${token}/${$scope.team.league}`).then(function (response) {
                $scope.files = response.data
                for(let f of $scope.files){
                    f.folder = $scope.team.league;
                }
                $http.get(`/api/cabinet/${competitionId}/files/${teamId}/${token}/${$scope.team._id}`).then(function (response) {
                    let files = response.data
                    for(let f of files){
                        f.folder = $scope.team._id;
                    }
                    $scope.files = $scope.files.concat(files);
                    $scope.loading = false;
                }, function(){
                    $scope.loading = false;
                })
            }, function(){
                $scope.loading = false;
            })
        }else{
            $http.get(`/api/cabinet/${competitionId}/files/${teamId}/${token}/${leagueTeam}`).then(function (response) {
                $scope.files = response.data
                for(let f of $scope.files){
                    f.folder = leagueTeam;
                }
                $scope.loading = false;
            }, function(){
                $scope.loading = false;
            })
        }
    }
    

    $scope.download = function(file){
        let  alink = document.createElement('a');
        alink.download = file.name;
        alink.href = `/api/cabinet/${competitionId}/file/${teamId}/${token}/${encodeURIComponent(file.folder)}/${encodeURIComponent(file.name)}`;
        alink.click();
        return false;
    }
    

    $scope.fileIcon = function(type){
        if(type == null) return "fa-file";
        switch(type){
            case 'text/plain':
                return "fa-file-alt";
            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return "fa-file-word";
            case 'application/pdf':
                return "fa-file-pdf";
            case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                return "fa-file-excel";
            case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                return "fa-file-powerpoint"
            case 'application/zip':
                return "fa-file-archive";
        }
        if(type.includes("video")) return "fa-file-video";
        if(type.includes("image")) return "fa-file-image";
        return "fa-file";
    }

    $scope.upload = function(file, errFiles) {
        $scope.f = file;
        $scope.errFile = errFiles && errFiles[0];
        if($scope.errFile){
            Toast.fire({
                type: 'error',
                title: "Error",
                html: $scope.errFile.$error + ' : ' + $scope.errFile.$errorParam
            })
        }
        if (file) {
            $scope.uploading = true;
            file.upload = Upload.upload({
                url: `/api/cabinet/${competitionId}/upload/${leagueTeam}`,
                data: {file: file}
            });

            file.upload.then(function (response) {
                    updateFiles();
                    file.result = response.data;
                    Toast.fire({
                        type: 'success',
                        title: upload_mes
                    })
                    delete $scope.f;
            }, function (response) {
                if (response.status > 0){
                    $scope.errorMsg = response.status + ': ' + response.data.msg;
                     Toast.fire({
                        type: 'error',
                        title: "Error: " + response.statusText,
                        html: response.data.msg
                    })
                }
            }, function (evt) {
                file.progress = Math.min(100, parseInt(100.0 * 
                                         evt.loaded / evt.total));
            });
        }   
    }

    $scope.delete = function(file){
        Swal.fire({
            title: trans['delAsk'],
            html: `${trans['delConfirm']}<br><strong>${file.name}</strong>`,
            type: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: trans['delConfirmButton'],
            cancelButtonText: trans['delCancelButton']
            }).then((result) => {
            if (result.value) {
                $http.delete(`/api/cabinet/${competitionId}/file/${encodeURIComponent(file.folder)}/${encodeURIComponent(file.name)}`).then(function (response) {
                    Swal.fire(
                        trans['delComplete'],
                        `${file.name} ${trans['delCompleteMes']}`,
                        'success'
                    )
                    updateFiles();
                }, function (response) {
                    Swal.fire(
                        'Oops...',
                        response.data.msg,
                        'error'
                    )
                    updateFiles();
                });
            }
        })  
    }
}])
