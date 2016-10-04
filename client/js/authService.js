        (function () {

            var LOCAL_TOKEN_KEY = 'yourTokenKey';
            var username = '';
            var isAuthenticated = false;
            var role = '';
            var authToken;

            function validateForm() {
                var x = document.forms["login"]["username"].value;
                if (x == null || x == "") {
                    alert("Please fill out the username");
                    return false;
                }
            }

            function login(user) {
                return $q(function (resolve, reject) {
                    $http.post(API_ENDPOINT.url + '/authenticate', user).then(function (result) {
                        if (result.data.success) {
                            console.log("saving the token");
                            storeUserCredentials(result.data.token);
                            resolve(result.data.msg);
                        } else {
                            reject(result.data.msg);
                        }
                    });
                });
            }

            function storeUserCredentials(token) {
                window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
                useCredentials(token);
            }

            function useCredentials(token) {
                username = token.split('.')[0];
                isAuthenticated = true;
                authToken = token;

                if (username == 'admin') {
                    role = USER_ROLES.admin
                }
                if (username == 'user') {
                    role = USER_ROLES.public
                }

                // Set the token as header for your requests!
                $http.defaults.headers.common['X-Auth-Token'] = token;
            }

            var logout = function () {
                destroyUserCredentials();
            };

            function destroyUserCredentials() {
                authToken = undefined;
                username = '';
                isAuthenticated = false;
                $http.defaults.headers.common['X-Auth-Token'] = undefined;
                window.localStorage.removeItem(LOCAL_TOKEN_KEY);
            }

            var isAuthorized = function (authorizedRoles) {
                if (!angular.isArray(authorizedRoles)) {
                    authorizedRoles = [authorizedRoles];
                }
                return (isAuthenticated && authorizedRoles.indexOf(role) !== -1);
            };

            function tokenManagement() {
                var token = window.localStorage.getItem('token');
                if (token) {
                    options.headers = {
                        'x-access-token': token
                    }
                }
            }
        }());
