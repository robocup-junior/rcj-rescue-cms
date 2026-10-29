var app = angular.module("TemplateEditor", ['ngTouch','ngAnimate', 'ui.bootstrap', 'pascalprecht.translate', 'ngCookies', 'ngQuill']);
app.controller('TemplateEditorController', ['$scope', '$uibModal', '$log', '$http', '$translate', '$sce', function ($scope, $uibModal, $log, $http, $translate, $sce) {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
      
    let complete_mes;
    $translate('admin.mailTemplates.js.complete').then(function (val) {
        complete_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    let completeMes_mes;
    $translate('admin.mailTemplates.js.completeMes').then(function (val) {
        completeMes_mes = val;
    }, function (translationId) {
    // = translationId;
    });

    $scope.trust = function(html){
        return($sce.trustAsHtml(html));
    }

    $scope.subject = subject;

    $scope.mode = "write";

    $scope.go = function (path) {
        window.location = path
    }

    $scope.toTeam = [
        {
            "name": "Team name here",
            "document":{
                "deadline": null
            },
            "_id": "XXXXXXXXXXXXXXXXX",
            "league": "League",
        }
    ];
    prepareVariable();

    function prepareVariable(){
        for(let i=0; i<$scope.toTeam.length; i++){
            let teamDeadline = $scope.toTeam[i].document.deadline;
            let deadline = 1800000000;
            if(teamDeadline != null) deadline = teamDeadline;

            let d = new Date(deadline * 1000);
            let options = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long" };
            let optionsUTC = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",timeZoneName:"long", timeZone:"UTC"};
            $scope.toTeam[i].variable = {
                "teamName": $scope.toTeam[i].name,
                "teamId": $scope.toTeam[i]._id,
                "competitionName": "Competition name here",
                "competitionId": "YYYYYYYYYYYYYYYYYY",
                "leagueId": $scope.toTeam[i].league,
                "league": "League name here",
                "deadlineUNIX": deadline,
                "deadlineLocal": new Intl.DateTimeFormat(navigator.language, options).format(d),
                "deadlineUTC": new Intl.DateTimeFormat('en-US', optionsUTC).format(d),
                "documentUrl": `${location.protocol}//${location.host}/document/${$scope.toTeam[i]._id}/ZZZZZZZZZZZZZZZZZZZZZZZ`,
                "mypageUrl": `${location.protocol}//${location.host}/mypage/${$scope.toTeam[i]._id}/ZZZZZZZZZZZZZZZZZZZZZZZ`
            };
        }
    }

    $scope.mailContent = "";
    if($scope.subject!=""){
        $http.get(`/api/mail/templates/${$scope.subject}.html`).then(function (response) {
            $scope.mailContent = response.data;
        })
    }
    

    // In the HTML of the content, the values (a team's name, which the team may have given) as
    // text: escaped, not taken as HTML
    function escapeHtml(value){
        return String(value).replace(/[&<>"']/g, function(c){
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
        });
    }

    function template(string, values, html){
        return string.replace(/\$\{(.*?)\}/g, function(all, key){
            if (!Object.prototype.hasOwnProperty.call(values, key)) return "";
            return html ? escapeHtml(values[key]) : values[key];
        });
    }

    $scope.previewNo = 0;
    $scope.preview = function(){
        for(let team of $scope.toTeam){
            team.mailData = {
                "title": template($scope.subject, team.variable),
                "content": template($scope.mailContent, team.variable, true).replace(/<p><br><\/p>/g,"<br>").replace(/<\/p><p>/g,"<br>")
            }
        }
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

    $scope.showVariable = function(variable){
        let html = `<div style="max-height:calc(100vh - 200px);overflow:auto;"><table class='custom'><thead><tr><th>Name</th><th>Contents</th></tr></thead><tbody>`;
        Object.keys(variable).forEach((key) => {
            html += `<tr><td>\${${key}}</td><td>${variable[key]}</td></tr>`;
        })
        html += "</tbody></table></div>";

        Swal.fire({
            title: 'Variables',
            html: html,
            width: "100%",
            height: "100%",
            showCloseButton: true, 
        })
    }

    $scope.save = function(){
        let tmp = {
            content: $scope.mailContent
        }
        $http.post(`/api/mail/templates/${$scope.subject}.html`, tmp).then(function (response) {
            swal({
                type: 'success',
                title: complete_mes,
                html: completeMes_mes
            }).then((result) => {
                window.location = "/admin/mailTemplates"
            })

        }, function (error) {
            console.log(error)
            Swal({
                type: 'error',
                title: "ERROR",
                html: error.data.msg || error.data.message
            })
        })
    }

  
    $scope.quillHeight = function (editor) {
        editor.container.style.height = '500px';
    };
}]);

app.constant('NG_QUILL_CONFIG', {
    /*
     * @NOTE: this config/output is not localizable.
     */
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
        ['blockquote', 'code-block'],
  
        [{ 'header': 1 }, { 'header': 2 }],               // custom button values
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'script': 'sub' }, { 'script': 'super' }],     // superscript/subscript
        [{ 'indent': '-1' }, { 'indent': '+1' }],         // outdent/indent
        [{ 'direction': 'rtl' }],                         // text direction
  
        [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  
        [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
        [{ 'font': [] }],
        [{ 'align': [] }],
  
        ['clean'],                                         // remove formatting button
  
        ['link', 'image', 'video']                         // link and image, video
      ],
      imageResize: {
      },
      imageDropAndPaste: {
      }
    },
    theme: 'snow',
    debug: 'warn',
    placeholder: '',
    readOnly: false,
    bounds: document.body,
    scrollContainer: null
})
  
app.config([
    'ngQuillConfigProvider',
    'NG_QUILL_CONFIG',

    function (ngQuillConfigProvider, NG_QUILL_CONFIG) {
        ngQuillConfigProvider.set(NG_QUILL_CONFIG)
    }
])
