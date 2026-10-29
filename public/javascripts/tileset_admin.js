// register the directive with your app module
var app = angular.module('TilesetAdmin', ['ngTouch','lvl.services', 'ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies']);

// function referenced by the drop target
app.controller('TilesetAdminController', ['$scope', '$uibModal', '$log', '$http', '$translate', function ($scope, $uibModal, $log, $http, $translate) {

    $translate('admin.line_tSet.import').then(function (val) {
        $("#select").fileinput({
            'showUpload': false,
            'showPreview': false,
            'showRemove': false,
            'showCancel': false,
            'msgPlaceholder': val,
            allowedFileExtensions: ['json'],
            msgValidationError: "ERROR"
        });
    }, function (translationId) {
        // = translationId;
    });

    function updateTileSetList(callback) {
        $http.get("/api/maps/line/tilesets?populate=true").then((response) => {
            $scope.tileSets = response.data
            $scope.tileSet = $scope.tileSets[0]
            $scope.translationData = {
                setName: $scope.tileSet.name
            };

            if (callback != null) {
                callback()
            }
        })
    }

    if(getParam('name')){
        updateTileSetList(() => {
            const newTileSet = $scope.tileSets.filter((tileSet) => tileSet.name ==
              getParam('name'));
            if (newTileSet.length > 0) {
                $scope.tileSet = newTileSet[0]
            }
        })
    }else{
        updateTileSetList()
    }

    
    $scope.$watch('tileSet.name', function(newValue, oldValue, scope) {
        try{
        scope.translationData = {
                setName: scope.tileSet.name
            };
        }
        catch(e){
            
        }
    });

    
    $scope.go = function (path) {
        window.location = path
    }

    $http.get("/api/maps/line/tiletypes").then((response) => {
        $scope.tileTypes = response.data
    })

    $scope.addTile = function (tileType) {

        // Check if tileType already exists in tileSet
        var result = $scope.tileSet.tiles.filter(
            (tile) => tile.tileType._id == tileType._id
        )

        if (result.length == 0) {
            $scope.tileSet.tiles.push({
                tileType: tileType,
                count: 1
            })
        } else {
            result[0].count++
        }
    }

    $scope.addAll = function () {
        for(let t of $scope.tileTypes){
            $scope.addTile(t);
        }
    }

    $scope.removeTile = function (tile) {
        var tileToRemove = tile

        tileToRemove.count--

            if (tileToRemove.count <= 0) {
                $scope.tileSet.tiles = $scope.tileSet.tiles.filter(
                    (tile) => tile.tileType._id != tileToRemove.tileType._id
                )
            }
    }

    $scope.createNewTileSet = function () {
        const newName = $scope.newTileSetName;
        $http.post("/api/maps/line/tilesets", {
            name: newName
        }).then(
            (response) => {
                $scope.newTileSetName = "";
                updateTileSetList(() => {
                    const newTileSet = $scope.tileSets.filter((tileSet) => tileSet.name ==
                        newName);
                    if (newTileSet.length > 0) {
                        $scope.tileSet = newTileSet[0]
                    }
                })
                Swal.fire(
                  'Created!',
                  'The changes have been saved successfully.',
                  'success'
                )
            }, (error) => {
                console.error(error)
              Swal.fire(
                'Error!',
                "We couldn't save the changes ;(",
                'error'
              )
            })
    }

    $scope.duplicateTileSet = function () {
        const newName = $scope.newTileSetName;
        $http.post("/api/maps/line/tilesets", {
            name: newName
        }).then(
          (response) => {
              $scope.newTileSetName = "";
              $scope.tileSet._id = response.data.id;
              $scope.tileSet.name = newName;
              $http.put("/api/maps/line/tilesets/" +
                response.data.id, $scope.tileSet).then(
                (response) => {
                    console.log("Saved!")
                    Swal.fire(
                      'Duplicated!',
                      'The changes have been saved successfully.',
                      'success'
                    )
                    updateTileSetList(() => {
                        const newTileSet = $scope.tileSets.filter((tileSet) => tileSet.name ==
                          newName);
                        if (newTileSet.length > 0) {
                            $scope.tileSet = newTileSet[0];
                            $scope.translationData = {
                                setName: $scope.tileSet.name
                            };
                        }
                    })
                }, (error) => {
                    console.error(error)
                    Swal.fire(
                      'Error!',
                      "We couldn't save the changes ;(",
                      'error'
                    )
                });
          }, (error) => {
              console.error(error)
              Swal.fire(
                'Error!',
                "We couldn't save the changes ;(",
                'error'
              )
          })
    }

    $scope.save = function () {
        $http.put("/api/maps/line/tilesets/" +
            $scope.tileSet._id, $scope.tileSet).then(
            (response) => {
                console.log("Saved!")
                Swal.fire(
                  'Updated!',
                  'The changes have been saved successfully.',
                  'success'
                )
            }, (error) => {
                console.error(error)
                Swal.fire(
                    'Error!',
                    "We couldn't save the changes ;(",
                    'error'
                )
            })
    }

    $scope.delete = async function () {
        const {
            value: operation
        } = await swal({
            title: "Delete tile set?",
            text: "Are you sure you want to remove the tile set: " + $scope.tileSet.name +"?",
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete it!",
            confirmButtonColor: "#ec6c62",
            input: 'text',
            inputPlaceholder: 'Enter '+ $scope.tileSet.name +' here',
            inputValidator: (value) => {
                return value != $scope.tileSet.name && 'You need to type: ' + $scope.tileSet.name
            }
        })

        if (operation) {
            $http.delete("/api/maps/line/tilesets/" +
              $scope.tileSet._id).then((response) => {
                updateTileSetList()
            }, (error) => {
                console.error(error)
            })
        }
    }

    $scope.export = function () {
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify($scope.tileSet))
        var downloadLink = document.createElement('a')
        document.body.appendChild(downloadLink);
        downloadLink.setAttribute("href", dataStr)
        downloadLink.setAttribute("download", $scope.tileSet.name + '.json')
        downloadLink.click()
        document.body.removeChild(downloadLink);
    }

    // File APIに対応しているか確認
    if (window.File) {
        var select = document.getElementById('select');

        // ファイルが選択されたとき
        select.addEventListener('change', function (e) {
            // 選択されたファイルの情報を取得
            var fileData = e.target.files[0];

            var reader = new FileReader();
            // ファイル読み取りに失敗したとき
            reader.onerror = function () {
                alert('ファイル読み取りに失敗しました')
            }
            // ファイル読み取りに成功したとき
            reader.onload = function () {
                var data = JSON.parse(reader.result);
                $scope.tileSet = data;
                $http.post("/api/maps/line/tilesets", data).then(
                  (response) => {
                      updateTileSetList(() => {
                          const newTileSet = $scope.tileSets.filter((tileSet) => tileSet.name ==
                            data.name);
                          if (newTileSet.length > 0) {
                              $scope.tileSet = newTileSet[0];
                              $scope.translationData = {
                                  setName: $scope.tileSet.name
                              };
                          }
                      })
                      Swal.fire(
                        'Imported!',
                        'The changes have been saved successfully.',
                        'success'
                      )
                      $scope.$apply();
                  }, (error) => {
                      console.error(error)
                      Swal.fire(
                        'Error!',
                        "We couldn't save the changes ;(",
                        'error'
                      )
                  })

            }

            // ファイル読み取りを実行
            reader.readAsText(fileData);
        }, false);
    }

    function getParam(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
          results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
}]);
