var app = angular.module("Clock", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("ClockController", ['$scope', '$http', '$translate', '$timeout', function ($scope, $http, $translate, $timeout) {
    $scope.competitionId = competitionId

    date = new Date();
    $scope.time = date.getTime();
    $scope.runs = [];
    $scope.timeDep = 0;
    var lr=[];
    var mr=[];
   
    function tick() {
        date = new Date();
        $scope.time = Number(date.getTime()) + Number($scope.timeDep);

        $timeout(tick, 200);
    }


    tick();
    
    $scope.range = function (n) {
        arr = [];
        for (var i = 0; i < n; i++) {
            arr.push(i);
        }
        return arr;
    }
    
    // launch socket.io
    socket = io(window.location.origin, {
        transports: ['websocket']
    });
    if (typeof competitionId !== 'undefined') {
        // (again on reconnecting: the server forgets the rooms of a lost connection)
        socket.on('connect', function () {
            socket.emit('subscribe', 'runs/line/' + competitionId + '/status');
            socket.emit('subscribe', 'runs/maze/' + competitionId + '/status');
        });

        socket.on('LChanged', function (data) {
            update_line_list();
            $scope.$apply();
        });
        
        socket.on('MChanged', function (data) {
            update_maze_list();
            $scope.$apply();
        });
    }
    
    $http.get("/api/competitions/" + competitionId + "/fields").then(function (response) {
        $scope.fields = response.data
    })
    
    
    function update_line_list(){
        $http.get(`/api/runs/line/competition/${competitionId}?populate=true&minimum=true&ended=true`).then(function (response) {
            lr = response.data
            $scope.runs=[];
            for(let run of lr){
                if(run.status < 4){
                    if(!$scope.runs[run.field._id]) $scope.runs[run.field._id]=[];
                    try{
                        run.teamCode = run.team.teamCode;
                        run.teamName = run.team.name;
                        $scope.runs[run.field._id].push(run);
                    }
                    catch(e){
                        
                    }
                   
                }
            }
            for(let run of mr){
                if(run.status < 4){
                    if(!$scope.runs[run.field._id]) $scope.runs[run.field._id]=[];
                    try{
                        run.teamCode = run.team.teamCode;
                        run.teamName = run.team.name;
                        $scope.runs[run.field._id].push(run);
                    }
                    catch(e){
                        
                    }
                    
                }
            }
            

            
        });
    }
    
    function update_maze_list(){
        $http.get(`/api/runs/maze/competition/${competitionId}?minimum=true&ended=true`).then(function (response) {
            mr = response.data
            $scope.runs=[];
            for(let run of lr){
                if(run.status < 4){
                    if(!$scope.runs[run.field._id]) $scope.runs[run.field._id]=[];
                    try{
                        run.teamCode = run.team.teamCode;
                        run.teamName = run.team.name;
                        $scope.runs[run.field._id].push(run);
                    }
                    catch(e){
                        
                    }
                    
                }
            }
            for(let run of mr){
                if(run.status < 4){
                    if(!$scope.runs[run.field._id]) $scope.runs[run.field._id]=[];
                    try{
                        run.teamCode = run.team.teamCode;
                        run.teamName = run.team.name;
                        $scope.runs[run.field._id].push(run);
                    }
                    catch(e){
                        
                    }
                   
                }
            }
            
            

            
        });
    }
    
    update_line_list();
    update_maze_list();
}]);


$(window).on('beforeunload', function () {
    socket.emit('unsubscribe', 'runs/line/' + competitionId + '/status');
    socket.emit('unsubscribe', 'runs/maze/' + competitionId + '/status');
});