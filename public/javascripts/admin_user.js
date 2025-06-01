var app = angular.module("AdminUser", ['ngTouch','pascalprecht.translate', 'ngCookies']);
app.controller("AdminUserController", ['$scope', '$http', function ($scope, $http) {
    
    updateUserList()
    

    $scope.addUser = function () {
        var newUser = {
            username: $scope.userName,
            password: $scope.userPass,
            email: $scope.userEmail,
            admin: $scope.userAuthAdmin,
            superDuperAdmin: $scope.userAuthSuper,
            emailNotification: $scope.emailNotification,
            competitions: []
        }
        $http.post("/api/users", newUser).then(function (response) {
            updateUserList()
        }, function (error) {
            console.log(error)
        })
    }

    $scope.removeUser = function (user) {
        swal({
            title: "Remove user?",
            text: "Are you sure you want to remove the user: " +
                user.username + '?',
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Remove it!",
            confirmButtonColor: "#ec6c62"
        }).then((result) => {
            if (result.value) {
            $http.delete("/api/users/" + user._id).then(function (response) {
                updateUserList()
            }, function (error) {
                console.log(error)
            })
            }
        })
    }
    
    $scope.go = function (path) {
        window.location = path
    }

    function updateUserList() {
        $http.get("/api/users").then(function (response) {
            $scope.users = response.data
        })
        $scope.userAuthAdmin= false
        $scope.userAuthSuper= false
        $scope.userPass = generatePass();
    }

    function generatePass() {
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        var numbers = '0123456789';

        var string  = letters + letters.toUpperCase() + numbers;

        var len = 10;
        var password='';
        

        for (var i = 0; i < len; i++) {
            password += string.charAt(Math.floor(Math.random() * string.length));
        }
        return password;
    }
}])
