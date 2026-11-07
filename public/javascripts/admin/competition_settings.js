const app = angular.module("AdminSettings", ['ngTouch', 'pascalprecht.translate', 'ngCookies', 'color.picker','ngSanitize']);
app.controller("AdminSettingsController", ['$scope', '$http', function ($scope, $http) {
  $scope.competitionId = competitionId
  updateUserList()
  $http.get("/api/competitions/" + competitionId).then(function (response) {
    $scope.competition = response.data;
    $scope.cName = response.data.name;
    $scope.cColor = response.data.color;
    $scope.bColor = response.data.bkColor;
    $scope.message = response.data.message;
    $scope.description = response.data.description;
    $scope.logo = response.data.logo;
    $scope.competitonUseRule = response.data.rule;
    $scope.preparation = response.data.preparation;
    // (not stored for the competitions from before it could be turned on: off for them)
    $scope.manualInput = response.data.manualInput === true;
    $scope.leagues  = response.data.leagues;
  })

  $http.get("/api/competitions/leagues").then(function (response) {
    $scope.allLeagues = [];
    for (let e of response.data) {
      $scope.allLeagues[e.id] = {
        name: e.name,
        rules: e.rules
      };
    }
  })

  $scope.updateAuthority = function (userid, acLevel) {
    $http.put("/api/users/" + userid + "/" + competitionId + "/" + acLevel).then(function (response) {
      updateUserList()
    }, function (error) {
      console.log(error)
    })
  }

  $scope.hasRole = function (user, role) {
    let userRole = user.nowRole;
    return userRole.includes(role);
  }

  $scope.grantRole = function (user, role) {
    let userRole = user.nowRole;
    userRole.push(role);
    $http.put("/api/users/" + user._id + "/" + competitionId + "/role", userRole).then(function (response) {
      updateUserList()
    }, function (error) {
      console.log(error)
    })
  }

  $scope.revokeRole = function (user, role) {
    let userRole = user.nowRole.filter((r) => r !== role);;
    $http.put("/api/users/" + user._id + "/" + competitionId + "/role", userRole).then(function (response) {
      updateUserList()
    }, function (error) {
      console.log(error)
    })
  }

  $scope.go = function (path) {
    window.location = path
  }


  $scope.set = function () {
    let data = {
      name: $scope.cName,
      rule: $scope.competitonUseRule,
      logo: $scope.logo,
      bkColor: $scope.bColor,
      color: $scope.cColor,
      message: $scope.message,
      description: $scope.description,
      leagues: $scope.leagues,
      preparation: $scope.preparation,
      manualInput: $scope.manualInput
    }

    $http.put("/api/competitions/" + $scope.competitionId, data).then(function (response) {
      location.reload();
    }, function (response) {
      console.log("Error: " + response.statusText);
      alert(response.data.msg);
    });
  }


  function updateUserList() {
    $http.get("/api/users").then(function (response) {
      $scope.users = response.data

      for (let i = 0; i < $scope.users.length; i++) {
        $scope.users[i].nowAuth = -1;
        $scope.users[i].nowRole = [];
        for (let j = 0; j < $scope.users[i].competitions.length; j++) {
          if ($scope.competitionId == $scope.users[i].competitions[j].id) {
            $scope.users[i].nowAuth = $scope.users[i].competitions[j].accessLevel
            if ($scope.users[i].competitions[j].role) {
              $scope.users[i].nowRole = $scope.users[i].competitions[j].role;
            }
            break;
          }
        }
      }
    })

  }

  var file = null;
  var blob = null;
  const THUMBNAIL_WIDTH = 500;
  const THUMBNAIL_HEIGHT = 300;

  if (window.File) {
    var select = document.getElementById('select');

    select.addEventListener('change', function (e) {
      var file = e.target.files[0];

      if (file.type != 'image/jpeg' && file.type != 'image/png' && file.type != 'image/gif') {
        file = null;
        blob = null;
        return;
      }

      var image = new Image();
      var reader = new FileReader();
      reader.onload = function(e) {
        image.onload = function() {
          var width, height;
          if(image.width > image.height){
            var ratio = image.height/image.width;
            width = THUMBNAIL_WIDTH;
            height = THUMBNAIL_WIDTH * ratio;
          } else {
            var ratio = image.width/image.height;
            width = THUMBNAIL_HEIGHT * ratio;
            height = THUMBNAIL_HEIGHT;
          }
          var canvas = $('#canvas')
            .attr('width', width)
            .attr('height', height);
          var ctx = canvas[0].getContext('2d');
          ctx.clearRect(0,0,width,height);
          ctx.drawImage(image,0,0,image.width,image.height,0,0,width,height);

          var base64 = canvas.get(0).toDataURL('image/png');
          $scope.logo = base64;
          $scope.$apply()
        }
        image.src = e.target.result;
      }

      reader.readAsDataURL(file);
    }, false);
  }
}]);
