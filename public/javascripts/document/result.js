var app = angular.module("DocumentResult", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);
app.controller('DocumentResultController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

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

    const currentLang = $translate.proposedLanguage() || $translate.use();
    $scope.leagueId = leagueId;

    $scope.currentLang = currentLang;
    $scope.displayLang = currentLang;

    $scope.competitionId = competitionId;

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

    $http.get("/api/competitions/" + competitionId + "/documents/" + leagueId + "/review").then(function (response) {
        $scope.languages = response.data.languages;
        $scope.review = response.data.review;

        $scope.scaleBlock = [];
        $scope.blockTitle = [];

        let langConfirm = false;
        //Check 1st lang
        for(let l of $scope.languages){
            if(l.language == $scope.displayLang && l.enable){
                langConfirm = true;
                break;
            }
        }

        if(!langConfirm){
            //Set alternative lang
            for(let l of $scope.languages){
                if(l.enable){
                    $scope.displayLang = l.language;
                    break;
                }
            }
        }

        $http.get(`/api/ranking/${competitionId}/${leagueId}/document`).then(function (response) {
            $scope.teams = response.data;

            $scope.blockTitle = {};
            for (let block of $scope.teams[0].details) {
                $scope.blockTitle[block.blockId] = getBlockTitle(block.blockId);
            }

            $scope.teams.sort(function(a, b) {
                if(!a.teamCode && !b.teamCode){
                    if (a.name > b.name) {
                        return 1;
                    } else {
                        return -1;
                    }
                }else{
                    if (a.teamCode > b.teamCode) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
            });
        })
    })

    $scope.langContent = function(data, target){
        data[target] = $sce.trustAsHtml(data.filter( function( value ) {
            return value.language == $scope.displayLang;
        })[0][target]);

        return(data[target]);
    }

    function getBlockTitle(blockId) {
        return $scope.langContent($scope.review.find(r => r._id == blockId).i18n, 'title');
    }

    $scope.activeSortKey = -2;
    $scope.changeSort = function(blockId){
        let s = function(a, b){
            if(blockId == -1){
                // total score
                return b.score - a.score;
            }else{
                return b.details.find(d => d.blockId == blockId).score - a.details.find(d => d.blockId == blockId).score;
            }
        }

        $scope.teams.sort(function(a, b) {
            if(!a.teamCode && !b.teamCode){
                if (a.name > b.name) {
                    return 1;
                } else {
                    return -1;
                }
            }else{
                if (a.teamCode > b.teamCode) {
                    return 1;
                } else {
                    return -1;
                }
            }
            
        });
        if($scope.activeSortKey == blockId){
            $scope.activeSortKey = -2;
        }else{
            $scope.teams.sort(s);
            $scope.activeSortKey =  blockId;
        }
    }

    $scope.go = function (path) {
        window.location = path
    }

    $scope.refineName = "";
    $scope.refineCode = "";
    $scope.refineRegion = "";

    $scope.list_filter = function (value, index, array) {
        return (~value.name.indexOf($scope.refineName)) && (~value.teamCode.indexOf($scope.refineCode)) && (~value.country.indexOf($scope.refineRegion))
    }

    function teamSort(item1, item2){
        if(item1.team.teamCode > item2.team.teamCode) return 1;
        if(item1.team.teamCode < item2.team.teamCode) return -1;
        if(item1.team.name > item2.team.name) return 1;
        if(item1.team.name < item2.team.name) return -1;
    }

    $scope.downloadExcel = function(){
        $http.get("/api/document/reviews/"+ competitionId).then(function (response) {
            let answers = response.data.filter(d => d.team.league == leagueId).sort(teamSort);
            console.log(answers)

            let workbook = new ExcelJS.Workbook();
            workbook.creator = 'RCJ CMS';
            workbook.created = new Date();
            workbook.modified = new Date();

            let sheet = workbook.addWorksheet('Evaluation');

            sheet.getRow(1).getCell(1).value = $scope.competition.name;

            sheet.getColumn('B').width = 20;

            sheet.getRow(3).getCell(1).value = "Code";
            sheet.getRow(3).getCell(2).value = "Name";
            sheet.getRow(3).getCell(3).value = "Region";
            sheet.getRow(3).getCell(4).value = "Penalty";
            sheet.getRow(3).getCell(5).value = "Evaluator";

            // Block title & Question title
            let row = 2;
            let col = 6;
            lastCol = 6;
            for(let b of $scope.review){
                sheet.getRow(row).getCell(col).value = $sce.valueOf($scope.langContent(b.i18n, 'title'));
                sheet.getRow(row).getCell(col).fill = {
                    type: 'pattern',
                    pattern:'solid',
                    fgColor: {argb: `${b.color}`}
                };
                    
                for(let q of b.questions){
                    sheet.getRow(row+1).getCell(col).value = $sce.valueOf($scope.langContent(q.i18n, 'question'));
                    col += 1;
                }
                if(lastCol != col-1)
                sheet.mergeCells(row,lastCol,row,col-1);
                lastCol = col;
            }

            row = 4;
            for(let a of answers) {
                sheet.getRow(row).getCell(1).value = a.team.teamCode;
                sheet.getRow(row).getCell(2).value = a.team.name;
                sheet.getRow(row).getCell(3).value = a.team.country;
                sheet.getRow(row).getCell(4).value = a.team.document.penalty;
                sheet.getRow(row).getCell(5).value = a.reviewer?a.reviewer.username:a.name;
                col = 6;
                for(let b of $scope.review){
                    for(let q of b.questions){
                        let cc = a.comments[q._id];
                        if (cc != undefined) {
                            switch(q.type) {
                                case 'scale':
                                    if(cc != "") sheet.getRow(row).getCell(col).value = Number(cc);
                                    break;
                                case 'input':
                                    let d = document.createElement('div');
                                    d.innerHTML = cc;
                                    sheet.getRow(row).getCell(col).value = d.innerText;
                                    break;
                                case 'select':
                                    let val = q.i18n.find(i=>i.language == $scope.displayLang).options.find(o=>o.value == cc).text;
                                    if(isNaN(Number(val))) sheet.getRow(row).getCell(col).value = val;
                                    else sheet.getRow(row).getCell(col).value = Number(val);
                                    break;
                                default:
                                    sheet.getRow(row).getCell(col).value = cc;
                            }
                        }
                        col ++;
                    }
                }
                row ++;
            }

            let sheet2 = workbook.addWorksheet('EvaluationScore');
            sheet2.getRow(1).getCell(1).value = $scope.competition.name;

            sheet2.getColumn('B').width = 20;

            sheet2.getRow(3).getCell(1).value = "Code";
            sheet2.getRow(3).getCell(2).value = "Name";
            sheet2.getRow(3).getCell(3).value = "Region";
            sheet2.getRow(3).getCell(4).value = "Penalty";

            // Block title & Question title
            row = 3;
            col = 6;
            lastCol = 6;
            for(let b of $scope.teams[0].details){
                sheet2.getRow(row).getCell(col).value = $sce.valueOf($scope.blockTitle[b.blockId]);
                sheet2.getRow(row).getCell(col + 1).value = $sce.valueOf($scope.blockTitle[b.blockId]) + " (Normalized)";
                col += 2;
            }
            
            row ++;
            for(let team of $scope.teams){
                sheet2.getRow(row).getCell(1).value = team.teamCode;
                sheet2.getRow(row).getCell(2).value = team.name;
                sheet2.getRow(row).getCell(3).value = team.country;
                sheet2.getRow(row).getCell(4).value = team.document.penalty;

                col = 6;
                for (let b of team.details) {
                    sheet2.getRow(row).getCell(col).value = b.score;
                    sheet2.getRow(row).getCell(col + 1).value = b.normalizedScore
                    col +=2;
                }
                row ++;
            }

            workbook.xlsx.writeBuffer( {
                base64: true
            })
            .then( function (xls64) {
                // build anchor tag and attach file (works in chrome)
                var a = document.createElement("a");
                var data = new Blob([xls64], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

                var url = URL.createObjectURL(data);
                a.href = url;
                a.download = `${$scope.competition.name} - ${leagueId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    },
                    0);
            })
            .catch(function(error) {
                console.log(error.message);
            });
        });
    }
}]);
